---
phase: 04-diagnostics-security-storage-and-macos-distribution-baseline
verified: 2026-04-04T09:29:41Z
status: human_needed
score: 17/17 must-haves verified
human_verification:
  - test: "Run Settings > Health end-to-end in Electron UI"
    expected: "Health cards auto-refresh about every 10s, manual Refresh works, and retry button only appears for retryable errors."
    why_human: "Requires real UI interaction and visual behavior validation."
  - test: "Run Diagnostics Export from Settings > Health and inspect generated ZIP"
    expected: "ZIP is created, includes expected artifacts, and sensitive fields are redacted in output files."
    why_human: "Needs runtime filesystem verification with real local data/logs."
  - test: "Execute signed macOS build + notarization + Gatekeeper validation with Apple credentials"
    expected: "Signed/notarized app passes codesign, Gatekeeper, stapler, and launch smoke checks on a produced app artifact."
    why_human: "Depends on external Apple services, credentials, and real packaged artifacts."
---

# Phase 4: Diagnostics, Security Storage, and macOS Distribution Baseline Verification Report

**Phase Goal:** User and IT support can quickly understand failures, verify health, and safely distribute SecureClaw in enterprise macOS environments.
**Verified:** 2026-04-04T09:29:41Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Diagnostics and secret-storage operations have explicit typed request/response contracts. | ✓ VERIFIED | `src/shared/diagnostics/diagnostics-contracts.ts`, `src/shared/security/secret-contracts.ts` define canonical typed envelopes/requests/responses. |
| 2 | Error payloads include plain-language remediation and retryability flags. | ✓ VERIFIED | `SupportErrorEnvelope` and `SecretStoreError` include `userMessage`, `nextSteps`, `retryable`, `technicalDetails`. |
| 3 | Health and export payloads represent required components and versions. | ✓ VERIFIED | `HealthSnapshot.components` includes install/runtime/plugins and `versions` includes app/openclaw/nemoclaw/docker; export result includes redaction summary. |
| 4 | Settings can request one health snapshot containing install/runtime/plugins and app/openclaw/nemoclaw/docker versions. | ✓ VERIFIED | `loadHealth()` calls diagnostics IPC and `SettingsPanel` renders component severities + version grid. |
| 5 | Diagnostics export returns a single ZIP bundle with automatic redaction and summary counts. | ✓ VERIFIED | `exportDiagnosticsBundle()` writes artifacts, redacts, writes `redaction-summary.json`, and finalizes ZIP. |
| 6 | Diagnostics failures return plain-language remediation with retryability and optional technical details. | ✓ VERIFIED | `diagnostics-router.ts` maps errors into support envelope; export service returns typed failure envelope. |
| 7 | Sensitive values are stored via OS-backed secure storage (not plaintext). | ✓ VERIFIED | `secret-store-service.ts` gates on `safeStorage.isEncryptionAvailable()`, encrypts with `safeStorage.encryptString()`, stores encrypted blob in SQLite. |
| 8 | Secret operations are reachable through narrow typed IPC methods. | ✓ VERIFIED | `security-router.ts` only registers `secrets:v1:set/get/delete/deleteScope` with zod validation; preload exposes typed `secrets` API. |
| 9 | If secure storage is unavailable, secret-dependent actions are blocked with remediation guidance. | ✓ VERIFIED | `ensureSecureStorage()` returns structured non-retryable remediation envelope and each operation exits early. |
| 10 | Secret keys are cleaned during cancel/uninstall flows. | ✓ VERIFIED | `install-orchestrator.ts` runs `deleteScope()` across install/runtime/plugin/support in `cancel()` and `uninstallStack()`. |
| 11 | Health dashboard exists in Settings with auto-refresh (~10s) and manual refresh. | ✓ VERIFIED | `SettingsPanel` triggers load + starts refresh loop; store uses `setInterval(..., 10000)` and `refreshHealth()`. |
| 12 | Diagnostics export action exists in Settings and reports completion/failure inline. | ✓ VERIFIED | Export button triggers `exportDiagnostics(7)`; path success and inline error blocks are rendered in Settings. |
| 13 | Session/plugin/health errors are inline, plain-language, and Retry appears only when retryable. | ✓ VERIFIED | `InlineSupportError` renders user-facing envelope; retry button shown only when `error.retryable && onRetry`. |
| 14 | Technical details are visible but collapsed by default. | ✓ VERIFIED | `InlineSupportError` uses `Collapsible` with `detailsOpen` default false. |
| 15 | macOS build is configured for dmg/zip outputs with signing baseline. | ✓ VERIFIED | `electron-builder.yml` sets `mac.target: [dmg, zip]`, hardened runtime, entitlements. |
| 16 | Build pipeline includes notarization + stapling hooks. | ✓ VERIFIED | `electron-builder.yml` `afterSign` points to `scripts/release/notarize.mjs`; script executes `xcrun notarytool submit --wait` and `xcrun stapler staple`. |
| 17 | Verification gate runs codesign/Gatekeeper/stapler/launch smoke checks. | ✓ VERIFIED | `scripts/release/verify-macos-artifact.sh` runs all four checks explicitly. |

**Score:** 17/17 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `src/shared/diagnostics/diagnostics-contracts.ts` | Diagnostics contracts | ✓ VERIFIED | Exists, substantive, imported by main/preload/renderer diagnostics flows. |
| `src/shared/security/secret-contracts.ts` | Secret contracts | ✓ VERIFIED | Exists, substantive, used by security router/store/orchestrator typing. |
| `src/shared/ipc/diagnostics-channels.ts` | Diagnostics channel constants/schemas | ✓ VERIFIED | Exists, substantive, consumed by preload/router/tests. |
| `src/shared/ipc/security-channels.ts` | Secret channel constants/schemas | ✓ VERIFIED | Exists, substantive, consumed by preload/router/tests. |
| `src/main/diagnostics/health-service.ts` | Health aggregation service | ✓ VERIFIED | Exists, computes severities + versions from runtime/install/plugin sources. |
| `src/main/diagnostics/diagnostics-export-service.ts` | Diagnostics ZIP pipeline | ✓ VERIFIED | Exists, redacts data, emits artifacts, returns typed result. |
| `src/main/diagnostics/redaction.ts` | Redaction engine | ✓ VERIFIED | Exists, substantive regex + object traversal + summary counters. |
| `src/main/ipc/diagnostics-router.ts` | Diagnostics IPC handlers | ✓ VERIFIED | Exists, validates payloads, delegates to services, maps typed errors. |
| `src/main/security/secret-store-service.ts` | Secure secret service | ✓ VERIFIED | Exists, safeStorage gate + encrypt/decrypt + scoped delete. |
| `src/main/ipc/security-router.ts` | Secret IPC handlers | ✓ VERIFIED | Exists, typed channels, zod validation, dispatch to secret store. |
| `src/main/install/install-orchestrator.ts` | Secret cleanup integration | ✓ VERIFIED | Exists and invokes scoped secret cleanup in cancel/uninstall flows. |
| `src/renderer/pages/management/SettingsPanel.tsx` | Health + export UI | ✓ VERIFIED | Exists, renders health versions/statuses, refresh/export actions, inline errors. |
| `src/renderer/components/management/InlineSupportError.tsx` | Reusable inline support error UI | ✓ VERIFIED | Exists, retry gating + collapsed technical details implemented. |
| `src/renderer/stores/management-store.ts` | Health/export state + scheduler | ✓ VERIFIED | Exists, diagnostics state/actions + 10s refresh loop + envelope handling. |
| `src/preload/platform-api.ts` | Narrow diagnostics/secrets bridge | ✓ VERIFIED | Exists, exposes typed diagnostics/secrets methods only. |
| `electron-builder.yml` | macOS distribution config | ✓ VERIFIED | Exists, target/signing/notarization hook configured. |
| `build/entitlements.mac.plist` | Hardened entitlements | ✓ VERIFIED | Exists and referenced by builder config. |
| `scripts/release/notarize.mjs` | Notarization + stapling hook | ✓ VERIFIED | Exists, runs notarytool submit and stapler staple with credential gate. |
| `scripts/release/verify-macos-artifact.sh` | Release gate checks | ✓ VERIFIED | Exists, implements required verification commands. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `src/shared/diagnostics/diagnostics-contracts.ts` | `src/shared/ipc/diagnostics-channels.ts` | Typed payloads + schemas | ✓ WIRED | `diagnostics:v1:*` channels and matching diagnostics contract usage are present. |
| `src/shared/security/secret-contracts.ts` | `src/shared/ipc/security-channels.ts` | Scoped key payload validation | ✓ WIRED | `secrets:v1:*` channels align with typed secret request/response contracts. |
| `src/main/ipc/diagnostics-router.ts` | `src/main/diagnostics/health-service.ts` | IPC invokes `getHealthSnapshot` | ✓ WIRED | Direct invocation exists in handler. |
| `src/main/ipc/diagnostics-router.ts` | `src/main/diagnostics/diagnostics-export-service.ts` | IPC invokes `exportDiagnosticsBundle` | ✓ WIRED | Direct invocation exists in handler. |
| `src/main/diagnostics/diagnostics-export-service.ts` | `src/main/diagnostics/redaction.ts` | Redaction before archive finalize | ✓ WIRED | Uses `redactJsonValue`, `redactText`, and summary combiner before zip finalization. |
| `src/main/ipc/security-router.ts` | `src/main/security/secret-store-service.ts` | Validated payload dispatch | ✓ WIRED | Router parses zod schemas then calls `secretStore.*`. |
| `src/main/install/install-orchestrator.ts` | `src/main/security/secret-store-service.ts` | Scoped delete on cancel/uninstall | ✓ WIRED | `deleteScope({ scope })` called in cleanup path. |
| `src/preload/platform-api.ts` | `src/main/index.ts` | Diagnostics/security handler registration + bridge exposure | ✓ WIRED | Main registers handlers; preload exposes diagnostics/secrets methods over contextBridge. |
| `src/renderer/stores/management-store.ts` | `window.secureClaw.diagnostics` | `loadHealth`/`exportDiagnostics` actions | ✓ WIRED | Store calls `window.secureClaw.diagnostics.getHealth/exportBundle`. |
| `src/renderer/pages/management/SettingsPanel.tsx` | `InlineSupportError` | Section-level inline errors | ✓ WIRED | Settings renders `InlineSupportError` for health/export errors. |
| `electron-builder.yml` | `scripts/release/notarize.mjs` | afterSign hook | ✓ WIRED | `afterSign: scripts/release/notarize.mjs` configured. |
| `electron-builder.yml` | `build/entitlements.mac.plist` | mac entitlements wiring | ✓ WIRED | `entitlements` and `entitlementsInherit` set to plist path. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `SettingsPanel.tsx` | `healthSnapshot` | `useManagementStore.loadHealth()` -> `window.secureClaw.diagnostics.getHealth()` | Yes: main `getHealthSnapshot()` derives install/runtime/plugin severities + version probes | ✓ FLOWING |
| `SettingsPanel.tsx` | `diagnosticsExportPath` / `diagnosticsError` | `useManagementStore.exportDiagnostics()` -> `window.secureClaw.diagnostics.exportBundle()` | Yes: main export service writes redacted artifacts + zip output path | ✓ FLOWING |
| `health-service.ts` | `components`, `versions` | `loadInstallState()`, `getSessions()`, `listPluginPackages()`, CLI `--version` probes | Yes: sources are runtime state/DB/service/CLI calls (not static literals) | ✓ FLOWING |
| `diagnostics-export-service.ts` | bundle artifacts and summary | `getHistory()`, `loadInstallState()`, log file read, redaction module | Yes: reads runtime DB/log sources, redacts, and emits bundle files | ✓ FLOWING |
| `secret-store-service.ts` | encrypted secret rows | `safeStorage.encryptString/decryptString` + SQLite `secret_store` table | Yes: OS-backed encryption and persisted encrypted blobs | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Diagnostics IPC handlers execute expected flow | `npm test -- src/main/ipc/diagnostics-router.test.ts --runInBand --passWithNoTests` | 1 suite passed, 2 tests passed (1.888s) | ✓ PASS |
| Secure storage service behavior | `npm test -- src/main/security/secret-store-service.test.ts --runInBand --passWithNoTests` | 1 suite passed, 3 tests passed (2.572s) | ✓ PASS |
| Security IPC router behavior | `npm test -- src/main/ipc/security-router.test.ts --runInBand --passWithNoTests` | 1 suite passed, 3 tests passed (2.655s) | ✓ PASS |
| Preload diagnostics/secrets bridge exposure | `npm test -- src/preload/__tests__/platform-api.test.ts --runInBand --passWithNoTests` | 1 suite passed, 7 tests passed (2.03s) | ✓ PASS |
| macOS verification gate script contract | `npm test -- src/main/release/__tests__/verify-macos-artifact-script.test.ts --runInBand --passWithNoTests` | 1 suite passed, 2 tests passed (2.588s) | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| DIAG-01 | 04-01, 04-02, 04-03, 04-04 | Errors shown in plain language with clear next actions | ✓ SATISFIED | Support envelopes in diagnostics/security routers + inline renderer error component with next-step lists. |
| DIAG-02 | 04-01, 04-02, 04-04 | Health dashboard with install/runtime status and versions | ✓ SATISFIED | Health service aggregates components/versions; Settings renders severities and version grid with refresh loop. |
| DIAG-03 | 04-01, 04-02, 04-04 | User can export redacted diagnostics bundle | ✓ SATISFIED | Export service creates redacted zip; Settings exposes export action and path/error feedback. |
| SEC-01 | 04-01, 04-03, 04-04 | Sensitive secrets stored via OS-backed secure storage abstractions | ✓ SATISFIED | `safeStorage` gated secret service + typed security IPC + narrow preload bridge. |
| SEC-03 | 04-05 | Signed macOS distribution baseline | ✓ SATISFIED | Builder/signing/notarization/verification scripts exist and are linked; script-contract tests pass. |

Orphaned requirements for Phase 4: **None** (all Phase 4 requirement IDs in `REQUIREMENTS.md` are represented in Phase 04 plan frontmatter).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| None | - | No blocker/warning stubs found in scanned phase key files | ℹ️ Info | Matches were benign defaults/fallback strings or lockfile hash text; no hollow implementation detected. |

### Human Verification Required

### 1. Settings Health UX Flow

**Test:** Open Management -> Settings -> Health. Wait at least 20 seconds and trigger manual refresh.
**Expected:** Health snapshot updates automatically around every 10 seconds; manual refresh updates immediately; inline health errors show retry only when retryable.
**Why human:** Requires runtime UI interaction and timing/visual confirmation.

### 2. Diagnostics Bundle Export Output Quality

**Test:** Trigger "Export Diagnostics (.zip)" in Settings and inspect generated bundle contents.
**Expected:** Bundle contains manifest/health/version/history/install/redaction summary (and log when available); secrets/paths/emails/tokens are redacted.
**Why human:** Requires real machine data/files and support-readiness assessment.

### 3. Enterprise macOS Distribution Validation

**Test:** Build signed artifact with real Apple credentials, run notarization, then execute `scripts/release/verify-macos-artifact.sh` on produced `.app`.
**Expected:** Codesign verify, Gatekeeper assessment, stapler validation, and launch smoke test all pass.
**Why human:** External Apple service integration and real signed artifact execution cannot be fully validated programmatically here.

### Gaps Summary

No implementation gaps were found in automated verification. Remaining work is runtime/human validation for UI behavior and live macOS signing/notarization pipeline execution.

---

_Verified: 2026-04-04T09:29:41Z_
_Verifier: Claude (gsd-verifier)_
