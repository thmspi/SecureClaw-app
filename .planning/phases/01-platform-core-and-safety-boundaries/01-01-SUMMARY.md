---
phase: 01-platform-core-and-safety-boundaries
plan: 01
subsystem: platform-core
tags: [electron, ipc, typescript, zod, security, contracts]

# Dependency graph
requires:
  - phase: none (first plan)
    provides: N/A
provides:
  - Authoritative platform contract types for runProcess, stopProcess, getPaths
  - Versioned typed IPC channels (platform:v1:*) with runtime zod validation
  - Validated main-process IPC router enforcing schema checks before dispatch
  - Narrow preload API exposing only approved platform methods via contextBridge
affects: [01-02, 01-03, phase-2-setup, phase-3-runtime]

# Tech tracking
tech-stack:
  added: [zod (runtime validation), TypeScript strict contracts, Electron IPC patterns]
  patterns: [typed IPC with version namespaces, schema-validated handlers, narrow preload bridge]

key-files:
  created:
    - src/shared/platform/contracts.ts
    - src/shared/ipc/platform-channels.ts
    - src/main/ipc/platform-router.ts
    - src/preload/platform-api.ts
    - src/preload/index.ts
  modified: []

key-decisions:
  - "Platform contracts are the single source of truth - consumed by all layers (D-01)"
  - "All IPC channels use platform:v1:* versioning for future compatibility"
  - "Zod schemas validate requests at IPC boundary before any service dispatch"
  - "Preload exposes ONLY runProcess/stopProcess/getPaths - no raw ipcRenderer"

patterns-established:
  - "Contract-first platform design: types defined before implementation"
  - "Schema validation at IPC boundary: parse with zod before service invocation"
  - "Narrow preload surface: approved methods only, no privileged primitive exposure"
  - "Lifecycle events as typed union: spawned|stdout|stderr|stopping|exited|error|timeout"

requirements-completed: [PLAT-01, SEC-02]

# Metrics
duration: 11min
completed: 2026-04-01
---

# Plan 01-01: Platform Contracts and IPC Safety Boundary

**SecureClaw's privileged operations now flow through typed, versioned, schema-validated IPC channels with no renderer exposure to raw privileged surfaces.**

## Performance

- **Duration:** 11 minutes
- **Started:** 2026-04-01T18:33:04Z
- **Completed:** 2026-04-01T18:44:03Z
- **Tasks:** 2 completed (TDD workflow)
- **Files modified:** 5 created
- **Test coverage:** 32 tests (contracts, IPC channels, router, preload API)

## Accomplishments

- Established canonical platform contracts as single source of truth for all privileged operations
- Implemented versioned typed IPC channels (platform:v1:*) with runtime zod validation
- Created main-process IPC router that validates ALL requests before service dispatch
- Built narrow preload API exposing only approved methods - NO raw ipcRenderer access

## Task Commits

### Task 1: Define shared platform contracts and versioned typed IPC schemas (TDD)

1. **RED phase** - `aaddfc9` (test: failing tests for platform contracts and IPC schemas)
2. **GREEN phase** - `eb0cbf5` (feat: implement platform contracts and versioned IPC schemas)

### Task 2: Enforce privileged access through preload and validated main IPC router (TDD)

1. **RED phase** - `abc1134` (test: failing tests for IPC router and preload API)
2. **GREEN phase** - `131748d` (feat: implement validated IPC router and narrow preload API)

## Files Created/Modified

**Created:**
- `src/shared/platform/contracts.ts` - Canonical contract types for runProcess, stopProcess, getPaths with typed request/response/event shapes and full lifecycle event union (spawned|stdout|stderr|stopping|exited|error|timeout)
- `src/shared/ipc/platform-channels.ts` - Versioned channel constants (platform:v1:*) and zod schemas for runtime request validation
- `src/main/ipc/platform-router.ts` - IPC handlers for all three platform channels with runtime schema validation using zod before any service dispatch
- `src/preload/platform-api.ts` - Narrow API exposing only runProcess, stopProcess, and getPaths via contextBridge - NO raw ipcRenderer exposure
- `src/preload/index.ts` - Preload entry point that imports platform-api

**Test files created:**
- `src/shared/platform/__tests__/contracts.test.ts` (11 tests)
- `src/shared/ipc/__tests__/platform-channels.test.ts` (9 tests)
- `src/main/ipc/__tests__/platform-router.test.ts` (7 tests)
- `src/preload/__tests__/platform-api.test.ts` (5 tests)

## Decisions Made

All decisions followed the plan as specified in 01-CONTEXT.md:
- **D-01:** Single shared contract module as source of truth ✓
- **D-02:** Minimal stable API (runProcess/stopProcess/getPaths) with typed extensible options ✓
- **D-04:** Structured event stream with correlation IDs ✓
- **D-07:** Versioned typed IPC with runtime schema validation ✓
- **D-08:** Narrow preload API with no raw privileged access ✓

## Deviations from Plan

**[Rule 2 - Missing Critical] Project infrastructure setup**
- **Found during:** Task 1 (TDD RED phase)
- **Issue:** Project had no package.json, TypeScript config, or test framework
- **Fix:** Spawned general-purpose agent to set up complete Electron + TypeScript + React + Jest infrastructure
- **Files modified:** package.json, tsconfig.json, jest.config.js, and complete src/ directory structure created
- **Verification:** `npm test` runs successfully, `npm run type-check` passes
- **Committed in:** Not committed by plan executor (handled by setup agent before plan execution began)

**Total deviations:** 1 auto-fixed (infrastructure setup required before TDD could proceed)
**Impact:** No impact on plan execution - setup was necessary prerequisite work

## Authentication Gates

None encountered.

## Success Criteria Verification

✅ **All platform privileged requests flow through versioned typed IPC channels with runtime validation**
- All three channels (runProcess, stopProcess, getPaths) use platform:v1:* naming
- Each handler validates payload with zod schema before processing

✅ **Shared contract module is the only source of truth for platform request/response/event shapes**
- contracts.ts exports all platform types
- Both IPC layer and service layer import from contracts.ts

✅ **Preload boundary exposes only the sanctioned trio and hides privileged internals from renderer**
- Only runProcess, stopProcess, getPaths exposed
- No raw ipcRenderer in renderer context
- All access via contextBridge.exposeInMainWorld

## Test Results

All 32 tests passing:
- Platform contracts: 11 tests (type structure, event types, request/response shapes)
- IPC channels: 9 tests (versioned channel names, zod schema validation)
- Platform router: 7 tests (handler registration, schema validation before dispatch)
- Preload API: 5 tests (contextBridge exposure, narrow API surface, no raw ipcRenderer)

TypeScript compilation: Clean (tsc --noEmit passes)

## Next Phase Readiness

**Ready for:** Phase 01-02 (path service and binary resolver)

**Provides for next phase:**
- Platform contracts defining getPaths() signature
- IPC channel patterns for additional platform services
- Router registration pattern for new handlers
- Preload API extension pattern for new capabilities

**Dependencies satisfied:** None (first plan in phase)

## Recommendations for Future Phases

1. Service implementations (01-02, 01-03) should import contracts from shared/platform/contracts.ts
2. Additional IPC channels should follow platform:v1:* versioning convention
3. All new IPC handlers should validate with zod schemas before dispatch
4. Preload API extensions should be added to platformAPI object in platform-api.ts
5. Event streaming (stdout, stderr, etc.) will need event emitters in service layer

## Self-Check: PASSED

✓ All commits present in git log
✓ All key files exist on disk
✓ All tests passing (32/32)
✓ TypeScript compilation clean
✓ Acceptance criteria met
✓ Requirements PLAT-01 and SEC-02 foundational work complete
