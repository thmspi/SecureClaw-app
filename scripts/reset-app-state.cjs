#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');

function removePath(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return { targetPath, removed: false };
  }

  const stats = fs.lstatSync(targetPath);
  if (stats.isDirectory()) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  } else {
    fs.rmSync(targetPath, { force: true });
  }

  return { targetPath, removed: true };
}

async function main() {
  await app.whenReady();

  const userData = app.getPath('userData');
  const targets = [
    path.join(userData, 'Local Storage'),
    path.join(userData, 'Session Storage'),
    path.join(userData, 'secureclaw.db'),
    path.join(userData, 'secureclaw.db-shm'),
    path.join(userData, 'secureclaw.db-wal'),
  ];

  console.log(`[reset-app-state] userData: ${userData}`);
  for (const targetPath of targets) {
    try {
      const { removed } = removePath(targetPath);
      const status = removed ? 'removed' : 'not-found';
      console.log(`[reset-app-state] ${status}: ${targetPath}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[reset-app-state] failed: ${targetPath} (${message})`);
      process.exitCode = 1;
    }
  }

  app.quit();
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[reset-app-state] fatal: ${message}`);
  process.exitCode = 1;
  app.quit();
});
