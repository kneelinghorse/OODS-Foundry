# brand_read

> Read brand templates, validate documents, derive recipes or inspect staged drafts. Use it when preparing a brand without saving; use brand_create to stage or create it. Returns complete template slots, validation findings, a recipe with provenance and gaps, or draft evidence. derive takes exactly one of tokens, css or absolute cssPath. Template replies use compact JSON so all themes fit inline. Full schema: oods://schemas/brand_read.input.json.

Actions: `template`, `validate`, `derive`, `show`.

Read brand templates, validate documents, derive recipes or inspect staged drafts. Use it when preparing a brand without saving; use brand_create to stage or create it. Returns complete template slots, validation findings, a recipe with provenance and gaps, or draft evidence. derive takes exactly one of tokens, css or absolute cssPath. Template replies use compact JSON so all themes fit inline. Full schema: oods://schemas/brand_read.input.json.

**Registration:** auto

## Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `action` | `template` \| `validate` \| `derive` \| `show` | Yes |  | Choose template, validate, derive, show. |

## Output Shape

_See tool response._

## Error Codes

Codes this tool can return, derived from the shipped module graph in `@oods/foundry/errors.json`; that file also gives each cause and fix.

| Code | Severity | Description |
|------|----------|-------------|
| `OODS-C005` | error | A brand with this id already exists; create never replaces a brand |
| `OODS-N001` | error | Unknown tool |
| `OODS-N011` | error | Token data missing |
| `OODS-N024` | error | The brand template is not built; run the token build |
| `OODS-N025` | error | Creating a brand needs a brands folder (OODS_BRANDS_DIR) or a source checkout, and the token build |
| `OODS-R001` | error | Rate limit exceeded |
| `OODS-R002` | error | Concurrency limit exceeded |
| `OODS-S001` | error | Policy denied |
| `OODS-S002` | error | Execution timeout |
| `OODS-S003` | error | Bad request |
| `OODS-S022` | error | Token build failed after a brand was created; the brand was removed |
| `OODS-V001` | error | Input validation failed |
| `OODS-V002` | error | Output validation failed |
| `OODS-V216` | error | Brand does not validate; nothing was written |

## Example Request

```json
{
  "action": "template"
}
```
