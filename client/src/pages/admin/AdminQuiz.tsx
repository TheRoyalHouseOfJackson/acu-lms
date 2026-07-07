import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/AdminLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { QuizDetail } from "@/lib/types";
import { Plus, Trash2, CheckCircle2 } from "lucide-react";

export default function AdminQuiz() {
  const [, params] = useRoute("/admin/quizzes/:id");
  const quizId = Number(params?.id);
  const { toast } = useToast();

  const { data: quiz, isLoading } = useQuery<QuizDetail>({ queryKey: ["/api/quizzes", quizId], enabled: !!quizId });

  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correct, setCorrect] = useState(0);

  const addQ = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/quizzes/${quizId}/questions`, {
      question, options, correctAnswer: correct, position: quiz?.questions.length ?? 0,
    })).json(),
    onSuccess: () => {
      setQuestion(""); setOptions(["", "", "", ""]); setCorrect(0);
      queryClient.invalidateQueries({ queryKey: ["/api/quizzes", quizId] });
      toast({ title: "Question added" });
    },
  });

  const delQ = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/questions/${id}`)).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/quizzes", quizId] }),
  });

  if (isLoading || !quiz) return <AdminLayout><Skeleton className="h-96 w-full" /></AdminLayout>;

  const canAdd = question.trim() && options.every((o) => o.trim());

  return (
    <AdminLayout>
      <Link href={`/admin/courses/${quiz.course?.id}`}><a className="text-sm text-muted-foreground hover:text-primary">← {quiz.course?.title}</a></Link>
      <h1 className="mt-2 font-serif text-3xl text-primary">{quiz.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{quiz.passingScore}% to pass · {quiz.questions.length} questions</p>

      {/* Existing questions */}
      <div className="mt-6 space-y-3">
        {quiz.questions.map((q, i) => (
          <Card key={q.id} className="p-5" data-testid={`admin-question-${q.id}`}>
            <div className="flex items-start justify-between">
              <p className="font-medium text-foreground">{i + 1}. {q.question}</p>
              <Button size="icon" variant="ghost" onClick={() => delQ.mutate(q.id)} data-testid={`button-del-q-${q.id}`}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
            <ul className="mt-2 space-y-1 text-sm">
              {q.options.map((o, oi) => (
                <li key={oi} className={`flex items-center gap-2 ${oi === q.correctAnswer ? "font-medium text-primary" : "text-muted-foreground"}`}>
                  {oi === q.correctAnswer ? <CheckCircle2 className="h-4 w-4" /> : <span className="inline-block h-4 w-4 text-center text-xs">{String.fromCharCode(65 + oi)}</span>}
                  {o}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      {/* Add question */}
      <Card className="mt-6 p-6">
        <h2 className="font-serif text-xl text-foreground">Add Question</h2>
        <div className="mt-4 space-y-4">
          <div>
            <Label>Question</Label>
            <Input value={question} onChange={(e) => setQuestion(e.target.value)} data-testid="input-question" />
          </div>
          <div className="space-y-2">
            <Label>Options (select the correct one)</Label>
            {options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCorrect(i)}
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs ${correct === i ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground text-muted-foreground"}`}
                  data-testid={`radio-correct-${i}`}
                >
                  {String.fromCharCode(65 + i)}
                </button>
                <Input value={o} onChange={(e) => setOptions(options.map((x, xi) => xi === i ? e.target.value : x))} placeholder={`Option ${String.fromCharCode(65 + i)}`} data-testid={`input-option-${i}`} />
              </div>
            ))}
          </div>
          <Button onClick={() => addQ.mutate()} disabled={!canAdd || addQ.isPending} data-testid="button-add-question">
            <Plus className="mr-1 h-4 w-4" /> Add Question
          </Button>
        </div>
      </Card>
    </AdminLayout>
  );
}
