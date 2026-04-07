import Database from 'better-sqlite3';

let testDb: Database.Database;
let encryptionAvailable = true;

const encryptString = jest.fn((value: string) => Buffer.from(`enc:${value}`, 'utf8'));
const decryptString = jest.fn((value: Buffer) => value.toString('utf8').replace(/^enc:/, ''));

jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => ':memory:'),
  },
  safeStorage: {
    isEncryptionAvailable: jest.fn(() => encryptionAvailable),
    encryptString: (...args: [string]) => encryptString(...args),
    decryptString: (...args: [Buffer]) => decryptString(...args),
  },
}));

function createSecretStoreTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS secret_store (
      scoped_key TEXT PRIMARY KEY,
      encrypted_value BLOB NOT NULL,
      version INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
}

describe('SecretStoreService', () => {
  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();
    encryptionAvailable = true;

    testDb = new Database(':memory:');
    testDb.pragma('journal_mode = WAL');
    createSecretStoreTable(testDb);

    const { _setDbForTesting } = await import('./secret-store-service');
    _setDbForTesting(testDb);
  });

  afterEach(() => {
    testDb?.close();
  });

  it('supports set/get/delete/deleteScope lifecycle for secureclaw:{scope}:{name} keys', async () => {
    const { setSecret, getSecret, deleteSecret, deleteScope } = await import('./secret-store-service');

    const setResult = setSecret({
      scope: 'runtime',
      name: 'api-token',
      value: 'token-1',
    });
    expect(setResult.success).toBe(true);
    expect(setResult.scopedKey).toBe('secureclaw:runtime:api-token');

    const getResult = getSecret({
      scope: 'runtime',
      name: 'api-token',
    });
    expect(getResult.success).toBe(true);
    expect(getResult.value).toBe('token-1');

    const deleteResult = deleteSecret({
      scope: 'runtime',
      name: 'api-token',
    });
    expect(deleteResult.success).toBe(true);
    expect(deleteResult.deleted).toBe(true);

    setSecret({ scope: 'runtime', name: 'another', value: 'v1' });
    setSecret({ scope: 'plugin', name: 'plugin-token', value: 'v2' });

    const deleteScopeResult = deleteScope({ scope: 'runtime' });
    expect(deleteScopeResult.success).toBe(true);
    expect(deleteScopeResult.deletedCount).toBe(1);

    const pluginScopeCount = testDb
      .prepare("SELECT COUNT(*) AS count FROM secret_store WHERE scoped_key LIKE 'secureclaw:plugin:%'")
      .get() as { count: number };
    expect(pluginScopeCount.count).toBe(1);
  });

  it('increments version on overwrite and returns only latest value', async () => {
    const { setSecret, getSecret } = await import('./secret-store-service');

    setSecret({ scope: 'install', name: 'license', value: 'first' });
    setSecret({ scope: 'install', name: 'license', value: 'second' });

    const row = testDb
      .prepare('SELECT version FROM secret_store WHERE scoped_key = ?')
      .get('secureclaw:install:license') as { version: number };
    expect(row.version).toBe(2);

    const getResult = getSecret({ scope: 'install', name: 'license' });
    expect(getResult.success).toBe(true);
    expect(getResult.value).toBe('second');
  });

  it('returns remediation error when safe storage is unavailable and never stores plaintext', async () => {
    const { setSecret } = await import('./secret-store-service');
    encryptionAvailable = false;

    const result = setSecret({ scope: 'support', name: 'ticket-token', value: 'plaintext-never' });
    expect(result.success).toBe(false);
    expect(result.secureStorageAvailable).toBe(false);
    expect(result.error?.userMessage).toContain('Secure storage');
    expect(result.error?.nextSteps).toEqual([
      'Unlock macOS Keychain',
      'Grant SecureClaw keychain access',
      'Export diagnostics from Settings > Health and share with IT',
    ]);
    expect(result.error?.retryable).toBe(false);

    const rowCount = testDb.prepare('SELECT COUNT(*) AS count FROM secret_store').get() as { count: number };
    expect(rowCount.count).toBe(0);
    expect(encryptString).not.toHaveBeenCalled();
  });
});
