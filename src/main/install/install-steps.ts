import type { InstallTarget, InstallProgress } from '../../shared/install';
import { rollbackService } from './rollback-service';

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

/**
 * Simulates progress updates during step execution
 */
async function simulateProgress(
  stepId: number,
  totalSteps: number,
  stepName: string,
  correlationId: string,
  onProgress: ProgressCallback,
  durationMs: number = 500
): Promise<void> {
  const steps = 10;
  const intervalMs = durationMs / steps;

  for (let i = 0; i <= steps; i++) {
    const stepProgress = (i / steps) * 100;
    const overallProgress = ((stepId - 1) / totalSteps) * 100 + (stepProgress / totalSteps);

    onProgress({
      correlationId,
      step: stepId,
      totalSteps,
      stepName,
      progress: stepProgress,
      overallProgress,
    });

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

export const INSTALL_STEPS: InstallStepConfig[] = [
  {
    id: 1,
    name: 'Preparing environment',
    description: 'Setting up installation directories',
    execute: async (target, correlationId, onProgress) => {
      await simulateProgress(1, 5, 'Preparing environment', correlationId, onProgress);
      // Track created directory for rollback
      rollbackService.track({
        type: 'directory',
        path: `/Applications/${target === 'openclaw' ? 'OpenClaw' : 'NemoClaw'}`,
        createdAt: new Date().toISOString(),
      });
    },
  },
  {
    id: 2,
    name: 'Downloading',
    description: 'Downloading package from repository',
    execute: async (_target, correlationId, onProgress) => {
      await simulateProgress(2, 5, 'Downloading', correlationId, onProgress, 1000);
      // Would download actual package here
    },
  },
  {
    id: 3,
    name: 'Extracting files',
    description: 'Extracting package contents',
    execute: async (target, correlationId, onProgress) => {
      await simulateProgress(3, 5, 'Extracting files', correlationId, onProgress);
      // Track extracted files
      rollbackService.track({
        type: 'file',
        path: `/Applications/${target === 'openclaw' ? 'OpenClaw' : 'NemoClaw'}/config.json`,
        createdAt: new Date().toISOString(),
      });
    },
  },
  {
    id: 4,
    name: 'Installing dependencies',
    description: 'Installing required dependencies',
    execute: async (_target, correlationId, onProgress) => {
      await simulateProgress(4, 5, 'Installing dependencies', correlationId, onProgress, 800);
      // Would run npm install or similar
    },
  },
  {
    id: 5,
    name: 'Finalizing',
    description: 'Completing installation',
    execute: async (_target, correlationId, onProgress) => {
      await simulateProgress(5, 5, 'Finalizing', correlationId, onProgress);
      // Final configuration steps
    },
  },
];
