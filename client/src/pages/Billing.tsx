import { useQuery } from "@tanstack/react-query";
import { SiteLayout } from "@/components/SiteLayout";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CreditCard, Receipt, Circle, Pause, CheckCircle2, XCircle } from "lucide-react";

type Plan = {
  id: number; programId: number; planType: string; totalCents: number; paidCents: number;
  installmentCents: number; totalInstallments: number; paidInstallments: number;
  status: string; paypalSubscriptionId: string; failureCount: number;
};
type Tx = {
  id: number; planId: number; amountCents: number; currency: string; status: string;
  eventType: string; note: string; createdAt: number;
};
type EnrollmentDetail = { id: number; programId: number; program: { id: number; title: string; slug: string; tuition: number } };

function money(cents: number) { return `$${(cents / 100).toFixed(2)}`; }
function planLabel(t: string) { return t === "full" ? "Paid in Full" : t === "monthly" ? "Monthly" : t === "quarterly" ? "Quarterly" : t; }
function statusBadge(s: string) {
  const map: Record<string, { label: string; class: string; Icon: any }> = {
    active: { label: "Active", class: "bg-emerald-100 text-emerald-800", Icon: CheckCircle2 },
    completed: { label: "Paid Off", class: "bg-emerald-100 text-emerald-800", Icon: CheckCircle2 },
    pending: { label: "Pending", class: "bg-amber-100 text-amber-800", Icon: Circle },
    paused: { label: "Paused", class: "bg-red-100 text-red-800", Icon: Pause },
    canceled: { label: "Canceled", class: "bg-slate-100 text-slate-700", Icon: XCircle },
  };
  const v = map[s] ?? { label: s, class: "bg-slate-100 text-slate-700", Icon: Circle };
  const Icon = v.Icon;
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${v.class}`}><Icon className="h-3 w-3" /> {v.label}</span>;
}

export default function Billing() {
  const { toast } = useToast();
  const { data: enrollments, isLoading: enrLoading } = useQuery<EnrollmentDetail[]>({ queryKey: ["/api/enrollments/me"] });
  const { data: txs, isLoading: txLoading } = useQuery<Tx[]>({ queryKey: ["/api/payments/transactions/me"] });

  // For each enrollment, get plan
  const enrollmentIds = (enrollments ?? []).map((e) => e.programId).join(",");
  const { data: planMap } = useQuery<Record<number, Plan | null>>({
    queryKey: ["/api/payments/plans", enrollmentIds],
    enabled: !!enrollments && enrollments.length > 0,
    queryFn: async () => {
      const out: Record<number, Plan | null> = {};
      await Promise.all((enrollments ?? []).map(async (e) => {
        const res = await apiRequest("GET", `/api/payments/plan/${e.programId}`);
        const j = await res.json();
        out[e.programId] = j.plan ?? null;
      }));
      return out;
    },
  });

  const cancelSub = async (planId: number) => {
    if (!confirm("Cancel this subscription? Your access will remain until the end of the current billing period.")) return;
    try {
      await apiRequest("POST", "/api/payments/subscription/cancel", { planId });
      toast({ title: "Subscription canceled", description: "Your recurring payments have been stopped." });
      queryClient.invalidateQueries({ queryKey: ["/api/payments/plans"] });
    } catch (err: any) {
      toast({ title: "Cancel failed", description: err.message ?? "Please try again.", variant: "destructive" });
    }
  };

  return (
    <SiteLayout>
      <section className="border-b border-border bg-card">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
          <h1 className="font-serif text-4xl text-primary">Billing & Payments</h1>
          <p className="mt-2 text-muted-foreground">Manage your tuition payment plans, view transactions, and update payment methods.</p>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <h2 className="font-serif text-2xl text-foreground">Active Plans</h2>
        {enrLoading ? (
          <Skeleton className="mt-4 h-40 w-full" />
        ) : !enrollments || enrollments.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">You have no active enrollments yet.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {enrollments.map((e) => {
              const plan = planMap?.[e.programId] ?? null;
              return (
                <Card key={e.id} className="p-5" data-testid={`plan-card-${e.programId}`}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-serif text-lg text-foreground">{e.program.title}</p>
                      {plan ? (
                        <>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {planLabel(plan.planType)} · {plan.paidInstallments} of {plan.totalInstallments} payments made
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {money(plan.paidCents)} paid of {money(plan.totalCents)}
                          </p>
                          {plan.failureCount > 0 && plan.status !== "completed" && (
                            <p className="mt-1 text-xs text-red-600">
                              {plan.failureCount} recent payment failure{plan.failureCount !== 1 ? "s" : ""}. Please update your payment method on PayPal.
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="mt-1 text-sm text-muted-foreground">No payment plan on file</p>
                      )}
                    </div>
                    <div className="text-right">
                      {plan ? statusBadge(plan.status) : <span className="text-xs text-muted-foreground">—</span>}
                    </div>
                  </div>
                  {plan && plan.paypalSubscriptionId && (plan.status === "active" || plan.status === "paused") && (
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                      <a
                        href="https://www.paypal.com/myaccount/autopay/"
                        target="_blank"
                        rel="noreferrer"
                        data-testid={`link-update-payment-${plan.id}`}
                      >
                        <Button variant="outline" size="sm"><CreditCard className="mr-2 h-4 w-4" /> Update payment method on PayPal</Button>
                      </a>
                      <Button variant="ghost" size="sm" onClick={() => cancelSub(plan.id)} data-testid={`button-cancel-${plan.id}`}>
                        Cancel subscription
                      </Button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        <h2 className="mt-12 font-serif text-2xl text-foreground">Transaction History</h2>
        {txLoading ? (
          <Skeleton className="mt-4 h-40 w-full" />
        ) : !txs || txs.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No transactions yet.</p>
        ) : (
          <Card className="mt-4 divide-y divide-border">
            {txs.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-4" data-testid={`tx-${t.id}`}>
                <div className="flex items-start gap-3">
                  <Receipt className={`mt-0.5 h-5 w-5 ${t.status === "completed" ? "text-emerald-600" : "text-red-600"}`} />
                  <div>
                    <p className="text-sm font-medium text-foreground">{t.note || t.eventType}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(t.createdAt * 1000).toLocaleString()} · {t.status}
                    </p>
                  </div>
                </div>
                <p className={`font-semibold ${t.status === "completed" ? "text-foreground" : "text-muted-foreground line-through"}`}>
                  {money(t.amountCents)}
                </p>
              </div>
            ))}
          </Card>
        )}
      </div>
    </SiteLayout>
  );
}
