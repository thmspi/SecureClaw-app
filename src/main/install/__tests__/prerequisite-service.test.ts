import type { PrerequisiteResult } from '../../../shared/install';

// Mock electron app and net for prerequisite service tests
const mockApp = {
  getPath: jest.fn(() => '/mock/path/userData'),
};
const mockNet = {
  isOnline: jest.fn(() => true),
};
const mockStatfsSync = jest.fn(() => ({
  bfree: 10 * 1024 * 1024 * 1024, // 10GB in blocks
  bsize: 1, // 1 byte per block for easy math
}));
const mockMkdirSync = jest.fn();
const mockRmdirSync = jest.fn();

jest.mock('electron', () => ({
  app: mockApp,
  net: mockNet,
}));

// Mock fs functions for disk space and permissions tests
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  statfsSync: mockStatfsSync,
  mkdirSync: mockMkdirSync,
  rmdirSync: mockRmdirSync,
}));

describe('Prerequisite Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockNet.isOnline.mockReturnValue(true);
    mockStatfsSync.mockReturnValue({
      bfree: 10 * 1024 * 1024 * 1024,
      bsize: 1,
    });
  });

  describe('runAllPrerequisiteChecks', () => {
    it('should return PrerequisiteResult with all checks', async () => {
      const { runAllPrerequisiteChecks } = await import('../prerequisite-service');
      const result: PrerequisiteResult = await runAllPrerequisiteChecks();

      expect(result).toHaveProperty('allPassed');
      expect(result).toHaveProperty('checks');
      expect(Array.isArray(result.checks)).toBe(true);
      expect(result.checks.length).toBeGreaterThan(0);
    });

    it('should check node version', async () => {
      const { runAllPrerequisiteChecks } = await import('../prerequisite-service');
      const result = await runAllPrerequisiteChecks();

      const nodeCheck = result.checks.find((c) => c.id === 'node-version');
      expect(nodeCheck).toBeDefined();
      expect(nodeCheck?.name).toBe('Node.js');
      // Node.js is likely installed in test environment
      expect(['passed', 'failed']).toContain(nodeCheck?.status);
    });

    it('should check Python version (tries python3 first per D-05)', async () => {
      const { runAllPrerequisiteChecks } = await import('../prerequisite-service');
      const result = await runAllPrerequisiteChecks();

      const pythonCheck = result.checks.find((c) => c.id === 'python');
      expect(pythonCheck).toBeDefined();
      expect(pythonCheck?.name).toBe('Python');
      expect(['passed', 'failed']).toContain(pythonCheck?.status);
    });

    it('should check disk space using statfsSync', async () => {
      const { runAllPrerequisiteChecks } = await import('../prerequisite-service');
      const result = await runAllPrerequisiteChecks();

      const diskCheck = result.checks.find((c) => c.id === 'disk-space');
      expect(diskCheck).toBeDefined();
      expect(diskCheck?.name).toBe('Disk Space');
      expect(mockStatfsSync).toHaveBeenCalled();
    });

    it('should return passed for disk space when sufficient', async () => {
      // Mock 10GB free
      mockStatfsSync.mockReturnValue({
        bfree: 10 * 1024 * 1024 * 1024,
        bsize: 1,
      });

      const { runAllPrerequisiteChecks } = await import('../prerequisite-service');
      const result = await runAllPrerequisiteChecks();

      const diskCheck = result.checks.find((c) => c.id === 'disk-space');
      expect(diskCheck?.status).toBe('passed');
    });

    it('should return failed for disk space when insufficient', async () => {
      // Mock only 1GB free
      mockStatfsSync.mockReturnValue({
        bfree: 1 * 1024 * 1024 * 1024,
        bsize: 1,
      });

      jest.resetModules();
      const { runAllPrerequisiteChecks } = await import('../prerequisite-service');
      const result = await runAllPrerequisiteChecks();

      const diskCheck = result.checks.find((c) => c.id === 'disk-space');
      expect(diskCheck?.status).toBe('failed');
    });

    it('should check write permissions', async () => {
      const { runAllPrerequisiteChecks } = await import('../prerequisite-service');
      const result = await runAllPrerequisiteChecks();

      const permCheck = result.checks.find((c) => c.id === 'permissions');
      expect(permCheck).toBeDefined();
      expect(permCheck?.name).toBe('Write Permissions');
      expect(mockMkdirSync).toHaveBeenCalled();
      expect(mockRmdirSync).toHaveBeenCalled();
    });

    it('should check network using net.isOnline()', async () => {
      const { runAllPrerequisiteChecks } = await import('../prerequisite-service');
      const result = await runAllPrerequisiteChecks();

      const networkCheck = result.checks.find((c) => c.id === 'network');
      expect(networkCheck).toBeDefined();
      expect(networkCheck?.name).toBe('Internet');
      expect(mockNet.isOnline).toHaveBeenCalled();
    });

    it('should return warning for network when offline', async () => {
      mockNet.isOnline.mockReturnValue(false);

      jest.resetModules();
      const { runAllPrerequisiteChecks } = await import('../prerequisite-service');
      const result = await runAllPrerequisiteChecks();

      const networkCheck = result.checks.find((c) => c.id === 'network');
      expect(networkCheck?.status).toBe('warning');
    });

    it('should calculate allPassed correctly', async () => {
      const { runAllPrerequisiteChecks } = await import('../prerequisite-service');
      const result = await runAllPrerequisiteChecks();

      // allPassed should be true if all checks are passed or warning
      const expectedAllPassed = result.checks.every(
        (c) => c.status === 'passed' || c.status === 'warning'
      );
      expect(result.allPassed).toBe(expectedAllPassed);
    });
  });
});
