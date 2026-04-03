import { z } from 'zod';

export const RUNTIME_CHANNELS = {
  startSession: 'runtime:v1:startSession',
  stopSession: 'runtime:v1:stopSession',
  getSessions: 'runtime:v1:getSessions',

  runPlugin: 'runtime:v1:runPlugin',
  cancelPluginRun: 'runtime:v1:cancelPluginRun',
  getPluginRuns: 'runtime:v1:getPluginRuns',

  getHistory: 'runtime:v1:getHistory',

  sessionEvent: 'runtime:v1:sessionEvent',
  pluginEvent: 'runtime:v1:pluginEvent',
} as const;

export const startSessionSchema = z.object({
  sessionId: z.string().min(1),
  config: z
    .object({
      healthEndpoint: z.string().optional(),
      readinessTimeoutMs: z.number().positive().optional(),
    })
    .optional(),
});

export const stopSessionSchema = z.object({
  sessionId: z.string().min(1),
  strategy: z.enum(['graceful', 'force']).optional(),
});

export const getSessionsSchema = z.object({});

export const getHistorySchema = z.object({
  operationType: z.enum(['session_start', 'session_stop', 'plugin_run']).optional(),
  status: z.enum(['success', 'failed', 'cancelled']).optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  limit: z.number().positive().optional(),
});

export const runPluginSchema = z.object({
  runId: z.string().min(1),
  pluginName: z.string().min(1),
  sessionId: z.string().min(1),
  args: z.record(z.unknown()).optional(),
});

export const cancelPluginSchema = z.object({
  runId: z.string().min(1),
});

export const getPluginRunsSchema = z.object({
  sessionId: z.string().optional(),
});

export type StartSessionInput = z.infer<typeof startSessionSchema>;
export type StopSessionInput = z.infer<typeof stopSessionSchema>;
export type GetSessionsInput = z.infer<typeof getSessionsSchema>;
export type GetHistoryInput = z.infer<typeof getHistorySchema>;
export type RunPluginInput = z.infer<typeof runPluginSchema>;
export type CancelPluginInput = z.infer<typeof cancelPluginSchema>;
export type GetPluginRunsInput = z.infer<typeof getPluginRunsSchema>;
