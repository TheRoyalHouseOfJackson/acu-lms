import { useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { SiteLayout } from "@/components/SiteLayout";
import { useAuth } from "@/lib/auth";
import type { ProgramDetail } from "@/lib/types";
import type { LessonProgress } from "@shared/schema";

export default function ProgramLearn() {
  const [, params] = useRoute("/programs/:slug/learn");
  const slug = params?.slug;
  const [, navigate] = useLocation();
  const { user, isLoading: authLoading } = useAuth();

  const { data: program } = useQuery<ProgramDetail>({ queryKey: ["/api/programs", slug], enabled: !!slug });
  const { data: progress } = useQuery<LessonProgress[]>({ queryKey: ["/api/progress/me"], enabled: !!user });

  useEffect(() => {
    if (!authLoading && !user) { navigate("/login"); return; }
    if (!program) return;
    const done = new Set((progress ?? []).map((p) => p.lessonId));
    const allLessons = program.courses.flatMap((c) => c.lessons);
    if (allLessons.length === 0) { navigate(`/programs/${slug}`); return; }
    const next = allLessons.find((l) => !done.has(l.id)) ?? allLessons[0];
    navigate(`/programs/${slug}/courses/${next.courseId}/lessons/${next.id}`, { replace: true });
  }, [program, progress, authLoading, user, slug, navigate]);

  return <SiteLayout><div className="mx-auto max-w-3xl px-4 py-24 text-center text-muted-foreground">Loading your program…</div></SiteLayout>;
}
