# MCP Policy Rules (v1.1)

Sources of truth:

- `packages/mcp-server/src/security/policy.json` guards server-side MCP execution (rate, concurrency, artifact base).
- `configs/agent/policy.json` mirrors the allowlist for bridge/Panel/CLI connectors and encodes approval semantics.

Shared pillars:

- Roles: `designer`, `maintainer` (`role` defaults to `designer` when omitted).
- Limits: default concurrency `1`, token bucket per tool (`ratePerMinute`) with optional overrides.
- Defaults: unspecified `modes`, `approval`, `ratePerMinute`, or `concurrency` inherit from the `defaults` block (`["dry-run"]`, optional approval, 12 RPM, single concurrency).
- Redactions: sanitized values land in transcripts and diagnostics.
- Tools declare `modes` (`dry-run`, `apply`) and `approval` (`required`, `optional`) so the bridge can enforce dry-run→approval promotion.

Bridge policy excerpt (`configs/agent/policy.json`):

```
{
  "approvals": {
    "header": "X-Bridge-Approval",
    "tokens": { "granted": "granted", "denied": "denied" }
  },
  "defaults": {
    "modes": ["dry-run"],
    "approval": "optional",
    "ratePerMinute": 12,
    "concurrency": 1
  },
  "limits": {
    "ratePerMinute": 60,
    "concurrency": 1
  },
  "tools": [
    {
      "name": "diag.snapshot",
      "description": "Diagnostics snapshot (artifacts + bundle index)",
      "modes": ["dry-run"],
      "approval": "optional",
      "allow": ["designer", "maintainer"],
      "ratePerMinute": 12
    },
    {
      "name": "reviewKit.create",
      "description": "Creates review kit bundle for stories or contexts",
      "modes": ["dry-run", "apply"],
      "approval": "required",
      "allow": ["designer", "maintainer"],
      "ratePerMinute": 20
    },
    {
      "name": "brand.apply",
      "description": "Applies brand tokens to repository artifacts",
      "modes": ["dry-run", "apply"],
      "approval": "required",
      "allow": ["designer", "maintainer"],
      "ratePerMinute": 12
    },
    {
      "name": "billing.reviewKit",
      "description": "Builds billing review kit bundle",
      "modes": ["dry-run", "apply"],
      "approval": "required",
      "allow": ["designer", "maintainer"],
      "ratePerMinute": 20
    },
    {
      "name": "billing.switchFixtures",
      "description": "Switches billing fixtures in repo contexts",
      "modes": ["dry-run", "apply"],
      "approval": "required",
      "allow": ["designer", "maintainer"],
      "ratePerMinute": 20
    },
    { "name": "purity.audit", "modes": ["dry-run"], "approval": "optional", "allow": ["designer", "maintainer"], "ratePerMinute": 6 },
    { "name": "vrt.run", "modes": ["dry-run"], "approval": "optional", "allow": ["designer", "maintainer"], "ratePerMinute": 6 },
    { "name": "a11y.scan", "modes": ["dry-run"], "approval": "optional", "allow": ["designer", "maintainer"], "ratePerMinute": 6 },
    { "name": "release.verify", "modes": ["dry-run"], "approval": "optional", "allow": ["maintainer"], "ratePerMinute": 6 },
    { "name": "release.tag", "modes": ["dry-run", "apply"], "approval": "required", "allow": ["maintainer"], "ratePerMinute": 6 },
    { "name": "tokens.build", "modes": ["dry-run"], "approval": "optional", "allow": ["designer", "maintainer"], "ratePerMinute": 12 }
  ],
  "connectors": [
    {
      "id": "claude.remote-mcp",
      "provider": "anthropic",
      "role": "designer",
      "defaultMode": "dry-run",
      "tools": ["diag.snapshot", "reviewKit.create", "brand.apply", "billing.reviewKit", "billing.switchFixtures"]
    },
    {
      "id": "openai.agents",
      "provider": "openai",
      "role": "designer",
      "defaultMode": "dry-run",
      "tools": ["diag.snapshot", "brand.apply", "reviewKit.create"]
    }
  ]
}
```

Runtime guarantees:

- Dry runs never include the approval header and execute with `input.apply=false`.
- Apply mode checks that the tool advertises `"modes": ["dry-run","apply"]` **and** that the header matches a `tokens.granted` value; otherwise `POLICY_DENIED` returns with `docs/mcp/Policy-UX.md` guidance.
- Denied tokens (for example `"denied"`) propagate as `APPROVAL_DENIED` so Panel/CLI surfaces can show next steps.
- Every response (success or denial) carries an `incidentId` plus the shared `correlationId` so diagnostics, transcripts, soak reports, and telemetry JSONL entries line up.
- Panel queue metadata mirrors policy fields (approval requirement, incident ID, diagnostics path) so operators can replay or deny runs without losing provenance.

See `docs/mcp/Policy-UX.md` for user-facing messaging and `scripts/agent/approval.ts` for the dry-run→apply helper workflow.
