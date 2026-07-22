import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/AdminLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Search, DollarSign, Users, TrendingUp } from "lucide-react";

type Plan = {
  id: number; userId: number; programId: number; planType: string;
  totalCents: number; paidCents: number; paidInstallments: number; totalInstallments: number;
  status: string; failureCount: number; userName: string; userEmail: string; programTitle: string;
  paypalSubscriptionId: string; createdAt: number;
};
type Tx = {
  id: number; planId: number; userId: number; amountCents: number; status: string;
  eventType: string; note: string; createdAt: number; userName: string; userEmail: string;
};

function money(cents: number) { return `$${(cents / 100).toFixed(2)}`; }

export default function AdminPayments() {
  const { toast } = useToast();
  const [tab, setTab] = useState<"plans" | "transactions">("plans");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: plans, isLoading: plansLoading } = useQuery<Plan[]>({ queryKey: ["/api/admin/payments/plans"] });
  const { data: txs, isLoading: txLoading } = useQuery<Tx[]>({ queryKey: ["/api/admin/payments/transactions"] });

  const filteredPlans = (plans ?? []).filter((p) => {
    const matchQ = !q || `${p.userName} ${p.userEmail} ${p.programTitle}`.toLowerCase().includes(q.toLowerCase());
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    return matchQ && matchStatus;
  });
  const filteredTxs = (txs ?? []).filter((t) => !q || `${t.userName} ${t.userEmail} ${t.note} ${t.eventType}`.toLowerCase().includes(q.toLowerCase()));

  // Metrics
  const totalRevenue = (txs ?? []).filter((t) => t.status === "completed").reduce((a, t) => a + t.amountCents, 0);
  const activePlans = (plans ?? []).filter((p) => p.status === "active" || p.status === "completed").length;
  const pausedPlans = (plans ?? []).filter((p) => p.status === "paused").length;

  const updateStatus = async (planId: number, status: string) => {
    try {
      await apiRequest("POST", `/api/admin/payments/plan/${planId}/status`, { status });
      toast({ title: "Updated", description: `Plan marked as ${status}.` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payments/plans"] });
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    }
  };

  return (
    <AdminLayout>
      <h1 className="font-serif text-3xl text-primary">Payments</h1>
      <p className="mt-1 text-muted-foreground">Track tuition payments, subscriptions, and manage student payment status.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <DollarSign className="mb-2 h-6 w-6 text-emerald-600" />
          <p className="font-serif text-3xl text-foreground">{money(totalRevenue)}</p>
          <p className="text-sm text-muted-foreground">Total collected</p>
        </Card>
        <Card className="p-5">
          <TrendingUp className="mb-2 h-6 w-6 text-primary" />
          <p className="font-serif text-3xl text-foreground">{activePlans}</p>
          <p className="text-sm text-muted-foreground">Active / completed plans</p>
        </Card>
        <Card className="p-5">
          <Users className="mb-2 h-6 w-6 text-red-600" />
          <p className="font-serif text-3xl text-foreground">{pausedPlans}</p>
          <p className="text-sm text-muted-foreground">Paused (payment issues)</p>
        </Card>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-2 border-b border-border">
        <button
          onClick={() => setTab("plans")}
          className={`px-4 py-2 text-sm font-medium ${tab === "plans" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
          data-testid="tab-plans"
        >Payment Plans</button>
        <button
          onClick={() => setTab("transactions")}
          className={`px-4 py-2 text-sm font-medium ${tab === "transactions" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
          data-testid="tab-transactions"
        >Transactions</button>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <div className="relative min-w-64 flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by student, email, or program..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" data-testid="input-search" />
        </div>
        {tab === "plans" && (
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40" data-testid="select-status-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="canceled">Canceled</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {tab === "plans" ? (
        plansLoading ? <Skeleton className="mt-4 h-40 w-full" /> : (
          <Card className="mt-4 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left">
                  <tr>
                    <th className="p-3">Student</th>
                    <th className="p-3">Program</th>
                    <th className="p-3">Plan</th>
                    <th className="p-3">Paid / Total</th>
                    <th className="p-3">Progress</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredPlans.length === 0 && (
                    <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No payment plans match your filter.</td></tr>
                  )}
                  {filteredPlans.map((p) => (
                    <tr key={p.id} data-testid={`row-plan-${p.id}`}>
                      <td className="p-3">
                        <div className="font-medium text-foreground">{p.userName}</div>
                        <div className="text-xs text-muted-foreground">{p.userEmail}</div>
                      </td>
                      <td className="p-3 text-foreground">{p.programTitle}</td>
                      <td className="p-3 capitalize text-foreground">{p.planType}</td>
                      <td className="p-3 text-foreground">{money(p.paidCents)} / {money(p.totalCents)}</td>
                      <td className="p-3 text-foreground">{p.paidInstallments} / {p.totalInstallments}</td>
                      <td className="p-3">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          p.status === "active" || p.status === "completed" ? "bg-emerald-100 text-emerald-800" :
                          p.status === "paused" ? "bg-red-100 text-red-800" :
                          p.status === "canceled" ? "bg-slate-100 text-slate-700" :
                          "bg-amber-100 text-amber-800"
                        }`}>{p.status}</span>
                        {p.failureCount > 0 && <span className="ml-2 text-xs text-red-600">{p.failureCount} fail</span>}
                      </td>
                      <td className="p-3">
                        <Select value={p.status} onValueChange={(v) => updateStatus(p.id, v)}>
                          <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Set Active</SelectItem>
                            <SelectItem value="paused">Pause</SelectItem>
                            <SelectItem value="completed">Mark Paid</SelectItem>
                            <SelectItem value="canceled">Cancel</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      ) : (
        txLoading ? <Skeleton className="mt-4 h-40 w-full" /> : (
          <Card className="mt-4 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Student</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredTxs.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No transactions yet.</td></tr>}
                  {filteredTxs.map((t) => (
                    <tr key={t.id} data-testid={`row-tx-${t.id}`}>
                      <td className="p-3 text-muted-foreground">{new Date(t.createdAt * 1000).toLocaleString()}</td>
                      <td className="p-3">
                        <div className="font-medium text-foreground">{t.userName}</div>
                        <div className="text-xs text-muted-foreground">{t.userEmail}</div>
                      </td>
                      <td className="p-3 text-foreground">{t.eventType}</td>
                      <td className={`p-3 font-medium ${t.status === "completed" ? "text-foreground" : "text-muted-foreground"}`}>{money(t.amountCents)}</td>
                      <td className="p-3">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${t.status === "completed" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">{t.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      )}
    </AdminLayout>
  );
}
