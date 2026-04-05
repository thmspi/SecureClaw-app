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

  it('should expose diagnostics API methods', async () => {
    await import('../platform-api');

    const calls = mockContextBridge.exposeInMainWorld.mock.calls;
    const diagnosticsAPI = calls[0]?.[1]?.diagnostics;

    expect(diagnosticsAPI).toHaveProperty('getHealth');
    expect(typeof diagnosticsAPI.getHealth).toBe('function');
    expect(diagnosticsAPI).toHaveProperty('exportBundle');
    expect(typeof diagnosticsAPI.exportBundle).toBe('function');
  });

  it('should expose secrets API methods', async () => {
    await import('../platform-api');

    const calls = mockContextBridge.exposeInMainWorld.mock.calls;
    const secretsAPI = calls[0]?.[1]?.secrets;

    expect(secretsAPI).toHaveProperty('setSecret');
    expect(typeof secretsAPI.setSecret).toBe('function');
    expect(secretsAPI).toHaveProperty('getSecret');
    expect(typeof secretsAPI.getSecret).toBe('function');
    expect(secretsAPI).toHaveProperty('deleteSecret');
    expect(typeof secretsAPI.deleteSecret).toBe('function');
    expect(secretsAPI).toHaveProperty('deleteScopeSecrets');
    expect(typeof secretsAPI.deleteScopeSecrets).toBe('function');
  });

  it('should expose configuration API methods', async () => {
    await import('../platform-api');

    const calls = mockContextBridge.exposeInMainWorld.mock.calls;
    const configurationAPI = calls[0]?.[1]?.configuration;

    expect(configurationAPI).toHaveProperty('listDocuments');
    expect(typeof configurationAPI.listDocuments).toBe('function');
    expect(configurationAPI).toHaveProperty('loadDocument');
    expect(typeof configurationAPI.loadDocument).toBe('function');
    expect(configurationAPI).toHaveProperty('validateDocument');
    expect(typeof configurationAPI.validateDocument).toBe('function');
    expect(configurationAPI).toHaveProperty('saveDocument');
    expect(typeof configurationAPI.saveDocument).toBe('function');
    expect(configurationAPI).toHaveProperty('applyDocument');
    expect(typeof configurationAPI.applyDocument).toBe('function');
  });

  it('should NOT expose raw ipcRenderer', async () => {
    await import('../platform-api');
    
    const calls = mockContextBridge.exposeInMainWorld.mock.calls;
    const exposedAPI = calls[0]?.[1];
    
    expect(exposedAPI).not.toHaveProperty('ipcRenderer');
    expect(exposedAPI?.platform).not.toHaveProperty('ipcRenderer');
    expect(exposedAPI?.diagnostics).not.toHaveProperty('ipcRenderer');
    expect(exposedAPI?.secrets).not.toHaveProperty('ipcRenderer');
    expect(exposedAPI?.configuration).not.toHaveProperty('ipcRenderer');
  });
});
