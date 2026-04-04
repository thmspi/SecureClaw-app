# Deferred Items

## 2026-04-04 - Plan 04-01

- `npm run type-check` fails in pre-existing renderer/global TypeScript configuration (`--jsx` not set in root `tsconfig.json`, missing DOM libs/window/document types, and unrelated renderer strictness errors). Deferred because this is out-of-scope for contracts/channels in plan 04-01.

## 2026-04-04 - Plan 04-02

- `npm run type-check` still fails with the same pre-existing renderer/global TypeScript configuration errors (`--jsx` not set, missing DOM globals/types, and unrelated renderer strictness issues). Deferred again because diagnostics backend work in plan 04-02 does not touch renderer TypeScript configuration.
