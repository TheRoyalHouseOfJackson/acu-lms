import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { renderMarkdown } from "@/lib/markdown";
import type { ProgramDetail, QuizDetail } from "@/lib/types";
import { Printer, ArrowLeft } from "lucide-react";
import { LogoMark } from "@/components/Logo";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

export default function ProgramPrint() {
  const [, params] = useRoute("/programs/:slug/print");
  const slug = params?.slug;
  const [, navigate] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const [quizzes, setQuizzes] = useState<Record<number, QuizDetail>>({});
  const [quizzesLoaded, setQuizzesLoaded] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [authLoading, user, navigate]);

  const { data: program, isLoading } = useQuery<ProgramDetail>({
    queryKey: ["/api/programs", slug],
    enabled: !!slug,
  });

  // Fetch quiz questions for every course quiz in parallel
  useEffect(() => {
    if (!program) return;
    const quizIds = program.courses.map((c) => c.quiz?.id).filter((id): id is number => !!id);
    if (quizIds.length === 0) {
      setQuizzesLoaded(true);
      return;
    }
    Promise.all(
      quizIds.map(async (id) => {
        const res = await apiRequest("GET", `/api/quizzes/${id}`);
        return res.json() as Promise<QuizDetail>;
      })
    ).then((results) => {
      const map: Record<number, QuizDetail> = {};
      results.forEach((q) => { map[q.id] = q; });
      setQuizzes(map);
      setQuizzesLoaded(true);
    });
  }, [program]);

  if (isLoading || !program || !quizzesLoaded) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-16">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="mt-6 h-96 w-full" />
      </div>
    );
  }

  const totalLessons = program.courses.reduce((a, c) => a + c.lessons.length, 0);
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="min-h-screen bg-background print:bg-white program-print">
      {/* Print-only styles: page numbers, page size, bumped font sizes, cover watermark */}
      <style>{`
        @media print {
          @page {
            size: letter;
            margin: 0.75in 0.6in 0.85in 0.6in;
            @bottom-center {
              content: "Page " counter(page) " of " counter(pages);
              font-family: Georgia, "Times New Roman", serif;
              font-size: 10pt;
              color: #666;
            }
            @bottom-left {
              content: "Ambassadors Christian University";
              font-family: Georgia, "Times New Roman", serif;
              font-size: 9pt;
              color: #888;
            }
          }
          @page :first {
            @bottom-center { content: ""; }
            @bottom-left { content: ""; }
          }
          .program-print {
            font-size: 11.5pt;
            line-height: 1.55;
          }
          .program-print p,
          .program-print li {
            font-size: 11.5pt;
          }
          .program-print .print-cover-watermark {
            display: block;
          }
          .program-print .print-cover-logo {
            display: block;
          }
        }
        .print-cover-watermark { display: none; }
        .print-cover-logo { display: none; }
      `}</style>
      {/* Top action bar — hidden on print */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/programs/${slug}`)} data-testid="button-back">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Program
          </Button>
          <Button onClick={() => window.print()} data-testid="button-print-program">
            <Printer className="mr-2 h-4 w-4" /> Print / Save as PDF
          </Button>
        </div>
      </div>

      {/* Printable content */}
      <div className="mx-auto max-w-4xl px-6 py-10 print:px-0 print:py-4">
        {/* Cover */}
        <header className="relative border-b border-border pb-6 print:break-after-page print:min-h-[9in] print:pb-0">
          {/* Cover logo — only shown on print */}
          <div className="print-cover-logo mb-8 flex justify-center print:mb-10">
            <LogoMark size={140} />
          </div>
          {/* Watermarked large crest behind the title on print */}
          <div className="print-cover-watermark pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.06]">
            <LogoMark size={520} />
          </div>
          <div className="relative">
            <p className="text-center text-xs uppercase tracking-widest text-muted-foreground print:text-[10pt]">Ambassadors Christian University</p>
            <h1 className="mt-2 text-center font-serif text-4xl leading-tight text-primary print:mt-6 print:text-[32pt]">{program.title}</h1>
            <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-muted-foreground print:mt-6 print:text-[12pt]">{program.description}</p>
          </div>
          <div className="relative mt-6 grid grid-cols-2 gap-4 text-sm print:mt-16 sm:grid-cols-4">
            <div className="text-center">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Level</p>
              <p className="mt-1 font-medium text-foreground">{program.level}</p>
            </div>
            <div className="text-center">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Courses</p>
              <p className="mt-1 font-medium text-foreground">{program.courses.length}</p>
            </div>
            <div className="text-center">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Lessons</p>
              <p className="mt-1 font-medium text-foreground">{totalLessons}</p>
            </div>
            <div className="text-center">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Printed</p>
              <p className="mt-1 font-medium text-foreground">{today}</p>
            </div>
          </div>
        </header>

        {/* Table of contents */}
        <section className="mt-10 print:break-after-page">
          <h2 className="font-serif text-2xl text-primary">Table of Contents</h2>
          <ol className="mt-4 space-y-2 text-sm">
            {program.courses.map((c, ci) => (
              <li key={c.id}>
                <p className="font-semibold text-foreground">{ci + 1}. {c.title}</p>
                <ul className="ml-6 mt-1 space-y-0.5 text-muted-foreground">
                  {c.lessons.map((l, li) => (
                    <li key={l.id}>{ci + 1}.{li + 1} {l.title}</li>
                  ))}
                  {c.quiz && <li className="italic">Quiz: {c.quiz.title}</li>}
                </ul>
              </li>
            ))}
          </ol>
        </section>

        {/* Courses */}
        {program.courses.map((c, ci) => (
          <section key={c.id} className="mt-12 print:mt-0 print:break-before-page">
            <div className="border-b-2 border-primary pb-3">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Course {ci + 1}</p>
              <h2 className="mt-1 font-serif text-3xl text-primary">{c.title}</h2>
              {c.description && <p className="mt-2 text-sm text-muted-foreground">{c.description}</p>}
            </div>

            {c.lessons.map((l, li) => (
              <article key={l.id} className="mt-8 print:break-inside-avoid-page">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Lesson {ci + 1}.{li + 1}
                </p>
                <h3 className="mt-1 font-serif text-2xl text-foreground">{l.title}</h3>
                <div className="mt-4">
                  {l.type === "text" && (
                    <div
                      className="text-foreground/90"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(l.contentText || "*No content yet.*") }}
                    />
                  )}
                  {l.type === "pdf" && (
                    <p className="rounded border border-dashed border-border p-4 text-sm italic text-muted-foreground">
                      {l.contentUrl
                        ? `PDF lesson — download at ${API_BASE}${l.contentUrl}`
                        : "PDF lesson (no file uploaded yet)"}
                    </p>
                  )}
                  {l.type === "video" && (
                    <p className="rounded border border-dashed border-border p-4 text-sm italic text-muted-foreground">
                      Video lesson — {l.contentUrl || "not printable; watch online"}
                    </p>
                  )}
                </div>
              </article>
            ))}

            {/* Quiz for this course */}
            {c.quiz && quizzes[c.quiz.id] && (
              <article className="mt-10 border-t-2 border-primary pt-6 print:break-before-page">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Quiz · {quizzes[c.quiz.id].passingScore}% to pass</p>
                <h3 className="mt-1 font-serif text-2xl text-primary">{quizzes[c.quiz.id].title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Name: ______________________________ &nbsp;&nbsp; Date: ______________
                </p>
                <ol className="mt-6 space-y-5">
                  {quizzes[c.quiz.id].questions.map((q, qi) => (
                    <li key={q.id} className="print:break-inside-avoid">
                      <p className="font-medium text-foreground">{qi + 1}. {q.question}</p>
                      <ul className="mt-2 space-y-1 text-sm">
                        {q.options.map((opt, oi) => (
                          <li key={oi} className="flex items-start gap-3">
                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-foreground text-xs">
                              {String.fromCharCode(65 + oi)}
                            </span>
                            <span>{opt}</span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ol>
              </article>
            )}
          </section>
        ))}

        <footer className="mt-16 border-t border-border pt-6 text-center text-xs text-muted-foreground print:mt-8 print:hidden">
          <p>© {new Date().getFullYear()} Ambassadors Christian University · Baton Rouge, Louisiana</p>
          <p className="mt-1">Printed on {today} from acu-lms.fly.dev</p>
        </footer>
      </div>
    </div>
  );
}
