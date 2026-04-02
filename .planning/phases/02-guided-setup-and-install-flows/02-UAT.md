---
status: testing
phase: 02-guided-setup-and-install-flows
source: [02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-03-SUMMARY.md]
started: 2026-04-03T10:45:00Z
updated: 2026-04-03T10:45:00Z
---

## Current Test

number: 1
name: App Starts and Shows Wizard
expected: |
  Launch the app (`npm run dev` or built package). The wizard Welcome screen appears with "Welcome to SecureClaw" heading and OpenClaw/NemoClaw selection cards.
awaiting: user response

## Tests

### 1. App Starts and Shows Wizard
expected: Launch the app. The wizard Welcome screen appears with "Welcome to SecureClaw" heading and OpenClaw/NemoClaw selection cards.
result: [pending]

### 2. Select Installation Target
expected: Click on OpenClaw or NemoClaw card. The selection is highlighted and "Continue" button becomes enabled.
result: [pending]

### 3. Step Indicator Navigation (D-02)
expected: After visiting Prerequisites step, click back on "Welcome" in the step indicator bar. You should be able to return to completed steps.
result: [pending]

### 4. Animated Step Transitions (D-03)
expected: Navigate between steps. Each step transition shows a smooth fade and slide animation (not an instant switch).
result: [pending]

### 5. Prerequisite Checks Run on Mount
expected: Navigate to Prerequisites step. Checks automatically start running (loading skeletons appear, then results populate for Node.js, Python, Disk Space, Permissions, Network).
result: [pending]

### 6. Re-check Prerequisites (D-08)
expected: On Prerequisites step, click "Re-check" button. Checks run again and update the display with fresh results.
result: [pending]

### 7. Continue Only When Prerequisites Pass
expected: If any prerequisite fails, the "Continue" button is disabled. All prerequisites must pass (green checkmarks) to proceed to Install step.
result: [pending]

### 8. Install Step Shows Start Button
expected: Navigate to Install step (after prerequisites pass or with mock data). Shows the install target name and "Install [OpenClaw/NemoClaw]" button.
result: [pending]

### 9. Cancel Installation Dialog (D-14)
expected: During install (or at Install step), click "Cancel Installation". A confirmation dialog appears asking "Cancel Installation?" with options to keep installing or confirm cancel.
result: [pending]

### 10. Progress Display with Logs (D-09, D-10)
expected: When installation runs, progress bar shows current step progress. Expandable "Installation Log" section (collapsible) shows streaming log lines.
result: [pending]

### 11. Complete Step After Install
expected: After installation finishes successfully, wizard automatically advances to Complete step with success message.
result: [pending]

### 12. State Persists Across Refresh (D-16)
expected: Partially complete the wizard (e.g., reach Prerequisites step). Refresh the browser/app. The wizard should resume at your previous step, not reset to Welcome.
result: [pending]

## Summary

total: 12
passed: 0
issues: 0
pending: 12
skipped: 0
blocked: 0

## Gaps

[none yet]
