import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/AdminLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CheckCircle2, XCircle, ExternalLink, Copy } from "lucide-react";

type Config = { clientId: string; mode: string; webhookId: string; hasSecret: boolean };

export default function AdminPayPal() {
  const { toast } = useToast();
  const { data: cfg } = useQuery<Config>({ queryKey: ["/api/admin/paypal/config"] });
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [mode, setMode] = useState<"sandbox" | "live">("sandbox");
  const [webhookId, setWebhookId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (cfg) {
      setClientId(cfg.clientId ?? "");
      setMode((cfg.mode as any) || "sandbox");
      setWebhookId(cfg.webhookId ?? "");
    }
  }, [cfg]);

  const save = async () => {
    setSaving(true);
    try {
      await apiRequest("POST", "/api/admin/paypal/config", { clientId, clientSecret, mode, webhookId });
      toast({ title: "Saved", description: "PayPal configuration updated." });
      setClientSecret("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/paypal/config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/paypal/status"] });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const webhookUrl = `${window.location.origin}/api/paypal/webhook`;
  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast({ title: "Copied", description: "Webhook URL copied to clipboard." });
  };

  const configured = cfg?.clientId && cfg?.hasSecret;

  return (
    <AdminLayout>
      <h1 className="font-serif text-3xl text-primary">PayPal Setup</h1>
      <p className="mt-1 text-muted-foreground">Configure PayPal REST API credentials to accept tuition payments.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center gap-2">
            {configured ? (
              <><CheckCircle2 className="h-5 w-5 text-emerald-600" /><span className="font-medium text-emerald-700">PayPal is configured ({cfg?.mode} mode)</span></>
            ) : (
              <><XCircle className="h-5 w-5 text-red-600" /><span className="font-medium text-red-700">PayPal is not configured yet</span></>
            )}
          </div>

          <div className="mt-6 space-y-4">
            <div>
              <Label htmlFor="mode">Environment</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as any)}>
                <SelectTrigger data-testid="select-mode"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">Sandbox (for testing)</SelectItem>
                  <SelectItem value="live">Live (real payments)</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">Start with Sandbox until you're ready to accept real tuition payments.</p>
            </div>
            <div>
              <Label htmlFor="clientId">Client ID</Label>
              <Input id="clientId" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="A1234...ABC" data-testid="input-client-id" />
            </div>
            <div>
              <Label htmlFor="clientSecret">Client Secret {cfg?.hasSecret && <span className="text-xs text-muted-foreground">(leave blank to keep current)</span>}</Label>
              <Input id="clientSecret" type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} placeholder={cfg?.hasSecret ? "•••••••••••••••••" : "EL...secret"} data-testid="input-client-secret" />
            </div>
            <div>
              <Label htmlFor="webhookId">Webhook ID <span className="text-xs text-muted-foreground">(optional, but recommended)</span></Label>
              <Input id="webhookId" value={webhookId} onChange={(e) => setWebhookId(e.target.value)} placeholder="8PT...HK" data-testid="input-webhook-id" />
              <p className="mt-1 text-xs text-muted-foreground">Enables signature verification for incoming webhook events.</p>
            </div>
          </div>
          <Button className="mt-6" onClick={save} disabled={saving} data-testid="button-save-paypal">
            {saving ? "Saving..." : "Save Configuration"}
          </Button>
        </Card>

        <Card className="p-6">
          <h2 className="font-serif text-lg text-foreground">Setup Guide</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-4 text-sm text-muted-foreground">
            <li>
              Go to <a className="text-primary underline" href="https://developer.paypal.com/dashboard/applications/sandbox" target="_blank" rel="noreferrer">
                PayPal Developer Dashboard <ExternalLink className="inline h-3 w-3" />
              </a>
            </li>
            <li>Create a REST App (or use existing).</li>
            <li>Copy the <strong>Client ID</strong> and <strong>Secret</strong>, paste into fields at left.</li>
            <li>Save. Test a checkout in Sandbox mode.</li>
            <li>Under "Sandbox Webhooks", add a webhook pointing to the URL below and subscribe to <em>Payment sale completed</em>, <em>Payment sale denied</em>, and all <em>Billing subscription</em> events.</li>
            <li>Copy the <strong>Webhook ID</strong> back into the field above.</li>
          </ol>
          <div className="mt-4 rounded-md bg-muted/40 p-3">
            <p className="text-xs font-medium text-muted-foreground">Webhook URL</p>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 truncate text-xs text-foreground" data-testid="text-webhook-url">{webhookUrl}</code>
              <Button size="icon" variant="ghost" onClick={copyWebhook} data-testid="button-copy-webhook"><Copy className="h-4 w-4" /></Button>
            </div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">When you go live, switch to Live mode and paste your live credentials + live webhook ID.</p>
        </Card>
      </div>
    </AdminLayout>
  );
}
