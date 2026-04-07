import { spawn, ChildProcess } from 'child_process';
import type { ProcessEvent, ProcessEventType } from '../../shared/platform/contracts';

export interface RunProcessOptions {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
  correlationId: string;
  onEvent?: (event: ProcessEvent) => void;
}

export interface StopOptions {
  strategy?: 'graceful' | 'timeout' | 'force';
  gracefulTimeoutMs?: number;
}

// Active process registry for stop operations
const activeProcesses = new Map<string, {
  process: ChildProcess;
  onEvent?: (event: ProcessEvent) => void;
}>();

function emitEvent(
  correlationId: string,
  type: ProcessEventType,
  data: Record<string, unknown>,
  onEvent?: (event: ProcessEvent) => void
): void {
  const event: ProcessEvent = {
    type,
    correlationId,
    timestamp: new Date().toISOString(),
    data,
  };
  onEvent?.(event);
}

export async function runProcess(options: RunProcessOptions): Promise<void> {
  const { command, args = [], cwd, env, timeoutMs, correlationId, onEvent } = options;

  return new Promise((resolve, reject) => {
    let timeoutId: NodeJS.Timeout | undefined;
    let isTimedOut = false;

    try {
      const proc = spawn(command, args, {
        cwd,
        env: env ? { ...process.env, ...env } : process.env,
        shell: false,
      });

      // Register for stop operations
      activeProcesses.set(correlationId, { process: proc, onEvent });

      // Emit spawned event
      emitEvent(correlationId, 'spawned', { pid: proc.pid }, onEvent);

      // Handle stdout
      proc.stdout?.on('data', (chunk: Buffer) => {
        emitEvent(correlationId, 'stdout', { chunk: chunk.toString() }, onEvent);
      });

      // Handle stderr
      proc.stderr?.on('data', (chunk: Buffer) => {
        emitEvent(correlationId, 'stderr', { chunk: chunk.toString() }, onEvent);
      });

      // Handle process exit
      proc.on('close', (code, signal) => {
        clearTimeout(timeoutId);
        activeProcesses.delete(correlationId);

        if (isTimedOut) {
          emitEvent(correlationId, 'timeout', { timeoutMs }, onEvent);
          reject(new Error(`Process timed out after ${timeoutMs}ms`));
        } else {
          emitEvent(correlationId, 'exited', { exitCode: code, signal }, onEvent);
          if (code === 0 || signal) {
            resolve();
          } else {
            reject(new Error(`Process exited with code ${code}`));
          }
        }
      });

      // Handle spawn errors
      proc.on('error', (error) => {
        clearTimeout(timeoutId);
        activeProcesses.delete(correlationId);
        emitEvent(correlationId, 'error', { error: error.message }, onEvent);
        reject(error);
      });

      // Set timeout if specified
      if (timeoutMs) {
        timeoutId = setTimeout(() => {
          isTimedOut = true;
          // D-03: graceful first, then force
          proc.kill('SIGTERM');
          setTimeout(() => {
            if (!proc.killed) {
              proc.kill('SIGKILL');
            }
          }, 1000);
        }, timeoutMs);
      }
    } catch (error) {
      emitEvent(correlationId, 'error', { error: String(error) }, onEvent);
      reject(error);
    }
  });
}

export async function stopProcess(
  correlationId: string,
  options: StopOptions = {}
): Promise<void> {
  const { strategy = 'graceful', gracefulTimeoutMs = 5000 } = options;
  const entry = activeProcesses.get(correlationId);

  if (!entry) {
    return; // Process not found or already exited
  }

  const { process: proc, onEvent } = entry;

  // Emit stopping event
  emitEvent(correlationId, 'stopping', { strategy }, onEvent);

  return new Promise((resolve) => {
    // D-03: Stop policy order
    // 1. Graceful stop (SIGTERM)
    // 2. Timeout escalation
    // 3. Force termination (SIGKILL)

    if (strategy === 'force') {
      proc.kill('SIGKILL');
      resolve();
      return;
    }

    // Graceful: send SIGTERM first
    proc.kill('SIGTERM');

    const forceKillTimeout = setTimeout(() => {
      if (!proc.killed) {
        proc.kill('SIGKILL');
      }
      resolve();
    }, gracefulTimeoutMs);

    proc.on('close', () => {
      clearTimeout(forceKillTimeout);
      resolve();
    });
  });
}
