import { z } from 'zod';

// Versioned IPC channel constants
export const PLATFORM_CHANNELS = {
  runProcess: 'platform:v1:runProcess',
  stopProcess: 'platform:v1:stopProcess',
  getPaths: 'platform:v1:getPaths',
} as const;

// Zod schemas for runtime validation

export const runProcessSchema = z.object({
  command: z.string().min(1),
  args: z.array(z.string()).optional(),
  cwd: z.string().optional(),
  env: z.record(z.string(), z.string()).optional(),
  timeoutMs: z.number().positive().optional(),
  correlationId: z.string().min(1),
});

export const stopProcessSchema = z.object({
  correlationId: z.string().min(1),
  strategy: z.enum(['graceful', 'timeout', 'force']).optional(),
});

export const getPathsSchema = z.object({
  paths: z.array(z.string()),
});

export type RunProcessInput = z.infer<typeof runProcessSchema>;
export type StopProcessInput = z.infer<typeof stopProcessSchema>;
export type GetPathsInput = z.infer<typeof getPathsSchema>;
