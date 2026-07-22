import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { SiteLayout } from "@/components/SiteLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

// PayPal redirects here after approval:
//   Orders: ?planId=X&token=ORDERID&PayerID=...
//   Subscriptions: ?planId=X&subscription_id=SUB&ba_token=...
export default function PaymentReturn() {
  const [state, setState] = useState<"processing" | "success" | "error">("processing");
  const [msg, setMsg] = useState("Finalizing your payment...");
  const [, navigate] = useLocation();

  useEffect(() => {
    // hash already stripped by wouter's hash location — parse from window.location.hash directly
    const hash = window.location.hash;
    const qIdx = hash.indexOf("?");
    const params = new URLSearchParams(qIdx >= 0 ? hash.slice(qIdx + 1) : "");
    const planId = Number(params.get("planId"));
    const token = params.get("token"); // order id for orders
    const subId = params.get("subscription_id");

    if (!planId) { setState("error"); setMsg("Missing plan reference in return URL."); return; }

    (async () => {
      try {
        if (subId) {
          const res = await apiRequest("POST", "/api/payments/subscription/confirm", { planId, subscriptionId: subId });
          const data = await res.json();
          if (data.ok) { setState("success"); setMsg("Your subscription is active. Welcome!"); }
          else { setState("error"); setMsg(`Subscription status: ${data.status ?? "unknown"}`); }
        } else if (token) {
          const res = await apiRequest("POST", "/api/payments/capture", { planId, orderId: token });
          const data = await res.json();
          if (data.ok) { setState("success"); setMsg("Payment received — enrollment activated."); }
          else { setState("error"); setMsg(`Payment status: ${data.status ?? "unknown"}`); }
        } else {
          setState("error"); setMsg("No PayPal reference received. Please try again.");
        }
      } catch (err: any) {
        setState("error"); setMsg(err.message ?? "Something went wrong finalizing your payment.");
      }
    })();
  }, []);

  return (
    <SiteLayout>
      <div className="mx-auto max-w-md px-4 py-24">
        <Card className="p-8 text-center">
          {state === "processing" && (<>
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 font-serif text-2xl text-foreground">Processing</p>
            <p className="mt-2 text-sm text-muted-foreground">{msg}</p>
          </>)}
          {state === "success" && (<>
            <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" />
            <p className="mt-4 font-serif text-2xl text-foreground">Payment successful</p>
            <p className="mt-2 text-sm text-muted-foreground">{msg}</p>
            <div className="mt-6 flex flex-col gap-2">
              <Button onClick={() => navigate("/dashboard")}>Go to Dashboard</Button>
              <Link href="/billing"><a className="text-sm text-primary underline">View billing</a></Link>
            </div>
          </>)}
          {state === "error" && (<>
            <XCircle className="mx-auto h-14 w-14 text-destructive" />
            <p className="mt-4 font-serif text-2xl text-foreground">Payment issue</p>
            <p className="mt-2 text-sm text-muted-foreground">{msg}</p>
            <div className="mt-6 flex flex-col gap-2">
              <Button variant="outline" onClick={() => navigate("/programs")}>Back to Programs</Button>
              <Link href="/billing"><a className="text-sm text-primary underline">View billing</a></Link>
            </div>
          </>)}
        </Card>
      </div>
    </SiteLayout>
  );
}
