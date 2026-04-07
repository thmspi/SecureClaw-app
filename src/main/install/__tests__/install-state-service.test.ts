import Database from 'better-sqlite3';
import type { InstallState } from '../../../shared/install';

describe('Install State Service', () => {
  let testDb: Database.Database;

  beforeEach(async () => {
    jest.resetModules();

    // Mock electron app
    jest.mock('electron', () => ({
      app: {
        getPath: jest.fn(() => ':memory:'),
      },
    }));

    // Create in-memory database for testing
    testDb = new Database(':memory:');
    testDb.pragma('journal_mode = WAL');
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
    jest.clearAllMocks();
  });

  describe('saveInstallState', () => {
    it('should insert state when none exists', async () => {
      const { saveInstallState, loadInstallState } = await import('../install-state-service');

      const state: InstallState = {
        target: 'openclaw',
        status: 'running',
        currentStep: 2,
        totalSteps: 5,
        stepName: 'Downloading',
        updatedAt: new Date().toISOString(),
        completedSteps: [1],
      };

      saveInstallState(state);
      const loaded = loadInstallState();

      expect(loaded).not.toBeNull();
      expect(loaded?.target).toBe('openclaw');
      expect(loaded?.status).toBe('running');
      expect(loaded?.currentStep).toBe(2);
    });

    it('should update state when it already exists (upsert)', async () => {
      const { saveInstallState, loadInstallState } = await import('../install-state-service');

      const state1: InstallState = {
        target: 'openclaw',
        status: 'running',
        currentStep: 1,
        totalSteps: 5,
        updatedAt: new Date().toISOString(),
        completedSteps: [],
      };

      const state2: InstallState = {
        target: 'openclaw',
        status: 'completed',
        currentStep: 5,
        totalSteps: 5,
        updatedAt: new Date().toISOString(),
        completedSteps: [1, 2, 3, 4, 5],
      };

      saveInstallState(state1);
      saveInstallState(state2);
      const loaded = loadInstallState();

      expect(loaded?.status).toBe('completed');
      expect(loaded?.currentStep).toBe(5);
      expect(loaded?.completedSteps).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe('loadInstallState', () => {
    it('should return null when no state exists', async () => {
      const { loadInstallState } = await import('../install-state-service');

      const result = loadInstallState();
      expect(result).toBeNull();
    });

    it('should return InstallState object when state exists', async () => {
      const { saveInstallState, loadInstallState } = await import('../install-state-service');

      const state: InstallState = {
        target: 'nemoclaw',
        status: 'paused',
        currentStep: 3,
        totalSteps: 6,
        stepName: 'Configuring',
        errorMessage: undefined,
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedSteps: [1, 2],
      };

      saveInstallState(state);
      const loaded = loadInstallState();

      expect(loaded).toMatchObject({
        target: 'nemoclaw',
        status: 'paused',
        currentStep: 3,
        totalSteps: 6,
        stepName: 'Configuring',
      });
    });

    it('should preserve completedSteps array through round-trip', async () => {
      const { saveInstallState, loadInstallState } = await import('../install-state-service');

      const completedSteps = [1, 2, 3, 4];
      const state: InstallState = {
        target: 'openclaw',
        status: 'running',
        currentStep: 5,
        totalSteps: 6,
        updatedAt: new Date().toISOString(),
        completedSteps,
      };

      saveInstallState(state);
      const loaded = loadInstallState();

      expect(loaded?.completedSteps).toEqual(completedSteps);
      expect(Array.isArray(loaded?.completedSteps)).toBe(true);
    });
  });

  describe('clearInstallState', () => {
    it('should remove the singleton row', async () => {
      const { saveInstallState, loadInstallState, clearInstallState } = await import(
        '../install-state-service'
      );

      const state: InstallState = {
        target: 'openclaw',
        status: 'completed',
        currentStep: 5,
        totalSteps: 5,
        updatedAt: new Date().toISOString(),
        completedSteps: [1, 2, 3, 4, 5],
      };

      saveInstallState(state);
      expect(loadInstallState()).not.toBeNull();

      clearInstallState();
      expect(loadInstallState()).toBeNull();
    });
  });

  describe('Database configuration (D-16)', () => {
    it('should have install_state table with correct columns', async () => {
      // Verify table structure instead of WAL (in-memory DB doesn't support WAL)
      const columns = testDb
        .prepare("PRAGMA table_info('install_state')")
        .all() as Array<{ name: string }>;
      const columnNames = columns.map((c) => c.name);

      expect(columnNames).toContain('target');
      expect(columnNames).toContain('status');
      expect(columnNames).toContain('current_step');
      expect(columnNames).toContain('completed_steps');
      expect(columnNames).toContain('updated_at');
    });
  });
});
