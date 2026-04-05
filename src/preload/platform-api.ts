import { contextBridge, ipcRenderer } from 'electron';
import { PLATFORM_CHANNELS } from '../shared/ipc/platform-channels';
import { INSTALL_CHANNELS } from '../shared/install/install-channels';
import { RUNTIME_CHANNELS } from '../shared/ipc/runtime-channels';
import {
  DIAGNOSTICS_CHANNELS,
  type GetHealthInput,
} from '../shared/ipc/diagnostics-channels';
import { SECURITY_CHANNELS } from '../shared/ipc/security-channels';
import { CONFIGURATION_CHANNELS } from '../shared/ipc/configuration-channels';
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
  UninstallStackResult,
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
  ListPluginPackagesResponse,
  ValidatePluginPackageRequest,
  ValidatePluginPackageResponse,
  ImportPluginPackageRequest,
  ImportPluginPackageResponse,
  SetPluginPackageEnabledRequest,
  SetPluginPackageEnabledResponse,
  UninstallPluginPackageRequest,
  UninstallPluginPackageResponse,
} from '../shared/runtime/runtime-contracts';
import type {
  DiagnosticsExportResult,
  HealthSnapshot,
  SupportErrorEnvelope,
} from '../shared/diagnostics/diagnostics-contracts';
import type {
  DeleteScopeSecretsRequest,
  DeleteScopeSecretsResponse,
  DeleteSecretRequest,
  DeleteSecretResponse,
  GetSecretRequest,
  GetSecretResponse,
  SetSecretRequest,
  SetSecretResponse,
} from '../shared/security/secret-contracts';
import type {
  ApplyDocumentRequest,
  ApplyDocumentResponse,
  ListDocumentsRequest,
  ListDocumentsResponse,
  LoadDocumentRequest,
  LoadDocumentResponse,
  SaveDocumentRequest,
  SaveDocumentResponse,
  ValidateDocumentRequest,
  ValidateDocumentResponse,
} from '../shared/configuration/configuration-contracts';

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

  uninstallStack: (): Promise<UninstallStackResult> =>
    ipcRenderer.invoke(INSTALL_CHANNELS.uninstallStack),

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

  listPluginPackages: (): Promise<ListPluginPackagesResponse> =>
    ipcRenderer.invoke(RUNTIME_CHANNELS.listPluginPackages, {}),

  validatePluginPackage: (
    request: ValidatePluginPackageRequest
  ): Promise<ValidatePluginPackageResponse> =>
    ipcRenderer.invoke(RUNTIME_CHANNELS.validatePluginPackage, request),

  importPluginPackage: (
    request: ImportPluginPackageRequest
  ): Promise<ImportPluginPackageResponse> =>
    ipcRenderer.invoke(RUNTIME_CHANNELS.importPluginPackage, request),

  uninstallPluginPackage: (
    request: UninstallPluginPackageRequest
  ): Promise<UninstallPluginPackageResponse> =>
    ipcRenderer.invoke(RUNTIME_CHANNELS.uninstallPluginPackage, request),

  setPluginPackageEnabled: (
    request: SetPluginPackageEnabledRequest
  ): Promise<SetPluginPackageEnabledResponse> =>
    ipcRenderer.invoke(RUNTIME_CHANNELS.setPluginPackageEnabled, request),

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

type DiagnosticsGetHealthResponse = {
  snapshot?: HealthSnapshot;
  error?: SupportErrorEnvelope;
};

type DiagnosticsExportBundleRequest = {
  includeDays?: number;
};

const diagnosticsAPI = {
  getHealth: (
    request: GetHealthInput = {}
  ): Promise<DiagnosticsGetHealthResponse> =>
    ipcRenderer.invoke(DIAGNOSTICS_CHANNELS.getHealth, request),

  exportBundle: (
    request: DiagnosticsExportBundleRequest = {}
  ): Promise<DiagnosticsExportResult> =>
    ipcRenderer.invoke(DIAGNOSTICS_CHANNELS.exportBundle, request),
};

const secretsAPI = {
  setSecret: (request: SetSecretRequest): Promise<SetSecretResponse> =>
    ipcRenderer.invoke(SECURITY_CHANNELS.set, request),

  getSecret: (request: GetSecretRequest): Promise<GetSecretResponse> =>
    ipcRenderer.invoke(SECURITY_CHANNELS.get, request),

  deleteSecret: (request: DeleteSecretRequest): Promise<DeleteSecretResponse> =>
    ipcRenderer.invoke(SECURITY_CHANNELS.delete, request),

  deleteScopeSecrets: (
    request: DeleteScopeSecretsRequest
  ): Promise<DeleteScopeSecretsResponse> =>
    ipcRenderer.invoke(SECURITY_CHANNELS.deleteScope, request),
};

const configurationAPI = {
  listDocuments: (request: ListDocumentsRequest = {}): Promise<ListDocumentsResponse> =>
    ipcRenderer.invoke(CONFIGURATION_CHANNELS.listDocuments, request),

  loadDocument: (request: LoadDocumentRequest): Promise<LoadDocumentResponse> =>
    ipcRenderer.invoke(CONFIGURATION_CHANNELS.loadDocument, request),

  validateDocument: (
    request: ValidateDocumentRequest
  ): Promise<ValidateDocumentResponse> =>
    ipcRenderer.invoke(CONFIGURATION_CHANNELS.validateDocument, request),

  saveDocument: (
    request: SaveDocumentRequest
  ): Promise<SaveDocumentResponse> =>
    ipcRenderer.invoke(CONFIGURATION_CHANNELS.saveDocument, request),

  applyDocument: (
    request: ApplyDocumentRequest
  ): Promise<ApplyDocumentResponse> =>
    ipcRenderer.invoke(CONFIGURATION_CHANNELS.applyDocument, request),
};

// Expose to renderer via contextBridge - NO raw ipcRenderer
contextBridge.exposeInMainWorld('secureClaw', {
  platform: platformAPI,
  install: installAPI,
  runtime: runtimeAPI,
  diagnostics: diagnosticsAPI,
  secrets: secretsAPI,
  configuration: configurationAPI,
});

// Type declaration for renderer usage
declare global {
  interface Window {
    secureClaw: {
      platform: typeof platformAPI;
      install: typeof installAPI;
      runtime: typeof runtimeAPI;
      diagnostics: typeof diagnosticsAPI;
      secrets: typeof secretsAPI;
      configuration: typeof configurationAPI;
    };
  }
}
