import { useCallback } from 'react';
import { useWizardStore } from '@/stores/wizard-store';
import type { PrerequisiteResult } from '@shared/install/install-contracts';

// Mock for browser dev mode (no Electron)
const mockPrerequisiteResult: PrerequisiteResult = {
  allPassed: true,
  checks: [
    { id: 'node', name: 'Node.js', status: 'passed', result: { value: '20.17.0', required: '>=18.0.0', message: 'Node.js 20.17.0 installed' } },
    { id: 'python', name: 'Python', status: 'passed', result: { value: '3.12.0', required: '>=3.10.0', message: 'Python 3.12.0 installed' } },
    { id: 'disk', name: 'Disk Space', status: 'passed', result: { value: '50GB', required: '>=5GB', message: '50GB available' } },
    { id: 'permissions', name: 'Write Permissions', status: 'passed', result: { message: 'Write access confirmed' } },
    { id: 'network', name: 'Network', status: 'passed', result: { message: 'Online' } },
  ],
};

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
      // Use real IPC if available, otherwise mock for browser dev
      const result = window.secureClaw?.install?.runPrerequisites
        ? await window.secureClaw.install.runPrerequisites()
        : await new Promise<PrerequisiteResult>((resolve) => {
            // Simulate async check with delay
            setTimeout(() => resolve(mockPrerequisiteResult), 1500);
          });

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
