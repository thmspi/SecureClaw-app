# Phase 3: Managed Session and Plugin Runtime - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-02
**Phase:** 03-managed-session-and-plugin-runtime
**Areas discussed:** Session Control Model, Plugin Execution Model, Runtime UI Surface, Operation History Policy

---

## Session Control Model

| Option | Description | Selected |
|--------|-------------|----------|
| Single active managed session at a time | Simplest mental model for low-tech users | |
| Multiple concurrent sessions | More flexibility, higher state complexity | ✓ |
| Queued starts | One active, additional starts queued | |

**User's choice:** Multiple concurrent sessions  
**Notes:** User later clarified session should still be explicitly started by the user from the management page.

| Option | Description | Selected |
|--------|-------------|----------|
| Run lightweight preflight checks before start | Consistent with Phase 2 block/remediation pattern | ✓ |
| Start immediately, fail afterward | Faster entry, more runtime error exposure | |
| Quick-start toggle that skips checks | Advanced mode with extra risk | |

**User's choice:** Run lightweight preflight checks before start  
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Mark active on process spawn success | Fast feedback but may be premature | |
| Mark active on readiness confirmation | Avoid false active state during failed startup | ✓ |
| Two-stage state (Starting then Active) | More explicit transition model | |

**User's choice:** Mark active on readiness confirmation  
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| One-click stop + stopping state + auto escalation | Reuses existing graceful->force stop policy | ✓ |
| Always require stop confirmation dialog | Safer but slower | |
| Soft stop with separate force action | More explicit but more controls | |

**User's choice:** One-click stop + stopping state + auto escalation  
**Notes:** None

---

## Plugin Execution Model

| Option | Description | Selected |
|--------|-------------|----------|
| Plugins run only inside active session | Clear runtime linkage and troubleshooting context | ✓ |
| Plugins run with or without session | Flexible but ambiguity in runtime context | |
| Plugins run only outside sessions | Separate lane | |

**User's choice:** Plugins run only inside active session  
**Notes:** User explicitly stated "plugin run with sessions".

| Option | Description | Selected |
|--------|-------------|----------|
| One plugin run at a time (queue) | Simplest UX and control | |
| Parallel plugin runs with capped concurrency | Balanced throughput and control | ✓ |
| Unrestricted parallel plugin runs | High throughput, higher contention risk | |

**User's choice:** Parallel plugin runs with capped concurrency  
**Notes:** User asked for a practical cap that is "not too restricting".

| Option | Description | Selected |
|--------|-------------|----------|
| Lifecycle states as primary + optional percent | Clear status model | ✓ |
| Raw logs as primary | Better for advanced users | |
| Final status only | Minimal UX detail | |

**User's choice:** Lifecycle states primary + logs available  
**Notes:** User selected state-based status and asked to keep raw logs available as optional detail.

| Option | Description | Selected |
|--------|-------------|----------|
| Manual retry from scratch with history preserved | Explicit operator control | ✓ |
| Automatic retries before fail | Convenience, less explicit | |
| No retry action | Minimal controls | |

**User's choice:** Manual retry with preserved history  
**Notes:** None

---

## Runtime UI Surface

| Option | Description | Selected |
|--------|-------------|----------|
| Land on Management page when runtime prerequisites are satisfied | Matches explicit runtime operations flow | ✓ |
| Keep wizard as default entry | Reuses onboarding shell | |
| Remember last visited page | Adaptive routing | |

**User's choice:** Land on Management page  
**Notes:** User clarified this should happen when OpenClaw + NemoClaw are installed and Docker daemon is available.

| Option | Description | Selected |
|--------|-------------|----------|
| Single management page with sections | Session control + plugins + history on one page | ✓ |
| Tabbed management view | Separate concerns by tab | |
| Two-column dashboard | Controls + live feed layout | |

**User's choice:** Single management page with sections  
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Show Start Session CTA and disable plugin runs with clear reason | Explicit state guidance | ✓ |
| Allow queueing/plugin prep without session | More flexibility | |
| Hide plugin area until active session | Minimal UI when inactive | |

**User's choice:** Start CTA + disabled plugin actions with reason  
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Top-right action cluster is Start/Stop only in Phase 3 | Keeps scope tight | ✓ |
| Start/Stop + read-only placeholders for advanced managers | Teases future capabilities | |
| Full advanced menus in Phase 3 | Scope expansion | |

**User's choice:** Top-right action cluster is Start/Stop only in Phase 3  
**Notes:** None

---

## Operation History Policy

| Option | Description | Selected |
|--------|-------------|----------|
| Session start/stop + plugin runs only | Scope aligned with Phase 3 runtime operations | ✓ |
| Include install and prerequisite actions too | Broader timeline | |
| Session lifecycle only | Narrow history scope | |

**User's choice:** Session start/stop + plugin runs only  
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Summary rows + expandable details | Balanced clarity and depth | ✓ |
| Full raw logs inline in table | Very detailed, potentially noisy | |
| Minimal status only | Lowest detail | |

**User's choice:** Summary rows + expandable details  
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Keep last 30 days | Smaller history footprint | |
| Keep last 90 days | Better troubleshooting window | ✓ |
| Keep indefinitely | Maximum traceability | |

**User's choice:** Keep last 90 days  
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Basic type/status/date filters in Phase 3 | Core troubleshooting needs | ✓ |
| No filters in Phase 3 | Lowest implementation scope | |
| Advanced query builder in Phase 3 | Scope-heavy | |

**User's choice:** Basic type/status/date filters  
**Notes:** None

---

## the agent's Discretion

- Exact numeric cap for parallel plugin execution.
- Technical readiness-confirmation mechanism used before marking session active.
- Detailed information architecture and visual hierarchy inside the management page sections.
- Additional history payload fields beyond the locked minimum scope.

## Deferred Ideas

- Runtime policy selection and policy editing flows (YAML and permission-editor UX variants).
- Plugin manager CRUD surface.
- Skill manager CRUD surface.
- MCP server manager CRUD surface.
