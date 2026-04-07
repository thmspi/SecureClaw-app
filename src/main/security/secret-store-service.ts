import Database from 'better-sqlite3';
import { app, safeStorage } from 'electron';
import { join } from 'path';
import type {
  DeleteScopeSecretsRequest,
  DeleteScopeSecretsResponse,
  DeleteSecretRequest,
  DeleteSecretResponse,
  GetSecretRequest,
  GetSecretResponse,
  SecretScope,
  SecretScopedKey,
  SecretStoreError,
  SetSecretRequest,
  SetSecretResponse,
} from '../../shared/security/secret-contracts';

let dbPath: string | null = null;

/**
 * Get database path (lazy initialization after app is ready)
 */
function getDbPath(): string {
  if (!dbPath) {
    dbPath = join(app.getPath('userData'), 'secureclaw.db');
  }
  return dbPath;
}

const UNAVAILABLE_ERROR_CODE = 'SECURE_STORAGE_UNAVAILABLE';
const UNKNOWN_ERROR_CODE = 'SECRET_STORE_OPERATION_FAILED';

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(getDbPath());
    db.pragma('journal_mode = WAL');
    db.exec(`
      CREATE TABLE IF NOT EXISTS secret_store (
        scoped_key TEXT PRIMARY KEY,
        encrypted_value BLOB NOT NULL,
        version INTEGER NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
  }

  return db;
}

function buildScopedKey(scope: SecretScope, name: string): SecretScopedKey {
  return `secureclaw:${scope}:${name}`;
}

function secureStorageUnavailableError(): SecretStoreError {
  return {
    userMessage: 'Secure storage is unavailable. Secret-dependent actions are blocked.',
    nextSteps: [
      'Unlock macOS Keychain',
      'Grant SecureClaw keychain access',
      'Export diagnostics from Settings > Health and share with IT',
    ],
    retryable: false,
    errorCode: UNAVAILABLE_ERROR_CODE,
    technicalDetails: 'Electron safeStorage encryption availability returned false',
  };
}

function operationError(message: string, details: unknown): SecretStoreError {
  return {
    userMessage: message,
    nextSteps: ['Retry the action or export diagnostics from Settings > Health and share with IT'],
    retryable: true,
    errorCode: UNKNOWN_ERROR_CODE,
    technicalDetails: details instanceof Error ? details.message : String(details),
  };
}

function ensureSecureStorage(): SecretStoreError | null {
  if (!safeStorage.isEncryptionAvailable()) {
    return secureStorageUnavailableError();
  }
  return null;
}

export function setSecret(request: SetSecretRequest): SetSecretResponse {
  const scopedKey = buildScopedKey(request.scope, request.name);
  const unavailableError = ensureSecureStorage();
  if (unavailableError) {
    return {
      success: false,
      secureStorageAvailable: false,
      scopedKey,
      error: unavailableError,
    };
  }

  try {
    const encryptedValue = safeStorage.encryptString(request.value);
    getDb()
      .prepare(
        `
        INSERT INTO secret_store (scoped_key, encrypted_value, version, updated_at)
        VALUES (?, ?, 1, ?)
        ON CONFLICT(scoped_key) DO UPDATE SET
          encrypted_value = excluded.encrypted_value,
          version = secret_store.version + 1,
          updated_at = excluded.updated_at
        `
      )
      .run(scopedKey, encryptedValue, new Date().toISOString());

    return {
      success: true,
      secureStorageAvailable: true,
      scopedKey,
    };
  } catch (error) {
    return {
      success: false,
      secureStorageAvailable: true,
      scopedKey,
      error: operationError('Unable to save secret securely.', error),
    };
  }
}

export function getSecret(request: GetSecretRequest): GetSecretResponse {
  const scopedKey = buildScopedKey(request.scope, request.name);
  const unavailableError = ensureSecureStorage();
  if (unavailableError) {
    return {
      success: false,
      secureStorageAvailable: false,
      scopedKey,
      error: unavailableError,
    };
  }

  try {
    const row = getDb()
      .prepare('SELECT encrypted_value FROM secret_store WHERE scoped_key = ?')
      .get(scopedKey) as { encrypted_value: Buffer } | undefined;

    if (!row) {
      return {
        success: true,
        secureStorageAvailable: true,
        scopedKey,
      };
    }

    return {
      success: true,
      secureStorageAvailable: true,
      scopedKey,
      value: safeStorage.decryptString(row.encrypted_value),
    };
  } catch (error) {
    return {
      success: false,
      secureStorageAvailable: true,
      scopedKey,
      error: operationError('Unable to read secret securely.', error),
    };
  }
}

export function deleteSecret(request: DeleteSecretRequest): DeleteSecretResponse {
  const scopedKey = buildScopedKey(request.scope, request.name);
  const unavailableError = ensureSecureStorage();
  if (unavailableError) {
    return {
      success: false,
      secureStorageAvailable: false,
      scopedKey,
      deleted: false,
      error: unavailableError,
    };
  }

  try {
    const result = getDb().prepare('DELETE FROM secret_store WHERE scoped_key = ?').run(scopedKey);
    return {
      success: true,
      secureStorageAvailable: true,
      scopedKey,
      deleted: result.changes > 0,
    };
  } catch (error) {
    return {
      success: false,
      secureStorageAvailable: true,
      scopedKey,
      deleted: false,
      error: operationError('Unable to delete secret securely.', error),
    };
  }
}

export function deleteScope(request: DeleteScopeSecretsRequest): DeleteScopeSecretsResponse {
  const unavailableError = ensureSecureStorage();
  if (unavailableError) {
    return {
      success: false,
      secureStorageAvailable: false,
      deletedCount: 0,
      error: unavailableError,
    };
  }

  try {
    const scopedPrefix = `secureclaw:${request.scope}:`;
    const result = getDb()
      .prepare('DELETE FROM secret_store WHERE scoped_key LIKE ?')
      .run(`${scopedPrefix}%`);

    return {
      success: true,
      secureStorageAvailable: true,
      deletedCount: result.changes,
    };
  } catch (error) {
    return {
      success: false,
      secureStorageAvailable: true,
      deletedCount: 0,
      error: operationError('Unable to delete scoped secrets securely.', error),
    };
  }
}

export function _setDbForTesting(testDb: Database.Database): void {
  db = testDb;
}

export function _resetDbForTesting(): void {
  db = null;
}
