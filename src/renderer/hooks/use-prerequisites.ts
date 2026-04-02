import { useCallback } from 'react';
import { useWizardStore } from '@/stores/wizard-store';

/**
 * Hook for running prerequisite checks via IPC
 */
export function usePrerequisites() {
  const setPrerequisitesLoading = useWizardStore((s) => s.setPrerequisitesLoading);
  const updatePrerequisite = useWizardStore((s) => s.updatePrerequisite);
  const setAllPrerequisitesPassed = useWizardStore((s) => s.setAllPrerequisitesPassed);

  const runChecks = useCallback(async () => {
    setPrerequisitesLoading(true);
    try {
      const result = await window.secureClaw.install.runPrerequisites();
      result.checks.forEach((check) => {
        updatePrerequisite(check.id, {
          ...check,
          status: check.status as 'passed' | 'failed' | 'warning' | 'pending',
        });
      });
      setAllPrerequisitesPassed(result.allPassed);
    } finally {
      setPrerequisitesLoading(false);
    }
  }, [setPrerequisitesLoading, updatePrerequisite, setAllPrerequisitesPassed]);

  return { runChecks };
}
