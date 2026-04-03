# Phase 4: Diagnostics, Security Storage, and macOS Distribution Baseline - Research

**Researched:** 2026-04-03
**Domain:** Electron diagnostics UX, secure secret storage, and macOS signing/notarization pipeline
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
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

### Claude's Discretion
- Exact retryability classification rules as long as non-retryable failures do not expose `Retry`.
- Exact health refresh interval tuning around the ~10s target and UI presentation details.
- Concrete redaction matcher implementation as long as required secret/path/identifier classes are scrubbed and summarized.
- CI/release task wiring for signing/notarization/check gates.

### Deferred Ideas (OUT OF SCOPE)
None - discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DIAG-01 | Errors are shown in plain language with clear next-step actions. | Inline error envelope pattern, retryability classification, and IPC error-shape guidance. |
| DIAG-02 | App provides a health dashboard with install/runtime status and component versions. | Health aggregator service pattern (`install_state`, runtime sessions/history, version probes) + Settings placement. |
| DIAG-03 | User can export a redacted diagnostics bundle for IT/support. | ZIP export stack (`archiver`), redaction pipeline (`fast-redact` + regex scrub), and artifact schema. |
| SEC-01 | Sensitive local credentials/secrets are stored using OS-backed secure storage abstractions. | `safeStorage`-backed main-process `SecretStore` with typed IPC and secure-failure UX contract. |
| SEC-03 | macOS packaged app supports signed distribution for enterprise-safe deployment baseline. | `electron-builder` mac config (`dmg`,`zip`), hardened runtime + entitlements, notarization/stapling, verification gates. |
</phase_requirements>

## Summary

Phase 4 should be implemented as an extension of the existing typed IPC architecture, not as ad-hoc UI/service additions. The current codebase already has reusable error panel UX, SQLite state stores, runtime history capture, and Settings surface integration points. The fastest safe path is to add three focused main-process services: `health-service`, `diagnostics-export-service`, and `secure-secret-store-service`, each behind narrow zod-validated IPC channels and preload methods.

For secure secret storage, prefer Electron first-party `safeStorage` as the default OS-backed encryption primitive on macOS and persist only encrypted payloads keyed by namespaced secret IDs. This matches current architecture and avoids introducing a native dependency unless per-item Keychain records become a hard requirement. Handle `safeStorage.isEncryptionAvailable() === false` as a hard block for secret-dependent actions (per D-15).

For distribution baseline, use `electron-builder` with explicit mac targets (`dmg`, `zip`), hardened runtime, entitlements, notarization, and stapling. Automate verification gates (`codesign`, `spctl`, launch smoke, stapler validate) in CI/local release scripts. Current machine tooling is present, but signing identities and Apple credentials are not configured yet, so release automation must include a preflight that fails early with actionable remediation.

**Primary recommendation:** Implement Phase 4 with three new main-process services (health, diagnostics export, secure secret store) plus explicit electron-builder signing/notarization config and scripted verification gates.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `electron` (`safeStorage`, `app`, `dialog`) | 41.1.1 (published 2026-04-01) | OS-backed encryption availability checks, app/log paths, save dialogs | First-party APIs aligned with existing architecture and security model. |
| `electron-builder` | 26.8.1 (published 2026-02-16) | macOS artifact packaging/signing for `.dmg` and `.zip` | Standard Electron distribution toolchain with mature mac signing/notarization support. |
| `@electron/notarize` | 3.1.1 (published 2025-10-31) | Notarization integration and stapling validation workflows | Official Electron-maintained notarization path. |
| `archiver` | 7.0.1 (published 2024-03-10) | Deterministic ZIP diagnostics bundle generation | Widely used ZIP/TAR streaming package; avoids hand-rolled archive logic. |
| `electron-log` | 5.4.3 (published 2025-08-18) | Stable file-backed logs for support bundles | Support-friendly, low-friction logging beyond devtools console. |
| `fast-redact` | 3.5.0 (published 2024-03-19) | Deterministic field/path redaction in JSON payloads | Prevents custom fragile redaction logic for structured payloads. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@napi-rs/keyring` | 1.2.0 (published 2025-09-02) | Native keychain/credential-vault adapter | Use only if per-item keychain records are required beyond encrypted blob persistence. |
| `keytar` | 7.9.0 (published 2022-02-17) | Legacy keychain module | Avoid by default due older release cadence; keep as migration fallback only. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `safeStorage` + encrypted SQLite/file blobs | `@napi-rs/keyring` direct credential entries | Better keychain-native semantics per secret, but adds native module complexity and ABI risk. |
| `archiver` | `ditto`/`zip` shell invocation | Fewer deps but less testable/portable and harder to control redaction manifest contents. |
| `fast-redact` for structured payloads | fully custom regex/object traversal | Higher bug/leak risk and repeated edge-case handling. |

**Installation:**
```bash
npm install archiver electron-log fast-redact
npm install --save-dev @electron/notarize
```

**Version verification:**
```bash
npm view electron version
npm view electron-builder version
npm view @electron/notarize version
npm view archiver version
npm view electron-log version
npm view fast-redact version
npm view @napi-rs/keyring version
npm view keytar version
```

## Architecture Patterns

### Recommended Project Structure
```text
src/
├── main/
│   ├── diagnostics/                 # health + diagnostics export services
│   ├── security/                    # secure secret store service
│   └── ipc/                         # diagnostics/security routers
├── shared/
│   ├── diagnostics/                 # health/export contracts
│   └── ipc/                         # diagnostics/security channels + schemas
├── preload/
│   └── platform-api.ts              # narrow `diagnostics` + `secrets` bridge
└── renderer/
    └── pages/management/            # Settings > Health dashboard + export UI
```

### Pattern 1: Typed IPC Service Boundaries
**What:** Add `diagnostics:v1:*` and `secrets:v1:*` channels with zod-validated request schemas and typed response envelopes.
**When to use:** Every privileged diagnostics/secret operation.
**Example:**
```typescript
// Source: https://www.electronjs.org/docs/latest/api/ipc-renderer
// Source: local pattern in src/shared/ipc/runtime-channels.ts
export const DIAGNOSTICS_CHANNELS = {
  getHealth: 'diagnostics:v1:getHealth',
  exportBundle: 'diagnostics:v1:exportBundle',
} as const;
```

### Pattern 2: Error Envelope with Retryability
**What:** Return `{ userMessage, nextSteps, retryable, technicalDetails? }` from main process; renderer decides Retry button visibility from `retryable`.
**When to use:** All install/runtime/diagnostics actions surfaced to users.
**Example:**
```typescript
// Source: local ErrorPanel pattern in src/renderer/components/wizard/ErrorPanel.tsx
type ErrorEnvelope = {
  userMessage: string;
  nextSteps: string[];
  retryable: boolean;
  technicalDetails?: string;
};
```

### Pattern 3: Health Snapshot Aggregator
**What:** Build a single `getHealthSnapshot()` in main that composes install state, runtime session/plugin state, and version probes (`app`, `openclaw`, `nemoclaw`, `docker`).
**When to use:** Settings health card auto-refresh/manual refresh.
**Example:**
```typescript
// Source: https://www.electronjs.org/docs/latest/api/app
const appVersion = app.getVersion();
const logsPath = app.getPath('logs');
```

### Pattern 4: Diagnostics Export Pipeline
**What:** Generate a temporary diagnostics workspace, serialize redacted JSON + log extracts, zip once, then clean temp files.
**When to use:** `Settings > Health > Export diagnostics`.
**Example:**
```typescript
// Source: https://www.npmjs.com/package/archiver?activeTab=readme
const archive = archiver('zip', { zlib: { level: 9 } });
archive.directory(tmpDir, false);
await archive.finalize();
```

### Pattern 5: Secure Secret Store Service
**What:** Main-process secret store with namespaced keys and operations `set/get/delete`; internally use `safeStorage` encrypted payloads.
**When to use:** Any credential/token lifecycle.
**Example:**
```typescript
// Source: https://www.electronjs.org/docs/latest/api/safe-storage
if (!safeStorage.isEncryptionAvailable()) {
  throw new Error('Secure storage unavailable');
}
const encrypted = safeStorage.encryptString(secretValue);
```

### Anti-Patterns to Avoid
- **Renderer-side secret handling:** Never expose raw secrets in preload/renderer state.
- **Toast-only failure UX:** Violates D-01 and loses contextual remediation.
- **Bundle export without redaction manifest:** Creates support risk and audit blind spots.
- **Signing only the top-level app:** Embedded binaries/frameworks remain non-compliant (D-18).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Secret encryption backend | Custom crypto key management | Electron `safeStorage` (optionally `@napi-rs/keyring` adapter) | OS-backed key material handling avoids insecure DIY key lifecycle. |
| ZIP writer | Manual ZIP format implementation | `archiver` | Prevents archive corruption/edge-case bugs. |
| Structured redaction engine | Custom deep object walker | `fast-redact` | Safer deterministic redaction with lower leak risk. |
| Notarization flow | Ad-hoc shell scripts around deprecated tooling | `electron-builder` + `@electron/notarize` | Officially maintained path with current credential modes and stapler validation. |
| Logging persistence | Scattered `console.*` only | `electron-log` + `app.getPath('logs')` | Needed for support-grade diagnostics exports. |

**Key insight:** Phase 4 succeeds by composing proven primitives; custom implementations here increase support and security risk disproportionately.

## Common Pitfalls

### Pitfall 1: Misleading Retry UX
**What goes wrong:** Users are shown `Retry` for non-retryable failures.
**Why it happens:** Error mapping does not classify root cause categories.
**How to avoid:** Centralize `retryable` classification in main process error mapper.
**Warning signs:** Repeat failures with no state change after retry.

### Pitfall 2: IPC Error Context Loss
**What goes wrong:** Renderer sees a generic rejected promise without actionable context.
**Why it happens:** Throwing raw errors across `ipcMain.handle`/`invoke` boundary loses structure.
**How to avoid:** Return typed result envelopes (`ok/error`) with user and technical fields.
**Warning signs:** UI only shows `Error: Failed` with no next action.

### Pitfall 3: Incomplete Redaction
**What goes wrong:** Tokens, paths, or user identifiers leak into exported bundles.
**Why it happens:** Redaction runs on only one artifact type (for example JSON but not text logs).
**How to avoid:** Run redaction pipeline per artifact and emit redaction summary counts by matcher.
**Warning signs:** Diagnostics zip contains home directories, bearer tokens, or API keys in plaintext.

### Pitfall 4: Secure Storage Availability Not Enforced
**What goes wrong:** App silently falls back to plaintext or partial secret writes.
**Why it happens:** `safeStorage.isEncryptionAvailable()` not treated as a hard guard for secret ops.
**How to avoid:** Block secret-dependent actions with remediation copy and diagnostics guidance (D-15).
**Warning signs:** Secret workflows succeed when keychain is locked/unavailable.

### Pitfall 5: “Signed” Build That Fails Gatekeeper
**What goes wrong:** Artifact is signed but fails assessment/notarization expectations.
**Why it happens:** Missing entitlements/hardened runtime, unstapled ticket, or unsigned embedded binaries.
**How to avoid:** Add release gate checks for codesign verify, Gatekeeper assess, stapler validate, and launch smoke.
**Warning signs:** `spctl` rejection or first-launch trust warning on managed macOS devices.

## Code Examples

Verified patterns from official sources:

### Secure Secret Store Guard + Encrypt
```typescript
// Source: https://www.electronjs.org/docs/latest/api/safe-storage
import { safeStorage } from 'electron';

export function encryptSecret(value: string): Buffer {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Secure storage is unavailable. Unlock Keychain and retry.');
  }
  return safeStorage.encryptString(value);
}
```

### Diagnostics ZIP Export
```typescript
// Source: https://www.npmjs.com/package/archiver?activeTab=readme
import archiver from 'archiver';
import { createWriteStream } from 'node:fs';

export async function writeDiagnosticsZip(srcDir: string, outZipPath: string) {
  const output = createWriteStream(outZipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.pipe(output);
  archive.directory(srcDir, false);
  await archive.finalize();
}
```

### Notarization + Validation Hook
```typescript
// Source: https://packages.electronjs.org/notarize/v3.1.1/index.html
import { notarize } from '@electron/notarize';

await notarize({
  appPath,
  keychainProfile: process.env.APPLE_KEYCHAIN_PROFILE,
});
// Validate with: xcrun stapler validate path/to/notarized.app
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Ad-hoc/altool-era notarization scripts | `@electron/notarize` + `notarytool` credential modes | Catalina+ notarization enforcement era; current docs emphasize notarytool and keychain profile flows | Lower release fragility and clearer CI automation path. |
| Renderer/global storage of secrets | Main-process OS-backed secure storage abstraction | Electron security model maturity and enterprise requirements | Reduces secret exposure surface and aligns with SEC-01. |
| Diagnostics via manual log sharing | One-click redacted ZIP diagnostics bundle | Enterprise support workflows and low-tech user needs | Faster support handoff with lower data-leak risk. |

**Deprecated/outdated:**
- Storing plaintext credentials in local files or renderer storage.
- Shipping macOS builds without notarization/stapling for enterprise deployment contexts.

## Open Questions

1. **Do we need per-secret native keychain items in v1, or is `safeStorage` encrypted payload persistence sufficient?**
   - What we know: `safeStorage` is OS-backed and available in Electron main process.
   - What's unclear: IT policy expectation for direct Keychain item visibility/auditing.
   - Recommendation: Start with `safeStorage` abstraction; keep adapter seam for `@napi-rs/keyring` if policy requires native entries.

2. **What exact operation-history window should be exported by default?**
   - What we know: runtime history is already persisted in SQLite and indexed.
   - What's unclear: support preference for full history vs bounded recent window.
   - Recommendation: default to last 7 days (or last N records) with optional “include full history” toggle.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `node` | build + scripts | ✓ | v22.22.2 | — |
| `npm`/`npx` | package + release commands | ✓ | 10.9.7 | — |
| `electron-builder` CLI | mac artifact build/sign | ✓ | 26.8.1 | — |
| `codesign` | signature verification | ✓ | present (CLT) | — |
| `spctl` | Gatekeeper assessment | ✓ | present (CLT) | — |
| `xcrun notarytool` | notarization submission/auth | ✓ | present (CLT) | — |
| `xcrun stapler` | notarization ticket validation | ✓ | present (CLT) | — |
| Code-signing identity in keychain | signed release artifacts | ✗ | `0 valid identities found` | none |
| `APPLE_*` notarization credentials env | CI notarization | ✗ | unset | none |
| `docker` | health component version probe | ✓ | 28.3.3 | Report `Warning` if unavailable at runtime |

**Missing dependencies with no fallback:**
- Developer ID signing identity in keychain.
- Notarization credentials (`APPLE_API_KEY*` or `APPLE_ID` flow or keychain profile).

**Missing dependencies with fallback:**
- None for SEC-03 release gate. These are blocking for enterprise-ready signed/notarized distribution.

## Sources

### Primary (HIGH confidence)
- Electron `safeStorage` API: https://www.electronjs.org/docs/latest/api/safe-storage (encryption availability semantics and method behavior).
- Electron `app` API: https://www.electronjs.org/docs/latest/api/app (`app.getPath('logs')`, `app.getVersion()`).
- electron-builder mac configuration: https://www.electron.build/mac
- electron-builder `MacConfiguration`: https://www.electron.build/electron-builder.interface.macconfiguration
- electron-builder code signing (macOS): https://www.electron.build/code-signing-mac
- `@electron/notarize` docs: https://packages.electronjs.org/notarize/v3.1.1/index.html
- Archiver readme: https://www.npmjs.com/package/archiver?activeTab=readme
- Local codebase contracts reviewed: `src/preload/platform-api.ts`, `src/main/ipc/runtime-router.ts`, `src/shared/ipc/runtime-channels.ts`, `src/main/runtime/runtime-history-service.ts`, `src/main/install/install-orchestrator.ts`, `src/main/install/install-state-service.ts`, `src/renderer/components/wizard/ErrorPanel.tsx`, `src/renderer/pages/management/SettingsPanel.tsx`, `src/renderer/stores/management-store.ts`.

### Secondary (MEDIUM confidence)
- Electron IPC invoke error behavior note: https://www.electronjs.org/docs/latest/api/ipc-renderer
- Apple notarization overview page: https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution?changes=_5

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM - Core APIs and builder pipeline verified; secure-store adapter choice remains policy-sensitive.
- Architecture: HIGH - Strong alignment with existing IPC/preload/main patterns in current codebase.
- Pitfalls: MEDIUM - Based on verified API behavior + common Electron distribution failure modes.

**Research date:** 2026-04-03
**Valid until:** 2026-04-17 (re-verify npm versions and signing/notarization docs after this date)

## RESEARCH COMPLETE

Research is complete and ready for planning.
