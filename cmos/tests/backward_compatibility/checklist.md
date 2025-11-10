# Backward Compatibility Checklist

- [ ] Validate `Build.Implementation.v1.yaml` runs with no additional configuration
- [ ] Confirm agents.md remains optional for legacy projects
- [ ] Ensure new context loaders do not require telemetry runtime changes
- [ ] Verify security guardrails allow existing safe patterns
- [ ] Record results in `telemetry/events/testing-summary.json`
