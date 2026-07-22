# Ambassadors Christian University (ACU) — Learning Management System

A full-stack, self-paced online Christian university platform built to replace a
$250/month Vonza subscription. Students browse degree programs, enroll, work
through video/PDF/text lessons, pass quizzes, and earn printable certificates.
Administrators manage the entire catalog and upload course content — all from a
faith-forward, scholarly interface.

Built with **Express + React + Vite + Tailwind CSS + shadcn/ui + Drizzle ORM (SQLite)**.

---

## Admin Login (seeded)

| Field    | Value             |
| -------- | ----------------- |
| Email    | `admin@acu.edu`   |
| Password | `admin123`        |
| Name     | Dr. Founder       |
| Role     | admin (President) |

> **Change this password in production.** Log in, then update the admin account.
> The session secret in `server/routes.ts` (`acu-lms-secret-key-change-me`) should
> also be changed before any real deployment.

### Sample student account (for demos)

| Field    | Value                |
| -------- | -------------------- |
| Email    | `test@student.com`   |
| Password | `pass123`            |

This student is enrolled in **Bachelor of Arts in Christian Leadership** at 100%
completion and has an issued certificate (verification ID `4e8050da-c9e`).

---

## What's Built

### Public site
- **Home** — hero, stats, degree-level overview, popular programs, testimonial, CTA.
- **Programs** — all **38 seeded degree programs** with level, tuition, and app fee.
- **Program detail** — description, curriculum (courses → lessons + quiz), enroll CTA.
- **About** and **Apply** pages.
- **Login / Sign up** — session-based cookie auth.

### Student experience
- **Dashboard** — continue-learning card, enrolled programs with progress bars,
  earned certificates.
- **Lesson player** — sidebar course/lesson navigation, video (YouTube/Vimeo/MP4),
  PDF, and markdown text lessons, mark-complete, previous/next.
- **Quizzes** — multiple-choice, auto-graded, pass threshold (default 70%).
- **Certificates** — auto-issued at 100% program completion; printable / save-as-PDF.

### Admin console
- **Overview** — program / student / degree-level counts.
- **Programs** — edit title, description, tuition, application fee.
- **Courses** — add / edit / delete courses within a program.
- **Lessons** — add / edit / delete lessons; choose type (text / video / PDF);
  upload a file **or** paste a YouTube/Vimeo/MP4 URL; markdown content editor.
- **Quizzes** — attach a quiz to a course and add multiple-choice questions.
- **Students** — list of enrolled students.

### Catalog seeded (38 programs)
- 12 Bachelor's — $5,000 tuition / $75 app fee
- 12 Master's — $6,500 / $75
- 10 Doctoral — $7,500 / $95 (Marriage & Family Counseling: $8,500)
- 4 Dual degrees — $8,500 / $95

Each program is seeded with 2 sample courses ("Foundations & Orientation",
"Core Studies") containing placeholder lessons labeled `[Upload content here]`
and one sample quiz. Replace these via the admin console.

---

## How to Add Course Content

1. Log in as admin (`admin@acu.edu` / `admin123`).
2. Go to **Programs** → pick a degree → edit its description/tuition if needed.
3. Inside a program, **add or edit courses**.
4. Inside a course, **add lessons**:
   - **Text** — write markdown (headings, bold, italic, lists, quotes, links).
   - **Video** — paste a **YouTube or Vimeo URL** (recommended) or upload an MP4.
   - **PDF** — upload a PDF or paste a URL.
5. Optionally **attach a quiz** to a course and add multiple-choice questions.
6. Students automatically see updated content and earn a certificate at 100%.

---

## Video & File Uploads — Important Notes

- Uploaded files are stored in `server/uploads/` and served at `/uploads/`.
- Upload limit: **500 MB** per file (multer).
- **⚠️ Uploaded files may NOT persist across redeploys.** The deployment bundle
  is rebuilt from the workspace, so files uploaded through the live admin UI can
  be lost when the site is redeployed.
- **Recommendation:** For videos, use **YouTube or Vimeo links** instead of
  uploading MP4s. These are more reliable, faster to load, and always persist.
  Paste the share URL into the lesson's video field.
- For long-term production, host uploads on external storage (S3, Cloudinary, etc.).

---

## Tech Stack

- **Frontend:** React 18, Vite, Tailwind CSS v3, shadcn/ui, wouter (hash routing),
  TanStack Query.
- **Backend:** Express, express-session + memorystore (cookie auth), multer (uploads).
- **Database:** SQLite via better-sqlite3 + Drizzle ORM (`data.db`).
- **Auth:** bcryptjs password hashing, session cookies (`credentials: "include"`).
- **Design:** cream background (#F7F1E8), burgundy primary (#7B2D3F), gold accents
  (#C9A961); DM Sans (UI) + Instrument Serif (display); warm scholarly Christian vibe.

---

## Running Locally

```bash
cd acu-lms
npm install
npm run dev        # dev server (Express + Vite) on port 5000
```

### Production build

```bash
npm run build                                   # builds client + server
NODE_ENV=production node dist/index.cjs         # serves on port 5000
```

### Reseeding the database

Seeding only runs when there are no programs and no admin user. To reseed from
scratch, delete `data.db`, `data.db-wal`, and `data.db-shm`, then restart the server.

---

## Data Model

`users`, `programs`, `courses`, `lessons`, `enrollments`, `lessonProgress`,
`quizzes`, `quizQuestions`, `quizAttempts`, `certificates`.

See `shared/schema.ts` for full definitions.
