# Domain Pitfalls

**Domain:** macOS-first Electron app for CLI orchestration (OpenClaw/NemoClaw)
**Researched:** 2026-03-31

## Critical Pitfalls

### Pitfall 1: Shell Coupling to macOS Defaults
**What goes wrong:** Core orchestration commands are written assuming `zsh`/`bash`, POSIX flags, and Unix utilities.
**Why it happens:** Early implementation uses direct shell strings in renderer or main process without a command abstraction layer.
**Consequences:** Session start/stop and plugin flows fail on Windows (`cmd`/PowerShell differences), often with silent errors.
**Warning signs:**
- Commands hardcoded as one long shell string instead of argument arrays.
- Calls depend on tools like `sed`, `awk`, `grep`, `nohup`, `kill -9`.
- Feature works only when manually run in Terminal but not from packaged app.
**Prevention strategy:**
- Use `spawn`/`execFile` with explicit binary + args, not shell concatenation.
- Build a platform command adapter (`darwin`, `win32`) for start/stop/session control.
- Standardize one Windows shell path per feature (prefer PowerShell Core where possible) and test both dev and packaged builds.
**Phase to address:** Phase 1 (CLI execution architecture) and Phase 3 (Windows compatibility hardening).

### Pitfall 2: Unsigned Binaries and Defender Reputation Blocking
**What goes wrong:** App, helper binaries, or downloaded plugins are quarantined/blocked by Windows Defender SmartScreen.
**Why it happens:** macOS-first teams delay code signing and trust-chain planning until late.
**Consequences:** "Install succeeded but app/plugin will not launch" in enterprise environments.
**Warning signs:**
- Internal pilot users report unknown publisher warnings or blocked executables.
- Plugin execution works only when Defender is temporarily disabled.
- Security teams request exceptions for routine workflows.
**Prevention strategy:**
- Plan Authenticode signing from the first packaging milestone.
- Sign every executable artifact (app, updater, helper tools, plugin runners).
- Add CI verification to fail builds if signature is missing/invalid.
- Produce enterprise deployment guidance for Defender/EDR allowlisting.
**Phase to address:** Phase 2 (packaging and release pipeline) and Phase 4 (enterprise rollout readiness).

### Pitfall 3: Path Semantics and File System Assumptions
**What goes wrong:** App fails when paths include spaces, long names, UNC paths, or backslashes.
**Why it happens:** macOS implementation assumes `/` separators, short paths, and case-sensitive behavior.
**Consequences:** Broken plugin discovery, failed session logs, and unreliable temp file handling on Windows.
**Warning signs:**
- Path building via string concatenation.
- Relative path assumptions from current working directory.
- Bugs appear only for users under `C:\Users\First Last\...`.
**Prevention strategy:**
- Use Node `path` APIs everywhere; prohibit manual separator logic.
- Normalize/resolve at boundaries and keep internal path objects consistent.
- Add integration tests for spaced paths, long paths, and network-share-like inputs.
**Phase to address:** Phase 1 (core storage/session model) and Phase 3 (cross-platform test matrix).

### Pitfall 4: Encoding and Line-Ending Drift in CLI I/O
**What goes wrong:** Orchestration output parsing fails due to CRLF, UTF-16/CP1252 edge cases, or BOM handling.
**Why it happens:** Parsers tuned against UTF-8 + LF from macOS terminals only.
**Consequences:** False "session failed" states, garbled logs, and plugin output truncation.
**Warning signs:**
- Regex parsers that assume `\n` only.
- Parsing by fragile string split logic around prompts/tokens.
- Non-ASCII user/project names produce intermittent failures.
**Prevention strategy:**
- Normalize line endings and decode streams explicitly before parsing.
- Define robust parser contracts (state-machine or token-based) instead of ad-hoc regex chains.
- Add fixture tests for CRLF and mixed-encoding payloads from real Windows shells.
**Phase to address:** Phase 1 (session protocol/parsing) and Phase 3 (Windows CLI validation).

### Pitfall 5: Installer/Updater Complexity Deferred Too Late
**What goes wrong:** Install and update are reliable on macOS DMG but brittle on Windows MSI/EXE.
**Why it happens:** Packaging is treated as "post-feature" work rather than a first-class stream.
**Consequences:** High support load from low-tech users who cannot self-recover from partial installs.
**Warning signs:**
- No unattended install path for enterprise IT.
- Updater tested only in local dev, not real user privilege contexts.
- Rollback and repair paths are undefined.
**Prevention strategy:**
- Choose Windows installer strategy early (MSI vs NSIS/Squirrel/etc.) based on enterprise constraints.
- Validate install/run/update/rollback flows in clean VMs with standard user privileges.
- Provide one-click diagnostics and "repair install" path in-app.
**Phase to address:** Phase 2 (distribution and update system) and Phase 4 (IT admin deployment docs).

### Pitfall 6: Privilege and Execution Policy Mismatch
**What goes wrong:** Commands require elevated rights or are blocked by PowerShell execution policies.
**Why it happens:** macOS development occurs with permissive local setups; enterprise policies are not modeled.
**Consequences:** Session start fails in production environments while working on developer machines.
**Warning signs:**
- "Works on my machine" but fails on managed endpoints.
- Frequent policy-related stderr (`ExecutionPolicy`, access denied, AppLocker-like behavior).
- Setup docs require manual policy changes.
**Prevention strategy:**
- Design orchestration paths to run under standard user by default.
- Detect and report policy/permission blockers with actionable remediation.
- Collaborate with enterprise security baseline early; avoid requiring global policy relaxations.
**Phase to address:** Phase 2 (runtime prerequisites) and Phase 4 (enterprise compliance and pilot).

## Moderate Pitfalls

### Pitfall 1: Plugin ABI/Runtime Fragmentation
**What goes wrong:** Plugins built/tested on macOS fail on Windows due to native deps or runtime assumptions.
**Warning signs:**
- Plugin contracts are implicit and undocumented.
- Plugin lifecycle hooks rely on shell-specific behavior.
**Prevention strategy:**
- Define strict plugin contract (input/output schema, timeout, exit codes, encoding).
- Prefer process-isolated plugins with versioned capability negotiation.
- Run a plugin certification matrix on both platforms.
**Phase to address:** Phase 2 (plugin SDK/contract) and Phase 3 (cross-platform plugin certification).

### Pitfall 2: UI Error States Too Technical for Target Users
**What goes wrong:** Low-tech enterprise users cannot recover from CLI failures due to cryptic error messages.
**Warning signs:**
- Raw stack traces or shell errors shown directly in UI.
- Support requests ask "what should I click now?"
**Prevention strategy:**
- Map technical failures to guided, plain-language recovery actions.
- Add flow-specific "Try again", "Repair", and "Copy diagnostics" actions.
- Conduct task-based usability checks for install/run/stop/plugin flows.
**Phase to address:** Phase 1 (UX baseline) and Phase 4 (supportability and training).

## Minor Pitfalls

### Pitfall 1: Logging Without Correlation IDs
**What goes wrong:** Difficult triage across Electron UI, main process, and external CLI/plugin logs.
**Warning signs:**
- Impossible to tie one user action to downstream command logs.
**Prevention strategy:**
- Generate a per-session correlation ID and include it across all logs.
- Add one-click export bundle for support escalation.
**Phase to address:** Phase 1 (observability foundation).

### Pitfall 2: Timeouts and Cancellation Not Standardized
**What goes wrong:** Stop session appears successful in UI while child processes keep running.
**Warning signs:**
- Zombie processes after stop.
- Inconsistent timeout values by feature.
**Prevention strategy:**
- Centralize process supervision with explicit timeout/cancel contract.
- Verify graceful shutdown then force-kill fallback per platform.
**Phase to address:** Phase 1 (session lifecycle manager) and Phase 3 (platform-specific process cleanup tests).

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Core command execution | macOS shell assumptions leak into core APIs | Introduce platform command adapter and ban raw shell strings |
| Packaging and trust | Unsigned artifacts blocked by Defender/SmartScreen | Implement full signing pipeline and signature gates in CI |
| Session parser | CRLF/encoding mismatch breaks status detection | Normalize/decode before parse; fixture tests from Windows shells |
| Plugin system | Plugin behavior diverges across OS/runtime | Versioned plugin contract and cross-platform certification matrix |
| Installer/update UX | Non-technical users cannot recover from failed updates | Guided repair flow, rollback path, admin deployment docs |
| Enterprise rollout | Policy/permission blockers discovered too late | Pilot on managed Windows endpoints early with security team |

## Sources

- Microsoft Learn: SmartScreen and code-signing guidance (official platform behavior) - confidence: MEDIUM.
- Microsoft Learn: PowerShell execution policy and enterprise management docs - confidence: MEDIUM.
- Electron official docs: process model, packaging/distribution, and platform notes - confidence: MEDIUM.
- Node.js docs: `child_process`, `path`, and stream handling behavior - confidence: MEDIUM.

Note: This pitfall list is intentionally practical and implementation-driven for roadmap planning. Source links should be added in a follow-up pass if a citation-ready dossier is needed.
