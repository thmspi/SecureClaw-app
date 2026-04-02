import { useEffect, useRef } from 'react';
import { useWizardStore } from '@/stores/wizard-store';
import type { InstallState } from '@shared/install/install-contracts';

function isElectronRenderer(): boolean {
  return typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron');
}

function isInstallApiAvailable(): boolean {
  return Boolean(window.secureClaw?.install?.start && window.secureClaw?.install?.onProgress);
}

function syncFromInstallState(
  state: InstallState,
  updateInstallProgress: ReturnType<typeof useWizardStore.getState>['updateInstallProgress']
): void {
  const current = useWizardStore.getState().install;
  const estimatedProgress =
    state.totalSteps > 0
      ? Math.max(0, Math.min(100, (Math.max(0, state.currentStep - 1) / state.totalSteps) * 100))
      : 0;

  switch (state.status) {
    case 'running':
    case 'paused':
      updateInstallProgress({
        status: state.status,
        currentStep: state.currentStep,
        totalSteps: state.totalSteps,
        stepName: state.stepName ?? '',
        // Keep the most advanced visible progress so polling does not regress event-driven updates.
        progress: Math.max(current.progress, estimatedProgress),
        error: undefined,
      });
      break;
    case 'failed':
      updateInstallProgress({
        status: 'failed',
        currentStep: state.currentStep,
        totalSteps: state.totalSteps,
        stepName: state.stepName ?? '',
        progress: Math.max(current.progress, estimatedProgress),
        error: state.errorMessage
          ? {
              message: state.errorMessage,
              details: state.errorDetails,
            }
          : { message: 'Installation failed' },
      });
      break;
    case 'completed':
      updateInstallProgress({
        status: 'completed',
        currentStep: state.totalSteps,
        totalSteps: state.totalSteps,
        stepName: state.stepName ?? 'Completed',
        progress: 100,
        estimatedTimeRemaining: 0,
        error: undefined,
      });
      break;
    case 'rolled_back':
      updateInstallProgress({
        status: 'idle',
        currentStep: 0,
        totalSteps: current.totalSteps,
        stepName: '',
        progress: 0,
        estimatedTimeRemaining: undefined,
        error: undefined,
      });
      break;
    default:
      break;
  }
}

/**
 * Hook for managing install progress via IPC events
 */
export function useInstallProgress() {
  const updateInstallProgress = useWizardStore((s) => s.updateInstallProgress);
  const appendLog = useWizardStore((s) => s.appendLog);
  const setStep = useWizardStore((s) => s.setStep);
  const lastLoggedProgressEvent = useRef<string>('');

  // Subscribe to IPC events on mount (only if Electron IPC available)
  useEffect(() => {
    let poll: number | undefined;

    if (window.secureClaw?.install?.getState) {
      void window.secureClaw.install.getState().then((state) => {
        if (!state) {
          return;
        }
        syncFromInstallState(state, updateInstallProgress);
      });

      poll = window.setInterval(() => {
        void window.secureClaw.install
          .getState()
          .then((state) => {
            if (!state) {
              return;
            }
            syncFromInstallState(state, updateInstallProgress);
          })
          .catch(() => {
            // Ignore transient IPC issues; event stream may still be active.
          });
      }, 1500);
    }

    // Skip IPC subscription in browser dev mode
    if (!window.secureClaw?.install?.onProgress) {
      if (isElectronRenderer()) {
        updateInstallProgress({
          status: 'failed',
          error: {
            message: 'Install API bridge unavailable in Electron renderer',
            details: 'Preload did not expose window.secureClaw.install.*',
          },
        });
        appendLog('❌ Install API unavailable: preload bridge missing');
      }
      return () => {
        if (poll !== undefined) {
          window.clearInterval(poll);
        }
      };
    }

    const unsubProgress = window.secureClaw.install.onProgress((progress) => {
      updateInstallProgress({
        currentStep: progress.step,
        totalSteps: progress.totalSteps,
        stepName: progress.stepName,
        progress: progress.overallProgress,
        estimatedTimeRemaining: progress.estimatedTimeRemaining,
        status: 'running',
      });
      const eventKey = `${progress.step}:${Math.round(progress.progress)}`;
      if (lastLoggedProgressEvent.current !== eventKey) {
        if (progress.progress <= 0) {
          appendLog(`Step ${progress.step}/${progress.totalSteps}: ${progress.stepName}`);
        } else if (progress.progress >= 100) {
          appendLog(`Completed step ${progress.step}/${progress.totalSteps}: ${progress.stepName}`);
        }
        lastLoggedProgressEvent.current = eventKey;
      }
    });

    const unsubError = window.secureClaw.install.onError((error) => {
      updateInstallProgress({
        status: 'failed',
        error: {
          message: error.message,
          details: error.details,
        },
      });
      appendLog(`❌ Error: ${error.message}`);
    });

    const unsubComplete = window.secureClaw.install.onComplete(() => {
      updateInstallProgress({
        status: 'completed',
        progress: 100,
        estimatedTimeRemaining: 0,
      });
      appendLog('✅ Installation completed successfully');
    });

    return () => {
      if (poll !== undefined) {
        window.clearInterval(poll);
      }
      unsubProgress();
      unsubError();
      unsubComplete();
    };
  }, [updateInstallProgress, appendLog, setStep]);

  const start = async (target: 'openclaw' | 'nemoclaw') => {
    lastLoggedProgressEvent.current = '';
    updateInstallProgress({
      status: 'running',
      error: undefined,
      logs: [],
      progress: 0,
      currentStep: 0,
      totalSteps: 6,
      stepName: '',
    });
    appendLog(`Starting installation...`);
    
    // Use real IPC if available, otherwise mock only in plain browser dev mode
    if (window.secureClaw?.install?.start) {
      const { correlationId } = await window.secureClaw.install.start(target);
      appendLog(`Install session: ${correlationId}`);
    } else if (isElectronRenderer()) {
      updateInstallProgress({
        status: 'failed',
        error: {
          message: 'Cannot start install: missing Electron preload install API',
        },
      });
      appendLog('❌ Missing preload install API in Electron');
      throw new Error('Missing preload install API in Electron');
    } else {
      // Mock install simulation for browser dev
      simulateMockInstall(updateInstallProgress, appendLog, setStep);
    }
  };

  const cancel = async () => {
    lastLoggedProgressEvent.current = '';
    appendLog('Cancelling installation...');
    if (window.secureClaw?.install?.cancel) {
      const result = await window.secureClaw.install.cancel();
      appendLog(`Removed ${result.removed.length} artifacts`);
    }
    updateInstallProgress({
      status: 'idle',
      progress: 0,
      currentStep: 0,
      stepName: '',
      estimatedTimeRemaining: undefined,
    });
  };

  const retry = async () => {
    lastLoggedProgressEvent.current = '';
    appendLog('Retrying installation...');
    updateInstallProgress({
      status: 'running',
      error: undefined,
      estimatedTimeRemaining: undefined,
    });
    if (window.secureClaw?.install?.retry) {
      await window.secureClaw.install.retry();
    } else if (isElectronRenderer()) {
      updateInstallProgress({
        status: 'failed',
        error: {
          message: 'Cannot retry install: missing Electron preload install API',
        },
      });
      appendLog('❌ Missing preload install API in Electron');
      throw new Error('Missing preload install API in Electron');
    } else {
      simulateMockInstall(updateInstallProgress, appendLog, setStep);
    }
  };

  return { start, cancel, retry };
}

// Mock install simulation for browser dev mode
function simulateMockInstall(
  updateInstallProgress: ReturnType<typeof useWizardStore.getState>['updateInstallProgress'],
  appendLog: ReturnType<typeof useWizardStore.getState>['appendLog'],
  setStep: ReturnType<typeof useWizardStore.getState>['setStep']
) {
  const steps = [
    'Authorizing Installation...',
    'Installing OpenClaw...',
    'Verifying OpenClaw...',
    'Installing NemoClaw...',
    'Verifying NemoClaw...',
    'Finalizing...',
  ];

  const totalSteps = steps.length;

  let currentStep = 0;
  const runStep = () => {
    if (currentStep >= totalSteps) {
      updateInstallProgress({
        status: 'completed',
        progress: 100,
        estimatedTimeRemaining: 0,
      });
      appendLog('✅ Installation completed successfully');
      setStep('complete');
      return;
    }

    updateInstallProgress({
      currentStep: currentStep + 1,
      totalSteps,
      stepName: steps[currentStep],
      progress: ((currentStep + 1) / totalSteps) * 100,
      status: 'running',
    });
    appendLog(steps[currentStep]);
    currentStep++;
    setTimeout(runStep, 1000);
  };

  runStep();
}
