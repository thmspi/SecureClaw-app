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

const OPENCLAW_SKILL_DOCUMENT_ID = 'openclaw-skill';
const OPENCLAW_AGENT_RULES_DOCUMENT_ID = 'openclaw-agent-rules';

const CONFIG_NOT_IMPLEMENTED_ERROR: ConfigurationOperationError = {
  errorCode: 'CONFIG_NOT_IMPLEMENTED',
  userMessage: 'Configuration adapter not implemented yet.',
};

const OPENCLAW_WORKSPACE_DOCUMENTS: ConfigurationDocumentSummary[] = [
  {
    documentId: OPENCLAW_SKILL_DOCUMENT_ID,
    displayName: 'OpenClaw Skills',
    kind: 'openclaw-skill',
    format: 'markdown',
    editorModes: ['visual', 'raw'],
    description: 'Edit OpenClaw skills metadata and instructions.',
  },
  {
    documentId: OPENCLAW_AGENT_RULES_DOCUMENT_ID,
    displayName: 'OpenClaw Agent Rules',
    kind: 'openclaw-agent-rules',
    format: 'markdown',
    editorModes: ['visual', 'raw'],
    description: 'Edit OpenClaw agent rules and standing orders.',
  },
];

const createNotImplementedIssue = () => ({
  level: 'error' as const,
  message: CONFIG_NOT_IMPLEMENTED_ERROR.userMessage,
  code: CONFIG_NOT_IMPLEMENTED_ERROR.errorCode,
});

export const openclawWorkspaceDocumentAdapter = {
  listDocuments(): ConfigurationDocumentSummary[] {
    return OPENCLAW_WORKSPACE_DOCUMENTS;
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
