import { create } from 'zustand';
import type {
  ManagedSession,
  PluginRun,
  RuntimeHistoryRecord,
  GetHistoryRequest,
  SessionEvent,
  PluginEvent,
  PluginRunState,
  SessionState,
} from '../../shared/runtime/runtime-contracts';

type HistoryFilters = Pick<GetHistoryRequest, 'operationType' | 'status' | 'fromDate' | 'toDate' | 'limit'>;

interface ManagementState {
  sessions: ManagedSession[];
  activeSessions: ManagedSession[];
  pluginRuns: PluginRun[];
  history: RuntimeHistoryRecord[];
  historyFilters: HistoryFilters;
  historyLoading: boolean;
  sessionStarting: boolean;
  sessionStopping: boolean;

  loadSessions: () => Promise<void>;
  startSession: (
    sessionId: string,
    healthEndpoint?: string
  ) => Promise<{ started: boolean; error?: string }>;
  stopSession: (sessionId: string) => Promise<{ stopped: boolean; error?: string }>;
  handleSessionEvent: (event: SessionEvent) => void;

  loadPluginRuns: (sessionId?: string) => Promise<void>;
  runPlugin: (
    runId: string,
    pluginName: string,
    sessionId: string,
    args?: Record<string, unknown>
  ) => Promise<{ queued: boolean; error?: string }>;
  cancelPluginRun: (runId: string) => Promise<{ cancelled: boolean; error?: string }>;
  handlePluginEvent: (event: PluginEvent) => void;

  loadHistory: () => Promise<void>;
  setHistoryFilters: (filters: Partial<GetHistoryRequest>) => void;
  applyHistoryFilters: () => Promise<void>;
}

function deriveActiveSessions(sessions: ManagedSession[]): ManagedSession[] {
  return sessions.filter((session) => session.state === 'Active');
}

function mapSessionEventToState(type: SessionEvent['type']): SessionState {
  switch (type) {
    case 'starting':
      return 'Starting';
    case 'active':
      return 'Active';
    case 'stopping':
      return 'Stopping';
    case 'stopped':
      return 'Stopped';
    case 'error':
      return 'Stopped';
    default:
      return 'Idle';
  }
}

function mapPluginEventToState(type: PluginEvent['type']): PluginRunState {
  switch (type) {
    case 'queued':
      return 'Queued';
    case 'starting':
      return 'Starting';
    case 'running':
      return 'Running';
    case 'completed':
      return 'Completed';
    case 'failed':
    case 'cancelled':
      return 'Failed';
    default:
      return 'Idle';
  }
}

export const useManagementStore = create<ManagementState>((set, get) => ({
  sessions: [],
  activeSessions: [],
  pluginRuns: [],
  history: [],
  historyFilters: {},
  historyLoading: false,
  sessionStarting: false,
  sessionStopping: false,

  loadSessions: async () => {
    try {
      const response = await window.secureClaw.runtime.getSessions();
      set({
        sessions: response.sessions,
        activeSessions: deriveActiveSessions(response.sessions),
      });
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  },

  startSession: async (sessionId, healthEndpoint) => {
    set({ sessionStarting: true });
    try {
      const response = await window.secureClaw.runtime.startSession({
        sessionId,
        config: healthEndpoint ? { healthEndpoint } : undefined,
      });
      if (response.started) {
        await get().loadSessions();
      }
      return { started: response.started, error: response.error };
    } catch (error) {
      return { started: false, error: error instanceof Error ? error.message : String(error) };
    } finally {
      set({ sessionStarting: false });
    }
  },

  stopSession: async (sessionId) => {
    set({ sessionStopping: true });
    try {
      const response = await window.secureClaw.runtime.stopSession({ sessionId });
      if (response.stopped) {
        await get().loadSessions();
      }
      return { stopped: response.stopped, error: response.error };
    } catch (error) {
      return { stopped: false, error: error instanceof Error ? error.message : String(error) };
    } finally {
      set({ sessionStopping: false });
    }
  },

  handleSessionEvent: (event) => {
    set((state) => {
      const nextState = mapSessionEventToState(event.type);
      const existing = state.sessions.find((session) => session.sessionId === event.sessionId);
      const mergedSession: ManagedSession = {
        sessionId: event.sessionId,
        state: nextState,
        ...(existing ?? {}),
        state: nextState,
        error: event.type === 'error' ? String(event.data.error ?? existing?.error ?? '') : existing?.error,
      };

      const sessions = existing
        ? state.sessions.map((session) =>
            session.sessionId === event.sessionId ? { ...session, ...mergedSession } : session
          )
        : [...state.sessions, mergedSession];

      return {
        sessions,
        activeSessions: deriveActiveSessions(sessions),
      };
    });
  },

  loadPluginRuns: async (sessionId) => {
    try {
      const response = await window.secureClaw.runtime.getPluginRuns({ sessionId });
      set({ pluginRuns: response.runs });
    } catch (error) {
      console.error('Failed to load plugin runs:', error);
    }
  },

  runPlugin: async (runId, pluginName, sessionId, args) => {
    const activeSession = get().sessions.find(
      (session) => session.sessionId === sessionId && session.state === 'Active'
    );
    if (!activeSession) {
      return {
        queued: false,
        error: 'Session not active - start a session before running plugins',
      };
    }

    try {
      const response = await window.secureClaw.runtime.runPlugin({
        runId,
        pluginName,
        sessionId,
        args,
      });
      if (response.queued) {
        await get().loadPluginRuns(sessionId);
      }
      return { queued: response.queued, error: response.error };
    } catch (error) {
      return { queued: false, error: error instanceof Error ? error.message : String(error) };
    }
  },

  cancelPluginRun: async (runId) => {
    try {
      const response = await window.secureClaw.runtime.cancelPluginRun({ runId });
      if (response.cancelled) {
        const sessionId = get().pluginRuns.find((run) => run.runId === runId)?.sessionId;
        await get().loadPluginRuns(sessionId);
      }
      return { cancelled: response.cancelled, error: response.error };
    } catch (error) {
      return { cancelled: false, error: error instanceof Error ? error.message : String(error) };
    }
  },

  handlePluginEvent: (event) => {
    set((state) => {
      const nextState = mapPluginEventToState(event.type);
      const existing = state.pluginRuns.find((run) => run.runId === event.runId);

      if (!existing) {
        return state;
      }

      const updated: PluginRun = {
        ...existing,
        state: nextState,
        error:
          event.type === 'failed' || event.type === 'cancelled'
            ? String(event.data.error ?? existing.error ?? '')
            : existing.error,
      };

      return {
        pluginRuns: state.pluginRuns.map((run) => (run.runId === event.runId ? updated : run)),
      };
    });
  },

  loadHistory: async () => {
    set({ historyLoading: true });
    try {
      const response = await window.secureClaw.runtime.getHistory(get().historyFilters);
      set({ history: response.records });
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      set({ historyLoading: false });
    }
  },

  setHistoryFilters: (filters) => {
    set((state) => ({
      historyFilters: {
        ...state.historyFilters,
        ...filters,
      },
    }));
  },

  applyHistoryFilters: async () => {
    await get().loadHistory();
  },
}));
