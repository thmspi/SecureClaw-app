import { runProcess, stopProcess } from './process-runner';
import { saveHistoryRecord } from './runtime-history-service';
import {
  startSession,
  stopSession as stopManagedSession,
  getSessions,
  _resetSessionStateForTesting,
} from './session-orchestrator';

jest.mock('./process-runner', () => ({
  runProcess: jest.fn(),
  stopProcess: jest.fn(),
}));

jest.mock('./runtime-history-service', () => ({
  saveHistoryRecord: jest.fn(),
}));

const runProcessMock = runProcess as jest.MockedFunction<typeof runProcess>;
const stopProcessMock = stopProcess as jest.MockedFunction<typeof stopProcess>;
const saveHistoryRecordMock = saveHistoryRecord as jest.MockedFunction<typeof saveHistoryRecord>;
const fetchMock = jest.fn();

describe('SessionOrchestrator', () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      writable: true,
      value: fetchMock,
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    _resetSessionStateForTesting();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('startSession transitions Idle -> Starting -> Active when health probe succeeds', async () => {
    runProcessMock.mockImplementation(async (options) => {
      options.onEvent?.({
        type: 'spawned',
        correlationId: options.correlationId,
        timestamp: new Date().toISOString(),
        data: { pid: 1234 },
      });
      await new Promise(() => undefined);
    });
    fetchMock.mockResolvedValue({ ok: true });

    const result = await startSession({
      sessionId: 'session-1',
      config: { healthEndpoint: 'http://localhost:8080/health', readinessTimeoutMs: 1000 },
    });

    expect(result).toEqual({ sessionId: 'session-1', started: true });
    const sessions = getSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      sessionId: 'session-1',
      state: 'Active',
      pid: 1234,
    });
    expect(sessions[0]?.startedAt).toBeDefined();
    expect(sessions[0]?.activeAt).toBeDefined();
    expect(saveHistoryRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        operationType: 'session_start',
        status: 'success',
        targetName: 'session-1',
      })
    );
  });

  it('startSession transitions Idle -> Starting -> Stopped with error when readiness times out', async () => {
    jest.useFakeTimers();
    runProcessMock.mockImplementation(async (options) => {
      options.onEvent?.({
        type: 'spawned',
        correlationId: options.correlationId,
        timestamp: new Date().toISOString(),
        data: { pid: 1234 },
      });
      await new Promise(() => undefined);
    });
    fetchMock.mockRejectedValue(new Error('not ready'));

    const startPromise = startSession({
      sessionId: 'session-timeout',
      config: { healthEndpoint: 'http://localhost:8080/health', readinessTimeoutMs: 10 },
    });

    await jest.advanceTimersByTimeAsync(1000);
    const result = await startPromise;

    expect(result.started).toBe(false);
    expect(result.error).toContain('Readiness timeout');
    const session = getSessions().find((entry) => entry.sessionId === 'session-timeout');
    expect(session?.state).toBe('Stopped');
    expect(session?.error).toContain('Readiness timeout');
    expect(saveHistoryRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        operationType: 'session_start',
        status: 'failed',
        targetName: 'session-timeout',
      })
    );
  });

  it('stopSession transitions Active -> Stopping -> Stopped with graceful strategy', async () => {
    runProcessMock.mockImplementation(async (options) => {
      options.onEvent?.({
        type: 'spawned',
        correlationId: options.correlationId,
        timestamp: new Date().toISOString(),
        data: { pid: 4321 },
      });
      await new Promise(() => undefined);
    });
    stopProcessMock.mockResolvedValue();
    fetchMock.mockResolvedValue({ ok: true });

    await startSession({
      sessionId: 'session-stop',
      config: { healthEndpoint: 'http://localhost:8080/health', readinessTimeoutMs: 1000 },
    });

    const result = await stopManagedSession({
      sessionId: 'session-stop',
      strategy: 'graceful',
    });

    expect(result).toEqual({ sessionId: 'session-stop', stopped: true });
    expect(stopProcessMock).toHaveBeenCalledWith('session-stop', { strategy: 'graceful' });
    const session = getSessions().find((entry) => entry.sessionId === 'session-stop');
    expect(session?.state).toBe('Stopped');
    expect(session?.stoppedAt).toBeDefined();
    expect(saveHistoryRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        operationType: 'session_stop',
        status: 'success',
        targetName: 'session-stop',
      })
    );
  });

  it('getSessions returns all tracked sessions by sessionId', async () => {
    runProcessMock.mockImplementation(async (options) => {
      options.onEvent?.({
        type: 'spawned',
        correlationId: options.correlationId,
        timestamp: new Date().toISOString(),
        data: { pid: options.correlationId === 'session-a' ? 111 : 222 },
      });
      await new Promise(() => undefined);
    });
    fetchMock.mockResolvedValue({ ok: true });

    await Promise.all([
      startSession({
        sessionId: 'session-a',
        config: { healthEndpoint: 'http://localhost:8080/health', readinessTimeoutMs: 1000 },
      }),
      startSession({
        sessionId: 'session-b',
        config: { healthEndpoint: 'http://localhost:8080/health', readinessTimeoutMs: 1000 },
      }),
    ]);

    const sessions = getSessions();
    const ids = sessions.map((session) => session.sessionId).sort();
    expect(ids).toEqual(['session-a', 'session-b']);
  });

  it('tracks concurrent sessions independently', async () => {
    runProcessMock.mockImplementation(async (options) => {
      options.onEvent?.({
        type: 'spawned',
        correlationId: options.correlationId,
        timestamp: new Date().toISOString(),
        data: { pid: options.correlationId === 'session-1' ? 1001 : 1002 },
      });
      await new Promise(() => undefined);
    });
    fetchMock.mockResolvedValue({ ok: true });

    const [first, second] = await Promise.all([
      startSession({
        sessionId: 'session-1',
        config: { healthEndpoint: 'http://localhost:8080/health', readinessTimeoutMs: 1000 },
      }),
      startSession({
        sessionId: 'session-2',
        config: { healthEndpoint: 'http://localhost:8080/health', readinessTimeoutMs: 1000 },
      }),
    ]);

    expect(first.started).toBe(true);
    expect(second.started).toBe(true);

    await stopManagedSession({ sessionId: 'session-1', strategy: 'graceful' });
    const sessionOne = getSessions().find((entry) => entry.sessionId === 'session-1');
    const sessionTwo = getSessions().find((entry) => entry.sessionId === 'session-2');

    expect(sessionOne?.state).toBe('Stopped');
    expect(sessionTwo?.state).toBe('Active');
  });
});
