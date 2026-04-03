import { runProcess, stopProcess } from './process-runner';
import { getSessions } from './session-orchestrator';
import type {
  CancelPluginRequest,
  CancelPluginResponse,
  GetPluginRunsRequest,
  GetPluginRunsResponse,
  PluginEvent,
  PluginEventType,
  PluginRun,
  RunPluginRequest,
  RunPluginResponse,
} from '../../shared/runtime/runtime-contracts';

const MAX_CONCURRENT_PLUGINS = 3;

const pluginRuns = new Map<string, PluginRun>();
const pluginQueue: RunPluginRequest[] = [];
const activePlugins = new Set<string>();
const pluginEventListeners = new Map<string, (event: PluginEvent) => void>();
const cancelledPlugins = new Set<string>();

function emitPluginEvent(
  runId: string,
  type: PluginEventType,
  data: Record<string, unknown> = {}
): void {
  const listener = pluginEventListeners.get(runId);
  if (!listener) {
    return;
  }

  listener({
    type,
    runId,
    timestamp: new Date().toISOString(),
    data,
  });
}

function processQueue(): void {
  while (pluginQueue.length > 0 && activePlugins.size < MAX_CONCURRENT_PLUGINS) {
    const request = pluginQueue.shift();
    if (!request) {
      return;
    }
    void executePlugin(request);
  }
}

async function executePlugin(request: RunPluginRequest): Promise<void> {
  const run = pluginRuns.get(request.runId);
  if (!run) {
    return;
  }

  activePlugins.add(request.runId);

  try {
    run.state = 'Starting';
    pluginRuns.set(request.runId, { ...run });
    emitPluginEvent(request.runId, 'starting');

    run.state = 'Running';
    run.startedAt = new Date().toISOString();
    pluginRuns.set(request.runId, { ...run });
    emitPluginEvent(request.runId, 'running');

    await runProcess({
      command: 'openclaw',
      args: ['plugin', 'run', request.pluginName, ...(request.args ? [JSON.stringify(request.args)] : [])],
      correlationId: request.runId,
      onEvent: (event) => {
        if (event.type !== 'stdout' && event.type !== 'stderr') {
          return;
        }

        const chunk = event.data.chunk;
        run.logs.push(typeof chunk === 'string' ? chunk : String(chunk ?? ''));
        pluginRuns.set(request.runId, { ...run });
      },
    });

    if (!cancelledPlugins.has(request.runId)) {
      run.state = 'Completed';
      run.completedAt = new Date().toISOString();
      if (run.startedAt) {
        run.durationMs = new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime();
      }
      pluginRuns.set(request.runId, { ...run });
      emitPluginEvent(request.runId, 'completed');
    }
  } catch (error) {
    if (!cancelledPlugins.has(request.runId)) {
      run.state = 'Failed';
      run.completedAt = new Date().toISOString();
      run.error = error instanceof Error ? error.message : String(error);
      if (run.startedAt) {
        run.durationMs = new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime();
      }
      pluginRuns.set(request.runId, { ...run });
      emitPluginEvent(request.runId, 'failed', { error: run.error });
    }
  } finally {
    activePlugins.delete(request.runId);
    cancelledPlugins.delete(request.runId);
    processQueue();
  }
}

export function registerPluginEventListener(
  runId: string,
  listener: (event: PluginEvent) => void
): void {
  pluginEventListeners.set(runId, listener);
}

export function unregisterPluginEventListener(runId: string): void {
  pluginEventListeners.delete(runId);
}

export async function enqueuePlugin(request: RunPluginRequest): Promise<RunPluginResponse> {
  const session = getSessions().find(
    (candidate) => candidate.sessionId === request.sessionId && candidate.state === 'Active'
  );
  if (!session || session.state !== 'Active') {
    return {
      runId: request.runId,
      queued: false,
      error: 'Session not active - start a session before running plugins',
    };
  }

  const run: PluginRun = {
    runId: request.runId,
    pluginName: request.pluginName,
    sessionId: request.sessionId,
    state: 'Queued',
    queuedAt: new Date().toISOString(),
    logs: [],
  };

  pluginRuns.set(request.runId, run);
  emitPluginEvent(request.runId, 'queued');

  pluginQueue.push(request);
  processQueue();

  return { runId: request.runId, queued: true };
}

export async function cancelPluginRun(
  request: CancelPluginRequest
): Promise<CancelPluginResponse> {
  const run = pluginRuns.get(request.runId);
  if (!run) {
    return { runId: request.runId, cancelled: false, error: 'Plugin run not found' };
  }

  if (run.state === 'Completed' || run.state === 'Failed') {
    return { runId: request.runId, cancelled: false, error: 'Plugin run already finished' };
  }

  const queuedIndex = pluginQueue.findIndex((queued) => queued.runId === request.runId);
  if (queuedIndex >= 0) {
    pluginQueue.splice(queuedIndex, 1);
  }

  try {
    cancelledPlugins.add(request.runId);

    if (run.state === 'Running' || run.state === 'Starting') {
      await stopProcess(request.runId, { strategy: 'force' });
    }

    run.state = 'Failed';
    run.completedAt = new Date().toISOString();
    run.error = 'Cancelled by user';
    if (run.startedAt) {
      run.durationMs = new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime();
    }
    pluginRuns.set(request.runId, { ...run });
    emitPluginEvent(request.runId, 'cancelled');

    activePlugins.delete(request.runId);
    processQueue();

    return { runId: request.runId, cancelled: true };
  } catch (error) {
    return {
      runId: request.runId,
      cancelled: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function getPluginRuns(request: GetPluginRunsRequest): GetPluginRunsResponse {
  const runs = Array.from(pluginRuns.values());
  if (!request.sessionId) {
    return { runs };
  }

  return {
    runs: runs.filter((run) => run.sessionId === request.sessionId),
  };
}
