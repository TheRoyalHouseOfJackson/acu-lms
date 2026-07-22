import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "node:http";
import express from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { storage } from "./storage";
import { seed } from "./seed";
import { signupSchema, loginSchema } from "@shared/schema";
import { registerPaymentRoutes, enrollmentHasAccess } from "./paymentRoutes";

const MemoryStore = createMemoryStore(session);

const UPLOAD_DIR = path.resolve(process.cwd(), "server", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      const base = path.basename(file.originalname, ext).replace(/[^a-z0-9]+/gi, "-").slice(0, 40);
      cb(null, `${Date.now()}-${base}${ext}`);
    },
  }),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
});

declare module "express-session" {
  interface SessionData {
    userId?: number;
    role?: string;
  }
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  next();
}
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId || req.session.role !== "admin")
    return res.status(403).json({ message: "Admin access required" });
  next();
}

function publicUser(u: { id: number; email: string; name: string; role: string }) {
  return { id: u.id, email: u.email, name: u.name, role: u.role };
}

// Compute program progress for a user
async function programProgress(userId: number, programId: number) {
  const courses = await storage.listCoursesByProgram(programId);
  let total = 0;
  let done = 0;
  const progress = await storage.listProgressByUser(userId);
  const doneSet = new Set(progress.map((p) => p.lessonId));
  for (const c of courses) {
    const lessons = await storage.listLessonsByCourse(c.id);
    total += lessons.length;
    for (const l of lessons) if (doneSet.has(l.id)) done++;
  }
  return { total, done, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  await seed();

  // Cookie name must use __Host- prefix to survive the pplx.app proxy.
  // In dev (http://localhost) __Host- also requires secure=true, so we
  // fall back to a plain cookie name for local development.
  const isProd = process.env.NODE_ENV === "production";
  app.set("trust proxy", 1);
  app.use(session({
    name: isProd ? "__Host-acu-sid" : "acu-sid",
    secret: process.env.SESSION_SECRET || "acu-lms-secret-key-change-me",
    resave: false,
    saveUninitialized: false,
    store: new MemoryStore({ checkPeriod: 86400000 }),
    cookie: {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: "lax",
      secure: isProd,
      path: "/",
    },
  }));

  // Serve uploaded files
  app.use("/uploads", express.static(UPLOAD_DIR));

  // ---------- AUTH ----------
  app.post("/api/auth/signup", async (req, res) => {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid input" });
    const { email, password, name } = parsed.data;
    if (await storage.getUserByEmail(email)) return res.status(409).json({ message: "Email already registered" });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await storage.createUser({ email, passwordHash, name, role: "student" });
    req.session.userId = user.id;
    req.session.role = user.role;
    res.json(publicUser(user));
  });

  app.post("/api/auth/login", async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid input" });
    const user = await storage.getUserByEmail(parsed.data.email);
    if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash)))
      return res.status(401).json({ message: "Invalid email or password" });
    req.session.userId = user.id;
    req.session.role = user.role;
    res.json(publicUser(user));
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(req.session.userId);
    if (!user) return res.status(401).json({ message: "Not authenticated" });
    res.json(publicUser(user));
  });

  // ---------- PROGRAMS ----------
  app.get("/api/programs", async (_req, res) => {
    res.json(await storage.listPrograms());
  });

  app.get("/api/programs/:slug", async (req, res) => {
    const program = await storage.getProgramBySlug(req.params.slug);
    if (!program) return res.status(404).json({ message: "Program not found" });
    const courses = await storage.listCoursesByProgram(program.id);
    const coursesWithLessons = await Promise.all(courses.map(async (c) => ({
      ...c,
      lessons: await storage.listLessonsByCourse(c.id),
      quiz: await storage.getQuizByCourse(c.id),
    })));
    let enrolled = false;
    let progress = null;
    if (req.session.userId) {
      enrolled = !!(await storage.getEnrollment(req.session.userId, program.id));
      if (enrolled) progress = await programProgress(req.session.userId, program.id);
    }
    res.json({ ...program, courses: coursesWithLessons, enrolled, progress });
  });

  app.patch("/api/programs/:id", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const { description, tuition, appFee, title } = req.body;
    const updated = await storage.updateProgram(id, { description, tuition, appFee, title });
    if (!updated) return res.status(404).json({ message: "Program not found" });
    res.json(updated);
  });

  // ---------- COURSES ----------
  app.post("/api/courses", requireAdmin, async (req, res) => {
    const { programId, title, description, position } = req.body;
    const course = await storage.createCourse({ programId: Number(programId), title, description: description ?? "", position: position ?? 0 });
    res.json(course);
  });
  app.get("/api/courses/:id", async (req, res) => {
    const course = await storage.getCourse(Number(req.params.id));
    if (!course) return res.status(404).json({ message: "Course not found" });
    const lessons = await storage.listLessonsByCourse(course.id);
    const quiz = await storage.getQuizByCourse(course.id);
    const program = await storage.getProgram(course.programId);
    res.json({ ...course, lessons, quiz, program });
  });
  app.patch("/api/courses/:id", requireAdmin, async (req, res) => {
    const { title, description, position } = req.body;
    const patch: Record<string, unknown> = {};
    if (title !== undefined) patch.title = title;
    if (description !== undefined) patch.description = description;
    if (position !== undefined) patch.position = position;
    if (Object.keys(patch).length === 0) return res.status(400).json({ message: "No valid fields to update" });
    const updated = await storage.updateCourse(Number(req.params.id), patch);
    res.json(updated);
  });
  app.delete("/api/courses/:id", requireAdmin, async (req, res) => {
    await storage.deleteCourse(Number(req.params.id));
    res.json({ ok: true });
  });

  // ---------- LESSONS ----------
  app.post("/api/lessons", requireAdmin, async (req, res) => {
    const { courseId, title, type, contentUrl, contentText, position, durationMinutes } = req.body;
    const lesson = await storage.createLesson({
      courseId: Number(courseId), title, type: type ?? "text",
      contentUrl: contentUrl ?? "", contentText: contentText ?? "",
      position: position ?? 0, durationMinutes: durationMinutes ?? 0,
    });
    res.json(lesson);
  });
  app.get("/api/lessons/:id", async (req, res) => {
    const lesson = await storage.getLesson(Number(req.params.id));
    if (!lesson) return res.status(404).json({ message: "Lesson not found" });
    const course = await storage.getCourse(lesson.courseId);
    let completed = false;
    // Enforce payment-plan status: if student's plan is paused, block content but return metadata
    if (req.session.userId && course && req.session.role !== "admin") {
      const hasAccess = await enrollmentHasAccess(req.session.userId, course.programId);
      if (!hasAccess) {
        return res.status(402).json({
          message: "Access paused due to payment issue. Please update your payment method to resume.",
          paused: true,
          programId: course.programId,
        });
      }
    }
    if (req.session.userId) completed = !!(await storage.getProgress(req.session.userId, lesson.id));
    res.json({ ...lesson, course, completed });
  });
  app.patch("/api/lessons/:id", requireAdmin, async (req, res) => {
    const { title, type, contentUrl, contentText, position, durationMinutes } = req.body;
    const patch: Record<string, unknown> = {};
    if (title !== undefined) patch.title = title;
    if (type !== undefined) patch.type = type;
    if (contentUrl !== undefined) patch.contentUrl = contentUrl;
    if (contentText !== undefined) patch.contentText = contentText;
    if (position !== undefined) patch.position = position;
    if (durationMinutes !== undefined) patch.durationMinutes = durationMinutes;
    if (Object.keys(patch).length === 0) return res.status(400).json({ message: "No valid fields to update" });
    const updated = await storage.updateLesson(Number(req.params.id), patch);
    res.json(updated);
  });
  app.delete("/api/lessons/:id", requireAdmin, async (req, res) => {
    await storage.deleteLesson(Number(req.params.id));
    res.json({ ok: true });
  });

  // ---------- FILE UPLOAD ----------
  app.post("/api/upload", requireAdmin, upload.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    res.json({ url: `/uploads/${req.file.filename}`, filename: req.file.filename });
  });

  // ---------- ENROLLMENTS ----------
  app.post("/api/enrollments", requireAuth, async (req, res) => {
    const programId = Number(req.body.programId);
    const program = await storage.getProgram(programId);
    if (!program) return res.status(404).json({ message: "Program not found" });
    const existing = await storage.getEnrollment(req.session.userId!, programId);
    if (existing) return res.json(existing);
    const enrollment = await storage.createEnrollment(req.session.userId!, programId);
    res.json(enrollment);
  });

  app.get("/api/enrollments/me", requireAuth, async (req, res) => {
    const enrollments = await storage.listEnrollmentsByUser(req.session.userId!);
    const detailed = await Promise.all(enrollments.map(async (e) => {
      const program = await storage.getProgram(e.programId);
      const progress = await programProgress(req.session.userId!, e.programId);
      const cert = await storage.getCertificateByUserProgram(req.session.userId!, e.programId);
      return { ...e, program, progress, certificate: cert ?? null };
    }));
    res.json(detailed);
  });

  // ---------- PROGRESS ----------
  app.post("/api/progress/complete", requireAuth, async (req, res) => {
    const lessonId = Number(req.body.lessonId);
    await storage.markComplete(req.session.userId!, lessonId);
    // Check if program now complete -> issue certificate
    const lesson = await storage.getLesson(lessonId);
    let certificate = null;
    if (lesson) {
      const course = await storage.getCourse(lesson.courseId);
      if (course) {
        const prog = await programProgress(req.session.userId!, course.programId);
        if (prog.total > 0 && prog.done === prog.total) {
          let cert = await storage.getCertificateByUserProgram(req.session.userId!, course.programId);
          if (!cert) cert = await storage.createCertificate(req.session.userId!, course.programId, randomUUID().slice(0, 12));
          certificate = cert;
        }
      }
    }
    res.json({ ok: true, certificate });
  });

  app.post("/api/progress/uncomplete", requireAuth, async (req, res) => {
    await storage.unmarkComplete(req.session.userId!, Number(req.body.lessonId));
    res.json({ ok: true });
  });

  app.get("/api/progress/me", requireAuth, async (req, res) => {
    res.json(await storage.listProgressByUser(req.session.userId!));
  });

  // ---------- QUIZZES ----------
  app.get("/api/quizzes/:id", async (req, res) => {
    const quiz = await storage.getQuiz(Number(req.params.id));
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });
    const questions = await storage.listQuestions(quiz.id);
    const isAdmin = req.session.role === "admin";
    // For students, hide the correct answer
    const shaped = questions.map((q) => ({
      id: q.id, quizId: q.quizId, question: q.question,
      options: JSON.parse(q.options), position: q.position,
      ...(isAdmin ? { correctAnswer: q.correctAnswer } : {}),
    }));
    const course = await storage.getCourse(quiz.courseId);
    res.json({ ...quiz, questions: shaped, course });
  });

  app.post("/api/quizzes", requireAdmin, async (req, res) => {
    const { courseId, title, passingScore } = req.body;
    const quiz = await storage.createQuiz({ courseId: Number(courseId), title, passingScore: passingScore ?? 70 });
    res.json(quiz);
  });

  app.post("/api/quizzes/:id/questions", requireAdmin, async (req, res) => {
    const { question, options, correctAnswer, position } = req.body;
    const q = await storage.createQuestion({
      quizId: Number(req.params.id), question,
      options: JSON.stringify(options), correctAnswer: Number(correctAnswer), position: position ?? 0,
    });
    res.json(q);
  });

  app.delete("/api/questions/:id", requireAdmin, async (req, res) => {
    await storage.deleteQuestion(Number(req.params.id));
    res.json({ ok: true });
  });

  app.post("/api/quizzes/:id/attempt", requireAuth, async (req, res) => {
    const quiz = await storage.getQuiz(Number(req.params.id));
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });
    const questions = await storage.listQuestions(quiz.id);
    const answers: Record<string, number> = req.body.answers || {};
    let correct = 0;
    for (const q of questions) if (answers[String(q.id)] === q.correctAnswer) correct++;
    const score = questions.length === 0 ? 0 : Math.round((correct / questions.length) * 100);
    const passed = score >= quiz.passingScore;
    await storage.recordAttempt(req.session.userId!, quiz.id, score, passed);
    res.json({ score, passed, correct, total: questions.length, passingScore: quiz.passingScore });
  });

  // ---------- CERTIFICATES ----------
  app.get("/api/certificates/:publicId", async (req, res) => {
    const cert = await storage.getCertificate(req.params.publicId);
    if (!cert) return res.status(404).json({ message: "Certificate not found" });
    const user = await storage.getUser(cert.userId);
    const program = await storage.getProgram(cert.programId);
    res.json({
      publicId: cert.publicId,
      issuedAt: cert.issuedAt,
      studentName: user?.name ?? "Student",
      programTitle: program?.title ?? "Program",
      programLevel: program?.level ?? "",
    });
  });

  // ---------- ADMIN: STUDENTS ----------
  app.get("/api/admin/students", requireAdmin, async (_req, res) => {
    const students = await storage.listStudents();
    const detailed = await Promise.all(students.map(async (s) => {
      const enrollments = await storage.listEnrollmentsByUser(s.id);
      const progs = await Promise.all(enrollments.map(async (e) => {
        const program = await storage.getProgram(e.programId);
        const progress = await programProgress(s.id, e.programId);
        return { programTitle: program?.title ?? "", progress };
      }));
      return { id: s.id, name: s.name, email: s.email, enrollments: progs };
    }));
    res.json(detailed);
  });

  // ---------- ADMIN: STATS ----------
  app.get("/api/admin/stats", requireAdmin, async (_req, res) => {
    const programs = await storage.listPrograms();
    const students = await storage.listStudents();
    res.json({ programs: programs.length, students: students.length });
  });

  // Register payment routes (PayPal + subscription management)
  registerPaymentRoutes(app);

  return httpServer;
}
