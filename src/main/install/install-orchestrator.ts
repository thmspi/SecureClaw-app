import { spawn } from 'child_process';
import { BrowserWindow } from 'electron';
import { INSTALL_CHANNELS } from '../../shared/install/install-channels';
import type {
  InstallTarget,
  InstallProgress,
  InstallError,
  InstallState,
} from '../../shared/install/install-contracts';
import type { SecretScope } from '../../shared/security/secret-contracts';
import { saveInstallState, loadInstallState, clearInstallState } from './install-state-service';
import { rollbackService } from './rollback-service';
import { runAllPrerequisiteChecks } from './prerequisite-service';
import { deleteScope } from '../security/secret-store-service';
import {
  INSTALL_STEPS,
  ProgressCallback,
  cancelActiveInstallCommand,
  InstallCommandCancelledError,
} from './install-steps';

const SECRET_KEY_PREFIX = 'secureclaw:';
const SECRET_SCOPES: SecretScope[] = ['install', 'runtime', 'plugin', 'support'];

/**
 * Orchestrates install flow with progress events, state persistence, and rollback support
 */
export class InstallOrchestrator {
  private correlationId: string | null = null;
  private target: InstallTarget | null = null;
  private cancelled = false;
  private window: BrowserWindow | null = null;
  private warnedStateAbiMismatch = false;

  private isDevInstallSimulationEnabled(): boolean {
    const flag = process.env.SECURECLAW_DEV_SIMULATE_INSTALL?.trim().toLowerCase();
    const enabled = flag === '1' || flag === 'true' || flag === 'yes' || flag === 'on';
    return enabled && process.env.NODE_ENV !== 'production';
  }

  /**
   * Set the main window for IPC event emission
   */
  setWindow(win: BrowserWindow): void {
    this.window = win;
  }

  private emitProgress(progress: InstallProgress): void {
    this.window?.webContents.send(INSTALL_CHANNELS.progress, progress);
  }

  private emitError(error: InstallError): void {
    this.window?.webContents.send(INSTALL_CHANNELS.error, error);
  }

  private emitComplete(): void {
    this.window?.webContents.send(INSTALL_CHANNELS.complete);
  }

  private isStateStoreAbiMismatch(error: unknown): boolean {
    const details =
      error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error);
    return details.includes('better_sqlite3.node') && details.includes('NODE_MODULE_VERSION');
  }

  private logStateStoreError(operation: 'load' | 'save' | 'clear', error: unknown): void {
    if (this.isStateStoreAbiMismatch(error)) {
      if (!this.warnedStateAbiMismatch) {
        this.warnedStateAbiMismatch = true;
        console.error(
          `[install] Install state DB unavailable (${operation}): better-sqlite3 ABI mismatch with Electron runtime.
Run: npm run rebuild:native
Then restart Electron.`
        );
      }
      return;
    }

    console.error(`[install] Failed to ${operation} install state:`, error);
  }

  private loadStateSafe(): InstallState | null {
    try {
      return loadInstallState();
    } catch (error) {
      this.logStateStoreError('load', error);
      return null;
    }
  }

  private saveStateSafe(state: InstallState): void {
    try {
      saveInstallState(state);
    } catch (error) {
      this.logStateStoreError('save', error);
    }
  }

  private clearStateSafe(): void {
    try {
      clearInstallState();
    } catch (error) {
      this.logStateStoreError('clear', error);
    }
  }

  private async runCleanupCommand(
    command: string,
    args: string[],
    timeoutMs: number = 45000
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, {
        shell: false,
        env: process.env,
      });

      let output = '';
      let stderr = '';

      proc.stdout?.on('data', (chunk) => {
        output += chunk.toString();
      });
      proc.stderr?.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      const timeout = setTimeout(() => {
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
        }, 1500);
      }, timeoutMs);

      proc.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      proc.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve(output.trim());
          return;
        }
        const details = stderr.trim();
        reject(new Error(details.length > 0 ? details : `Exit ${code}`));
      });
    });
  }

  private async cleanupInstalledBinaries(options: {
    removed: string[];
    errors?: string[];
    reason: 'cancel' | 'manual-uninstall';
  }): Promise<void> {
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    try {
      const openclawCleanup = await this.runCleanupCommand(
        'bash',
        [
          '-lc',
          [
            'REMOVED=0',
            'npm uninstall -g openclaw >/dev/null 2>&1 && REMOVED=1 || true',
            'if [ -x "$HOME/.secureclaw/npm-global/bin/openclaw" ]; then',
            '  npm uninstall -g --prefix "$HOME/.secureclaw/npm-global" openclaw >/dev/null 2>&1 && REMOVED=1 || true',
            'fi',
            '[ "$REMOVED" -eq 1 ] && echo "openclaw" || true',
          ].join(' '),
        ],
        60000
      );
      if (openclawCleanup === 'openclaw') {
        options.removed.push('openclaw');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      options.errors?.push(`OpenClaw uninstall failed: ${message}`);
      console.warn(`OpenClaw uninstall on ${options.reason} failed:`, error);
    }

    try {
      const nemoclawCleanup = await this.runCleanupCommand(
        'bash',
        [
          '-lc',
          [
            'if command -v nemoclaw >/dev/null 2>&1; then',
            '  curl --max-time 30 -fsSL https://raw.githubusercontent.com/NVIDIA/NemoClaw/refs/heads/main/uninstall.sh',
            '  | bash -s -- --yes >/dev/null 2>&1 && echo "nemoclaw";',
            'fi',
          ].join(' '),
        ],
        90000
      );
      if (nemoclawCleanup === 'nemoclaw') {
        options.removed.push('nemoclaw');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      options.errors?.push(`NemoClaw uninstall failed: ${message}`);
      console.warn(`NemoClaw uninstall on ${options.reason} failed:`, error);
    }
  }

  private cleanupScopedSecrets(options: {
    errors: string[];
    reason: 'cancel' | 'manual-uninstall';
  }): void {
    for (const scope of SECRET_SCOPES) {
      try {
        const cleanupResult = deleteScope({ scope });
        if (cleanupResult.success) {
          continue;
        }

        const warning = `Secret cleanup warning for ${SECRET_KEY_PREFIX}${scope}: ${cleanupResult.error?.userMessage ?? 'Unknown secret cleanup error'}`;
        options.errors.push(warning);
        console.warn(
          `[install] ${warning}; reason=${options.reason}; technical=${cleanupResult.error?.technicalDetails ?? 'none'}`,
          cleanupResult.error
        );
      } catch (error) {
        const technicalDetails = error instanceof Error ? error.message : String(error);
        const warning = `Secret cleanup warning for ${SECRET_KEY_PREFIX}${scope}: ${technicalDetails}`;
        options.errors.push(warning);
        console.warn(
          `[install] ${warning}; reason=${options.reason}; technical=${technicalDetails}`,
          error
        );
      }
    }
  }

  /**
   * Start installation for target
   * @param target - 'openclaw' or 'nemoclaw'
   * @param correlationId - Unique ID for this install session
   */
  async start(target: InstallTarget, correlationId: string): Promise<void> {
    this.correlationId = correlationId;
    this.target = target;
    this.cancelled = false;

    // Load existing state to find completed steps (for retry)
    const existingState = this.loadStateSafe();
    const completedSteps: number[] = existingState?.completedSteps ?? [];
    const totalSteps = INSTALL_STEPS.length;

    try {
      // Guardrail: block installation immediately when hard prerequisites fail.
      if (process.env.NODE_ENV !== 'test' && !this.isDevInstallSimulationEnabled()) {
        const prerequisiteResult = await runAllPrerequisiteChecks();
        const failedChecks = prerequisiteResult.checks.filter((check) => check.status === 'failed');
        if (failedChecks.length > 0) {
          const details = failedChecks
            .map((check) => `${check.name}: ${check.result.message}`)
            .join('\n');
          throw new Error(`Prerequisite checks failed.\n${details}`);
        }
      }

      for (const step of INSTALL_STEPS) {
        // Check for cancellation before each step
        if (this.cancelled) {
          return;
        }

        // Skip completed steps (D-13 retry support)
        if (completedSteps.includes(step.id)) {
          continue;
        }

        // Save state before starting step
        this.saveStateSafe({
          target,
          status: 'running',
          currentStep: step.id,
          totalSteps,
          stepName: step.name,
          updatedAt: new Date().toISOString(),
          completedSteps,
        });

        // Create progress callback
        const onProgress: ProgressCallback = (progress) => {
          this.emitProgress(progress);
        };

        // Execute step
        await step.execute(target, correlationId, onProgress);

        // Mark step as completed
        completedSteps.push(step.id);
        this.saveStateSafe({
          target,
          status: 'running',
          currentStep: step.id,
          totalSteps,
          stepName: step.name,
          updatedAt: new Date().toISOString(),
          completedSteps,
        });
      }

      // All steps complete
      this.saveStateSafe({
        target,
        status: 'completed',
        currentStep: totalSteps,
        totalSteps,
        updatedAt: new Date().toISOString(),
        completedSteps,
      });

      this.emitComplete();
      this.clearStateSafe();
    } catch (error) {
      if (this.cancelled || error instanceof InstallCommandCancelledError) {
        return;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorDetails = error instanceof Error ? error.stack : undefined;

      // Save failed state
      this.saveStateSafe({
        target,
        status: 'failed',
        currentStep: INSTALL_STEPS.findIndex((s) => !completedSteps.includes(s.id)) + 1,
        totalSteps,
        errorMessage,
        errorDetails,
        updatedAt: new Date().toISOString(),
        completedSteps,
      });

      this.emitError({
        correlationId,
        message: errorMessage,
        details: errorDetails,
        step: INSTALL_STEPS.findIndex((s) => !completedSteps.includes(s.id)) + 1,
      });
    }
  }

  /**
   * Cancel installation and rollback artifacts (D-14, D-15)
   */
  async cancel(): Promise<{ removed: string[]; errors?: string[] }> {
    this.cancelled = true;
    console.info('[install] Cancel requested');
    await cancelActiveInstallCommand(this.correlationId ?? undefined);
    const removed = await rollbackService.rollback();
    const errors: string[] = [];
    this.cleanupScopedSecrets({
      errors,
      reason: 'cancel',
    });

    // Run potentially long external uninstall operations in background so cancel returns quickly.
    void this.cleanupInstalledBinaries({
      removed,
      errors,
      reason: 'cancel',
    });

    this.saveStateSafe({
      target: this.target ?? 'openclaw',
      status: 'rolled_back',
      currentStep: 0,
      totalSteps: INSTALL_STEPS.length,
      updatedAt: new Date().toISOString(),
      completedSteps: [],
    });

    this.clearStateSafe();
    return errors.length > 0 ? { removed, errors } : { removed };
  }

  /**
   * Uninstall OpenClaw/NemoClaw stack binaries from Settings
   */
  async uninstallStack(): Promise<{ removed: string[]; errors?: string[] }> {
    const removed: string[] = [];
    const errors: string[] = [];
    this.cleanupScopedSecrets({
      errors,
      reason: 'manual-uninstall',
    });
    await this.cleanupInstalledBinaries({
      removed,
      errors,
      reason: 'manual-uninstall',
    });

    return errors.length > 0 ? { removed, errors } : { removed };
  }

  /**
   * Retry from failed step (D-13)
   */
  async retry(): Promise<void> {
    const state = loadInstallState();
    if (!state || !this.correlationId) {
      throw new Error('No install state to retry');
    }

    await this.start(state.target, this.correlationId);
  }

  /**
   * Get current install state from database (D-16)
   */
  getState(): InstallState | null {
    return this.loadStateSafe();
  }
}

// Singleton instance
export const installOrchestrator = new InstallOrchestrator();
