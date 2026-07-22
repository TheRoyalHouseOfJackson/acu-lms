#!/usr/bin/env node
// Render boot: ensures the SQLite DB is on the persistent disk before starting the server.
// - On first boot, /var/data is empty, so we copy the seed DB shipped in the git repo.
// - On subsequent boots, we do nothing (persistent disk keeps state).

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const dbPath = process.env.DB_PATH || '/var/data/data-v2.db';
const seedPath = process.env.SEED_DB_PATH || path.resolve(__dirname, '..', 'data-v2.db');

const targetDir = path.dirname(dbPath);
try {
  fs.mkdirSync(targetDir, { recursive: true });
} catch (e) {
  console.error('[boot] mkdir failed:', e.message);
}

if (!fs.existsSync(dbPath)) {
  console.log(`[boot] DB not found at ${dbPath} — copying seed from ${seedPath}`);
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

// forward signals
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => child.kill(sig));
}
