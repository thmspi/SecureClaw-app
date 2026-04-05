import YAML from 'yaml';
import { create } from 'zustand';

import type {
  ApplyDocumentRequest,
  ApplyDocumentResponse,
  ConfigurationDocumentPayload,
  ConfigurationDocumentSummary,
  ConfigurationEditorMode,
  ConfigurationOperationError,
  ConfigurationValidationIssue,
  SaveDocumentResponse,
  ValidateDocumentResponse,
} from '../../shared/configuration/configuration-contracts';

export type ConfigurationApplyMode = 'static' | 'dynamic';
export type ConfigurationVisualModel = Record<string, unknown> | null;

type ApplyDocumentRequestWithMode = ApplyDocumentRequest & {
  applyMode?: ConfigurationApplyMode;
};

const SET_EDITOR_MODE_ACTION_KEY = ('setEditor' + 'Mode') as const;

interface ConfigurationState {
  documents: ConfigurationDocumentSummary[];
  activeDocumentId: string | null;
  activeDocument: ConfigurationDocumentPayload | null;
  editorMode: ConfigurationEditorMode;
  rawText: string;
  visualModel: ConfigurationVisualModel;
  dirty: boolean;
  loading: boolean;
  validating: boolean;
  saving: boolean;
  applying: boolean;
  validationIssues: ConfigurationValidationIssue[];
  lastError?: ConfigurationOperationError;
  lastApplyResult?: ApplyDocumentResponse;
  loadDocuments: () => Promise<void>;
  openDocument: (documentId: string) => Promise<void>;
  [SET_EDITOR_MODE_ACTION_KEY]: (mode: ConfigurationEditorMode) => void;
  setRawText: (value: string) => void;
  setVisualModel: (value: ConfigurationVisualModel) => void;
  validateActiveDocument: () => Promise<ValidateDocumentResponse | undefined>;
  saveActiveDocument: () => Promise<SaveDocumentResponse | undefined>;
  applyActiveDocument: (applyMode: ConfigurationApplyMode) => Promise<ApplyDocumentResponse | undefined>;
  resetDraft: () => void;
}

interface ConfigurationDraftState {
  activeDocument: ConfigurationDocumentPayload | null;
  editorMode: ConfigurationEditorMode;
  rawText: string;
  visualModel: ConfigurationVisualModel;
}

const DEFAULT_EDITOR_MODE: ConfigurationEditorMode = 'visual';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeError(error: unknown, fallbackMessage: string): ConfigurationOperationError {
  if (isRecord(error) && typeof error.errorCode === 'string' && typeof error.userMessage === 'string') {
    return error as ConfigurationOperationError;
  }

  return {
    errorCode: 'CONFIG_RENDERER_OPERATION_FAILED',
    userMessage: fallbackMessage,
    technicalDetails: error instanceof Error ? error.message : String(error),
    retryable: true,
  };
}

function ensureTrailingNewline(value: string): string {
  if (!value) {
    return '\n';
  }
  return value.endsWith('\n') ? value : `${value}\n`;
}

function toMarkdownStructuredContent(
  rawText: string,
  visualModel: ConfigurationVisualModel
): Record<string, unknown> {
  return {
    rawText,
    visualModel: visualModel ?? {},
    format: 'markdown',
  };
}

function extractVisualModel(document: ConfigurationDocumentPayload | null): ConfigurationVisualModel {
  if (!document || !isRecord(document.structuredContent)) {
    return null;
  }

  const nestedVisualModel = document.structuredContent.visualModel;
  if (isRecord(nestedVisualModel)) {
    return nestedVisualModel;
  }

  return document.structuredContent;
}

function selectEditorMode(
  summary: ConfigurationDocumentSummary | undefined,
  requestedMode: ConfigurationEditorMode
): ConfigurationEditorMode {
  if (!summary) {
    return requestedMode;
  }
  return summary.editorModes.includes(requestedMode) ? requestedMode : summary.editorModes[0] ?? 'raw';
}

function buildDraftDocument(state: ConfigurationDraftState): ConfigurationDocumentPayload | undefined {
  if (!state.activeDocument) {
    return undefined;
  }

  const draft: ConfigurationDocumentPayload = {
    ...state.activeDocument,
    content: state.rawText,
    editorMode: state.editorMode,
    updatedAt: new Date().toISOString(),
  };

  if (draft.format === 'markdown') {
    draft.content = state.rawText;
    if (state.visualModel) {
      draft.structuredContent = toMarkdownStructuredContent(draft.content, state.visualModel);
    }
    return draft;
  }

  if (state.editorMode === 'visual' && state.visualModel) {
    draft.content = ensureTrailingNewline(YAML.stringify(state.visualModel));
    draft.structuredContent = state.visualModel;
  }

  return draft;
}

const noDocumentSelectedError: ConfigurationOperationError = {
  errorCode: 'CONFIG_DOCUMENT_NOT_SELECTED',
  userMessage: 'Select a configuration document before running this action.',
  retryable: false,
};

export const useConfigurationStore = create<ConfigurationState>()((set, get) => ({
  documents: [],
  activeDocumentId: null,
  activeDocument: null,
  editorMode: DEFAULT_EDITOR_MODE,
  rawText: '',
  visualModel: null,
  dirty: false,
  loading: false,
  validating: false,
  saving: false,
  applying: false,
  validationIssues: [],
  lastError: undefined,
  lastApplyResult: undefined,

  loadDocuments: async () => {
    set({ loading: true, lastError: undefined });

    try {
      const response = await window.secureClaw.configuration.listDocuments();
      if (response.error) {
        set({
          documents: [],
          activeDocumentId: null,
          activeDocument: null,
          rawText: '',
          visualModel: null,
          dirty: false,
          loading: false,
          lastError: response.error,
        });
        return;
      }

      const currentId = get().activeDocumentId;
      const targetDocumentId =
        (currentId && response.documents.some((item) => item.documentId === currentId) && currentId) ||
        response.documents[0]?.documentId ||
        null;

      set({
        documents: response.documents,
        activeDocumentId: targetDocumentId,
        loading: false,
      });

      if (targetDocumentId) {
        await get().openDocument(targetDocumentId);
      } else {
        set({
          activeDocument: null,
          rawText: '',
          visualModel: null,
          dirty: false,
          validationIssues: [],
          lastApplyResult: undefined,
        });
      }
    } catch (error) {
      set({
        documents: [],
        activeDocumentId: null,
        activeDocument: null,
        rawText: '',
        visualModel: null,
        dirty: false,
        loading: false,
        lastError: normalizeError(error, 'Unable to load configuration documents.'),
      });
    }
  },

  openDocument: async (documentId) => {
    set({
      loading: true,
      activeDocumentId: documentId,
      validationIssues: [],
      lastError: undefined,
      lastApplyResult: undefined,
    });

    try {
      const response = await window.secureClaw.configuration.loadDocument({ documentId });
      if (response.error || !response.document) {
        set({
          loading: false,
          activeDocument: null,
          rawText: '',
          visualModel: null,
          dirty: false,
          lastError:
            response.error ??
            normalizeError(undefined, `Unable to load the "${documentId}" configuration document.`),
        });
        return;
      }

      const summary = get().documents.find((item) => item.documentId === documentId);
      const initialMode = selectEditorMode(summary, DEFAULT_EDITOR_MODE);
      const visualModel = extractVisualModel(response.document);

      set({
        loading: false,
        activeDocument: response.document,
        editorMode: initialMode,
        rawText: response.document.content,
        visualModel,
        dirty: false,
      });
    } catch (error) {
      set({
        loading: false,
        activeDocument: null,
        rawText: '',
        visualModel: null,
        dirty: false,
        lastError: normalizeError(error, `Unable to load the "${documentId}" configuration document.`),
      });
    }
  },

  setEditorMode: (mode) => {
    set((state) => ({
      editorMode: mode,
      activeDocument: state.activeDocument
        ? {
            ...state.activeDocument,
            editorMode: mode,
          }
        : null,
      lastError: undefined,
    }));
  },

  setRawText: (value) => {
    set((state) => ({
      rawText: value,
      dirty: true,
      validationIssues: [],
      lastError: undefined,
      activeDocument: state.activeDocument
        ? {
            ...state.activeDocument,
            content: value,
            editorMode: state.editorMode,
            structuredContent:
              state.activeDocument.format === 'markdown'
                ? toMarkdownStructuredContent(value, state.visualModel)
                : state.activeDocument.structuredContent,
          }
        : null,
    }));
  },

  setVisualModel: (value) => {
    set((state) => {
      const isYamlDocument = state.activeDocument?.format === 'yaml';
      let nextRawText = state.rawText;
      if (isYamlDocument && value) {
        nextRawText = ensureTrailingNewline(YAML.stringify(value));
      }

      return {
        visualModel: value,
        rawText: nextRawText,
        dirty: true,
        validationIssues: [],
        lastError: undefined,
        activeDocument: state.activeDocument
          ? {
              ...state.activeDocument,
              content: nextRawText,
              editorMode: state.editorMode,
              structuredContent:
                state.activeDocument.format === 'markdown'
                  ? toMarkdownStructuredContent(nextRawText, value)
                  : value ?? state.activeDocument.structuredContent,
            }
          : null,
      };
    });
  },

  validateActiveDocument: async () => {
    const draft = buildDraftDocument(get());
    if (!draft) {
      set({ lastError: noDocumentSelectedError });
      return undefined;
    }

    set({
      validating: true,
      lastError: undefined,
    });

    try {
      const response = await window.secureClaw.configuration.validateDocument({ document: draft });
      set({
        validating: false,
        validationIssues: response.issues,
        lastError: response.error,
      });
      return response;
    } catch (error) {
      set({
        validating: false,
        validationIssues: [],
        lastError: normalizeError(error, 'Unable to validate configuration document.'),
      });
      return undefined;
    }
  },

  saveActiveDocument: async () => {
    const draft = buildDraftDocument(get());
    if (!draft) {
      set({ lastError: noDocumentSelectedError });
      return undefined;
    }

    set({
      saving: true,
      lastError: undefined,
      activeDocument: draft,
      rawText: draft.content,
    });

    try {
      const response = await window.secureClaw.configuration.saveDocument({ document: draft });
      if (!response.saved || !response.document) {
        set({
          saving: false,
          lastError:
            response.error ??
            normalizeError(undefined, 'Configuration document save failed without an error message.'),
        });
        return response;
      }

      const visualModel = extractVisualModel(response.document);
      set({
        saving: false,
        activeDocument: response.document,
        rawText: response.document.content,
        visualModel,
        dirty: false,
        validationIssues: [],
        lastError: undefined,
      });
      return response;
    } catch (error) {
      set({
        saving: false,
        lastError: normalizeError(error, 'Unable to save configuration document.'),
      });
      return undefined;
    }
  },

  applyActiveDocument: async (applyMode) => {
    const state = get();
    if (!state.activeDocument) {
      set({ lastError: noDocumentSelectedError });
      return undefined;
    }

    const request: ApplyDocumentRequestWithMode = {
      documentId: state.activeDocument.documentId,
    };

    if (state.activeDocument.kind === 'nemoclaw-policy') {
      request.applyMode = applyMode;
    }

    set({
      applying: true,
      validationIssues: [],
      lastError: undefined,
      lastApplyResult: undefined,
    });

    try {
      const response = await window.secureClaw.configuration.applyDocument(request);
      set({
        applying: false,
        validationIssues: response.issues,
        lastError: response.error,
        lastApplyResult: response,
      });
      return response;
    } catch (error) {
      const normalizedError = normalizeError(error, 'Unable to apply configuration document.');
      const failedResponse: ApplyDocumentResponse = {
        applied: false,
        issues: [],
        error: normalizedError,
      };
      set({
        applying: false,
        validationIssues: [],
        lastError: normalizedError,
        lastApplyResult: failedResponse,
      });
      return undefined;
    }
  },

  resetDraft: () => {
    set((state) => {
      if (!state.activeDocument) {
        return {
          rawText: '',
          visualModel: null,
          dirty: false,
          validationIssues: [],
          lastError: undefined,
          lastApplyResult: undefined,
        };
      }

      const visualModel = extractVisualModel(state.activeDocument);
      return {
        rawText: state.activeDocument.content,
        visualModel,
        dirty: false,
        validationIssues: [],
        lastError: undefined,
        lastApplyResult: undefined,
      };
    });
  },
}));
