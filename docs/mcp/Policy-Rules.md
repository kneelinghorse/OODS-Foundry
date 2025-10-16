# MCP Policy Rules (v1.0)

Source: `packages/mcp-server/src/security/policy.json`

- Roles: `designer`, `maintainer`
- Per-tool rules: `allow` roles, `writes` allowlists, and optional `timeoutMs`, `ratePerMinute`, `concurrency`
- Limits: default concurrency, token-bucket rate, and timeout (used when a rule does not override)
- Redactions: applied to transcripts and recorded in `transcript.json`

Example policy (excerpt):

```
{
  "artifactsBase": "artifacts/current-state",
  "roles": ["designer", "maintainer"],
  "rules": [
    { "tool": "brand.apply", "allow": ["designer", "maintainer"], "writes": ["${BASE}/${DATE}/**"], "timeoutMs": 120000, "ratePerMinute": 12 },
    { "tool": "diag.snapshot", "allow": ["designer", "maintainer"], "writes": ["${BASE}/${DATE}/**"], "timeoutMs": 120000, "ratePerMinute": 12 },
    { "tool": "release.verify", "allow": ["maintainer"], "writes": ["${BASE}/${DATE}/**"], "timeoutMs": 180000, "ratePerMinute": 6 },
    { "tool": "release.tag", "allow": ["maintainer"], "writes": ["${BASE}/${DATE}/**"], "timeoutMs": 60000, "ratePerMinute": 6 },
    { "tool": "reviewKit.create", "allow": ["designer", "maintainer"], "writes": ["${BASE}/${DATE}/**"], "timeoutMs": 90000, "ratePerMinute": 30 },
    { "tool": "billing.reviewKit", "allow": ["designer", "maintainer"], "writes": ["${BASE}/${DATE}/**"], "timeoutMs": 120000, "ratePerMinute": 20 },
    { "tool": "billing.switchFixtures", "allow": ["designer", "maintainer"], "writes": ["${BASE}/${DATE}/**"], "timeoutMs": 90000, "ratePerMinute": 20 },
    { "tool": "*", "allow": ["designer", "maintainer"], "writes": ["${BASE}/${DATE}/**"], "readOnly": false }
  ],
  "limits": { "defaultTimeoutMs": 120000, "concurrency": 1, "ratePerMinute": 60 },
  "redactions": ["$HOME", "GITHUB_TOKEN", "/Users/*/secrets/*", "CHROMATIC_PROJECT_TOKEN"]
}
```

Enforcement (stdio):

- Message shape: `{ id, tool, input, role? }` (default role: `designer`)
- Pre-exec checks: `POLICY_DENIED` → not in `allow`
- Rate/concurrency: `RATE_LIMIT` or `CONCURRENCY`
- Timeout: `TIMEOUT { timeoutMs }`
- Schema errors: `SCHEMA_INPUT` / `SCHEMA_OUTPUT`
- Unexpected server exits: `RUN_ERROR`

Artifacts are confined to `artifacts/current-state/YYYY-MM-DD/<tool>`.
