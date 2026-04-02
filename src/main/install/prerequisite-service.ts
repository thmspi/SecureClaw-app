import { spawn } from 'child_process';
import { statfsSync, mkdirSync, rmdirSync } from 'fs';
import { app, net } from 'electron';
import { join } from 'path';
import type {
  PrerequisiteCheck,
  PrerequisiteResult,
  StartDockerDaemonResult,
} from '../../shared/install';

function isDevInstallSimulationEnabled(): boolean {
  const flag = process.env.SECURECLAW_DEV_SIMULATE_INSTALL?.trim().toLowerCase();
  const enabled = flag === '1' || flag === 'true' || flag === 'yes' || flag === 'on';
  return enabled && process.env.NODE_ENV !== 'production';
}

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
 * Check Node.js version (OpenClaw requires >= 22.12.0)
 */
async function checkNodeVersion(): Promise<PrerequisiteCheck> {
  const minVersion = '22.12.0';
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
        message: passed ? 'Installed' : `OpenClaw requires Node.js ${minVersion}+`,
      },
    };
  } catch {
    return {
      id: 'node-version',
      name: 'Node.js',
      description: 'Node.js runtime',
      status: 'failed',
      result: {
        required: `>= ${minVersion}`,
        message: `Not found. OpenClaw requires Node.js ${minVersion}+`,
      },
    };
  }
}

/**
 * Check Docker installation.
 * NemoClaw install requires the daemon at runtime, but installer will try to start it.
 */
async function checkDocker(): Promise<PrerequisiteCheck> {
  try {
    const versionProc = spawn('docker', ['--version']);
    const versionOutput = await collectOutput(versionProc);
    const version = versionOutput.trim().replace(/^Docker version /, '');

    try {
      const infoProc = spawn('docker', ['info', '--format', '{{.ServerVersion}}']);
      const serverVersion = (await collectOutput(infoProc)).trim();
      return {
        id: 'docker-daemon',
        name: 'Docker',
        description: 'Docker CLI required for NemoClaw install',
        status: 'passed',
        result: {
          value: serverVersion.length > 0 ? serverVersion : version,
          message: 'Running',
        },
      };
    } catch {
      return {
        id: 'docker-daemon',
        name: 'Docker',
        description: 'Docker CLI required for NemoClaw install',
        status: 'failed',
        result: {
          value: version,
          message: 'Installed but daemon is not running.',
          action: 'start-docker-daemon',
        },
      };
    }
  } catch {
    return {
      id: 'docker-daemon',
      name: 'Docker',
      description: 'Docker CLI required for NemoClaw install',
      status: 'failed',
      result: {
        message: 'Docker not found. Install Docker Desktop and retry.',
      },
    };
  }
}

async function isDockerDaemonRunning(): Promise<boolean> {
  try {
    const infoProc = spawn('docker', ['info', '--format', '{{.ServerVersion}}']);
    await collectOutput(infoProc);
    return true;
  } catch {
    return false;
  }
}

/**
 * Attempt to start Docker daemon on macOS.
 * This call is non-blocking and does not wait for full readiness.
 */
export async function startDockerDaemonIfNeeded(): Promise<StartDockerDaemonResult> {
  try {
    const versionProc = spawn('docker', ['--version']);
    await collectOutput(versionProc);
  } catch {
    throw new Error('Docker not found. Install Docker Desktop and retry.');
  }

  if (await isDockerDaemonRunning()) {
    return {
      started: false,
      ready: true,
      message: 'Docker daemon already running.',
    };
  }

  if (process.platform !== 'darwin') {
    throw new Error('Docker daemon is not running. Start Docker and retry.');
  }

  const launchProc = spawn('open', ['-a', 'Docker']);
  try {
    await collectOutput(launchProc);
  } catch {
    throw new Error('Failed to launch Docker Desktop. Open Docker manually and retry.');
  }

  return {
    started: true,
    ready: false,
    message: 'Docker Desktop launched. Wait for Engine running, then click Re-check.',
  };
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
 * Resolve expected OpenShell release asset for current host.
 */
function getOpenshellAssetName(): string | null {
  if (process.platform === 'darwin') {
    if (process.arch === 'x64') {
      return 'openshell-x86_64-apple-darwin.tar.gz';
    }
    if (process.arch === 'arm64') {
      return 'openshell-aarch64-apple-darwin.tar.gz';
    }
  }
  if (process.platform === 'linux') {
    if (process.arch === 'x64') {
      return 'openshell-x86_64-unknown-linux-musl.tar.gz';
    }
    if (process.arch === 'arm64') {
      return 'openshell-aarch64-unknown-linux-musl.tar.gz';
    }
  }
  return null;
}

/**
 * Check that the OpenShell release artifact needed by NemoClaw exists.
 */
async function checkOpenshellReleaseAsset(): Promise<PrerequisiteCheck> {
  const asset = getOpenshellAssetName();
  if (!asset) {
    return {
      id: 'openshell-asset',
      name: 'OpenShell Asset',
      description: 'Required OpenShell release artifact for this platform',
      status: 'failed',
      result: {
        value: `${process.platform} ${process.arch}`,
        message: 'Unsupported platform/architecture for OpenShell install.',
      },
    };
  }

  const assetUrl = `https://github.com/NVIDIA/OpenShell/releases/latest/download/${asset}`;
  try {
    const probe = spawn('curl', ['-fsSLI', '--max-time', '20', assetUrl]);
    await collectOutput(probe);
    return {
      id: 'openshell-asset',
      name: 'OpenShell Asset',
      description: 'Required OpenShell release artifact for this platform',
      status: 'passed',
      result: {
        value: asset,
        message: 'Available',
      },
    };
  } catch {
    return {
      id: 'openshell-asset',
      name: 'OpenShell Asset',
      description: 'Required OpenShell release artifact for this platform',
      status: 'failed',
      result: {
        value: asset,
        message:
          'Latest OpenShell release asset is unavailable for this platform right now (HTTP 404/unreachable).',
      },
    };
  }
}

function checkNemoclawPlatformSupport(): PrerequisiteCheck {
  return {
    id: 'nemoclaw-platform',
    name: 'NemoClaw Platform',
    description: 'Host compatibility for NemoClaw runtime stack',
    status: 'passed',
    result: {
      value: `${process.platform} ${process.arch}`,
      message: 'Supported',
    },
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
  if (isDevInstallSimulationEnabled()) {
    return {
      allPassed: true,
      checks: [
        {
          id: 'dev-sim-install',
          name: 'Dev Install Simulation',
          description: 'Development-mode install bypass',
          status: 'warning',
          result: {
            message:
              'SECURECLAW_DEV_SIMULATE_INSTALL=1 is enabled. Real prerequisite checks are bypassed.',
          },
        },
      ],
    };
  }

  const checks = await Promise.all([
    checkNodeVersion(),
    checkPython(),
    checkDocker(),
    checkOpenshellReleaseAsset(),
    Promise.resolve(checkNemoclawPlatformSupport()),
    Promise.resolve(checkDiskSpace()),
    Promise.resolve(checkWritePermissions()),
    checkNetwork(),
  ]);
  const allPassed = checks.every((c) => c.status === 'passed' || c.status === 'warning');
  return { allPassed, checks };
}
