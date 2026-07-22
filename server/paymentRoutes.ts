/**
 * Payment routes — PayPal orders (full pay) + subscriptions (monthly/quarterly).
 * Also handles webhooks, admin controls, and access-pause logic.
 */
import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import {
  getPayPalConfig, paypalConfigured,
  createOrder, captureOrder,
  ensurePlan, createSubscription, getSubscription, cancelSubscription,
  verifyWebhookSignature,
} from "./paypal";

// Plan structure — total installments per plan type.
// Full = 1 payment. Quarterly = 4 payments over 12 months. Monthly = 12 over 12 months.
export function planInstallments(planType: string): number {
  if (planType === "monthly") return 12;
  if (planType === "quarterly") return 4;
  return 1;
}

// installment_cents rounded to whole cents; last payment absorbs remainder to make total exact.
export function computeInstallmentCents(totalCents: number, planType: string): number {
  const n = planInstallments(planType);
  return Math.floor(totalCents / n);
}

// Compute the tuition + app fee + scholarship discount for a checkout quote.
// Returns all values in CENTS.
export interface CheckoutQuote {
  tuitionCents: number;
  appFeeCents: number;
  discountCents: number;      // total discount applied against tuition (never negative, never > tuition)
  discountedTuitionCents: number; // tuitionCents - discountCents
  appFeeWaived: boolean;
  totalDueCents: number;      // (discountedTuition) + (appFee if not waived) -- what the plan represents
  installmentCents: number;   // per-installment amount (equals totalDue for full)
  totalInstallments: number;
  firstPaymentCents: number;  // for full: same as total. for subs: installment + (app fee if not waived)
  hasScholarship: boolean;
  scholarshipName: string;
}

export async function computeCheckoutQuote(userId: number, programId: number, planType: string): Promise<CheckoutQuote | null> {
  const program = await storage.getProgram(programId);
  if (!program) return null;
  const tuitionCents = program.tuition * 100;
  const appFeeCents = (program as any).appFee * 100;

  const scholarship = await storage.getActiveScholarship(userId, programId);
  let discountCents = 0;
  let appFeeWaived = false;
  let scholarshipName = "";
  if (scholarship) {
    scholarshipName = scholarship.name || "Scholarship";
    appFeeWaived = scholarship.waiveAppFee === 1;
    if (scholarship.discountType === "percent") {
      const pct = Math.max(0, Math.min(100, scholarship.discountValue));
      discountCents = Math.round(tuitionCents * pct / 100);
    } else {
      // fixed cents off tuition
      discountCents = Math.max(0, Math.min(tuitionCents, scholarship.discountValue));
    }
  }
  const discountedTuitionCents = Math.max(0, tuitionCents - discountCents);
  const effectiveAppFeeCents = appFeeWaived ? 0 : appFeeCents;

  // Plan totalCents represents tuition portion (app fee is treated as a first-payment surcharge)
  const totalCents = discountedTuitionCents;
  const totalInstallments = planInstallments(planType);
  const installmentCents = totalInstallments === 1 ? totalCents : Math.floor(totalCents / totalInstallments);
  // First payment adds the app fee. For full-pay, that's tuition (post-scholarship) + app fee.
  const firstPaymentCents = installmentCents + effectiveAppFeeCents;
  const totalDueCents = discountedTuitionCents + effectiveAppFeeCents;

  return {
    tuitionCents,
    appFeeCents,
    discountCents,
    discountedTuitionCents,
    appFeeWaived,
    totalDueCents,
    installmentCents,
    totalInstallments,
    firstPaymentCents,
    hasScholarship: Boolean(scholarship),
    scholarshipName,
  };
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  next();
}
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId || req.session.role !== "admin")
    return res.status(403).json({ message: "Admin access required" });
  next();
}

// A student's enrollment is considered access-active if:
// - They have no payment plan (legacy pre-payment enrollment), OR
// - Their plan status === 'active' or 'completed'
export async function enrollmentHasAccess(userId: number, programId: number): Promise<boolean> {
  const enrollment = await storage.getEnrollment(userId, programId);
  if (!enrollment) return false;
  const plan = await storage.getPaymentPlanByEnrollment(enrollment.id);
  if (!plan) return true; // grandfather old enrollments
  return plan.status === "active" || plan.status === "completed";
}

export function registerPaymentRoutes(app: Express) {
  // ---------- PUBLIC: paypal status (so frontend knows whether to show PayPal buttons) ----------
  app.get("/api/paypal/status", async (_req, res) => {
    const cfg = await getPayPalConfig();
    res.json({
      configured: paypalConfigured(cfg),
      mode: cfg.mode,
      clientId: paypalConfigured(cfg) ? cfg.clientId : "",
    });
  });

  // ---------- ADMIN: get/set paypal config ----------
  app.get("/api/admin/paypal/config", requireAdmin, async (_req, res) => {
    const cfg = await getPayPalConfig();
    // Never expose the full secret. Return only whether it's set.
    res.json({
      clientId: cfg.clientId,
      mode: cfg.mode,
      webhookId: cfg.webhookId,
      hasSecret: Boolean(cfg.clientSecret),
    });
  });

  app.post("/api/admin/paypal/config", requireAdmin, async (req, res) => {
    const { clientId, clientSecret, mode, webhookId } = req.body as any;
    if (typeof clientId === "string") await storage.setSetting("paypal_client_id", clientId.trim());
    if (typeof clientSecret === "string" && clientSecret.trim().length > 0) {
      await storage.setSetting("paypal_client_secret", clientSecret.trim());
    }
    if (typeof mode === "string" && (mode === "sandbox" || mode === "live")) {
      await storage.setSetting("paypal_mode", mode);
    }
    if (typeof webhookId === "string") await storage.setSetting("paypal_webhook_id", webhookId.trim());
    // Reset cached plan IDs when credentials change, so we recreate under the new account
    if (typeof clientId === "string" || (typeof clientSecret === "string" && clientSecret.length > 0)) {
      // Wipe cached PayPal plan/product IDs; they belong to the old account
      const all = await storage.listSettings();
      for (const s of all) {
        if (s.key.startsWith("paypal_plan_") || s.key === "paypal_product_id") {
          await storage.setSetting(s.key, "");
        }
      }
    }
    res.json({ ok: true });
  });

  // ---------- STUDENT: my payment plan for a program ----------
  app.get("/api/payments/plan/:programId", requireAuth, async (req, res) => {
    const programId = Number(req.params.programId);
    const enrollment = await storage.getEnrollment(req.session.userId!, programId);
    if (!enrollment) return res.json({ enrollment: null, plan: null });
    const plan = await storage.getPaymentPlanByEnrollment(enrollment.id);
    res.json({ enrollment, plan });
  });

  // ---------- STUDENT: my transactions ----------
  app.get("/api/payments/transactions/me", requireAuth, async (req, res) => {
    const txs = await storage.listTransactionsByUser(req.session.userId!);
    res.json(txs);
  });

  // ---------- STUDENT: get a checkout quote (tuition + app fee + scholarship) ----------
  app.get("/api/payments/quote", requireAuth, async (req, res) => {
    const programId = Number(req.query.programId);
    const planType = String(req.query.planType || "full");
    if (!programId) return res.status(400).json({ message: "programId required" });
    if (!["full", "quarterly", "monthly"].includes(planType)) return res.status(400).json({ message: "invalid planType" });
    const quote = await computeCheckoutQuote(req.session.userId!, programId, planType);
    if (!quote) return res.status(404).json({ message: "Program not found" });
    res.json(quote);
  });

  // ---------- STUDENT: initiate checkout ----------
  // Creates the enrollment (if missing) and a payment plan in "pending" status,
  // then returns a PayPal approval URL for either a one-time order or a subscription.
  app.post("/api/payments/checkout", requireAuth, async (req, res) => {
    try {
      const { programId, planType, returnUrl, cancelUrl } = req.body as {
        programId: number; planType: "full" | "quarterly" | "monthly";
        returnUrl?: string; cancelUrl?: string;
      };
      if (!programId || !planType) return res.status(400).json({ message: "programId and planType required" });
      if (!["full", "quarterly", "monthly"].includes(planType)) return res.status(400).json({ message: "invalid planType" });

      const cfg = await getPayPalConfig();
      if (!paypalConfigured(cfg)) return res.status(400).json({ message: "PayPal is not configured. Please contact the administrator." });

      const program = await storage.getProgram(programId);
      if (!program) return res.status(404).json({ message: "Program not found" });

      // Ensure enrollment exists (pending status until first payment succeeds)
      let enrollment = await storage.getEnrollment(req.session.userId!, programId);
      if (!enrollment) enrollment = await storage.createEnrollment(req.session.userId!, programId);

      // Compute quote (applies scholarship + app fee)
      const quote = await computeCheckoutQuote(req.session.userId!, programId, planType);
      if (!quote) return res.status(404).json({ message: "Quote unavailable" });

      // If an active plan exists on this enrollment, return an error (avoid double-charging)
      const existingPlan = await storage.getPaymentPlanByEnrollment(enrollment.id);
      if (existingPlan && (existingPlan.status === "active" || existingPlan.status === "completed")) {
        return res.status(400).json({ message: "This enrollment already has an active payment plan." });
      }

      // Special case: full-ride scholarship covers everything -> no PayPal needed
      if (quote.totalDueCents === 0) {
        const plan = await storage.createPaymentPlan({
          userId: req.session.userId!,
          programId: program.id,
          enrollmentId: enrollment.id,
          planType,
          totalCents: 0,
          paidCents: 0,
          installmentCents: 0,
          totalInstallments: 1,
          paidInstallments: 1,
          status: "completed",
          paypalSubscriptionId: "",
          paypalPlanId: "",
          paypalOrderId: "",
          nextBillingAt: 0,
          failureCount: 0,
        });
        await storage.recordTransaction({
          planId: plan.id,
          userId: req.session.userId!,
          amountCents: 0,
          currency: "USD",
          status: "completed",
          paypalCaptureId: "",
          paypalOrderId: "",
          paypalSubscriptionId: "",
          eventType: "scholarship.full",
          note: `Scholarship applied: ${quote.scholarshipName}`,
        });
        return res.json({ planId: plan.id, approveUrl: "", planType, scholarshipCovered: true });
      }

      // Create a fresh payment plan row (status stays 'pending' until confirmed)
      const plan = await storage.createPaymentPlan({
        userId: req.session.userId!,
        programId: program.id,
        enrollmentId: enrollment.id,
        planType,
        totalCents: quote.totalDueCents,   // includes tuition (post-scholarship) + app fee
        paidCents: 0,
        installmentCents: quote.installmentCents,
        totalInstallments: quote.totalInstallments,
        paidInstallments: 0,
        status: "pending",
        paypalSubscriptionId: "",
        paypalPlanId: "",
        paypalOrderId: "",
        nextBillingAt: 0,
        failureCount: 0,
      });

      const origin = `${req.protocol}://${req.get("host")}`;
      const finalReturn = returnUrl || `${origin}/#/payments/return?planId=${plan.id}`;
      const finalCancel = cancelUrl || `${origin}/#/payments/cancel?planId=${plan.id}`;

      const effectiveAppFeeCents = quote.appFeeWaived ? 0 : quote.appFeeCents;

      if (planType === "full") {
        const feeNote = effectiveAppFeeCents > 0 ? " incl. application fee" : "";
        const scholarNote = quote.hasScholarship ? " (scholarship applied)" : "";
        const order = await createOrder({
          amountCents: quote.firstPaymentCents,
          description: `${program.title} — Paid in full${feeNote}${scholarNote}`,
          returnUrl: finalReturn,
          cancelUrl: finalCancel,
          planId: plan.id,
        });
        await storage.updatePaymentPlan(plan.id, { paypalOrderId: order.id });
        return res.json({ planId: plan.id, approveUrl: order.approveUrl, orderId: order.id, planType });
      } else {
        // Subscription. installment_cents is the discounted-tuition per period.
        // The app fee is included as a one-time setup_fee on the subscription (first billing).
        const paypalPlanId = await ensurePlan(program.id, planType, quote.installmentCents, quote.totalInstallments, program.title);
        const sub = await createSubscription(paypalPlanId, finalReturn, finalCancel, `plan:${plan.id}`, effectiveAppFeeCents);
        await storage.updatePaymentPlan(plan.id, {
          paypalSubscriptionId: sub.id,
          paypalPlanId,
        });
        return res.json({ planId: plan.id, approveUrl: sub.approveUrl, subscriptionId: sub.id, planType });
      }
    } catch (err: any) {
      console.error("checkout error:", err);
      res.status(500).json({ message: err.message ?? "Checkout failed" });
    }
  });

  // ---------- STUDENT: after PayPal redirect back for full-pay orders, capture the payment ----------
  app.post("/api/payments/capture", requireAuth, async (req, res) => {
    try {
      const { planId, orderId } = req.body as { planId: number; orderId?: string };
      const plan = await storage.getPaymentPlan(Number(planId));
      if (!plan) return res.status(404).json({ message: "Plan not found" });
      if (plan.userId !== req.session.userId) return res.status(403).json({ message: "Not your plan" });

      const useOrderId = orderId || plan.paypalOrderId;
      if (!useOrderId) return res.status(400).json({ message: "No order id" });

      const result = await captureOrder(useOrderId);
      const captureStatus = result?.status;

      if (captureStatus === "COMPLETED") {
        const capture = result?.purchase_units?.[0]?.payments?.captures?.[0];
        const amountValue = capture?.amount?.value ?? (plan.totalCents / 100).toFixed(2);
        const amountCents = Math.round(parseFloat(amountValue) * 100);

        await storage.recordTransaction({
          planId: plan.id,
          userId: plan.userId,
          amountCents,
          currency: "USD",
          status: "completed",
          paypalCaptureId: capture?.id ?? "",
          paypalOrderId: useOrderId,
          paypalSubscriptionId: "",
          eventType: "order.captured",
          note: "Full payment captured",
        });
        await storage.updatePaymentPlan(plan.id, {
          status: "completed",
          paidCents: plan.totalCents,
          paidInstallments: plan.totalInstallments,
        });
        return res.json({ ok: true, status: "completed" });
      } else {
        return res.json({ ok: false, status: captureStatus });
      }
    } catch (err: any) {
      console.error("capture error:", err);
      res.status(500).json({ message: err.message ?? "Capture failed" });
    }
  });

  // ---------- STUDENT: confirm subscription after redirect ----------
  app.post("/api/payments/subscription/confirm", requireAuth, async (req, res) => {
    try {
      const { planId, subscriptionId } = req.body as { planId: number; subscriptionId?: string };
      const plan = await storage.getPaymentPlan(Number(planId));
      if (!plan) return res.status(404).json({ message: "Plan not found" });
      if (plan.userId !== req.session.userId) return res.status(403).json({ message: "Not your plan" });
      const useSubId = subscriptionId || plan.paypalSubscriptionId;
      if (!useSubId) return res.status(400).json({ message: "No subscription id" });

      const sub = await getSubscription(useSubId);
      const status = sub?.status; // APPROVAL_PENDING | APPROVED | ACTIVE | SUSPENDED | CANCELLED | EXPIRED
      if (status === "ACTIVE" || status === "APPROVED") {
        await storage.updatePaymentPlan(plan.id, {
          status: "active",
          paypalSubscriptionId: useSubId,
          nextBillingAt: sub?.billing_info?.next_billing_time ? Date.parse(sub.billing_info.next_billing_time) : 0,
        });
        return res.json({ ok: true, status: "active" });
      }
      return res.json({ ok: false, status });
    } catch (err: any) {
      console.error("subscription confirm error:", err);
      res.status(500).json({ message: err.message ?? "Confirm failed" });
    }
  });

  // ---------- STUDENT: cancel subscription ----------
  app.post("/api/payments/subscription/cancel", requireAuth, async (req, res) => {
    try {
      const { planId, reason } = req.body as { planId: number; reason?: string };
      const plan = await storage.getPaymentPlan(Number(planId));
      if (!plan) return res.status(404).json({ message: "Plan not found" });
      if (plan.userId !== req.session.userId && req.session.role !== "admin")
        return res.status(403).json({ message: "Not your plan" });
      if (!plan.paypalSubscriptionId) return res.status(400).json({ message: "No active subscription" });
      await cancelSubscription(plan.paypalSubscriptionId, reason || "User requested cancellation");
      await storage.updatePaymentPlan(plan.id, { status: "canceled" });
      res.json({ ok: true });
    } catch (err: any) {
      console.error("cancel error:", err);
      res.status(500).json({ message: err.message ?? "Cancel failed" });
    }
  });

  // ---------- ADMIN: list all plans + transactions ----------
  app.get("/api/admin/payments/plans", requireAdmin, async (_req, res) => {
    const plans = await storage.listAllPaymentPlans();
    const detailed = await Promise.all(plans.map(async (p) => {
      const user = await storage.getUser(p.userId);
      const program = await storage.getProgram(p.programId);
      return {
        ...p,
        userName: user?.name ?? "Unknown",
        userEmail: user?.email ?? "",
        programTitle: program?.title ?? "Unknown Program",
      };
    }));
    res.json(detailed);
  });

  app.get("/api/admin/payments/transactions", requireAdmin, async (_req, res) => {
    const txs = await storage.listAllTransactions();
    const detailed = await Promise.all(txs.map(async (t) => {
      const user = await storage.getUser(t.userId);
      return { ...t, userName: user?.name ?? "Unknown", userEmail: user?.email ?? "" };
    }));
    res.json(detailed);
  });

  // ---------- ADMIN: manually mark a plan status ----------
  app.post("/api/admin/payments/plan/:id/status", requireAdmin, async (req, res) => {
    const planId = Number(req.params.id);
    const { status } = req.body as { status: string };
    if (!["active", "paused", "completed", "canceled"].includes(status))
      return res.status(400).json({ message: "invalid status" });
    const updated = await storage.updatePaymentPlan(planId, { status });
    res.json(updated);
  });

  // ---------- WEBHOOK: PayPal event handler ----------
  // Route must be registered BEFORE any global JSON body parser strips raw text.
  // The current app uses express.json() so we still get a parsed body.
  app.post("/api/paypal/webhook", async (req, res) => {
    try {
      const event = req.body;
      const eventType: string = event?.event_type ?? "";
      const verified = await verifyWebhookSignature(req.headers as any, event);
      // If a webhook ID isn't configured yet we accept but log; in production configure the webhook.
      if (!verified && (await storage.getSetting("paypal_webhook_id"))) {
        console.warn("Webhook signature verification failed for", eventType);
        return res.status(400).json({ message: "invalid signature" });
      }

      // Route by event type
      if (eventType === "PAYMENT.SALE.COMPLETED" || eventType === "PAYMENT.CAPTURE.COMPLETED") {
        const resource = event.resource ?? {};
        // Subscription-driven sale
        const subId = resource?.billing_agreement_id || resource?.supplementary_data?.related_ids?.subscription_id;
        const amountCents = Math.round(parseFloat(resource?.amount?.total ?? resource?.amount?.value ?? "0") * 100);
        const captureId = resource?.id ?? "";

        if (subId) {
          const plan = await storage.getPaymentPlanBySubscriptionId(subId);
          if (plan) {
            await storage.recordTransaction({
              planId: plan.id,
              userId: plan.userId,
              amountCents,
              currency: "USD",
              status: "completed",
              paypalCaptureId: captureId,
              paypalOrderId: "",
              paypalSubscriptionId: subId,
              eventType,
              note: "Recurring installment payment",
            });
            const newPaidInstallments = plan.paidInstallments + 1;
            const newPaidCents = plan.paidCents + amountCents;
            const nowComplete = newPaidInstallments >= plan.totalInstallments;
            await storage.updatePaymentPlan(plan.id, {
              paidInstallments: newPaidInstallments,
              paidCents: newPaidCents,
              status: nowComplete ? "completed" : "active",
              failureCount: 0,
            });
          }
        }
      } else if (eventType === "PAYMENT.SALE.DENIED" || eventType === "BILLING.SUBSCRIPTION.PAYMENT.FAILED") {
        const resource = event.resource ?? {};
        const subId = resource?.billing_agreement_id || resource?.id;
        if (subId) {
          const plan = await storage.getPaymentPlanBySubscriptionId(subId);
          if (plan) {
            const newFail = plan.failureCount + 1;
            const shouldPause = newFail >= 3; // pause after 3rd failure
            await storage.recordTransaction({
              planId: plan.id,
              userId: plan.userId,
              amountCents: 0,
              currency: "USD",
              status: "failed",
              paypalCaptureId: "",
              paypalOrderId: "",
              paypalSubscriptionId: subId,
              eventType,
              note: `Payment failed (attempt ${newFail})`,
            });
            await storage.updatePaymentPlan(plan.id, {
              failureCount: newFail,
              status: shouldPause ? "paused" : plan.status,
            });
          }
        }
      } else if (eventType === "BILLING.SUBSCRIPTION.CANCELLED" || eventType === "BILLING.SUBSCRIPTION.EXPIRED") {
        const resource = event.resource ?? {};
        const subId = resource?.id;
        if (subId) {
          const plan = await storage.getPaymentPlanBySubscriptionId(subId);
          if (plan) {
            await storage.updatePaymentPlan(plan.id, { status: "canceled" });
            await storage.recordTransaction({
              planId: plan.id, userId: plan.userId, amountCents: 0, currency: "USD",
              status: "failed", paypalCaptureId: "", paypalOrderId: "",
              paypalSubscriptionId: subId, eventType, note: "Subscription ended",
            });
          }
        }
      }
      res.json({ received: true });
    } catch (err: any) {
      console.error("webhook error:", err);
      res.status(500).json({ message: "webhook error" });
    }
  });

  // ============================================================
  // SCHOLARSHIPS (admin manages, student sees on checkout page)
  // ============================================================

  // Student: my scholarships
  app.get("/api/scholarships/me", requireAuth, async (req, res) => {
    const list = await storage.listScholarshipsByUser(req.session.userId!);
    const detailed = await Promise.all(list.map(async (s) => {
      const program = await storage.getProgram(s.programId);
      return { ...s, programTitle: program?.title ?? "" };
    }));
    res.json(detailed);
  });

  // Admin: list all scholarships (with student + program details)
  app.get("/api/admin/scholarships", requireAdmin, async (_req, res) => {
    const list = await storage.listAllScholarships();
    const detailed = await Promise.all(list.map(async (s) => {
      const user = await storage.getUser(s.userId);
      const program = await storage.getProgram(s.programId);
      return {
        ...s,
        userName: user?.name ?? "Unknown",
        userEmail: user?.email ?? "",
        programTitle: program?.title ?? "Unknown",
        programTuition: program?.tuition ?? 0,
      };
    }));
    res.json(detailed);
  });

  // Admin: create a scholarship
  app.post("/api/admin/scholarships", requireAdmin, async (req, res) => {
    const {
      userId, programId, name, discountType, discountValue,
      waiveAppFee, note, active,
    } = req.body as any;

    if (!userId || !programId) return res.status(400).json({ message: "userId and programId required" });
    if (!discountType || !"percent fixed".split(" ").includes(discountType))
      return res.status(400).json({ message: "discountType must be 'percent' or 'fixed'" });
    if (typeof discountValue !== "number" || discountValue < 0)
      return res.status(400).json({ message: "discountValue must be a non-negative number" });
    if (discountType === "percent" && discountValue > 100)
      return res.status(400).json({ message: "percent discount must be 0-100" });

    const user = await storage.getUser(Number(userId));
    if (!user) return res.status(404).json({ message: "Student not found" });
    const program = await storage.getProgram(Number(programId));
    if (!program) return res.status(404).json({ message: "Program not found" });

    // Enforce one active scholarship per (user, program): deactivate any existing active ones
    const existing = await storage.getActiveScholarship(Number(userId), Number(programId));
    if (existing) await storage.updateScholarship(existing.id, { active: 0 });

    const created = await storage.createScholarship({
      userId: Number(userId),
      programId: Number(programId),
      name: String(name ?? ""),
      discountType,
      discountValue: Number(discountValue),
      waiveAppFee: waiveAppFee ? 1 : 0,
      note: String(note ?? ""),
      active: active === false ? 0 : 1,
      createdBy: req.session.userId!,
    });
    res.json(created);
  });

  // Admin: update a scholarship
  app.patch("/api/admin/scholarships/:id", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const {
      name, discountType, discountValue, waiveAppFee, note, active,
    } = req.body as any;
    const patch: any = {};
    if (name !== undefined) patch.name = String(name);
    if (discountType !== undefined) {
      if (!"percent fixed".split(" ").includes(discountType))
        return res.status(400).json({ message: "discountType must be 'percent' or 'fixed'" });
      patch.discountType = discountType;
    }
    if (discountValue !== undefined) patch.discountValue = Number(discountValue);
    if (waiveAppFee !== undefined) patch.waiveAppFee = waiveAppFee ? 1 : 0;
    if (note !== undefined) patch.note = String(note);
    if (active !== undefined) patch.active = active ? 1 : 0;
    const updated = await storage.updateScholarship(id, patch);
    res.json(updated);
  });

  // Admin: delete a scholarship
  app.delete("/api/admin/scholarships/:id", requireAdmin, async (req, res) => {
    await storage.deleteScholarship(Number(req.params.id));
    res.json({ ok: true });
  });

  // Admin: preview quote for a specific user/program/plan (test how a scholarship applies)
  app.get("/api/admin/scholarships/preview", requireAdmin, async (req, res) => {
    const userId = Number(req.query.userId);
    const programId = Number(req.query.programId);
    const planType = String(req.query.planType || "full");
    if (!userId || !programId) return res.status(400).json({ message: "userId and programId required" });
    const quote = await computeCheckoutQuote(userId, programId, planType);
    res.json(quote);
  });
}
