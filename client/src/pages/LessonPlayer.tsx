import { useEffect, useMemo } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { LogoMark } from "@/components/Logo";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { resolveVideo } from "@/lib/video";
import { renderMarkdown } from "@/lib/markdown";
import type { ProgramDetail } from "@/lib/types";
import type { LessonProgress } from "@shared/schema";
import { CheckCircle2, Circle, ChevronLeft, ChevronRight, Check, FileText, Home, ClipboardCheck } from "lucide-react";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

export default function LessonPlayer() {
  const [, params] = useRoute("/programs/:slug/courses/:courseId/lessons/:lessonId");
  const slug = params?.slug;
  const lessonId = Number(params?.lessonId);
  const [, navigate] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  useEffect(() => { if (!authLoading && !user) navigate("/login"); }, [authLoading, user, navigate]);

  const { data: program, isLoading } = useQuery<ProgramDetail>({ queryKey: ["/api/programs", slug], enabled: !!slug });
  const { data: progress } = useQuery<LessonProgress[]>({ queryKey: ["/api/progress/me"], enabled: !!user });

  const flatLessons = useMemo(() => (program?.courses.flatMap((c) => c.lessons.map((l) => ({ ...l, courseTitle: c.title }))) ?? []), [program]);
  const doneSet = useMemo(() => new Set((progress ?? []).map((p) => p.lessonId)), [progress]);
  const lesson = flatLessons.find((l) => l.id === lessonId);
  const idx = flatLessons.findIndex((l) => l.id === lessonId);
  const prev = idx > 0 ? flatLessons[idx - 1] : null;
  const next = idx >= 0 && idx < flatLessons.length - 1 ? flatLessons[idx + 1] : null;
  const currentCourse = program?.courses.find((c) => c.id === lesson?.courseId);
  const courseLessons = currentCourse?.lessons ?? [];
  const courseDone = courseLessons.filter((l) => doneSet.has(l.id)).length;
  const coursePct = courseLessons.length ? Math.round((courseDone / courseLessons.length) * 100) : 0;
  const isDone = doneSet.has(lessonId);

  const complete = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/progress/complete", { lessonId });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/progress/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/programs", slug] });
      queryClient.invalidateQueries({ queryKey: ["/api/enrollments/me"] });
      if (data.certificate) {
        toast({ title: "🎓 Program complete!", description: "You've earned your certificate." });
        navigate(`/certificates/${data.certificate.publicId}`);
      } else {
        toast({ title: "Lesson complete", description: "Progress saved." });
        if (next) navigate(`/programs/${slug}/courses/${next.courseId}/lessons/${next.id}`);
      }
    },
  });

  if (isLoading || !program || !lesson) {
    return <div className="mx-auto max-w-5xl px-4 py-24"><Skeleton className="h-96 w-full" /></div>;
  }

  const video = lesson.type === "video" ? resolveVideo(lesson.contentUrl) : null;

  return (
    <div className="flex min-h-screen flex-col bg-background lg:flex-row">
      {/* Sidebar */}
      <aside className="border-b border-border bg-sidebar text-sidebar-foreground lg:w-80 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-2 border-b border-sidebar-border p-4">
          <Link href="/dashboard"><a className="flex items-center gap-2" data-testid="link-sidebar-home"><LogoMark size={28} /><span className="font-serif text-lg">Ambassadors</span></a></Link>
        </div>
        <div className="p-4">
          <Link href={`/programs/${slug}`}><a className="text-xs text-sidebar-foreground/60 hover:text-accent">← {program.title}</a></Link>
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-xs text-sidebar-foreground/70"><span>{currentCourse?.title}</span><span>{coursePct}%</span></div>
            <Progress value={coursePct} className="h-1.5" />
          </div>
        </div>
        <nav className="max-h-[40vh] overflow-y-auto px-2 pb-4 lg:max-h-[calc(100vh-160px)]">
          {program.courses.map((c) => (
            <div key={c.id} className="mb-3">
              <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-accent">{c.title}</p>
              {c.lessons.map((l) => {
                const active = l.id === lessonId;
                const done = doneSet.has(l.id);
                return (
                  <Link key={l.id} href={`/programs/${slug}/courses/${c.id}/lessons/${l.id}`}>
                    <a
                      data-testid={`sidebar-lesson-${l.id}`}
                      className={`flex items-center gap-2 rounded-md px-2 py-2 text-sm ${active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50"}`}
                    >
                      {done ? <CheckCircle2 className="h-4 w-4 shrink-0 text-accent" /> : <Circle className="h-4 w-4 shrink-0 opacity-40" />}
                      <span className="line-clamp-2 flex-1 text-left">{l.title}</span>
                    </a>
                  </Link>
                );
              })}
              {c.quiz && (
                <Link href={`/quizzes/${c.quiz.id}`}>
                  <a className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent/50" data-testid={`sidebar-quiz-${c.quiz.id}`}>
                    <ClipboardCheck className="h-4 w-4 shrink-0 text-accent" />
                    <span className="flex-1">Quiz: {c.quiz.title}</span>
                  </a>
                </Link>
              )}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-8">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{lesson.courseTitle}</p>
          <h1 className="mt-1 font-serif text-3xl text-foreground" data-testid="text-lesson-title">{lesson.title}</h1>

          <div className="mt-6">
            {/* VIDEO */}
            {lesson.type === "video" && (
              video?.kind === "none" ? (
                <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed border-border bg-muted text-center text-sm text-muted-foreground">
                  No video has been added to this lesson yet.
                </div>
              ) : video?.kind === "file" ? (
                <video controls className="w-full rounded-lg bg-black" src={`${API_BASE}${video.src}`} data-testid="video-player">
                  Your browser does not support video.
                </video>
              ) : (
                <div className="aspect-video overflow-hidden rounded-lg bg-black">
                  <iframe src={video!.src} className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title={lesson.title} data-testid="video-embed" />
                </div>
              )
            )}

            {/* PDF */}
            {lesson.type === "pdf" && (
              lesson.contentUrl ? (
                <div className="overflow-hidden rounded-lg border border-border">
                  <iframe src={`${API_BASE}${lesson.contentUrl}`} className="h-[75vh] w-full" title={lesson.title} data-testid="pdf-viewer" />
                </div>
              ) : (
                <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted text-center text-sm text-muted-foreground">
                  <FileText className="mb-2 h-8 w-8" />
                  No PDF has been uploaded to this lesson yet.
                </div>
              )
            )}

            {/* TEXT */}
            {lesson.type === "text" && (
              <article className="max-w-none text-foreground/90" data-testid="text-content" dangerouslySetInnerHTML={{ __html: renderMarkdown(lesson.contentText || "*No content yet.*") }} />
            )}
          </div>

          {/* Actions */}
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
            <Button
              variant={isDone ? "outline" : "default"}
              onClick={() => complete.mutate()}
              disabled={complete.isPending || isDone}
              data-testid="button-mark-complete"
            >
              <Check className="mr-2 h-4 w-4" /> {isDone ? "Completed" : "Mark as Complete"}
            </Button>
            <div className="flex gap-2">
              {prev ? (
                <Link href={`/programs/${slug}/courses/${prev.courseId}/lessons/${prev.id}`}>
                  <Button variant="outline" data-testid="button-prev"><ChevronLeft className="mr-1 h-4 w-4" /> Previous</Button>
                </Link>
              ) : (
                <Button variant="outline" disabled><ChevronLeft className="mr-1 h-4 w-4" /> Previous</Button>
              )}
              {next ? (
                <Link href={`/programs/${slug}/courses/${next.courseId}/lessons/${next.id}`}>
                  <Button variant="outline" data-testid="button-next">Next <ChevronRight className="ml-1 h-4 w-4" /></Button>
                </Link>
              ) : (
                <Link href="/dashboard"><Button variant="outline" data-testid="button-finish"><Home className="mr-1 h-4 w-4" /> Dashboard</Button></Link>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
