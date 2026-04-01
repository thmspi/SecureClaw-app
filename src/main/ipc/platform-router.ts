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

export function registerPlatformHandlers(ipc: typeof ipcMain): void {
  // Register runProcess handler with schema validation
  ipc.handle(
    PLATFORM_CHANNELS.runProcess,
    async (_event: IpcMainInvokeEvent, request: unknown): Promise<RunProcessResponse> => {
      // Validate request with zod schema
      const validatedRequest = runProcessSchema.parse(request) as RunProcessRequest;
      
      // TODO: Implement actual process running logic
      // For now, return a stub response
      return {
        correlationId: validatedRequest.correlationId,
        started: true,
        pid: 12345,
      };
    }
  );

  // Register stopProcess handler with schema validation
  ipc.handle(
    PLATFORM_CHANNELS.stopProcess,
    async (_event: IpcMainInvokeEvent, request: unknown): Promise<StopProcessResponse> => {
      // Validate request with zod schema
      const validatedRequest = stopProcessSchema.parse(request) as StopProcessRequest;
      
      // TODO: Implement actual process stopping logic
      return {
        correlationId: validatedRequest.correlationId,
        stopped: true,
      };
    }
  );

  // Register getPaths handler with schema validation
  ipc.handle(
    PLATFORM_CHANNELS.getPaths,
    async (_event: IpcMainInvokeEvent, request: unknown): Promise<GetPathsResponse> => {
      // Validate request with zod schema
      const validatedRequest = getPathsSchema.parse(request) as GetPathsRequest;
      
      // TODO: Implement actual path resolution logic
      const paths: Record<string, string> = {};
      for (const pathType of validatedRequest.paths) {
        paths[pathType] = `/mock/path/${pathType}`;
      }
      
      return {
        paths,
      };
    }
  );
}
