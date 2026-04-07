# Phase 2: Guided Setup and Install Flows - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-01
**Phase:** 02-guided-setup-and-install-flows
**Areas discussed:** Wizard UX, Prerequisite Checks, Install Progress, Recovery Behavior

---

## Wizard UX

| Option | Description | Selected |
|--------|-------------|----------|
| Friendly welcome screen with setup overview first | Reassures low-tech users | ✓ |
| Jump straight into first setup step | Faster for confident users | |
| Single-page form showing all steps at once | Minimal clicks | |

**User's choice:** Friendly welcome screen with setup overview first
**Notes:** Recommended for low-tech enterprise users.

| Option | Description | Selected |
|--------|-------------|----------|
| Step indicator bar at top (1 > 2 > 3 > 4) with clickable navigation | Clear progress, allows back-jumps | ✓ |
| Linear Next/Back only — no step indicator visible | | |
| Sidebar with step list — shows all steps with current highlighted | | |

**User's choice:** Step indicator bar at top with clickable navigation
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Show animated transition between steps | Polished feel, indicates change | ✓ |
| Instant switch, no animation | Faster, simpler | |
| You decide | | |

**User's choice:** Animated transitions
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Blocking — user must complete step before advancing | Ensures clean state | ✓ |
| Non-blocking — allow skip with warning | | |
| Mixed — some steps required, some optional | | |

**User's choice:** Blocking steps
**Notes:** Ensures clean install state.

---

## Prerequisite Checks

| Option | Description | Selected |
|--------|-------------|----------|
| Environment (Node.js, Python, shell), permissions (disk, network), disk space | Full coverage | ✓ |
| Environment and permissions only — skip disk space | | |
| Minimal — only strictly required checks | | |
| You decide based on requirements | | |

**User's choice:** Full prerequisite coverage
**Notes:** Environment, permissions, and disk space.

| Option | Description | Selected |
|--------|-------------|----------|
| Hard block — install disabled until all checks pass | Prevents confusing failures | |
| Soft warning — show warnings but allow proceed | | |
| Mixed — some hard blocks, some soft warnings | | |

**User's choice:** Hard block with remediation (freeform)
**Notes:** User specified remediation hints should accompany blocks.

| Option | Description | Selected |
|--------|-------------|----------|
| Checklist with green/red icons per item + overall status | Clear visual scan | ✓ |
| Summary card — "3 of 5 checks passed" with expandable details | | |
| Plain list of pass/fail messages | | |

**User's choice:** Checklist with icons and overall status
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Automatic on wizard step entry + manual "Re-check" button | | ✓ |
| Manual only — user clicks to run checks | | |
| Automatic only — no manual re-check option | | |

**User's choice:** Automatic with manual re-check
**Notes:** None

---

## Install Progress

| Option | Description | Selected |
|--------|-------------|----------|
| Named steps + overall progress bar (e.g., "Downloading OpenClaw... Step 2 of 5") | | ✓ |
| Overall progress bar only — no step labels | | |
| Detailed log stream with progress bar — shows all install output | | |

**User's choice:** Named steps with overall progress bar
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Hidden by default, expandable "Show details" panel | Clean look, power users can expand | ✓ |
| Always visible in collapsible log area | | |
| No log output shown — progress bar only | | |

**User's choice:** Hidden log with expandable details
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Inline error with plain-language explanation + "What went wrong" expandable | | ✓ |
| Modal dialog interrupting the flow | | |
| Error replaces progress UI entirely | | |

**User's choice:** Inline error with expandable explanation
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Show estimated time remaining if determinable | | ✓ |
| No time estimates — just progress percentage | | |
| You decide | | |

**User's choice:** Show time estimates when possible
**Notes:** None

---

## Recovery Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Resume from failed step — skip completed steps | Saves time | ✓ |
| Full restart — always start from beginning | | |
| User choice — offer both options | | |

**User's choice:** Resume from failed step
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Show confirmation dialog with "what will be removed" summary | Avoids accidental data loss | ✓ |
| Immediate cancel with cleanup, no confirmation | | |
| Cancel pauses — user can resume later | | |

**User's choice:** Confirmation dialog with cleanup summary
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Full rollback to pre-install state | Clean recovery | ✓ |
| Partial cleanup — remove failed component only | | |
| No automatic cleanup — user manages manually | | |

**User's choice:** Full rollback to pre-install state
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Track install state in local DB — survives app restart | | ✓ |
| In-memory only — lost if app crashes | | |
| File-based checkpoint — simple but less reliable | | |

**User's choice:** Persisted install state in local DB
**Notes:** Enables crash recovery.

---

## Agent's Discretion

- Specific animation timing and easing for step transitions
- Exact prerequisite check order and grouping
- Progress bar visual style and color scheme
- Technical details format in expandable error panels

## Deferred Ideas

None — discussion stayed within phase scope.
