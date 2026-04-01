// Runtime service facade - exposes only platform trio methods
// Delegates all operations to process-runner

import {
  runProcess as runProcessImpl,
  stopProcess as stopProcessImpl,
  type RunProcessOptions,
  type StopOptions,
} from './process-runner';
import { getAppDataDir, getLogsDir, getWorkDir, getManagedCacheDir } from '../platform';
import type {
  RunProcessRequest,
  RunProcessResponse,
  StopProcessRequest,
  StopProcessResponse,
  GetPathsRequest,
  GetPathsResponse,
  ProcessEvent,
} from '../../shared/platform/contracts';

// Active event listeners for IPC communication
const eventListeners = new Map<string, (event: ProcessEvent) => void>();

export function registerEventListener(
  correlationId: string,
  listener: (event: ProcessEvent) => void
): void {
  eventListeners.set(correlationId, listener);
}

export function unregisterEventListener(correlationId: string): void {
  eventListeners.delete(correlationId);
}

export async function runProcess(request: RunProcessRequest): Promise<RunProcessResponse> {
  const listener = eventListeners.get(request.correlationId);
  
  const options: RunProcessOptions = {
    command: request.command,
    args: request.args,
    cwd: request.cwd,
    env: request.env,
    timeoutMs: request.timeoutMs,
    correlationId: request.correlationId,
    onEvent: listener,
  };

  try {
    await runProcessImpl(options);
    return {
      correlationId: request.correlationId,
      started: true,
    };
  } catch (error) {
    return {
      correlationId: request.correlationId,
      started: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function stopProcess(request: StopProcessRequest): Promise<StopProcessResponse> {
  const stopOptions: StopOptions = {
    strategy: request.strategy,
  };

  try {
    await stopProcessImpl(request.correlationId, stopOptions);
    return {
      correlationId: request.correlationId,
      stopped: true,
    };
  } catch (error) {
    return {
      correlationId: request.correlationId,
      stopped: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function getPaths(request: GetPathsRequest): Promise<GetPathsResponse> {
  const pathResolvers: Record<string, () => string> = {
    userData: getAppDataDir,
    appData: getAppDataDir,
    logs: getLogsDir,
    cache: getManagedCacheDir,
  };

  const paths: Record<string, string> = {};
  
  for (const pathType of request.paths) {
    const resolver = pathResolvers[pathType];
    if (resolver) {
      paths[pathType] = resolver();
    } else if (pathType.startsWith('work:')) {
      const projectId = pathType.substring(5);
      paths[pathType] = getWorkDir(projectId);
    }
  }

  return { paths };
}
