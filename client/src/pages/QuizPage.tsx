import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { SiteLayout } from "@/components/SiteLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import type { QuizDetail } from "@/lib/types";
import { CheckCircle2, XCircle, ClipboardCheck, Printer } from "lucide-react";

type Result = { score: number; passed: boolean; correct: number; total: number; passingScore: number };

export default function QuizPage() {
  const [, params] = useRoute("/quizzes/:id");
  const quizId = Number(params?.id);
  const [, navigate] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => { if (!authLoading && !user) navigate("/login"); }, [authLoading, user, navigate]);

  const { data: quiz, isLoading } = useQuery<QuizDetail>({ queryKey: ["/api/quizzes", quizId], enabled: !!quizId });

  const submit = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/quizzes/${quizId}/attempt`, { answers });
      return res.json() as Promise<Result>;
    },
    onSuccess: (r) => setResult(r),
  });

  if (isLoading || !quiz) return <SiteLayout><div className="mx-auto max-w-2xl px-4 py-16"><Skeleton className="h-96 w-full" /></div></SiteLayout>;

  const allAnswered = quiz.questions.every((q) => answers[q.id] !== undefined);

  if (result) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-2xl px-4 py-16 text-center">
          {result.passed ? <CheckCircle2 className="mx-auto mb-4 h-16 w-16 text-primary" /> : <XCircle className="mx-auto mb-4 h-16 w-16 text-destructive" />}
          <h1 className="font-serif text-4xl text-primary" data-testid="text-quiz-result">{result.passed ? "You Passed!" : "Not Quite Yet"}</h1>
          <p className="mt-2 text-muted-foreground">You scored <strong>{result.score}%</strong> ({result.correct} of {result.total} correct). Passing score is {result.passingScore}%.</p>
          <div className="mt-8 flex justify-center gap-3">
            {!result.passed && <Button onClick={() => { setResult(null); setAnswers({}); }} data-testid="button-retry">Try Again</Button>}
            <Button variant="outline" onClick={() => navigate("/dashboard")} data-testid="button-quiz-dashboard">Back to Dashboard</Button>
          </div>
        </div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
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
          .quiz-print-root { font-size: 11.5pt; line-height: 1.55; }
          .quiz-print-root p, .quiz-print-root li { font-size: 11.5pt; }
        }
      `}</style>
      <div className="quiz-print-root mx-auto max-w-2xl px-4 py-12 sm:px-6 print:max-w-full print:py-4">
        <div className="flex items-start justify-between gap-4 print:block">
          <div>
            <div className="flex items-center gap-2 text-accent-foreground">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Quiz · {quiz.passingScore}% to pass</span>
            </div>
            <h1 className="mt-1 font-serif text-4xl text-primary" data-testid="text-quiz-title">{quiz.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{quiz.questions.length} questions · multiple choice</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => window.print()} className="shrink-0 print:hidden" data-testid="button-print-quiz">
            <Printer className="mr-2 h-4 w-4" /> Print / Study
          </Button>
        </div>
        <p className="mt-4 hidden text-sm text-muted-foreground print:block">
          Name: ______________________________ &nbsp;&nbsp; Date: ______________
        </p>

        <div className="mt-8 space-y-6 print:mt-4 print:space-y-4">
          {quiz.questions.map((q, i) => (
            <Card key={q.id} className="p-5 print:border-0 print:p-2 print:shadow-none" data-testid={`quiz-question-${q.id}`}>
              <p className="font-medium text-foreground">{i + 1}. {q.question}</p>
              <div className="mt-3 space-y-2 print:mt-2 print:space-y-1">
                {q.options.map((opt, oi) => (
                  <button
                    key={oi}
                    onClick={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
                    className={`flex w-full items-center gap-3 rounded-md border px-4 py-2.5 text-left text-sm hover-elevate ${answers[q.id] === oi ? "border-primary bg-primary/5" : "border-border"} print:border-0 print:px-0 print:py-1 print:hover:bg-transparent`}
                    data-testid={`option-${q.id}-${oi}`}
                  >
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full border text-xs ${answers[q.id] === oi ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground"} print:border-black print:bg-transparent print:text-black`}>
                      {String.fromCharCode(65 + oi)}
                    </span>
                    {opt}
                  </button>
                ))}
              </div>
            </Card>
          ))}
        </div>

        <div className="mt-8 print:hidden">
          <Progress value={(Object.keys(answers).length / quiz.questions.length) * 100} className="mb-3 h-1.5" />
          <Button className="w-full" disabled={!allAnswered || submit.isPending} onClick={() => submit.mutate()} data-testid="button-submit-quiz">
            {submit.isPending ? "Submitting..." : allAnswered ? "Submit Quiz" : `Answer all ${quiz.questions.length} questions`}
          </Button>
        </div>
      </div>
    </SiteLayout>
  );
}
