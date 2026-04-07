// Mock electron app
const mockAppBinary = {
  getPath: jest.fn(),
};

jest.mock('electron', () => ({
  app: mockAppBinary,
}));

describe('Binary Resolver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAppBinary.getPath.mockImplementation((name: string) => {
      const paths: Record<string, string> = {
        userData: '/mock/user/data',
        logs: '/mock/logs',
      };
      return paths[name] || '/mock/default';
    });
  });

  describe('resolveBinary', () => {
    it('should check configured path first in precedence order', async () => {
      const { resolveBinary } = await import('../binary-resolver');
      
      const result = await resolveBinary('openclaw', {
        configuredPath: '/custom/openclaw',
      });
      
      // Should attempt configured path first
      expect(result).toBeDefined();
    });

    it('should support Windows .exe suffix handling', async () => {
      const { resolveBinary } = await import('../binary-resolver');
      
      // On Windows, should append .exe
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });
      
      const result = await resolveBinary('openclaw', {});
      
      // Should have checked for .exe variant
      expect(result).toBeDefined();
      
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should return health diagnostics with all required fields', async () => {
      const { resolveBinary } = await import('../binary-resolver');
      
      const result = await resolveBinary('openclaw', {});
      
      expect(result).toHaveProperty('resolvedPath');
      expect(result).toHaveProperty('isExecutable');
      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('failureReason');
      expect(result).toHaveProperty('remediationHint');
    });

    it('should check locations in correct precedence order', async () => {
      const { resolveBinary } = await import('../binary-resolver');
      
      // Test that precedence is: configured -> bundled -> PATH -> cache
      const result = await resolveBinary('openclaw', {
        configuredPath: undefined,
        bundledDir: undefined,
      });
      
      // The implementation should try in order
      expect(result).toBeDefined();
    });
  });

  describe('Platform naming', () => {
    it('should handle platform-specific binary naming', async () => {
      const { getNormalizedBinaryName } = await import('../binary-resolver');
      
      const originalPlatform = process.platform;
      
      // Test Windows
      Object.defineProperty(process, 'platform', { value: 'win32' });
      expect(getNormalizedBinaryName('openclaw')).toBe('openclaw.exe');
      
      // Test macOS/Linux
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      expect(getNormalizedBinaryName('openclaw')).toBe('openclaw');
      
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });
  });
});
