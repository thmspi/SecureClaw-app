---
status: testing
phase: 02-guided-setup-and-install-flows
source: [02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-03-SUMMARY.md]
started: 2026-04-03T10:45:00Z
updated: 2026-04-03T10:45:00Z
---

## Current Test

number: 6
name: Continue Button Requires Passed Prerequisites
expected: |
  On Prerequisites step with all checks passed (green), the "Continue" button is enabled and clickable. It should navigate to the Install step.
awaiting: user response

## Tests

### 1. App Starts and Shows Wizard
expected: Launch the app. The wizard Welcome screen appears with "Welcome to SecureClaw" heading and clear purpose text: OpenClaw is the assistant runtime and NemoClaw is the secure sandbox stack.
result: pass

### 2. Navigate to Prerequisites Step
expected: Click "Get Started" button. Wizard navigates to Prerequisites step showing loading skeletons, then displays check results.
result: pass

### 3. Step Indicator Navigation (D-02)
expected: After visiting Prerequisites step, click back on "Welcome" in the step indicator bar. You should be able to return to completed steps.
result: pass

### 4. Animated Step Transitions (D-03)
expected: Navigate between steps. Each step transition shows a smooth fade and slide animation (not an instant switch).
result: pass

### 5. Prerequisite Checks Run on Mount
expected: Navigate to Prerequisites step. Checks automatically start running (loading skeletons appear, then results populate for Node.js, Python, Disk Space, Permissions, Network).
result: pass

### 6. Re-check Prerequisites (D-08)
expected: On Prerequisites step, click "Re-check" button. Checks run again and update the display with fresh results.
result: pass

### 7. Continue Only When Prerequisites Pass
expected: If any prerequisite fails, the "Continue" button is disabled. All prerequisites must pass (green checkmarks) to proceed to Install step.
result: pass

### 8. Install Step Shows Start Button
expected: Navigate to Install step (after prerequisites pass). Shows a single "Install Now" action that performs sequential installation (OpenClaw first, then NemoClaw) with visible named steps.
result: pass

### 9. Cancel Installation Dialog (D-14)
expected: During install (or at Install step), click "Cancel Installation". A confirmation dialog appears asking "Cancel Installation?" with options to keep installing or confirm cancel.
result: pass

### 10. Progress Display with Logs (D-09, D-10)
expected: When installation runs, progress bar shows current step progress. Expandable "Installation Log" section (collapsible) shows streaming log lines.
result: pass

### 11. Complete Step After Install
expected: After installation finishes successfully, wizard automatically advances to Complete step with success message.
result: pass

### 12. State Persists Across Refresh (D-16)
expected: Partially complete the wizard (e.g., reach Prerequisites step). Refresh the browser/app. The wizard should resume at your previous step, not reset to Welcome.
result: pass

## Summary

total: 12
passed: 5
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps

[none yet]
