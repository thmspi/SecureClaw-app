# Phase 01 Research

## Scope
Phase 1 establishes the platform/runtime safety foundation for SecureClaw with macOS-first implementation and Windows-ready contracts.

## Inputs Reviewed
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/PROJECT.md`
- `.planning/phases/01-platform-core-and-safety-boundaries/01-CONTEXT.md`
- `.planning/research/ARCHITECTURE.md`
- `.planning/research/STACK.md`
- `.planning/research/SUMMARY.md`
- `.planning/references/phase-01-source-of-truth.md`

## Locked Decisions Applied
- `D-01`, `D-02`: Single shared contract module and stable public platform trio (`runProcess`, `stopProcess`, `getPaths`).
- `D-03`, `D-04`: Graceful->timeout->force stop semantics with structured runtime event stream using correlation IDs.
- `D-05`, `D-06`: Binary resolver precedence and health-report response shape.
- `D-07`, `D-08`: Versioned typed IPC with runtime schema validation and narrow preload API only.

## Requirement Coverage Strategy
- `PLAT-01`: Shared platform contracts plus service implementations that expose only `runProcess`, `stopProcess`, `getPaths`.
- `PLAT-02`: Path resolution service built from Electron app path APIs only; no hardcoded OS paths.
- `PLAT-03`: Shared binary resolver with platform naming support and deterministic precedence.
- `PLAT-04`: Central process runner with timeout and cancellation semantics.
- `SEC-02`: Typed IPC channels + runtime validation + renderer-preload boundary enforcement.

## Recommended Plan Decomposition
1. Define contracts and privileged IPC boundary first (safety root).
2. Implement path and binary resolution services against those contracts.
3. Implement process runtime lifecycle and wire to IPC surface.

## Risks and Mitigations
- Risk: Contract drift across preload/main/services.
  - Mitigation: Single source contract module imported by all boundaries.
- Risk: OS-specific path/process behavior leaks into features.
  - Mitigation: Adapter-style service boundaries and strict API use.
- Risk: Unsafe renderer access to privileged operations.
  - Mitigation: Typed channel validation and no direct renderer privileged calls.

## Research Outcome
Ready for phase planning with three sequential execution plans.

---
*Phase: 01-platform-core-and-safety-boundaries*
*Research synthesized: 2026-04-01*
