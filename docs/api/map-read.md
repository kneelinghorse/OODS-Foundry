# component_map_read

> Read component substitutions and staged intake evidence. Use it when listing mappings, resolving an external component or reviewing a draftId; use component_map to stage or apply changes. Returns entries, matches or draft evidence including proposed adapters and unmatched elements. Reads local stores without generating adapters or changing project files. Full schema: oods://schemas/component_map_read.input.json.

Actions: `list`, `resolve`, `show`.

Read component substitutions and staged intake evidence. Use it when listing mappings, resolving an external component or reviewing a draftId; use component_map to stage or apply changes. Returns entries, matches or draft evidence including proposed adapters and unmatched elements. Reads local stores without generating adapters or changing project files. Full schema: oods://schemas/component_map_read.input.json.

**Registration:** auto

## Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `action` | `list` \| `resolve` \| `show` | Yes |  | Choose list, resolve, show. |

## Output Shape

_See tool response._

## Error Codes

Codes this tool can return, derived from the shipped module graph in `@oods/foundry/errors.json`; that file also gives each cause and fix.

| Code | Severity | Description |
|------|----------|-------------|
| `OODS-N001` | error | Unknown tool |
| `OODS-R001` | error | Rate limit exceeded |
| `OODS-R002` | error | Concurrency limit exceeded |
| `OODS-S001` | error | Policy denied |
| `OODS-S002` | error | Execution timeout |
| `OODS-S003` | error | Bad request |
| `OODS-V001` | error | Input validation failed |
| `OODS-V002` | error | Output validation failed |
| `OODS-V219` | error | Mapping creation refused |

## Example Request

```json
{
  "action": "list"
}
```
