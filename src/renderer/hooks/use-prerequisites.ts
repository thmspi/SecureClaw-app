import { useCallback } from 'react';
import { useWizardStore } from '@/stores/wizard-store';
import type { PrerequisiteResult } from '@shared/install/install-contracts';

/**
 * Hook for running prerequisite checks via IPC
 */
export function usePrerequisites() {
  const setPrerequisitesLoading = useWizardStore((s) => s.setPrerequisitesLoading);
  const setPrerequisites = useWizardStore((s) => s.setPrerequisites);
  const setAllPrerequisitesPassed = useWizardStore((s) => s.setAllPrerequisitesPassed);

  const runChecks = useCallback(async () => {
    setPrerequisitesLoading(true);
    try {
      let result: PrerequisiteResult;
      if (window.secureClaw?.install?.runPrerequisites) {
        result = await window.secureClaw.install.runPrerequisites();
      } else {
        result = {
          allPassed: false,
          checks: [
            {
              id: 'ipc-bridge',
              name: 'Prerequisite service bridge',
              description: 'Main process prerequisite checks are required',
              status: 'failed',
              result: {
                message:
                  'Real prerequisite checks are unavailable because window.secureClaw.install.runPrerequisites is missing.',
              },
            },
          ],
        };
      }

      const checksById = Object.fromEntries(
        result.checks.map((check) => [
          check.id,
          {
            ...check,
            status: check.status as 'passed' | 'failed' | 'warning' | 'pending',
          },
        ])
      );
      setPrerequisites(checksById);
      setAllPrerequisitesPassed(result.allPassed);
    } finally {
      setPrerequisitesLoading(false);
    }
  }, [setPrerequisitesLoading, setPrerequisites, setAllPrerequisitesPassed]);

  const startDockerDaemon = useCallback(async () => {
    if (!window.secureClaw?.install?.startDockerDaemon) {
      throw new Error(
        'Real Docker start is unavailable because window.secureClaw.install.startDockerDaemon is missing.'
      );
    }
    return window.secureClaw.install.startDockerDaemon();
  }, []);

  return { runChecks, startDockerDaemon };
}
