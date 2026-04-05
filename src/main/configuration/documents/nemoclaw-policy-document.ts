import type {
  ApplyDocumentRequest,
  ApplyDocumentResponse,
  ConfigurationDocumentSummary,
  ConfigurationOperationError,
  LoadDocumentRequest,
  LoadDocumentResponse,
  SaveDocumentRequest,
  SaveDocumentResponse,
  ValidateDocumentRequest,
  ValidateDocumentResponse,
} from '../../../shared/configuration/configuration-contracts';

const NEMOCLAW_POLICY_DOCUMENT_ID = 'nemoclaw-policy';

const CONFIG_NOT_IMPLEMENTED_ERROR: ConfigurationOperationError = {
  errorCode: 'CONFIG_NOT_IMPLEMENTED',
  userMessage: 'Configuration adapter not implemented yet.',
};

const NEMOCLAW_POLICY_SUMMARY: ConfigurationDocumentSummary = {
  documentId: NEMOCLAW_POLICY_DOCUMENT_ID,
  displayName: 'NemoClaw Sandbox Policy',
  kind: 'nemoclaw-policy',
  format: 'yaml',
  editorModes: ['visual', 'raw'],
  description: 'Edit baseline NemoClaw sandbox policy.',
};

const createNotImplementedIssue = () => ({
  level: 'error' as const,
  message: CONFIG_NOT_IMPLEMENTED_ERROR.userMessage,
  code: CONFIG_NOT_IMPLEMENTED_ERROR.errorCode,
});

export const nemoclawPolicyDocumentAdapter = {
  listDocuments(): ConfigurationDocumentSummary[] {
    return [NEMOCLAW_POLICY_SUMMARY];
  },

  async loadDocument(_request: LoadDocumentRequest): Promise<LoadDocumentResponse> {
    return {
      error: CONFIG_NOT_IMPLEMENTED_ERROR,
    };
  },

  async validateDocument(_request: ValidateDocumentRequest): Promise<ValidateDocumentResponse> {
    return {
      valid: false,
      issues: [createNotImplementedIssue()],
      error: CONFIG_NOT_IMPLEMENTED_ERROR,
    };
  },

  async saveDocument(_request: SaveDocumentRequest): Promise<SaveDocumentResponse> {
    return {
      saved: false,
      error: CONFIG_NOT_IMPLEMENTED_ERROR,
    };
  },

  async applyDocument(_request: ApplyDocumentRequest): Promise<ApplyDocumentResponse> {
    return {
      applied: false,
      issues: [createNotImplementedIssue()],
      error: CONFIG_NOT_IMPLEMENTED_ERROR,
    };
  },
};
