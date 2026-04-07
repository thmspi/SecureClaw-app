// Mock electron app
const mockApp = {
  getPath: jest.fn(),
};

jest.mock('electron', () => ({
  app: mockApp,
}));

describe('Path Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApp.getPath.mockImplementation((name: string) => {
      const paths: Record<string, string> = {
        userData: '/mock/user/data',
        logs: '/mock/logs',
      };
      return paths[name] || '/mock/default';
    });
  });

  describe('getAppDataDir', () => {
    it('should return path from Electron app.getPath(userData)', async () => {
      const { getAppDataDir } = await import('../path-service');
      
      const result = getAppDataDir();
      
      expect(mockApp.getPath).toHaveBeenCalledWith('userData');
      expect(result).toBe('/mock/user/data');
    });
  });

  describe('getLogsDir', () => {
    it('should return path from Electron app.getPath(logs)', async () => {
      const { getLogsDir } = await import('../path-service');
      
      const result = getLogsDir();
      
      expect(mockApp.getPath).toHaveBeenCalledWith('logs');
      expect(result).toBe('/mock/logs');
    });
  });

  describe('getWorkDir', () => {
    it('should return project-specific work directory under userData', async () => {
      const { getWorkDir } = await import('../path-service');
      
      const result = getWorkDir('project-123');
      
      expect(result).toContain('/mock/user/data');
      expect(result).toContain('project-123');
    });
  });

  describe('getManagedCacheDir', () => {
    it('should return managed cache directory under userData', async () => {
      const { getManagedCacheDir } = await import('../path-service');
      
      const result = getManagedCacheDir();
      
      expect(result).toContain('/mock/user/data');
      expect(result).toContain('cache');
    });
  });

  describe('No hardcoded OS paths', () => {
    it('should not contain hardcoded absolute paths', async () => {
      const fs = require('fs');
      const pathServiceCode = fs.readFileSync(
        require.resolve('../path-service'),
        'utf-8'
      );
      
      // Should not have hardcoded macOS or Windows absolute paths
      expect(pathServiceCode).not.toMatch(/['"]\/Users\//);
      expect(pathServiceCode).not.toMatch(/['"]\/Applications\//);
      expect(pathServiceCode).not.toMatch(/['"]C:\\/);
    });
  });
});
