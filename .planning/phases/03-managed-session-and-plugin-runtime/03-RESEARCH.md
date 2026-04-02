# Phase 3: Managed Session and Plugin Runtime - Research

**Researched:** 2026-04-02
**Domain:** Electron session lifecycle, plugin execution orchestration, SQLite runtime history
**Confidence:** HIGH

## Summary

Phase 3 transforms SecureClaw from an installation tool into a daily runtime operations hub. Users will start/stop managed OpenClaw sessions, trigger plugin actions, and review persisted operation history. This phase builds directly on Phase 1's process lifecycle primitives and Phase 2's SQLite persistence patterns.

The architecture extends existing patterns with a new `session` domain in main process (service + orchestrator), new `runtime` IPC channels, and a Management page in renderer with real-time state synchronization. Session readiness confirmation (D-05) uses a health probe pattern—waiting for explicit confirmation signal before transitioning to `Active` state. Plugin execution reuses the correlation ID + event stream pattern from process-runner for progress/failure tracking.

**Primary recommendation:** Extend `src/main/runtime/` with SessionOrchestrator (session state machine + concurrency management) and PluginRunner (execution queue with capped concurrency), persist history to SQLite via RuntimeHistoryService, and expose narrow typed APIs through new `runtime:v1:*` IPC channels.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Session does not auto-start at app launch.
- **D-02:** If OpenClaw and NemoClaw are installed and Docker daemon is available, app lands on the Management page.
- **D-03:** Multiple concurrent managed sessions are allowed.
- **D-04:** Session start runs lightweight preflight checks before launch attempt.
- **D-05:** Session becomes `Active` only after explicit readiness confirmation (not just process spawn).
- **D-06:** Stop interaction is one-click, shows a stopping state, and uses existing graceful-to-force escalation policy.
- **D-07:** Plugin runs are only allowed when a managed session is active.
- **D-08:** Plugin runs can execute in parallel with a capped concurrency limit.
- **D-09:** Plugin progress uses lifecycle states (`Queued`, `Starting`, `Running`, `Completed`, `Failed`) as primary UI.
- **D-10:** Plugin failures support manual retry from scratch while preserving history records.
- **D-11:** Post-install runtime entry is the Management page.
- **D-12:** Phase 3 management UI is a single page with sections for Session Control, Plugin Runs, and Operation History.
- **D-13:** With no active session, UI shows a clear `Start Session` CTA and disables plugin run actions.
- **D-14:** Top-right action cluster in Phase 3 is `Start/Stop Session` only.
- **D-15:** Persist history for session start/stop and plugin execution operations only.
- **D-16:** History list shows summary rows with expandable details.
- **D-17:** Retention target is last 90 days.
- **D-18:** Phase 3 includes basic filters by operation type, status, and date.

### Agent's Discretion
- Exact capped concurrency value for parallel plugin runs.
- Exact readiness signal mechanics (health probe, event handshake, or equivalent).
- Final visual design and layout details of the Management page sections.
- History row schema details beyond required fields for troubleshooting.

### Deferred Ideas (OUT OF SCOPE)
- Runtime policy manager with YAML editor.
- Plugin manager CRUD surface.
- Skill manager CRUD surface.
- MCP server manager CRUD surface.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RUN-01 | User can start a managed session from the app | Session state machine, preflight checks, health probe readiness confirmation, SessionOrchestrator pattern |
| RUN-02 | User can stop an active managed session from the app | Graceful-to-force escalation via existing stopProcess, session state transition to Stopped |
| RUN-03 | Plugin execution can be triggered and monitored from the app | PluginRunner with execution queue, lifecycle states, capped concurrency, correlation-based progress events |
| RUN-04 | Runtime operations are persisted in local operation history for troubleshooting | RuntimeHistoryService with SQLite, 90-day retention, query/filter API |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-sqlite3 | 12.8.0 | Runtime history persistence | Already established in install-state-service, WAL mode for crash safety |
| zustand | 5.0.12 | Renderer state for Management page | Already used for wizard-store, persist middleware for localStorage |
| zod | 4.3.6 | Schema validation for runtime IPC | Already used for platform-channels and install-channels |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| child_process (native) | Node builtin | Session process spawning | Direct spawn calls via existing process-runner |
| AbortController | Node builtin | Timeout and cancellation | Plugin execution abort signals |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom state machine | xstate | xstate adds dependency complexity; simple state transitions don't warrant it |
| SQLite | IndexedDB | SQLite already in use, better for structured queries, 90-day retention easier |
| Polling for readiness | HTTP health probe | Health probe is more robust, requires endpoint but OpenClaw likely exposes one |

**Installation:**
Already installed—no additional packages required for Phase 3.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── main/
│   ├── runtime/
│   │   ├── process-runner.ts       # Existing - no changes needed
│   │   ├── runtime-service.ts      # Existing - extend with session/plugin methods
│   │   ├── session-orchestrator.ts # NEW: Session lifecycle, state machine, concurrency
│   │   ├── plugin-runner.ts        # NEW: Plugin execution queue, capped parallelism
│   │   └── runtime-history-service.ts # NEW: SQLite history CRUD with retention
│   ├── ipc/
│   │   ├── platform-router.ts      # Existing
│   │   ├── install-router.ts       # Existing
│   │   └── runtime-router.ts       # NEW: Runtime IPC handlers
├── shared/
│   ├── runtime/
│   │   ├── runtime-contracts.ts    # NEW: Session/plugin/history type shapes
│   │   └── runtime-channels.ts     # NEW: Versioned IPC channels + zod schemas
├── preload/
│   └── platform-api.ts             # Extend with runtime API surface
├── renderer/
│   ├── stores/
│   │   └── management-store.ts     # NEW: Session/plugin/history state
│   ├── pages/
│   │   └── management/
│   │       ├── ManagementPage.tsx  # NEW: Single-page sections layout
│   │       ├── SessionControl.tsx  # NEW: Start/Stop with status
│   │       ├── PluginRuns.tsx      # NEW: Plugin execution UI
│   │       └── OperationHistory.tsx # NEW: Filterable history list
```

### Pattern 1: Session State Machine
**What:** Finite state machine tracking session lifecycle
**When to use:** Managing multiple concurrent sessions (D-03) with explicit state transitions
**Example:**
```typescript
// Source: Existing contracts.ts pattern + D-03/D-05/D-06 decisions
export type SessionState =
  | 'Idle'       // No session running
  | 'Starting'   // Spawned, awaiting readiness
  | 'Active'     // Ready confirmation received
  | 'Stopping'   // Graceful stop initiated
  | 'Stopped';   // Clean exit

export interface ManagedSession {
  sessionId: string;  // correlationId
  state: SessionState;
  pid?: number;
  startedAt?: string;
  activeAt?: string;  // When readiness confirmed
  stoppedAt?: string;
  error?: string;
}

// Valid transitions
const VALID_TRANSITIONS: Record<SessionState, SessionState[]> = {
  'Idle': ['Starting'],
  'Starting': ['Active', 'Stopped'],  // Active on health, Stopped on failure
  'Active': ['Stopping'],
  'Stopping': ['Stopped'],
  'Stopped': ['Idle'],  // Reset for new session
};
```

### Pattern 2: Health Probe Readiness (D-05)
**What:** Poll a health endpoint or wait for readiness event before marking session Active
**When to use:** Session start must confirm actual readiness, not just process spawn
**Example:**
```typescript
// Source: Common Electron/Docker health pattern
async function waitForReadiness(
  sessionId: string,
  healthEndpoint: string,
  timeoutMs: number = 30000
): Promise<boolean> {
  const startTime = Date.now();
  const pollIntervalMs = 500;

  while (Date.now() - startTime < timeoutMs) {
    try {
      const res = await fetch(healthEndpoint, { method: 'GET' });
      if (res.ok) {
        return true; // Ready!
      }
    } catch {
      // Not ready yet
    }
    await sleep(pollIntervalMs);
  }
  return false; // Timeout
}

// Alternative: event-based readiness via stdout parsing
function parseReadinessSignal(chunk: string): boolean {
  // OpenClaw emits specific log line when ready
  return chunk.includes('Server is ready');
}
```

### Pattern 3: Capped Concurrency Plugin Queue (D-08)
**What:** Execute plugin runs in parallel up to a cap, queue excess
**When to use:** Plugin execution with controlled parallelism
**Example:**
```typescript
// Source: Common async queue pattern
const MAX_CONCURRENT_PLUGINS = 3; // Agent discretion value

class PluginRunner {
  private queue: PluginRunRequest[] = [];
  private active: Map<string, PluginRunState> = new Map();

  async enqueue(request: PluginRunRequest): Promise<void> {
    this.queue.push(request);
    this.emitState(request.runId, 'Queued');
    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    while (this.queue.length > 0 && this.active.size < MAX_CONCURRENT_PLUGINS) {
      const request = this.queue.shift()!;
      this.active.set(request.runId, { state: 'Starting' });
      this.executePlugin(request);
    }
  }

  private async executePlugin(request: PluginRunRequest): Promise<void> {
    this.emitState(request.runId, 'Running');
    try {
      await runPluginCommand(request);
      this.emitState(request.runId, 'Completed');
    } catch (error) {
      this.emitState(request.runId, 'Failed', error);
    } finally {
      this.active.delete(request.runId);
      this.processQueue(); // Process next queued item
    }
  }
}
```

### Pattern 4: SQLite History with Retention (D-17)
**What:** Store operation records with 90-day auto-cleanup
**When to use:** Persisting session start/stop and plugin executions
**Example:**
```typescript
// Source: Existing install-state-service pattern
// Extend secureclaw.db with runtime_history table

const RETENTION_DAYS = 90;

function createHistoryTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS runtime_history (
      id TEXT PRIMARY KEY,
      operation_type TEXT NOT NULL,  -- 'session_start' | 'session_stop' | 'plugin_run'
      status TEXT NOT NULL,          -- 'success' | 'failed' | 'cancelled'
      target_name TEXT,              -- Session name or plugin name
      started_at TEXT NOT NULL,
      completed_at TEXT,
      duration_ms INTEGER,
      error_message TEXT,
      error_details TEXT,
      metadata TEXT                  -- JSON for extensibility
    );
    CREATE INDEX IF NOT EXISTS idx_history_type_date 
      ON runtime_history(operation_type, started_at);
  `);
}

function cleanupOldRecords(db: Database.Database): void {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
  db.prepare('DELETE FROM runtime_history WHERE started_at < ?')
    .run(cutoffDate.toISOString());
}
```

### Anti-Patterns to Avoid
- **Direct renderer-to-process communication:** All session/plugin operations must go through main process IPC.
- **Storing history in localStorage:** History should use SQLite for query flexibility and larger capacity.
- **Blocking UI on preflight checks:** Run checks async with loading indicators.
- **Fire-and-forget plugin execution:** Always track plugin runs with correlation IDs and state updates.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| State machine library | Custom FSM with edge-case bugs | Simple state + transition validator | Session states are finite, xstate overkill |
| Async queue | Custom promise tracking | Standard queue + Map pattern | Well-understood, fewer race conditions |
| Health polling | Custom retry logic | Standard fetch + sleep loop | Clear timeout semantics, easy to test |
| SQLite migrations | String concatenation | Versioned migration table | Already have pattern from install-state |

**Key insight:** Phase 3 reuses almost all Phase 1/2 primitives (process-runner, SQLite, IPC routing). The complexity is orchestration logic, not new infrastructure.

## Common Pitfalls

### Pitfall 1: Session State Drift
**What goes wrong:** Main process session state diverges from renderer state after reconnect/restart
**Why it happens:** Events missed during window reload, no re-sync mechanism
**How to avoid:** On renderer mount, fetch current session state from main process; use IPC event subscription with explicit unsubscribe
**Warning signs:** UI shows "Starting" but process already exited; "Stop" button stays enabled when no session

### Pitfall 2: Plugin Queue Starvation
**What goes wrong:** Queued plugins never start because active count never decrements
**Why it happens:** Error in plugin execution doesn't clean up active map entry
**How to avoid:** Use `finally` block to always remove from active set and trigger processQueue
**Warning signs:** Queue length grows but active count stays at max

### Pitfall 3: History Table Bloat
**What goes wrong:** SQLite file grows unbounded, slowing queries
**Why it happens:** Retention cleanup never runs or fails silently
**How to avoid:** Run cleanup on app startup; add index on started_at; log cleanup results
**Warning signs:** Query latency increases over time; DB file exceeds expected size

### Pitfall 4: Readiness Timeout Ambiguity
**What goes wrong:** User sees "Starting" for 30+ seconds with no feedback
**Why it happens:** Health probe timeout too long; no intermediate UI updates
**How to avoid:** Show "Waiting for response..." after 5s; allow cancel during Starting state
**Warning signs:** Users closing and reopening app during startup

### Pitfall 5: IPC Event Listener Leaks
**What goes wrong:** Memory grows; duplicate events fire; old listeners active
**Why it happens:** Renderer subscribes on mount but never unsubscribes
**How to avoid:** Return cleanup function from subscription; call in useEffect cleanup
**Warning signs:** Event handlers called multiple times per emission; console warnings about max listeners

## Code Examples

### Session Start Flow (Main Process)
```typescript
// Source: Extends existing runtime-service.ts pattern

export interface StartSessionRequest {
  sessionId: string;  // correlationId
  config?: {
    healthEndpoint?: string;
    readinessTimeoutMs?: number;
  };
}

export interface StartSessionResponse {
  sessionId: string;
  started: boolean;
  error?: string;
}

async function startSession(
  request: StartSessionRequest,
  onEvent: (event: SessionEvent) => void
): Promise<StartSessionResponse> {
  const { sessionId, config } = request;

  // D-04: Lightweight preflight checks
  const preflightOk = await runSessionPreflight();
  if (!preflightOk.passed) {
    return { sessionId, started: false, error: preflightOk.message };
  }

  // Spawn OpenClaw process
  onEvent({ type: 'starting', sessionId, timestamp: new Date().toISOString() });

  try {
    await runProcess({
      command: 'openclaw',
      args: ['serve'],
      correlationId: sessionId,
      onEvent: (evt) => {
        // Forward process events
        if (evt.type === 'spawned') {
          // D-05: Wait for readiness before marking Active
          void waitForReadiness(sessionId, config?.healthEndpoint ?? 'http://localhost:8080/health')
            .then((ready) => {
              if (ready) {
                onEvent({ type: 'active', sessionId, timestamp: new Date().toISOString() });
              } else {
                onEvent({ type: 'error', sessionId, error: 'Readiness timeout' });
              }
            });
        }
      },
    });

    return { sessionId, started: true };
  } catch (error) {
    return { sessionId, started: false, error: String(error) };
  }
}
```

### Runtime IPC Channels
```typescript
// Source: Follows existing platform-channels.ts pattern

import { z } from 'zod';

export const RUNTIME_CHANNELS = {
  // Session operations
  startSession: 'runtime:v1:startSession',
  stopSession: 'runtime:v1:stopSession',
  getSessions: 'runtime:v1:getSessions',
  
  // Plugin operations
  runPlugin: 'runtime:v1:runPlugin',
  cancelPluginRun: 'runtime:v1:cancelPluginRun',
  getPluginRuns: 'runtime:v1:getPluginRuns',
  
  // History operations
  getHistory: 'runtime:v1:getHistory',
  
  // Events (main → renderer)
  sessionEvent: 'runtime:v1:sessionEvent',
  pluginEvent: 'runtime:v1:pluginEvent',
} as const;

// Zod schemas
export const startSessionSchema = z.object({
  sessionId: z.string().min(1),
  config: z.object({
    healthEndpoint: z.string().optional(),
    readinessTimeoutMs: z.number().positive().optional(),
  }).optional(),
});

export const runPluginSchema = z.object({
  runId: z.string().min(1),
  sessionId: z.string().min(1),  // D-07: Must have active session
  pluginAction: z.string().min(1),
  args: z.record(z.unknown()).optional(),
});

export const getHistorySchema = z.object({
  operationType: z.enum(['session_start', 'session_stop', 'plugin_run']).optional(),
  status: z.enum(['success', 'failed', 'cancelled']).optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  limit: z.number().positive().max(100).optional(),
  offset: z.number().nonnegative().optional(),
});
```

### Management Store (Renderer)
```typescript
// Source: Extends wizard-store.ts pattern with zustand

import { create } from 'zustand';

export type SessionState = 'Idle' | 'Starting' | 'Active' | 'Stopping' | 'Stopped';
export type PluginRunState = 'Queued' | 'Starting' | 'Running' | 'Completed' | 'Failed';

interface ManagedSession {
  sessionId: string;
  state: SessionState;
  startedAt?: string;
  activeAt?: string;
  error?: string;
}

interface PluginRun {
  runId: string;
  sessionId: string;
  pluginAction: string;
  state: PluginRunState;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

interface ManagementState {
  sessions: ManagedSession[];
  pluginRuns: PluginRun[];
  historyFilter: HistoryFilter;

  // Actions
  addSession: (session: ManagedSession) => void;
  updateSession: (sessionId: string, updates: Partial<ManagedSession>) => void;
  addPluginRun: (run: PluginRun) => void;
  updatePluginRun: (runId: string, updates: Partial<PluginRun>) => void;
  setHistoryFilter: (filter: HistoryFilter) => void;
}

export const useManagementStore = create<ManagementState>()((set) => ({
  sessions: [],
  pluginRuns: [],
  historyFilter: {},

  addSession: (session) =>
    set((s) => ({ sessions: [...s.sessions, session] })),

  updateSession: (sessionId, updates) =>
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.sessionId === sessionId ? { ...sess, ...updates } : sess
      ),
    })),

  addPluginRun: (run) =>
    set((s) => ({ pluginRuns: [...s.pluginRuns, run] })),

  updatePluginRun: (runId, updates) =>
    set((s) => ({
      pluginRuns: s.pluginRuns.map((run) =>
        run.runId === runId ? { ...run, ...updates } : run
      ),
    })),

  setHistoryFilter: (filter) => set({ historyFilter: filter }),
}));
```

### Preload API Extension
```typescript
// Source: Extends existing platform-api.ts pattern

import { RUNTIME_CHANNELS } from '../shared/runtime/runtime-channels';

const runtimeAPI = {
  // Sessions
  startSession: (sessionId: string, config?: SessionConfig) =>
    ipcRenderer.invoke(RUNTIME_CHANNELS.startSession, { sessionId, config }),

  stopSession: (sessionId: string) =>
    ipcRenderer.invoke(RUNTIME_CHANNELS.stopSession, { sessionId }),

  getSessions: () =>
    ipcRenderer.invoke(RUNTIME_CHANNELS.getSessions),

  // Plugins (D-07: requires active session)
  runPlugin: (runId: string, sessionId: string, pluginAction: string, args?: object) =>
    ipcRenderer.invoke(RUNTIME_CHANNELS.runPlugin, { runId, sessionId, pluginAction, args }),

  cancelPluginRun: (runId: string) =>
    ipcRenderer.invoke(RUNTIME_CHANNELS.cancelPluginRun, { runId }),

  getPluginRuns: (sessionId: string) =>
    ipcRenderer.invoke(RUNTIME_CHANNELS.getPluginRuns, { sessionId }),

  // History (D-15, D-18)
  getHistory: (filter?: HistoryFilter) =>
    ipcRenderer.invoke(RUNTIME_CHANNELS.getHistory, filter),

  // Event subscriptions
  onSessionEvent: (callback: (event: SessionEvent) => void) => {
    const handler = (_: unknown, event: SessionEvent) => callback(event);
    ipcRenderer.on(RUNTIME_CHANNELS.sessionEvent, handler);
    return () => ipcRenderer.removeListener(RUNTIME_CHANNELS.sessionEvent, handler);
  },

  onPluginEvent: (callback: (event: PluginEvent) => void) => {
    const handler = (_: unknown, event: PluginEvent) => callback(event);
    ipcRenderer.on(RUNTIME_CHANNELS.pluginEvent, handler);
    return () => ipcRenderer.removeListener(RUNTIME_CHANNELS.pluginEvent, handler);
  },
};

// Add to contextBridge exposure
contextBridge.exposeInMainWorld('secureClaw', {
  platform: platformAPI,
  install: installAPI,
  runtime: runtimeAPI,  // NEW
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single session | Multiple concurrent (D-03) | Phase 3 design | SessionOrchestrator tracks Map of sessions |
| Process spawn = ready | Health probe readiness (D-05) | Phase 3 design | Added readiness confirmation step |
| localStorage history | SQLite history (D-16) | Phase 3 design | Better queries, larger capacity |
| Serial plugin execution | Capped parallelism (D-08) | Phase 3 design | Queue pattern with active count limit |

**Deprecated/outdated:**
- None from Phase 1/2 patterns—all reused and extended.

## Open Questions

1. **Health endpoint discovery**
   - What we know: OpenClaw exposes HTTP API for chat/completions
   - What's unclear: Exact health endpoint path and expected response format
   - Recommendation: Default to `/health` or `/api/health`; allow override via config; parse for `{ status: "ok" }` or 2xx response

2. **Plugin action invocation**
   - What we know: Plugin runs execute "OpenClaw plugin actions"
   - What's unclear: Exact CLI syntax for running a plugin action
   - Recommendation: Research OpenClaw CLI docs or assume `openclaw plugin run <action> [--args]` pattern

3. **Concurrent session naming**
   - What we know: Multiple sessions allowed (D-03)
   - What's unclear: How users distinguish between sessions
   - Recommendation: Auto-generate descriptive names like "Session-1", "Session-2" or timestamp-based

4. **Session persistence across restart**
   - What we know: History persists (D-15/D-16)
   - What's unclear: Should running sessions survive app restart?
   - Recommendation: No—sessions are app-managed processes; on app close, gracefully stop all sessions

## Sources

### Primary (HIGH confidence)
- `src/main/runtime/process-runner.ts` — Existing process lifecycle, correlation IDs, stop escalation
- `src/main/runtime/runtime-service.ts` — Service facade pattern with event listeners
- `src/main/install/install-state-service.ts` — SQLite persistence with WAL mode
- `src/shared/ipc/platform-channels.ts` — Versioned typed IPC pattern with zod validation
- `src/preload/platform-api.ts` — Narrow preload bridge exposure pattern
- `src/renderer/stores/wizard-store.ts` — Zustand store with persistence middleware
- `.planning/phases/03-managed-session-and-plugin-runtime/03-CONTEXT.md` — All D-XX decisions

### Secondary (MEDIUM confidence)
- Install orchestrator pattern for complex multi-step operations
- Standard async queue patterns for capped concurrency
- SQLite indexing for query performance

### Tertiary (LOW confidence)
- Exact OpenClaw health endpoint path (needs verification with upstream docs)
- Exact plugin action CLI syntax (needs verification)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All libraries already in use
- Architecture: HIGH — Direct extension of Phase 1/2 patterns
- Pitfalls: HIGH — Based on Electron IPC and process management experience
- Plugin invocation: MEDIUM — Syntax needs verification with OpenClaw docs

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (30 days — stable patterns)
