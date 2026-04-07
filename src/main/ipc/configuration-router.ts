import { ipcMain, IpcMainInvokeEvent } from 'electron';
import {
  CONFIGURATION_CHANNELS,
  applyDocumentSchema,
  deleteDocumentSchema,
  listDocumentsSchema,
  loadDocumentSchema,
  saveDocumentSchema,
  validateDocumentSchema,
} from '../../shared/ipc/configuration-channels';
import type {
  ApplyDocumentRequest,
  ApplyDocumentResponse,
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
import { configurationService } from '../configuration/configuration-service';

export function registerConfigurationHandlers(ipc: typeof ipcMain): void {
  ipc.handle(
    CONFIGURATION_CHANNELS.listDocuments,
    async (_event: IpcMainInvokeEvent, request: unknown): Promise<ListDocumentsResponse> => {
      const validatedRequest = listDocumentsSchema.parse(request) as ListDocumentsRequest;
      return configurationService.listDocuments(validatedRequest);
    }
  );

  ipc.handle(
    CONFIGURATION_CHANNELS.loadDocument,
    async (_event: IpcMainInvokeEvent, request: unknown): Promise<LoadDocumentResponse> => {
      const validatedRequest = loadDocumentSchema.parse(request) as LoadDocumentRequest;
      return configurationService.loadDocument(validatedRequest);
    }
  );

  ipc.handle(
    CONFIGURATION_CHANNELS.validateDocument,
    async (_event: IpcMainInvokeEvent, request: unknown): Promise<ValidateDocumentResponse> => {
      const validatedRequest = validateDocumentSchema.parse(request) as ValidateDocumentRequest;
      return configurationService.validateDocument(validatedRequest);
    }
  );

  ipc.handle(
    CONFIGURATION_CHANNELS.saveDocument,
    async (_event: IpcMainInvokeEvent, request: unknown): Promise<SaveDocumentResponse> => {
      const validatedRequest = saveDocumentSchema.parse(request) as SaveDocumentRequest;
      return configurationService.saveDocument(validatedRequest);
    }
  );

  ipc.handle(
    CONFIGURATION_CHANNELS.deleteDocument,
    async (_event: IpcMainInvokeEvent, request: unknown): Promise<DeleteDocumentResponse> => {
      const validatedRequest = deleteDocumentSchema.parse(request) as DeleteDocumentRequest;
      return configurationService.deleteDocument(validatedRequest);
    }
  );

  ipc.handle(
    CONFIGURATION_CHANNELS.applyDocument,
    async (_event: IpcMainInvokeEvent, request: unknown): Promise<ApplyDocumentResponse> => {
      const validatedRequest = applyDocumentSchema.parse(request) as ApplyDocumentRequest;
      return configurationService.applyDocument(validatedRequest);
    }
  );
}
