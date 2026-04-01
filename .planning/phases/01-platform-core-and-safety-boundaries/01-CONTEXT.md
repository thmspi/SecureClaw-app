# Phase 1: Platform Core and Safety Boundaries - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

SecureClaw delivers a centralized platform foundation for process execution, process stopping, path resolution, binary resolution, and privileged-operation safety via typed IPC. This phase defines the authoritative contracts and enforcement boundaries for macOS-first execution while keeping Windows support low rework.

</domain>

<decisions>
## Implementation Decisions

### Platform API shape
- **D-01:** The source of truth for platform contracts is a single shared TypeScript contract module consumed by preload, main, and service layers.
- **D-02:** Public platform surface remains the minimal stable trio (`runProcess()`, `stopProcess()`, `getPaths()`) with typed options and version-safe extensibility.

### Process lifecycle policy
- **D-03:** Stop semantics are enforced as graceful shutdown first, then timeout escalation, then forced termination.
- **D-04:** Runtime behavior is represented as a structured event stream (spawned/stdout/stderr/stopping/exited/error/timeout) keyed by correlation IDs.

### Binary resolution strategy
- **D-05:** Resolver lookup precedence is fixed to configured path, then bundled binaries, then system PATH, then managed cache.
- **D-06:** Resolver verification returns a structured health result (resolved path, version, executable check, failure reason, remediation hint).

### IPC boundary strictness
- **D-07:** Privileged IPC uses versioned typed channels with runtime schema validation.
- **D-08:** Renderer has no direct privileged access; privileged operations are only available through narrow preload APIs.

### the agent's Discretion
- Internal type naming conventions and file/module layout for contracts.
- Exact timeout defaults per operation category, as long as escalation policy is preserved.
- Event payload field granularity beyond required lifecycle states and correlation IDs.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and requirements
- `.planning/ROADMAP.md` - Phase 1 goal, dependencies, and success criteria.
- `.planning/REQUIREMENTS.md` - PLAT-01, PLAT-02, PLAT-03, PLAT-04, SEC-02 requirement boundaries.
- `.planning/PROJECT.md` - Product constraints and macOS-first, Windows-ready architecture intent.

### Architecture and stack guidance
- `.planning/research/ARCHITECTURE.md` - Recommended layer boundaries, service contracts, and OS abstraction guidance.
- `.planning/research/STACK.md` - Recommended runtime/process/storage/security package choices and constraints.
- `.planning/research/SUMMARY.md` - Consolidated risks, sequencing rationale, and delivery constraints.

### Upstream product source of truth
- `.planning/references/phase-01-source-of-truth.md` - Canonical upstream references for OpenClaw/NemoClaw installation and management behavior.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- No application source modules exist yet in this repository; phase planning should produce initial platform/core modules.
- Existing planning artifacts in `.planning/research/` provide reusable architectural contracts and recommended adapter structure.

### Established Patterns
- Security-first Electron layering is established in research docs: renderer UX only, main process orchestration, typed preload bridge.
- Cross-platform abstraction-by-default is established: central path/process/binary services with darwin/win32 adapters.
- Centralized privileged action routing via typed IPC is established as a non-negotiable safety pattern.

### Integration Points
- Phase 1 outputs should define contracts consumed later by setup/install (Phase 2) and runtime operations (Phase 3).
- Requirements traceability remains anchored through `.planning/REQUIREMENTS.md` and `.planning/ROADMAP.md`.

</code_context>

<specifics>
## Specific Ideas

- User explicitly defined upstream source of truth for implementing basic installation and management capabilities (NemoClaw policy, skills, plugins, agents, MCP):
  - https://github.com/openclaw/openclaw
  - https://github.com/NVIDIA/NemoClaw
  - https://openclaw.ai/
- These references must be consulted during research/planning before implementation details are finalized.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope.

</deferred>

---

*Phase: 01-platform-core-and-safety-boundaries*
*Context gathered: 2026-04-01*
