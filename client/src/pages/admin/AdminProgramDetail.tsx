import { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/AdminLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Program } from "@/lib/types";
import { Plus, ChevronRight, Trash2 } from "lucide-react";

type Course = { id: number; title: string; description: string; position: number; lessons: any[] };
type ProgramFull = Program & { courses: Course[] };

export default function AdminProgramDetail() {
  const [, params] = useRoute("/admin/programs/:id");
  const programId = Number(params?.id);
  const { toast } = useToast();

  // We fetch by slug via list; simpler: fetch programs list then find, then fetch detail by slug.
  const { data: programs } = useQuery<Program[]>({ queryKey: ["/api/programs"] });
  const base = programs?.find((p) => p.id === programId);
  const { data: program, isLoading } = useQuery<ProgramFull>({
    queryKey: ["/api/programs", base?.slug],
    enabled: !!base?.slug,
  });

  const [form, setForm] = useState({ title: "", description: "", tuition: 0, appFee: 0 });
  useEffect(() => {
    if (program) setForm({ title: program.title, description: program.description, tuition: program.tuition, appFee: program.appFee });
  }, [program?.id]);

  const save = useMutation({
    mutationFn: async () => (await apiRequest("PATCH", `/api/programs/${programId}`, form)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/programs"] });
      toast({ title: "Saved", description: "Program updated." });
    },
  });

  const [newCourse, setNewCourse] = useState("");
  const addCourse = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/courses", { programId, title: newCourse, position: program?.courses.length ?? 0 })).json(),
    onSuccess: () => {
      setNewCourse("");
      queryClient.invalidateQueries({ queryKey: ["/api/programs", base?.slug] });
      toast({ title: "Course added" });
    },
  });

  const delCourse = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/courses/${id}`)).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/programs", base?.slug] }),
  });

  if (isLoading || !program) return <AdminLayout><Skeleton className="h-96 w-full" /></AdminLayout>;

  return (
    <AdminLayout>
      <Link href="/admin/programs"><a className="text-sm text-muted-foreground hover:text-primary">← All Programs</a></Link>
      <h1 className="mt-2 font-serif text-3xl text-primary">{program.title}</h1>
      <span className="mt-1 inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">{program.level}</span>

      {/* Edit program */}
      <Card className="mt-6 p-6">
        <h2 className="font-serif text-xl text-foreground">Program Details</h2>
        <div className="mt-4 space-y-4">
          <div>
            <Label>Title</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} data-testid="input-program-title" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="input-program-desc" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tuition ($)</Label>
              <Input type="number" value={form.tuition} onChange={(e) => setForm({ ...form, tuition: Number(e.target.value) })} data-testid="input-program-tuition" />
            </div>
            <div>
              <Label>Application Fee ($)</Label>
              <Input type="number" value={form.appFee} onChange={(e) => setForm({ ...form, appFee: Number(e.target.value) })} data-testid="input-program-appfee" />
            </div>
          </div>
          <Button onClick={() => save.mutate()} disabled={save.isPending} data-testid="button-save-program">
            {save.isPending ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </Card>

      {/* Courses */}
      <Card className="mt-6 p-6">
        <h2 className="font-serif text-xl text-foreground">Courses ({program.courses.length})</h2>
        <div className="mt-4 space-y-2">
          {program.courses.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-md border border-border p-3" data-testid={`admin-course-${c.id}`}>
              <Link href={`/admin/courses/${c.id}`} className="flex-1">
                <a className="flex items-center gap-2">
                  <span className="font-medium text-foreground hover:text-primary">{c.title}</span>
                  <span className="text-xs text-muted-foreground">· {c.lessons.length} lessons</span>
                </a>
              </Link>
              <div className="flex items-center gap-2">
                <Button size="icon" variant="ghost" onClick={() => delCourse.mutate(c.id)} data-testid={`button-del-course-${c.id}`}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                <Link href={`/admin/courses/${c.id}`}><Button size="icon" variant="ghost"><ChevronRight className="h-4 w-4" /></Button></Link>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <Input placeholder="New course title" value={newCourse} onChange={(e) => setNewCourse(e.target.value)} data-testid="input-new-course" />
          <Button onClick={() => addCourse.mutate()} disabled={!newCourse || addCourse.isPending} data-testid="button-add-course"><Plus className="mr-1 h-4 w-4" /> Add</Button>
        </div>
      </Card>
    </AdminLayout>
  );
}
