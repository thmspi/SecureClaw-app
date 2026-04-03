import { contextBridge, ipcRenderer } from 'electron';
import { PLATFORM_CHANNELS } from '../shared/ipc/platform-channels';
import { INSTALL_CHANNELS } from '../shared/install/install-channels';
import { RUNTIME_CHANNELS } from '../shared/ipc/runtime-channels';
import type {
  RunProcessRequest,
  RunProcessResponse,
  StopProcessRequest,
  StopProcessResponse,
  GetPathsRequest,
  GetPathsResponse,
} from '../shared/platform/contracts';
import type {
  InstallProgress,
  InstallError,
  InstallState,
  PrerequisiteResult,
  StartDockerDaemonResult,
} from '../shared/install/install-contracts';
import type {
  StartSessionRequest,
  StartSessionResponse,
  StopSessionRequest,
  StopSessionResponse,
  GetSessionsResponse,
  RunPluginRequest,
  RunPluginResponse,
  CancelPluginRequest,
  CancelPluginResponse,
  GetPluginRunsRequest,
  GetPluginRunsResponse,
  GetHistoryRequest,
  GetHistoryResponse,
  SessionEvent,
  PluginEvent,
} from '../shared/runtime/runtime-contracts';

// Narrow platform API - only approved operations
const platformAPI = {
  runProcess: (request: RunProcessRequest): Promise<RunProcessResponse> => {
    return ipcRenderer.invoke(PLATFORM_CHANNELS.runProcess, request);
  },
  
  stopProcess: (request: StopProcessRequest): Promise<StopProcessResponse> => {
    return ipcRenderer.invoke(PLATFORM_CHANNELS.stopProcess, request);
  },
  
  getPaths: (request: GetPathsRequest): Promise<GetPathsResponse> => {
    return ipcRenderer.invoke(PLATFORM_CHANNELS.getPaths, request);
  },
};

// Install API for wizard flow
const installAPI = {
  start: (target: 'openclaw' | 'nemoclaw'): Promise<{ correlationId: string }> =>
    ipcRenderer.invoke(INSTALL_CHANNELS.start, {
      target,
      correlationId: crypto.randomUUID(),
    }),

  cancel: (): Promise<{ removed: string[] }> =>
    ipcRenderer.invoke(INSTALL_CHANNELS.cancel),

  retry: (): Promise<void> => ipcRenderer.invoke(INSTALL_CHANNELS.retry),

  getState: (): Promise<InstallState | null> =>
    ipcRenderer.invoke(INSTALL_CHANNELS.getState),

  runPrerequisites: (): Promise<PrerequisiteResult> =>
    ipcRenderer.invoke(INSTALL_CHANNELS.runPrerequisites),

  startDockerDaemon: (): Promise<StartDockerDaemonResult> =>
    ipcRenderer.invoke(INSTALL_CHANNELS.startDockerDaemon),

  // Event subscriptions - return unsubscribe function
  onProgress: (callback: (progress: InstallProgress) => void) => {
    const handler = (_: unknown, data: InstallProgress) => callback(data);
    ipcRenderer.on(INSTALL_CHANNELS.progress, handler);
    return () => ipcRenderer.removeListener(INSTALL_CHANNELS.progress, handler);
  },

  onError: (callback: (error: InstallError) => void) => {
    const handler = (_: unknown, data: InstallError) => callback(data);
    ipcRenderer.on(INSTALL_CHANNELS.error, handler);
    return () => ipcRenderer.removeListener(INSTALL_CHANNELS.error, handler);
  },

  onComplete: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on(INSTALL_CHANNELS.complete, handler);
    return () => ipcRenderer.removeListener(INSTALL_CHANNELS.complete, handler);
  },
};

const runtimeAPI = {
  startSession: (request: StartSessionRequest): Promise<StartSessionResponse> =>
    ipcRenderer.invoke(RUNTIME_CHANNELS.startSession, request),

  stopSession: (request: StopSessionRequest): Promise<StopSessionResponse> =>
    ipcRenderer.invoke(RUNTIME_CHANNELS.stopSession, request),

  getSessions: (): Promise<GetSessionsResponse> => ipcRenderer.invoke(RUNTIME_CHANNELS.getSessions, {}),

  runPlugin: (request: RunPluginRequest): Promise<RunPluginResponse> =>
    ipcRenderer.invoke(RUNTIME_CHANNELS.runPlugin, request),

  cancelPluginRun: (request: CancelPluginRequest): Promise<CancelPluginResponse> =>
    ipcRenderer.invoke(RUNTIME_CHANNELS.cancelPluginRun, request),

  getPluginRuns: (request: GetPluginRunsRequest): Promise<GetPluginRunsResponse> =>
    ipcRenderer.invoke(RUNTIME_CHANNELS.getPluginRuns, request),

  getHistory: (request: GetHistoryRequest): Promise<GetHistoryResponse> =>
    ipcRenderer.invoke(RUNTIME_CHANNELS.getHistory, request),

  onSessionEvent: (callback: (event: SessionEvent) => void) => {
    const handler = (_: unknown, data: SessionEvent) => callback(data);
    ipcRenderer.on(RUNTIME_CHANNELS.sessionEvent, handler);
    return () => ipcRenderer.removeListener(RUNTIME_CHANNELS.sessionEvent, handler);
  },

  onPluginEvent: (callback: (event: PluginEvent) => void) => {
    const handler = (_: unknown, data: PluginEvent) => callback(data);
    ipcRenderer.on(RUNTIME_CHANNELS.pluginEvent, handler);
    return () => ipcRenderer.removeListener(RUNTIME_CHANNELS.pluginEvent, handler);
  },
};

// Expose to renderer via contextBridge - NO raw ipcRenderer
contextBridge.exposeInMainWorld('secureClaw', {
  platform: platformAPI,
  install: installAPI,
  runtime: runtimeAPI,
});

// Type declaration for renderer usage
declare global {
  interface Window {
    secureClaw: {
      platform: typeof platformAPI;
      install: typeof installAPI;
      runtime: typeof runtimeAPI;
    };
  }
}
