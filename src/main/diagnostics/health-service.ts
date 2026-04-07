import { spawnSync } from 'child_process';
import { app } from 'electron';
import type { GetHealthInput } from '../../shared/ipc/diagnostics-channels';
import type { HealthSeverity, HealthSnapshot, VersionKey } from '../../shared/diagnostics/diagnostics-contracts';
import { loadInstallState } from '../install/install-state-service';
import { listPluginPackages } from '../runtime/plugin-catalog-service';
import { getSessions } from '../runtime/session-orchestrator';

const SEVERITY_RANK: Record<HealthSeverity, number> = {
  Healthy: 0,
  Warning: 1,
  Critical: 2,
};

function probeVersion(command: string): string | null {
  try {
    const result = spawnSync(command, ['--version'], {
      encoding: 'utf8',
      timeout: 8000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    if (result.status !== 0) {
      return null;
    }

    const stdout = typeof result.stdout === 'string' ? result.stdout.trim() : '';
    const stderr = typeof result.stderr === 'string' ? result.stderr.trim() : '';
    const output = stdout || stderr;
    return output.length > 0 ? output : null;
  } catch {
    return null;
  }
}

function probeDockerDaemonVersion(): string | null {
  try {
    const result = spawnSync('docker', ['info', '--format', '{{.ServerVersion}}'], {
      encoding: 'utf8',
      timeout: 8000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    if (result.status !== 0) {
      return null;
    }

    const stdout = typeof result.stdout === 'string' ? result.stdout.trim() : '';
    return stdout.length > 0 ? stdout : null;
  } catch {
    return null;
  }
}

function deriveInstallSeverity(): HealthSeverity {
  let installState: ReturnType<typeof loadInstallState> = null;
  try {
    installState = loadInstallState();
  } catch {
    return 'Warning';
  }
  if (!installState) {
    return 'Warning';
  }

  switch (installState.status) {
    case 'completed':
      return 'Healthy';
    case 'failed':
      return 'Critical';
    case 'running':
    case 'paused':
    case 'pending':
    case 'rolled_back':
    default:
      return 'Warning';
  }
}

function deriveRuntimeSeverity(): HealthSeverity {
  let sessions: ReturnType<typeof getSessions> = [];
  try {
    sessions = getSessions();
  } catch {
    return 'Warning';
  }
  if (sessions.some((session) => session.state === 'Active')) {
    return 'Healthy';
  }

  if (sessions.some((session) => session.error && session.error.length > 0)) {
    return 'Critical';
  }

  return 'Warning';
}

async function derivePluginSeverity(): Promise<HealthSeverity> {
  try {
    const result = await listPluginPackages();
    if (result.error) {
      return 'Critical';
    }

    return result.packages.length > 0 ? 'Healthy' : 'Warning';
  } catch {
    return 'Critical';
  }
}

function deriveOverallSeverity(severities: HealthSeverity[]): HealthSeverity {
  return severities.reduce((highest, current) => {
    return SEVERITY_RANK[current] > SEVERITY_RANK[highest] ? current : highest;
  }, 'Healthy' as HealthSeverity);
}

function resolveVersions(): Record<VersionKey, string | null> {
  return {
    app: app.getVersion(),
    openclaw: probeVersion('openclaw'),
    nemoclaw: probeVersion('nemoclaw'),
    docker: probeDockerDaemonVersion(),
  };
}

export async function getHealthSnapshot(_request: GetHealthInput = {}): Promise<HealthSnapshot> {
  const installSeverity = deriveInstallSeverity();
  const runtimeSeverity = deriveRuntimeSeverity();
  const pluginSeverity = await derivePluginSeverity();
  const versions = resolveVersions();
  const dockerSeverity: HealthSeverity = versions.docker ? 'Healthy' : 'Warning';
  const overallSeverity = deriveOverallSeverity([installSeverity, runtimeSeverity, pluginSeverity, dockerSeverity]);

  return {
    overallSeverity,
    components: {
      install: installSeverity,
      runtime: runtimeSeverity,
      plugins: pluginSeverity,
    },
    versions,
    generatedAt: new Date().toISOString(),
  };
}
