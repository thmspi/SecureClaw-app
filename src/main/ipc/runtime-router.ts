import { randomUUID } from 'crypto';
import { ipcMain, IpcMainInvokeEvent, BrowserWindow } from 'electron';
import {
  RUNTIME_CHANNELS,
  startSessionSchema,
  stopSessionSchema,
  getSessionsSchema,
  runPluginSchema,
  cancelPluginSchema,
  getPluginRunsSchema,
  getHistorySchema,
} from '../../shared/ipc/runtime-channels';
import type {
  StartSessionRequest,
  StartSessionResponse,
  StopSessionRequest,
  StopSessionResponse,
  GetSessionsRequest,
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
} from '../../shared/runtime/runtime-contracts';
import * as sessionOrchestrator from '../runtime/session-orchestrator';
import * as pluginRunner from '../runtime/plugin-runner';
import * as historyService from '../runtime/runtime-history-service';

let mainWindow: BrowserWindow | null = null;

export function setMainWindow(window: BrowserWindow): void {
  mainWindow = window;
}

function emitToRenderer(channel: string, event: SessionEvent | PluginEvent): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send(channel, event);
}

function forwardSessionEvent(event: SessionEvent): void {
  emitToRenderer(RUNTIME_CHANNELS.sessionEvent, event);
}

function forwardPluginEvent(event: PluginEvent): void {
  emitToRenderer(RUNTIME_CHANNELS.pluginEvent, event);
}

function recordSessionHistory(params: {
  operationType: 'session_start' | 'session_stop';
  sessionId: string;
  success: boolean;
  error?: string;
}): void {
  const now = new Date().toISOString();

  historyService.saveHistoryRecord({
    id: randomUUID(),
    operationType: params.operationType,
    status: params.success ? 'success' : 'failed',
    targetName: params.sessionId,
    startedAt: now,
    completedAt: now,
    errorMessage: params.error,
  });
}

export function registerRuntimeHandlers(ipc: typeof ipcMain): void {
  ipc.handle(
    RUNTIME_CHANNELS.startSession,
    async (_event: IpcMainInvokeEvent, request: unknown): Promise<StartSessionResponse> => {
      const validatedRequest = startSessionSchema.parse(request) as StartSessionRequest;

      sessionOrchestrator.registerSessionEventListener(validatedRequest.sessionId, forwardSessionEvent);
      const response = await sessionOrchestrator.startSession(validatedRequest);

      recordSessionHistory({
        operationType: 'session_start',
        sessionId: validatedRequest.sessionId,
        success: response.started,
        error: response.error,
      });

      return response;
    }
  );

  ipc.handle(
    RUNTIME_CHANNELS.stopSession,
    async (_event: IpcMainInvokeEvent, request: unknown): Promise<StopSessionResponse> => {
      const validatedRequest = stopSessionSchema.parse(request) as StopSessionRequest;
      const response = await sessionOrchestrator.stopSession(validatedRequest);

      recordSessionHistory({
        operationType: 'session_stop',
        sessionId: validatedRequest.sessionId,
        success: response.stopped,
        error: response.error,
      });

      sessionOrchestrator.unregisterSessionEventListener(validatedRequest.sessionId);
      return response;
    }
  );

  ipc.handle(
    RUNTIME_CHANNELS.getSessions,
    async (_event: IpcMainInvokeEvent, request: unknown): Promise<GetSessionsResponse> => {
      getSessionsSchema.parse(request);
      const validatedRequest = request as GetSessionsRequest;
      void validatedRequest;
      return {
        sessions: sessionOrchestrator.getSessions(),
      };
    }
  );

  ipc.handle(
    RUNTIME_CHANNELS.runPlugin,
    async (_event: IpcMainInvokeEvent, request: unknown): Promise<RunPluginResponse> => {
      const validatedRequest = runPluginSchema.parse(request) as RunPluginRequest;

      pluginRunner.registerPluginEventListener(validatedRequest.runId, forwardPluginEvent);
      return pluginRunner.enqueuePlugin(validatedRequest);
    }
  );

  ipc.handle(
    RUNTIME_CHANNELS.cancelPluginRun,
    async (_event: IpcMainInvokeEvent, request: unknown): Promise<CancelPluginResponse> => {
      const validatedRequest = cancelPluginSchema.parse(request) as CancelPluginRequest;
      const response = await pluginRunner.cancelPluginRun(validatedRequest);

      if (response.cancelled) {
        pluginRunner.unregisterPluginEventListener(validatedRequest.runId);
      }

      return response;
    }
  );

  ipc.handle(
    RUNTIME_CHANNELS.getPluginRuns,
    async (_event: IpcMainInvokeEvent, request: unknown): Promise<GetPluginRunsResponse> => {
      const validatedRequest = getPluginRunsSchema.parse(request) as GetPluginRunsRequest;
      return pluginRunner.getPluginRuns(validatedRequest);
    }
  );

  ipc.handle(
    RUNTIME_CHANNELS.getHistory,
    async (_event: IpcMainInvokeEvent, request: unknown): Promise<GetHistoryResponse> => {
      const validatedRequest = getHistorySchema.parse(request) as GetHistoryRequest;
      return historyService.getHistory(validatedRequest);
    }
  );
}

export function initializeRuntimeHistoryTracking(): void {
  // History records are currently written directly in the relevant IPC handlers.
}
