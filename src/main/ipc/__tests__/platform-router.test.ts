import { PLATFORM_CHANNELS } from '../../../shared/ipc/platform-channels';

// Mock the runtime service to avoid electron dependencies
jest.mock('../../runtime/runtime-service', () => ({
  runProcess: jest.fn().mockResolvedValue({
    correlationId: 'test-123',
    started: true,
    pid: 12345,
  }),
  stopProcess: jest.fn().mockResolvedValue({
    correlationId: 'test-123',
    stopped: true,
  }),
  getPaths: jest.fn().mockImplementation((req: { paths: string[] }) => 
    Promise.resolve({
      paths: Object.fromEntries(req.paths.map((p: string) => [p, `/mock/${p}`])),
    })
  ),
}));

// Mock ipcMain for testing
const mockIpcMain = {
  handle: jest.fn(),
  handlers: new Map<string, (event: unknown, ...args: unknown[]) => Promise<unknown>>(),
};

// Helper to simulate calling a handler
const callHandler = async (channel: string, data: unknown) => {
  const handler = mockIpcMain.handlers.get(channel);
  if (!handler) {
    throw new Error(`No handler registered for channel: ${channel}`);
  }
  return handler({}, data);
};

describe('Platform Router', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIpcMain.handlers.clear();
    jest.resetModules();
  });

  describe('Handler Registration', () => {
    it('should register handler for runProcess channel', async () => {
      const { registerPlatformHandlers } = await import('../platform-router');
      
      registerPlatformHandlers(mockIpcMain as any);
      
      expect(mockIpcMain.handle).toHaveBeenCalledWith(
        PLATFORM_CHANNELS.runProcess,
        expect.any(Function)
      );
    });

    it('should register handler for stopProcess channel', async () => {
      const { registerPlatformHandlers } = await import('../platform-router');
      
      registerPlatformHandlers(mockIpcMain as any);
      
      expect(mockIpcMain.handle).toHaveBeenCalledWith(
        PLATFORM_CHANNELS.stopProcess,
        expect.any(Function)
      );
    });

    it('should register handler for getPaths channel', async () => {
      const { registerPlatformHandlers } = await import('../platform-router');
      
      registerPlatformHandlers(mockIpcMain as any);
      
      expect(mockIpcMain.handle).toHaveBeenCalledWith(
        PLATFORM_CHANNELS.getPaths,
        expect.any(Function)
      );
    });
  });

  describe('Schema Validation', () => {
    beforeEach(() => {
      mockIpcMain.handle.mockImplementation((channel: string, handler: any) => {
        mockIpcMain.handlers.set(channel, handler);
      });
    });

    it('should validate runProcess request with schema before processing', async () => {
      const { registerPlatformHandlers } = await import('../platform-router');
      registerPlatformHandlers(mockIpcMain as any);
      
      const validRequest = {
        command: 'node',
        args: ['script.js'],
        correlationId: 'test-123',
      };
      
      await expect(callHandler(PLATFORM_CHANNELS.runProcess, validRequest)).resolves.toBeDefined();
    });

    it('should reject invalid runProcess request missing required fields', async () => {
      const { registerPlatformHandlers } = await import('../platform-router');
      registerPlatformHandlers(mockIpcMain as any);
      
      const invalidRequest = {
        args: ['script.js'],
      };
      
      await expect(callHandler(PLATFORM_CHANNELS.runProcess, invalidRequest)).rejects.toThrow();
    });

    it('should validate stopProcess request with schema', async () => {
      const { registerPlatformHandlers } = await import('../platform-router');
      registerPlatformHandlers(mockIpcMain as any);
      
      const validRequest = {
        correlationId: 'test-123',
        strategy: 'graceful' as const,
      };
      
      await expect(callHandler(PLATFORM_CHANNELS.stopProcess, validRequest)).resolves.toBeDefined();
    });

    it('should validate getPaths request with schema', async () => {
      const { registerPlatformHandlers } = await import('../platform-router');
      registerPlatformHandlers(mockIpcMain as any);
      
      const validRequest = {
        paths: ['userData', 'appData'],
      };
      
      await expect(callHandler(PLATFORM_CHANNELS.getPaths, validRequest)).resolves.toBeDefined();
    });
  });
});
