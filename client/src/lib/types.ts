export type Program = {
  id: number; title: string; level: string; tuition: number; appFee: number;
  description: string; slug: string;
  totalCredits?: number; // Sum of creditHours across all courses (added by /api/programs)
};
export type Lesson = {
  id: number; courseId: number; title: string; type: string;
  contentUrl: string; contentText: string; position: number; durationMinutes: number;
};
export type Quiz = { id: number; courseId: number; title: string; passingScore: number };
export type Course = {
  id: number; programId: number; title: string; description: string; position: number;
  creditHours: number; courseCode?: string;
  lessons?: Lesson[]; quiz?: Quiz | null;
};
export type ProgramDetail = Program & {
  courses: (Course & { lessons: Lesson[]; quiz: Quiz | null })[];
  enrolled: boolean;
  progress: { total: number; done: number; percent: number } | null;
};
export type EnrollmentDetail = {
  id: number; userId: number; programId: number; enrolledAt: number; status: string;
  program: Program;
  progress: { total: number; done: number; percent: number };
  certificate: { publicId: string } | null;
};
export type QuizQuestion = {
  id: number; quizId: number; question: string; options: string[]; position: number; correctAnswer?: number;
};
export type QuizDetail = Quiz & { questions: QuizQuestion[]; course: Course };

export const LEVELS = ["Bachelor's", "Master's", "Doctoral", "Dual"] as const;

// Display labels for levels. The DB value stays as `LEVELS[i]`; UI shows this label.
// Keep DB value `"Dual"` unchanged so filter routing, enrollments, and seed data all still work.
export const LEVEL_LABELS: Record<string, string> = {
  "Bachelor's": "Bachelor's",
  "Master's": "Master's",
  "Doctoral": "Doctoral",
  "Dual": "Dual Degrees",
};

export function levelLabel(level: string): string {
  return LEVEL_LABELS[level] ?? level;
}

export function fmtTuition(n: number) {
  return `$${n.toLocaleString()}`;
}
