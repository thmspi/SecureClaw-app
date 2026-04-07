---
phase: 04-diagnostics-security-storage-and-macos-distribution-baseline
plan: 01
subsystem: api
tags: [ipc, zod, diagnostics, secret-storage, contracts, tdd]
requires:
  - phase: 03-managed-session-and-plugin-runtime
    provides: Versioned IPC contract patterns and shared runtime typing conventions
provides:
  - Diagnostics health/export contract types with support remediation envelope
  - Secret storage scoped-key lifecycle contract types with availability gating
  - Diagnostics and secrets v1 IPC channel constants plus zod schemas
affects: [main-ipc-routing, preload-platform-api, renderer-settings-health]
tech-stack:
  added: []
  patterns: [versioned-ipc-channels, typed-error-envelopes, scoped-secret-keys]
key-files:
  created:
    - src/shared/diagnostics/diagnostics-contracts.ts
    - src/shared/security/secret-contracts.ts
    - src/shared/ipc/diagnostics-channels.ts
    - src/shared/ipc/security-channels.ts
    - src/shared/diagnostics/__tests__/diagnostics-contracts.test.ts
    - src/shared/security/__tests__/secret-contracts.test.ts
    - src/shared/ipc/__tests__/diagnostics-security-channels.test.ts
  modified:
    - src/shared/ipc/index.ts
    - tsconfig.json
key-decisions:
  - "Use explicit support/secret error envelopes with userMessage, nextSteps, retryable, and technicalDetails for D-02/D-04/D-15."
  - "Version diagnostics and secret IPC under diagnostics:v1:* and secrets:v1:* with narrow zod schemas."
  - "Apply TypeScript 6 ignoreDeprecations for baseUrl to remove TS5101 verification blocker."
patterns-established:
  - "Contract-first shared module pattern before main/preload/renderer implementation."
  - "Scoped secret key namespace pattern: secureclaw:{scope}:{name}."
requirements-completed: [DIAG-01, DIAG-02, DIAG-03, SEC-01]
duration: 4 min
completed: 2026-04-04
---

# Phase 04 Plan 01: Diagnostics and Secret Contract Foundation Summary

**Typed diagnostics health/export contracts and scoped secret-storage IPC schemas were established as the canonical v1 wire format for Phase 4 services.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-04T08:47:57Z
- **Completed:** 2026-04-04T08:52:49Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments
- Added diagnostics contract module with explicit health severity/component/version shapes and support remediation envelope.
- Added secure secret storage contract module with scoped key lifecycle request/response types and `secureStorageAvailable` response gates.
- Added diagnostics and secrets IPC v1 channel constants with zod validation schemas and shared IPC index exports.

## Task Commits

Each task was committed atomically via TDD RED/GREEN pairs:

1. **Task 1: Define diagnostics contracts with plain-language error envelope and health snapshot shape**
   - `78841c8` (`test`)
   - `da2b23e` (`feat`)
2. **Task 2: Define secure secret storage contracts with scoped key lifecycle semantics**
   - `0fd7ee0` (`test`)
   - `969da8f` (`feat`)
3. **Task 3: Add versioned diagnostics/secrets IPC channels and zod validation schemas**
   - `124baf3` (`test`)
   - `e2d2a4b` (`feat`)

## Files Created/Modified
- `src/shared/diagnostics/diagnostics-contracts.ts` - Canonical diagnostics health/export interfaces and support error envelope.
- `src/shared/security/secret-contracts.ts` - Canonical secret scope/key lifecycle interfaces and secure storage error envelope.
- `src/shared/ipc/diagnostics-channels.ts` - Diagnostics v1 channel constants and zod request schemas.
- `src/shared/ipc/security-channels.ts` - Secrets v1 channel constants and zod request schemas.
- `src/shared/ipc/index.ts` - Exports diagnostics/security channel modules for shared imports.
- `tsconfig.json` - Added `ignoreDeprecations` for TS6 `baseUrl` compatibility.

## Decisions Made
- Chose strict string-union contract types for health severity/component/version keys to prevent downstream shape drift.
- Kept security IPC schemas narrowly scoped to `set/get/delete/deleteScope` methods for D-14 least-privilege channel design.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] TypeScript 6 `baseUrl` deprecation gate blocked verification**
- **Found during:** Task 1 verification
- **Issue:** `npm run type-check` failed with TS5101 requiring `ignoreDeprecations`.
- **Fix:** Added `"ignoreDeprecations": "6.0"` in `tsconfig.json`.
- **Files modified:** `tsconfig.json`
- **Verification:** TS5101 deprecation error no longer appears.
- **Committed in:** `da2b23e`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** No scope creep; unblock was minimal and directly required to continue plan verification.

## Issues Encountered
- Global `npm run type-check` still fails due pre-existing renderer TypeScript baseline issues (`jsx`/DOM configuration and unrelated strictness errors). Logged to `.planning/phases/04-diagnostics-security-storage-and-macos-distribution-baseline/deferred-items.md` as out-of-scope for 04-01.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 4 downstream plans can now implement diagnostics/secret services, preload bridge methods, and UI flows against stable shared contracts.
- Deferred item: repository-wide renderer TypeScript baseline needs separate cleanup plan before global `type-check` can fully pass.

## Known Stubs
None.

## Self-Check: PASSED
- Verified required files exist on disk.
- Verified all task commit hashes are present in git history.

---
*Phase: 04-diagnostics-security-storage-and-macos-distribution-baseline*
*Completed: 2026-04-04*
