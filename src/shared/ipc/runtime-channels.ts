import { z } from 'zod';

export const RUNTIME_CHANNELS = {
  startSession: 'runtime:v1:startSession',
  stopSession: 'runtime:v1:stopSession',
  getSessions: 'runtime:v1:getSessions',

  runPlugin: 'runtime:v1:runPlugin',
  cancelPluginRun: 'runtime:v1:cancelPluginRun',
  getPluginRuns: 'runtime:v1:getPluginRuns',
  listPluginPackages: 'runtime:v1:listPluginPackages',
  validatePluginPackage: 'runtime:v1:validatePluginPackage',
  importPluginPackage: 'runtime:v1:importPluginPackage',
  uninstallPluginPackage: 'runtime:v1:uninstallPluginPackage',
  setPluginPackageEnabled: 'runtime:v1:setPluginPackageEnabled',

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
  args: z.record(z.string(), z.unknown()).optional(),
});

export const cancelPluginSchema = z.object({
  runId: z.string().min(1),
});

export const getPluginRunsSchema = z.object({
  sessionId: z.string().optional(),
});

export const listPluginPackagesSchema = z.object({});

export const validatePluginPackageSchema = z.object({
  packageName: z.string().min(1),
});

export const importPluginPackageSchema = z.object({
  packageName: z.string().min(1),
});

export const uninstallPluginPackageSchema = z.object({
  pluginId: z.string().min(1),
});

export const setPluginPackageEnabledSchema = z.object({
  pluginId: z.string().min(1),
  enabled: z.boolean(),
});

export type StartSessionInput = z.infer<typeof startSessionSchema>;
export type StopSessionInput = z.infer<typeof stopSessionSchema>;
export type GetSessionsInput = z.infer<typeof getSessionsSchema>;
export type GetHistoryInput = z.infer<typeof getHistorySchema>;
export type RunPluginInput = z.infer<typeof runPluginSchema>;
export type CancelPluginInput = z.infer<typeof cancelPluginSchema>;
export type GetPluginRunsInput = z.infer<typeof getPluginRunsSchema>;
export type ListPluginPackagesInput = z.infer<typeof listPluginPackagesSchema>;
export type ValidatePluginPackageInput = z.infer<typeof validatePluginPackageSchema>;
export type ImportPluginPackageInput = z.infer<typeof importPluginPackageSchema>;
export type UninstallPluginPackageInput = z.infer<typeof uninstallPluginPackageSchema>;
export type SetPluginPackageEnabledInput = z.infer<typeof setPluginPackageEnabledSchema>;
