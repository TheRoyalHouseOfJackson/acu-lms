import { storage } from "./storage";
import bcrypt from "bcryptjs";

function slugify(s: string) {
  return s.toLowerCase()
    .replace(/[().+&]/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type Seed = { title: string; level: string; tuition: number; appFee: number };

const BACHELORS: string[] = [
  "Bachelor of Arts in Ministry Chaplaincy",
  "Bachelor of Arts in Religious Fine Arts",
  "Bachelor of Arts in Christian Coaching",
  "Bachelor of Science in Christian Psychology",
  "Bachelor of Arts in Christian Counseling",
  "Bachelor of Arts in Prophetic Ministry",
  "Bachelor of Arts in Theology (Biblical Studies)",
  "Bachelor of Arts in Christian Ethics & Management",
  "Bachelor of Arts in Christian Leadership and Business",
  "Bachelor of Arts in Christian Leadership",
  "Bachelor of Arts in Christian Ethics and Marketing",
  "Bachelor of Arts in Christian Entrepreneurship",
];
const MASTERS: string[] = [
  "Master of Divinity (M.Div.) in Chaplaincy",
  "Master of Arts in Christian Education",
  "Master of Arts in Christian Counseling",
  "Master of Science in Christian Psychology",
  "Master of Science in Practical Ministry",
  "Master of Arts in Theology (Divinity)",
  "Master of Arts in Pastoral Ministry",
  "Master of Arts in Prophetic Ministry",
  "Master of Arts in Christian Ethics & Management",
  "Master of Arts in Christian Entrepreneurship",
  "Master of Arts in Christian Ethics and Marketing",
  "Master of Arts in Christian Leadership",
];
const DOCTORAL: string[] = [
  "Doctor of Divinity (D.Div.) in Chaplaincy and Pastoral Care",
  "Doctor of Philosophy in Christian Counseling",
  "Doctor of Philosophy in Christian Counseling – MFC (Marriage, Family & Child Therapy)",
  "Doctor of Philosophy in Theology (Divinity)",
  "Doctor of Philosophy in Religious Fine Arts",
  "Doctor of Philosophy in Practical Ministry",
  "Doctor of Philosophy in Christian Ethics & Management",
  "Doctor of Philosophy in Christian Leadership and Business",
  "Doctor of Philosophy in Christian Entrepreneurship",
  "Doctor of Philosophy in Christian Entrepreneurship – Executive Leadership",
];
const DUAL: string[] = [
  "MA in Christian Counseling + PhD in Christian Leadership & Business",
  "MA in Theology (Divinity) + PhD in Christian Leadership & Business",
  "MA in Theology (Divinity) + PhD in Practical Ministry",
  "M.Sc. in Practical Ministry + PhD in Christian Counseling",
];

function describe(title: string, level: string): string {
  const focus = title
    .replace(/^(Bachelor of Arts in |Bachelor of Science in |Master of Divinity \(M\.Div\.\) in |Master of Arts in |Master of Science in |Doctor of Divinity \(D\.Div\.\) in |Doctor of Philosophy in )/i, "")
    .trim();
  const levelPhrase: Record<string, string> = {
    "Bachelor's": "This undergraduate program lays a strong biblical and academic foundation",
    "Master's": "This graduate program deepens theological understanding and practical skill",
    "Doctoral": "This doctoral program equips scholars and senior leaders for the highest levels of service",
    "Dual": "This hybrid dual-degree pathway combines two credentials into a single accelerated journey",
  };
  return `${levelPhrase[level]} in ${focus}. Rooted in Scripture and shaped for real-world Kingdom service, the curriculum is fully self-paced so you can study wherever God has planted you. Coursework blends video teaching, readings, and reflective assessments designed to prepare faithful servants for the calling on their lives.`;
}

function tuitionFor(level: string, title: string): { tuition: number; appFee: number } {
  switch (level) {
    case "Bachelor's": return { tuition: 5000, appFee: 75 };
    case "Master's": return { tuition: 6500, appFee: 75 };
    case "Doctoral":
      return title.includes("MFC") ? { tuition: 8500, appFee: 95 } : { tuition: 7500, appFee: 95 };
    case "Dual": return { tuition: 8500, appFee: 95 };
    default: return { tuition: 5000, appFee: 75 };
  }
}

export async function seed() {
  // Seed admin
  const adminEmail = "admin@acu.edu";
  if (!(await storage.getUserByEmail(adminEmail))) {
    const hash = await bcrypt.hash("admin123", 10);
    await storage.createUser({ email: adminEmail, passwordHash: hash, name: "Dr. Founder", role: "admin" });
    console.log("[seed] Created admin user: admin@acu.edu / admin123");
  }

  // Seed programs (only if none exist)
  if ((await storage.countPrograms()) === 0) {
    const groups: [string[], string][] = [
      [BACHELORS, "Bachelor's"],
      [MASTERS, "Master's"],
      [DOCTORAL, "Doctoral"],
      [DUAL, "Dual"],
    ];
    let count = 0;
    for (const [titles, level] of groups) {
      for (const title of titles) {
        const { tuition, appFee } = tuitionFor(level, title);
        const prog = await storage.createProgram({
          title, level, tuition, appFee,
          description: describe(title, level),
          slug: slugify(title),
        });
        // Sample courses per program
        const c1 = await storage.createCourse({
          programId: prog.id,
          title: "Foundations & Orientation",
          description: "An introductory course establishing the core themes of the program.",
          position: 0,
        });
        const c2 = await storage.createCourse({
          programId: prog.id,
          title: "Core Studies",
          description: "The central body of coursework for this program.",
          position: 1,
        });
        // Placeholder lessons
        await storage.createLesson({ courseId: c1.id, title: "Lesson 1: Welcome & Orientation [Upload content here]", type: "text", contentUrl: "", contentText: "# Welcome\n\nThis is a placeholder lesson. Log in as admin to replace this content with your own teaching video, PDF, or text.", position: 0, durationMinutes: 10 });
        await storage.createLesson({ courseId: c1.id, title: "Lesson 2: Introductory Lecture [Upload content here]", type: "video", contentUrl: "", contentText: "", position: 1, durationMinutes: 30 });
        await storage.createLesson({ courseId: c2.id, title: "Lesson 1: Core Reading [Upload content here]", type: "pdf", contentUrl: "", contentText: "", position: 0, durationMinutes: 45 });
        await storage.createLesson({ courseId: c2.id, title: "Lesson 2: Applied Study [Upload content here]", type: "text", contentUrl: "", contentText: "# Applied Study\n\nPlaceholder — replace with your teaching content.", position: 1, durationMinutes: 30 });

        // Sample quiz on the foundations course
        const quiz = await storage.createQuiz({ courseId: c1.id, title: "Foundations Quiz", passingScore: 70 });
        await storage.createQuestion({ quizId: quiz.id, question: "What is the primary source of authority in Christian study?", options: JSON.stringify(["Scripture", "Tradition", "Opinion", "Culture"]), correctAnswer: 0, position: 0 });
        await storage.createQuestion({ quizId: quiz.id, question: "This program is delivered in what format?", options: JSON.stringify(["Self-paced online", "In-person only", "Weekend intensives", "Correspondence mail"]), correctAnswer: 0, position: 1 });
        await storage.createQuestion({ quizId: quiz.id, question: "The mission of the university is to prepare servants for the ___.", options: JSON.stringify(["Kingdom", "Marketplace", "Academy", "Government"]), correctAnswer: 0, position: 2 });
        count++;
      }
    }
    console.log(`[seed] Seeded ${count} programs with sample courses, lessons, and quizzes.`);
  }
}
