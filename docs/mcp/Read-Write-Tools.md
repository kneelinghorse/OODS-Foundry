# Read and write tools in 0.11.0

| Previous tool | Read actions in 0.11.0 | Write actions in 0.11.0 |
| --- | --- | --- |
| object_registry | object_registry: list, show, validate, reload | object_register: register |
| schema_store | schema_read: list, load | schema_store: save, delete |
| component_map | component_map_read: list, resolve, show | component_map: draft, apply, create, update, delete |
| brand_create | brand_read: template, validate, derive, show | brand_create: draft, create, apply |
| object_import | object_import_read: show | object_import: draft, apply |
| design_preview | design_versions: versions | design_preview: render, compare, edit, accept |
| schema_render | schema_render: validate, render | — |

Tool names use lowercase words separated by underscores. A single operation names the thing then its operation. An action family groups only reads or only writes. When retaining an existing write family, its read half ends in `_read`; object_registry remains the established registry read name and object_register performs registration. design_versions describes version inspection. Tool titles explicitly describe the action.

A write changes persistent user or project state, including drafts, caches containing accepted records, generated project adapters, composition versions and acceptance records. Starting the local preview host belongs to the writer. Read-only tools may change in-memory lookup caches and create reply payloads in the designated oversized-reply folder. No write action dispatches through a read-only tool, even as a compatibility alias.

The byte budget remains 85,000 for the serialized default tool array. The earlier 80,000 target grew to 85,000 with object_import in 0.8.0; the six splits fit the existing ceiling by shortening discovery text and reusing full-schema definitions. Detailed contracts remain in TOOL-REFERENCE.md and MCP schema resources. viz_render retains its documented size exception.
