Security Model (v0.1)

- DRY-RUN default; writes require apply=true
- Allowed write root: artifacts/current-state/YYYY-MM-DD/
- Redactions applied to transcripts (tokens/paths)
- Max output size and timeouts enforced by policy.json
- No shell interpolation; all paths validated under allowlist

