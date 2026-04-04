---
status: partial
phase: 04-diagnostics-security-storage-and-macos-distribution-baseline
source: [04-VERIFICATION.md]
started: 2026-04-04T09:31:43Z
updated: 2026-04-04T09:31:43Z
---

## Current Test

awaiting human testing

## Tests

### 1. Run Settings > Health end-to-end in Electron UI
expected: Health cards auto-refresh about every 10s, manual Refresh works, and retry button only appears for retryable errors.
result: pending

### 2. Run Diagnostics Export from Settings > Health and inspect generated ZIP
expected: ZIP is created, includes expected artifacts, and sensitive fields are redacted in output files.
result: pending

### 3. Execute signed macOS build + notarization + Gatekeeper validation with Apple credentials
expected: Signed/notarized app passes codesign, Gatekeeper, stapler, and launch smoke checks on a produced app artifact.
result: pending

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
