# Roadmap: SecureClaw

## Overview

SecureClaw v1 delivers a complete macOS-first desktop experience for low-technical enterprise users to install, run, stop, and diagnose OpenClaw and NemoClaw, while keeping execution, path, and binary behavior centralized so Windows support can be added with minimal rework. OpenClaw is the assistant runtime users operate; NemoClaw provides hardened, sandboxed execution for OpenClaw on supported environments.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Platform Core and Safety Boundaries** - Centralize process/path/binary and IPC safety foundations for macOS-first, Windows-ready behavior.
- [ ] **Phase 2: Guided Setup and Install Flows** - Deliver no-terminal onboarding with prerequisite checks and resilient install lifecycle.
- [x] **Phase 3: Managed Session and Plugin Runtime** - Deliver day-to-day start/stop/plugin operations with persistent runtime history.
- [ ] **Phase 4: Diagnostics, Security Storage, and macOS Distribution Baseline** - Deliver support clarity, health visibility, secure local secret handling, and signed macOS packaging.
- [ ] **Phase 5: Configuration Tab Editors (NemoClaw Policy + OpenClaw Skills/Rules)** - Deliver dual-mode configuration management (visual + raw) for sandbox policy, skills, and agent rules.
- [ ] **Phase 6: Visually Impacting Landing Page** - Deliver a polished, conversion-focused landing experience for SecureClaw.

## Phase Details

### Phase 1: Platform Core and Safety Boundaries
**Goal**: SecureClaw uses one centralized platform layer for process execution, stopping, path resolution, and binary resolution, with privileged operations only accessible through typed IPC.
**Depends on**: Nothing (first phase)
**Requirements**: PLAT-01, PLAT-02, PLAT-03, PLAT-04, SEC-02
**Success Criteria** (what must be TRUE):
  1. Process-based operations are executed and stopped through a single managed runtime path with timeout and cancellation behavior.
  2. App data paths and CLI binary locations resolve correctly from Electron app APIs without hardcoded OS paths.
  3. Platform-specific binary naming (including Windows-style suffix handling) resolves through one shared resolver interface.
  4. Privileged filesystem/process operations are only invoked through typed IPC contracts and not directly from renderer code.
**Plans**: 3 plans
Plans:
- [x] 01-01-PLAN.md - Define shared platform contracts and typed IPC safety boundary.
- [ ] 01-02-PLAN.md - Implement Electron API based path service and shared binary resolver.
- [ ] 01-03-PLAN.md - Deliver centralized process runner lifecycle and IPC runtime wiring.

### Phase 2: Guided Setup and Install Flows
**Goal**: A low-technical user can complete first-run setup and installation from the app UI without terminal usage, with safe recovery when installation issues occur.
**Depends on**: Phase 1
**Requirements**: SETUP-01, SETUP-02, SETUP-03, SETUP-04, SETUP-05
**Success Criteria** (what must be TRUE):
  1. User can complete a guided first-run setup wizard end-to-end without entering terminal commands.
  2. Prerequisite checks run before install and clearly block install when environment requirements are missing.
  3. User can run one-click installation from the app with explicit sequential flow (OpenClaw first, then NemoClaw) and see live step-by-step progress.
  4. User can retry, cancel, or rollback failed/incomplete installs and return to a safe, known state.
**Plans**: 3 plans
Plans:
- [ ] 02-01-PLAN.md — Install contracts, prerequisite service, and SQLite state persistence
- [ ] 02-02-PLAN.md — Wizard UI shell with zustand store and animated step components
- [ ] 02-03-PLAN.md — Install orchestrator, IPC integration, and rollback service
**UI hint**: yes

### Phase 3: Managed Session and Plugin Runtime
**Goal**: User can run day-to-day managed operations from the app, including session start/stop and plugin execution, with persistent runtime records.
**Depends on**: Phase 2
**Requirements**: RUN-01, RUN-02, RUN-03, RUN-04
**Success Criteria** (what must be TRUE):
  1. User can start a managed session from the app and see when the session becomes active.
  2. User can stop an active session from the app and see confirmed shutdown state.
  3. User can trigger plugin execution from the app and monitor progress and completion status.
  4. Runtime operation history persists locally and remains available for troubleshooting after app restart.
**Plans**: 4 plans
Plans:
- [x] 03-01-PLAN.md — Session lifecycle foundation with state machine and runtime history persistence
- [x] 03-02-PLAN.md — Plugin execution engine with capped concurrency queue
- [x] 03-03-PLAN.md — Runtime IPC routing and Management store integration
- [x] 03-04-PLAN.md — Management page UI with session control, plugin runs, and history
**UI hint**: yes

### Phase 4: Diagnostics, Security Storage, and macOS Distribution Baseline
**Goal**: User and IT support can quickly understand failures, verify health, and safely distribute SecureClaw in enterprise macOS environments.
**Depends on**: Phase 3
**Requirements**: DIAG-01, DIAG-02, DIAG-03, SEC-01, SEC-03
**Success Criteria** (what must be TRUE):
  1. Errors are presented in plain language with clear next actions users can follow.
  2. User can view a health dashboard that shows install/runtime state and key component versions.
  3. User can export a redacted diagnostics bundle suitable for IT or support handoff.
  4. Sensitive local credentials are stored through OS-backed secure storage abstractions rather than plain local files.
  5. macOS build is packaged and signed to meet enterprise-safe distribution baseline checks.
**Plans**: 5 plans
Plans:
- [x] 04-01-PLAN.md — Define diagnostics and secure secret storage contracts/channels.
- [x] 04-02-PLAN.md — Implement diagnostics backend (health snapshot, redacted ZIP export, diagnostics IPC).
- [x] 04-03-PLAN.md — Implement safeStorage-based secret store, security IPC, and uninstall/reset cleanup.
- [x] 04-04-PLAN.md — Wire diagnostics/security into preload/main and deliver Settings health + inline remediation UX.
- [x] 04-05-PLAN.md — Configure macOS signed dmg/zip distribution with notarization and verification gates.
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 1.1 -> 2 -> 2.1 -> 3 -> 3.1 -> 4 -> 5 -> 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Platform Core and Safety Boundaries | 0/3 | Not started | - |
| 2. Guided Setup and Install Flows | 0/TBD | Not started | - |
| 3. Managed Session and Plugin Runtime | 4/4 | Complete | 2026-04-03 |
| 4. Diagnostics, Security Storage, and macOS Distribution Baseline | 2/5 | In Progress | - |
| 5. Configuration Tab Editors (NemoClaw Policy + OpenClaw Skills/Rules) | 0/4 | Planned | - |

### Phase 5: I need to populate my configuration tab with multiple things : 1) Nemoclaw sand box policy, with a visual editor and the direct yaml editor 2) Available skills (visual editor and markdown editor) 3) Exact same for agent, rules, ... for openclaw llm

**Goal:** User can configure NemoClaw sandbox policy, OpenClaw available skills, and OpenClaw agent rules directly in SecureClaw using either visual editors or raw text editors with safe validation/apply workflows.
**Requirements**: CFG-01, CFG-02, CFG-03, CFG-04
**Depends on:** Phase 4
**Plans:** 4 plans

Plans:
- [x] 05-01-PLAN.md — Establish configuration contracts, IPC channels, router wiring, and preload bridge foundation.
- [ ] 05-02-PLAN.md — Implement NemoClaw sandbox policy YAML adapter with static/dynamic apply semantics.
- [ ] 05-03-PLAN.md — Implement OpenClaw skills and agent-rules markdown/frontmatter adapter.
- [ ] 05-04-PLAN.md — Deliver Configuration tab store/UI with visual + raw editors and validate/save/apply actions.

### Phase 6: Create a visually impacting and selling landing page

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 5
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 6 to break down)
