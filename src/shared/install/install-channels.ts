import { z } from 'zod';

// Versioned IPC channel constants for install operations
export const INSTALL_CHANNELS = {
  start: 'install:v1:start',
  cancel: 'install:v1:cancel',
  retry: 'install:v1:retry',
  getState: 'install:v1:getState',
  runPrerequisites: 'install:v1:runPrerequisites',
  startDockerDaemon: 'install:v1:startDockerDaemon',
  // Events (main → renderer)
  progress: 'install:v1:progress',
  error: 'install:v1:error',
  complete: 'install:v1:complete',
} as const;

// Zod schemas for runtime validation

export const installStartSchema = z.object({
  target: z.enum(['openclaw', 'nemoclaw']),
});

export const installProgressSchema = z.object({
  correlationId: z.string(),
  step: z.number(),
  totalSteps: z.number(),
  stepName: z.string(),
  progress: z.number().min(0).max(100),
  overallProgress: z.number().min(0).max(100),
  estimatedTimeRemaining: z.number().optional(),
});

export const prerequisiteResultSchema = z.object({
  allPassed: z.boolean(),
  checks: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      status: z.enum(['passed', 'failed', 'warning']),
      result: z.object({
        value: z.string().optional(),
        required: z.string().optional(),
        message: z.string(),
        action: z.literal('start-docker-daemon').optional(),
      }),
    })
  ),
});

export type InstallStartInput = z.infer<typeof installStartSchema>;
export type InstallProgressInput = z.infer<typeof installProgressSchema>;
export type PrerequisiteResultInput = z.infer<typeof prerequisiteResultSchema>;
