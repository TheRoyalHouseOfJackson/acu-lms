import { useRoute, useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { SiteLayout } from "@/components/SiteLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import type { ProgramDetail as PD } from "@/lib/types";
import { Lock, PlayCircle, FileText, Video, CheckCircle2, BookOpen } from "lucide-react";

const typeIcon: Record<string, any> = { video: Video, pdf: FileText, text: BookOpen };

export default function ProgramDetail() {
  const [, params] = useRoute("/programs/:slug");
  const slug = params?.slug;
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const { data: program, isLoading } = useQuery<PD>({
    queryKey: ["/api/programs", slug],
    enabled: !!slug,
  });



  if (isLoading || !program) {
    return <SiteLayout><div className="mx-auto max-w-5xl px-4 py-16"><Skeleton className="h-64 w-full" /></div></SiteLayout>;
  }

  const firstLesson = program.courses[0]?.lessons[0];

  const handleEnroll = () => {
    if (!user) { navigate("/login"); return; }
    navigate(`/checkout/${program.slug}`);
  };

  return (
    <SiteLayout>
      <section className="border-b border-border bg-gradient-to-br from-primary to-[hsl(347_40%_24%)] py-14">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <Link href="/programs"><a className="text-sm text-background/70 hover:text-accent" data-testid="link-back-programs">← All Programs</a></Link>
          <span className="mt-4 block w-fit rounded-full bg-accent/20 px-3 py-1 text-xs font-medium uppercase tracking-wider text-accent">{program.level}</span>
          <h1 className="mt-3 font-serif text-4xl leading-tight text-background sm:text-5xl" data-testid="text-program-title">{program.title}</h1>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <span className="text-2xl font-semibold text-background">${program.tuition.toLocaleString()}</span>
            <span className="text-sm text-background/70">+ ${program.appFee} application fee · Self-paced</span>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="font-serif text-2xl text-primary">About This Program</h2>
          <p className="mt-3 leading-relaxed text-foreground/90">{program.description}</p>

          <h2 className="mt-10 font-serif text-2xl text-primary">Curriculum</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {program.courses.length} course{program.courses.length !== 1 ? "s" : ""} · {program.courses.reduce((a, c) => a + c.lessons.length, 0)} lessons
          </p>
          <div className="mt-4 space-y-6">
            {program.courses.map((c) => (
              <Card key={c.id} className="p-5" data-testid={`course-${c.id}`}>
                <h3 className="font-serif text-xl text-foreground">{c.title}</h3>
                {c.description && <p className="mt-1 text-sm text-muted-foreground">{c.description}</p>}
                <ul className="mt-4 divide-y divide-border">
                  {c.lessons.map((l) => {
                    const Icon = program.enrolled ? (typeIcon[l.type] ?? BookOpen) : Lock;
                    return (
                      <li key={l.id} className="flex items-center gap-3 py-2.5">
                        <Icon className={`h-4 w-4 ${program.enrolled ? "text-primary" : "text-muted-foreground"}`} />
                        <span className="flex-1 text-sm text-foreground">{l.title}</span>
                        <span className="text-xs uppercase tracking-wider text-muted-foreground">{l.type}</span>
                      </li>
                    );
                  })}
                  {c.quiz && (
                    <li className="flex items-center gap-3 py-2.5">
                      <CheckCircle2 className="h-4 w-4 text-accent-foreground" />
                      <span className="flex-1 text-sm font-medium text-foreground">Quiz: {c.quiz.title}</span>
                      <span className="text-xs uppercase tracking-wider text-muted-foreground">{c.quiz.passingScore}% to pass</span>
                    </li>
                  )}
                </ul>
              </Card>
            ))}
          </div>
        </div>

        <div className="lg:col-span-1">
          <Card className="sticky top-24 p-6">
            {program.enrolled ? (
              <>
                <p className="text-sm font-medium text-primary">You're enrolled</p>
                {program.progress && (
                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                      <span>Progress</span><span data-testid="text-progress-pct">{program.progress.percent}%</span>
                    </div>
                    <Progress value={program.progress.percent} />
                    <p className="mt-1 text-xs text-muted-foreground">{program.progress.done} of {program.progress.total} lessons complete</p>
                  </div>
                )}
                {firstLesson && (
                  <Button
                    className="mt-5 w-full"
                    onClick={() => navigate(`/programs/${program.slug}/courses/${firstLesson.courseId}/lessons/${firstLesson.id}`)}
                    data-testid="button-continue-learning"
                  >
                    <PlayCircle className="mr-2 h-4 w-4" /> Continue Learning
                  </Button>
                )}
              </>
            ) : (
              <>
                <p className="font-serif text-2xl text-foreground">${program.tuition.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">+ ${program.appFee} app fee</p>
                <Button className="mt-5 w-full" onClick={handleEnroll} data-testid="button-enroll">
                  {user ? "Enroll & Pay" : "Log in to Enroll"}
                </Button>
                <p className="mt-3 text-center text-xs text-muted-foreground">Self-paced · Lifetime access · Certificate on completion</p>
              </>
            )}
          </Card>
        </div>
      </section>
    </SiteLayout>
  );
}
