import { contextBridge, ipcRenderer } from 'electron';
import { PLATFORM_CHANNELS } from '../shared/ipc/platform-channels';
import type {
  RunProcessRequest,
  RunProcessResponse,
  StopProcessRequest,
  StopProcessResponse,
  GetPathsRequest,
  GetPathsResponse,
} from '../shared/platform/contracts';

// Narrow platform API - only approved operations
const platformAPI = {
  runProcess: (request: RunProcessRequest): Promise<RunProcessResponse> => {
    return ipcRenderer.invoke(PLATFORM_CHANNELS.runProcess, request);
  },
  
  stopProcess: (request: StopProcessRequest): Promise<StopProcessResponse> => {
    return ipcRenderer.invoke(PLATFORM_CHANNELS.stopProcess, request);
  },
  
  getPaths: (request: GetPathsRequest): Promise<GetPathsResponse> => {
    return ipcRenderer.invoke(PLATFORM_CHANNELS.getPaths, request);
  },
};

// Expose to renderer via contextBridge - NO raw ipcRenderer
contextBridge.exposeInMainWorld('secureClaw', {
  platform: platformAPI,
});

// Type declaration for renderer usage
declare global {
  interface Window {
    secureClaw: {
      platform: typeof platformAPI;
    };
  }
}
