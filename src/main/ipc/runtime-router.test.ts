import { RUNTIME_CHANNELS } from '../../shared/ipc/runtime-channels';

const mockSessionOrchestrator = {
  startSession: jest.fn(),
  stopSession: jest.fn(),
  getSessions: jest.fn(),
  registerSessionEventListener: jest.fn(),
  unregisterSessionEventListener: jest.fn(),
};

const mockPluginRunner = {
  enqueuePlugin: jest.fn(),
  cancelPluginRun: jest.fn(),
  getPluginRuns: jest.fn(),
  registerPluginEventListener: jest.fn(),
  unregisterPluginEventListener: jest.fn(),
};

const mockHistoryService = {
  saveHistoryRecord: jest.fn(),
  getHistory: jest.fn(),
};

const mockPluginCatalogService = {
  listPluginPackages: jest.fn(),
  validatePluginPackage: jest.fn(),
  importPluginPackage: jest.fn(),
  uninstallPluginPackage: jest.fn(),
};

jest.mock('../runtime/session-orchestrator', () => mockSessionOrchestrator);
jest.mock('../runtime/plugin-runner', () => mockPluginRunner);
jest.mock('../runtime/runtime-history-service', () => mockHistoryService);
jest.mock('../runtime/plugin-catalog-service', () => mockPluginCatalogService);

const mockIpcMain = {
  handle: jest.fn(),
  handlers: new Map<string, (event: unknown, request: unknown) => Promise<unknown>>(),
};

const registerHandlersForTest = async () => {
  mockIpcMain.handle.mockImplementation((channel: string, handler: any) => {
    mockIpcMain.handlers.set(channel, handler);
  });

  const { registerRuntimeHandlers } = await import('./runtime-router');
  registerRuntimeHandlers(mockIpcMain as any);
};

const callHandler = async (channel: string, request: unknown) => {
  const handler = mockIpcMain.handlers.get(channel);
  if (!handler) {
    throw new Error(`No handler registered for channel ${channel}`);
  }

  return handler({}, request);
};

describe('runtime-router', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockIpcMain.handlers.clear();
    mockIpcMain.handle.mockReset();

    mockSessionOrchestrator.startSession.mockResolvedValue({ sessionId: 'session-1', started: true });
    mockSessionOrchestrator.stopSession.mockResolvedValue({ sessionId: 'session-1', stopped: true });
    mockSessionOrchestrator.getSessions.mockReturnValue([]);

    mockPluginRunner.enqueuePlugin.mockResolvedValue({ runId: 'run-1', queued: true });
    mockPluginRunner.cancelPluginRun.mockResolvedValue({ runId: 'run-1', cancelled: true });
    mockPluginRunner.getPluginRuns.mockReturnValue({ runs: [] });

    mockHistoryService.getHistory.mockReturnValue({ records: [], total: 0 });
    mockPluginCatalogService.listPluginPackages.mockResolvedValue({ packages: [] });
    mockPluginCatalogService.validatePluginPackage.mockResolvedValue({
      valid: true,
      packageName: 'acme/plugin',
    });
    mockPluginCatalogService.importPluginPackage.mockResolvedValue({
      imported: true,
      packageName: 'acme/plugin',
    });
    mockPluginCatalogService.uninstallPluginPackage.mockResolvedValue({
      uninstalled: true,
      pluginId: 'acme/plugin',
    });
  });

  it('startSession validates schema, dispatches to session orchestrator, and forwards events', async () => {
    await registerHandlersForTest();

    const { setMainWindow } = await import('./runtime-router');
    const send = jest.fn();
    setMainWindow({ isDestroyed: () => false, webContents: { send } } as any);

    await callHandler(RUNTIME_CHANNELS.startSession, { sessionId: 'session-1' });

    expect(mockSessionOrchestrator.startSession).toHaveBeenCalledWith({ sessionId: 'session-1' });
    expect(mockSessionOrchestrator.registerSessionEventListener).toHaveBeenCalledWith(
      'session-1',
      expect.any(Function)
    );
    expect(mockHistoryService.saveHistoryRecord).toHaveBeenCalled();

    const listener = mockSessionOrchestrator.registerSessionEventListener.mock.calls[0][1] as (
      event: unknown
    ) => void;
    listener({
      type: 'active',
      sessionId: 'session-1',
      timestamp: new Date().toISOString(),
      data: {},
    });
    expect(send).toHaveBeenCalledWith(RUNTIME_CHANNELS.sessionEvent, expect.objectContaining({ sessionId: 'session-1' }));
  });

  it('stopSession validates schema and dispatches to session orchestrator', async () => {
    await registerHandlersForTest();

    await callHandler(RUNTIME_CHANNELS.stopSession, { sessionId: 'session-1' });

    expect(mockSessionOrchestrator.stopSession).toHaveBeenCalledWith({ sessionId: 'session-1' });
    expect(mockHistoryService.saveHistoryRecord).toHaveBeenCalled();
  });

  it('runPlugin validates schema, dispatches to plugin runner, and forwards events', async () => {
    await registerHandlersForTest();

    const { setMainWindow } = await import('./runtime-router');
    const send = jest.fn();
    setMainWindow({ isDestroyed: () => false, webContents: { send } } as any);

    await callHandler(RUNTIME_CHANNELS.runPlugin, {
      runId: 'run-1',
      pluginName: 'demo',
      sessionId: 'session-1',
    });

    expect(mockPluginRunner.enqueuePlugin).toHaveBeenCalledWith({
      runId: 'run-1',
      pluginName: 'demo',
      sessionId: 'session-1',
    });
    expect(mockPluginRunner.registerPluginEventListener).toHaveBeenCalledWith('run-1', expect.any(Function));

    const listener = mockPluginRunner.registerPluginEventListener.mock.calls[0][1] as (event: unknown) => void;
    listener({
      type: 'running',
      runId: 'run-1',
      timestamp: new Date().toISOString(),
      data: {},
    });
    expect(send).toHaveBeenCalledWith(RUNTIME_CHANNELS.pluginEvent, expect.objectContaining({ runId: 'run-1' }));
  });

  it('getHistory validates schema with optional filters and dispatches to history service', async () => {
    await registerHandlersForTest();

    await callHandler(RUNTIME_CHANNELS.getHistory, {
      operationType: 'plugin_run',
      status: 'failed',
      limit: 20,
    });

    expect(mockHistoryService.getHistory).toHaveBeenCalledWith({
      operationType: 'plugin_run',
      status: 'failed',
      limit: 20,
    });
  });

  it('plugin package handlers dispatch to plugin catalog service', async () => {
    await registerHandlersForTest();

    await callHandler(RUNTIME_CHANNELS.listPluginPackages, {});
    await callHandler(RUNTIME_CHANNELS.validatePluginPackage, { packageName: 'acme/plugin' });
    await callHandler(RUNTIME_CHANNELS.importPluginPackage, { packageName: 'acme/plugin' });
    await callHandler(RUNTIME_CHANNELS.uninstallPluginPackage, { pluginId: 'acme/plugin' });

    expect(mockPluginCatalogService.listPluginPackages).toHaveBeenCalled();
    expect(mockPluginCatalogService.validatePluginPackage).toHaveBeenCalledWith({
      packageName: 'acme/plugin',
    });
    expect(mockPluginCatalogService.importPluginPackage).toHaveBeenCalledWith({
      packageName: 'acme/plugin',
    });
    expect(mockPluginCatalogService.uninstallPluginPackage).toHaveBeenCalledWith({
      pluginId: 'acme/plugin',
    });
  });

  it('invalid request payloads throw zod validation errors', async () => {
    await registerHandlersForTest();

    await expect(callHandler(RUNTIME_CHANNELS.startSession, {})).rejects.toThrow();
    await expect(
      callHandler(RUNTIME_CHANNELS.runPlugin, {
        runId: 'run-1',
        pluginName: '',
        sessionId: 'session-1',
      })
    ).rejects.toThrow();
    await expect(callHandler(RUNTIME_CHANNELS.getHistory, { status: 'unknown' })).rejects.toThrow();
    await expect(
      callHandler(RUNTIME_CHANNELS.validatePluginPackage, { packageName: '' })
    ).rejects.toThrow();
    await expect(
      callHandler(RUNTIME_CHANNELS.importPluginPackage, { packageName: '' })
    ).rejects.toThrow();
    await expect(
      callHandler(RUNTIME_CHANNELS.uninstallPluginPackage, { pluginId: '' })
    ).rejects.toThrow();
  });
});
