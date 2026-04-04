---
phase: 04-diagnostics-security-storage-and-macos-distribution-baseline
plan: 05
subsystem: infra
tags: [electron-builder, macos, notarization, codesign, release-gate]
requires:
  - phase: 03-managed-session-and-plugin-runtime
    provides: existing Electron packaging/runtime baseline used by Phase 4 distribution hardening
provides:
  - mac electron-builder distribution baseline for signed dmg/zip artifacts
  - notarization and stapling automation with credential preflight
  - deterministic release verification gate for codesign, Gatekeeper, stapler, and launch smoke
affects: [release, security, distribution, ci]
tech-stack:
  added: []
  patterns: [TDD for release scripts, explicit preflight before notarization, release gate automation]
key-files:
  created:
    - electron-builder.yml
    - build/entitlements.mac.plist
    - scripts/release/preflight-macos-signing.sh
    - scripts/release/notarize.mjs
    - scripts/release/verify-macos-artifact.sh
    - src/main/release/__tests__/mac-distribution-config.test.ts
    - src/main/release/__tests__/notarization-scripts.test.ts
    - src/main/release/__tests__/verify-macos-artifact-script.test.ts
  modified: []
key-decisions:
  - "Preflight fails fast on missing APPLE_KEYCHAIN_PROFILE before identity checks for deterministic remediation."
  - "Verification gate uses a 10-second smoke-test timeout with timeout/gtimeout/manual fallback to keep execution portable."
patterns-established:
  - "Release hardening scripts are paired with filesystem-based TDD tests in src/main/release/__tests__."
  - "Verification scripts emit explicit PASS/FAIL markers per gate check."
requirements-completed: [SEC-03]
duration: 5 min
completed: 2026-04-04
---

# Phase 4 Plan 5: macOS distribution baseline Summary

**Signed macOS distribution baseline with dmg/zip builder config, notarization+stapling automation, and scripted release verification gates**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-04T08:47:18Z
- **Completed:** 2026-04-04T08:52:37Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- Added `electron-builder.yml` with `mac.target: [dmg, zip]`, hardened runtime, entitlements wiring, and `afterSign` notarization hook.
- Added hardened runtime entitlements plist for app and inherited binaries.
- Implemented `preflight-macos-signing.sh` for Developer ID + `APPLE_KEYCHAIN_PROFILE` validation with clear remediation output.
- Implemented `notarize.mjs` with deterministic logging for `xcrun notarytool submit --wait` and `xcrun stapler staple`.
- Implemented `verify-macos-artifact.sh` release gate for codesign verify, Gatekeeper assessment, stapler validate, and 10-second launch smoke test.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add electron-builder mac distribution config for signed dmg+zip**
2. `95e60e1` `test(04-05): add failing test for mac distribution baseline`
3. `f58946d` `feat(04-05): add mac builder config and hardened entitlements`
4. **Task 2: Implement notarization/stapling hook with explicit credential preflight**
5. `d201402` `test(04-05): add failing tests for notarization scripts`
6. `dd8d9c3` `feat(04-05): implement mac signing preflight and notarization hook`
7. **Task 3: Add automated release-gate verification script for D-20 checks**
8. `943d3db` `test(04-05): add failing tests for mac artifact gate script`
9. `01f9ce4` `feat(04-05): add mac artifact verification gate script`

## Files Created/Modified
- `electron-builder.yml` - macOS artifact/signing baseline and afterSign hook wiring.
- `build/entitlements.mac.plist` - hardened runtime entitlements used by app and inherited binaries.
- `scripts/release/preflight-macos-signing.sh` - signing identity and notarytool profile preflight checks.
- `scripts/release/notarize.mjs` - notarization submit and staple hook for packaged app output.
- `scripts/release/verify-macos-artifact.sh` - release-gate verification script for D-20 checks.
- `src/main/release/__tests__/mac-distribution-config.test.ts` - TDD RED/GREEN coverage for builder + entitlements baseline.
- `src/main/release/__tests__/notarization-scripts.test.ts` - TDD coverage for preflight/notarization script contract.
- `src/main/release/__tests__/verify-macos-artifact-script.test.ts` - TDD coverage for verification gate command contract.

## Decisions Made
- Failed early on missing `APPLE_KEYCHAIN_PROFILE` before identity probing to guarantee actionable remediation for missing credential setup.
- Included `timeout`/`gtimeout`/manual fallback path in smoke test execution so the release gate still enforces a 10-second launch window across environments.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `build/` is gitignored, so `build/entitlements.mac.plist` required `git add -f` for task commit staging.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- macOS distribution baseline for SEC-03 is now scripted and syntax-verified.
- Ready for remaining Phase 04 plans and integrated release pipeline wiring.

---
*Phase: 04-diagnostics-security-storage-and-macos-distribution-baseline*
*Completed: 2026-04-04*

## Self-Check: PASSED

- Verified required files exist on disk.
- Verified all Task 1-3 commit hashes are present in git history.
