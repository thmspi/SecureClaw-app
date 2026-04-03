import type { ManagedSession } from '../../shared/runtime/runtime-contracts';

const sessions = new Map<string, ManagedSession>();

export function getSessions(): ManagedSession[] {
  return Array.from(sessions.values());
}

export function setSessionForRuntime(session: ManagedSession): void {
  sessions.set(session.sessionId, session);
}

export function removeSessionForRuntime(sessionId: string): void {
  sessions.delete(sessionId);
}

export function clearSessionsForRuntime(): void {
  sessions.clear();
}
