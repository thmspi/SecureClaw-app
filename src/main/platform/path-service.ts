import { app } from 'electron';
import * as path from 'path';

// Centralized path service using Electron app APIs only - no hardcoded OS paths

export function getAppDataDir(): string {
  return app.getPath('userData');
}

export function getLogsDir(): string {
  return app.getPath('logs');
}

export function getWorkDir(projectId: string): string {
  return path.join(getAppDataDir(), 'work', projectId);
}

export function getManagedCacheDir(): string {
  return path.join(getAppDataDir(), 'cache');
}
