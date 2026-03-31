# Feature Landscape

**Domain:** Desktop installer/manager for OpenClaw + NemoClaw (low-tech enterprise users)
**Researched:** 2026-03-31
**Platform bias:** macOS v1 first, Windows compatibility by design (shared core + OS adapters)

## Table Stakes (must-have in v1)

Features users will expect immediately. Missing these will make the product feel risky or too technical.

| Feature | Why Expected | Complexity | Dependencies | macOS v1 / Windows design note |
|---------|--------------|------------|--------------|----------------------------------|
| Guided first-run setup wizard | Low-tech users need a clear, linear path with no CLI or hidden steps. | Medium | App shell, state machine for steps, validation layer | Build a platform-neutral wizard engine (JSON step definitions) and platform-specific action adapters. |
| Environment and prerequisite checks | Prevents install failures by validating OS version, permissions, disk space, network, and required toolchain before install. | Medium | OS capability probe module, diagnostics mapping, permission-check APIs | Keep checks in a shared rules engine; implement probes per OS (`darwin`, `win32`). |
| One-click install for OpenClaw + NemoClaw | Core product promise: install both components without manual terminal use. | High | Package source strategy, download/verify pipeline, privilege escalation flow | Use a unified install orchestrator with pluggable per-OS install executors to avoid rewrite. |
| Progress + clear status timeline | Users need visibility of what is happening and what step is next; reduces support tickets. | Medium | Event bus from backend tasks, structured step telemetry | Standardize progress event schema once; render identically on both platforms. |
| Plain-language error handling with recovery actions | Enterprise non-technical users need concrete "what happened" + "what to do now" guidance. | Medium | Error taxonomy, retry/rollback hooks, local log bundle | Keep user-facing error catalog shared; only recovery commands differ by OS. |
| Safe retry, cancel, and rollback | Install/update operations must be reversible or restartable to build trust. | High | Transaction-like operation journal, artifact cache, cleanup routines | Persist operation journal in shared format; implement OS-specific rollback handlers. |
| Health dashboard (installed version + service status) | Users expect one place to confirm things are running and versions are current. | Medium | Local state store, status probes, process/service checks | Dashboard UI shared; per-OS status probes behind adapter interfaces. |
| In-app update mechanism for app + managed components | Enterprise users expect updates without re-installing manually. | High | Signed release pipeline, updater integration, channel metadata | Adopt updater architecture that supports both macOS and Windows targets from day one. |
| Lightweight diagnostics export for IT support | Low-tech users need a "Send diagnostics" style flow when something breaks. | Low-Medium | Redacted log collection, system snapshot, export/share action | Keep diagnostic schema cross-platform; redact policy and collectors in shared core. |
| Minimal in-context help and definitions | Users need short task-focused help during setup and failure states. | Low | Copy system, contextual help triggers | Single copy system with OS-conditional snippets only when absolutely needed. |

## Differentiators (valuable, can be deferred)

These add meaningful enterprise value but can follow once the core install/manage flow is stable.

| Feature | Value Proposition | Complexity | Dependencies | Deferral rationale |
|---------|-------------------|------------|--------------|--------------------|
| Preflight "readiness score" before install | Gives users and IT an upfront pass/fail confidence check before any changes are made. | Medium | Existing prerequisite checks, scoring rules, recommendation copy | Ship after table-stakes checks are stable. |
| Bulk or scripted enrollment mode for IT | Allows IT to provision many machines with the same baseline config. | High | Policy profile format, non-interactive installer API, audit logs | High impact but not required for single-user v1 success. |
| Policy profiles (locked settings / managed mode) | Supports enterprise governance and reduces accidental misconfiguration. | High | Role model, config signing/validation, admin UX | Better as v1.1 once default UX is validated. |
| Release channels (stable/beta) per component | Gives controlled rollout options and safer adoption of new releases. | Medium-High | Update pipeline, channel metadata, rollback support | Depends on robust updater and rollback first. |
| Smart self-heal recommendations | Detects common issues and proposes one-click fixes. | High | Telemetry patterns, remediation scripts, confidence gating | Needs enough production issue data to tune safely. |
| Remote support handoff package | One-click support bundle with logs, config snapshot, and reproducible state summary. | Medium | Diagnostics export, redaction policy, secure sharing endpoint/process | Follows basic diagnostics export in v1. |
| Optional CLI parity layer | Enables advanced IT automation while keeping GUI-first UX for end users. | Medium | Core orchestration API, auth/permissions model | Defer to avoid expanding v1 surface area. |

## Anti-Features / Deliberate Exclusions

Features to explicitly avoid in macOS v1 to keep the product simple and reduce rework.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Full terminal emulator inside app | Increases complexity and cognitive load for low-tech users. | Provide guided "Advanced Troubleshooting" actions with copyable commands only when necessary. |
| Deep customization during first install | Too many early choices increase drop-off and errors. | Use safe defaults; move advanced options behind an "Advanced" gate post-install. |
| Mandatory account creation for local installs | Adds friction and support burden in enterprise environments. | Keep local-first flow; only require auth for optional org-managed features. |
| Real-time cloud dependency for basic operations | Makes installs brittle on restricted networks and violates low-effort goal. | Ensure core install/manage/status flows work offline after artifacts are available. |
| Multi-platform parity in v1 UI behavior edge cases | Slows shipping and risks over-engineering before adoption feedback. | Design shared architecture now, but optimize UX polish for macOS first. |
| Plugin marketplace in early versions | Expands attack surface and support matrix too early. | Keep a curated, signed built-in toolset. |
| Advanced observability dashboards for end users | Overwhelming for non-technical users and distracts from core tasks. | Offer simple health states (Good/Needs Attention) plus exportable diagnostics for IT. |

## Feature Dependencies

```
Shared orchestration core + OS adapter interfaces
  -> Guided setup wizard
  -> Prerequisite checks
  -> One-click install

Prerequisite checks
  -> One-click install
  -> Readiness score (differentiator)

One-click install + operation journal
  -> Retry/cancel/rollback
  -> Health dashboard
  -> Diagnostics export

Signed release pipeline + updater integration
  -> In-app updates
  -> Release channels (differentiator)

Diagnostics export + error taxonomy
  -> Remote support handoff (differentiator)
  -> Smart self-heal recommendations (differentiator)
```

## MVP Recommendation (macOS v1)

Prioritize:
1. Guided first-run setup wizard
2. Environment/prerequisite checks
3. One-click install + rollback + plain-language errors
4. Health dashboard and diagnostics export
5. In-app update mechanism (app + components)

Defer:
- Bulk enrollment, policy profiles, and release channels until v1 operational data confirms baseline workflow quality.

## Sources

- Electron process model docs (official): https://www.electronjs.org/docs/latest/tutorial/process-model (HIGH)
- Electron security checklist (official): https://www.electronjs.org/docs/latest/tutorial/security (HIGH)
- Electron updating apps (official): https://www.electronjs.org/docs/latest/tutorial/updates (HIGH)
- electron-builder auto-update guide: https://www.electron.build/auto-update (MEDIUM)
- electron-builder code signing notes: https://www.electron.build/code-signing (MEDIUM)
- NN/g usability heuristics (updated 2024): https://www.nngroup.com/articles/ten-usability-heuristics/ (MEDIUM)
- NN/g error-message guidelines (2023): https://www.nngroup.com/articles/error-message-guidelines/ (MEDIUM)
- Microsoft dialog control guidance (last updated 2026-02-25): https://learn.microsoft.com/en-us/windows/apps/design/controls/dialogs-and-flyouts/dialogs (HIGH)
