# schema_read

> Read saved composition schemas. Use it when listing saved work or loading a named schema; use schema_store to save or delete one. Returns metadata or the schema with a new process-local schemaRef, valid for 30 minutes. Tool input schemas are separate MCP resources. Full schema: oods://schemas/schema_read.input.json.

Actions: `list`, `load`.

Read saved composition schemas. Use it when listing saved work or loading a named schema; use schema_store to save or delete one. Returns metadata or the schema with a new process-local schemaRef, valid for 30 minutes. Tool input schemas are separate MCP resources. Full schema: oods://schemas/schema_read.input.json.

**Registration:** auto

## Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `action` | `list` \| `load` | Yes |  | Choose list, load. |

## Output Shape

_See tool response._

## Error Codes

Codes this tool can return, derived from the shipped module graph in `@oods/foundry/errors.json`; that file also gives each cause and fix.

| Code | Severity | Description |
|------|----------|-------------|
| `OODS-N001` | error | Unknown tool |
| `OODS-N002` | error | Schema not found |
| `OODS-N003` | error | SchemaRef not found |
| `OODS-N004` | error | SchemaRef expired |
| `OODS-R001` | error | Rate limit exceeded |
| `OODS-R002` | error | Concurrency limit exceeded |
| `OODS-S001` | error | Policy denied |
| `OODS-S002` | error | Execution timeout |
| `OODS-S003` | error | Bad request |
| `OODS-V001` | error | Input validation failed |
| `OODS-V002` | error | Output validation failed |
| `OODS-V003` | error | Missing required field |
| `OODS-V004` | error | Invalid slug format |

## Example Request

```json
{
  "action": "list"
}
```
