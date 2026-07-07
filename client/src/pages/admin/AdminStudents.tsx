import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/AdminLayout";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Users } from "lucide-react";

type Student = {
  id: number; name: string; email: string;
  enrollments: { programTitle: string; progress: { percent: number; done: number; total: number } }[];
};

export default function AdminStudents() {
  const { data: students, isLoading } = useQuery<Student[]>({ queryKey: ["/api/admin/students"] });

  return (
    <AdminLayout>
      <h1 className="font-serif text-3xl text-primary">Students</h1>
      <p className="mt-1 text-muted-foreground">{students?.length ?? 0} registered students.</p>

      <div className="mt-6 space-y-4">
        {isLoading ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />) :
          students?.length === 0 ? (
            <Card className="p-10 text-center text-muted-foreground">
              <Users className="mx-auto mb-2 h-8 w-8" /> No students have registered yet.
            </Card>
          ) : students?.map((s) => (
            <Card key={s.id} className="p-5" data-testid={`student-${s.id}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">{s.name}</p>
                  <p className="text-sm text-muted-foreground">{s.email}</p>
                </div>
                <span className="text-xs text-muted-foreground">{s.enrollments.length} enrollment{s.enrollments.length !== 1 ? "s" : ""}</span>
              </div>
              {s.enrollments.length > 0 && (
                <div className="mt-4 space-y-3 border-t border-border pt-3">
                  {s.enrollments.map((e, i) => (
                    <div key={i}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="text-foreground">{e.programTitle}</span>
                        <span className="text-muted-foreground">{e.progress.percent}% ({e.progress.done}/{e.progress.total})</span>
                      </div>
                      <Progress value={e.progress.percent} className="h-1.5" />
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
      </div>
    </AdminLayout>
  );
}
