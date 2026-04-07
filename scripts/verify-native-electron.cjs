#!/usr/bin/env node

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const electronBinary = path.resolve(
  process.cwd(),
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'electron.cmd' : 'electron'
);

if (!fs.existsSync(electronBinary)) {
  console.error('Electron binary not found in node_modules/.bin. Run `npm install` first.');
  process.exit(1);
}

const verificationScript = `
  require('better-sqlite3');
  process.stdout.write('native-sqlite-ok\\n');
`;

const result = spawnSync(electronBinary, ['-e', verificationScript], {
  encoding: 'utf8',
  env: {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
  },
});

if (result.status !== 0) {
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  console.error('\nElectron native module preflight failed for better-sqlite3.');
  console.error('Run `npm run rebuild:native:deps` and try again.');
  process.exit(result.status || 1);
}

if (result.stdout.includes('native-sqlite-ok')) {
  process.stdout.write('Electron native module preflight passed (better-sqlite3).\n');
}
