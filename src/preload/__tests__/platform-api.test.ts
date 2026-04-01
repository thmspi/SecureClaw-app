// Mock for contextBridge
const mockContextBridge = {
  exposeInMainWorld: jest.fn(),
};

// Mock for ipcRenderer
const mockIpcRenderer = {
  invoke: jest.fn(),
};

// Mock electron module before any imports
jest.mock('electron', () => ({
  contextBridge: mockContextBridge,
  ipcRenderer: mockIpcRenderer,
}));

describe('Preload Platform API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it('should expose platform API via contextBridge', async () => {
    await import('../platform-api');
    
    expect(mockContextBridge.exposeInMainWorld).toHaveBeenCalledWith(
      'secureClaw',
      expect.objectContaining({
        platform: expect.any(Object),
      })
    );
  });

  it('should expose runProcess method', async () => {
    await import('../platform-api');
    
    const calls = mockContextBridge.exposeInMainWorld.mock.calls;
    const platformAPI = calls[0]?.[1]?.platform;
    
    expect(platformAPI).toHaveProperty('runProcess');
    expect(typeof platformAPI.runProcess).toBe('function');
  });

  it('should expose stopProcess method', async () => {
    await import('../platform-api');
    
    const calls = mockContextBridge.exposeInMainWorld.mock.calls;
    const platformAPI = calls[0]?.[1]?.platform;
    
    expect(platformAPI).toHaveProperty('stopProcess');
    expect(typeof platformAPI.stopProcess).toBe('function');
  });

  it('should expose getPaths method', async () => {
    await import('../platform-api');
    
    const calls = mockContextBridge.exposeInMainWorld.mock.calls;
    const platformAPI = calls[0]?.[1]?.platform;
    
    expect(platformAPI).toHaveProperty('getPaths');
    expect(typeof platformAPI.getPaths).toBe('function');
  });

  it('should NOT expose raw ipcRenderer', async () => {
    await import('../platform-api');
    
    const calls = mockContextBridge.exposeInMainWorld.mock.calls;
    const exposedAPI = calls[0]?.[1];
    
    expect(exposedAPI).not.toHaveProperty('ipcRenderer');
    expect(exposedAPI?.platform).not.toHaveProperty('ipcRenderer');
  });
});
