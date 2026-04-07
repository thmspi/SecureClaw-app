import type {
  ApplyDocumentRequest,
  ApplyDocumentResponse,
  ConfigurationDocumentSummary,
  ConfigurationOperationError,
  DeleteDocumentRequest,
  DeleteDocumentResponse,
  ListDocumentsRequest,
  ListDocumentsResponse,
  LoadDocumentRequest,
  LoadDocumentResponse,
  SaveDocumentRequest,
  SaveDocumentResponse,
  ValidateDocumentRequest,
  ValidateDocumentResponse,
} from '../../shared/configuration/configuration-contracts';
import { nemoclawPolicyDocumentAdapter } from './documents/nemoclaw-policy-document';
import { openclawWorkspaceDocumentAdapter } from './documents/openclaw-workspace-document';

interface ConfigurationDocumentAdapter {
  listDocuments: () => ConfigurationDocumentSummary[];
  loadDocument: (request: LoadDocumentRequest) => Promise<LoadDocumentResponse>;
  validateDocument: (request: ValidateDocumentRequest) => Promise<ValidateDocumentResponse>;
  saveDocument: (request: SaveDocumentRequest) => Promise<SaveDocumentResponse>;
  deleteDocument: (request: DeleteDocumentRequest) => Promise<DeleteDocumentResponse>;
  applyDocument: (request: ApplyDocumentRequest) => Promise<ApplyDocumentResponse>;
}

const adapters: ConfigurationDocumentAdapter[] = [
  nemoclawPolicyDocumentAdapter,
  openclawWorkspaceDocumentAdapter,
];

const WORKSPACE_DOCUMENT_PREFIXES = ['openclaw-skill:', 'openclaw-agent-rules:'] as const;

function buildNotFoundError(documentId: string): ConfigurationOperationError {
  return {
    errorCode: 'CONFIG_DOCUMENT_NOT_FOUND',
    userMessage: `Configuration document "${documentId}" was not found.`,
  };
}

function getDocumentSummaries(): ConfigurationDocumentSummary[] {
  const summaries: ConfigurationDocumentSummary[] = [];
  for (const adapter of adapters) {
    summaries.push(...adapter.listDocuments());
  }
  return summaries;
}

function resolveAdapterByDocumentId(documentId: string): ConfigurationDocumentAdapter | undefined {
  if (documentId === 'nemoclaw-policy') {
    return nemoclawPolicyDocumentAdapter;
  }

  if (WORKSPACE_DOCUMENT_PREFIXES.some((prefix) => documentId.startsWith(prefix))) {
    return openclawWorkspaceDocumentAdapter;
  }

  for (const adapter of adapters) {
    const hasDocument = adapter.listDocuments().some((summary) => summary.documentId === documentId);
    if (hasDocument) {
      return adapter;
    }
  }

  return undefined;
}

export const configurationService = {
  async listDocuments(request: ListDocumentsRequest = {}): Promise<ListDocumentsResponse> {
    const summaries = getDocumentSummaries();

    if (!request.kinds || request.kinds.length === 0) {
      return {
        documents: summaries,
      };
    }

    return {
      documents: summaries.filter((summary) => request.kinds?.includes(summary.kind)),
    };
  },

  async loadDocument(request: LoadDocumentRequest): Promise<LoadDocumentResponse> {
    const adapter = resolveAdapterByDocumentId(request.documentId);
    if (!adapter) {
      return {
        error: buildNotFoundError(request.documentId),
      };
    }

    return adapter.loadDocument(request);
  },

  async validateDocument(request: ValidateDocumentRequest): Promise<ValidateDocumentResponse> {
    const documentId = request.document.documentId;
    const adapter = resolveAdapterByDocumentId(documentId);
    if (!adapter) {
      return {
        valid: false,
        issues: [],
        error: buildNotFoundError(documentId),
      };
    }

    return adapter.validateDocument(request);
  },

  async saveDocument(request: SaveDocumentRequest): Promise<SaveDocumentResponse> {
    const documentId = request.document.documentId;
    const adapter = resolveAdapterByDocumentId(documentId);
    if (!adapter) {
      return {
        saved: false,
        error: buildNotFoundError(documentId),
      };
    }

    return adapter.saveDocument(request);
  },

  async deleteDocument(request: DeleteDocumentRequest): Promise<DeleteDocumentResponse> {
    const adapter = resolveAdapterByDocumentId(request.documentId);
    if (!adapter) {
      return {
        deleted: false,
        error: buildNotFoundError(request.documentId),
      };
    }

    return adapter.deleteDocument(request);
  },

  async applyDocument(request: ApplyDocumentRequest): Promise<ApplyDocumentResponse> {
    const adapter = resolveAdapterByDocumentId(request.documentId);
    if (!adapter) {
      return {
        applied: false,
        issues: [],
        error: buildNotFoundError(request.documentId),
      };
    }

    return adapter.applyDocument(request);
  },
};
