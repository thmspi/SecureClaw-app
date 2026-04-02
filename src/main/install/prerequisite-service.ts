import { spawn } from 'child_process';
import { statfsSync, mkdirSync, rmdirSync } from 'fs';
import { app, net } from 'electron';
import { join } from 'path';
import type { PrerequisiteCheck, PrerequisiteResult } from '../../shared/install';

/**
 * Collects stdout/stderr from a spawned process and resolves on successful exit
 */
async function collectOutput(proc: ReturnType<typeof spawn>): Promise<string> {
  return new Promise((resolve, reject) => {
    let output = '';
    proc.stdout?.on('data', (chunk) => {
      output += chunk.toString();
    });
    proc.stderr?.on('data', (chunk) => {
      output += chunk.toString();
    });
    proc.on('close', (code) => (code === 0 ? resolve(output) : reject(new Error(`Exit ${code}`))));
    proc.on('error', reject);
  });
}

/**
 * Compare semantic versions (a >= b)
 */
function semverGte(a: string, b: string): boolean {
  const [aMajor, aMinor, aPatch] = a.split('.').map(Number);
  const [bMajor, bMinor, bPatch] = b.split('.').map(Number);
  if (aMajor !== bMajor) return aMajor > bMajor;
  if (aMinor !== bMinor) return aMinor > bMinor;
  return aPatch >= bPatch;
}

/**
 * Check Node.js version (requires >= 18.0.0)
 */
async function checkNodeVersion(): Promise<PrerequisiteCheck> {
  const minVersion = '18.0.0';
  try {
    const proc = spawn('node', ['--version']);
    const output = await collectOutput(proc);
    const version = output.trim().replace(/^v/, '');
    const passed = semverGte(version, minVersion);
    return {
      id: 'node-version',
      name: 'Node.js',
      description: 'Node.js runtime for OpenClaw/NemoClaw',
      status: passed ? 'passed' : 'failed',
      result: {
        value: version,
        required: `>= ${minVersion}`,
        message: passed ? 'Installed' : `Requires ${minVersion}+`,
      },
    };
  } catch {
    return {
      id: 'node-version',
      name: 'Node.js',
      description: 'Node.js runtime',
      status: 'failed',
      result: { required: `>= ${minVersion}`, message: 'Not found. Install from nodejs.org' },
    };
  }
}

/**
 * Check Python version (requires >= 3.10.0)
 * Tries python3 first, then python (pitfall 4: macOS only has python3)
 */
async function checkPython(): Promise<PrerequisiteCheck> {
  const minVersion = '3.10.0';
  for (const cmd of ['python3', 'python']) {
    try {
      const proc = spawn(cmd, ['--version']);
      const output = await collectOutput(proc);
      const match = output.match(/Python (\d+\.\d+\.\d+)/);
      if (match) {
        const version = match[1];
        const passed = semverGte(version, minVersion);
        return {
          id: 'python',
          name: 'Python',
          description: 'Python runtime for NemoClaw',
          status: passed ? 'passed' : 'failed',
          result: {
            value: version,
            required: `>= ${minVersion}`,
            message: passed ? 'Installed' : `Requires ${minVersion}+`,
          },
        };
      }
    } catch {
      continue;
    }
  }
  return {
    id: 'python',
    name: 'Python',
    description: 'Python runtime',
    status: 'failed',
    result: { required: `>= ${minVersion}`, message: 'Not found. Install from python.org' },
  };
}

/**
 * Check disk space (requires >= 5GB free)
 */
function checkDiskSpace(): PrerequisiteCheck {
  const minGb = 5;
  try {
    const stats = statfsSync(app.getPath('userData'));
    const freeGb = (stats.bfree * stats.bsize) / 1024 ** 3;
    const passed = freeGb >= minGb;
    return {
      id: 'disk-space',
      name: 'Disk Space',
      description: 'Available storage',
      status: passed ? 'passed' : 'failed',
      result: {
        value: `${freeGb.toFixed(1)} GB`,
        required: `>= ${minGb} GB`,
        message: passed ? 'Sufficient' : 'Insufficient space',
      },
    };
  } catch {
    return {
      id: 'disk-space',
      name: 'Disk Space',
      description: 'Storage check',
      status: 'warning',
      result: { message: 'Could not verify' },
    };
  }
}

/**
 * Check write permissions by creating and removing a test directory
 */
function checkWritePermissions(): PrerequisiteCheck {
  const testDir = join(app.getPath('userData'), '.perm-test');
  try {
    mkdirSync(testDir, { recursive: true });
    rmdirSync(testDir);
    return {
      id: 'permissions',
      name: 'Write Permissions',
      description: 'Can write to app data',
      status: 'passed',
      result: { message: 'Confirmed' },
    };
  } catch {
    return {
      id: 'permissions',
      name: 'Write Permissions',
      description: 'Write access',
      status: 'failed',
      result: { message: 'Cannot write to app folder' },
    };
  }
}

/**
 * Check network connectivity using Electron's net.isOnline()
 */
async function checkNetwork(): Promise<PrerequisiteCheck> {
  const online = net.isOnline();
  return {
    id: 'network',
    name: 'Internet',
    description: 'Required for download',
    status: online ? 'passed' : 'warning',
    result: { message: online ? 'Connected' : 'No connection detected' },
  };
}

/**
 * Run all prerequisite checks in parallel
 */
export async function runAllPrerequisiteChecks(): Promise<PrerequisiteResult> {
  const checks = await Promise.all([
    checkNodeVersion(),
    checkPython(),
    Promise.resolve(checkDiskSpace()),
    Promise.resolve(checkWritePermissions()),
    checkNetwork(),
  ]);
  const allPassed = checks.every((c) => c.status === 'passed' || c.status === 'warning');
  return { allPassed, checks };
}
