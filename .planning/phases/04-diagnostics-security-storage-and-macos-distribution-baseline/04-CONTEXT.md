# Phase 4: Diagnostics, Security Storage, and macOS Distribution Baseline - Context

**Gathered:** 2026-04-03
**Status:** Ready for planning

<domain>
## Phase Boundary

User and IT support can quickly understand failures, verify health, export safe diagnostics, and distribute SecureClaw as a signed/notarized macOS app. This phase adds support-facing diagnostics surfaces, secure secret handling, and enterprise distribution baseline checks; it does not add unrelated runtime capabilities.

</domain>

<decisions>
## Implementation Decisions

### Error UX and Remediation
- **D-01:** Runtime and management errors are shown inline in the affected section rather than as toast-only or modal-only flows.
- **D-02:** Error copy uses plain language with explicit "what happened" and "what to do next" guidance.
- **D-03:** `Retry` actions are shown only when the failure is retryable; non-retryable architecture/configuration issues must not show misleading retry actions.
- **D-04:** Technical details are available but collapsed by default behind an expandable affordance.

### Health Dashboard Scope
- **D-05:** Health dashboard is delivered under the Settings area.
- **D-06:** v1 health includes install status, runtime session status, plugin subsystem status, and component versions (`app`, `openclaw`, `nemoclaw`, `docker`).
- **D-07:** Overall health uses a worst-of severity model (`Healthy`, `Warning`, `Critical`) alongside per-component status badges.
- **D-08:** Health data auto-refreshes (about every 10 seconds) and also supports manual refresh.

### Diagnostics Bundle and Redaction
- **D-09:** Diagnostics export format is a single ZIP bundle for support handoff.
- **D-10:** Bundle includes app/runtime/install logs, health snapshot, component versions, and recent operation history.
- **D-11:** Export applies automatic redaction for secrets/tokens/paths/user identifiers and includes a summary of redacted fields.
- **D-12:** Export action is placed in `Settings > Health`.

### Secure Secret Storage Contract
- **D-13:** Only sensitive credentials/tokens are stored in OS-backed secure storage; non-secret settings remain in existing stores.
- **D-14:** Secure storage is exposed through a main-process service with narrow typed IPC methods (set/get/delete by scoped key).
- **D-15:** If secure storage is unavailable (locked keychain/permissions), secret-dependent actions are blocked with plain-language remediation and diagnostics guidance.
- **D-16:** Secret keys are namespaced, rotate on overwrite, and are explicitly deleted on uninstall/reset flows.

### macOS Distribution Baseline
- **D-17:** Phase 4 distribution artifacts are signed `.dmg` plus `.zip`.
- **D-18:** Signing scope includes app bundle plus embedded binaries/frameworks with hardened runtime and required entitlements.
- **D-19:** Release flow includes notarization and stapling.
- **D-20:** Phase gate includes automated checks for `codesign --verify`, Gatekeeper assessment, and app launch smoke test.

### Agent's Discretion
- Exact retryability classification rules as long as non-retryable failures do not expose `Retry`.
- Exact health refresh interval tuning around the ~10s target and UI presentation details.
- Concrete redaction matcher implementation as long as required secret/path/identifier classes are scrubbed and summarized.
- CI/release task wiring for signing/notarization/check gates.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and requirement boundaries
- `.planning/ROADMAP.md` - Phase 4 goal, dependency chain, and success criteria.
- `.planning/REQUIREMENTS.md` - DIAG-01, DIAG-02, DIAG-03, SEC-01, SEC-03 requirement boundaries.
- `.planning/PROJECT.md` - macOS-first enterprise constraints and supportability goals.

### Prior phase decisions and constraints
- `.planning/phases/01-platform-core-and-safety-boundaries/01-CONTEXT.md` - typed IPC boundary and centralized privileged execution constraints.
- `.planning/phases/03-managed-session-and-plugin-runtime/03-CONTEXT.md` - management/runtime UX baseline and persisted runtime-history expectations.
- `.planning/phases/03-managed-session-and-plugin-runtime/03-04-SUMMARY.md` - current management shell baseline feeding Phase 4 diagnostics/security work.

### Existing implementation contracts and integration points
- `src/preload/platform-api.ts` - current narrow preload surface and event subscription patterns.
- `src/shared/ipc/runtime-channels.ts` - versioned runtime IPC channel + zod schema pattern.
- `src/shared/runtime/runtime-contracts.ts` - runtime/session/history contract shapes and status enums.
- `src/main/ipc/runtime-router.ts` - runtime handler registration, history persistence touchpoints, renderer event forwarding.
- `src/main/runtime/runtime-history-service.ts` - SQLite history schema/indexing and retention behavior.
- `src/main/install/install-orchestrator.ts` - install error/progress events and persisted install-state lifecycle.
- `src/renderer/components/wizard/ErrorPanel.tsx` - existing plain-language + collapsible technical-details error UX pattern.
- `src/renderer/pages/management/ManagementPage.tsx` - current management/settings navigation shell where health UI attaches.
- `src/renderer/pages/management/SettingsPanel.tsx` - current settings section and destructive-action confirmation patterns.
- `package.json` - electron-builder tooling and build script baseline for signing/notarization pipeline work.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/renderer/components/wizard/ErrorPanel.tsx`: already implements plain-language error messaging with optional expandable details and retry/cancel actions.
- `src/main/runtime/runtime-history-service.ts`: persisted local history table/indexes provides diagnostics export source data.
- `src/main/install/install-orchestrator.ts`: emits install progress/error events and stores failure details usable for diagnostics and health summaries.
- `src/renderer/pages/management/SettingsPanel.tsx`: existing Settings surface is ready for adding health cards and diagnostics export actions.

### Established Patterns
- Privileged behavior is mediated through typed/versioned IPC (`runtime-channels`, `runtime-router`, preload bridge), not renderer-direct system calls.
- Local operational persistence uses `better-sqlite3` in `secureclaw.db` with WAL mode.
- Error propagation currently passes structured `error` fields through IPC responses and event streams.

### Integration Points
- Add Phase 4 diagnostics/health/secure-storage IPC channels following the same zod-validated `v1` channel pattern.
- Extend preload API with narrow diagnostics/health/secure-storage methods and typed responses.
- Attach health and diagnostics export UI into Settings/management shell.
- Feed diagnostics bundle generation from runtime history DB + install/runtime logs + component-version resolution.

</code_context>

<specifics>
## Specific Ideas

- Retry actions must be conditional: show `Retry` only when retrying can succeed.
- Health and diagnostics controls should live under Settings to align with support/IT operations.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope.

</deferred>

---

*Phase: 04-diagnostics-security-storage-and-macos-distribution-baseline*
*Context gathered: 2026-04-03*
