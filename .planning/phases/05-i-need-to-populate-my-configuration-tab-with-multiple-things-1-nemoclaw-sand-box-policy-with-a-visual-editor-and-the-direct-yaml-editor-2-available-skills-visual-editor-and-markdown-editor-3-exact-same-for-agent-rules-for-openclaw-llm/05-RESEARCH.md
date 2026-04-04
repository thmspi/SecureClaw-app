# Phase 5: I need to populate my configuration tab with multiple things : 1) Nemoclaw sand box policy, with a visual editor and the direct yaml editor 2) Available skills (visual editor and markdown editor) 3) Exact same for agent, rules, ... for openclaw llm - Research

**Researched:** 2026-04-04
**Domain:** Configuration UX + typed config editing for NemoClaw policy and OpenClaw skills/agent/rules
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

No `05-CONTEXT.md` exists yet for this phase, so no locked decisions were provided at research time.

### Locked Decisions
None documented.

### Claude's Discretion
- Define the canonical config data model per surface (NemoClaw policy YAML, OpenClaw JSON5 config, workspace markdown files).
- Choose the dual-editor architecture (visual + raw text) and safety guardrails.
- Choose validation/apply workflows and update propagation model.

### Deferred Ideas (OUT OF SCOPE)
None explicitly documented for Phase 5.
</user_constraints>

## Summary

Phase 5 should be implemented as a dedicated configuration domain in SecureClaw, not as ad-hoc editors. You need three config families with different shapes and persistence models: NemoClaw sandbox policy YAML (`openclaw-sandbox.yaml`), OpenClaw runtime config JSON5 (`~/.openclaw/openclaw.json`), and workspace markdown files (`SKILL.md`, `AGENTS.md`, `SOUL.md`, and related bootstrap files). The key planning risk is data loss when switching between visual and raw modes.

The safest implementation pattern is a single canonical in-memory model per document, with two synchronized projections: visual form editor and raw text editor. Raw-mode writes must pass parser + schema validation before apply. OpenClaw already exposes schema and validation commands (`openclaw config schema`, `openclaw config validate`) and its own Control UI uses schema-form rendering with guarded config writes; SecureClaw should mirror this operating model.

NemoClaw policy editing must explicitly separate static policy edits (persisted file + `nemoclaw onboard`) from dynamic policy updates (`openshell policy set`) because dynamic policy changes are session-scoped and do not persist by default. Since `nemoclaw` and `openshell` are not available on this machine right now, planning should include fallbacks and clear "not available" states.

**Primary recommendation:** Build a typed `configuration:v1` IPC/service layer with document adapters (JSON5, YAML, Markdown+frontmatter), schema-backed visual forms, raw editor fallback, and explicit validate/apply pipelines per config family.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@monaco-editor/react` + `monaco-editor` | 4.7.0 / 0.55.1 (2025-02-13 / 2025-11-20) | Raw editors for YAML, Markdown, and JSON5 | One editor stack for all raw modes; stable React integration. |
| `monaco-yaml` | 5.4.1 (2026-02-12) | YAML language support and schema validation in Monaco | Required for policy YAML diagnostics and completion. |
| `yaml` | 2.8.3 (2026-03-21) | Parse/stringify NemoClaw policy YAML | Robust YAML handling; avoids brittle regex transforms. |
| `@rjsf/core` + `@rjsf/validator-ajv8` | 6.4.2 / 6.4.2 (2026-03-28) | Schema-driven visual forms for OpenClaw config and policy sections | Fast path to visual editor from schemas, lower custom form code. |
| `gray-matter` | 4.0.3 (2021-04-24) | Parse `SKILL.md` frontmatter + markdown body | De-facto parser for markdown frontmatter workflows. |
| `json5` | 2.2.3 (2022-12-31) | Parse/stringify OpenClaw JSON5 config safely | OpenClaw config format is JSON5 (comments + trailing commas). |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Existing `zod` (project dependency) | 4.3.6 (in repo) | IPC request/response validation | Reuse existing typed IPC pattern. |
| Existing `zustand` (project dependency) | 5.0.12 (in repo) | Renderer config editing state and dirty tracking | Keep state architecture consistent with current app. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Monaco + `monaco-yaml` | CodeMirror 6 + YAML/Markdown plugins | Smaller bundle, but less consistent with JSON schema workflows already used in OpenClaw Control UI patterns. |
| `@rjsf/*` forms | Hand-built React forms per section | More UX control, but much higher implementation and maintenance cost for deeply nested schemas. |
| `gray-matter` for markdown frontmatter | Unified/remark frontmatter pipeline | More extensible AST path, but overkill for current "edit metadata + markdown body" scope. |

**Installation:**
```bash
npm install @monaco-editor/react monaco-editor monaco-yaml yaml @rjsf/core @rjsf/validator-ajv8 gray-matter json5
```

**Version verification:**
```bash
npm view @monaco-editor/react version
npm view monaco-editor version
npm view monaco-yaml version
npm view yaml version
npm view @rjsf/core version
npm view @rjsf/validator-ajv8 version
npm view gray-matter version
npm view json5 version
```

## Architecture Patterns

### Recommended Project Structure
```text
src/
├── main/
│   ├── configuration/
│   │   ├── openclaw-config-service.ts     # JSON5 load/validate/save/apply
│   │   ├── nemoclaw-policy-service.ts     # YAML load/validate/apply adapters
│   │   ├── workspace-docs-service.ts      # skills/agents/rules markdown files
│   │   └── config-adapters/               # parser + serializer per format
│   └── ipc/
│       └── configuration-router.ts        # configuration:v1:* channels
├── shared/
│   ├── configuration/
│   │   └── configuration-contracts.ts     # typed request/response models
│   └── ipc/
│       └── configuration-channels.ts      # zod schemas + versioned channels
├── preload/
│   └── platform-api.ts                    # window.secureClaw.configuration
└── renderer/
    ├── pages/management/
    │   └── ConfigurationPanel.tsx         # tab shell + section cards
    └── stores/
        └── configuration-store.ts         # dual-mode edit + dirty/error state
```

### Pattern 1: Per-Domain Document Adapters
**What:** One adapter per config family: JSON5 (`openclaw.json`), YAML (`openclaw-sandbox.yaml`), Markdown+frontmatter (`SKILL.md`).
**When to use:** Every load/save/validate path.
**Example:**
```typescript
// Source: openclaw config format is JSON5 + local `openclaw config schema` support
type ConfigDocKind = 'openclaw-json5' | 'nemoclaw-policy-yaml' | 'skill-markdown';
```

### Pattern 2: Safe Dual-Mode Editing
**What:** Visual and raw editors edit the same canonical object; mode-switch only when conversion is lossless.
**When to use:** All editable configuration surfaces.
**Example:**
```typescript
// Inspired by OpenClaw Control UI behavior (schema form + raw editor guard)
interface EditorState<T> {
  model: T;
  rawText: string;
  visualDirty: boolean;
  rawDirty: boolean;
  hasRoundTripRisk: boolean;
}
```

### Pattern 3: Validate-Then-Apply Pipeline
**What:** Separate `saveDraft` and `apply` operations; `apply` runs domain-specific validation commands/checks first.
**When to use:** Before writing/activating config changes.
**Example:**
```bash
# OpenClaw config validation
openclaw config validate --json
```

### Pattern 4: Typed IPC Boundary for Config Actions
**What:** Add versioned config channels (`configuration:v1:*`) with zod input schemas and typed result envelopes.
**When to use:** All renderer-initiated config operations.
**Example:**
```typescript
export const CONFIG_CHANNELS = {
  listDocuments: 'configuration:v1:listDocuments',
  loadDocument: 'configuration:v1:loadDocument',
  validateDocument: 'configuration:v1:validateDocument',
  saveDocument: 'configuration:v1:saveDocument',
  applyDocument: 'configuration:v1:applyDocument',
} as const;
```

### Pattern 5: Static vs Dynamic NemoClaw Policy Modes
**What:** Make policy mode explicit: `static` (file + onboard) vs `dynamic` (live `openshell policy set`).
**When to use:** NemoClaw policy actions.
**Example:**
```bash
# static persistence
nemoclaw onboard

# dynamic session update
openshell policy set <policy-file>
```

### Anti-Patterns to Avoid
- **Regex editing config files:** breaks JSON5/YAML/frontmatter semantics.
- **Single parser for all docs:** JSON5, YAML, and markdown frontmatter have different guarantees.
- **Immediate write-on-keystroke:** high risk for broken config and partial writes.
- **No mode-switch guard:** visual/raw switching can silently drop unsupported constructs.
- **Treating dynamic policy as persisted:** leads to false safety after sandbox restart.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML parsing/serialization | Custom line-based parser | `yaml` + schema validation | Avoids syntax edge cases and comment/structure corruption. |
| JSON5 parsing | `JSON.parse` fallback hacks | `json5` | OpenClaw config is JSON5, not strict JSON. |
| Frontmatter extraction | Manual delimiter splitting | `gray-matter` | Reliable metadata/body split for `SKILL.md`. |
| Complex nested visual forms | Bespoke field-by-field forms | `@rjsf/core` + `@rjsf/validator-ajv8` | Faster delivery, consistent schema-driven validation. |
| Editor diagnostics plumbing | Hand-built raw text highlighting | Monaco + `monaco-yaml` | Mature diagnostics and completions out of the box. |

**Key insight:** The core complexity is format correctness and safe mode transitions, not rendering textareas. Use parser/schema tooling and keep business logic in typed adapters.

## Common Pitfalls

### Pitfall 1: Confusing OpenClaw "rules" with OpenClaw config `rules` arrays
**What goes wrong:** Team mixes workspace behavior rules (`AGENTS.md` standing orders) with config-specific rule arrays (for channels/tools/security scopes).
**Why it happens:** Same term, different storage and semantics.
**How to avoid:** Treat "agent/rules" as two explicit document types in UI: workspace markdown rules vs JSON5 config rule arrays.
**Warning signs:** Requirements use "rules" without naming file/path.

### Pitfall 2: Losing data on visual/raw editor switch
**What goes wrong:** Comments, unsupported fields, or ordering vanish.
**Why it happens:** One-way serialization with no round-trip guard.
**How to avoid:** Track parse fidelity and disable unsafe switch/apply paths.
**Warning signs:** Diff shows unrelated deletions after simple edits.

### Pitfall 3: Assuming NemoClaw dynamic policy changes are permanent
**What goes wrong:** Policy appears active but disappears after restart.
**Why it happens:** `openshell policy set` session behavior misunderstood.
**How to avoid:** Label dynamic changes as temporary and provide "persist to baseline" workflow.
**Warning signs:** Restart restores old egress behavior.

### Pitfall 4: Editing OpenClaw config as strict JSON
**What goes wrong:** User comments/trailing commas break parse/write.
**Why it happens:** Config parser does not support JSON5.
**How to avoid:** Always parse/write with JSON5-compatible tooling and run `openclaw config validate`.
**Warning signs:** `openclaw config validate` fails after seemingly valid saves.

### Pitfall 5: Skills metadata validation mismatch
**What goes wrong:** Skills appear installed but are not eligible/active.
**Why it happens:** `SKILL.md` metadata/frontmatter shape violates OpenClaw expectations (single-line frontmatter constraints, missing required metadata).
**How to avoid:** Validate `SKILL.md` frontmatter and metadata keys before save.
**Warning signs:** `openclaw skills list` shows skill as disabled/ineligible after edit.

## Code Examples

Verified patterns from official docs and local runtime behavior:

### OpenClaw Skills Config Shape (JSON5)
```json5
{
  skills: {
    entries: {
      "image-lab": {
        apiKey: { source: "env", provider: "default", id: "GEMINI_API_KEY" },
        env: { GEMINI_API_KEY: "..." },
      },
    },
  },
}
```

### SKILL.md Frontmatter + Body Parsing
```typescript
import matter from 'gray-matter';

const parsed = matter(skillMarkdown);
const metadata = parsed.data;   // frontmatter
const instructions = parsed.content; // markdown body
```

### NemoClaw Network Policy Block (YAML Concept)
```yaml
network_policies:
  github_repos:
    endpoints:
      - host: api.github.com
        port: 443
        protocol: rest
        rules:
          - allow: { method: GET, path: "/**" }
    binaries:
      - { path: /usr/bin/gh }
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual file editing for OpenClaw/NemoClaw config | Schema-backed config editing with validate/apply pipeline | OpenClaw Control UI era (2025-2026 docs) | Safer writes, fewer broken configs, better UX parity. |
| Unscoped network allowlists | Binary-scoped + method/path-scoped policy rules | Current NemoClaw/OpenShell docs (2026) | Much stronger egress control and reduced exfiltration surface. |
| Skills as opaque markdown files | AgentSkills-compatible `SKILL.md` + metadata gating + config overrides | Current OpenClaw skills system | Enables reliable eligibility checks and structured visual editing. |

**Deprecated/outdated:**
- Treating OpenClaw config as strict JSON instead of JSON5.
- Treating dynamic OpenShell policy updates as permanent baseline changes.

## Open Questions

1. **What exactly is in-scope for "rules" in this phase?**
   - What we know: OpenClaw docs position `AGENTS.md` as the place for behavior rules/standing orders; config schema also has multiple `rules` arrays for specific features.
   - What's unclear: Whether user wants only workspace markdown rules, only JSON5 config rules, or both.
   - Recommendation: Lock this in Phase 5 CONTEXT before planning tasks.

2. **Should SecureClaw apply live NemoClaw policy updates or only edit baseline files?**
   - What we know: Static and dynamic policy paths are distinct; dynamic updates are session-scoped.
   - What's unclear: Desired operator workflow and risk posture for live apply.
   - Recommendation: Plan both modes, with dynamic mode gated behind explicit warning and availability checks.

3. **How much of OpenClaw's massive config schema should be visualized in Phase 5?**
   - What we know: Schema is large; full-surface visual editing is high effort.
   - What's unclear: Minimum section set for v1 of Configuration tab.
   - Recommendation: Scope visual editor to targeted subsections first (`skills`, `agents.defaults.sandbox`, `agents.list`) with raw fallback for all others.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `openclaw` CLI | OpenClaw config/skills/agents introspection and validation | ✓ | `OpenClaw 2026.4.1 (da64a97)` | — |
| OpenClaw config file (`~/.openclaw/openclaw.json`) | OpenClaw config editor | ✓ | Present | — |
| OpenClaw workspace (`~/.openclaw/workspace`) | Agent/rules markdown file editing | ✗ | — | Let user pick/create workspace path before enabling editor |
| `nemoclaw` CLI | Static policy apply (`nemoclaw onboard`) flows | ✗ | — | File editing only; mark apply unavailable |
| `openshell` CLI | Dynamic policy apply (`openshell policy set`) | ✗ | — | Disable dynamic apply; retain export/download policy file |
| Node.js | Renderer/main build and tooling | ✓ | `v22.22.2` | — |
| npm | Package/install + version verification | ✓ | `10.9.7` | — |

**Missing dependencies with no fallback:**
- None for planning and UI build itself.

**Missing dependencies with fallback:**
- `nemoclaw` and `openshell` (use "edit/export only" mode and explicit unavailable status).
- Workspace path missing (prompt user to select/create target workspace root).

## Sources

### Primary (HIGH confidence)
- OpenClaw Configuration Reference (JSON5 format, `agents.*`, `skills.*`): https://docs.openclaw.ai/gateway/configuration-reference
- OpenClaw Skills docs (locations, precedence, `SKILL.md` format, metadata/gating): https://docs.openclaw.ai/tools/skills
- OpenClaw Standing Orders (rules in `AGENTS.md`): https://docs.openclaw.ai/automation/standing-orders
- OpenClaw Agent Workspace (bootstrap files and workspace semantics): https://docs.openclaw.ai/concepts/agent-workspace
- OpenClaw Control UI (schema form + raw editor + config write guard patterns): https://docs.openclaw.ai/web/control-ui
- NemoClaw Network Policies reference (deny-by-default, baseline file, dynamic updates): https://docs.nvidia.com/nemoclaw/0.0.8/reference/network-policies.html
- NemoClaw policy customization guide (static vs dynamic updates and presets): https://docs.nvidia.com/nemoclaw/0.0.8/network-policy/customize-network-policy.html
- OpenShell sandbox policy docs (policy set/get, rules model, global policy behavior): https://docs.nvidia.com/openshell/latest/sandboxes/policies.html
- Local runtime verification via CLI (`openclaw --version`, `openclaw config --help`, `openclaw config schema`, `openclaw skills list --json`, `openclaw agents list --json`)

### Secondary (MEDIUM confidence)
- RJSF documentation (schema-driven forms): https://rjsf-team.github.io/react-jsonschema-form/docs/
- npm package docs for editor/parser tooling:
  - https://www.npmjs.com/package/@monaco-editor/react
  - https://www.npmjs.com/package/monaco-yaml
  - https://eemeli.org/yaml/
  - https://www.npmjs.com/package/gray-matter
  - https://www.npmjs.com/package/json5

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM - package/tooling choices are strong, but UX scope boundaries are not yet locked.
- Architecture: HIGH - aligns with existing SecureClaw typed IPC/store patterns and upstream OpenClaw config workflows.
- Pitfalls: HIGH - directly supported by official OpenClaw/NemoClaw/OpenShell docs and local CLI behavior.

**Research date:** 2026-04-04
**Valid until:** 2026-04-11 (fast-moving upstreams; NemoClaw is alpha and OpenClaw schema evolves quickly)

**Validation Architecture:** Omitted intentionally because `.planning/config.json` sets `workflow.nyquist_validation` to `false`.
