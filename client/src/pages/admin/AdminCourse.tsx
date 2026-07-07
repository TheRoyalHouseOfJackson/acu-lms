import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/AdminLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Trash2, ChevronRight, Video, FileText, BookOpen, ClipboardCheck } from "lucide-react";

type Lesson = { id: number; title: string; type: string; position: number };
type Quiz = { id: number; title: string; passingScore: number };
type CourseFull = { id: number; programId: number; title: string; description: string; lessons: Lesson[]; quiz: Quiz | null; program: { id: number; slug: string; title: string } };

const typeIcon: Record<string, any> = { video: Video, pdf: FileText, text: BookOpen };

export default function AdminCourse() {
  const [, params] = useRoute("/admin/courses/:id");
  const courseId = Number(params?.id);
  const { toast } = useToast();

  const { data: course, isLoading } = useQuery<CourseFull>({ queryKey: ["/api/courses", courseId], enabled: !!courseId });

  const [title, setTitle] = useState("");
  const [type, setType] = useState("text");
  const addLesson = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/lessons", { courseId, title, type, position: course?.lessons.length ?? 0 })).json(),
    onSuccess: () => { setTitle(""); queryClient.invalidateQueries({ queryKey: ["/api/courses", courseId] }); toast({ title: "Lesson added" }); },
  });
  const delLesson = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/lessons/${id}`)).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/courses", courseId] }),
  });

  const [quizTitle, setQuizTitle] = useState("");
  const addQuiz = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/quizzes", { courseId, title: quizTitle || "Course Quiz", passingScore: 70 })).json(),
    onSuccess: () => { setQuizTitle(""); queryClient.invalidateQueries({ queryKey: ["/api/courses", courseId] }); toast({ title: "Quiz created" }); },
  });

  const [titleEdit, setTitleEdit] = useState<string | null>(null);
  const saveCourse = useMutation({
    mutationFn: async () => (await apiRequest("PATCH", `/api/courses/${courseId}`, { title: titleEdit })).json(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/courses", courseId] }); setTitleEdit(null); toast({ title: "Saved" }); },
  });

  if (isLoading || !course) return <AdminLayout><Skeleton className="h-96 w-full" /></AdminLayout>;

  return (
    <AdminLayout>
      <Link href={`/admin/programs/${course.programId}`}><a className="text-sm text-muted-foreground hover:text-primary">← {course.program?.title}</a></Link>
      <div className="mt-2 flex items-center gap-2">
        <Input
          className="max-w-md font-serif text-2xl"
          value={titleEdit ?? course.title}
          onChange={(e) => setTitleEdit(e.target.value)}
          data-testid="input-course-title"
        />
        {titleEdit !== null && titleEdit !== course.title && (
          <Button size="sm" onClick={() => saveCourse.mutate()} data-testid="button-save-course">Save</Button>
        )}
      </div>

      {/* Lessons */}
      <Card className="mt-6 p-6">
        <h2 className="font-serif text-xl text-foreground">Lessons ({course.lessons.length})</h2>
        <div className="mt-4 space-y-2">
          {course.lessons.map((l) => {
            const Icon = typeIcon[l.type] ?? BookOpen;
            return (
              <div key={l.id} className="flex items-center justify-between rounded-md border border-border p-3" data-testid={`admin-lesson-${l.id}`}>
                <Link href={`/admin/lessons/${l.id}`} className="flex-1">
                  <a className="flex items-center gap-3">
                    <Icon className="h-4 w-4 text-primary" />
                    <span className="font-medium text-foreground hover:text-primary">{l.title}</span>
                    <span className="text-xs uppercase tracking-wider text-muted-foreground">{l.type}</span>
                  </a>
                </Link>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" onClick={() => delLesson.mutate(l.id)} data-testid={`button-del-lesson-${l.id}`}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  <Link href={`/admin/lessons/${l.id}`}><Button size="icon" variant="ghost"><ChevronRight className="h-4 w-4" /></Button></Link>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Input placeholder="New lesson title" value={title} onChange={(e) => setTitle(e.target.value)} data-testid="input-new-lesson" />
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="sm:w-36" data-testid="select-lesson-type"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="text">Text</SelectItem>
              <SelectItem value="video">Video</SelectItem>
              <SelectItem value="pdf">PDF</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => addLesson.mutate()} disabled={!title || addLesson.isPending} data-testid="button-add-lesson"><Plus className="mr-1 h-4 w-4" /> Add</Button>
        </div>
      </Card>

      {/* Quiz */}
      <Card className="mt-6 p-6">
        <h2 className="font-serif text-xl text-foreground">Quiz</h2>
        {course.quiz ? (
          <div className="mt-4 flex items-center justify-between rounded-md border border-border p-3">
            <div className="flex items-center gap-3">
              <ClipboardCheck className="h-4 w-4 text-primary" />
              <span className="font-medium text-foreground">{course.quiz.title}</span>
              <span className="text-xs text-muted-foreground">· {course.quiz.passingScore}% to pass</span>
            </div>
            <Link href={`/admin/quizzes/${course.quiz.id}`}><Button size="sm" variant="outline" data-testid="button-edit-quiz">Edit Questions</Button></Link>
          </div>
        ) : (
          <div className="mt-4 flex gap-2">
            <Input placeholder="Quiz title (e.g. Course Quiz)" value={quizTitle} onChange={(e) => setQuizTitle(e.target.value)} data-testid="input-quiz-title" />
            <Button onClick={() => addQuiz.mutate()} disabled={addQuiz.isPending} data-testid="button-create-quiz"><Plus className="mr-1 h-4 w-4" /> Create Quiz</Button>
          </div>
        )}
      </Card>
    </AdminLayout>
  );
}
