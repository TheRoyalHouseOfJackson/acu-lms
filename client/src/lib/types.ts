export type Program = {
  id: number; title: string; level: string; tuition: number; appFee: number;
  description: string; slug: string;
};
export type Lesson = {
  id: number; courseId: number; title: string; type: string;
  contentUrl: string; contentText: string; position: number; durationMinutes: number;
};
export type Quiz = { id: number; courseId: number; title: string; passingScore: number };
export type Course = {
  id: number; programId: number; title: string; description: string; position: number;
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

export function fmtTuition(n: number) {
  return `$${n.toLocaleString()}`;
}
