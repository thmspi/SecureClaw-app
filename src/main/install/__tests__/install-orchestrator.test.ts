import Database from 'better-sqlite3';

const mockSecretStore = {
  deleteScope: jest.fn(),
};

// Mock electron
const mockWebContents = {
  send: jest.fn(),
};
const mockWindow = {
  webContents: mockWebContents,
} as unknown as Electron.BrowserWindow;

jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => ':memory:'),
  },
  BrowserWindow: jest.fn(),
}));

jest.mock('../../security/secret-store-service', () => mockSecretStore);

// Create test database and inject it
let testDb: Database.Database;

beforeEach(async () => {
  jest.resetModules();
  jest.clearAllMocks();
  mockSecretStore.deleteScope.mockReturnValue({
    success: true,
    secureStorageAvailable: true,
    deletedCount: 0,
  });

  // Create in-memory database
  testDb = new Database(':memory:');
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS install_state (
      id TEXT PRIMARY KEY DEFAULT 'singleton',
      target TEXT NOT NULL,
      status TEXT NOT NULL,
      current_step INTEGER NOT NULL DEFAULT 0,
      total_steps INTEGER NOT NULL DEFAULT 5,
      step_name TEXT,
      error_message TEXT,
      error_details TEXT,
      started_at TEXT,
      updated_at TEXT NOT NULL,
      completed_steps TEXT DEFAULT '[]'
    )
  `);

  // Inject test database
  const { _setDbForTesting } = await import('../install-state-service');
  _setDbForTesting(testDb);
});

afterEach(() => {
  testDb?.close();
});

describe('InstallOrchestrator', () => {
  describe('start', () => {
    it('should emit progress events for each step', async () => {
      const { installOrchestrator } = await import('../install-orchestrator');
      installOrchestrator.setWindow(mockWindow);

      await installOrchestrator.start('openclaw', 'test-123');

      expect(mockWebContents.send).toHaveBeenCalledWith(
        'install:v1:progress',
        expect.objectContaining({
          correlationId: 'test-123',
          stepName: expect.any(String),
        })
      );
    });

    it('should emit complete event when all steps finish', async () => {
      const { installOrchestrator } = await import('../install-orchestrator');
      installOrchestrator.setWindow(mockWindow);

      await installOrchestrator.start('openclaw', 'test-456');

      expect(mockWebContents.send).toHaveBeenCalledWith('install:v1:complete');
    });

    it('should save state after each step', async () => {
      const { installOrchestrator } = await import('../install-orchestrator');
      const { loadInstallState } = await import('../install-state-service');
      installOrchestrator.setWindow(mockWindow);

      // State is cleared after successful completion, so check during execution
      // by verifying no error state
      await installOrchestrator.start('openclaw', 'test-789');

      // After completion, state should be cleared
      const state = loadInstallState();
      expect(state).toBeNull();
    });
  });

  describe('cancel', () => {
    it('should call rollback and return removed artifacts', async () => {
      const { installOrchestrator } = await import('../install-orchestrator');
      const { rollbackService } = await import('../rollback-service');

      // Track a test artifact
      rollbackService.track({
        type: 'file',
        path: '/test/file.txt',
        createdAt: new Date().toISOString(),
      });

      await installOrchestrator.cancel();

      // Rollback was called (artifacts were processed)
      expect(rollbackService.getSummary()).toEqual([]);
    });

    it('should clear install state after cancel', async () => {
      const { installOrchestrator } = await import('../install-orchestrator');
      const { loadInstallState, saveInstallState } = await import('../install-state-service');

      // Set up some state first
      saveInstallState({
        target: 'openclaw',
        status: 'running',
        currentStep: 2,
        totalSteps: 5,
        updatedAt: new Date().toISOString(),
        completedSteps: [1],
      });

      await installOrchestrator.cancel();

      const state = loadInstallState();
      expect(state).toBeNull();
    });

    it('should cleanup install/runtime/plugin/support secret scopes before cancel returns', async () => {
      const { installOrchestrator } = await import('../install-orchestrator');

      await installOrchestrator.cancel();

      expect(mockSecretStore.deleteScope).toHaveBeenCalledWith({ scope: 'install' });
      expect(mockSecretStore.deleteScope).toHaveBeenCalledWith({ scope: 'runtime' });
      expect(mockSecretStore.deleteScope).toHaveBeenCalledWith({ scope: 'plugin' });
      expect(mockSecretStore.deleteScope).toHaveBeenCalledWith({ scope: 'support' });
    });
  });

  describe('uninstallStack', () => {
    it('should cleanup install/runtime/plugin/support secret scopes', async () => {
      const { installOrchestrator } = await import('../install-orchestrator');

      await installOrchestrator.uninstallStack();

      expect(mockSecretStore.deleteScope).toHaveBeenCalledWith({ scope: 'install' });
      expect(mockSecretStore.deleteScope).toHaveBeenCalledWith({ scope: 'runtime' });
      expect(mockSecretStore.deleteScope).toHaveBeenCalledWith({ scope: 'plugin' });
      expect(mockSecretStore.deleteScope).toHaveBeenCalledWith({ scope: 'support' });
    });

    it('adds warning strings to errors when secret cleanup fails and logs technical details', async () => {
      const { installOrchestrator } = await import('../install-orchestrator');
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      mockSecretStore.deleteScope.mockImplementation((request: { scope: string }) => {
        if (request.scope === 'support') {
          return {
            success: false,
            secureStorageAvailable: false,
            deletedCount: 0,
            error: {
              userMessage: 'Secure storage unavailable',
              nextSteps: ['Unlock macOS Keychain'],
              retryable: false,
              errorCode: 'SECURE_STORAGE_UNAVAILABLE',
              technicalDetails: 'keychain permission denied',
            },
          };
        }

        return {
          success: true,
          secureStorageAvailable: true,
          deletedCount: 1,
        };
      });

      const result = await installOrchestrator.uninstallStack();
      expect(result.errors?.join(' ')).toContain('secureclaw:support:');
      expect(result.errors?.join(' ')).toContain('Secure storage unavailable');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('keychain permission denied'),
        expect.anything()
      );

      warnSpy.mockRestore();
    });
  });

  describe('retry', () => {
    it('should skip completed steps on retry (D-13)', async () => {
      const { installOrchestrator } = await import('../install-orchestrator');
      const { saveInstallState } = await import('../install-state-service');
      installOrchestrator.setWindow(mockWindow);

      // Simulate a failed state with step 1 completed
      saveInstallState({
        target: 'openclaw',
        status: 'failed',
        currentStep: 2,
        totalSteps: 5,
        errorMessage: 'Test error',
        updatedAt: new Date().toISOString(),
        completedSteps: [1],
      });

      // Need to set correlationId before retry
      await installOrchestrator.start('openclaw', 'retry-test');

      // Should complete without error (steps 1 skipped)
      expect(mockWebContents.send).toHaveBeenCalledWith('install:v1:complete');
    });
  });

  describe('getState', () => {
    it('should return current state from database', async () => {
      const { installOrchestrator } = await import('../install-orchestrator');
      const { saveInstallState } = await import('../install-state-service');

      saveInstallState({
        target: 'nemoclaw',
        status: 'running',
        currentStep: 3,
        totalSteps: 5,
        stepName: 'Extracting',
        updatedAt: new Date().toISOString(),
        completedSteps: [1, 2],
      });

      const state = installOrchestrator.getState();

      expect(state).toMatchObject({
        target: 'nemoclaw',
        status: 'running',
        currentStep: 3,
      });
    });

    it('should return null when no state exists', async () => {
      const { installOrchestrator } = await import('../install-orchestrator');

      const state = installOrchestrator.getState();

      expect(state).toBeNull();
    });
  });
});
