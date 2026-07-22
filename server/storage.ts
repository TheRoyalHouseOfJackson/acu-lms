import {
  users, programs, courses, lessons, enrollments, lessonProgress,
  quizzes, quizQuestions, quizAttempts, certificates,
  settings, paymentPlans, paymentTransactions, scholarships,
} from "@shared/schema";
import type {
  User, InsertUser, Program, InsertProgram, Course, InsertCourse,
  Lesson, InsertLesson, Enrollment, LessonProgress, Quiz, InsertQuiz,
  QuizQuestion, InsertQuizQuestion, QuizAttempt, Certificate,
  Setting, PaymentPlan, PaymentTransaction, Scholarship,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, and, asc } from "drizzle-orm";

const dbPath = process.env.DB_PATH || "data-v2.db";
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
export const db = drizzle(sqlite);

// Ensure tables exist (lightweight migration on boot)
sqlite.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS programs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  level TEXT NOT NULL,
  tuition INTEGER NOT NULL,
  app_fee INTEGER NOT NULL DEFAULT 75,
  description TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  program_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS lessons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text',
  content_url TEXT NOT NULL DEFAULT '',
  content_text TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  duration_minutes INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS enrollments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  program_id INTEGER NOT NULL,
  enrolled_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
);
CREATE TABLE IF NOT EXISTS lesson_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  lesson_id INTEGER NOT NULL,
  completed_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS quizzes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  passing_score INTEGER NOT NULL DEFAULT 70
);
CREATE TABLE IF NOT EXISTS quiz_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quiz_id INTEGER NOT NULL,
  question TEXT NOT NULL,
  options TEXT NOT NULL DEFAULT '[]',
  correct_answer INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  quiz_id INTEGER NOT NULL,
  score INTEGER NOT NULL,
  passed INTEGER NOT NULL,
  attempted_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS certificates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  program_id INTEGER NOT NULL,
  issued_at INTEGER NOT NULL,
  public_id TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS payment_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  program_id INTEGER NOT NULL,
  enrollment_id INTEGER NOT NULL,
  plan_type TEXT NOT NULL,
  total_cents INTEGER NOT NULL,
  paid_cents INTEGER NOT NULL DEFAULT 0,
  installment_cents INTEGER NOT NULL,
  total_installments INTEGER NOT NULL DEFAULT 1,
  paid_installments INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  paypal_subscription_id TEXT NOT NULL DEFAULT '',
  paypal_plan_id TEXT NOT NULL DEFAULT '',
  paypal_order_id TEXT NOT NULL DEFAULT '',
  next_billing_at INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS payment_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL,
  paypal_capture_id TEXT NOT NULL DEFAULT '',
  paypal_order_id TEXT NOT NULL DEFAULT '',
  paypal_subscription_id TEXT NOT NULL DEFAULT '',
  event_type TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS scholarships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  program_id INTEGER NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  discount_type TEXT NOT NULL,
  discount_value INTEGER NOT NULL,
  waive_app_fee INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  created_by INTEGER NOT NULL DEFAULT 0
);
`);

// One-time migration: enforce official application fees per degree level.
// Idempotent — safe to run on every boot.
try {
  sqlite.exec(`
    UPDATE programs SET app_fee = 55 WHERE level = 'Bachelor''s' AND app_fee <> 55;
    UPDATE programs SET app_fee = 75 WHERE level = 'Master''s' AND app_fee <> 75;
    UPDATE programs SET app_fee = 95 WHERE level = 'Doctoral' AND app_fee <> 95;
    UPDATE programs SET app_fee = 95 WHERE level = 'Dual' AND app_fee <> 95;
  `);
} catch (err) {
  console.error("app-fee migration warning:", err);
}

export interface IStorage {
  // users
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(u: { email: string; passwordHash: string; name: string; role?: string }): Promise<User>;
  listStudents(): Promise<User[]>;
  // programs
  listPrograms(): Promise<Program[]>;
  getProgram(id: number): Promise<Program | undefined>;
  getProgramBySlug(slug: string): Promise<Program | undefined>;
  createProgram(p: InsertProgram): Promise<Program>;
  updateProgram(id: number, p: Partial<InsertProgram>): Promise<Program | undefined>;
  countPrograms(): Promise<number>;
  // courses
  listCoursesByProgram(programId: number): Promise<Course[]>;
  getCourse(id: number): Promise<Course | undefined>;
  createCourse(c: InsertCourse): Promise<Course>;
  updateCourse(id: number, c: Partial<InsertCourse>): Promise<Course | undefined>;
  deleteCourse(id: number): Promise<void>;
  // lessons
  listLessonsByCourse(courseId: number): Promise<Lesson[]>;
  getLesson(id: number): Promise<Lesson | undefined>;
  createLesson(l: InsertLesson): Promise<Lesson>;
  updateLesson(id: number, l: Partial<InsertLesson>): Promise<Lesson | undefined>;
  deleteLesson(id: number): Promise<void>;
  // enrollments
  listEnrollmentsByUser(userId: number): Promise<Enrollment[]>;
  listEnrollmentsByProgram(programId: number): Promise<Enrollment[]>;
  getEnrollment(userId: number, programId: number): Promise<Enrollment | undefined>;
  createEnrollment(userId: number, programId: number): Promise<Enrollment>;
  // progress
  listProgressByUser(userId: number): Promise<LessonProgress[]>;
  getProgress(userId: number, lessonId: number): Promise<LessonProgress | undefined>;
  markComplete(userId: number, lessonId: number): Promise<LessonProgress>;
  unmarkComplete(userId: number, lessonId: number): Promise<void>;
  // quizzes
  getQuizByCourse(courseId: number): Promise<Quiz | undefined>;
  getQuiz(id: number): Promise<Quiz | undefined>;
  createQuiz(q: InsertQuiz): Promise<Quiz>;
  listQuestions(quizId: number): Promise<QuizQuestion[]>;
  createQuestion(q: InsertQuizQuestion): Promise<QuizQuestion>;
  deleteQuestion(id: number): Promise<void>;
  recordAttempt(userId: number, quizId: number, score: number, passed: boolean): Promise<QuizAttempt>;
  listAttemptsByUser(userId: number): Promise<QuizAttempt[]>;
  // certificates
  getCertificate(publicId: string): Promise<Certificate | undefined>;
  getCertificateByUserProgram(userId: number, programId: number): Promise<Certificate | undefined>;
  createCertificate(userId: number, programId: number, publicId: string): Promise<Certificate>;
  listCertificatesByUser(userId: number): Promise<Certificate[]>;
  // settings
  getSetting(key: string): Promise<string>;
  setSetting(key: string, value: string): Promise<void>;
  listSettings(): Promise<Setting[]>;
  // payment plans
  createPaymentPlan(p: Omit<PaymentPlan, "id" | "createdAt">): Promise<PaymentPlan>;
  getPaymentPlan(id: number): Promise<PaymentPlan | undefined>;
  getPaymentPlanByEnrollment(enrollmentId: number): Promise<PaymentPlan | undefined>;
  getPaymentPlanBySubscriptionId(subId: string): Promise<PaymentPlan | undefined>;
  getPaymentPlanByOrderId(orderId: string): Promise<PaymentPlan | undefined>;
  updatePaymentPlan(id: number, patch: Partial<PaymentPlan>): Promise<PaymentPlan | undefined>;
  listPaymentPlansByUser(userId: number): Promise<PaymentPlan[]>;
  listAllPaymentPlans(): Promise<PaymentPlan[]>;
  // transactions
  recordTransaction(t: Omit<PaymentTransaction, "id" | "createdAt">): Promise<PaymentTransaction>;
  listTransactionsByPlan(planId: number): Promise<PaymentTransaction[]>;
  listTransactionsByUser(userId: number): Promise<PaymentTransaction[]>;
  listAllTransactions(): Promise<PaymentTransaction[]>;
  // scholarships
  createScholarship(s: Omit<Scholarship, "id" | "createdAt">): Promise<Scholarship>;
  getScholarship(id: number): Promise<Scholarship | undefined>;
  getActiveScholarship(userId: number, programId: number): Promise<Scholarship | undefined>;
  updateScholarship(id: number, patch: Partial<Scholarship>): Promise<Scholarship | undefined>;
  deleteScholarship(id: number): Promise<void>;
  listScholarshipsByUser(userId: number): Promise<Scholarship[]>;
  listAllScholarships(): Promise<Scholarship[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number) { return db.select().from(users).where(eq(users.id, id)).get(); }
  async getUserByEmail(email: string) { return db.select().from(users).where(eq(users.email, email)).get(); }
  async createUser(u: { email: string; passwordHash: string; name: string; role?: string }) {
    return db.insert(users).values({ ...u, role: u.role ?? "student", createdAt: Date.now() }).returning().get();
  }
  async listStudents() { return db.select().from(users).where(eq(users.role, "student")).all(); }

  async listPrograms() { return db.select().from(programs).all(); }
  async getProgram(id: number) { return db.select().from(programs).where(eq(programs.id, id)).get(); }
  async getProgramBySlug(slug: string) { return db.select().from(programs).where(eq(programs.slug, slug)).get(); }
  async createProgram(p: InsertProgram) { return db.insert(programs).values(p).returning().get(); }
  async updateProgram(id: number, p: Partial<InsertProgram>) {
    return db.update(programs).set(p).where(eq(programs.id, id)).returning().get();
  }
  async countPrograms() { return db.select().from(programs).all().length; }

  async listCoursesByProgram(programId: number) {
    return db.select().from(courses).where(eq(courses.programId, programId)).orderBy(asc(courses.position)).all();
  }
  async getCourse(id: number) { return db.select().from(courses).where(eq(courses.id, id)).get(); }
  async createCourse(c: InsertCourse) { return db.insert(courses).values(c).returning().get(); }
  async updateCourse(id: number, c: Partial<InsertCourse>) {
    return db.update(courses).set(c).where(eq(courses.id, id)).returning().get();
  }
  async deleteCourse(id: number) { db.delete(courses).where(eq(courses.id, id)).run(); }

  async listLessonsByCourse(courseId: number) {
    return db.select().from(lessons).where(eq(lessons.courseId, courseId)).orderBy(asc(lessons.position)).all();
  }
  async getLesson(id: number) { return db.select().from(lessons).where(eq(lessons.id, id)).get(); }
  async createLesson(l: InsertLesson) { return db.insert(lessons).values(l).returning().get(); }
  async updateLesson(id: number, l: Partial<InsertLesson>) {
    return db.update(lessons).set(l).where(eq(lessons.id, id)).returning().get();
  }
  async deleteLesson(id: number) { db.delete(lessons).where(eq(lessons.id, id)).run(); }

  async listEnrollmentsByUser(userId: number) {
    return db.select().from(enrollments).where(eq(enrollments.userId, userId)).all();
  }
  async listEnrollmentsByProgram(programId: number) {
    return db.select().from(enrollments).where(eq(enrollments.programId, programId)).all();
  }
  async getEnrollment(userId: number, programId: number) {
    return db.select().from(enrollments)
      .where(and(eq(enrollments.userId, userId), eq(enrollments.programId, programId))).get();
  }
  async createEnrollment(userId: number, programId: number) {
    return db.insert(enrollments).values({ userId, programId, status: "active", enrolledAt: Date.now() }).returning().get();
  }

  async listProgressByUser(userId: number) {
    return db.select().from(lessonProgress).where(eq(lessonProgress.userId, userId)).all();
  }
  async getProgress(userId: number, lessonId: number) {
    return db.select().from(lessonProgress)
      .where(and(eq(lessonProgress.userId, userId), eq(lessonProgress.lessonId, lessonId))).get();
  }
  async markComplete(userId: number, lessonId: number) {
    const existing = await this.getProgress(userId, lessonId);
    if (existing) return existing;
    return db.insert(lessonProgress).values({ userId, lessonId, completedAt: Date.now() }).returning().get();
  }
  async unmarkComplete(userId: number, lessonId: number) {
    db.delete(lessonProgress)
      .where(and(eq(lessonProgress.userId, userId), eq(lessonProgress.lessonId, lessonId))).run();
  }

  async getQuizByCourse(courseId: number) {
    return db.select().from(quizzes).where(eq(quizzes.courseId, courseId)).get();
  }
  async getQuiz(id: number) { return db.select().from(quizzes).where(eq(quizzes.id, id)).get(); }
  async createQuiz(q: InsertQuiz) { return db.insert(quizzes).values(q).returning().get(); }
  async listQuestions(quizId: number) {
    return db.select().from(quizQuestions).where(eq(quizQuestions.quizId, quizId)).orderBy(asc(quizQuestions.position)).all();
  }
  async createQuestion(q: InsertQuizQuestion) { return db.insert(quizQuestions).values(q).returning().get(); }
  async deleteQuestion(id: number) { db.delete(quizQuestions).where(eq(quizQuestions.id, id)).run(); }
  async recordAttempt(userId: number, quizId: number, score: number, passed: boolean) {
    return db.insert(quizAttempts).values({ userId, quizId, score, passed: passed ? 1 : 0, attemptedAt: Date.now() }).returning().get();
  }
  async listAttemptsByUser(userId: number) {
    return db.select().from(quizAttempts).where(eq(quizAttempts.userId, userId)).all();
  }

  async getCertificate(publicId: string) {
    return db.select().from(certificates).where(eq(certificates.publicId, publicId)).get();
  }
  async getCertificateByUserProgram(userId: number, programId: number) {
    return db.select().from(certificates)
      .where(and(eq(certificates.userId, userId), eq(certificates.programId, programId))).get();
  }
  async createCertificate(userId: number, programId: number, publicId: string) {
    return db.insert(certificates).values({ userId, programId, publicId, issuedAt: Date.now() }).returning().get();
  }
  async listCertificatesByUser(userId: number) {
    return db.select().from(certificates).where(eq(certificates.userId, userId)).all();
  }

  // ---------- SETTINGS ----------
  async getSetting(key: string): Promise<string> {
    const row = db.select().from(settings).where(eq(settings.key, key)).get();
    return row?.value ?? "";
  }
  async setSetting(key: string, value: string): Promise<void> {
    const existing = db.select().from(settings).where(eq(settings.key, key)).get();
    if (existing) {
      db.update(settings).set({ value }).where(eq(settings.key, key)).run();
    } else {
      db.insert(settings).values({ key, value }).run();
    }
  }
  async listSettings(): Promise<Setting[]> {
    return db.select().from(settings).all();
  }

  // ---------- PAYMENT PLANS ----------
  async createPaymentPlan(p: Omit<PaymentPlan, "id" | "createdAt">): Promise<PaymentPlan> {
    return db.insert(paymentPlans).values({ ...p, createdAt: Date.now() }).returning().get();
  }
  async getPaymentPlan(id: number): Promise<PaymentPlan | undefined> {
    return db.select().from(paymentPlans).where(eq(paymentPlans.id, id)).get();
  }
  async getPaymentPlanByEnrollment(enrollmentId: number): Promise<PaymentPlan | undefined> {
    return db.select().from(paymentPlans).where(eq(paymentPlans.enrollmentId, enrollmentId)).get();
  }
  async getPaymentPlanBySubscriptionId(subId: string): Promise<PaymentPlan | undefined> {
    return db.select().from(paymentPlans).where(eq(paymentPlans.paypalSubscriptionId, subId)).get();
  }
  async getPaymentPlanByOrderId(orderId: string): Promise<PaymentPlan | undefined> {
    return db.select().from(paymentPlans).where(eq(paymentPlans.paypalOrderId, orderId)).get();
  }
  async updatePaymentPlan(id: number, patch: Partial<PaymentPlan>): Promise<PaymentPlan | undefined> {
    return db.update(paymentPlans).set(patch).where(eq(paymentPlans.id, id)).returning().get();
  }
  async listPaymentPlansByUser(userId: number): Promise<PaymentPlan[]> {
    return db.select().from(paymentPlans).where(eq(paymentPlans.userId, userId)).all();
  }
  async listAllPaymentPlans(): Promise<PaymentPlan[]> {
    return db.select().from(paymentPlans).all();
  }

  // ---------- PAYMENT TRANSACTIONS ----------
  async recordTransaction(t: Omit<PaymentTransaction, "id" | "createdAt">): Promise<PaymentTransaction> {
    return db.insert(paymentTransactions).values({ ...t, createdAt: Date.now() }).returning().get();
  }
  async listTransactionsByPlan(planId: number): Promise<PaymentTransaction[]> {
    return db.select().from(paymentTransactions).where(eq(paymentTransactions.planId, planId)).orderBy(asc(paymentTransactions.createdAt)).all();
  }
  async listTransactionsByUser(userId: number): Promise<PaymentTransaction[]> {
    return db.select().from(paymentTransactions).where(eq(paymentTransactions.userId, userId)).orderBy(asc(paymentTransactions.createdAt)).all();
  }
  async listAllTransactions(): Promise<PaymentTransaction[]> {
    return db.select().from(paymentTransactions).orderBy(asc(paymentTransactions.createdAt)).all();
  }

  // ---------- SCHOLARSHIPS ----------
  async createScholarship(s: Omit<Scholarship, "id" | "createdAt">): Promise<Scholarship> {
    return db.insert(scholarships).values({ ...s, createdAt: Date.now() }).returning().get();
  }
  async getScholarship(id: number) {
    return db.select().from(scholarships).where(eq(scholarships.id, id)).get();
  }
  async getActiveScholarship(userId: number, programId: number) {
    return db.select().from(scholarships).where(
      and(eq(scholarships.userId, userId), eq(scholarships.programId, programId), eq(scholarships.active, 1))
    ).get();
  }
  async updateScholarship(id: number, patch: Partial<Scholarship>) {
    return db.update(scholarships).set(patch).where(eq(scholarships.id, id)).returning().get();
  }
  async deleteScholarship(id: number): Promise<void> {
    db.delete(scholarships).where(eq(scholarships.id, id)).run();
  }
  async listScholarshipsByUser(userId: number): Promise<Scholarship[]> {
    return db.select().from(scholarships).where(eq(scholarships.userId, userId)).all();
  }
  async listAllScholarships(): Promise<Scholarship[]> {
    return db.select().from(scholarships).orderBy(asc(scholarships.createdAt)).all();
  }
}

export const storage = new DatabaseStorage();
