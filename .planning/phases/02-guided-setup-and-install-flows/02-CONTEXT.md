# Phase 2: Guided Setup and Install Flows - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

A low-technical user can complete first-run setup and installation from the app UI without terminal usage, with safe recovery when installation issues occur. This phase delivers the setup wizard, prerequisite checks, one-click install flow, progress display, and retry/cancel/rollback behavior.

</domain>

<decisions>
## Implementation Decisions

### Wizard UX
- **D-01:** Wizard opens with a friendly welcome screen showing setup overview before first step.
- **D-02:** Step indicator bar at top (1 > 2 > 3 > 4) with clickable navigation allowing back-jumps to completed steps.
- **D-03:** Animated transitions between wizard steps for polished feel.
- **D-04:** Blocking step model — user must complete current step before advancing.

### Prerequisite Checks
- **D-05:** Full prerequisite coverage: environment (Node.js version, Python, shell access), permissions (disk write, network), and disk space.
- **D-06:** Hard block with remediation — install button disabled until all checks pass, with clear fix instructions per failure.
- **D-07:** Checklist display with green/red icons per item plus overall status for quick visual scan.
- **D-08:** Automatic checks on wizard step entry with manual "Re-check" button.

### Install Progress
- **D-09:** Named steps with overall progress bar that reflect real install intent (e.g., "Installing OpenClaw... Step 1 of 5", then "Installing NemoClaw... Step 3 of 5").
- **D-10:** Raw log output hidden by default, expandable "Show details" panel for power users.
- **D-11:** Inline error display with plain-language explanation and expandable "What went wrong" technical details.
- **D-12:** Show estimated time remaining when determinable.

### Recovery Behavior
- **D-13:** Retry resumes from failed step — completed steps are skipped to save time.
- **D-14:** Cancel shows confirmation dialog summarizing what will be removed before cleanup.
- **D-15:** Full rollback to pre-install state on cancel or failure for clean recovery.
- **D-16:** Install state tracked in local DB — survives app restart for crash recovery.

### Agent's Discretion
- Specific animation timing and easing for step transitions.
- Exact prerequisite check order and grouping.
- Progress bar visual style and color scheme.
- Technical details format in expandable error panels.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and requirements
- `.planning/ROADMAP.md` — Phase 2 goal, dependencies, and success criteria.
- `.planning/REQUIREMENTS.md` — SETUP-01 through SETUP-05 requirement boundaries.
- `.planning/PROJECT.md` — Product constraints and low-tech enterprise user focus.

### Architecture foundations (from Phase 1)
- `.planning/phases/01-platform-core-and-safety-boundaries/01-CONTEXT.md` — Platform contracts, IPC safety patterns, process lifecycle.
- `src/shared/platform/contracts.ts` — Typed platform request/response/event shapes.

### Research guidance
- `.planning/research/ARCHITECTURE.md` — Layer boundaries, service contracts, OS abstraction.
- `.planning/research/STACK.md` — Runtime/process/storage package choices.

### Upstream product reference
- `.planning/references/phase-01-source-of-truth.md` — OpenClaw/NemoClaw installation behavior.

### Intent clarity
- OpenClaw is the primary assistant runtime being installed for user operations.
- NemoClaw is the secure execution layer that installs after OpenClaw and augments runtime safety.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/shared/platform/contracts.ts` — Typed platform contracts for process execution and path resolution.
- `src/main/platform/` — Main process platform service implementation.
- `src/shared/ipc/` — IPC channel definitions and typed contracts.

### Established Patterns
- Security-first Electron layering: renderer UX only, main process orchestration, typed preload bridge.
- Process execution through `runProcess()` / `stopProcess()` with correlation IDs and event streams.
- Privileged operations mediated via typed IPC channels.

### Integration Points
- Wizard UI will live in renderer, calling main process via preload bridge for install operations.
- Install operations will use Phase 1's centralized process runner and binary resolver.
- Prerequisite checks will use platform path service and process execution contracts.

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for wizard and install UX patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-guided-setup-and-install-flows*
*Context gathered: 2026-04-01*
