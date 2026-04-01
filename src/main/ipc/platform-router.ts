import { ipcMain, IpcMainInvokeEvent } from 'electron';
import {
  PLATFORM_CHANNELS,
  runProcessSchema,
  stopProcessSchema,
  getPathsSchema,
} from '../../shared/ipc/platform-channels';
import {
  RunProcessRequest,
  RunProcessResponse,
  StopProcessRequest,
  StopProcessResponse,
  GetPathsRequest,
  GetPathsResponse,
} from '../../shared/platform/contracts';
import * as runtimeService from '../runtime/runtime-service';

export function registerPlatformHandlers(ipc: typeof ipcMain): void {
  // Register runProcess handler with schema validation
  ipc.handle(
    PLATFORM_CHANNELS.runProcess,
    async (_event: IpcMainInvokeEvent, request: unknown): Promise<RunProcessResponse> => {
      // Validate request with zod schema
      const validatedRequest = runProcessSchema.parse(request) as RunProcessRequest;
      
      // Dispatch to runtime service
      return runtimeService.runProcess(validatedRequest);
    }
  );

  // Register stopProcess handler with schema validation
  ipc.handle(
    PLATFORM_CHANNELS.stopProcess,
    async (_event: IpcMainInvokeEvent, request: unknown): Promise<StopProcessResponse> => {
      // Validate request with zod schema
      const validatedRequest = stopProcessSchema.parse(request) as StopProcessRequest;
      
      // Dispatch to runtime service
      return runtimeService.stopProcess(validatedRequest);
    }
  );

  // Register getPaths handler with schema validation
  ipc.handle(
    PLATFORM_CHANNELS.getPaths,
    async (_event: IpcMainInvokeEvent, request: unknown): Promise<GetPathsResponse> => {
      // Validate request with zod schema
      const validatedRequest = getPathsSchema.parse(request) as GetPathsRequest;
      
      // Dispatch to runtime service
      return runtimeService.getPaths(validatedRequest);
    }
  );
}
