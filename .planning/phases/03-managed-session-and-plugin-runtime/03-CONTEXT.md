# Phase 3: Managed Session and Plugin Runtime - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

User can run day-to-day managed operations from the app: start/stop managed sessions, trigger plugin execution, and review persistent runtime operation history after restart. In this phase, "plugin execution" means invoking already-available OpenClaw plugin actions from SecureClaw during an active managed runtime session. This phase defines runtime operations UX/behavior, not advanced policy/skills/MCP management capabilities.

</domain>

<decisions>
## Implementation Decisions

### Session Control Lifecycle
- **D-01:** Session does not auto-start at app launch.
- **D-02:** If OpenClaw and NemoClaw are installed and Docker daemon is available, app lands on the Management page.
- **D-03:** Multiple concurrent managed sessions are allowed.
- **D-04:** Session start runs lightweight preflight checks before launch attempt.
- **D-05:** Session becomes `Active` only after explicit readiness confirmation (not just process spawn).
- **D-06:** Stop interaction is one-click, shows a stopping state, and uses existing graceful-to-force escalation policy.

### Plugin Execution
- **D-07:** Plugin runs are only allowed when a managed session is active, and "plugin run" specifically means executing an existing OpenClaw plugin action (not creating/editing plugin definitions).
- **D-08:** Plugin runs can execute in parallel with a capped concurrency limit.
- **D-09:** Plugin progress uses lifecycle states (`Queued`, `Starting`, `Running`, `Completed`, `Failed`) as primary UI, with log detail available.
- **D-10:** Plugin failures support manual retry from scratch while preserving history records.

### Runtime Management UI
- **D-11:** Post-install runtime entry is the Management page (when runtime prerequisites are satisfied), not an auto-started session flow.
- **D-12:** Phase 3 management UI is a single page with sections for Session Control, Plugin Runs, and Operation History.
- **D-13:** With no active session, UI shows a clear `Start Session` CTA and disables plugin run actions with explicit reason text.
- **D-14:** Top-right action cluster in Phase 3 is `Start/Stop Session` only.

### Operation History
- **D-15:** Persist history for session start/stop and plugin execution operations only.
- **D-16:** History list shows summary rows with expandable details.
- **D-17:** Retention target is last 90 days.
- **D-18:** Phase 3 includes basic filters by operation type, status, and date.

### Agent's Discretion
- Exact capped concurrency value for parallel plugin runs.
- Exact readiness signal mechanics (health probe, event handshake, or equivalent) as long as activation waits for readiness confirmation.
- Final visual design and layout details of the Management page sections.
- History row schema details beyond required fields for troubleshooting.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and requirements
- `.planning/ROADMAP.md` - Phase 3 goal, dependency chain, and success criteria.
- `.planning/REQUIREMENTS.md` - RUN-01, RUN-02, RUN-03, RUN-04 requirement boundaries.
- `.planning/PROJECT.md` - Low-tech enterprise user constraints and macOS-first product intent.

### Prior phase decisions that constrain Phase 3
- `.planning/phases/01-platform-core-and-safety-boundaries/01-CONTEXT.md` - Platform API, process lifecycle escalation, and IPC boundary decisions.
- `.planning/phases/02-guided-setup-and-install-flows/02-CONTEXT.md` - Blocking preflight/remediation pattern and persisted operation-state precedent.

### Existing implementation contracts and runtime patterns
- `src/shared/platform/contracts.ts` - Shared process event/request/response contract shapes.
- `src/shared/ipc/platform-channels.ts` - Versioned typed IPC channels and validation schemas.
- `src/main/runtime/process-runner.ts` - Active process registry and stop escalation behavior.
- `src/main/runtime/runtime-service.ts` - Runtime facade that maps request contracts to process operations.
- `src/main/ipc/platform-router.ts` - Typed IPC routing and schema enforcement pattern.
- `src/preload/platform-api.ts` - Renderer-safe narrow bridge exposure pattern.
- `src/main/install/install-state-service.ts` - Existing local SQLite persistence pattern for operation continuity.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/main/runtime/process-runner.ts`: Already provides correlation-based process lifecycle events and stop semantics for runtime control.
- `src/main/runtime/runtime-service.ts`: Existing service facade pattern for exposing controlled runtime operations.
- `src/shared/platform/contracts.ts`: Shared contract model can be extended for session/plugin/history operations.
- `src/shared/ipc/platform-channels.ts`: Versioned channel + zod validation pattern reusable for new runtime channels.
- `src/main/install/install-state-service.ts`: Local SQLite state persistence pattern reusable for runtime history storage.
- `src/renderer/stores/wizard-store.ts`: Existing zustand + persist approach for renderer-level state handling.

### Established Patterns
- Privileged operations are mediated through typed IPC routes; renderer has no direct privileged access.
- Runtime operations rely on correlation IDs plus structured lifecycle event reporting.
- Operational continuity favors persisted local state with crash/restart tolerance.

### Integration Points
- Add runtime-specific IPC channels/routers analogous to existing platform/install routers.
- Extend preload bridge with runtime/session/plugin/history APIs (narrow and typed).
- Add renderer management page entrypoint and state flow that switches from install completion to daily runtime operations.
- Persist runtime operation history in local storage (likely SQLite) and expose query/filter endpoints for renderer history UI.

</code_context>

<specifics>
## Specific Ideas

- Management page should have a top-right `Start Session` action.
- Session should be started explicitly by user action, not automatically on launch.
- User wants eventual runtime policy selection for OpenClaw and a policy editing flow (YAML and/or permission-editor UX variants), but this is deferred outside Phase 3 scope.

</specifics>

<deferred>
## Deferred Ideas

- Runtime policy manager with YAML editor and permission-editor UX for OpenClaw policy control.
- Plugin manager CRUD surface (list/select/inspect/update plugin definitions).
- Skill manager CRUD surface (list/select/inspect/update skill definitions).
- MCP server manager CRUD surface (list/select/inspect/update server definitions).

</deferred>

---

*Phase: 03-managed-session-and-plugin-runtime*
*Context gathered: 2026-04-02*
