import Database from 'better-sqlite3';
import { app } from 'electron';
import { join } from 'path';
import type {
  GetHistoryRequest,
  GetHistoryResponse,
  OperationStatus,
  OperationType,
  RuntimeHistoryRecord,
} from '../../shared/runtime/runtime-contracts';

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

const RETENTION_DAYS = 90;

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(getDbPath());
    db.pragma('journal_mode = WAL');
    db.exec(`
      CREATE TABLE IF NOT EXISTS runtime_history (
        id TEXT PRIMARY KEY,
        operation_type TEXT NOT NULL,
        status TEXT NOT NULL,
        target_name TEXT,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        duration_ms INTEGER,
        error_message TEXT,
        error_details TEXT,
        metadata TEXT
      )
    `);
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_history_type_date
      ON runtime_history(operation_type, started_at)
    `);
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_history_status
      ON runtime_history(status)
    `);
  }

  return db;
}

export function saveHistoryRecord(record: RuntimeHistoryRecord): void {
  getDb()
    .prepare(
      `
      INSERT INTO runtime_history (
        id,
        operation_type,
        status,
        target_name,
        started_at,
        completed_at,
        duration_ms,
        error_message,
        error_details,
        metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
    .run(
      record.id,
      record.operationType,
      record.status,
      record.targetName ?? null,
      record.startedAt,
      record.completedAt ?? null,
      record.durationMs ?? null,
      record.errorMessage ?? null,
      record.errorDetails ?? null,
      record.metadata ? JSON.stringify(record.metadata) : null
    );
}

export function getHistory(request: GetHistoryRequest): GetHistoryResponse {
  let query = 'SELECT * FROM runtime_history WHERE 1 = 1';
  const params: unknown[] = [];

  if (request.operationType) {
    query += ' AND operation_type = ?';
    params.push(request.operationType);
  }

  if (request.status) {
    query += ' AND status = ?';
    params.push(request.status);
  }

  if (request.fromDate) {
    query += ' AND started_at >= ?';
    params.push(request.fromDate);
  }

  if (request.toDate) {
    query += ' AND started_at <= ?';
    params.push(request.toDate);
  }

  query += ' ORDER BY started_at DESC';

  if (request.limit) {
    query += ' LIMIT ?';
    params.push(request.limit);
  }

  const rows = getDb().prepare(query).all(...params) as Array<Record<string, unknown>>;
  const records: RuntimeHistoryRecord[] = rows.map((row) => ({
    id: row.id as string,
    operationType: row.operation_type as OperationType,
    status: row.status as OperationStatus,
    targetName: nullableString(row.target_name),
    startedAt: row.started_at as string,
    completedAt: nullableString(row.completed_at),
    durationMs: nullableNumber(row.duration_ms),
    errorMessage: nullableString(row.error_message),
    errorDetails: nullableString(row.error_details),
    metadata: parseMetadata(row.metadata),
  }));

  return {
    records,
    total: records.length,
  };
}

export function cleanupOldRecords(): { deleted: number } {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

  const result = getDb().prepare('DELETE FROM runtime_history WHERE started_at < ?').run(cutoff.toISOString());
  return { deleted: result.changes };
}

function nullableString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function nullableNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function parseMetadata(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export function _setDbForTesting(testDb: Database.Database): void {
  db = testDb;
}

export function _resetDbForTesting(): void {
  db = null;
}
