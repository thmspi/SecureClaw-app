# SecureClaw

## What This Is

SecureClaw is an Electron desktop app that simplifies installation and day-to-day management of OpenClaw and NemoClaw for enterprise users with low technical experience. OpenClaw is the assistant runtime users operate; NemoClaw is the NVIDIA secure execution stack that runs OpenClaw in a hardened sandbox model. The immediate target is a full macOS v1, while designing process execution, paths, and packaging layers so Windows support can be added with low rework. The product should make policy, skills, rules, agents, and MCP management simple and clear.

## Core Value

Enterprise low-tech users can install and manage OpenClaw and NemoClaw with minimal effort through a clear, reliable desktop experience.

## Requirements

### Validated

(None yet - ship to validate)

### Active

- [ ] Deliver full macOS v1 support for install, run session, stop session, and plugin execution flows.
- [ ] Implement a platform abstraction layer (`runProcess()`, `stopProcess()`, `getPaths()`) to keep Windows porting low effort.
- [ ] Avoid macOS-coupled implementation details by centralizing path handling, process spawning behavior, and binary resolution.

### Out of Scope

- Native Windows release in this first milestone - macOS-first delivery is prioritized for speed and clarity.
- Full production Windows hardening (code signing, Defender tuning, enterprise policy distribution) - deferred until after macOS v1 validation.

## Context

The app architecture is already mostly cross-platform: React UI, Electron runtime, SQLite persistence, and IPC patterns are portable. Primary compatibility risks are OS-specific path handling, CLI execution differences, process spawn behavior on Windows (`shell: true` cases), installer packaging target differences, binary distribution per OS, and secure secret storage differences. Estimated Windows effort after macOS v1 ranges from 1-3 days in best case to 1-2+ weeks if hidden macOS coupling remains.

## Constraints

- **Audience**: Enterprise low-tech users - workflows must be simple, explicit, and low-friction.
- **Delivery Order**: macOS first, Windows second - enables faster iteration and cleaner debugging.
- **Architecture**: Cross-platform-by-default abstractions - prevent path and process logic from spreading across the codebase.
- **Validation**: Functional parity checks across macOS and Windows for key flows - compatibility claims must be testable.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Ship full macOS v1 before Windows release | Fastest route to user value and stable baseline | - Pending |
| Build platform abstraction layer during macOS work | Reduces future Windows port cost and risk | - Pending |
| Treat Windows packaging and hardening as a follow-up phase | Keeps v1 focused while preserving clear expansion path | - Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check - still the right priority?
3. Audit Out of Scope - reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-31 after initialization*
