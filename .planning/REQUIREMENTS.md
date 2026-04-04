# Requirements: SecureClaw

**Defined:** 2026-03-31
**Core Value:** Enterprise low-tech users can install and manage OpenClaw and NemoClaw with minimal effort through a clear, reliable desktop experience.

## v1 Requirements

Requirements for initial macOS release with Windows compatibility built into architecture.

### Platform Core

- [ ] **PLAT-01**: App exposes a centralized platform abstraction layer with `runProcess()`, `stopProcess()`, and `getPaths()`.
- [ ] **PLAT-02**: All app data and binary paths are resolved through Electron app path APIs (no hardcoded OS paths).
- [ ] **PLAT-03**: CLI binary resolution supports platform-specific naming (for example `.exe` on Windows) via a single resolver service.
- [ ] **PLAT-04**: Process execution uses a centralized runner with platform-aware spawn behavior and timeout/cancellation handling.

### Setup and Install

- [ ] **SETUP-01**: User can complete a guided first-run setup wizard without using terminal commands.
- [ ] **SETUP-02**: App performs prerequisite checks (environment, permissions, required dependencies) before installation.
- [ ] **SETUP-03**: User can run one-click install flow for OpenClaw and NemoClaw.
- [ ] **SETUP-04**: Install flow displays step-by-step progress and current state.
- [ ] **SETUP-05**: Install flow supports retry/cancel/rollback with safe recovery behavior.

### Session and Runtime

- [x] **RUN-01**: User can start a managed session from the app.
- [x] **RUN-02**: User can stop an active managed session from the app.
- [x] **RUN-03**: Plugin execution can be triggered and monitored from the app.
- [x] **RUN-04**: Runtime operations are persisted in a local operation history for troubleshooting.

### User Clarity and Diagnostics

- [x] **DIAG-01**: Errors are shown in plain language with clear next-step actions.
- [x] **DIAG-02**: App provides a health dashboard with install/runtime status and component versions.
- [x] **DIAG-03**: User can export a redacted diagnostics bundle for IT/support.

### Security and Reliability

- [x] **SEC-01**: Sensitive local credentials/secrets are stored using OS-backed secure storage abstractions.
- [ ] **SEC-02**: Renderer process has no direct privileged system access; all privileged actions are mediated via typed IPC.
- [x] **SEC-03**: macOS packaged app supports signed distribution for enterprise-safe deployment baseline.

### Configuration Authoring

- [ ] **CFG-01**: Configuration tab exposes editable surfaces for NemoClaw sandbox policy, OpenClaw skills, and OpenClaw agent rules.
- [ ] **CFG-02**: Each configuration surface supports both a visual editor and a raw text editor mode.
- [ ] **CFG-03**: Configuration reads/writes/validation/apply flows execute through typed IPC contracts with parser-based validation.
- [ ] **CFG-04**: Configuration UI surfaces explicit unavailable-state guidance when required CLIs or workspace paths are missing.

## v2 Requirements

Deferred to future release (after macOS v1 validation).

### Windows Release

- **WIN-01**: Windows packaged installer (`nsis` or equivalent) supports install/update/uninstall lifecycle.
- **WIN-02**: Core flows (install, run session, stop session, plugin execution) achieve behavior parity on Windows.
- **WIN-03**: Windows trust-chain hardening (signing and Defender/SmartScreen readiness) is validated for enterprise environments.

### Enterprise Differentiators

- **ENT-01**: IT bulk enrollment mode for provisioning multiple endpoints.
- **ENT-02**: Policy profiles for managed mode and restricted operations.
- **ENT-03**: Release channel management (stable/beta) for controlled rollout.
- **ENT-04**: Smart self-heal recommendations based on common failure signatures.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Native Windows GA in v1 | macOS-first delivery is prioritized for speed and lower complexity. |
| Full in-app terminal emulator | Contradicts low-tech simplicity goal and increases support burden. |
| Plugin marketplace in v1 | Expands security/support surface too early. |
| Mandatory cloud account for core flows | Adds friction; core operations should work locally. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PLAT-01 | Phase 1 | Pending |
| PLAT-02 | Phase 1 | Pending |
| PLAT-03 | Phase 1 | Pending |
| PLAT-04 | Phase 1 | Pending |
| SETUP-01 | Phase 2 | Pending |
| SETUP-02 | Phase 2 | Pending |
| SETUP-03 | Phase 2 | Pending |
| SETUP-04 | Phase 2 | Pending |
| SETUP-05 | Phase 2 | Pending |
| RUN-01 | Phase 3 | Complete |
| RUN-02 | Phase 3 | Complete |
| RUN-03 | Phase 3 | Complete |
| RUN-04 | Phase 3 | Complete |
| DIAG-01 | Phase 4 | Complete |
| DIAG-02 | Phase 4 | Complete |
| DIAG-03 | Phase 4 | Complete |
| SEC-01 | Phase 4 | Complete |
| SEC-02 | Phase 1 | Pending |
| SEC-03 | Phase 4 | Complete |
| CFG-01 | Phase 5 | Pending |
| CFG-02 | Phase 5 | Pending |
| CFG-03 | Phase 5 | Pending |
| CFG-04 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0

---
*Requirements defined: 2026-03-31*
*Last updated: 2026-03-31 after roadmap creation*
