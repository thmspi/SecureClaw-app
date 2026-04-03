import { runProcess, stopProcess } from './process-runner';
import type {
  ManagedSession,
  SessionEvent,
  SessionEventType,
  SessionState,
  StartSessionRequest,
  StartSessionResponse,
  StopSessionRequest,
  StopSessionResponse,
} from '../../shared/runtime/runtime-contracts';

const sessions = new Map<string, ManagedSession>();
const listeners = new Map<string, (event: SessionEvent) => void>();

const VALID_TRANSITIONS: Record<SessionState, SessionState[]> = {
  Idle: ['Starting'],
  Starting: ['Active', 'Stopped'],
  Active: ['Stopping'],
  Stopping: ['Stopped'],
  Stopped: ['Idle'],
};

function canTransition(from: SessionState, to: SessionState): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

function emitSessionEvent(
  sessionId: string,
  type: SessionEventType,
  data: Record<string, unknown> = {}
): void {
  const listener = listeners.get(sessionId);
  if (!listener) {
    return;
  }

  listener({
    type,
    sessionId,
    timestamp: new Date().toISOString(),
    data,
  });
}

function updateSession(sessionId: string, nextState: SessionState, patch: Partial<ManagedSession> = {}): void {
  const current = sessions.get(sessionId);
  if (!current || !canTransition(current.state, nextState)) {
    return;
  }

  sessions.set(sessionId, {
    ...current,
    ...patch,
    state: nextState,
  });
}

async function waitForReadiness(healthEndpoint: string, timeoutMs = 30000): Promise<boolean> {
  const start = Date.now();
  const pollIntervalMs = 500;

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(healthEndpoint, { method: 'GET' });
      if (response.ok) {
        return true;
      }
    } catch {
      // Probe failures are expected until runtime is ready.
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  return false;
}

export function registerSessionEventListener(
  sessionId: string,
  listener: (event: SessionEvent) => void
): void {
  listeners.set(sessionId, listener);
}

export function unregisterSessionEventListener(sessionId: string): void {
  listeners.delete(sessionId);
}

export async function startSession(request: StartSessionRequest): Promise<StartSessionResponse> {
  const readinessTimeoutMs = request.config?.readinessTimeoutMs ?? 30000;
  const healthEndpoint = request.config?.healthEndpoint ?? 'http://localhost:8080/health';
  const startedAt = new Date().toISOString();

  sessions.set(request.sessionId, {
    sessionId: request.sessionId,
    state: 'Starting',
    startedAt,
  });
  emitSessionEvent(request.sessionId, 'starting');

  void runProcess({
    command: 'openclaw',
    args: ['serve'],
    correlationId: request.sessionId,
    onEvent: (event) => {
      if (event.type === 'spawned') {
        const pid = typeof event.data.pid === 'number' ? event.data.pid : undefined;
        const current = sessions.get(request.sessionId);
        if (!current) {
          return;
        }
        sessions.set(request.sessionId, {
          ...current,
          pid,
        });
      }
    },
  }).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    updateSession(request.sessionId, 'Stopped', {
      error: message,
      stoppedAt: new Date().toISOString(),
    });
    emitSessionEvent(request.sessionId, 'error', { error: message });
  });

  const ready = await waitForReadiness(healthEndpoint, readinessTimeoutMs);
  if (!ready) {
    const error = `Readiness timeout after ${readinessTimeoutMs}ms`;
    updateSession(request.sessionId, 'Stopped', {
      error,
      stoppedAt: new Date().toISOString(),
    });
    emitSessionEvent(request.sessionId, 'error', { error });
    return {
      sessionId: request.sessionId,
      started: false,
      error,
    };
  }

  updateSession(request.sessionId, 'Active', {
    activeAt: new Date().toISOString(),
  });
  emitSessionEvent(request.sessionId, 'active');

  return {
    sessionId: request.sessionId,
    started: true,
  };
}

export async function stopSession(request: StopSessionRequest): Promise<StopSessionResponse> {
  const session = sessions.get(request.sessionId);
  if (!session || session.state !== 'Active') {
    return {
      sessionId: request.sessionId,
      stopped: false,
      error: 'Session not active',
    };
  }

  const strategy = request.strategy ?? 'graceful';
  updateSession(request.sessionId, 'Stopping');
  emitSessionEvent(request.sessionId, 'stopping', { strategy });

  try {
    await stopProcess(request.sessionId, { strategy });
    updateSession(request.sessionId, 'Stopped', {
      stoppedAt: new Date().toISOString(),
    });
    emitSessionEvent(request.sessionId, 'stopped');
    return {
      sessionId: request.sessionId,
      stopped: true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const current = sessions.get(request.sessionId);
    if (current) {
      sessions.set(request.sessionId, {
        ...current,
        error: message,
      });
    }
    return {
      sessionId: request.sessionId,
      stopped: false,
      error: message,
    };
  }
}

export function getSessions(): ManagedSession[] {
  return Array.from(sessions.values());
}

export function _resetSessionStateForTesting(): void {
  sessions.clear();
  listeners.clear();
}
