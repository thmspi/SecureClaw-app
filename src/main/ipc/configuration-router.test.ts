import { CONFIGURATION_CHANNELS } from '../../shared/ipc/configuration-channels';

const mockConfigurationService = {
  listDocuments: jest.fn(),
  loadDocument: jest.fn(),
  validateDocument: jest.fn(),
  saveDocument: jest.fn(),
  deleteDocument: jest.fn(),
  applyDocument: jest.fn(),
};

jest.mock('../configuration/configuration-service', () => ({
  configurationService: mockConfigurationService,
}));

const mockIpcMain = {
  handle: jest.fn(),
  handlers: new Map<string, (event: unknown, request: unknown) => Promise<unknown>>(),
};

const registerHandlersForTest = async () => {
  mockIpcMain.handle.mockImplementation((channel: string, handler: any) => {
    mockIpcMain.handlers.set(channel, handler);
  });

  const { registerConfigurationHandlers } = await import('./configuration-router');
  registerConfigurationHandlers(mockIpcMain as any);
};

const callHandler = async (channel: string, request: unknown) => {
  const handler = mockIpcMain.handlers.get(channel);
  if (!handler) {
    throw new Error(`No handler registered for channel ${channel}`);
  }

  return handler({}, request);
};

describe('configuration-router', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockIpcMain.handlers.clear();
    mockIpcMain.handle.mockReset();

    mockConfigurationService.listDocuments.mockResolvedValue({ documents: [] });
    mockConfigurationService.loadDocument.mockResolvedValue({ document: undefined });
    mockConfigurationService.validateDocument.mockResolvedValue({ valid: true, issues: [] });
    mockConfigurationService.saveDocument.mockResolvedValue({ saved: true, issues: [] });
    mockConfigurationService.deleteDocument.mockResolvedValue({ deleted: true });
    mockConfigurationService.applyDocument.mockResolvedValue({ applied: true, issues: [] });
  });

  it('registers all configuration:v1 channels', async () => {
    await registerHandlersForTest();

    const channels = mockIpcMain.handle.mock.calls.map((entry: unknown[]) => entry[0]);

    expect(channels).toEqual(
      expect.arrayContaining([
        CONFIGURATION_CHANNELS.listDocuments,
        CONFIGURATION_CHANNELS.loadDocument,
        CONFIGURATION_CHANNELS.validateDocument,
        CONFIGURATION_CHANNELS.saveDocument,
        CONFIGURATION_CHANNELS.deleteDocument,
        CONFIGURATION_CHANNELS.applyDocument,
      ])
    );
    expect(new Set(channels).size).toBe(6);
  });

  it('validates payloads with zod before dispatching to configuration service', async () => {
    await registerHandlersForTest();

    await expect(callHandler(CONFIGURATION_CHANNELS.listDocuments, { kinds: ['bad-kind'] })).rejects.toThrow();
    await expect(callHandler(CONFIGURATION_CHANNELS.loadDocument, { documentId: '' })).rejects.toThrow();
    await expect(
      callHandler(CONFIGURATION_CHANNELS.validateDocument, {
        document: {
          documentId: 'doc-1',
          kind: 'invalid-kind',
          format: 'yaml',
          content: 'allow: true',
          editorMode: 'raw',
        },
      })
    ).rejects.toThrow();
    await expect(
      callHandler(CONFIGURATION_CHANNELS.saveDocument, {
        document: {
          documentId: 'doc-1',
          kind: 'nemoclaw-policy',
          format: 'yaml',
          content: 'allow: true',
          editorMode: 'invalid-mode',
        },
      })
    ).rejects.toThrow();
    await expect(callHandler(CONFIGURATION_CHANNELS.deleteDocument, { documentId: '' })).rejects.toThrow();
    await expect(callHandler(CONFIGURATION_CHANNELS.applyDocument, { documentId: '' })).rejects.toThrow();

    expect(mockConfigurationService.listDocuments).not.toHaveBeenCalled();
    expect(mockConfigurationService.loadDocument).not.toHaveBeenCalled();
    expect(mockConfigurationService.validateDocument).not.toHaveBeenCalled();
    expect(mockConfigurationService.saveDocument).not.toHaveBeenCalled();
    expect(mockConfigurationService.deleteDocument).not.toHaveBeenCalled();
    expect(mockConfigurationService.applyDocument).not.toHaveBeenCalled();
  });
});
