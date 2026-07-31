// TRANSCRIPT SERVICE
// Grades, GPA calc, and PDF rendering for official ACU transcripts.
// Grade scale: A: 93-100 (4.0), A-: 90-92 (3.7), B+: 87-89 (3.3), B: 83-86 (3.0),
//              B-: 80-82 (2.7), C+: 77-79 (2.3), C: 73-76 (2.0), C-: 70-72 (1.7),
//              F: below 70 (0.0). Passing threshold aligns with the 70% quiz-pass rate.

import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { storage } from "./storage";
import type { Program, Course, Quiz, QuizAttempt, Certificate } from "@shared/schema";

// ---------- Grade & GPA ----------

export interface GradeInfo {
  letter: string;
  gpa: number; // quality points per credit
}

export function scoreToGrade(score: number): GradeInfo {
  if (score >= 93) return { letter: "A", gpa: 4.0 };
  if (score >= 90) return { letter: "A-", gpa: 3.7 };
  if (score >= 87) return { letter: "B+", gpa: 3.3 };
  if (score >= 83) return { letter: "B", gpa: 3.0 };
  if (score >= 80) return { letter: "B-", gpa: 2.7 };
  if (score >= 77) return { letter: "C+", gpa: 2.3 };
  if (score >= 73) return { letter: "C", gpa: 2.0 };
  if (score >= 70) return { letter: "C-", gpa: 1.7 };
  return { letter: "F", gpa: 0.0 };
}

// ---------- Transcript assembly ----------

export interface TranscriptCourseRow {
  courseCode: string;
  title: string;
  creditHours: number;
  completedAt: number | null;       // ms epoch, null if in progress
  score: number | null;             // best quiz score, or null if no quiz attempt
  grade: string;                    // letter grade, or "IP" (in progress), "NA" (no quiz), "AC" (audit / complete no quiz)
  qualityPoints: number;            // credits * gpa, 0 for IP/NA/AC
  countInGpa: boolean;              // false for IP/NA/AC
}

export interface TranscriptProgramSection {
  program: Program;
  courses: TranscriptCourseRow[];
  enrolledAt: number;
  certificateIssuedAt: number | null;
  attemptedCredits: number;
  earnedCredits: number;
  qualityPoints: number;
  gpa: number;
}

export interface TranscriptData {
  student: {
    id: number;
    name: string;                    // display name
    legalName: string;               // for official transcript header
    email: string;
    studentIdNumber: string;
    dateOfBirth: string;
    joinedAt: number;
  };
  programs: TranscriptProgramSection[];
  cumulative: {
    attemptedCredits: number;
    earnedCredits: number;
    qualityPoints: number;
    gpa: number;
  };
  issuedAt: number;
  publicId: string;
  verifyUrl: string;                 // public verification URL
}

/**
 * Build a full transcript data object for a user, spanning all enrolled programs.
 * Uses each course's best quiz score to determine grade; courses without quiz attempts
 * that are still fully lesson-complete are marked "AC" (Academic Credit, ungraded) and
 * excluded from GPA.
 */
export async function buildTranscript(userId: number, opts?: { publicId?: string; verifyBaseUrl?: string }): Promise<TranscriptData> {
  const user = await storage.getUser(userId);
  if (!user) throw new Error("User not found");
  const profile = await storage.getStudentProfile(userId);

  const enrollments = await storage.listEnrollmentsByUser(userId);
  const allAttempts = await storage.listAttemptsByUser(userId);
  const allProgress = await storage.listProgressByUser(userId);
  const progressSet = new Set(allProgress.map((p) => p.lessonId));

  // Best score per quiz
  const bestScoreByQuiz = new Map<number, QuizAttempt>();
  for (const a of allAttempts) {
    const existing = bestScoreByQuiz.get(a.quizId);
    if (!existing || a.score > existing.score) bestScoreByQuiz.set(a.quizId, a);
  }

  const programSections: TranscriptProgramSection[] = [];

  let cumulativeAttempted = 0;
  let cumulativeEarned = 0;
  let cumulativeQP = 0;

  for (const enr of enrollments) {
    const program = await storage.getProgram(enr.programId);
    if (!program) continue;
    const courses: Course[] = await storage.listCoursesByProgram(program.id);
    const cert: Certificate | undefined = await storage.getCertificateByUserProgram(userId, program.id);

    const rows: TranscriptCourseRow[] = [];
    let progAttempted = 0;
    let progEarned = 0;
    let progQP = 0;

    for (const c of courses) {
      const lessons = await storage.listLessonsByCourse(c.id);
      const allLessonsDone = lessons.length > 0 && lessons.every((l) => progressSet.has(l.id));
      const quiz = await storage.getQuizByCourse(c.id);
      const attempt = quiz ? bestScoreByQuiz.get(quiz.id) : undefined;

      let grade = "IP";
      let score: number | null = null;
      let qp = 0;
      let countInGpa = false;
      let completedAt: number | null = null;

      if (attempt) {
        score = attempt.score;
        const g = scoreToGrade(attempt.score);
        grade = g.letter;
        qp = g.gpa * c.creditHours;
        countInGpa = true;
        completedAt = attempt.attemptedAt;
      } else if (allLessonsDone) {
        // Coursework complete but no quiz attempt on record — ungraded academic credit
        grade = "AC";
        countInGpa = false;
        // approximate completion time as latest lesson completion
        const times = lessons.map((l) => allProgress.find((p) => p.lessonId === l.id)?.completedAt ?? 0);
        completedAt = times.length ? Math.max(...times) : null;
      } else {
        grade = "IP";
      }

      const row: TranscriptCourseRow = {
        courseCode: c.courseCode || `ACU-${String(c.id).padStart(4, "0")}`,
        title: c.title,
        creditHours: c.creditHours,
        completedAt,
        score,
        grade,
        qualityPoints: qp,
        countInGpa,
      };
      rows.push(row);

      if (countInGpa) {
        progAttempted += c.creditHours;
        progQP += qp;
        // "F" (score < 70) is attempted-but-not-earned
        if (grade !== "F") progEarned += c.creditHours;
      }
    }

    const progGpa = progAttempted > 0 ? progQP / progAttempted : 0;

    programSections.push({
      program,
      courses: rows,
      enrolledAt: enr.enrolledAt,
      certificateIssuedAt: cert ? cert.issuedAt : null,
      attemptedCredits: progAttempted,
      earnedCredits: progEarned,
      qualityPoints: progQP,
      gpa: progGpa,
    });

    cumulativeAttempted += progAttempted;
    cumulativeEarned += progEarned;
    cumulativeQP += progQP;
  }

  const cumulativeGpa = cumulativeAttempted > 0 ? cumulativeQP / cumulativeAttempted : 0;

  const publicId = opts?.publicId || cryptoRandomId();
  const base = opts?.verifyBaseUrl || process.env.PUBLIC_BASE_URL || "https://ambassadorscu.org";

  return {
    student: {
      id: user.id,
      name: user.name,
      legalName: profile?.legalName || user.name,
      email: user.email,
      studentIdNumber: profile?.studentIdNumber || defaultStudentId(user.id, user.createdAt),
      dateOfBirth: profile?.dateOfBirth || "",
      joinedAt: user.createdAt,
    },
    programs: programSections,
    cumulative: {
      attemptedCredits: cumulativeAttempted,
      earnedCredits: cumulativeEarned,
      qualityPoints: cumulativeQP,
      gpa: cumulativeGpa,
    },
    issuedAt: Date.now(),
    publicId,
    verifyUrl: `${base}/#/transcript/${publicId}`,
  };
}

function cryptoRandomId(): string {
  return crypto.randomBytes(12).toString("hex");
}

function defaultStudentId(userId: number, createdAt: number): string {
  const year = new Date(createdAt).getFullYear();
  return `ACU-${year}-${String(userId).padStart(4, "0")}`;
}

// ---------- PDF rendering ----------

const CREST_PATH = path.join(process.cwd(), "attached_assets", "acu-crest.png");
// Colors match the site theme
const COLOR_PRIMARY = "#7A1F2B";      // deep burgundy
const COLOR_INK = "#2A2118";
const COLOR_MUTED = "#6E6B66";
const COLOR_RULE = "#C7C2B6";
const COLOR_WATERMARK = "#EAE6DE";

function formatDate(ms: number | null | undefined): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

/**
 * Render the transcript to a PDF, streaming to the supplied writable.
 */
export function renderTranscriptPDF(data: TranscriptData, writable: NodeJS.WritableStream): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "LETTER",
        margins: { top: 54, bottom: 60, left: 54, right: 54 },
        bufferPages: true,
        info: {
          Title: `Official Academic Transcript — ${data.student.legalName}`,
          Author: "Ambassadors Christian University",
          Subject: "Academic Transcript",
          CreationDate: new Date(data.issuedAt),
        },
      });
      doc.pipe(writable);
      writable.on("finish", () => resolve());
      writable.on("error", (e) => reject(e));

      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const leftX = doc.page.margins.left;

      // ----- Watermark (large, faint crest) -----
      const drawWatermark = () => {
        if (!fs.existsSync(CREST_PATH)) return;
        try {
          doc.save();
          doc.opacity(0.06);
          const wmSize = 380;
          doc.image(CREST_PATH, (doc.page.width - wmSize) / 2, (doc.page.height - wmSize) / 2, {
            width: wmSize,
            height: wmSize,
          });
          doc.opacity(1);
          doc.restore();
        } catch {
          // If image fails, just skip the watermark; the header crest still gives brand.
        }
      };

      // ----- Page footer (drawn on every page) -----
      const drawFooter = (pageNum: number, totalPages: number) => {
        const y = doc.page.height - 42;
        doc.save();
        doc.fillColor(COLOR_MUTED).fontSize(8).font("Helvetica");
        doc.text("Ambassadors Christian University · Baton Rouge, Louisiana", leftX, y, {
          width: pageWidth / 2,
          align: "left",
        });
        doc.text(`Page ${pageNum} of ${totalPages}`, leftX + pageWidth / 2, y, {
          width: pageWidth / 2,
          align: "right",
        });
        doc.text(`Verify: ${data.verifyUrl}`, leftX, y + 11, {
          width: pageWidth,
          align: "center",
        });
        doc.restore();
      };

      // ----- Header (drawn on every page) -----
      const drawHeader = () => {
        const startY = doc.page.margins.top - 14;
        // Crest at left
        if (fs.existsSync(CREST_PATH)) {
          try {
            doc.image(CREST_PATH, leftX, startY, { width: 56, height: 56 });
          } catch { /* ignore */ }
        }
        // University title block
        const textX = leftX + 72;
        doc.fillColor(COLOR_PRIMARY).font("Times-Bold").fontSize(18).text("Ambassadors Christian University", textX, startY);
        doc.fillColor(COLOR_MUTED).font("Times-Italic").fontSize(9)
          .text("Office of the Registrar · Baton Rouge, Louisiana", textX, startY + 22);
        doc.fillColor(COLOR_INK).font("Times-Bold").fontSize(11).text("OFFICIAL ACADEMIC TRANSCRIPT", textX, startY + 36);
        // Rule
        doc.moveTo(leftX, startY + 62).lineTo(leftX + pageWidth, startY + 62).lineWidth(0.75).strokeColor(COLOR_RULE).stroke();
        doc.y = startY + 72;
      };

      // Draw watermark + header for page 1
      drawWatermark();
      drawHeader();

      // Register page-added listener for pages 2+
      doc.on("pageAdded", () => {
        drawWatermark();
        drawHeader();
      });

      // ----- Student info block -----
      const rightColX = leftX + pageWidth / 2 + 10;
      const infoStartY = doc.y;
      const drawInfoLine = (label: string, value: string, x: number, y: number) => {
        doc.fillColor(COLOR_MUTED).font("Helvetica").fontSize(8.5).text(label.toUpperCase(), x, y, { characterSpacing: 0.5 });
        doc.fillColor(COLOR_INK).font("Helvetica-Bold").fontSize(11).text(value || "—", x, y + 11);
      };
      drawInfoLine("Student Name", data.student.legalName, leftX, infoStartY);
      drawInfoLine("Student ID", data.student.studentIdNumber, rightColX, infoStartY);
      drawInfoLine("Email", data.student.email, leftX, infoStartY + 32);
      drawInfoLine("Date of Enrollment", formatDate(data.student.joinedAt), rightColX, infoStartY + 32);
      if (data.student.dateOfBirth) {
        drawInfoLine("Date of Birth", data.student.dateOfBirth, leftX, infoStartY + 64);
        drawInfoLine("Date Issued", formatDate(data.issuedAt), rightColX, infoStartY + 64);
        doc.y = infoStartY + 96;
      } else {
        drawInfoLine("Date Issued", formatDate(data.issuedAt), leftX, infoStartY + 64);
        doc.y = infoStartY + 96;
      }

      // Section rule
      doc.moveTo(leftX, doc.y).lineTo(leftX + pageWidth, doc.y).lineWidth(0.5).strokeColor(COLOR_RULE).stroke();
      doc.moveDown(0.8);

      // ----- Programs & courses -----
      if (data.programs.length === 0) {
        doc.fillColor(COLOR_MUTED).font("Helvetica-Oblique").fontSize(11)
          .text("No enrollment records on file.", { align: "center" });
      }

      // Column layout for course rows (relative to leftX). pageWidth ~= 504pt.
      const COL_CODE = 0;
      const COL_TITLE = 96;
      const COL_CREDITS = 315;
      const COL_GRADE = 352;
      const COL_POINTS = 385;
      const COL_DATE = 430;
      const COL_DATE_WIDTH = 74;

      for (let i = 0; i < data.programs.length; i++) {
        const sect = data.programs[i];
        // Page-break guard
        if (doc.y > doc.page.height - 220) doc.addPage();

        // Program header
        doc.fillColor(COLOR_PRIMARY).font("Times-Bold").fontSize(13.5).text(sect.program.title, leftX, doc.y);
        doc.fillColor(COLOR_MUTED).font("Helvetica").fontSize(9.5)
          .text(`${sect.program.level} · Enrolled ${formatDate(sect.enrolledAt)}${sect.certificateIssuedAt ? ` · Degree Conferred ${formatDate(sect.certificateIssuedAt)}` : ""}`,
            leftX, doc.y + 2);
        doc.moveDown(1.4);

        // Table header
        const headerY = doc.y;
        doc.fillColor(COLOR_MUTED).font("Helvetica-Bold").fontSize(8).text("COURSE", leftX + COL_CODE, headerY);
        doc.text("TITLE", leftX + COL_TITLE, headerY);
        doc.text("CR.", leftX + COL_CREDITS, headerY, { width: 34, align: "right" });
        doc.text("GR.", leftX + COL_GRADE, headerY, { width: 30, align: "center" });
        doc.text("PTS", leftX + COL_POINTS, headerY, { width: 40, align: "right" });
        doc.text("DATE", leftX + COL_DATE, headerY, { width: COL_DATE_WIDTH, align: "right" });
        doc.y = headerY + 12;
        doc.moveTo(leftX, doc.y).lineTo(leftX + pageWidth, doc.y).lineWidth(0.4).strokeColor(COLOR_RULE).stroke();
        doc.moveDown(0.4);

        // Course rows
        for (const c of sect.courses) {
          if (doc.y > doc.page.height - 90) doc.addPage();
          const rowY = doc.y;
          doc.fillColor(COLOR_INK).font("Helvetica").fontSize(9.5);
          doc.text(c.courseCode, leftX + COL_CODE, rowY, { width: COL_TITLE - COL_CODE - 4 });
          doc.text(c.title, leftX + COL_TITLE, rowY, { width: COL_CREDITS - COL_TITLE - 8 });
          doc.text(c.creditHours.toFixed(1), leftX + COL_CREDITS, rowY, { width: 34, align: "right" });
          doc.text(c.grade, leftX + COL_GRADE, rowY, { width: 30, align: "center" });
          doc.text(c.countInGpa ? c.qualityPoints.toFixed(2) : "—", leftX + COL_POINTS, rowY, { width: 40, align: "right" });
          doc.text(formatDate(c.completedAt), leftX + COL_DATE, rowY, { width: COL_DATE_WIDTH, align: "right" });
          const titleHeight = doc.heightOfString(c.title, { width: COL_CREDITS - COL_TITLE - 8 });
          doc.y = rowY + Math.max(titleHeight, 12) + 3;
        }

        // Program totals
        doc.moveDown(0.3);
        doc.moveTo(leftX, doc.y).lineTo(leftX + pageWidth, doc.y).lineWidth(0.4).strokeColor(COLOR_RULE).stroke();
        doc.moveDown(0.4);
        const totalsY = doc.y;
        doc.fillColor(COLOR_INK).font("Helvetica-Bold").fontSize(9.5);
        doc.text("Program Totals", leftX, totalsY, { width: COL_CREDITS - 6 });
        doc.text(sect.attemptedCredits.toFixed(1), leftX + COL_CREDITS, totalsY, { width: 34, align: "right" });
        doc.text(sect.gpa.toFixed(2), leftX + COL_GRADE, totalsY, { width: 30, align: "center" });
        doc.text(sect.qualityPoints.toFixed(2), leftX + COL_POINTS, totalsY, { width: 40, align: "right" });
        doc.text(`${sect.earnedCredits.toFixed(1)}/${sect.attemptedCredits.toFixed(1)} earn.`, leftX + COL_DATE, totalsY, {
          width: COL_DATE_WIDTH, align: "right",
        });
        doc.y = totalsY + 20;

        doc.moveDown(0.8);
      }

      // ----- Cumulative summary -----
      if (doc.y > doc.page.height - 170) doc.addPage();
      doc.moveTo(leftX, doc.y).lineTo(leftX + pageWidth, doc.y).lineWidth(1).strokeColor(COLOR_PRIMARY).stroke();
      doc.moveDown(0.5);
      doc.fillColor(COLOR_PRIMARY).font("Times-Bold").fontSize(12).text("Cumulative Academic Record", leftX);
      doc.moveDown(0.5);
      const cumY = doc.y;
      const cumCol = pageWidth / 4;
      const drawCumCell = (label: string, value: string, col: number) => {
        const x = leftX + col * cumCol;
        doc.fillColor(COLOR_MUTED).font("Helvetica").fontSize(8).text(label.toUpperCase(), x, cumY, { characterSpacing: 0.5, width: cumCol });
        doc.fillColor(COLOR_INK).font("Helvetica-Bold").fontSize(13).text(value, x, cumY + 11, { width: cumCol });
      };
      drawCumCell("Credits Attempted", data.cumulative.attemptedCredits.toFixed(1), 0);
      drawCumCell("Credits Earned", data.cumulative.earnedCredits.toFixed(1), 1);
      drawCumCell("Quality Points", data.cumulative.qualityPoints.toFixed(2), 2);
      drawCumCell("Cumulative GPA", data.cumulative.gpa.toFixed(2), 3);
      doc.y = cumY + 40;

      // ----- Signature block -----
      if (doc.y > doc.page.height - 130) doc.addPage();
      doc.moveDown(1.5);
      const sigY = doc.y;
      doc.moveTo(leftX, sigY + 32).lineTo(leftX + 220, sigY + 32).lineWidth(0.7).strokeColor(COLOR_INK).stroke();
      doc.fillColor(COLOR_MUTED).font("Helvetica").fontSize(8.5).text("Registrar's Signature", leftX, sigY + 36);
      doc.moveTo(leftX + pageWidth - 220, sigY + 32).lineTo(leftX + pageWidth, sigY + 32).lineWidth(0.7).strokeColor(COLOR_INK).stroke();
      doc.text(`Date Issued: ${formatDate(data.issuedAt)}`, leftX + pageWidth - 220, sigY + 36);
      doc.moveDown(3.5);

      // ----- Legend -----
      doc.fillColor(COLOR_MUTED).font("Helvetica-Oblique").fontSize(7.5);
      doc.text(
        "Grade Scale: A (93-100, 4.0), A- (90-92, 3.7), B+ (87-89, 3.3), B (83-86, 3.0), B- (80-82, 2.7), C+ (77-79, 2.3), C (73-76, 2.0), C- (70-72, 1.7), F (below 70, 0.0). IP = In Progress, AC = Academic Credit (ungraded, excluded from GPA).",
        leftX,
        doc.y,
        { width: pageWidth, lineGap: 1 }
      );
      doc.moveDown(0.5);
      doc.text(
        `This document is an official academic transcript issued by Ambassadors Christian University. To verify authenticity, visit ${data.verifyUrl} · Transcript ID: ${data.publicId}`,
        leftX,
        doc.y,
        { width: pageWidth, lineGap: 1 }
      );

      // ----- Page numbering -----
      // PDFKit doesn't easily know page count at write time; we buffer pages then re-render footers.
      const range = doc.bufferedPageRange();
      const totalPages = range.count;
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(range.start + i);
        drawFooter(i + 1, totalPages);
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}


