import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { SiteLayout } from "@/components/SiteLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import type { EnrollmentDetail } from "@/lib/types";
import { PlayCircle, Award, BookOpen, GraduationCap } from "lucide-react";

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
                <span className="mb-2 w-fit rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">{e.program.level}</span>
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
