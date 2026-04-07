# Deferred Items

## 2026-04-03

- `npm test` fails in install-state/orchestrator suites due `better-sqlite3` native ABI mismatch (`NODE_MODULE_VERSION 145` vs runtime `127`).
  - Impact: Full-suite verification cannot complete in current environment.
  - Scope note: unrelated to plan `03-02` plugin runtime changes.
- `npm test` picks up generated `.d.ts` files under `src/**/__tests__` and fails with "Your test suite must contain at least one test."
  - Impact: Additional unrelated suite failures outside plugin runtime scope.
  - Scope note: Jest configuration issue is pre-existing and not introduced by this plan.
