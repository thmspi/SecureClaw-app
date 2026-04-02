# Phase 01 Source of Truth References

These upstream sources are treated as canonical references for implementing basic installation and management capabilities (policy, skills, plugins, agents, MCP) in SecureClaw.

## Repositories and Product Docs

- OpenClaw repository: https://github.com/openclaw/openclaw
- NemoClaw repository: https://github.com/NVIDIA/NemoClaw
- OpenClaw product docs/site: https://openclaw.ai/

## Product Intent (Canonical)

- **OpenClaw** is the personal AI assistant runtime/CLI users ultimately operate.
- **NemoClaw** is the NVIDIA reference stack that runs OpenClaw with OpenShell-based sandboxing and hardened controls.
- SecureClaw's install flow should make this explicit and perform installation in sequence: OpenClaw first, then NemoClaw, with verification after each.

## Usage Notes

- SecureClaw integration and management behavior should align with these upstream definitions.
- Any mismatch found during implementation should be logged and reconciled in planning before coding.
