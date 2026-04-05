import type {
  ApplyDocumentRequest,
  ApplyDocumentResponse,
  ConfigurationDocumentSummary,
  ConfigurationOperationError,
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
  applyDocument: (request: ApplyDocumentRequest) => Promise<ApplyDocumentResponse>;
}

const adapters: ConfigurationDocumentAdapter[] = [
  nemoclawPolicyDocumentAdapter,
  openclawWorkspaceDocumentAdapter,
];

const documentSummaries: ConfigurationDocumentSummary[] = [];
const adaptersByDocumentId = new Map<string, ConfigurationDocumentAdapter>();

for (const adapter of adapters) {
  const summaries = adapter.listDocuments();
  for (const summary of summaries) {
    documentSummaries.push(summary);
    adaptersByDocumentId.set(summary.documentId, adapter);
  }
}

function buildNotFoundError(documentId: string): ConfigurationOperationError {
  return {
    errorCode: 'CONFIG_DOCUMENT_NOT_FOUND',
    userMessage: `Configuration document "${documentId}" was not found.`,
  };
}

export const configurationService = {
  async listDocuments(request: ListDocumentsRequest = {}): Promise<ListDocumentsResponse> {
    if (!request.kinds || request.kinds.length === 0) {
      return {
        documents: documentSummaries,
      };
    }

    return {
      documents: documentSummaries.filter((summary) => request.kinds?.includes(summary.kind)),
    };
  },

  async loadDocument(request: LoadDocumentRequest): Promise<LoadDocumentResponse> {
    const adapter = adaptersByDocumentId.get(request.documentId);
    if (!adapter) {
      return {
        error: buildNotFoundError(request.documentId),
      };
    }

    return adapter.loadDocument(request);
  },

  async validateDocument(request: ValidateDocumentRequest): Promise<ValidateDocumentResponse> {
    const documentId = request.document.documentId;
    const adapter = adaptersByDocumentId.get(documentId);
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
    const adapter = adaptersByDocumentId.get(documentId);
    if (!adapter) {
      return {
        saved: false,
        error: buildNotFoundError(documentId),
      };
    }

    return adapter.saveDocument(request);
  },

  async applyDocument(request: ApplyDocumentRequest): Promise<ApplyDocumentResponse> {
    const adapter = adaptersByDocumentId.get(request.documentId);
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
