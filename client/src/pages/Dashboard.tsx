import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { SiteLayout } from "@/components/SiteLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { EnrollmentDetail } from "@/lib/types";
import { levelLabel } from "@/lib/types";
import { PlayCircle, Award, BookOpen, GraduationCap, FileText, Download, Clock, CheckCircle2 } from "lucide-react";

type TranscriptRequestRow = {
  id: number;
  requestedAt: number;
  status: "pending" | "issued" | "denied";
  purpose: string | null;
  deliveryEmail: string | null;
  publicId: string | null;
  issuedAt: number | null;
  note: string | null;
};

export default function Dashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [authLoading, user, navigate]);

  const { data: enrollments, isLoading } = useQuery<EnrollmentDetail[]>({
    queryKey: ["/api/enrollments/me"],
    enabled: !!user,
  });

  const { data: transcriptRequests } = useQuery<TranscriptRequestRow[]>({
    queryKey: ["/api/transcripts/me"],
    enabled: !!user,
  });

  const [transcriptDialogOpen, setTranscriptDialogOpen] = useState(false);
  const [purpose, setPurpose] = useState("");
  const [deliveryEmail, setDeliveryEmail] = useState("");
  const { toast } = useToast();

  const requestTranscript = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/transcripts/request", {
        purpose: purpose.trim() || null,
        deliveryEmail: deliveryEmail.trim() || null,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Request submitted", description: "The registrar will review your transcript request." });
      setTranscriptDialogOpen(false);
      setPurpose("");
      setDeliveryEmail("");
      queryClient.invalidateQueries({ queryKey: ["/api/transcripts/me"] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Please try again.";
      toast({ title: "Request failed", description: msg, variant: "destructive" });
    },
  });

  if (!user) return <SiteLayout><div className="mx-auto max-w-5xl px-4 py-24 text-center text-muted-foreground">Redirecting to login…</div></SiteLayout>;

  const active = enrollments ?? [];
  const completed = active.filter((e) => e.certificate);
  const inProgress = active.find((e) => e.progress.percent > 0 && e.progress.percent < 100) ?? active[0];

  return (
    <SiteLayout>
      <section className="border-b border-border bg-gradient-to-br from-primary to-[hsl(347_40%_24%)] py-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-sm uppercase tracking-wider text-accent">Student Dashboard</p>
          <h1 className="mt-1 font-serif text-4xl text-background" data-testid="text-welcome">Welcome, {user.name.split(" ")[0]}</h1>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        {/* Continue learning */}
        {inProgress && (
          <Card className="mb-10 flex flex-col items-start justify-between gap-4 bg-card p-6 sm:flex-row sm:items-center" data-testid="card-continue">
            <div className="flex-1">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Continue Learning</p>
              <h2 className="mt-1 font-serif text-2xl text-foreground">{inProgress.program.title}</h2>
              <div className="mt-3 max-w-md">
                <Progress value={inProgress.progress.percent} />
                <p className="mt-1 text-xs text-muted-foreground">{inProgress.progress.done} of {inProgress.progress.total} lessons · {inProgress.progress.percent}%</p>
              </div>
            </div>
            <Link href={`/programs/${inProgress.program.slug}/learn`}>
              <Button data-testid="button-resume"><PlayCircle className="mr-2 h-4 w-4" /> Resume</Button>
            </Link>
          </Card>
        )}

        {/* My programs */}
        <h2 className="mb-4 font-serif text-2xl text-primary">My Programs</h2>
        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-lg" />)}</div>
        ) : active.length === 0 ? (
          <Card className="p-10 text-center">
            <BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">You're not enrolled in any programs yet.</p>
            <Link href="/programs"><Button className="mt-4" data-testid="button-browse-empty">Browse Programs</Button></Link>
          </Card>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((e) => (
              <Card key={e.id} className="flex flex-col p-6" data-testid={`card-enrollment-${e.programId}`}>
                <span className="mb-2 w-fit rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">{levelLabel(e.program.level)}</span>
                <h3 className="font-serif text-lg leading-tight text-foreground">{e.program.title}</h3>
                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>Progress</span><span>{e.progress.percent}%</span></div>
                  <Progress value={e.progress.percent} />
                </div>
                <div className="mt-4 flex gap-2">
                  <Link href={`/programs/${e.program.slug}/learn`} className="flex-1">
                    <Button variant="outline" className="w-full" size="sm" data-testid={`button-open-${e.programId}`}>
                      {e.progress.percent > 0 ? "Continue" : "Start"}
                    </Button>
                  </Link>
                  {e.certificate && (
                    <Link href={`/certificates/${e.certificate.publicId}`}>
                      <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90" data-testid={`button-cert-${e.programId}`}>
                        <Award className="h-4 w-4" />
                      </Button>
                    </Link>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Transcripts */}
        <div className="mb-4 mt-12 flex items-center justify-between">
          <h2 className="font-serif text-2xl text-primary">Official Transcripts</h2>
          <Dialog open={transcriptDialogOpen} onOpenChange={setTranscriptDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" data-testid="button-request-transcript">
                <FileText className="mr-2 h-4 w-4" /> Request Transcript
              </Button>
            </DialogTrigger>
            <DialogContent data-testid="dialog-transcript-request">
              <DialogHeader>
                <DialogTitle>Request an Official Transcript</DialogTitle>
                <DialogDescription>
                  The registrar will review your request and, once approved, generate an official signed PDF transcript.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid gap-2">
                  <Label htmlFor="purpose">Purpose (optional)</Label>
                  <Textarea
                    id="purpose"
                    placeholder="e.g., Graduate school application, employer verification"
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    data-testid="input-purpose"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="delivery-email">Deliver to email (optional)</Label>
                  <Input
                    id="delivery-email"
                    type="email"
                    placeholder={user.email}
                    value={deliveryEmail}
                    onChange={(e) => setDeliveryEmail(e.target.value)}
                    data-testid="input-delivery-email"
                  />
                  <p className="text-xs text-muted-foreground">Leave blank to deliver to your account email.</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setTranscriptDialogOpen(false)}>Cancel</Button>
                <Button
                  onClick={() => requestTranscript.mutate()}
                  disabled={requestTranscript.isPending}
                  data-testid="button-submit-transcript-request"
                >
                  {requestTranscript.isPending ? "Submitting…" : "Submit Request"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        {transcriptRequests && transcriptRequests.length > 0 ? (
          <div className="space-y-3">
            {transcriptRequests.map((r) => (
              <Card key={r.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between" data-testid={`transcript-row-${r.id}`}>
                <div className="flex items-start gap-3">
                  {r.status === "issued" ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" />
                  ) : r.status === "denied" ? (
                    <FileText className="mt-0.5 h-5 w-5 text-destructive" />
                  ) : (
                    <Clock className="mt-0.5 h-5 w-5 text-muted-foreground" />
                  )}
                  <div>
                    <p className="text-sm font-medium">
                      {r.status === "issued" ? "Transcript Issued" : r.status === "denied" ? "Request Denied" : "Request Pending"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Requested {new Date(r.requestedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                      {r.issuedAt && (
                        <> · Issued {new Date(r.issuedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</>
                      )}
                    </p>
                    {r.purpose && <p className="mt-1 text-xs text-muted-foreground">Purpose: {r.purpose}</p>}
                    {r.note && <p className="mt-1 text-xs italic text-muted-foreground">Note: {r.note}</p>}
                  </div>
                </div>
                {r.status === "issued" && r.publicId && (
                  <a href={`/api/admin/transcripts/${r.publicId}/pdf`} target="_blank" rel="noreferrer">
                    <Button size="sm" data-testid={`button-download-transcript-${r.id}`}>
                      <Download className="mr-2 h-4 w-4" /> Download PDF
                    </Button>
                  </a>
                )}
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-6 text-sm text-muted-foreground">
            No transcript requests yet. Use the button above to request an official copy for graduate school, employer verification, or your own records.
          </Card>
        )}

        {/* Certificates */}
        <h2 className="mb-4 mt-12 font-serif text-2xl text-primary">Certificates Earned</h2>
        {completed.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            <GraduationCap className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            Complete all lessons in a program to earn your certificate.
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {completed.map((e) => (
              <Card key={e.id} className="flex items-center justify-between p-5" data-testid={`cert-row-${e.programId}`}>
                <div>
                  <p className="font-serif text-lg text-foreground">{e.program.title}</p>
                  <p className="text-xs text-muted-foreground">Certificate of Completion</p>
                </div>
                <Link href={`/certificates/${e.certificate!.publicId}`}>
                  <Button size="sm" variant="outline" data-testid={`button-view-cert-${e.programId}`}><Award className="mr-2 h-4 w-4" /> View</Button>
                </Link>
              </Card>
            ))}
          </div>
        )}
      </div>
    </SiteLayout>
  );
}
