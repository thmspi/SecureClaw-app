const mockLoadInstallState = jest.fn();
const mockGetSessions = jest.fn();
const mockListPluginPackages = jest.fn();
const mockSpawnSync = jest.fn();

jest.mock('electron', () => ({
  app: {
    getVersion: jest.fn(() => '1.0.0'),
  },
}));

jest.mock('../install/install-state-service', () => ({
  loadInstallState: () => mockLoadInstallState(),
}));

jest.mock('../runtime/session-orchestrator', () => ({
  getSessions: () => mockGetSessions(),
}));

jest.mock('../runtime/plugin-catalog-service', () => ({
  listPluginPackages: () => mockListPluginPackages(),
}));

jest.mock('child_process', () => ({
  spawnSync: (...args: unknown[]) => mockSpawnSync(...args),
}));

describe('health-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockLoadInstallState.mockReturnValue({
      status: 'completed',
    });
    mockGetSessions.mockReturnValue([{ sessionId: 's-1', state: 'Active' }]);
    mockListPluginPackages.mockResolvedValue({ packages: [{ id: 'p-1' }] });
    mockSpawnSync.mockImplementation((command: string) => ({
      status: 0,
      stdout: `${command} 1.0.0`,
      stderr: '',
    }));
  });

  it('returns D-06 component statuses and app/openclaw/nemoclaw/docker versions', async () => {
    const { getHealthSnapshot } = await import('./health-service');
    const snapshot = await getHealthSnapshot();

    expect(snapshot.components).toEqual({
      install: 'Healthy',
      runtime: 'Healthy',
      plugins: 'Healthy',
    });
    expect(snapshot.versions.app).toBe('1.0.0');
    expect(snapshot.versions.openclaw).toContain('openclaw');
    expect(snapshot.versions.nemoclaw).toContain('nemoclaw');
    expect(snapshot.versions.docker).toContain('docker');
    expect(snapshot.overallSeverity).toBe('Healthy');
  });

  it('uses worst-of severity ordering (Healthy < Warning < Critical)', async () => {
    mockLoadInstallState.mockReturnValue({
      status: 'failed',
    });
    mockGetSessions.mockReturnValue([]);
    mockListPluginPackages.mockResolvedValue({
      packages: [],
      error: 'cli unavailable',
    });

    const { getHealthSnapshot } = await import('./health-service');
    const snapshot = await getHealthSnapshot();

    expect(snapshot.components.install).toBe('Critical');
    expect(snapshot.components.runtime).toBe('Warning');
    expect(snapshot.components.plugins).toBe('Critical');
    expect(snapshot.overallSeverity).toBe('Critical');
  });

  it('degrades gracefully when install/session data sources throw', async () => {
    mockLoadInstallState.mockImplementation(() => {
      throw new Error('sqlite unavailable');
    });
    mockGetSessions.mockImplementation(() => {
      throw new Error('session store unavailable');
    });
    mockListPluginPackages.mockResolvedValue({ packages: [{ id: 'p-1' }] });

    const { getHealthSnapshot } = await import('./health-service');
    const snapshot = await getHealthSnapshot();

    expect(snapshot.components.install).toBe('Warning');
    expect(snapshot.components.runtime).toBe('Warning');
    expect(snapshot.components.plugins).toBe('Healthy');
    expect(snapshot.versions.app).toBe('1.0.0');
  });
});
