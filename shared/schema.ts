import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// USERS
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("student"), // student | admin
  createdAt: integer("created_at").notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  passwordHash: true,
  role: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// PROGRAMS
export const programs = sqliteTable("programs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  level: text("level").notNull(), // Bachelor's | Master's | Doctoral | Dual
  tuition: integer("tuition").notNull(),
  appFee: integer("app_fee").notNull().default(75),
  description: text("description").notNull(),
  slug: text("slug").notNull().unique(),
});
export const insertProgramSchema = createInsertSchema(programs).omit({ id: true });
export type InsertProgram = z.infer<typeof insertProgramSchema>;
export type Program = typeof programs.$inferSelect;

// COURSES
export const courses = sqliteTable("courses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  programId: integer("program_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  position: integer("position").notNull().default(0),
});
export const insertCourseSchema = createInsertSchema(courses).omit({ id: true });
export type InsertCourse = z.infer<typeof insertCourseSchema>;
export type Course = typeof courses.$inferSelect;

// LESSONS
export const lessons = sqliteTable("lessons", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  courseId: integer("course_id").notNull(),
  title: text("title").notNull(),
  type: text("type").notNull().default("text"), // video | pdf | text
  contentUrl: text("content_url").notNull().default(""),
  contentText: text("content_text").notNull().default(""),
  position: integer("position").notNull().default(0),
  durationMinutes: integer("duration_minutes").notNull().default(0),
});
export const insertLessonSchema = createInsertSchema(lessons).omit({ id: true });
export type InsertLesson = z.infer<typeof insertLessonSchema>;
export type Lesson = typeof lessons.$inferSelect;

// ENROLLMENTS
export const enrollments = sqliteTable("enrollments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  programId: integer("program_id").notNull(),
  enrolledAt: integer("enrolled_at").notNull(),
  status: text("status").notNull().default("active"), // active | pending
});
export const insertEnrollmentSchema = createInsertSchema(enrollments).omit({ id: true, enrolledAt: true });
export type InsertEnrollment = z.infer<typeof insertEnrollmentSchema>;
export type Enrollment = typeof enrollments.$inferSelect;

// LESSON PROGRESS
export const lessonProgress = sqliteTable("lesson_progress", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  lessonId: integer("lesson_id").notNull(),
  completedAt: integer("completed_at").notNull(),
});
export type LessonProgress = typeof lessonProgress.$inferSelect;

// QUIZZES
export const quizzes = sqliteTable("quizzes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  courseId: integer("course_id").notNull(),
  title: text("title").notNull(),
  passingScore: integer("passing_score").notNull().default(70),
});
export const insertQuizSchema = createInsertSchema(quizzes).omit({ id: true });
export type InsertQuiz = z.infer<typeof insertQuizSchema>;
export type Quiz = typeof quizzes.$inferSelect;

// QUIZ QUESTIONS
export const quizQuestions = sqliteTable("quiz_questions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  quizId: integer("quiz_id").notNull(),
  question: text("question").notNull(),
  options: text("options").notNull().default("[]"), // JSON array of strings
  correctAnswer: integer("correct_answer").notNull().default(0), // index into options
  position: integer("position").notNull().default(0),
});
export const insertQuizQuestionSchema = createInsertSchema(quizQuestions).omit({ id: true });
export type InsertQuizQuestion = z.infer<typeof insertQuizQuestionSchema>;
export type QuizQuestion = typeof quizQuestions.$inferSelect;

// QUIZ ATTEMPTS
export const quizAttempts = sqliteTable("quiz_attempts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  quizId: integer("quiz_id").notNull(),
  score: integer("score").notNull(),
  passed: integer("passed").notNull(), // 0 | 1
  attemptedAt: integer("attempted_at").notNull(),
});
export type QuizAttempt = typeof quizAttempts.$inferSelect;

// CERTIFICATES
export const certificates = sqliteTable("certificates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  programId: integer("program_id").notNull(),
  issuedAt: integer("issued_at").notNull(),
  publicId: text("public_id").notNull().unique(),
});
export type Certificate = typeof certificates.$inferSelect;

// Auth request schemas
export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
});
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// SETTINGS (single-row key/value for PayPal config etc.)
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull().default(""),
});
export type Setting = typeof settings.$inferSelect;

// PAYMENT PLANS attached to an enrollment
// planType: full | quarterly | monthly
// status: active | paused | completed | canceled
export const paymentPlans = sqliteTable("payment_plans", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  programId: integer("program_id").notNull(),
  enrollmentId: integer("enrollment_id").notNull(),
  planType: text("plan_type").notNull(), // full | quarterly | monthly
  totalCents: integer("total_cents").notNull(), // total tuition owed in cents
  paidCents: integer("paid_cents").notNull().default(0),
  installmentCents: integer("installment_cents").notNull(), // amount per installment
  totalInstallments: integer("total_installments").notNull().default(1),
  paidInstallments: integer("paid_installments").notNull().default(0),
  status: text("status").notNull().default("active"),
  paypalSubscriptionId: text("paypal_subscription_id").notNull().default(""),
  paypalPlanId: text("paypal_plan_id").notNull().default(""),
  paypalOrderId: text("paypal_order_id").notNull().default(""), // for full-pay orders
  nextBillingAt: integer("next_billing_at").notNull().default(0), // ms epoch, informational
  failureCount: integer("failure_count").notNull().default(0),
  createdAt: integer("created_at").notNull(),
});
export type PaymentPlan = typeof paymentPlans.$inferSelect;

// PAYMENT TRANSACTIONS — every charge (success or failure) is recorded
export const paymentTransactions = sqliteTable("payment_transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  planId: integer("plan_id").notNull(),
  userId: integer("user_id").notNull(),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("USD"),
  status: text("status").notNull(), // completed | failed | pending | refunded
  paypalCaptureId: text("paypal_capture_id").notNull().default(""),
  paypalOrderId: text("paypal_order_id").notNull().default(""),
  paypalSubscriptionId: text("paypal_subscription_id").notNull().default(""),
  eventType: text("event_type").notNull().default(""), // webhook event or checkout
  note: text("note").notNull().default(""),
  createdAt: integer("created_at").notNull(),
});
export type PaymentTransaction = typeof paymentTransactions.$inferSelect;

// Scholarships — grant students partial or full tuition discounts.
// discountType: 'percent' (0-100) or 'fixed' (cents off tuition). 100% percent = full ride.
// Application fee is separately waivable via waiveAppFee=1.
export const scholarships = sqliteTable("scholarships", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  programId: integer("program_id").notNull(),
  name: text("name").notNull().default(""),        // e.g. "Founder's Scholarship"
  discountType: text("discount_type").notNull(),    // 'percent' | 'fixed'
  discountValue: integer("discount_value").notNull(), // percent 0-100, or cents
  waiveAppFee: integer("waive_app_fee").notNull().default(0), // 0|1
  note: text("note").notNull().default(""),
  active: integer("active").notNull().default(1),
  createdAt: integer("created_at").notNull(),
  createdBy: integer("created_by").notNull().default(0), // admin user id
});
export type Scholarship = typeof scholarships.$inferSelect;
