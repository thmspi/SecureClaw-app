import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type {
  ImportPluginPackageResponse,
  ManagedSession,
  PluginPackage,
  SessionEvent,
  SessionState,
  ValidatePluginPackageResponse,
} from '../../shared/runtime/runtime-contracts';

interface ManagementState {
  sessions: ManagedSession[];
  activeSessions: ManagedSession[];
  sessionStarting: boolean;
  sessionStopping: boolean;

  pluginPackages: PluginPackage[];
  selectedPluginIds: string[];
  pluginsLoading: boolean;
  pluginMutationInFlight: boolean;
  pluginError?: string;

  loadSessions: () => Promise<void>;
  startSession: (
    sessionId: string,
    healthEndpoint?: string
  ) => Promise<{ started: boolean; error?: string }>;
  stopSession: (sessionId: string) => Promise<{ stopped: boolean; error?: string }>;
  handleSessionEvent: (event: SessionEvent) => void;

  loadPluginPackages: () => Promise<void>;
  togglePluginSelected: (pluginId: string) => void;
  validatePluginPackage: (packageName: string) => Promise<ValidatePluginPackageResponse>;
  importPluginPackage: (packageName: string) => Promise<ImportPluginPackageResponse>;
  uninstallPluginPackage: (pluginId: string) => Promise<{ uninstalled: boolean; error?: string }>;
  setPluginPackageEnabled: (
    pluginId: string,
    enabled: boolean
  ) => Promise<{ updated: boolean; enabled: boolean; error?: string }>;
  clearPluginError: () => void;
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
    case 'error':
      return 'Stopped';
    default:
      return 'Idle';
  }
}

export const useManagementStore = create<ManagementState>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeSessions: [],
      sessionStarting: false,
      sessionStopping: false,

      pluginPackages: [],
      selectedPluginIds: [],
      pluginsLoading: false,
      pluginMutationInFlight: false,
      pluginError: undefined,

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
            ...(existing ?? {}),
            state: nextState,
            error:
              event.type === 'error'
                ? String(event.data.error ?? existing?.error ?? '')
                : existing?.error,
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

      loadPluginPackages: async () => {
        set({ pluginsLoading: true, pluginError: undefined });
        try {
          const response = await window.secureClaw.runtime.listPluginPackages();
          const packageIds = new Set(response.packages.map((item) => item.id));

          set((state) => ({
            pluginPackages: response.packages,
            selectedPluginIds: state.selectedPluginIds.filter((id) => packageIds.has(id)),
            pluginError: response.error,
          }));
        } catch (error) {
          set({
            pluginError: error instanceof Error ? error.message : String(error),
          });
        } finally {
          set({ pluginsLoading: false });
        }
      },

      togglePluginSelected: (pluginId) => {
        set((state) => {
          const selected = new Set(state.selectedPluginIds);
          if (selected.has(pluginId)) {
            selected.delete(pluginId);
          } else {
            selected.add(pluginId);
          }
          return {
            selectedPluginIds: Array.from(selected),
          };
        });
      },

      validatePluginPackage: async (packageName) => {
        const response = await window.secureClaw.runtime.validatePluginPackage({ packageName });
        if (!response.valid && response.error) {
          set({ pluginError: response.error });
        }
        return response;
      },

      importPluginPackage: async (packageName) => {
        set({ pluginMutationInFlight: true, pluginError: undefined });
        try {
          const response = await window.secureClaw.runtime.importPluginPackage({ packageName });
          if (!response.imported) {
            set({ pluginError: response.error ?? `Failed to import ${packageName}` });
            return response;
          }

          await get().loadPluginPackages();
          if (response.plugin) {
            set((state) => ({
              selectedPluginIds: state.selectedPluginIds.includes(response.plugin.id)
                ? state.selectedPluginIds
                : [...state.selectedPluginIds, response.plugin.id],
            }));
          }
          return response;
        } finally {
          set({ pluginMutationInFlight: false });
        }
      },

      uninstallPluginPackage: async (pluginId) => {
        set({ pluginMutationInFlight: true, pluginError: undefined });
        try {
          const response = await window.secureClaw.runtime.uninstallPluginPackage({ pluginId });
          if (!response.uninstalled) {
            const message = response.error ?? `Failed to uninstall ${pluginId}`;
            set({ pluginError: message });
            return { uninstalled: false, error: message };
          }

          await get().loadPluginPackages();
          set((state) => ({
            selectedPluginIds: state.selectedPluginIds.filter((id) => id !== pluginId),
          }));

          return { uninstalled: true };
        } finally {
          set({ pluginMutationInFlight: false });
        }
      },

      setPluginPackageEnabled: async (pluginId, enabled) => {
        set({ pluginMutationInFlight: true, pluginError: undefined });
        try {
          const response = await window.secureClaw.runtime.setPluginPackageEnabled({ pluginId, enabled });
          if (!response.updated) {
            const message =
              response.error ?? `Failed to ${enabled ? 'enable' : 'disable'} ${pluginId}`;
            set({ pluginError: message });
            return { updated: false, enabled, error: message };
          }

          await get().loadPluginPackages();
          return { updated: true, enabled: response.enabled };
        } finally {
          set({ pluginMutationInFlight: false });
        }
      },

      clearPluginError: () => {
        set({ pluginError: undefined });
      },
    }),
    {
      name: 'secureclaw-management',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        selectedPluginIds: state.selectedPluginIds,
      }),
    }
  )
);
