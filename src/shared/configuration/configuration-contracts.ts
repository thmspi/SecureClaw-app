export type ConfigurationDocumentKind = 'nemoclaw-policy' | 'openclaw-skill' | 'openclaw-agent-rules';

export type ConfigurationDocumentFormat = 'yaml' | 'markdown';

export type ConfigurationEditorMode = 'visual' | 'raw';

export interface ConfigurationOperationError {
  errorCode: string;
  userMessage: string;
  technicalDetails?: string;
  retryable?: boolean;
}

export interface ConfigurationDocumentSummary {
  documentId: string;
  displayName: string;
  kind: ConfigurationDocumentKind;
  format: ConfigurationDocumentFormat;
  editorModes: ConfigurationEditorMode[];
  description?: string;
  path?: string;
  updatedAt?: string;
}

export interface ConfigurationDocumentPayload {
  documentId: string;
  kind: ConfigurationDocumentKind;
  format: ConfigurationDocumentFormat;
  content: string;
  editorMode: ConfigurationEditorMode;
  structuredContent?: Record<string, unknown>;
  updatedAt?: string;
}

export interface ConfigurationValidationIssue {
  level: 'error' | 'warning';
  message: string;
  path?: string;
  line?: number;
  column?: number;
  code?: string;
}

export interface ListDocumentsRequest {
  kinds?: ConfigurationDocumentKind[];
}

export interface ListDocumentsResponse {
  documents: ConfigurationDocumentSummary[];
  error?: ConfigurationOperationError;
}

export interface LoadDocumentRequest {
  documentId: string;
}

export interface LoadDocumentResponse {
  document?: ConfigurationDocumentPayload;
  error?: ConfigurationOperationError;
}

export interface ValidateDocumentRequest {
  document: ConfigurationDocumentPayload;
}

export interface ValidateDocumentResponse {
  valid: boolean;
  issues: ConfigurationValidationIssue[];
  error?: ConfigurationOperationError;
}

export interface SaveDocumentRequest {
  document: ConfigurationDocumentPayload;
}

export interface SaveDocumentResponse {
  saved: boolean;
  document?: ConfigurationDocumentPayload;
  error?: ConfigurationOperationError;
}

export interface ApplyDocumentRequest {
  documentId: string;
  dryRun?: boolean;
}

export interface ApplyDocumentResponse {
  applied: boolean;
  issues: ConfigurationValidationIssue[];
  error?: ConfigurationOperationError;
}
