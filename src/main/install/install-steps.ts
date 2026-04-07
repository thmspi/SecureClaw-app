import type { InstallTarget, InstallProgress } from '../../shared/install';
import { spawn, ChildProcess } from 'child_process';

export type ProgressCallback = (progress: InstallProgress) => void;

export interface InstallStepConfig {
  id: number;
  name: string;
  description: string;
  execute: (
    target: InstallTarget,
    correlationId: string,
    onProgress: ProgressCallback
  ) => Promise<void>;
}

export class InstallCommandCancelledError extends Error {
  constructor() {
    super('Installation cancelled by user');
    this.name = 'InstallCommandCancelledError';
  }
}

let activeInstallCommand:
  | {
      correlationId: string;
      stepName: string;
      proc: ChildProcess;
    }
  | null = null;

const cancelledSessions = new Set<string>();

const OUTPUT_TAIL_LINES = 5;

function isDevInstallSimulationEnabled(): boolean {
  const flag = process.env.SECURECLAW_DEV_SIMULATE_INSTALL?.trim().toLowerCase();
  const enabled = flag === '1' || flag === 'true' || flag === 'yes' || flag === 'on';
  return enabled && process.env.NODE_ENV !== 'production';
}

function tailLines(text: string, limit: number = OUTPUT_TAIL_LINES): string {
  const normalized = text.replace(/\r/g, '').trim();
  if (!normalized) {
    return '';
  }
  const lines = normalized.split('\n').filter((line) => line.trim().length > 0);
  return lines.slice(-limit).join('\n');
}

function clearActiveCommand(proc: ChildProcess): void {
  if (activeInstallCommand?.proc === proc) {
    activeInstallCommand = null;
  }
}

export async function cancelActiveInstallCommand(
  correlationId?: string,
  gracefulTimeoutMs: number = 3000
): Promise<boolean> {
  const active = activeInstallCommand;
  if (!active) {
    return false;
  }

  if (correlationId && active.correlationId !== correlationId) {
    return false;
  }

  cancelledSessions.add(active.correlationId);

  await new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        resolve();
      }
    };

    active.proc.once('close', finish);

    try {
      active.proc.kill('SIGTERM');
    } catch {
      finish();
      return;
    }

    setTimeout(() => {
      if (!active.proc.killed) {
        try {
          active.proc.kill('SIGKILL');
        } catch {
          // no-op
        }
      }
      finish();
    }, gracefulTimeoutMs);
  });

  return true;
}

/**
 * Emit normalized progress for a single step.
 */
function emitStepProgress(
  stepId: number,
  totalSteps: number,
  stepName: string,
  correlationId: string,
  onProgress: ProgressCallback,
  stepProgress: number
): void {
  const overallProgress = ((stepId - 1) / totalSteps) * 100 + (stepProgress / totalSteps);
  onProgress({
    correlationId,
    step: stepId,
    totalSteps,
    stepName,
    progress: stepProgress,
    overallProgress,
  });
}

/**
 * Run a shell command while emitting step progress.
 * Progress reflects real command lifecycle only (start/end), without synthetic interpolation.
 */
async function runCommandStep(
  stepId: number,
  totalSteps: number,
  stepName: string,
  correlationId: string,
  onProgress: ProgressCallback,
  command: string,
  args: string[],
  env?: Record<string, string>,
  timeoutMs: number = 15 * 60 * 1000
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let timedOut = false;
    emitStepProgress(stepId, totalSteps, stepName, correlationId, onProgress, 0);

    const proc = spawn(command, args, {
      shell: false,
      env: env ? { ...process.env, ...env } : process.env,
    });
    console.info(`[install] ${stepName}: running ${command} ${args.join(' ')}`);
    activeInstallCommand = { correlationId, stepName, proc };

    let stderr = '';
    let combinedOutput = '';
    proc.stdout?.on('data', (chunk) => {
      const text = chunk.toString();
      combinedOutput += text;
      process.stdout.write(`[install:${stepName}] ${text}`);
    });
    proc.stderr?.on('data', (chunk) => {
      const text = chunk.toString();
      combinedOutput += text;
      stderr += text;
      process.stderr.write(`[install:${stepName}:stderr] ${text}`);
    });

    const timeout = setTimeout(() => {
      timedOut = true;
      try {
        proc.kill('SIGTERM');
      } catch {
        // no-op
      }

      setTimeout(() => {
        if (!proc.killed) {
          try {
            proc.kill('SIGKILL');
          } catch {
            // no-op
          }
        }
      }, 2000);
    }, timeoutMs);

    proc.on('error', (error) => {
      clearTimeout(timeout);
      clearActiveCommand(proc);
      reject(error);
    });

    proc.on('close', (code) => {
      clearTimeout(timeout);
      clearActiveCommand(proc);

      if (cancelledSessions.has(correlationId)) {
        cancelledSessions.delete(correlationId);
        reject(new InstallCommandCancelledError());
        return;
      }

      if (timedOut) {
        const outputTail = tailLines(combinedOutput);
        const detail = outputTail.length > 0 ? `\nLast output lines:\n${outputTail}` : '';
        reject(
          new Error(
            `${stepName} timed out after ${Math.round(timeoutMs / 1000)}s.${detail}`
          )
        );
        return;
      }

      if (code === 0) {
        console.info(`[install] ${stepName}: completed`);
        emitStepProgress(stepId, totalSteps, stepName, correlationId, onProgress, 100);
        resolve();
        return;
      }

      const outputTail = tailLines(combinedOutput.length > 0 ? combinedOutput : stderr);
      const detail = outputTail.length > 0 ? `\nLast output lines:\n${outputTail}` : '';
      reject(new Error(`${stepName} failed (exit ${code}).${detail}`));
    });
  });
}

/**
 * Keep tests deterministic and support opt-in dev simulation by bypassing
 * network installers and external system dependencies.
 */
async function maybeSimulateInstall(
  stepId: number,
  totalSteps: number,
  stepName: string,
  correlationId: string,
  onProgress: ProgressCallback
): Promise<boolean> {
  const isTest = process.env.NODE_ENV === 'test';
  const isDevSimulation = isDevInstallSimulationEnabled();
  if (!isTest && !isDevSimulation) {
    return false;
  }

  if (isDevSimulation && stepId === 1) {
    console.info(
      '[install] Development install simulation enabled (SECURECLAW_DEV_SIMULATE_INSTALL=1)'
    );
  }

  const ticks = isTest ? 8 : 10;
  const delayMs = isTest ? 20 : 160;
  for (let i = 0; i <= ticks; i++) {
    emitStepProgress(stepId, totalSteps, stepName, correlationId, onProgress, (i / ticks) * 100);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return true;
}

export const INSTALL_STEPS: InstallStepConfig[] = [
  {
    id: 1,
    name: 'Authorizing Installation',
    description: 'Request macOS administrator permission before global OpenClaw install',
    execute: async (_target, correlationId, onProgress) => {
      if (await maybeSimulateInstall(1, 6, 'Authorizing Installation', correlationId, onProgress)) {
        return;
      }

      await runCommandStep(
        1,
        6,
        'Authorizing Installation',
        correlationId,
        onProgress,
        'bash',
        [
          '-lc',
          `set -e
SYSTEM_PREFIX="$(npm config get prefix 2>/dev/null || true)"
GLOBAL_BIN="$(npm bin -g 2>/dev/null || true)"
if command -v openclaw >/dev/null 2>&1 || { [ -n "$GLOBAL_BIN" ] && [ -x "$GLOBAL_BIN/openclaw" ]; } || [ -x "$HOME/.secureclaw/npm-global/bin/openclaw" ]; then
  echo "OpenClaw already installed; no authorization prompt needed."
elif [ -n "$SYSTEM_PREFIX" ] && [ -w "$SYSTEM_PREFIX/lib/node_modules" ]; then
  echo "Global npm prefix is writable; no elevation required."
elif [ "$(uname -s)" = "Darwin" ] && command -v osascript >/dev/null 2>&1; then
  osascript -e 'do shell script "/usr/bin/env npm install -g --no-fund --no-audit --loglevel=error openclaw@latest" with administrator privileges'
else
  echo "Skipping macOS admin authorization (not supported on this platform)."
fi`,
        ],
        { CI: '1' },
        2 * 60 * 1000
      );
    },
  },
  {
    id: 2,
    name: 'Installing OpenClaw',
    description: 'Install OpenClaw CLI using the official npm package',
    execute: async (_target, correlationId, onProgress) => {
      if (await maybeSimulateInstall(2, 6, 'Installing OpenClaw', correlationId, onProgress)) {
        return;
      }

      await runCommandStep(
        2,
        6,
        'Installing OpenClaw',
        correlationId,
        onProgress,
        'bash',
        [
          '-lc',
          `set -e
SYSTEM_PREFIX="$(npm config get prefix 2>/dev/null || true)"
GLOBAL_BIN="$(npm bin -g 2>/dev/null || true)"
if command -v openclaw >/dev/null 2>&1 || { [ -n "$GLOBAL_BIN" ] && [ -x "$GLOBAL_BIN/openclaw" ]; }; then
  echo "OpenClaw already available globally."
elif [ -x "$HOME/.secureclaw/npm-global/bin/openclaw" ]; then
  echo "OpenClaw already available in user prefix."
elif [ -n "$SYSTEM_PREFIX" ] && [ -w "$SYSTEM_PREFIX/lib/node_modules" ]; then
  npm install -g --no-fund --no-audit --loglevel=error openclaw@latest
else
  USER_PREFIX="$HOME/.secureclaw/npm-global"
  mkdir -p "$USER_PREFIX"
  npm install -g --prefix "$USER_PREFIX" --no-fund --no-audit --loglevel=error openclaw@latest
  echo "OpenClaw installed in user prefix: $USER_PREFIX/bin"
fi`,
        ],
        { CI: '1' },
        12 * 60 * 1000
      );
    },
  },
  {
    id: 3,
    name: 'Verifying OpenClaw',
    description: 'Verify OpenClaw binary is available',
    execute: async (_target, correlationId, onProgress) => {
      if (await maybeSimulateInstall(3, 6, 'Verifying OpenClaw', correlationId, onProgress)) {
        return;
      }

      await runCommandStep(
        3,
        6,
        'Verifying OpenClaw',
        correlationId,
        onProgress,
        'bash',
        [
          '-lc',
          `set -e
GLOBAL_BIN="$(npm bin -g 2>/dev/null || true)"
if command -v openclaw >/dev/null 2>&1; then
  openclaw --version
elif [ -n "$GLOBAL_BIN" ] && [ -x "$GLOBAL_BIN/openclaw" ]; then
  "$GLOBAL_BIN/openclaw" --version
elif [ -x "$HOME/.secureclaw/npm-global/bin/openclaw" ]; then
  "$HOME/.secureclaw/npm-global/bin/openclaw" --version
else
  echo "openclaw binary not found in PATH, npm global bin, or ~/.secureclaw/npm-global/bin" >&2
  exit 1
fi`,
        ]
      );
    },
  },
  {
    id: 4,
    name: 'Installing NemoClaw',
    description: 'Install NemoClaw using the official NVIDIA installer',
    execute: async (_target, correlationId, onProgress) => {
      if (await maybeSimulateInstall(4, 6, 'Installing NemoClaw', correlationId, onProgress)) {
        return;
      }

      await runCommandStep(
        4,
        6,
        'Installing NemoClaw',
        correlationId,
        onProgress,
        'bash',
        [
          '-lc',
          `set -e
if command -v nemoclaw >/dev/null 2>&1; then
  echo "NemoClaw already available."
else
  curl -fsSL https://www.nvidia.com/nemoclaw.sh | bash
fi`,
        ],
        { NON_INTERACTIVE: '1', CI: '1' },
        25 * 60 * 1000
      );
    },
  },
  {
    id: 5,
    name: 'Verifying NemoClaw',
    description: 'Verify NemoClaw binary is available',
    execute: async (_target, correlationId, onProgress) => {
      if (await maybeSimulateInstall(5, 6, 'Verifying NemoClaw', correlationId, onProgress)) {
        return;
      }

      await runCommandStep(
        5,
        6,
        'Verifying NemoClaw',
        correlationId,
        onProgress,
        'bash',
        [
          '-lc',
          `set -e
if command -v nemoclaw >/dev/null 2>&1; then
  nemoclaw --help >/dev/null 2>&1
elif command -v openclaw >/dev/null 2>&1; then
  openclaw nemoclaw --help >/dev/null 2>&1
elif command -v openshell >/dev/null 2>&1; then
  openshell --version >/dev/null 2>&1
else
  echo "NemoClaw verification failed: expected one of 'nemoclaw', 'openclaw nemoclaw', or 'openshell' to be available." >&2
  exit 1
fi`,
        ]
      );
    },
  },
  {
    id: 6,
    name: 'Finalizing',
    description: 'Final checks before completion',
    execute: async (_target, correlationId, onProgress) => {
      if (await maybeSimulateInstall(6, 6, 'Finalizing', correlationId, onProgress)) {
        return;
      }

      await runCommandStep(
        6,
        6,
        'Finalizing',
        correlationId,
        onProgress,
        'bash',
        [
          '-lc',
          `set -e
GLOBAL_BIN="$(npm bin -g 2>/dev/null || true)"
if command -v openclaw >/dev/null 2>&1 || { [ -n "$GLOBAL_BIN" ] && [ -x "$GLOBAL_BIN/openclaw" ]; } || [ -x "$HOME/.secureclaw/npm-global/bin/openclaw" ]; then
  true
else
  echo "openclaw binary not found in final check" >&2
  exit 1
fi
if command -v nemoclaw >/dev/null 2>&1; then
  true
elif command -v openclaw >/dev/null 2>&1 && openclaw nemoclaw --help >/dev/null 2>&1; then
  true
elif command -v openshell >/dev/null 2>&1; then
  true
else
  echo "nemoclaw/openshell integration not found in final check" >&2
  exit 1
fi`,
        ]
      );
    },
  },
];
