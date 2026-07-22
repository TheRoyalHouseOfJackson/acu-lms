/**
 * PayPal REST API integration.
 * Supports sandbox and live modes. Credentials are read from the settings table
 * (admin configures via UI) so no code changes are needed to go live.
 */
import { storage } from "./storage";

const SANDBOX_BASE = "https://api-m.sandbox.paypal.com";
const LIVE_BASE = "https://api-m.paypal.com";

export interface PayPalConfig {
  clientId: string;
  clientSecret: string;
  mode: "sandbox" | "live";
  webhookId: string;
}

export async function getPayPalConfig(): Promise<PayPalConfig> {
  const [clientId, clientSecret, mode, webhookId] = await Promise.all([
    storage.getSetting("paypal_client_id"),
    storage.getSetting("paypal_client_secret"),
    storage.getSetting("paypal_mode"),
    storage.getSetting("paypal_webhook_id"),
  ]);
  return {
    clientId,
    clientSecret,
    mode: (mode === "live" ? "live" : "sandbox"),
    webhookId,
  };
}

export function paypalBaseUrl(mode: "sandbox" | "live"): string {
  return mode === "live" ? LIVE_BASE : SANDBOX_BASE;
}

export function paypalConfigured(cfg: PayPalConfig): boolean {
  return Boolean(cfg.clientId && cfg.clientSecret);
}

// -- token caching in memory (per config) --
let cachedToken: { token: string; expiresAt: number; mode: string; clientId: string } | null = null;

export async function getAccessToken(cfg?: PayPalConfig): Promise<string> {
  const c = cfg ?? (await getPayPalConfig());
  if (!paypalConfigured(c)) throw new Error("PayPal is not configured");
  if (cachedToken && cachedToken.mode === c.mode && cachedToken.clientId === c.clientId && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.token;
  }
  const basic = Buffer.from(`${c.clientId}:${c.clientSecret}`).toString("base64");
  const res = await fetch(`${paypalBaseUrl(c.mode)}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`PayPal auth failed: ${res.status} ${t}`);
  }
  const j: any = await res.json();
  cachedToken = {
    token: j.access_token,
    expiresAt: Date.now() + (j.expires_in - 60) * 1000,
    mode: c.mode,
    clientId: c.clientId,
  };
  return j.access_token;
}

// ---- ORDERS (one-time full payment) ----
export interface CreateOrderInput {
  amountCents: number;
  description: string;
  returnUrl: string;
  cancelUrl: string;
  brandName?: string;
  planId: number;
}

export async function createOrder(input: CreateOrderInput): Promise<{ id: string; approveUrl: string }> {
  const cfg = await getPayPalConfig();
  const token = await getAccessToken(cfg);
  const body = {
    intent: "CAPTURE",
    purchase_units: [{
      reference_id: `plan-${input.planId}`,
      description: input.description,
      amount: {
        currency_code: "USD",
        value: (input.amountCents / 100).toFixed(2),
      },
    }],
    application_context: {
      brand_name: input.brandName ?? "Ambassadors Christian University",
      landing_page: "BILLING",
      user_action: "PAY_NOW",
      return_url: input.returnUrl,
      cancel_url: input.cancelUrl,
    },
  };
  const res = await fetch(`${paypalBaseUrl(cfg.mode)}/v2/checkout/orders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PayPal createOrder failed: ${res.status} ${await res.text()}`);
  const j: any = await res.json();
  const approve = (j.links || []).find((l: any) => l.rel === "approve");
  return { id: j.id, approveUrl: approve?.href ?? "" };
}

export async function captureOrder(orderId: string): Promise<any> {
  const cfg = await getPayPalConfig();
  const token = await getAccessToken(cfg);
  const res = await fetch(`${paypalBaseUrl(cfg.mode)}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`PayPal captureOrder failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// ---- PRODUCTS AND PLANS (for subscriptions) ----
// We keep one product per PayPal account, and one PayPal Plan per (programId, planType) combination.
// Plan IDs are cached in the settings table so we don't re-create them.

export async function ensureProduct(): Promise<string> {
  const existing = await storage.getSetting("paypal_product_id");
  if (existing) return existing;
  const cfg = await getPayPalConfig();
  const token = await getAccessToken(cfg);
  const res = await fetch(`${paypalBaseUrl(cfg.mode)}/v1/catalogs/products`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": `acu-product-${Date.now()}`,
    },
    body: JSON.stringify({
      name: "ACU Tuition",
      description: "Ambassadors Christian University tuition",
      type: "SERVICE",
      category: "EDUCATIONAL_AND_TEXTBOOKS",
    }),
  });
  if (!res.ok) throw new Error(`PayPal ensureProduct failed: ${res.status} ${await res.text()}`);
  const j: any = await res.json();
  await storage.setSetting("paypal_product_id", j.id);
  return j.id;
}

export async function ensurePlan(programId: number, planType: "monthly" | "quarterly", installmentCents: number, totalInstallments: number, programTitle: string): Promise<string> {
  const key = `paypal_plan_${programId}_${planType}`;
  const existing = await storage.getSetting(key);
  if (existing) return existing;
  const cfg = await getPayPalConfig();
  const token = await getAccessToken(cfg);
  const productId = await ensureProduct();
  const intervalUnit = planType === "monthly" ? "MONTH" : "MONTH";
  const intervalCount = planType === "monthly" ? 1 : 3;

  const body = {
    product_id: productId,
    name: `ACU — ${programTitle} — ${planType === "monthly" ? "Monthly" : "Quarterly"} Plan`,
    description: `Tuition installment plan for ${programTitle} (${planType}).`,
    status: "ACTIVE",
    billing_cycles: [{
      frequency: { interval_unit: intervalUnit, interval_count: intervalCount },
      tenure_type: "REGULAR",
      sequence: 1,
      total_cycles: totalInstallments,
      pricing_scheme: {
        fixed_price: {
          value: (installmentCents / 100).toFixed(2),
          currency_code: "USD",
        },
      },
    }],
    payment_preferences: {
      auto_bill_outstanding: true,
      setup_fee_failure_action: "CONTINUE",
      payment_failure_threshold: 3,
    },
  };
  const res = await fetch(`${paypalBaseUrl(cfg.mode)}/v1/billing/plans`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": `acu-plan-${programId}-${planType}-${Date.now()}`,
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PayPal ensurePlan failed: ${res.status} ${await res.text()}`);
  const j: any = await res.json();
  await storage.setSetting(key, j.id);
  return j.id;
}

export async function createSubscription(
  planIdPaypal: string,
  returnUrl: string,
  cancelUrl: string,
  custom: string,
  setupFeeCents: number = 0,
): Promise<{ id: string; approveUrl: string }> {
  const cfg = await getPayPalConfig();
  const token = await getAccessToken(cfg);
  const body: any = {
    plan_id: planIdPaypal,
    application_context: {
      brand_name: "Ambassadors Christian University",
      user_action: "SUBSCRIBE_NOW",
      return_url: returnUrl,
      cancel_url: cancelUrl,
    },
    custom_id: custom,
  };
  if (setupFeeCents > 0) {
    body.plan = {
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee: { value: (setupFeeCents / 100).toFixed(2), currency_code: "USD" },
        setup_fee_failure_action: "CONTINUE",
        payment_failure_threshold: 3,
      },
    };
  }
  const res = await fetch(`${paypalBaseUrl(cfg.mode)}/v1/billing/subscriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PayPal createSubscription failed: ${res.status} ${await res.text()}`);
  const j: any = await res.json();
  const approve = (j.links || []).find((l: any) => l.rel === "approve");
  return { id: j.id, approveUrl: approve?.href ?? "" };
}

export async function getSubscription(subId: string): Promise<any> {
  const cfg = await getPayPalConfig();
  const token = await getAccessToken(cfg);
  const res = await fetch(`${paypalBaseUrl(cfg.mode)}/v1/billing/subscriptions/${subId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`PayPal getSubscription failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function cancelSubscription(subId: string, reason: string): Promise<void> {
  const cfg = await getPayPalConfig();
  const token = await getAccessToken(cfg);
  const res = await fetch(`${paypalBaseUrl(cfg.mode)}/v1/billing/subscriptions/${subId}/cancel`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok && res.status !== 204) throw new Error(`PayPal cancelSubscription failed: ${res.status} ${await res.text()}`);
}

// ---- WEBHOOK VERIFICATION ----
export async function verifyWebhookSignature(headers: Record<string, string | string[] | undefined>, body: any): Promise<boolean> {
  const cfg = await getPayPalConfig();
  if (!cfg.webhookId) return false;
  const token = await getAccessToken(cfg);
  const payload = {
    auth_algo: headers["paypal-auth-algo"],
    cert_url: headers["paypal-cert-url"],
    transmission_id: headers["paypal-transmission-id"],
    transmission_sig: headers["paypal-transmission-sig"],
    transmission_time: headers["paypal-transmission-time"],
    webhook_id: cfg.webhookId,
    webhook_event: body,
  };
  const res = await fetch(`${paypalBaseUrl(cfg.mode)}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return false;
  const j: any = await res.json();
  return j.verification_status === "SUCCESS";
}
