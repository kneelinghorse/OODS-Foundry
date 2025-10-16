# Internal Release Readiness

The internal release workflow is mediated by two MCP tools exposed by `@oods/mcp-server`:

- `release.verify` executes the deterministic verification pass. It packs the default workspace packages twice, compares the resulting tarballs, runs lightweight export-map/type sanity checks, and produces a diagnostics bundle alongside a draft changelog. The tool is side-effect free and may be invoked without `apply`.
- `release.tag` is the approval-gated tagging step. It accepts a `tag` such as `v0.0.0-internal.20251015`, performs safety checks (duplicate tags, dirty working tree), and creates a lightweight git tag when `apply` is true. Dry runs report the pending actions plus any warnings.

A typical session looks like:

```json
{ "tool": "release.verify", "input": { "packages": ["@oods/tokens", "@oods/tw-variants", "@oods/a11y-tools"] } }
{ "tool": "release.tag", "input": { "tag": "v0.0.0-internal.20251015", "apply": true } }
```

Both tools emit transcripts and bundle indices under `artifacts/current-state/YYYY-MM-DD/release.*`, enabling the Artifact Viewer to display verification evidence and tag provenance for each run.
