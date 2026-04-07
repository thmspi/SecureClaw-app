import Database from 'better-sqlite3';
import type { RuntimeHistoryRecord } from '../../shared/runtime/runtime-contracts';

function makeRecord(overrides: Partial<RuntimeHistoryRecord> = {}): RuntimeHistoryRecord {
  const now = new Date().toISOString();
  return {
    id: overrides.id ?? `record-${Math.random().toString(36).slice(2)}`,
    operationType: overrides.operationType ?? 'session_start',
    status: overrides.status ?? 'success',
    targetName: overrides.targetName,
    startedAt: overrides.startedAt ?? now,
    completedAt: overrides.completedAt ?? now,
    durationMs: overrides.durationMs ?? 1000,
    errorMessage: overrides.errorMessage,
    errorDetails: overrides.errorDetails,
    metadata: overrides.metadata,
  };
}

describe('RuntimeHistoryService', () => {
  let testDb: Database.Database;

  beforeEach(async () => {
    jest.resetModules();
    jest.mock('electron', () => ({
      app: {
        getPath: jest.fn(() => ':memory:'),
      },
    }));

    testDb = new Database(':memory:');
    testDb.pragma('journal_mode = WAL');
    testDb.exec(`
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

    const { _setDbForTesting } = await import('./runtime-history-service');
    _setDbForTesting(testDb);
  });

  afterEach(() => {
    testDb?.close();
    jest.clearAllMocks();
  });

  it('saveHistoryRecord inserts a record with all fields', async () => {
    const { saveHistoryRecord, getHistory } = await import('./runtime-history-service');
    const record = makeRecord({
      id: 'record-1',
      operationType: 'session_start',
      status: 'success',
      targetName: 'default-session',
      metadata: { source: 'test' },
    });

    saveHistoryRecord(record);

    const result = getHistory({});
    expect(result.total).toBe(1);
    expect(result.records[0]).toMatchObject({
      id: 'record-1',
      operationType: 'session_start',
      status: 'success',
      targetName: 'default-session',
      metadata: { source: 'test' },
    });
  });

  it('getHistory with no filters returns all records', async () => {
    const { saveHistoryRecord, getHistory } = await import('./runtime-history-service');
    saveHistoryRecord(makeRecord({ id: 'record-1', startedAt: '2026-01-01T00:00:00.000Z' }));
    saveHistoryRecord(makeRecord({ id: 'record-2', startedAt: '2026-01-02T00:00:00.000Z' }));

    const result = getHistory({});
    expect(result.total).toBe(2);
    expect(result.records.map((record: RuntimeHistoryRecord) => record.id)).toEqual([
      'record-2',
      'record-1',
    ]);
  });

  it('getHistory with operationType filter returns matching records', async () => {
    const { saveHistoryRecord, getHistory } = await import('./runtime-history-service');
    saveHistoryRecord(makeRecord({ id: 'record-1', operationType: 'session_start' }));
    saveHistoryRecord(makeRecord({ id: 'record-2', operationType: 'session_stop' }));

    const result = getHistory({ operationType: 'session_stop' });
    expect(result.total).toBe(1);
    expect(result.records[0]?.id).toBe('record-2');
    expect(result.records[0]?.operationType).toBe('session_stop');
  });

  it('getHistory with status filter returns matching records', async () => {
    const { saveHistoryRecord, getHistory } = await import('./runtime-history-service');
    saveHistoryRecord(makeRecord({ id: 'record-1', status: 'success' }));
    saveHistoryRecord(makeRecord({ id: 'record-2', status: 'failed' }));

    const result = getHistory({ status: 'failed' });
    expect(result.total).toBe(1);
    expect(result.records[0]?.id).toBe('record-2');
    expect(result.records[0]?.status).toBe('failed');
  });

  it('getHistory with date range returns records within range', async () => {
    const { saveHistoryRecord, getHistory } = await import('./runtime-history-service');
    saveHistoryRecord(makeRecord({ id: 'record-1', startedAt: '2026-01-01T00:00:00.000Z' }));
    saveHistoryRecord(makeRecord({ id: 'record-2', startedAt: '2026-01-10T00:00:00.000Z' }));
    saveHistoryRecord(makeRecord({ id: 'record-3', startedAt: '2026-02-01T00:00:00.000Z' }));

    const result = getHistory({
      fromDate: '2026-01-05T00:00:00.000Z',
      toDate: '2026-01-31T23:59:59.999Z',
    });

    expect(result.total).toBe(1);
    expect(result.records[0]?.id).toBe('record-2');
  });

  it('cleanupOldRecords deletes records older than 90 days and keeps recent records', async () => {
    const { saveHistoryRecord, cleanupOldRecords, getHistory } = await import(
      './runtime-history-service'
    );

    const now = Date.now();
    const oldDate = new Date(now - 100 * 24 * 60 * 60 * 1000).toISOString();
    const recentDate = new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString();

    saveHistoryRecord(makeRecord({ id: 'record-old', startedAt: oldDate }));
    saveHistoryRecord(makeRecord({ id: 'record-recent', startedAt: recentDate }));

    const cleanupResult = cleanupOldRecords();
    expect(cleanupResult.deleted).toBe(1);

    const remaining = getHistory({});
    expect(remaining.total).toBe(1);
    expect(remaining.records[0]?.id).toBe('record-recent');
  });
});
