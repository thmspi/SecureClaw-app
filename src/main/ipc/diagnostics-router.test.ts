import {
  DIAGNOSTICS_CHANNELS,
} from '../../shared/ipc/diagnostics-channels';

const mockHealthService = {
  getHealthSnapshot: jest.fn(),
};

const mockExportService = {
  exportDiagnosticsBundle: jest.fn(),
};

jest.mock('../diagnostics/health-service', () => mockHealthService);
jest.mock('../diagnostics/diagnostics-export-service', () => mockExportService);

const mockIpcMain = {
  handle: jest.fn(),
  handlers: new Map<string, (event: unknown, request: unknown) => Promise<unknown>>(),
};

const registerHandlersForTest = async () => {
  mockIpcMain.handle.mockImplementation((channel: string, handler: any) => {
    mockIpcMain.handlers.set(channel, handler);
  });

  const { registerDiagnosticsHandlers } = await import('./diagnostics-router');
  registerDiagnosticsHandlers(mockIpcMain as any);
};

const callHandler = async (channel: string, request: unknown) => {
  const handler = mockIpcMain.handlers.get(channel);
  if (!handler) {
    throw new Error(`No handler registered for channel ${channel}`);
  }

  return handler({}, request);
};

describe('diagnostics-router', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockIpcMain.handlers.clear();
    mockIpcMain.handle.mockReset();

    mockHealthService.getHealthSnapshot.mockResolvedValue({
      overallSeverity: 'Healthy',
      components: {
        install: 'Healthy',
        runtime: 'Healthy',
        plugins: 'Healthy',
      },
      versions: {
        app: '1.0.0',
        openclaw: '1.0.0',
        nemoclaw: '1.0.0',
        docker: '1.0.0',
      },
      generatedAt: '2026-04-04T00:00:00.000Z',
    });
    mockExportService.exportDiagnosticsBundle.mockResolvedValue({
      bundlePath: '/tmp/diag.zip',
      generatedAt: '2026-04-04T00:00:00.000Z',
      redactionSummary: {
        redactedFields: 3,
        redactionRulesMatched: 2,
      },
    });
  });

  it('registers diagnostics:v1 handlers and dispatches to services', async () => {
    await registerHandlersForTest();

    expect(mockIpcMain.handlers.has(DIAGNOSTICS_CHANNELS.getHealth)).toBe(true);
    expect(mockIpcMain.handlers.has(DIAGNOSTICS_CHANNELS.exportBundle)).toBe(true);

    await callHandler(DIAGNOSTICS_CHANNELS.getHealth, { forceRefresh: true });
    await callHandler(DIAGNOSTICS_CHANNELS.exportBundle, { includeDays: 7 });

    expect(mockHealthService.getHealthSnapshot).toHaveBeenCalledWith({ forceRefresh: true });
    expect(mockExportService.exportDiagnosticsBundle).toHaveBeenCalledWith({ includeDays: 7 });
  });

  it('returns typed support errors for invalid payloads and service failures', async () => {
    await registerHandlersForTest();
    mockHealthService.getHealthSnapshot.mockRejectedValueOnce(new Error('boom'));

    await expect(callHandler(DIAGNOSTICS_CHANNELS.getHealth, { forceRefresh: 'yes' })).resolves.toMatchObject({
      error: {
        userMessage: expect.stringContaining('validation'),
        retryable: false,
        nextSteps: expect.any(Array),
      },
    });

    await expect(callHandler(DIAGNOSTICS_CHANNELS.getHealth, { forceRefresh: false })).resolves.toMatchObject({
      error: {
        userMessage: expect.stringContaining('health snapshot'),
        retryable: true,
        technicalDetails: expect.stringContaining('boom'),
      },
    });

    await expect(callHandler(DIAGNOSTICS_CHANNELS.exportBundle, { includeDays: 0 })).resolves.toMatchObject({
      error: {
        userMessage: expect.stringContaining('validation'),
        retryable: false,
      },
    });
  });
});
