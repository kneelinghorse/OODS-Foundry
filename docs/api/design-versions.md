# design_versions

> Read a composition's versions and accepted version. Use it when inspecting saved lineage; use design_preview to render, edit, compare or accept. Returns version metadata, latest and acceptance summary. Supply compositionId. Starts no preview host and returns no running URL. Full schema: oods://schemas/design_versions.input.json.

Actions: `versions`.

Read a composition's versions and accepted version. Use it when inspecting saved lineage; use design_preview to render, edit, compare or accept. Returns version metadata, latest and acceptance summary. Supply compositionId. Starts no preview host and returns no running URL. Full schema: oods://schemas/design_versions.input.json.

**Registration:** auto

## Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `action` | `versions` | No |  | Choose versions. |
| `compositionId` | string | Yes |  | An existing composition from design_compose; with no version, its latest version opens. |

## Output Shape

| Field | Type | Always Present | Description |
|-------|------|----------------|-------------|
| `status` | string | Yes |  |
| `action` | string | Yes |  |
| `compositionId` | string | Yes |  |
| `latest` | integer \| null | Yes |  |
| `versions` | object[] | Yes |  |
| `accepted` | any | Yes | The standing acceptance (the last one in accepted.json), or null when no version was accepted. |
| `durationMs` | number | Yes |  |

## Error Codes

Codes this tool can return, derived from the shipped module graph in `@oods/foundry/errors.json`; that file also gives each cause and fix.

| Code | Severity | Description |
|------|----------|-------------|
| `OODS-N001` | error | Unknown tool |
| `OODS-N003` | error | SchemaRef not found |
| `OODS-N004` | error | SchemaRef expired |
| `OODS-N022` | error | Composition or version not found in the store |
| `OODS-R001` | error | Rate limit exceeded |
| `OODS-R002` | error | Concurrency limit exceeded |
| `OODS-S001` | error | Policy denied |
| `OODS-S002` | error | Execution timeout |
| `OODS-S003` | error | Bad request |
| `OODS-V001` | error | Input validation failed |
| `OODS-V002` | error | Output validation failed |
| `OODS-V203` | error | Composition id or version is not well-formed |

## Example Request

```json
{
  "compositionId": "<compositionId>"
}
```
