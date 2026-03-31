# Architecture Patterns

**Domain:** Electron + React desktop app for OpenClaw/NemoClaw lifecycle management
**Researched:** 2026-03-31

## Recommended Architecture

SecureClaw should use a strict three-layer desktop architecture:
1. `Renderer (React)` for UX only.
2. `Main (Electron)` for orchestration, policy, and IPC routing.
3. `Services (Node/Electron utility processes)` for OS-facing operations (filesystem, binary execution, install/update hooks).

This keeps your already portable parts (React UI, IPC patterns, SQLite) while isolating the highest-risk cross-platform behavior behind a dedicated OS abstraction layer.

### High-Level Component Map

```text
+-------------------------+          typed IPC          +----------------------------+
| Renderer (React)        | <-------------------------> | Main Process (Electron)    |
| - Pages / State         |                             | - IPC Router               |
| - View Models           |                             | - App Lifecycle            |
| - No direct Node access |                             | - Security / Policy        |
+-------------------------+                             +-------------+--------------+
                                                                      |
                                                                      | service calls
                                                                      v
                                       +------------------------------+------------------------------+
                                       | Service Layer (Main-owned modules and utility processes)      |
                                       | - SessionService (OpenClaw/NemoClaw lifecycle)                |
                                       | - BinaryResolverService                                          |
                                       | - ProcessRunnerService                                           |
                                       | - PathService                                                    |
                                       | - InstallerIntegrationService                                    |
                                       | - PersistenceService (SQLite repositories)                       |
                                       +------------------------------+------------------------------+
                                                                      |
                                                                      v
                                       +--------------------------------------------------------------+
                                       | OS + External Dependencies                                   |
                                       | - Filesystem, env vars, process table                        |
                                       | - OpenClaw/NemoClaw binaries                                 |
                                       | - Installer/updater mechanisms (macOS/Windows)               |
                                       +--------------------------------------------------------------+
```

## Component Boundaries

| Component | Responsibility | Must Not Do | Communicates With |
|-----------|---------------|-------------|-------------------|
| Renderer (React) | UI state, forms, progress, logs display, user actions | Spawn processes, inspect PATH, touch SQLite directly | Preload API only |
| Preload Bridge | Expose narrow typed API (`window.secureClaw.*`) using `contextBridge` | Expose raw `ipcRenderer` methods | Renderer, Main IPC |
| IPC Router (Main) | Validate channel inputs, map commands to services, normalize errors | Business logic duplication, shell execution | Preload, Services |
| SessionService | Start/stop/status for OpenClaw/NemoClaw sessions, cancellation, timeout policy | UI formatting, raw path concatenation | ProcessRunner, BinaryResolver, Persistence |
| PersistenceService (SQLite) | Session records, execution history, settings, migration/versioning | Platform branching logic | SessionService, InstallerIntegration |
| PathService | OS-aware path derivation, normalization, app dirs, temp/work dirs | Process spawning | All services |
| BinaryResolverService | Resolve executable/script path, verify executable availability, version checks | Direct UI messaging | SessionService, InstallerIntegration |
| ProcessRunnerService | Controlled process execution, stream capture, kill/escalation, correlation IDs | Guess binary locations | SessionService |
| InstallerIntegrationService | Platform-specific install/update hooks and first-run setup | Session orchestration | App lifecycle, Persistence |

## Data Flow

### 1) Session Start (Renderer -> Main -> Services)

1. React view dispatches `startSession` from user action.
2. Preload forwards a typed IPC request (`session:start`) to main.
3. IPC Router validates payload schema and enriches with correlation ID.
4. SessionService resolves:
   - project/work paths via PathService,
   - runtime binary via BinaryResolverService,
   - process options via ProcessRunnerService contract.
5. ProcessRunnerService starts the process with explicit executable + arg array.
6. stdout/stderr are streamed to SessionService and stored/forwarded as structured events.
7. Session state is persisted in SQLite.
8. Main emits incremental progress events back to renderer (`session:event`).

### 2) Session Stop / Cancellation

1. Renderer sends `session:stop` with session ID.
2. SessionService requests graceful shutdown from ProcessRunnerService.
3. If timeout exceeded, ProcessRunnerService applies platform fallback termination.
4. Final status and exit metadata persisted to SQLite.
5. Main pushes terminal event to renderer.

### 3) App Startup / First Run

1. Main boot sequence initializes SQLite and migrations.
2. InstallerIntegrationService checks install/update context.
3. BinaryResolverService runs quick health checks.
4. Startup diagnostics are recorded and exposed as read-only app status to renderer.

## OS Abstraction Layer Design

Create a dedicated `platform` module with clear interfaces and per-OS implementations.

```text
src/main/platform/
  index.ts                # factory by process.platform
  contracts.ts            # shared interfaces
  darwin/
    paths.ts
    process.ts
    binaryResolver.ts
    installerHooks.ts
  win32/
    paths.ts
    process.ts
    binaryResolver.ts
    installerHooks.ts
```

### A) Paths Abstraction (`PathAdapter`)

Purpose: eliminate string-based path logic and centralize all path semantics.

Suggested contract:
- `getAppDataDir()`
- `getLogsDir()`
- `getWorkDir(projectId)`
- `normalizeUserPath(input)`
- `toDisplayPath(absolutePath)`

Design notes:
- Use Node `path` and `fs` APIs only, never manual separators.
- Normalize at boundary ingress (IPC input and config load).
- Keep internal storage canonical (absolute paths).
- Add fixtures for spaces, long names, and mixed separators.

### B) Process Runner Abstraction (`ProcessAdapter`)

Purpose: make spawn behavior deterministic and secure across macOS and Windows.

Suggested contract:
- `spawnTask(spec): RunningTask`
- `stopTask(taskId, strategy)`
- `streamTask(taskId, handlers)`
- `getTaskSnapshot(taskId)`

`spec` should include:
- executable path,
- args array,
- cwd,
- env overrides,
- timeout,
- output mode (buffered vs stream).

Design notes:
- Prefer `spawn`/`execFile` with executable + args.
- Avoid shell invocation unless strictly required for `.bat`/`.cmd` flows.
- Always set explicit `cwd`, bounded `env`, timeout, and `windowsHide` for Windows UX.
- Capture `spawn`, `error`, `exit`, and `close` events and map to a unified task state machine.

### C) Binary Resolver Abstraction (`BinaryResolver`)

Purpose: decouple feature logic from binary location rules.

Suggested contract:
- `resolveOpenClaw(context): ResolvedBinary`
- `resolveNemoClaw(context): ResolvedBinary`
- `verifyBinary(binary): HealthCheckResult`
- `getVersion(binary): SemanticVersion`

Resolution strategy order:
1. Explicit user-configured path (settings).
2. Bundled app binary/tool directory.
3. System PATH lookup.
4. Managed download cache (if supported later).

Design notes:
- Return structured diagnostics, not booleans.
- Cache successful resolutions with invalidation on app update or settings change.
- Keep platform-specific executable naming and extension rules in the adapter.

### D) Installer Hooks Abstraction (`InstallerHooks`)

Purpose: isolate installer/update lifecycle differences.

Suggested contract:
- `onFirstInstall()`
- `onBeforeUpdate()`
- `onAfterUpdate()`
- `onUninstall()`
- `collectInstallContext()`

Design notes:
- Keep this logic in main process startup/lifecycle only.
- Ensure idempotent hooks (safe on repeated launch).
- Persist hook execution result in SQLite for support diagnostics.
- Use this layer to trigger post-install checks: binary presence, directory permissions, DB schema readiness.

## Suggested Build Order (Phased for Coarse Roadmap)

### Phase 1: Cross-Platform Core Runtime (highest risk first)

Build first:
1. `PathAdapter` (darwin + win32).
2. `ProcessAdapter` unified task state model.
3. `BinaryResolver` + health check diagnostics.
4. `SessionService` built on these abstractions.

Exit criteria:
- Start/stop/status works on macOS and Windows dev environments.
- No raw shell-string orchestration in feature code.
- Structured errors and correlation IDs across session logs.

### Phase 2: Persistence and Operational Safety

Build next:
1. SQLite repository boundaries and migrations.
2. Event/log storage schema (session timeline, process metadata, resolver diagnostics).
3. Startup health report pipeline (main -> renderer).

Exit criteria:
- Session and diagnostics are recoverable across app restarts.
- DB schema versioning supports updates cleanly.

### Phase 3: Installer and Update Divergence Control

Build next:
1. `InstallerHooks` darwin + win32 implementation.
2. Packaged-build validation workflow for install/update/rollback.
3. First-run checks wired into lifecycle.

Exit criteria:
- Install/update behavior is deterministic and observable on both OSes.
- Hook telemetry available in diagnostics export.

### Phase 4: UX Integration and Hardening

Build next:
1. React screens consume structured session and health state.
2. Actionable error mapping (technical -> user-friendly).
3. Cross-platform test matrix for path/process/install edge cases.

Exit criteria:
- UI can guide non-technical users through failure recovery.
- Major risk classes (path, binary resolution, spawn, installer) have automated coverage.

## Practical Conventions

- Use typed IPC request/response contracts with versioned channel names.
- Keep renderer untrusted: no direct Node API exposure.
- Validate all IPC payloads at main boundary.
- Use immutable event payloads for session state transitions.
- Emit one correlation ID per user action and include it in renderer/main/process logs.

## Roadmap Granularity Guidance

For coarse planning, split roadmap by architecture risk layers, not by UI screens:
1. Runtime abstraction and session control.
2. Persistence and observability.
3. Packaging/install/update lifecycle.
4. UX hardening and supportability.

This sequencing front-loads the expensive cross-platform unknowns and prevents late-stage rewrite pressure.

## Sources

- Electron process model docs (main/renderer/preload/utility process): https://www.electronjs.org/docs/latest/tutorial/process-model (confidence: HIGH)
- Electron IPC patterns and secure preload usage: https://www.electronjs.org/docs/latest/tutorial/ipc (confidence: HIGH)
- Electron context isolation guidance: https://www.electronjs.org/docs/latest/tutorial/context-isolation (confidence: HIGH)
- Electron utility process API: https://www.electronjs.org/docs/latest/api/utility-process (confidence: HIGH)
- Node.js child process behavior and Windows `.bat/.cmd` caveats: https://nodejs.org/api/child_process.html (confidence: HIGH)
- Electron Builder packaging targets and hooks overview: https://www.electron.build/ (confidence: MEDIUM)
- Electron Forge packaging pipeline and makers/publishers guidance: https://www.electronforge.io/ (confidence: MEDIUM)
