import Database from 'better-sqlite3';
import { app } from 'electron';
import { join } from 'path';
import type { InstallState, InstallTarget, InstallStatus } from '../../shared/install';

const DB_PATH = join(app.getPath('userData'), 'secureclaw.db');

let db: Database.Database | null = null;

/**
 * Get or create the database connection with WAL journal mode (D-16)
 */
function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.exec(`
      CREATE TABLE IF NOT EXISTS install_state (
        id TEXT PRIMARY KEY DEFAULT 'singleton',
        target TEXT NOT NULL,
        status TEXT NOT NULL,
        current_step INTEGER NOT NULL DEFAULT 0,
        total_steps INTEGER NOT NULL DEFAULT 5,
        step_name TEXT,
        error_message TEXT,
        error_details TEXT,
        started_at TEXT,
        updated_at TEXT NOT NULL,
        completed_steps TEXT DEFAULT '[]'
      )
    `);
  }
  return db;
}

/**
 * Save install state to database (upsert pattern)
 */
export function saveInstallState(state: InstallState): void {
  const stmt = getDb().prepare(`
    INSERT INTO install_state (id, target, status, current_step, total_steps, step_name, error_message, error_details, started_at, updated_at, completed_steps)
    VALUES ('singleton', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      target = excluded.target,
      status = excluded.status,
      current_step = excluded.current_step,
      total_steps = excluded.total_steps,
      step_name = excluded.step_name,
      error_message = excluded.error_message,
      error_details = excluded.error_details,
      updated_at = excluded.updated_at,
      completed_steps = excluded.completed_steps
  `);
  stmt.run(
    state.target,
    state.status,
    state.currentStep,
    state.totalSteps,
    state.stepName ?? null,
    state.errorMessage ?? null,
    state.errorDetails ?? null,
    state.startedAt ?? null,
    state.updatedAt,
    JSON.stringify(state.completedSteps)
  );
}

/**
 * Load install state from database
 */
export function loadInstallState(): InstallState | null {
  const row = getDb()
    .prepare('SELECT * FROM install_state WHERE id = ?')
    .get('singleton') as Record<string, unknown> | undefined;

  if (!row) return null;

  return {
    target: row.target as InstallTarget,
    status: row.status as InstallStatus,
    currentStep: row.current_step as number,
    totalSteps: row.total_steps as number,
    stepName: row.step_name as string | undefined,
    errorMessage: row.error_message as string | undefined,
    errorDetails: row.error_details as string | undefined,
    startedAt: row.started_at as string | undefined,
    updatedAt: row.updated_at as string,
    completedSteps: JSON.parse((row.completed_steps as string) || '[]'),
  };
}

/**
 * Clear install state from database
 */
export function clearInstallState(): void {
  getDb().prepare('DELETE FROM install_state WHERE id = ?').run('singleton');
}

/**
 * For testing - allows injecting an in-memory database
 */
export function _setDbForTesting(testDb: Database.Database): void {
  db = testDb;
}

/**
 * For testing - reset database connection
 */
export function _resetDbForTesting(): void {
  db = null;
}
