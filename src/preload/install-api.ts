import { ipcRenderer } from 'electron';
import { INSTALL_CHANNELS } from '../shared/install/install-channels';
import type {
  InstallProgress,
  InstallError,
  InstallState,
  PrerequisiteResult,
  StartDockerDaemonResult,
} from '../shared/install/install-contracts';

export const installAPI = {
  /**
   * Start installation for target
   */
  start: (target: 'openclaw' | 'nemoclaw'): Promise<{ correlationId: string }> =>
    ipcRenderer.invoke(INSTALL_CHANNELS.start, {
      target,
      correlationId: crypto.randomUUID(),
    }),

  /**
   * Cancel current installation and rollback
   */
  cancel: (): Promise<{ removed: string[] }> =>
    ipcRenderer.invoke(INSTALL_CHANNELS.cancel),

  /**
   * Retry installation from failed step
   */
  retry: (): Promise<void> => ipcRenderer.invoke(INSTALL_CHANNELS.retry),

  /**
   * Get current install state from database
   */
  getState: (): Promise<InstallState | null> =>
    ipcRenderer.invoke(INSTALL_CHANNELS.getState),

  /**
   * Run prerequisite checks
   */
  runPrerequisites: (): Promise<PrerequisiteResult> =>
    ipcRenderer.invoke(INSTALL_CHANNELS.runPrerequisites),

  /**
   * Start Docker daemon when installed but not yet running
   */
  startDockerDaemon: (): Promise<StartDockerDaemonResult> =>
    ipcRenderer.invoke(INSTALL_CHANNELS.startDockerDaemon),

  // Event subscriptions - return unsubscribe function for cleanup

  /**
   * Subscribe to progress events
   */
  onProgress: (callback: (progress: InstallProgress) => void) => {
    const handler = (_: unknown, data: InstallProgress) => callback(data);
    ipcRenderer.on(INSTALL_CHANNELS.progress, handler);
    return () => ipcRenderer.removeListener(INSTALL_CHANNELS.progress, handler);
  },

  /**
   * Subscribe to error events
   */
  onError: (callback: (error: InstallError) => void) => {
    const handler = (_: unknown, data: InstallError) => callback(data);
    ipcRenderer.on(INSTALL_CHANNELS.error, handler);
    return () => ipcRenderer.removeListener(INSTALL_CHANNELS.error, handler);
  },

  /**
   * Subscribe to completion event
   */
  onComplete: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on(INSTALL_CHANNELS.complete, handler);
    return () => ipcRenderer.removeListener(INSTALL_CHANNELS.complete, handler);
  },
};
