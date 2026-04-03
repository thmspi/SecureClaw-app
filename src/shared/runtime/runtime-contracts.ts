export type SessionState = 'Idle' | 'Starting' | 'Active' | 'Stopping' | 'Stopped';
export type SessionEventType = 'starting' | 'active' | 'stopping' | 'stopped' | 'error';

export interface SessionEvent {
  type: SessionEventType;
  sessionId: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface ManagedSession {
  sessionId: string;
  state: SessionState;
  pid?: number;
  startedAt?: string;
  activeAt?: string;
  stoppedAt?: string;
  error?: string;
}

export interface StartSessionRequest {
  sessionId: string;
  config?: {
    healthEndpoint?: string;
    readinessTimeoutMs?: number;
  };
}

export interface StartSessionResponse {
  sessionId: string;
  started: boolean;
  error?: string;
}

export interface StopSessionRequest {
  sessionId: string;
  strategy?: 'graceful' | 'force';
}

export interface StopSessionResponse {
  sessionId: string;
  stopped: boolean;
  error?: string;
}

export interface GetSessionsRequest {}

export interface GetSessionsResponse {
  sessions: ManagedSession[];
}

export type OperationType = 'session_start' | 'session_stop' | 'plugin_run';
export type OperationStatus = 'success' | 'failed' | 'cancelled';

export interface RuntimeHistoryRecord {
  id: string;
  operationType: OperationType;
  status: OperationStatus;
  targetName?: string;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  errorMessage?: string;
  errorDetails?: string;
  metadata?: Record<string, unknown>;
}

export interface GetHistoryRequest {
  operationType?: OperationType;
  status?: OperationStatus;
  fromDate?: string;
  toDate?: string;
  limit?: number;
}

export interface GetHistoryResponse {
  records: RuntimeHistoryRecord[];
  total: number;
}

export type PluginRunState =
  | 'Idle'
  | 'Queued'
  | 'Starting'
  | 'Running'
  | 'Completed'
  | 'Failed';

export type PluginEventType =
  | 'queued'
  | 'starting'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface PluginEvent {
  type: PluginEventType;
  runId: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface PluginRun {
  runId: string;
  pluginName: string;
  sessionId: string;
  state: PluginRunState;
  queuedAt?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  error?: string;
  progress?: number;
  logs: string[];
}

export interface RunPluginRequest {
  runId: string;
  pluginName: string;
  sessionId: string;
  args?: Record<string, unknown>;
}

export interface RunPluginResponse {
  runId: string;
  queued: boolean;
  error?: string;
}

export interface CancelPluginRequest {
  runId: string;
}

export interface CancelPluginResponse {
  runId: string;
  cancelled: boolean;
  error?: string;
}

export interface GetPluginRunsRequest {
  sessionId?: string;
}

export interface GetPluginRunsResponse {
  runs: PluginRun[];
}

export interface PluginPackage {
  id: string;
  displayName: string;
  version?: string;
  enabled: boolean;
  description?: string;
  source: 'local' | 'registry' | 'unknown';
}

export interface ListPluginPackagesResponse {
  packages: PluginPackage[];
  error?: string;
}

export interface ValidatePluginPackageRequest {
  packageName: string;
}

export interface ValidatePluginPackageResponse {
  valid: boolean;
  packageName: string;
  plugin?: PluginPackage;
  error?: string;
}

export interface ImportPluginPackageRequest {
  packageName: string;
}

export interface ImportPluginPackageResponse {
  imported: boolean;
  packageName: string;
  plugin?: PluginPackage;
  error?: string;
}

export interface UninstallPluginPackageRequest {
  pluginId: string;
}

export interface UninstallPluginPackageResponse {
  uninstalled: boolean;
  pluginId: string;
  error?: string;
}
