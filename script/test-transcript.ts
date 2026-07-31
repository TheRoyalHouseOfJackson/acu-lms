// Test script — generate a transcript PDF for a given user id directly, bypassing HTTP/auth.
// Usage: npx tsx script/test-transcript.ts <userId>

import fs from "node:fs";
import { buildTranscript, renderTranscriptPDF } from "../server/transcript";

async function main() {
  const userId = Number(process.argv[2] || "3");
  console.log(`Building transcript for userId=${userId}...`);

  const data = await buildTranscript(userId, { verifyBaseUrl: "https://acu-lms.fly.dev" });
  console.log(`Student: ${data.student.legalName} (${data.student.studentIdNumber})`);
  console.log(`Programs: ${data.programs.length}`);
  for (const p of data.programs) {
    console.log(`  ${p.program.title} \u2014 ${p.courses.length} courses, GPA ${p.gpa.toFixed(2)}`);
    for (const c of p.courses.slice(0, 3)) {
      console.log(`    ${c.courseCode} · ${c.title.slice(0, 40)} · ${c.grade} · ${c.creditHours}cr`);
    }
    if (p.courses.length > 3) console.log(`    ... and ${p.courses.length - 3} more`);
  }
  console.log(`Cumulative: ${data.cumulative.earnedCredits}/${data.cumulative.attemptedCredits} credits · GPA ${data.cumulative.gpa.toFixed(2)}`);

  const outPath = `/tmp/test-transcript-${userId}.pdf`;
  const stream = fs.createWriteStream(outPath);
  await renderTranscriptPDF(data, stream);
  await new Promise((r) => setTimeout(r, 100));
  const stat = fs.statSync(outPath);
  console.log(`\nPDF written to ${outPath} (${stat.size} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
