# Technology Stack - SecureClaw (2026)

**Project:** SecureClaw  
**Researched:** 2026-03-31  
**Scope:** macOS v1 first, Windows-ready architecture for later release

## Decision Summary

| Area | Recommendation | Confidence | Why |
|---|---|---|---|
| Electron + React desktop architecture | Electron (current stable), React + TypeScript, Vite build, strict preload IPC boundary | HIGH | Matches official Electron process/security model and keeps renderer safe while still enabling native actions |
| Cross-platform process execution | `execa` wrapper behind `runProcess()` / `stopProcess()` / `getPaths()` | HIGH | Mature cross-platform command execution with better Windows behavior and safer argument handling |
| SQLite in Electron | `better-sqlite3` in main process only + WAL mode + migration table | HIGH | Fast, stable SQLite usage pattern for desktop apps; official SQLite guidance supports WAL performance profile |
| Secret storage | Primary: Electron `safeStorage`; Optional adapter: `@napi-rs/keyring` (or legacy `keytar` only if needed) | MEDIUM-HIGH | `safeStorage` is first-party Electron and OS-backed; keytar is popular but stale; napi-rs keyring is actively updated |
| Packaging (macOS first, Windows-ready) | `electron-builder` with `mac: [dmg, zip]`, later `win: [nsis]` | HIGH | Mature signing/notarization + cross-platform targets from one config |
| Logging/diagnostics for low-tech enterprise users | `electron-log` + Electron `crashReporter` + one-click diagnostic bundle export | HIGH | Simple local logs, reliable crash artifacts, and support-friendly workflow |

## 1. Electron + React Architecture

### Recommended

- Runtime: `electron` (stay on current stable major; update frequently for security).
- UI: `react` + `typescript`.
- Build pipeline: `vite` (fast local dev + clean renderer bundling).
- IPC surface: typed, minimal API exposed from preload via `contextBridge`.

### Implementation shape

- `src/main/`: app lifecycle, windows, process runner, DB, secret storage, logging.
- `src/preload/`: strict API contract only (no raw `ipcRenderer` exposure).
- `src/renderer/`: React UI only.
- `src/core/platform/`: `getPaths()`, path normalization, binary resolution.
- `src/core/process/`: `runProcess()`, `stopProcess()`, streaming output.
- `src/core/plugins/`: OpenClaw/NemoClaw plugin orchestration.

### Why this fits SecureClaw

- Low-tech users need predictable behavior and clear errors.
- Main-process ownership of privileged operations keeps support/debugging straightforward.
- Windows support later is mostly adapter work, not rewrite.

### Avoid

- Enabling `nodeIntegration` in renderer.
- Disabling `contextIsolation` or sandbox defaults.
- Letting renderer call arbitrary shell commands.

## 2. Process Execution Abstraction (Cross-Platform CLI)

### Recommended

- Library: `execa`.
- Keep all command execution in main process.
- Build a single command runner API:
  - `runProcess({ id, command, args, cwd, env, timeoutMs, allowShell })`
  - `stopProcess({ id, strategy })`
  - `getPaths({ platform })`

### Execution policy

- Default to non-shell execution.
- Allow shell mode only for Windows `.cmd`/`.bat` edge cases.
- Store process metadata (`pid`, `startedAt`, `command`, `cwd`) for stop/restart UX.
- Use `AbortController` + hard timeout fallback.

### Why this fits SecureClaw

- Plugin execution for OpenClaw/NemoClaw must be robust under mixed binary/script entrypoints.
- Centralized runner prevents OS-specific logic from leaking everywhere.

### Avoid

- Raw `exec()` with interpolated user input.
- Per-feature ad-hoc `child_process.spawn` code.
- Assuming POSIX signals behave the same on Windows.

## 3. SQLite in Electron

### Recommended

- Library: `better-sqlite3` (main process only).
- Database location: under `app.getPath('userData')` (not in app bundle).
- Startup pragmas:
  - `PRAGMA journal_mode = WAL;`
  - `PRAGMA foreign_keys = ON;`
  - `PRAGMA busy_timeout = 5000;`
  - `PRAGMA synchronous = NORMAL;` (good desktop balance)
- Maintain a simple migrations table (`schema_migrations`).

### Data model direction

- `sessions` (start/stop lifecycle)
- `plugin_runs` (OpenClaw/NemoClaw execution history)
- `settings` (non-secret config)
- `secret_refs` (references, never plaintext secrets)

### Why this fits SecureClaw

- Local-first desktop persistence with low operational complexity.
- Synchronous API is acceptable in main process when queries are short and indexed.

### Avoid

- DB access directly from renderer.
- Storing DB in `Resources` path.
- `journal_mode=OFF` or disabling durability safeguards.

## 4. Secret Storage (Keytar and Alternatives)

### Recommended default

- Primary: Electron `safeStorage` API.
- Pattern: encrypt secret payload before persisting to SQLite (or file), decrypt only in main process.

### Optional adapter strategy

- Keep a `SecretStore` interface with implementations:
  - `SafeStorageSecretStore` (default)
  - `KeyringSecretStore` (optional)
- If explicit keychain entry management is needed:
  - Prefer `@napi-rs/keyring` (active releases).
  - Use `keytar` only when ecosystem compatibility requires it.

### Why this fits SecureClaw

- First-party Electron API reduces dependency risk.
- Adapter keeps future Windows behavior and enterprise policy constraints manageable.

### Avoid

- Plaintext tokens in SQLite, JSON, or logs.
- Hard dependence on unmaintained native modules.
- Secret handling in renderer or preload globals.

## 5. Packaging (macOS v1 First, Windows-Ready)

### Recommended

- Packager: `electron-builder`.
- macOS targets for v1:
  - `dmg` for user install flow.
  - `zip` alongside `dmg` to keep update path compatible.
- macOS signing/notarization:
  - Hardened runtime enabled.
  - Notarization via Apple API key env vars in CI.
- Windows-ready now (do not ship yet):
  - Keep `win` target section prepared with `nsis`.
  - Ensure app IDs, executable naming, and resource layout are already OS-agnostic.

### Suggested build config skeleton

```json
{
  "build": {
    "appId": "com.secureclaw.app",
    "files": ["dist/**", "dist-electron/**"],
    "mac": {
      "target": ["dmg", "zip"],
      "hardenedRuntime": true
    },
    "win": {
      "target": ["nsis"]
    }
  }
}
```

### Avoid

- Mixing multiple packaging stacks at release time (Forge makers + builder) unless there is a strict reason.
- Deferring app identity/signing strategy until after users install.
- mac-only paths in packaged runtime logic.

## 6. Logging + Diagnostics for Low-Tech Enterprise Users

### Recommended

- Logging: `electron-log`.
- Crash capture: Electron `crashReporter` started early.
- Add an in-app action: `Help -> Export Diagnostics`.

### Export Diagnostics should include

- Main and renderer logs (`app.getPath('logs')`).
- Recent process-run summaries (command ID, exit code, duration, redacted args).
- Crash dumps metadata/path (`app.getPath('crashDumps')`).
- App + OS version info.
- Sanitized config snapshot.

### UX rules (important for low-tech users)

- Show plain-language error states: "Install failed", "Session started", "Plugin stopped unexpectedly".
- Always provide one-click copy/export for support.
- Keep technical stack traces hidden behind "Advanced details".

### Avoid

- Logs only in devtools console.
- Requiring terminal access for diagnostics.
- Overly technical error text as first-line UI feedback.

## 7. Practical Package Set (Implementation-Ready)

```bash
npm install electron react react-dom
npm install execa better-sqlite3 electron-log
npm install -D typescript vite electron-builder
```

Optional secret-store adapter package:

```bash
npm install @napi-rs/keyring
```

## What To Explicitly Not Build Right Now

- Windows-specific hardening and installer tuning in v1.
- Complex remote telemetry pipeline before local diagnostics UX is complete.
- Plugin runtime that bypasses the central process abstraction.

## Sources

- Electron process model and security guidance: https://www.electronjs.org/docs/latest/tutorial/process-model, https://www.electronjs.org/docs/latest/tutorial/security
- Electron safe storage: https://www.electronjs.org/docs/latest/api/safe-storage
- Node child process cross-platform behavior: https://nodejs.org/api/child_process.html
- Execa: https://github.com/sindresorhus/execa
- better-sqlite3: https://github.com/WiseLibs/better-sqlite3
- SQLite pragmas (WAL, synchronous, etc.): https://www.sqlite.org/pragma.html#pragma_journal_mode
- keytar npm status: https://www.npmjs.com/package/keytar
- @napi-rs/keyring npm/repo: https://www.npmjs.com/package/@napi-rs/keyring, https://github.com/Brooooooklyn/keyring-node
- electron-builder mac/win targets: https://www.electron.build/mac, https://www.electron.build/win
- Electron Forge DMG/Squirrel references: https://www.electronforge.io/config/makers/dmg, https://www.electronforge.io/config/makers/squirrel.windows
- Electron app paths and crash reporter: https://www.electronjs.org/docs/latest/api/app, https://www.electronjs.org/docs/latest/api/crash-reporter
