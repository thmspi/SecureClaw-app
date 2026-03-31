# Project Research Summary

**Project:** SecureClaw
**Domain:** Electron desktop installer/manager for OpenClaw + NemoClaw (macOS-first, Windows-ready)
**Researched:** 2026-03-31
**Confidence:** MEDIUM-HIGH

## Executive Summary

SecureClaw is a guided desktop operations product for low-technical enterprise users who need to install, run, and troubleshoot OpenClaw/NemoClaw without touching a terminal. The research consistently points to a security-first Electron architecture where React handles UX only, and all privileged work (process execution, SQLite, secret handling, install/update hooks) is isolated in Electron main process services behind typed IPC.

The strongest implementation path is: Electron + React + TypeScript + Vite, a central `execa`-based process abstraction, `better-sqlite3` in main process with WAL and migrations, and first-party `safeStorage` for secrets. This gives predictable behavior on macOS now while preserving a clean adapter seam for Windows (`darwin`/`win32`) instead of a later rewrite.

The highest delivery risk is not UI complexity; it is cross-platform operational drift (shell assumptions, path semantics, encoding differences, installer/signing gaps, enterprise policy constraints). The roadmap should front-load runtime abstractions, diagnostics, and packaging trust-chain work early so user-facing flows remain stable when Windows support and enterprise rollout expand.

## Key Findings

### Recommended Stack

The stack should stay close to official Electron security and process model guidance: strict renderer isolation, narrow preload API, typed IPC validation, and main-process ownership of all OS operations.

**Core technologies:**
- `electron` + `react` + `typescript` + `vite`: desktop shell + UX + typed codebase + fast build loop.
- `execa`: centralized, safer cross-platform process execution wrapper.
- `better-sqlite3` (main process only): durable local persistence with low operational overhead.
- `safeStorage` (default) with optional keyring adapter: OS-backed secret protection without renderer exposure.
- `electron-builder`: unified packaging/signing targets (`dmg`/`zip` first, `nsis` prepared).
- `electron-log` + `crashReporter`: support-grade diagnostics for low-tech enterprise users.

### Expected Features

Requirements should scope to a reliability-first v1 where users can complete install and recovery workflows without CLI knowledge.

**Must have (table stakes):**
- Guided first-run wizard.
- Environment/prerequisite checks before install.
- One-click install for OpenClaw/NemoClaw.
- Progress timeline and plain-language errors with recovery actions.
- Safe retry/cancel/rollback behavior.
- Health dashboard (installed version + runtime status).
- In-app updates (app + managed components).
- Diagnostics export for IT support.
- Minimal contextual help.

**Should have (competitive):**
- Readiness score before install.
- Bulk/scripted IT enrollment mode.
- Policy profiles / managed mode.
- Release channels (stable/beta).
- Smart self-heal recommendations.
- Remote support handoff package.
- Optional CLI parity layer for advanced admins.

**Defer (v2+):**
- Full terminal emulator in-app.
- Deep first-run customization.
- Mandatory account creation for local installs.
- Cloud dependency for basic operations.
- Plugin marketplace and advanced user observability dashboards.

### Architecture Approach

Use a strict 3-layer design with OS adapters: `Renderer (React UI)` -> `Preload typed API` -> `Main IPC router + services` -> `Platform adapters / external binaries`. Keep services explicit: `SessionService`, `ProcessRunnerService`, `BinaryResolverService`, `PathService`, `InstallerIntegrationService`, `PersistenceService`.

**Major components:**
1. Renderer + Preload boundary: user actions and status visualization, no direct Node/system access.
2. Main orchestration services: session lifecycle, process supervision, path/binary resolution, installer lifecycle.
3. Platform adapters (`darwin`, `win32`) + persistence: OS-specific behavior and durable operational history.

### Critical Pitfalls

1. **Shell coupling to macOS defaults** - Prevent by banning raw shell strings and using executable+args via centralized process adapter.
2. **Unsigned artifact/Defender trust failures** - Prevent by implementing signing pipeline early and gating CI on signature validity.
3. **Path semantics assumptions** - Prevent by mandatory Node `path` APIs, normalized boundaries, and spaced/long-path test fixtures.
4. **CLI output encoding/line-ending drift** - Prevent by explicit decode + CRLF normalization and parser fixture tests from Windows shells.
5. **Installer/updater complexity deferred too late** - Prevent by validating install/update/rollback in clean VMs with standard user privileges from early phases.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Runtime Core and Safety Boundaries
**Rationale:** Highest technical risk and dependency root; every user-facing feature depends on deterministic process/path behavior.
**Delivers:** Typed IPC boundary, PathAdapter, ProcessAdapter, BinaryResolver, SessionService baseline with correlation IDs.
**Addresses:** Guided flow foundation, prerequisite checks, one-click install orchestration substrate.
**Avoids:** Shell coupling, path drift, timeout/zombie process issues.

### Phase 2: Persistence, Error UX, and Diagnostics
**Rationale:** Low-tech enterprise usability requires trustworthy status persistence and actionable failures before scaling feature breadth.
**Delivers:** SQLite schema/migrations, operation journal, structured error taxonomy, health dashboard data model, export diagnostics flow.
**Uses:** `better-sqlite3`, `electron-log`, crash reporting, shared error mapping.
**Implements:** PersistenceService and user-recovery loop.

### Phase 3: Install/Update and Trust Chain
**Rationale:** Distribution risk is a primary enterprise blocker; packaging and signing must mature before broad rollout.
**Delivers:** `electron-builder` packaging, macOS signed/notarized pipeline, Windows-target-ready config, installer hooks, rollback/repair validation.
**Addresses:** In-app updates, enterprise deployment readiness.
**Avoids:** SmartScreen/Defender blocks, brittle update behavior.

### Phase 4: Cross-Platform Hardening and Enterprise Controls
**Rationale:** After baseline reliability, expand to differentiators and enterprise policy workflows safely.
**Delivers:** Windows adapter hardening, managed endpoint validation, policy profiles/bulk enrollment/release channels (prioritized subset).
**Addresses:** Differentiator backlog with controlled risk.
**Avoids:** Late policy/execution-permission surprises.

### Phase Ordering Rationale

- Runtime abstractions come first because feature delivery depends on deterministic process/path/binary behavior.
- Persistence and diagnostics precede broad rollout so supportability is built in, not bolted on.
- Packaging/signing is treated as core product capability, not release-week activity.
- Differentiators are sequenced after table stakes and operational reliability are proven.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3:** Exact updater/signing workflow details (mac notarization + Windows signing/SmartScreen reputation strategy).
- **Phase 4:** Enterprise policy constraints (PowerShell execution policies, AppLocker/EDR behavior, IT rollout patterns).
- **Phase 4:** Plugin certification matrix and ABI/runtime compatibility strategy.

Phases with standard patterns (skip research-phase):
- **Phase 1:** Typed IPC boundary, renderer isolation, service-layer decomposition in Electron.
- **Phase 2:** SQLite migration/versioning and local diagnostics bundle patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Mostly official Electron/Node/SQLite docs and mature libraries; clear implementation fit. |
| Features | MEDIUM-HIGH | Strong product/UX rationale; some enterprise differentiators need pilot validation. |
| Architecture | HIGH | Clear, repeatable Electron layering and adapter strategy with explicit component boundaries. |
| Pitfalls | MEDIUM | Practical and credible, but several items are implementation-derived and need environment-specific validation. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- Windows enterprise baseline assumptions (EDR, execution policies, allowlisting process) need validation with real managed endpoints.
- Final installer/update channel selection and rollback mechanics need proof in packaged integration tests.
- Secret-store adapter decision (`safeStorage` only vs optional keyring backend) should be finalized during Phase 2 threat-model review.
- Plugin contract/versioning details need explicit v1 governance before differentiator rollout.

## Sources

### Primary (HIGH confidence)
- Electron official docs (process model, IPC, security, context isolation, app paths, crash reporter, updates)
- Node.js official `child_process` and `path` documentation
- SQLite official pragma documentation

### Secondary (MEDIUM confidence)
- `execa` repository/docs
- `better-sqlite3` repository/docs
- `electron-builder` docs (targets, code-signing, auto-update)
- Microsoft Learn guidance referenced in pitfalls (SmartScreen/execution policy context)
- NN/g usability and error-message references for low-tech UX framing

### Tertiary (LOW confidence)
- Package ecosystem status signals for keyring alternatives (`@napi-rs/keyring`, `keytar`) that require periodic re-validation

---
*Research completed: 2026-03-31*
*Ready for roadmap: yes*
