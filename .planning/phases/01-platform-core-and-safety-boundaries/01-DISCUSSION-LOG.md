# Phase 1: Platform Core and Safety Boundaries - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-04-01
**Phase:** 1-platform-core-and-safety-boundaries
**Areas discussed:** Platform API shape, Process lifecycle policy, Binary resolution strategy, IPC boundary strictness

---

## Platform API shape

| Option | Description | Selected |
|--------|-------------|----------|
| Single shared TypeScript contract module | Define typed request/response contracts in one shared module consumed by preload/main/services; enforce this as canonical source of truth. | ✓ |
| IPC-first channel docs + inferred types | Write channel docs and let each layer derive types independently (more drift risk). | |
| Service-first interfaces only | Define main-service interfaces first and adapt IPC around them (less renderer clarity). | |

**User's choice:** Single shared TypeScript contract module
**Notes:** User clarified that implementation needs a clear source of truth.

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal stable trio + typed options | Keep exactly runProcess/stopProcess/getPaths as public platform API; add extensions via optional fields/versioning. | ✓ |
| Broader API now | Add health/probe/list tasks immediately to avoid future interface churn. | |
| Narrower now | Start with runProcess/getPaths only and add stopProcess later. | |

**User's choice:** Minimal stable trio + typed options
**Notes:** Selected stable API surface for Phase 1 boundary.

---

## Process lifecycle policy

| Option | Description | Selected |
|--------|-------------|----------|
| Graceful -> timeout -> force kill | Attempt graceful shutdown first, then enforce timeout and hard terminate; emit state transitions. | ✓ |
| Immediate force kill | Stop quickly but may corrupt in-flight operations/logging. | |
| Graceful only | Never force kill; safer semantics but can leave hung processes. | |

**User's choice:** Graceful -> timeout -> force kill
**Notes:** Lifecycle escalation explicitly locked for downstream planning.

| Option | Description | Selected |
|--------|-------------|----------|
| Structured event stream with correlation IDs | Emit typed events (spawned/stdout/stderr/stopping/exited/error/timeout) tied to one action ID. | ✓ |
| Final status only | Only store end result (success/failure) with minimal event details. | |
| Raw log text only | Persist process output but no typed lifecycle events. | |

**User's choice:** Structured event stream with correlation IDs
**Notes:** Chosen for troubleshooting and UI clarity requirements.

---

## Binary resolution strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Configured path -> bundled -> PATH -> managed cache | Deterministic precedence with explicit diagnostics at each step. | ✓ |
| Bundled first always | Prefer app-shipped binaries over user/system paths. | |
| PATH first | Favor system binaries to reduce app packaging complexity. | |

**User's choice:** Configured path -> bundled -> PATH -> managed cache
**Notes:** Deterministic lookup order locked for implementation planning.

| Option | Description | Selected |
|--------|-------------|----------|
| Structured health result | Return path, version, executable check, failure reason, and remediation hint. | ✓ |
| Boolean pass/fail | Only indicate success/failure; details logged separately. | |
| Throw exceptions only | Use thrown errors and no explicit result object. | |

**User's choice:** Structured health result
**Notes:** Supports plain-language diagnostics requirement later phases need.

---

## IPC boundary strictness

| Option | Description | Selected |
|--------|-------------|----------|
| Versioned typed channels + schema validation | Each privileged action goes through validated typed channels; renderer gets narrow preload API only. | ✓ |
| Typed channels without runtime validation | Rely mainly on TypeScript compile-time checks. | |
| Unversioned channels | Keep simple channel names and evolve ad hoc. | |

**User's choice:** Versioned typed channels + schema validation
**Notes:** Runtime input validation retained as safety boundary.

| Option | Description | Selected |
|--------|-------------|----------|
| No direct privileged access from renderer | Renderer only calls preload methods; no raw ipcRenderer or system APIs exposed. | ✓ |
| Allow limited direct IPC in renderer | Permit selected direct channels for speed. | |
| Temporary broad access during v1 | Looser boundary now, harden later. | |

**User's choice:** No direct privileged access from renderer
**Notes:** Aligns with SEC-02 and security-first architecture.

---

## the agent's Discretion

- Internal naming and module layout for type contracts.
- Exact timeout defaults by operation class.
- Additional optional event fields beyond required lifecycle states.

## Deferred Ideas

None.
