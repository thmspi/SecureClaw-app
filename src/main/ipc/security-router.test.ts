import { SECURITY_CHANNELS } from '../../shared/ipc/security-channels';

const mockSecretStore = {
  setSecret: jest.fn(),
  getSecret: jest.fn(),
  deleteSecret: jest.fn(),
  deleteScope: jest.fn(),
};

jest.mock('../security/secret-store-service', () => mockSecretStore);

const mockIpcMain = {
  handle: jest.fn(),
  handlers: new Map<string, (event: unknown, request: unknown) => Promise<unknown>>(),
};

const registerHandlersForTest = async () => {
  mockIpcMain.handle.mockImplementation((channel: string, handler: any) => {
    mockIpcMain.handlers.set(channel, handler);
  });

  const { registerSecurityHandlers } = await import('./security-router');
  registerSecurityHandlers(mockIpcMain as any);
};

const callHandler = async (channel: string, request: unknown) => {
  const handler = mockIpcMain.handlers.get(channel);
  if (!handler) {
    throw new Error(`No handler registered for channel ${channel}`);
  }

  return handler({}, request);
};

describe('security-router', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockIpcMain.handlers.clear();
    mockIpcMain.handle.mockReset();

    mockSecretStore.setSecret.mockReturnValue({
      success: true,
      secureStorageAvailable: true,
      scopedKey: 'secureclaw:runtime:token',
    });
    mockSecretStore.getSecret.mockReturnValue({
      success: true,
      secureStorageAvailable: true,
      scopedKey: 'secureclaw:runtime:token',
      value: 'secret',
    });
    mockSecretStore.deleteSecret.mockReturnValue({
      success: true,
      secureStorageAvailable: true,
      scopedKey: 'secureclaw:runtime:token',
      deleted: true,
    });
    mockSecretStore.deleteScope.mockReturnValue({
      success: true,
      secureStorageAvailable: true,
      deletedCount: 2,
    });
  });

  it('validates payload schema before invoking secret store methods', async () => {
    await registerHandlersForTest();

    const response = await callHandler(SECURITY_CHANNELS.set, {
      scope: '',
      name: '',
      value: '',
    });

    expect(mockSecretStore.setSecret).not.toHaveBeenCalled();
    expect(response).toMatchObject({
      success: false,
      error: expect.objectContaining({
        userMessage: expect.stringContaining('validation'),
        retryable: false,
      }),
    });
  });

  it('routes set/get/delete/deleteScope channels with typed responses', async () => {
    await registerHandlersForTest();

    const setResult = await callHandler(SECURITY_CHANNELS.set, {
      scope: 'runtime',
      name: 'token',
      value: 'abc',
    });
    const getResult = await callHandler(SECURITY_CHANNELS.get, {
      scope: 'runtime',
      name: 'token',
    });
    const deleteResult = await callHandler(SECURITY_CHANNELS.delete, {
      scope: 'runtime',
      name: 'token',
    });
    const deleteScopeResult = await callHandler(SECURITY_CHANNELS.deleteScope, {
      scope: 'runtime',
    });

    expect(mockSecretStore.setSecret).toHaveBeenCalledWith({
      scope: 'runtime',
      name: 'token',
      value: 'abc',
    });
    expect(mockSecretStore.getSecret).toHaveBeenCalledWith({
      scope: 'runtime',
      name: 'token',
    });
    expect(mockSecretStore.deleteSecret).toHaveBeenCalledWith({
      scope: 'runtime',
      name: 'token',
    });
    expect(mockSecretStore.deleteScope).toHaveBeenCalledWith({
      scope: 'runtime',
    });

    expect(setResult).toMatchObject({ success: true, scopedKey: 'secureclaw:runtime:token' });
    expect(getResult).toMatchObject({
      success: true,
      scopedKey: 'secureclaw:runtime:token',
      value: 'secret',
    });
    expect(deleteResult).toMatchObject({ success: true, deleted: true });
    expect(deleteScopeResult).toMatchObject({ success: true, deletedCount: 2 });
  });

  it('returns plain-language error envelopes instead of raw thrown strings', async () => {
    await registerHandlersForTest();
    mockSecretStore.setSecret.mockImplementation(() => {
      throw new Error('database write exploded');
    });

    const response = await callHandler(SECURITY_CHANNELS.set, {
      scope: 'runtime',
      name: 'token',
      value: 'abc',
    });

    expect(response).toMatchObject({
      success: false,
      secureStorageAvailable: true,
      error: {
        userMessage: 'Unable to update secure secret storage.',
        retryable: true,
        technicalDetails: expect.stringContaining('database write exploded'),
      },
    });
  });
});
