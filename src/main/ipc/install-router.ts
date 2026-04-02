import { ipcMain, IpcMainInvokeEvent, BrowserWindow } from 'electron';
import {
  INSTALL_CHANNELS,
  installStartSchema,
} from '../../shared/install/install-channels';
import { installOrchestrator } from '../install/install-orchestrator';
import {
  runAllPrerequisiteChecks,
  startDockerDaemonIfNeeded,
} from '../install/prerequisite-service';

export function registerInstallHandlers(
  ipc: typeof ipcMain,
  mainWindow: BrowserWindow
): void {
  // Set window reference for event emission
  installOrchestrator.setWindow(mainWindow);

  // Start install
  ipc.handle(
    INSTALL_CHANNELS.start,
    async (_event: IpcMainInvokeEvent, request: unknown) => {
      const { target, correlationId } = installStartSchema
        .extend({ correlationId: require('zod').z.string() })
        .parse(request);

      // Start async - don't await (events will stream)
      installOrchestrator.start(target, correlationId).catch(console.error);

      return { correlationId };
    }
  );

  // Cancel install
  ipc.handle(INSTALL_CHANNELS.cancel, async () => {
    return installOrchestrator.cancel();
  });

  // Retry install
  ipc.handle(INSTALL_CHANNELS.retry, async () => {
    await installOrchestrator.retry();
  });

  // Get current state
  ipc.handle(INSTALL_CHANNELS.getState, async () => {
    return installOrchestrator.getState();
  });

  // Run prerequisite checks
  ipc.handle(INSTALL_CHANNELS.runPrerequisites, async () => {
    return runAllPrerequisiteChecks();
  });

  // Start Docker daemon for NemoClaw prerequisites
  ipc.handle(INSTALL_CHANNELS.startDockerDaemon, async () => {
    return startDockerDaemonIfNeeded();
  });
}
