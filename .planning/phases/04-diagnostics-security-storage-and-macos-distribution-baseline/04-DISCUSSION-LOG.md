# Phase 4: Diagnostics, Security Storage, and macOS Distribution Baseline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves alternatives considered.

**Date:** 2026-04-03T19:57:44Z
**Phase:** 04-diagnostics-security-storage-and-macos-distribution-baseline
**Areas discussed:** Error UX + Remediation, Health Dashboard Scope, Diagnostics Bundle + Redaction, Secure Secret Storage Contract, macOS Signing/Packaging Baseline

---

## Error UX + Remediation

| Option | Description | Selected |
|--------|-------------|----------|
| Inline panel | Show errors inside affected section | ✓ |
| Global toast only | Top-level transient notifications | |
| Blocking modal | Require dismissal before continuing | |
| You decide | Agent discretion | |

| Option | Description | Selected |
|--------|-------------|----------|
| Plain language + next actions + optional technical details | Support-friendly remediation copy | ✓ |
| Technical-only | Raw internal error copy | |
| Generic failure copy | Minimal messaging | |
| You decide | Agent discretion | |

| Option | Description | Selected |
|--------|-------------|----------|
| Contextual actions | Retry/Open Settings/Re-check/Copy support info | |
| Retry only if relevant | Show retry only for retryable failures | ✓ |
| Informational only | No recovery action buttons | |
| You decide | Agent discretion | |

| Option | Description | Selected |
|--------|-------------|----------|
| Collapsed technical details | Expandable "Technical details" | ✓ |
| Always visible technical details | Inline raw details by default | |
| UI hides technical details | Only export includes details | |
| You decide | Agent discretion | |

**User's choice:** Inline contextual errors, plain-language remediation, conditional retry-only behavior, collapsed technical details.
**Notes:** Retry button must not appear for architecture/config issues that are not actually retryable.

---

## Health Dashboard Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated Health section/page | Separate management nav surface | |
| Health cards in Management tab | Embed into existing management content | |
| Settings-only location | Place dashboard under Settings | ✓ |
| You decide | Agent discretion | |

| Option | Description | Selected |
|--------|-------------|----------|
| Full v1 status set | Install/runtime/plugin status + app/openclaw/nemoclaw/docker versions | ✓ |
| Runtime-only | Session/runtime state only | |
| Install-only | Setup/prerequisite focus only | |
| You decide | Agent discretion | |

| Option | Description | Selected |
|--------|-------------|----------|
| Worst-of severity model | Healthy/Warning/Critical + per-component badges | ✓ |
| Numeric score | Aggregate 0-100 score | |
| Component-only statuses | No global severity indicator | |
| You decide | Agent discretion | |

| Option | Description | Selected |
|--------|-------------|----------|
| Auto + manual refresh | ~10s poll plus explicit refresh action | ✓ |
| Manual only | Refresh button only | |
| Load-once | No live refresh after initial load | |
| You decide | Agent discretion | |

**User's choice:** Settings-hosted health dashboard with full status/version scope, worst-of severity model, and auto+manual refresh.

---

## Diagnostics Bundle + Redaction

| Option | Description | Selected |
|--------|-------------|----------|
| ZIP bundle | Single support handoff artifact | ✓ |
| Folder export | Raw extracted directory | |
| JSON-only file | Single JSON output | |
| You decide | Agent discretion | |

| Option | Description | Selected |
|--------|-------------|----------|
| Full diagnostics set | Logs + health snapshot + versions + recent history | ✓ |
| Logs only | Log-focused export | |
| Health only | Snapshot-only export | |
| You decide | Agent discretion | |

| Option | Description | Selected |
|--------|-------------|----------|
| Automatic redaction + summary | Scrub sensitive data and list what was redacted | ✓ |
| No redaction | Raw data export | |
| User-selective export | Manual include/exclude choices | |
| You decide | Agent discretion | |

| Option | Description | Selected |
|--------|-------------|----------|
| Settings > Health action | Centralized support action location | ✓ |
| Error-panel action | Trigger export at failure surface | |
| Dedicated nav tab | New top-level diagnostics page | |
| You decide | Agent discretion | |

**User's choice:** Single ZIP export from Settings > Health with automatic redaction and support-focused data contents.

---

## Secure Secret Storage Contract

| Option | Description | Selected |
|--------|-------------|----------|
| Store only sensitive credentials/tokens | Keep non-secret config in existing stores | ✓ |
| Store all settings | Full config in secure store | |
| Defer secure storage | No secure-store implementation in Phase 4 | |
| You decide | Agent discretion | |

| Option | Description | Selected |
|--------|-------------|----------|
| Main service + typed IPC | Narrow set/get/delete contract through privileged boundary | ✓ |
| Renderer direct access | Secure-store library called from renderer | |
| Raw generic IPC | Unscoped key/value calls without explicit typed contracts | |
| You decide | Agent discretion | |

| Option | Description | Selected |
|--------|-------------|----------|
| Block dependent actions + remediation | Fail closed with clear guidance when secure store unavailable | ✓ |
| Fallback plaintext file | Store secrets in local files if secure store fails | |
| Silent continue | Proceed without storing secrets | |
| You decide | Agent discretion | |

| Option | Description | Selected |
|--------|-------------|----------|
| Namespaced keys + cleanup + rotate-on-overwrite | Explicit lifecycle management | ✓ |
| Keep forever | No cleanup lifecycle | |
| In-memory only | No persistent secure storage | |
| You decide | Agent discretion | |

**User's choice:** Sensitive-only OS secure storage via typed IPC service, fail-closed behavior, explicit lifecycle cleanup/rotation.

---

## macOS Signing/Packaging Baseline

| Option | Description | Selected |
|--------|-------------|----------|
| Signed `.dmg` + `.zip` | Enterprise distribution + compatibility artifact pair | ✓ |
| `.dmg` only | Single DMG output | |
| `.zip` only | Single ZIP output | |
| You decide | Agent discretion | |

| Option | Description | Selected |
|--------|-------------|----------|
| Sign app + embedded binaries/frameworks | Hardened runtime + required entitlements | ✓ |
| Sign app bundle only | No embedded signing coverage | |
| Defer signing | No signing in this phase | |
| You decide | Agent discretion | |

| Option | Description | Selected |
|--------|-------------|----------|
| Include notarization + staple | Full enterprise-safe baseline flow | ✓ |
| Sign only | Notarization deferred | |
| Skip both | No trust-chain hardening | |
| You decide | Agent discretion | |

| Option | Description | Selected |
|--------|-------------|----------|
| Automated gate checks | `codesign` verify + Gatekeeper assess + launch smoke test | ✓ |
| Manual checks only | Human verification only | |
| No explicit checks | No release gate | |
| You decide | Agent discretion | |

**User's choice:** Signed DMG+ZIP baseline with hardened-runtime signing, notarization/stapling, and automated release-gate checks.

## Agent's Discretion

- Exact internal rules for retryable vs non-retryable classification.
- UI details for status card layout and refresh affordances.
- Redaction implementation internals and token/path detector heuristics.
- CI orchestration details for signing/notarization verification steps.

## Deferred Ideas

None.
