import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/AdminLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Users, GraduationCap } from "lucide-react";

export default function AdminHome() {
  const { data: stats } = useQuery<{ programs: number; students: number }>({ queryKey: ["/api/admin/stats"] });

  return (
    <AdminLayout>
      <h1 className="font-serif text-3xl text-primary">Admin Overview</h1>
      <p className="mt-1 text-muted-foreground">Manage programs, courses, lessons, quizzes, and students.</p>

      <div className="mt-8 grid gap-6 sm:grid-cols-3">
        <Card className="p-6" data-testid="stat-programs">
          <BookOpen className="mb-3 h-7 w-7 text-primary" />
          <p className="font-serif text-4xl text-foreground">{stats?.programs ?? "—"}</p>
          <p className="text-sm text-muted-foreground">Programs</p>
        </Card>
        <Card className="p-6" data-testid="stat-students">
          <Users className="mb-3 h-7 w-7 text-primary" />
          <p className="font-serif text-4xl text-foreground">{stats?.students ?? "—"}</p>
          <p className="text-sm text-muted-foreground">Students</p>
        </Card>
        <Card className="p-6">
          <GraduationCap className="mb-3 h-7 w-7 text-primary" />
          <p className="font-serif text-4xl text-foreground">4</p>
          <p className="text-sm text-muted-foreground">Degree Levels</p>
        </Card>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/admin/programs"><Button data-testid="button-manage-programs">Manage Programs</Button></Link>
        <Link href="/admin/students"><Button variant="outline" data-testid="button-manage-students">View Students</Button></Link>
      </div>

      <Card className="mt-8 p-6">
        <h2 className="font-serif text-xl text-foreground">Getting Started</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>Open <strong>Programs</strong> and pick a degree to edit its description or tuition.</li>
          <li>Inside a program, add or edit <strong>courses</strong>.</li>
          <li>Inside a course, add <strong>lessons</strong> — upload a video/PDF or paste a YouTube/Vimeo link.</li>
          <li>Attach a <strong>quiz</strong> to any course and add multiple-choice questions.</li>
          <li>Students enroll, complete lessons, pass quizzes, and earn certificates automatically.</li>
        </ol>
      </Card>
    </AdminLayout>
  );
}
