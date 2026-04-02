import { BrowserWindow } from 'electron';
import { INSTALL_CHANNELS } from '../../shared/install/install-channels';
import type {
  InstallTarget,
  InstallProgress,
  InstallError,
  InstallState,
} from '../../shared/install/install-contracts';
import { saveInstallState, loadInstallState, clearInstallState } from './install-state-service';
import { rollbackService } from './rollback-service';
import { INSTALL_STEPS, ProgressCallback } from './install-steps';

/**
 * Orchestrates install flow with progress events, state persistence, and rollback support
 */
export class InstallOrchestrator {
  private correlationId: string | null = null;
  private target: InstallTarget | null = null;
  private cancelled = false;
  private window: BrowserWindow | null = null;

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
    const existingState = loadInstallState();
    const completedSteps: number[] = existingState?.completedSteps ?? [];
    const totalSteps = INSTALL_STEPS.length;

    try {
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
        saveInstallState({
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
        saveInstallState({
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
      saveInstallState({
        target,
        status: 'completed',
        currentStep: totalSteps,
        totalSteps,
        updatedAt: new Date().toISOString(),
        completedSteps,
      });

      this.emitComplete();
      clearInstallState();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorDetails = error instanceof Error ? error.stack : undefined;

      // Save failed state
      saveInstallState({
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
  async cancel(): Promise<{ removed: string[] }> {
    this.cancelled = true;
    const removed = await rollbackService.rollback();

    saveInstallState({
      target: this.target ?? 'openclaw',
      status: 'rolled_back',
      currentStep: 0,
      totalSteps: INSTALL_STEPS.length,
      updatedAt: new Date().toISOString(),
      completedSteps: [],
    });

    clearInstallState();
    return { removed };
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
    return loadInstallState();
  }
}

// Singleton instance
export const installOrchestrator = new InstallOrchestrator();
