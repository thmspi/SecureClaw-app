import type {
  GetPathsRequest,
  GetPathsResponse,
  RunProcessRequest,
  RunProcessResponse,
  StopProcessRequest,
  StopProcessResponse,
} from '../shared/platform/contracts';
import type {
  InstallError,
  InstallProgress,
  InstallState,
  PrerequisiteResult,
  StartDockerDaemonResult,
  UninstallStackResult,
} from '../shared/install/install-contracts';
import type {
  CancelPluginRequest,
  CancelPluginResponse,
  GetHistoryRequest,
  GetHistoryResponse,
  GetPluginRunsRequest,
  GetPluginRunsResponse,
  GetSessionsResponse,
  ImportPluginPackageRequest,
  ImportPluginPackageResponse,
  ListPluginPackagesResponse,
  PluginEvent,
  RunPluginRequest,
  RunPluginResponse,
  SessionEvent,
  SetPluginPackageEnabledRequest,
  SetPluginPackageEnabledResponse,
  StartSessionRequest,
  StartSessionResponse,
  StopSessionRequest,
  StopSessionResponse,
  UninstallPluginPackageRequest,
  UninstallPluginPackageResponse,
  ValidatePluginPackageRequest,
  ValidatePluginPackageResponse,
} from '../shared/runtime/runtime-contracts';
import type {
  DiagnosticsExportResult,
  HealthSnapshot,
  SupportErrorEnvelope,
} from '../shared/diagnostics/diagnostics-contracts';
import type { GetHealthInput } from '../shared/ipc/diagnostics-channels';
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

type Unsubscribe = () => void;

export interface SecureClawPlatformAPI {
  runProcess: (request: RunProcessRequest) => Promise<RunProcessResponse>;
  stopProcess: (request: StopProcessRequest) => Promise<StopProcessResponse>;
  getPaths: (request: GetPathsRequest) => Promise<GetPathsResponse>;
}

export interface SecureClawInstallAPI {
  start: (target: 'openclaw' | 'nemoclaw') => Promise<{ correlationId: string }>;
  cancel: () => Promise<{ removed: string[] }>;
  retry: () => Promise<void>;
  getState: () => Promise<InstallState | null>;
  runPrerequisites: () => Promise<PrerequisiteResult>;
  startDockerDaemon: () => Promise<StartDockerDaemonResult>;
  uninstallStack: () => Promise<UninstallStackResult>;
  onProgress: (callback: (progress: InstallProgress) => void) => Unsubscribe;
  onError: (callback: (error: InstallError) => void) => Unsubscribe;
  onComplete: (callback: () => void) => Unsubscribe;
}

export interface SecureClawRuntimeAPI {
  startSession: (request: StartSessionRequest) => Promise<StartSessionResponse>;
  stopSession: (request: StopSessionRequest) => Promise<StopSessionResponse>;
  getSessions: () => Promise<GetSessionsResponse>;
  runPlugin: (request: RunPluginRequest) => Promise<RunPluginResponse>;
  cancelPluginRun: (request: CancelPluginRequest) => Promise<CancelPluginResponse>;
  getPluginRuns: (request: GetPluginRunsRequest) => Promise<GetPluginRunsResponse>;
  listPluginPackages: () => Promise<ListPluginPackagesResponse>;
  validatePluginPackage: (
    request: ValidatePluginPackageRequest
  ) => Promise<ValidatePluginPackageResponse>;
  importPluginPackage: (
    request: ImportPluginPackageRequest
  ) => Promise<ImportPluginPackageResponse>;
  uninstallPluginPackage: (
    request: UninstallPluginPackageRequest
  ) => Promise<UninstallPluginPackageResponse>;
  setPluginPackageEnabled: (
    request: SetPluginPackageEnabledRequest
  ) => Promise<SetPluginPackageEnabledResponse>;
  getHistory: (request: GetHistoryRequest) => Promise<GetHistoryResponse>;
  onSessionEvent: (callback: (event: SessionEvent) => void) => Unsubscribe;
  onPluginEvent: (callback: (event: PluginEvent) => void) => Unsubscribe;
}

export interface SecureClawDiagnosticsAPI {
  getHealth: (
    request?: GetHealthInput
  ) => Promise<{ snapshot?: HealthSnapshot; error?: SupportErrorEnvelope }>;
  exportBundle: (request?: { includeDays?: number }) => Promise<DiagnosticsExportResult>;
}

export interface SecureClawSecretsAPI {
  setSecret: (request: SetSecretRequest) => Promise<SetSecretResponse>;
  getSecret: (request: GetSecretRequest) => Promise<GetSecretResponse>;
  deleteSecret: (request: DeleteSecretRequest) => Promise<DeleteSecretResponse>;
  deleteScopeSecrets: (request: DeleteScopeSecretsRequest) => Promise<DeleteScopeSecretsResponse>;
}

export interface SecureClawConfigurationAPI {
  listDocuments: (request?: ListDocumentsRequest) => Promise<ListDocumentsResponse>;
  loadDocument: (request: LoadDocumentRequest) => Promise<LoadDocumentResponse>;
  validateDocument: (request: ValidateDocumentRequest) => Promise<ValidateDocumentResponse>;
  saveDocument: (request: SaveDocumentRequest) => Promise<SaveDocumentResponse>;
  applyDocument: (request: ApplyDocumentRequest) => Promise<ApplyDocumentResponse>;
}

export interface SecureClawPreloadAPI {
  platform: SecureClawPlatformAPI;
  install: SecureClawInstallAPI;
  runtime: SecureClawRuntimeAPI;
  diagnostics: SecureClawDiagnosticsAPI;
  secrets: SecureClawSecretsAPI;
  configuration: SecureClawConfigurationAPI;
}

declare global {
  interface Window {
    secureClaw: SecureClawPreloadAPI;
  }
}

export {};
