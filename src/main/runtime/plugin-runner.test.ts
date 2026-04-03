import type { ProcessEvent } from '../../shared/platform/contracts';
import type { ManagedSession } from '../../shared/runtime/runtime-contracts';
import type { RunProcessOptions } from './process-runner';

jest.mock('./process-runner', () => ({
  runProcess: jest.fn(),
  stopProcess: jest.fn(),
}));

jest.mock(
  './session-orchestrator',
  () => ({
    getSessions: jest.fn(),
  }),
  { virtual: true }
);

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

async function loadRunner() {
  const pluginRunner = await import('./plugin-runner');
  const processRunner = await import('./process-runner');
  const sessionOrchestrator = jest.requireMock('./session-orchestrator') as {
    getSessions: jest.MockedFunction<() => ManagedSession[]>;
  };

  return {
    ...pluginRunner,
    runProcessMock: processRunner.runProcess as jest.MockedFunction<
      typeof processRunner.runProcess
    >,
    stopProcessMock: processRunner.stopProcess as jest.MockedFunction<typeof processRunner.stopProcess>,
    getSessionsMock: sessionOrchestrator.getSessions as jest.MockedFunction<
      typeof sessionOrchestrator.getSessions
    >,
  };
}

function activeSession(sessionId: string): ManagedSession {
  return { sessionId, state: 'Active' };
}

describe('plugin-runner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it('rejects enqueuePlugin when session is not Active', async () => {
    const { enqueuePlugin, getSessionsMock } = await loadRunner();
    getSessionsMock.mockReturnValue([{ sessionId: 'session-1', state: 'Idle' }]);

    const response = await enqueuePlugin({
      runId: 'run-1',
      pluginName: 'echo',
      sessionId: 'session-1',
    });

    expect(response.queued).toBe(false);
    expect(response.error).toContain('Session not active');
  });

  it('starts plugin immediately when under concurrency cap', async () => {
    const { enqueuePlugin, getPluginRuns, runProcessMock, getSessionsMock } = await loadRunner();
    getSessionsMock.mockReturnValue([activeSession('session-1')]);
    runProcessMock.mockImplementation(() => new Promise(() => undefined));

    const response = await enqueuePlugin({
      runId: 'run-1',
      pluginName: 'echo',
      sessionId: 'session-1',
    });
    await flushPromises();

    const run = getPluginRuns({ sessionId: 'session-1' }).runs[0];
    expect(response).toEqual({ runId: 'run-1', queued: true });
    expect(run.state).toBe('Running');
    expect(runProcessMock).toHaveBeenCalledTimes(1);
  });

  it('queues excess plugins and starts next when a slot is free', async () => {
    const { enqueuePlugin, getPluginRuns, runProcessMock, getSessionsMock } = await loadRunner();
    getSessionsMock.mockReturnValue([activeSession('session-1')]);

    const resolvers = new Map<string, () => void>();
    runProcessMock.mockImplementation(
      ({ correlationId }: RunProcessOptions) =>
        new Promise<void>((resolve) => {
          resolvers.set(correlationId, resolve);
        })
    );

    await enqueuePlugin({ runId: 'run-1', pluginName: 'one', sessionId: 'session-1' });
    await enqueuePlugin({ runId: 'run-2', pluginName: 'two', sessionId: 'session-1' });
    await enqueuePlugin({ runId: 'run-3', pluginName: 'three', sessionId: 'session-1' });
    await enqueuePlugin({ runId: 'run-4', pluginName: 'four', sessionId: 'session-1' });
    await flushPromises();

    expect(runProcessMock).toHaveBeenCalledTimes(3);
    expect(getPluginRuns({}).runs.find((run: any) => run.runId === 'run-4')?.state).toBe('Queued');

    resolvers.get('run-1')?.();
    await flushPromises();

    expect(runProcessMock).toHaveBeenCalledTimes(4);
    expect(getPluginRuns({}).runs.find((run: any) => run.runId === 'run-4')?.state).toBe('Running');
  });

  it('transitions through Queued to Completed and captures process logs', async () => {
    const { enqueuePlugin, getPluginRuns, registerPluginEventListener, runProcessMock, getSessionsMock } =
      await loadRunner();
    getSessionsMock.mockReturnValue([activeSession('session-1')]);

    const events: string[] = [];
    registerPluginEventListener('run-1', (event: any) => {
      events.push(event.type);
    });

    runProcessMock.mockImplementation(async ({ correlationId, onEvent }: RunProcessOptions) => {
      const base = {
        correlationId,
        timestamp: new Date().toISOString(),
      };
      const stdoutEvent: ProcessEvent = {
        ...base,
        type: 'stdout',
        data: { chunk: 'hello' },
      };
      const stderrEvent: ProcessEvent = {
        ...base,
        type: 'stderr',
        data: { chunk: 'warn' },
      };
      onEvent?.(stdoutEvent);
      onEvent?.(stderrEvent);
    });

    await enqueuePlugin({
      runId: 'run-1',
      pluginName: 'echo',
      sessionId: 'session-1',
    });
    await flushPromises();

    const run = getPluginRuns({}).runs.find((item: any) => item.runId === 'run-1');
    expect(run?.state).toBe('Completed');
    expect(run?.logs).toEqual(['hello', 'warn']);
    expect(events).toEqual(['queued', 'starting', 'running', 'completed']);
  });

  it('marks failed runs and allows retry with a new runId', async () => {
    const { enqueuePlugin, getPluginRuns, runProcessMock, getSessionsMock } = await loadRunner();
    getSessionsMock.mockReturnValue([activeSession('session-1')]);

    runProcessMock.mockImplementation(async ({ correlationId }: RunProcessOptions) => {
      if (correlationId === 'run-fail') {
        throw new Error('plugin failed');
      }
    });

    await enqueuePlugin({
      runId: 'run-fail',
      pluginName: 'echo',
      sessionId: 'session-1',
    });
    await flushPromises();

    await enqueuePlugin({
      runId: 'run-retry',
      pluginName: 'echo',
      sessionId: 'session-1',
    });
    await flushPromises();

    const failedRun = getPluginRuns({}).runs.find((run: any) => run.runId === 'run-fail');
    const retryRun = getPluginRuns({}).runs.find((run: any) => run.runId === 'run-retry');

    expect(failedRun?.state).toBe('Failed');
    expect(failedRun?.error).toContain('plugin failed');
    expect(retryRun?.state).toBe('Completed');
  });

  it('cancelPluginRun stops active plugin and marks it cancelled', async () => {
    const { enqueuePlugin, cancelPluginRun, getPluginRuns, runProcessMock, stopProcessMock, getSessionsMock } =
      await loadRunner();
    getSessionsMock.mockReturnValue([activeSession('session-1')]);
    runProcessMock.mockImplementation(() => new Promise(() => undefined));
    stopProcessMock.mockResolvedValue(undefined);

    await enqueuePlugin({
      runId: 'run-cancel',
      pluginName: 'echo',
      sessionId: 'session-1',
    });
    await flushPromises();

    const response = await cancelPluginRun({ runId: 'run-cancel' });
    const run = getPluginRuns({}).runs.find((item: any) => item.runId === 'run-cancel');

    expect(response).toEqual({ runId: 'run-cancel', cancelled: true });
    expect(stopProcessMock).toHaveBeenCalledWith('run-cancel', { strategy: 'force' });
    expect(run?.state).toBe('Failed');
    expect(run?.error).toBe('Cancelled by user');
  });

  it('getPluginRuns returns all runs and supports sessionId filtering', async () => {
    const { enqueuePlugin, getPluginRuns, runProcessMock, getSessionsMock } = await loadRunner();
    getSessionsMock.mockReturnValue([activeSession('session-1'), activeSession('session-2')]);
    runProcessMock.mockResolvedValue(undefined);

    await enqueuePlugin({
      runId: 'run-a',
      pluginName: 'echo',
      sessionId: 'session-1',
    });
    await enqueuePlugin({
      runId: 'run-b',
      pluginName: 'echo',
      sessionId: 'session-2',
    });
    await flushPromises();

    const allRuns = getPluginRuns({}).runs;
    const sessionOneRuns = getPluginRuns({ sessionId: 'session-1' }).runs;

    expect(allRuns).toHaveLength(2);
    expect(sessionOneRuns).toHaveLength(1);
    expect(sessionOneRuns[0]?.runId).toBe('run-a');
  });
});
