// Platform contracts - single source of truth for platform request/response/event shapes

export type ProcessEventType =
  | 'spawned'
  | 'stdout'
  | 'stderr'
  | 'stopping'
  | 'exited'
  | 'error'
  | 'timeout';

export interface ProcessEvent {
  type: ProcessEventType;
  correlationId: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface RunProcessRequest {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
  correlationId: string;
}

export interface RunProcessResponse {
  correlationId: string;
  started: boolean;
  pid?: number;
  error?: string;
}

export interface StopProcessRequest {
  correlationId: string;
  strategy?: 'graceful' | 'timeout' | 'force';
}

export interface StopProcessResponse {
  correlationId: string;
  stopped: boolean;
  error?: string;
}

export type PathType =
  | 'userData'
  | 'appData'
  | 'temp'
  | 'logs'
  | 'cache';

export interface GetPathsRequest {
  paths: string[];
}

export interface GetPathsResponse {
  paths: Record<string, string>;
  error?: string;
}
