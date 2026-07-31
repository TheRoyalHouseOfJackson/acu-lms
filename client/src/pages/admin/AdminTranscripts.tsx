import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/AdminLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { FileText, Download, Check, X, Clock, RefreshCw } from "lucide-react";

type TranscriptRequestAdminRow = {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  requestedAt: number;
  status: "pending" | "issued" | "denied";
  purpose: string | null;
  deliveryEmail: string | null;
  publicId: string | null;
  issuedAt: number | null;
  issuedBy: number | null;
  note: string | null;
};

function statusBadge(status: TranscriptRequestAdminRow["status"]) {
  if (status === "issued") return <Badge className="bg-primary/15 text-primary hover:bg-primary/20">Issued</Badge>;
  if (status === "denied") return <Badge variant="destructive">Denied</Badge>;
  return <Badge variant="outline">Pending</Badge>;
}

export default function AdminTranscripts() {
  const { toast } = useToast();
  const { data: rows, isLoading } = useQuery<TranscriptRequestAdminRow[]>({
    queryKey: ["/api/admin/transcripts"],
  });

  const [denyOpen, setDenyOpen] = useState<TranscriptRequestAdminRow | null>(null);
  const [denyNote, setDenyNote] = useState("");

  const generateMutation = useMutation({
    mutationFn: async (row: TranscriptRequestAdminRow) => {
      const res = await apiRequest("POST", "/api/admin/transcripts/generate", { userId: row.userId, requestId: row.id });
      return res.json();
    },
    onSuccess: (data: { publicId: string }) => {
      toast({ title: "Transcript issued", description: "The PDF is ready to download." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/transcripts"] });
      window.open(`/api/admin/transcripts/${data.publicId}/pdf`, "_blank");
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Please try again.";
      toast({ title: "Generation failed", description: msg, variant: "destructive" });
    },
  });

  const denyMutation = useMutation({
    mutationFn: async ({ id, note }: { id: number; note: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/transcripts/${id}`, { status: "denied", note });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Request denied" });
      setDenyOpen(null);
      setDenyNote("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/transcripts"] });
    },
    onError: () => toast({ title: "Update failed", variant: "destructive" }),
  });

  const pendingCount = rows?.filter((r) => r.status === "pending").length ?? 0;

  return (
    <AdminLayout>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-primary">Transcript Requests</h1>
          <p className="mt-1 text-muted-foreground">
            {rows?.length ?? 0} total request{(rows?.length ?? 0) !== 1 ? "s" : ""}
            {pendingCount > 0 && <> · <span className="font-medium text-foreground">{pendingCount} pending</span></>}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/transcripts"] })}
          data-testid="button-refresh-transcripts"
        >
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      <div className="mt-6 space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)
        ) : (rows?.length ?? 0) === 0 ? (
          <Card className="p-10 text-center text-muted-foreground">
            <FileText className="mx-auto mb-2 h-8 w-8" />
            No transcript requests yet. Requests submitted by students will appear here.
          </Card>
        ) : (
          rows!.map((r) => (
            <Card key={r.id} className="p-5" data-testid={`admin-transcript-row-${r.id}`}>
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">{r.userName}</p>
                    {statusBadge(r.status)}
                    {r.status === "pending" && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        Requested {new Date(r.requestedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{r.userEmail}</p>
                  {r.purpose && <p className="mt-2 text-sm"><span className="font-medium">Purpose:</span> {r.purpose}</p>}
                  {r.deliveryEmail && r.deliveryEmail !== r.userEmail && (
                    <p className="mt-1 text-xs text-muted-foreground">Deliver to: {r.deliveryEmail}</p>
                  )}
                  {r.issuedAt && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Issued {new Date(r.issuedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                    </p>
                  )}
                  {r.note && <p className="mt-2 text-xs italic text-muted-foreground">Registrar note: {r.note}</p>}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {r.status === "pending" && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => generateMutation.mutate(r)}
                        disabled={generateMutation.isPending}
                        data-testid={`button-issue-${r.id}`}
                      >
                        <Check className="mr-2 h-4 w-4" />
                        {generateMutation.isPending ? "Generating…" : "Issue Transcript"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDenyOpen(r)}
                        data-testid={`button-deny-${r.id}`}
                      >
                        <X className="mr-2 h-4 w-4" /> Deny
                      </Button>
                    </>
                  )}
                  {r.status === "issued" && r.publicId && (
                    <>
                      <a href={`/api/admin/transcripts/${r.publicId}/pdf`} target="_blank" rel="noreferrer">
                        <Button size="sm" variant="outline" data-testid={`button-view-transcript-${r.id}`}>
                          <Download className="mr-2 h-4 w-4" /> View PDF
                        </Button>
                      </a>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => generateMutation.mutate(r)}
                        disabled={generateMutation.isPending}
                        data-testid={`button-regenerate-${r.id}`}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" /> Regenerate
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <Dialog open={!!denyOpen} onOpenChange={(open) => { if (!open) { setDenyOpen(null); setDenyNote(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deny Transcript Request</DialogTitle>
            <DialogDescription>
              {denyOpen && <>Denying request from <span className="font-medium">{denyOpen.userName}</span>. Add a note (visible to the student).</>}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="deny-note">Reason (shown to student)</Label>
            <Textarea
              id="deny-note"
              value={denyNote}
              onChange={(e) => setDenyNote(e.target.value)}
              placeholder="e.g., Outstanding balance on account. Please contact the registrar."
              data-testid="input-deny-note"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDenyOpen(null); setDenyNote(""); }}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => denyOpen && denyMutation.mutate({ id: denyOpen.id, note: denyNote })}
              disabled={denyMutation.isPending}
              data-testid="button-confirm-deny"
            >
              {denyMutation.isPending ? "Saving…" : "Deny Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
