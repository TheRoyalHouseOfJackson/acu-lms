#!/usr/bin/env node
// Render boot: ensures the SQLite DB is on the persistent disk before starting the server.
// - On first boot, /var/data is empty, so we copy the seed DB shipped in the git repo.
//   Seed DB contains programs/courses/lessons but NO user accounts (sanitized).
// - On first boot only, if ADMIN_EMAIL + ADMIN_PASSWORD env vars are set, we create
//   the admin user account.
// - On subsequent boots, we do nothing (persistent disk keeps state).

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const dbPath = process.env.DB_PATH || '/var/data/data-v2.db';
const seedPath = process.env.SEED_DB_PATH || path.resolve(__dirname, '..', 'seed-db.sqlite');

const targetDir = path.dirname(dbPath);
try {
  fs.mkdirSync(targetDir, { recursive: true });
} catch (e) {
  console.error('[boot] mkdir failed:', e.message);
}

let isFirstBoot = false;
if (!fs.existsSync(dbPath)) {
  isFirstBoot = true;
  console.log(`[boot] First boot — copying seed from ${seedPath} to ${dbPath}`);
  try {
    fs.copyFileSync(seedPath, dbPath);
    console.log('[boot] Seed DB copied successfully.');
  } catch (e) {
    console.error('[boot] Failed to copy seed DB:', e.message);
    process.exit(1);
  }
} else {
  const stats = fs.statSync(dbPath);
  console.log(`[boot] Using existing DB at ${dbPath} (size=${stats.size} bytes)`);
}

// On first boot, seed admin user if credentials provided
if (isFirstBoot && process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
  console.log('[boot] Seeding admin account…');
  try {
    const db = new Database(dbPath);
    const email = process.env.ADMIN_EMAIL.toLowerCase().trim();
    const name = process.env.ADMIN_NAME || 'Administrator';
    const hash = bcrypt.hashSync(process.env.ADMIN_PASSWORD, 10);
    const now = Date.now();
    db.prepare(`
      INSERT OR REPLACE INTO users (email, password_hash, name, role, created_at)
      VALUES (?, ?, ?, 'admin', ?)
    `).run(email, hash, name, now);
    console.log(`[boot] Admin user created: ${email}`);
    db.close();
  } catch (e) {
    console.error('[boot] Failed to seed admin:', e.message);
  }
}

// cwd into project root so relative paths still resolve
process.chdir(path.resolve(__dirname, '..'));

// Start the compiled server
const serverPath = path.resolve(__dirname, '..', 'dist', 'index.cjs');
console.log(`[boot] Starting server: ${serverPath}`);

const child = spawn(process.execPath, [serverPath], {
  stdio: 'inherit',
  env: { ...process.env, DB_PATH: dbPath },
});

child.on('exit', (code) => {
  console.log(`[boot] Server exited with code ${code}`);
  process.exit(code ?? 0);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => child.kill(sig));
}
