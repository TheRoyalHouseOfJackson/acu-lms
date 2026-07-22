import { useEffect, useState } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { SiteLayout } from "@/components/SiteLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ProgramDetail as PD } from "@/lib/types";
import { CreditCard, CalendarClock, Wallet, ShieldCheck, Check, AlertCircle, Award } from "lucide-react";

type PlanType = "full" | "quarterly" | "monthly";

interface Quote {
  tuitionCents: number;
  appFeeCents: number;
  discountCents: number;
  discountedTuitionCents: number;
  appFeeWaived: boolean;
  totalDueCents: number;
  installmentCents: number;
  totalInstallments: number;
  firstPaymentCents: number;
  hasScholarship: boolean;
  scholarshipName: string;
}

function fmtCents(c: number) { return `$${(c / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

export default function Checkout() {
  const [, params] = useRoute("/checkout/:slug");
  const slug = params?.slug;
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [planType, setPlanType] = useState<PlanType>("full");
  const [processing, setProcessing] = useState(false);

  const { data: program, isLoading } = useQuery<PD>({
    queryKey: ["/api/programs", slug],
    enabled: !!slug,
  });

  const { data: ppStatus } = useQuery<{ configured: boolean; mode: string; clientId: string }>({
    queryKey: ["/api/paypal/status"],
  });

  // Fetch quotes for all three plan types so users can see breakdowns before selecting
  const { data: quoteFull } = useQuery<Quote>({
    queryKey: ["/api/payments/quote", program?.id, "full"],
    queryFn: async () => (await apiRequest("GET", `/api/payments/quote?programId=${program!.id}&planType=full`)).json(),
    enabled: !!program && !!user,
  });
  const { data: quoteQuarterly } = useQuery<Quote>({
    queryKey: ["/api/payments/quote", program?.id, "quarterly"],
    queryFn: async () => (await apiRequest("GET", `/api/payments/quote?programId=${program!.id}&planType=quarterly`)).json(),
    enabled: !!program && !!user,
  });
  const { data: quoteMonthly } = useQuery<Quote>({
    queryKey: ["/api/payments/quote", program?.id, "monthly"],
    queryFn: async () => (await apiRequest("GET", `/api/payments/quote?programId=${program!.id}&planType=monthly`)).json(),
    enabled: !!program && !!user,
  });

  const currentQuote =
    planType === "full" ? quoteFull :
    planType === "quarterly" ? quoteQuarterly :
    quoteMonthly;

  useEffect(() => {
    if (!user) { navigate("/login"); }
  }, [user, navigate]);

  if (isLoading || !program) {
    return <SiteLayout><div className="mx-auto max-w-3xl px-4 py-16"><Skeleton className="h-64 w-full" /></div></SiteLayout>;
  }

  const startCheckout = async () => {
    setProcessing(true);
    try {
      const res = await apiRequest("POST", "/api/payments/checkout", { programId: program.id, planType });
      const data = await res.json();
      if (data.scholarshipCovered) {
        toast({ title: "Enrollment complete", description: "Your scholarship covers the full amount. You're enrolled." });
        setTimeout(() => navigate(`/programs/${program.slug}`), 1200);
        return;
      }
      if (data.approveUrl) {
        window.location.href = data.approveUrl;
      } else {
        toast({ title: "Checkout error", description: "No approval URL returned by PayPal.", variant: "destructive" });
        setProcessing(false);
      }
    } catch (err: any) {
      toast({ title: "Checkout failed", description: err.message ?? "Please try again.", variant: "destructive" });
      setProcessing(false);
    }
  };

  const paypalUnavailable = !ppStatus?.configured && !(currentQuote && currentQuote.totalDueCents === 0);

  const plans: Array<{ type: PlanType; label: string; icon: any; sub: string; quote: Quote | undefined }> = [
    { type: "full", label: "Pay in Full", icon: Wallet, sub: "One-time payment · Save on installment fees", quote: quoteFull },
    { type: "quarterly", label: "Quarterly Plan", icon: CalendarClock, sub: "4 payments · Every 3 months", quote: quoteQuarterly },
    { type: "monthly", label: "Monthly Plan", icon: CreditCard, sub: "12 payments · Every month", quote: quoteMonthly },
  ];

  return (
    <SiteLayout>
      <section className="border-b border-border bg-gradient-to-br from-primary to-[hsl(347_40%_24%)] py-10">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <Link href={`/programs/${program.slug}`}><a className="text-sm text-background/70 hover:text-accent">← Back to Program</a></Link>
          <h1 className="mt-3 font-serif text-4xl text-background">Enroll in {program.title}</h1>
          <p className="mt-2 text-background/80">Choose a payment plan that works for you.</p>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        {paypalUnavailable && (
          <Card className="mb-6 border-amber-500/40 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-700" />
              <div>
                <p className="font-medium text-amber-900">Payment processing not yet configured</p>
                <p className="mt-1 text-sm text-amber-800">
                  The administrator hasn't finished setting up the payment processor yet. Please check back soon or contact the university office.
                </p>
              </div>
            </div>
          </Card>
        )}

        {currentQuote?.hasScholarship && (
          <Card className="mb-6 border-primary/30 bg-primary/5 p-4" data-testid="banner-scholarship">
            <div className="flex items-start gap-3">
              <Award className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
              <div>
                <p className="font-medium text-foreground">
                  Scholarship applied{currentQuote.scholarshipName ? `: ${currentQuote.scholarshipName}` : ""}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Tuition discount of {fmtCents(currentQuote.discountCents)}{currentQuote.appFeeWaived ? " · Application fee waived" : ""}.
                </p>
              </div>
            </div>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((p) => {
            const Icon = p.icon;
            const selected = planType === p.type;
            const q = p.quote;
            const amountLabel = q
              ? p.type === "full"
                ? fmtCents(q.discountedTuitionCents)
                : `${fmtCents(q.installmentCents)} × ${q.totalInstallments}`
              : "—";
            const totalLabel = q ? fmtCents(q.totalDueCents) : "—";
            return (
              <button
                key={p.type}
                type="button"
                onClick={() => setPlanType(p.type)}
                data-testid={`plan-${p.type}`}
                className={`relative rounded-lg border-2 p-5 text-left transition ${
                  selected ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"
                }`}
              >
                {selected && (
                  <span className="absolute -right-2 -top-2 rounded-full bg-primary p-1 text-primary-foreground">
                    <Check className="h-4 w-4" />
                  </span>
                )}
                <Icon className={`h-6 w-6 ${selected ? "text-primary" : "text-muted-foreground"}`} />
                <p className="mt-3 font-serif text-lg text-foreground">{p.label}</p>
                <p className="text-xs text-muted-foreground">{p.sub}</p>
                <p className="mt-4 font-semibold text-foreground">{amountLabel}</p>
                <p className="text-xs text-muted-foreground">Total: {totalLabel}</p>
              </button>
            );
          })}
        </div>

        <Card className="mt-6 p-6">
          <div className="mb-4 border-b border-border pb-4">
            <p className="text-sm text-muted-foreground">Cost breakdown</p>
            <div className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-foreground">Tuition</span>
                <span className="tabular-nums text-foreground" data-testid="text-tuition">{currentQuote ? fmtCents(currentQuote.tuitionCents) : "—"}</span>
              </div>
              {currentQuote && currentQuote.discountCents > 0 && (
                <div className="flex justify-between text-primary">
                  <span>Scholarship discount</span>
                  <span className="tabular-nums" data-testid="text-discount">− {fmtCents(currentQuote.discountCents)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-foreground">Application fee</span>
                <span className="tabular-nums text-foreground" data-testid="text-appfee">
                  {currentQuote ? (currentQuote.appFeeWaived ? <span className="text-primary">Waived</span> : fmtCents(currentQuote.appFeeCents)) : "—"}
                </span>
              </div>
              <div className="flex justify-between border-t border-border pt-2 font-semibold">
                <span className="text-foreground">Total to pay</span>
                <span className="tabular-nums text-foreground" data-testid="text-total">{currentQuote ? fmtCents(currentQuote.totalDueCents) : "—"}</span>
              </div>
            </div>
          </div>

          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-sm text-muted-foreground">Selected plan</p>
              <p className="mt-1 font-serif text-xl text-foreground" data-testid="text-selected-plan">
                {planType === "full" ? "Pay in Full" : planType === "quarterly" ? "Quarterly (4 payments)" : "Monthly (12 payments)"}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {planType === "full"
                  ? "One payment covers everything."
                  : "First payment includes the application fee; remaining installments are tuition only."}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Due today</p>
              <p className="font-serif text-3xl text-primary" data-testid="text-due-today">
                {currentQuote ? fmtCents(currentQuote.firstPaymentCents) : "—"}
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col-reverse items-center justify-between gap-3 border-t border-border pt-6 sm:flex-row">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4" /> Secure checkout via PayPal · Debit, credit, or PayPal balance
            </div>
            <Button
              size="lg"
              disabled={processing || paypalUnavailable || !currentQuote}
              onClick={startCheckout}
              data-testid="button-checkout"
              className="w-full sm:w-auto"
            >
              {processing
                ? "Processing..."
                : currentQuote && currentQuote.totalDueCents === 0
                  ? "Complete enrollment"
                  : "Continue to PayPal"}
            </Button>
          </div>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          By continuing you agree to the tuition payment schedule above. Missed payments will auto-retry up to 3 times over 7 days; after that access is temporarily paused until payment is resolved.
        </p>
      </div>
    </SiteLayout>
  );
}
