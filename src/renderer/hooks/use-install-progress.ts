import { useEffect } from 'react';
import { useWizardStore } from '@/stores/wizard-store';

/**
 * Hook for managing install progress via IPC events
 */
export function useInstallProgress() {
  const updateInstallProgress = useWizardStore((s) => s.updateInstallProgress);
  const appendLog = useWizardStore((s) => s.appendLog);
  const setStep = useWizardStore((s) => s.setStep);

  // Subscribe to IPC events on mount
  useEffect(() => {
    const unsubProgress = window.secureClaw.install.onProgress((progress) => {
      updateInstallProgress({
        currentStep: progress.step,
        totalSteps: progress.totalSteps,
        stepProgress: progress.percent,
        status: progress.status,
        message: progress.detail,
      });
      if (progress.detail) {
        appendLog(progress.detail);
      }
    });

    const unsubError = window.secureClaw.install.onError((error) => {
      updateInstallProgress({
        status: 'error',
        message: error.message,
      });
      appendLog(`❌ Error: ${error.message}`);
      if (error.recoveryOptions) {
        appendLog(`Recovery options: ${error.recoveryOptions.join(', ')}`);
      }
    });

    const unsubComplete = window.secureClaw.install.onComplete(() => {
      updateInstallProgress({
        status: 'idle',
        message: 'Installation complete',
      });
      appendLog('✅ Installation completed successfully');
      setStep('complete');
    });

    return () => {
      unsubProgress();
      unsubError();
      unsubComplete();
    };
  }, [updateInstallProgress, appendLog, setStep]);

  const start = async (target: 'openclaw' | 'nemoclaw') => {
    updateInstallProgress({ status: 'running', message: `Starting ${target} installation...` });
    appendLog(`Starting ${target} installation...`);
    await window.secureClaw.install.start(target);
  };

  const cancel = async () => {
    appendLog('Cancelling installation...');
    const result = await window.secureClaw.install.cancel();
    updateInstallProgress({ status: 'idle', message: 'Installation cancelled' });
    appendLog(`Removed ${result.removed.length} artifacts`);
  };

  const retry = async () => {
    appendLog('Retrying installation...');
    updateInstallProgress({ status: 'running', message: 'Retrying...' });
    await window.secureClaw.install.retry();
  };

  return { start, cancel, retry };
}
