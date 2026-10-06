/**
 * OODS Foundry Error Code Registry — v1
 *
 * Code format:
 *   OODS-V{NNN}  validation errors   (bad input, schema mismatch)
 *   OODS-N{NNN}  not-found errors     (missing entity, expired ref)
 *   OODS-C{NNN}  conflict errors      (duplicate, state clash)
 *   OODS-S{NNN}  server errors        (infrastructure, timeout)
 *   OODS-R{NNN}  rate-limit errors    (throttle, concurrency)
 *
 * Commitment: registered codes will not be renamed or reassigned
 * without a deprecation period of at least one minor version.
 */

import { randomUUID } from 'node:crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ErrorCategory =
  | 'validation'
  | 'not_found'
  | 'conflict'
  | 'server_error'
  | 'rate_limit';

export interface ErrorDefinition {
  code: string;
  category: ErrorCategory;
  message: string;
  retryable: boolean;
  severity: 'error' | 'warning' | 'error-or-warning';
  cause: string;
  fix: string;
}

export interface StructuredError {
  code: string;
  category: ErrorCategory;
  message: string;
  retryable: boolean;
  details?: unknown;
  incidentId: string;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const registry: ReadonlyMap<string, ErrorDefinition> = new Map<string, ErrorDefinition>([

  ['OODS-W001', { code: 'OODS-W001', category: 'validation', message: 'Fragment output ignores document scope options', retryable: false, severity: 'warning',
    cause: 'Fragment output was requested with document-only options.',
    fix: 'Request document output to apply those options, or remove them for fragments.' }],
  ['OODS-W002', { code: 'OODS-W002', category: 'validation', message: 'Non-strict fragments reclassify unknown-component errors per node', retryable: false, severity: 'warning',
    cause: 'Non-strict fragment rendering moved unknown-component failures to individual nodes.',
    fix: 'Replace the unknown components or inspect each fragment error before using the output.' }],
  ['OODS-W003', { code: 'OODS-W003', category: 'validation', message: 'A dry-run render returns no HTML', retryable: false, severity: 'warning',
    cause: 'The render ran as a dry run and returned validation without HTML.',
    fix: 'Set apply to true to receive rendered HTML.' }],

  // ── Validation: Input & Schema ──────────────────────────────────────────
  ['OODS-V001', { code: 'OODS-V001', category: 'validation', message: 'Input validation failed', retryable: true, severity: 'error',
    cause: 'The input does not satisfy the tool schema or a declared input constraint.',
    fix: 'Correct the named fields using the tool schema and the returned details.' }],
  ['OODS-V002', { code: 'OODS-V002', category: 'validation', message: 'Output validation failed', retryable: false, severity: 'error',
    cause: 'The handler returned a value that does not satisfy its output schema.',
    fix: 'Report the incident and output-validation details to the runtime maintainer.' }],
  ['OODS-V003', { code: 'OODS-V003', category: 'validation', message: 'Missing required field', retryable: true, severity: 'error',
    cause: 'A required input is absent, or the object does not support the requested context.',
    fix: 'Supply the named input or choose one of the object\'s supported contexts.' }],
  ['OODS-V004', { code: 'OODS-V004', category: 'validation', message: 'Invalid slug format', retryable: true, severity: 'error',
    cause: 'A saved schema name contains characters outside the accepted slug format.',
    fix: 'Use only letters, numbers, hyphens and underscores in the schema name.' }],
  ['OODS-V005', { code: 'OODS-V005', category: 'validation', message: 'Unknown framework', retryable: true, severity: 'error',
    cause: 'No code emitter is registered for the requested framework.',
    fix: 'Choose a supported framework from the code.generate input schema.' }],
  ['OODS-V006', { code: 'OODS-V006', category: 'validation', message: 'Unknown component', retryable: true, severity: 'error-or-warning',
    cause: 'A UI node or selected slot names a component outside the component registry.',
    fix: 'Choose a component returned by catalog.list and update the node or slot.' }],
  ['OODS-V007', { code: 'OODS-V007', category: 'validation', message: 'DSL schema validation failed', retryable: true, severity: 'error-or-warning',
    cause: 'The UI schema, patch result or generated target violates a structural or component contract.',
    fix: 'Correct the reported schema, binding, prop, slot, event or syntax issue and generate again.' }],
  ['OODS-V008', { code: 'OODS-V008', category: 'validation', message: 'Duplicate node ID', retryable: true, severity: 'error',
    cause: 'Two UI nodes use the same id.',
    fix: 'Give every node a unique id before validating or patching the schema.' }],
  ['OODS-V009', { code: 'OODS-V009', category: 'validation', message: 'Missing schema', retryable: true, severity: 'error',
    cause: 'Neither a usable schema nor a schemaRef was supplied for the operation.',
    fix: 'Pass an inline schema or obtain a fresh schemaRef by composing or loading a schema.' }],
  ['OODS-V010', { code: 'OODS-V010', category: 'validation', message: 'Missing base tree', retryable: true, severity: 'error',
    cause: 'A patch operation needs a base tree but none was supplied.',
    fix: 'Pass the tree to patch as baseTree, or supply the schema reference accepted by the tool.' }],
  ['OODS-V011', { code: 'OODS-V011', category: 'validation', message: 'Missing patch', retryable: true, severity: 'error',
    cause: 'Patch mode was selected without a patch payload.',
    fix: 'Supply a supported patch object or array.' }],
  ['OODS-V012', { code: 'OODS-V012', category: 'validation', message: 'Unsupported billing object', retryable: true, severity: 'error',
    cause: 'This historical billing fixture validation has no emitter in this runtime.',
    fix: 'Use the current object and composition tools; do not depend on this reserved code.' }],
  ['OODS-V013', { code: 'OODS-V013', category: 'validation', message: 'Unknown fixture provider', retryable: true, severity: 'error',
    cause: 'This historical fixture-provider validation has no emitter in this runtime.',
    fix: 'Use the current tools rather than the retired fixture-provider route.' }],
  ['OODS-V014', { code: 'OODS-V014', category: 'validation', message: 'No fixture providers selected', retryable: true, severity: 'error',
    cause: 'This historical fixture-provider selection check has no emitter in this runtime.',
    fix: 'Use the current tools rather than the retired fixture-provider route.' }],
  ['OODS-V015', { code: 'OODS-V015', category: 'validation', message: 'No packages resolved for release verification', retryable: true, severity: 'error',
    cause: 'This historical release-verification package check has no emitter in this runtime.',
    fix: 'Use the release tooling\'s current diagnostics rather than this reserved code.' }],

  // ── Validation: Patch operations ────────────────────────────────────────
  ['OODS-V100', { code: 'OODS-V100', category: 'validation', message: 'Invalid JSON pointer', retryable: true, severity: 'error',
    cause: 'A patch path is not a valid JSON pointer.',
    fix: 'Use a slash-prefixed JSON pointer with valid escape sequences.' }],
  ['OODS-V101', { code: 'OODS-V101', category: 'validation', message: 'Unsafe path segment', retryable: false, severity: 'error',
    cause: 'A patch path contains a prohibited prototype-related segment.',
    fix: 'Remove prototype-related path segments and target an ordinary data field.' }],
  ['OODS-V102', { code: 'OODS-V102', category: 'validation', message: 'Invalid patch operation', retryable: true, severity: 'error',
    cause: 'A JSON patch operation is malformed or lacks its required members.',
    fix: 'Supply a supported operation with a valid path and the value it requires.' }],
  ['OODS-V103', { code: 'OODS-V103', category: 'validation', message: 'Cannot patch document root', retryable: false, severity: 'error',
    cause: 'A patch attempts to replace or remove the document root.',
    fix: 'Patch a child path or provide a replacement schema through the full-schema route.' }],
  ['OODS-V104', { code: 'OODS-V104', category: 'validation', message: 'Patch path not found', retryable: true, severity: 'error',
    cause: 'The patch path is missing or cannot be resolved in the base document.',
    fix: 'Inspect the current tree and use an existing path appropriate to the operation.' }],
  ['OODS-V105', { code: 'OODS-V105', category: 'validation', message: 'Invalid array index', retryable: true, severity: 'error',
    cause: 'A patch uses an invalid array index.',
    fix: 'Use a valid in-range array index, or the supported append position for add.' }],
  ['OODS-V106', { code: 'OODS-V106', category: 'validation', message: 'Patch apply failed', retryable: false, severity: 'error',
    cause: 'Applying a validated patch threw an exception.',
    fix: 'Inspect the returned path and exception, then correct the patch and base tree.' }],
  ['OODS-V107', { code: 'OODS-V107', category: 'validation', message: 'Invalid patch entry', retryable: true, severity: 'error',
    cause: 'A patch entry is not a supported object or does not describe a valid patch shape.',
    fix: 'Use either the documented JSON Patch shape or the documented node-patch shape.' }],
  ['OODS-V108', { code: 'OODS-V108', category: 'validation', message: 'Node patch missing nodeId', retryable: true, severity: 'error',
    cause: 'A node-targeted patch does not name a nodeId.',
    fix: 'Set nodeId to an id present in the base tree.' }],
  ['OODS-V109', { code: 'OODS-V109', category: 'validation', message: 'Empty patch array', retryable: true, severity: 'error',
    cause: 'The patch array contains no operations.',
    fix: 'Supply at least one patch operation.' }],
  ['OODS-V110', { code: 'OODS-V110', category: 'validation', message: 'Invalid patch type', retryable: true, severity: 'error',
    cause: 'The patch payload is neither an object nor an array.',
    fix: 'Pass a patch object or an array of supported patch operations.' }],
  ['OODS-V111', { code: 'OODS-V111', category: 'validation', message: 'Unsupported patch op', retryable: true, severity: 'error',
    cause: 'A brand patch uses an operation other than the supported add, replace or remove operations.',
    fix: 'Use an operation supported by brand.apply.' }],
  ['OODS-V112', { code: 'OODS-V112', category: 'validation', message: 'Invalid remove target', retryable: true, severity: 'error',
    cause: 'A brand patch tries to remove a non-index array path.',
    fix: 'Target an existing numeric array index for removal.' }],
  ['OODS-V113', { code: 'OODS-V113', category: 'validation', message: 'Unsafe key', retryable: false, severity: 'error',
    cause: 'A token delta or patch contains a prohibited prototype-related key.',
    fix: 'Remove the unsafe key and use ordinary token keys.' }],

  ['OODS-V114', { code: 'OODS-V114', category: 'validation', message: 'Mixed patch formats', retryable: true, severity: 'error',
    cause: 'One patch array mixes JSON Patch entries and node-targeted entries.',
    fix: 'Split the request or use one patch format throughout the array.' }],
  ['OODS-V115', { code: 'OODS-V115', category: 'validation', message: 'JSON Patch array required', retryable: true, severity: 'error',
    cause: 'JSON Patch mode received an object instead of an array of operations.',
    fix: 'Wrap the JSON Patch operations in an array.' }],
  ['OODS-V116', { code: 'OODS-V116', category: 'validation', message: 'Low layout confidence', retryable: true, severity: 'warning',
    cause: 'The layout resolver has low confidence in the inferred layout.',
    fix: 'Specify the intended layout or provide a clearer composition intent.' }],
  ['OODS-V117', { code: 'OODS-V117', category: 'validation', message: 'Object composition warning', retryable: false, severity: 'warning',
    cause: 'Composing an object reported a non-fatal trait or composition warning.',
    fix: 'Read the warning and correct the named object or trait declaration if unintended.' }],
  ['OODS-V118', { code: 'OODS-V118', category: 'validation', message: 'Resolution warning', retryable: false, severity: 'warning',
    cause: 'Layout or slot resolution reported an ambiguity or fallback.',
    fix: 'Specify the intended layout or component selection using the returned warning.' }],
  ['OODS-V119', { code: 'OODS-V119', category: 'validation', message: 'Component registry or object view-extension issue', retryable: true, severity: 'error-or-warning',
    cause: 'The generated schema names unregistered components, or the object has no view extensions for the requested context.',
    fix: 'Use registered components and a context with the intended object view extensions.' }],

  // ── Validation: Viz ──────────────────────────────────────────────────
  ['OODS-V120', { code: 'OODS-V120', category: 'validation', message: 'Object view extension could not fill a slot', retryable: true, severity: 'warning',
    cause: 'A trait view extension names an unregistered component or has no matching slot in the chosen layout.',
    fix: 'Use a registered component and a slot or position supported by the chosen layout.' }],
  ['OODS-V121', { code: 'OODS-V121', category: 'validation', message: 'Object maturity is not stable', retryable: true, severity: 'warning',
    cause: 'The composed object declares a maturity other than stable, so its output may change.',
    fix: 'Use a stable object for production compositions or explicitly accept the declared maturity.' }],
  ['OODS-V122', { code: 'OODS-V122', category: 'validation', message: 'Detail tab labels are unavailable or need only one group', retryable: true, severity: 'warning',
    cause: 'The detail context has no trait category with view extensions, or has only one category group.',
    fix: 'Provide view extensions for the context or use a single-section layout when only one group exists.' }],
  // viz.render data-source + compile failures (thrown via errorOut in viz.render.ts /
  // dashboard.render.ts but previously unregistered — createError silently degraded them to
  // server_error/non-retryable). V123-V126 are recoverable input problems (retryable); the
  // V127/V128/V129 compile/render failures are deterministic (retryable:false). All stay
  // category 'validation' to hold the V-prefix=category invariant (registry.test.ts:28-42)
  // and keep the thrown code strings byte-identical (no renumber to S-codes).
  ['OODS-V123', { code: 'OODS-V123', category: 'validation', message: 'Missing or invalid viz data source', retryable: true, severity: 'error-or-warning',
    cause: 'The visualization data source, operand or a related input option is missing or invalid.',
    fix: 'Provide the required rows or typed operand and correct the field or option named in the message.' }],
  ['OODS-V124', { code: 'OODS-V124', category: 'validation', message: 'Dataset reference expired', retryable: true, severity: 'error-or-warning',
    cause: 'The dataset reference has expired.',
    fix: 'Fetch the dataset again and retry with the new reference or inline rows.' }],
  ['OODS-V125', { code: 'OODS-V125', category: 'validation', message: 'Dataset reference resolved to empty or non-array rows', retryable: true, severity: 'error-or-warning',
    cause: 'The dataset reference resolves to empty data or a value that is not a row array.',
    fix: 'Provide a non-empty row array or fetch a dataset that contains rows.' }],
  ['OODS-V126', { code: 'OODS-V126', category: 'validation', message: 'Invalid viz spec input', retryable: true, severity: 'error-or-warning',
    cause: 'The chart spec or typed data operand fails its supported input contract.',
    fix: 'Correct the chart spec or operand according to the returned validation message.' }],
  ['OODS-V127', { code: 'OODS-V127', category: 'validation', message: 'Vega-Lite spec compilation failed', retryable: false, severity: 'error-or-warning',
    cause: 'The Vega-Lite adapter could not compile the chart spec.',
    fix: 'Correct the unsupported spec structure reported by the compiler and render again.' }],
  ['OODS-V128', { code: 'OODS-V128', category: 'validation', message: 'ECharts option compilation failed', retryable: false, severity: 'error-or-warning',
    cause: 'The ECharts adapter could not compile the chart operand.',
    fix: 'Correct the operand or unsupported chart structure reported by the adapter.' }],
  ['OODS-V129', { code: 'OODS-V129', category: 'validation', message: 'Viz render failed', retryable: false, severity: 'error-or-warning',
    cause: 'Chart rendering or certification failed after input handling.',
    fix: 'Inspect the returned rendering error and retry after correcting its cause.' }],
  ['OODS-V130', { code: 'OODS-V130', category: 'validation', message: 'Unresolved governed measure', retryable: false, severity: 'error-or-warning',
    cause: 'A governed measure reference does not resolve in the measure registry.',
    fix: 'Use an existing measure reference or register the intended governed measure.' }],
  // Field-presence strict check (sprint-118 m05): a referenced field (KPI field/periodField,
  // chart encoding) absent from every row under the opt-in strictFields flag. Recoverable —
  // the agent can fix the field name and retry — so retryable:true.
  ['OODS-V131', { code: 'OODS-V131', category: 'validation', message: 'Referenced field absent from dataset', retryable: true, severity: 'error-or-warning',
    cause: 'With strict field checks enabled, a referenced field is absent from every dataset row.',
    fix: 'Correct the field name or supply rows containing that field.' }],
  // Governed-measure registry governance (sprint-118 m03), routed through the
  // dashboard.render onPanelError seam (NOT a thrown ToolError). V132: the registry
  // artifact failed AJV-validate-at-load (fail-closed, not a silent empty Map). V133:
  // a non-additive measure (additive:false) was asked for a `sum` rollup — a summed
  // ratio/price is meaningless. Both are config/governance failures (retryable:false).
  ['OODS-V132', { code: 'OODS-V132', category: 'validation', message: 'Malformed measure registry', retryable: false, severity: 'error-or-warning',
    cause: 'The governed measure registry cannot be read as a valid registry.',
    fix: 'Repair the measure registry using its schema before rendering governed panels.' }],
  ['OODS-V133', { code: 'OODS-V133', category: 'validation', message: 'Non-additive measure rollup blocked', retryable: false, severity: 'error-or-warning',
    cause: 'A non-additive governed measure was requested with a sum rollup.',
    fix: 'Use the governed measure\'s supported aggregate instead of summing it.' }],
  // Geo-join surfacing (sprint-118 m06): a choropleth corridor whose join key has no matching
  // map feature — silently dropped today, surfaced under the strictFields flag. Recoverable
  // (the agent can fix the M49→ISO crosswalk and retry) — retryable:true.
  ['OODS-V134', { code: 'OODS-V134', category: 'validation', message: 'Geo join: corridor has no matching map feature', retryable: true, severity: 'warning',
    cause: 'A geographic join key has no matching map feature under strict field checks.',
    fix: 'Correct the join key or crosswalk so each intended row matches a map feature.' }],
  // A11y contrast (sprint-118 m07): a resolved brand-token colour pair fails WCAG contrast,
  // surfaced under output.contrastScan. A V-code (NOT 'OODS-A001' — registry.test.ts:18 regex
  // /^OODS-[VNCSRR]\d{3}$/ + prefix=category have no 'A'). retryable:false (a brand-token config
  // issue, not a transient/recoverable input).
  ['OODS-V135', { code: 'OODS-V135', category: 'validation', message: 'Brand token pair fails WCAG contrast', retryable: false, severity: 'warning',
    cause: 'An enabled contrast scan found a brand-token color pair below its required contrast.',
    fix: 'Adjust the named brand-token pair and rerun the contrast scan.' }],
  // Inline tokenOverlay value safety (sprint-121 m04): a token-overlay value containing CSS/HTML
  // metacharacters (< > { } ; @, comment sequences, control chars) that could break out of the
  // raw-emitted <style data-source="components"> sink (document.ts:220 has no escaping). Distinct
  // from V113 'Unsafe key' (key denylist) — this inspects VALUES. retryable:false (a malicious or
  // malformed value won't succeed on retry; the agent must supply a clean CSS color/length/number).
  ['OODS-V136', { code: 'OODS-V136', category: 'validation', message: 'Unsafe token-overlay value', retryable: false, severity: 'error',
    cause: 'A token overlay value is empty, malformed or contains unsafe CSS or HTML characters.',
    fix: 'Supply a safe CSS color, length or number without forbidden syntax.' }],
  // Measure-registry DEPTH (sprint-122). Routed through the dashboard.render onPanelError seam
  // (NOT thrown). V137: a KPI panel resolved to NO field — measureRef-only with resolveMeasures
  // OFF (or the ref unresolved), so there is nothing to aggregate. Fail loud instead of a silent
  // value:0. Recoverable — the agent can supply a field or enable resolveMeasures — retryable:true.
  ['OODS-V137', { code: 'OODS-V137', category: 'validation', message: 'KPI panel has no resolvable field (measureRef unresolved)', retryable: true, severity: 'error-or-warning',
    cause: 'A KPI panel has no field after governed-measure resolution.',
    fix: 'Set a field or enable measure resolution with a valid measureRef.' }],
  // V138 (sprint-122 m02): a governed measure declares an expectedGrain but the panel's actual
  // period data does not match it (or the panel has no periodField to check). A measure/data
  // governance mismatch — like V132/V133, not transiently recoverable — so retryable:false.
  ['OODS-V138', { code: 'OODS-V138', category: 'validation', message: 'Measure time-grain mismatch', retryable: false, severity: 'error-or-warning',
    cause: 'A governed measure\'s expected time grain differs from the panel data or cannot be checked.',
    fix: 'Provide the required periodField and data at the governed measure\'s expected grain.' }],
  // V139 (sprint-122 m03): under the opt-in strictDatasets flag, a KPI panel references a datasetId
  // NOT present in datasets[] — lifted from the frozen-D6 silent value:0 to a fail-loud panel,
  // matching how chart panels already fail (V123). Recoverable (fix the datasetId) — retryable:true.
  ['OODS-V139', { code: 'OODS-V139', category: 'validation', message: 'KPI panel references unknown dataset', retryable: true, severity: 'error-or-warning',
    cause: 'With strict dataset checks enabled, a KPI panel names an unknown dataset.',
    fix: 'Use a datasetId present in the request\'s datasets array.' }],
  // V140 (sprint-123 A1): a measured colour delta carries a logical leaf-path key (e.g.
  // 'color.brand.secondary') that the Forge-owned style library does not map to a --sys-/
  // --ref- skin var. A CLOSED-table config error (like V136/V132/V133/V135) — the key
  // can't become mapped on retry; the agent must use a registered key or the library must
  // add the mapping — so retryable:false.
  ['OODS-V140', { code: 'OODS-V140', category: 'validation', message: 'Unmapped style-library logical key', retryable: false, severity: 'error',
    cause: 'A measured style delta names a logical key absent from the style-library mapping.',
    fix: 'Use a registered logical key or add its supported mapping in the style library.' }],
  // V141 (sprint-129 m03): MEASURE-NARRATIVE equivalence. Routed through the dashboard.render
  // onPanelError seam (NOT thrown), and fires ONLY when the measure narrative is surfaced
  // (wantHtml || wantA11y) AFTER a measure resolved (chains after V130/V132/V133/V137/V138/V139).
  // The narrative verbalizes the GOVERNED measure-context (the registry entry's defaultThreshold);
  // if the panel's RESOLVED threshold (measure-resolver output, author-overridable per D4) DIVERGES
  // from that governed value, the verbalized "threshold X breached" would misrepresent the threshold
  // the breach was computed against — a registry-vs-rendered drift, NOT a same-source value==value
  // tautology. Recoverable (align or drop the override, or don't surface the narrative) — retryable:true.
  ['OODS-V141', { code: 'OODS-V141', category: 'validation', message: 'Measure-narrative context drifts from the resolved governed measure', retryable: true, severity: 'error-or-warning',
    cause: 'The panel\'s threshold value differs from the governed threshold described by its narrative.',
    fix: 'Align or remove the threshold override, or omit the governed narrative.' }],
  // V142 (sprint-130 m04): broadens V141's threshold.VALUE-only check to threshold.DIRECTION.
  // resolveMeasurePanel replaces the WHOLE threshold object (panel.threshold ?? entry.defaultThreshold),
  // so an author override that keeps the value but flips the direction (e.g. {direction:'below',value:350}
  // over a governed {above,350}) leaves V141 silent (values equal) yet flips computeKpi's breach — while
  // the verbalized "threshold 350 breached" still describes the GOVERNED direction. A real registry-vs-
  // rendered drift (recoverable: align or drop the override, or don't surface the narrative) — retryable:true.
  ['OODS-V142', { code: 'OODS-V142', category: 'validation', message: 'Measure-narrative threshold direction drifts from the resolved governed measure', retryable: true, severity: 'error-or-warning',
    cause: 'The panel\'s threshold direction differs from the governed direction described by its narrative.',
    fix: 'Align or remove the direction override, or omit the governed narrative.' }],
  // V143 (sprint-147 m03, F5): an explicit color `range` is SHORTER than the distinct
  // series count on a categorical color channel. Vega recycles domain[i]->range[i] mod
  // len, so two+ series silently share a color = ambiguous encoding (and a likely
  // certify role-A distinguishability fail). WARN, don't throw — the chart still renders;
  // the agent can lengthen the range or reduce the series. Recoverable — retryable:true.
  ['OODS-V143', { code: 'OODS-V143', category: 'validation', message: 'Color range is shorter than the number of series (colors will recycle)', retryable: true, severity: 'warning',
    cause: 'The explicit categorical color range has fewer colors than distinct series.',
    fix: 'Provide enough distinct colors or reduce the number of series.' }],
  // V144 (sprint-147 m03, F5): a `range` entry is not a valid hex color. Belt-and-
  // suspenders to the schema `pattern` (the primary gate rejects non-hex at AJV); this
  // WARN defends the direct-handler path (tests/pipelines that bypass AJV) so a non-hex
  // range that would make certify's hexToRgb throw -> contrast 'unchecked' -> a silent
  // conformant:true is surfaced loudly instead. Recoverable (use hex) — retryable:true.
  ['OODS-V144', { code: 'OODS-V144', category: 'validation', message: 'Color range contains a non-hex color', retryable: true, severity: 'warning',
    cause: 'An explicit color-range entry is not a valid hexadecimal color.',
    fix: 'Replace each invalid range entry with a valid hexadecimal color.' }],
  // V145 (sprint-147 m03, F5, Fork D): an explicit color `range` was supplied on an
  // ECharts-primary chart type (treemap/sunburst/sankey/force_graph/chord and the geo
  // types) that cannot consume a cartesian color range — its adapter would silently drop
  // it. FAIL-LOUD (never silently ignore an agent's declared range): the color range is
  // a cartesian-only capability (F5). A closed misuse — the type can't grow a color range
  // on retry (use a cartesian chartType) — so retryable:false.
  ['OODS-V145', { code: 'OODS-V145', category: 'validation', message: 'Color range is not supported on this chart type (cartesian color channel only)', retryable: false, severity: 'error-or-warning',
    cause: 'An explicit cartesian color range was supplied to a chart type that cannot consume it.',
    fix: 'Remove the range or choose a chart type that supports a cartesian color channel.' }],
  // V146 (sprint-148 m03, F3): a categorical ECharts-primary chart has MORE distinct
  // color groups than the 6-slot OODS palette, so the adapter's palette[i % 6] silently
  // repeats a color (CIEDE2000 = 0 between two arcs) — invisible to certify's s141
  // data-independent palette-constant grade. WARN across all 5 cycling types
  // (treemap/sunburst/sankey/force_graph/chord); the chart still renders. Recoverable
  // (reduce the categories, or accept indistinguishable groups) — retryable:true.
  ['OODS-V146', { code: 'OODS-V146', category: 'validation', message: 'Categorical palette recycles: more distinct color groups than the 6-slot OODS palette', retryable: true, severity: 'warning',
    cause: 'An ECharts categorical chart has more groups than the six available palette slots.',
    fix: 'Reduce or group the categories before relying on color to distinguish them.' }],
  // V147 (sprint-148 m04, F4): a chord/force_graph link names a node that does not
  // exist in the node set. FAIL-LOUD (never build an option over a broken ref) —
  // unlike V145's closed misuse, a dangling ref is a FIXABLE input (add the node or
  // fix the link), so retryable:true (mirrors the V126/V131 posture, deliberately
  // unlike V145's retryable:false). sankey keeps its own throw -> V126 (out of F4).
  ['OODS-V147', { code: 'OODS-V147', category: 'validation', message: 'Link references a non-existent node', retryable: true, severity: 'error-or-warning',
    cause: 'A chord or force-graph link names a node absent from the node set.',
    fix: 'Add the missing node or correct the link endpoint.' }],
  // V148 (sprint-148 m04, F4): a chord/force_graph link duplicates an existing
  // directed (source,target) pair. ECharts double-counts the arc / corrupts the
  // stacked ribbon, so WARN (the chart still renders). Recoverable (merge the
  // duplicates) — retryable:true. chord is DIRECTED, so A->B and B->A are distinct.
  ['OODS-V148', { code: 'OODS-V148', category: 'validation', message: 'Duplicate link', retryable: true, severity: 'warning',
    cause: 'A chord or force-graph operand repeats a directed source-target link.',
    fix: 'Merge duplicate directed links while retaining intentional reciprocal links.' }],
  ['OODS-V149', { code: 'OODS-V149', category: 'validation', message: 'Delta addresses a different brand than the one being applied', retryable: true, severity: 'error',
    cause: 'A measured token delta names a different brand from the brand being applied.',
    fix: 'Apply the delta to its recorded brand or supply a delta for the intended brand.' }],

  // ── Validation: artifact.certify ACCURACY rules (sprint-170, #818) ──────
  // The four declared structural rules of certify's accuracy pillar — the fourth #977
  // pillar. Unlike every other V-code here these are never THROWN: they are reported as
  // certify findings (severity 'error') and pull pillars.accuracy to 'fail'. They are
  // registered anyway because a code an agent reads must be a registered code, and because
  // the registry is where the commitment not to rename or reassign them lives.
  // Every one is retryable:true — each names a specific, fixable authoring choice.
  // V150: a bar communicates value by LENGTH from a baseline, so a value axis that is not a
  // linear zero-anchored scale draws lengths whose ratios are not the data's ratios. Three
  // distinct causes (zero:false, log, sqrt), each reported with its own wording — a sqrt
  // scale IS zero-anchored, so it is never described as a moved baseline.
  ['OODS-V150', { code: 'OODS-V150', category: 'validation', message: "A bar's value axis is not a linear zero-anchored scale", retryable: true, severity: 'error',
    cause: 'A bar\'s value axis is not linear and anchored at zero.',
    fix: 'Use a linear zero-anchored scale for a bar\'s value axis.' }],
  // V151: two layers in ONE plot frame with independently-resolved positional scales — where
  // the series cross, converge or diverge is then an artifact of the two scales, not of the
  // data. LAYER scope only; facet- and concat-scope independence are separate panels.
  ['OODS-V151', { code: 'OODS-V151', category: 'validation', message: 'Layered marks resolve a positional scale independently (dual axis)', retryable: true, severity: 'error',
    cause: 'Layers sharing one plot frame resolve a positional scale independently.',
    fix: 'Share the positional scale or put the series into separate panels.' }],
  // V152: the V150 predicate over an area mark. Ranged (x2/y2) band areas are excluded —
  // a band encodes two edge positions, not an extent measured from a baseline.
  ['OODS-V152', { code: 'OODS-V152', category: 'validation', message: "An area's value axis is not a linear zero-anchored scale", retryable: true, severity: 'error',
    cause: 'A non-ranged area\'s value axis is not linear and anchored at zero.',
    fix: 'Use a linear zero-anchored scale for the area value axis.' }],
  // V153: an aggregation that actually MERGES rows (some group under the full group key
  // holds more than one row) while none of the declared text surfaces — the accessible
  // description, the chart title, the aggregated axis title — says so. The reader sees one
  // mark per group with no indication it stands for several rows. Identity aggregations
  // (one row per group) never fire.
  ['OODS-V153', { code: 'OODS-V153', category: 'validation', message: 'A row-collapsing aggregation is not disclosed on any declared text surface', retryable: true, severity: 'error',
    cause: 'An aggregation merges rows without disclosure in the chart description, title or aggregated-axis title.',
    fix: 'Name the aggregation on at least one of those text surfaces.' }],

  // ── Validation: artifact.certify ACCURACY rules, ECHARTS-PRIMARY (sprint-172) ──
  // The accuracy pillar widened from the 5 cartesian types to all 13. These six read the
  // certify `data` OPERAND (the same data branch viz.render takes) rather than a compiled
  // Vega-Lite spec, because an ECharts-primary IR is metadata-only and carries no data at
  // all. Like V150-V153 they are never THROWN: they are certify findings that pull
  // pillars.accuracy to 'fail'. Every one is retryable:true — each names a specific,
  // fixable authoring choice.
  //
  // SEVERITY, stated once for the family: a certify accuracy finding is ERROR-severity by
  // construction. That is a deliberate escalation over the render path's posture for the
  // same data — most visibly at V158, where F4 treats a duplicate directed link as a
  // WARNING for chord/force_graph and says nothing at all for sankey. The two tools answer
  // different questions: render asks "does this draw", certify asks "does the drawing mean
  // what the data says".
  //
  // V154: a treemap tile's area and a sunburst arc's angle are magnitudes. The adapters
  // copy the authored value straight into the option, so a negative or non-finite node
  // value is drawn as something that does not represent the number.
  ['OODS-V154', { code: 'OODS-V154', category: 'validation', message: 'A treemap/sunburst node value cannot be encoded as area or angle', retryable: true, severity: 'error',
    cause: 'A treemap or sunburst node has a negative or non-finite value that area cannot represent.',
    fix: 'Supply finite non-negative magnitude values for hierarchy nodes.' }],
  // V155: an EXPLICIT parent value that is not the sum of its children — the parent is
  // sized by the declaration while the children tile the space beneath it, so the
  // part-of-whole relationship shown is not the one in the data. Compared under a RELATIVE
  // 1e-9 tolerance: a parent of 0.3 over children 0.1 and 0.2 is correct data that exact
  // float equality would falsely flag.
  ['OODS-V155', { code: 'OODS-V155', category: 'validation', message: "An explicit treemap/sunburst parent value is not the sum of its children", retryable: true, severity: 'error',
    cause: 'An explicit treemap or sunburst parent value differs from the sum of its children.',
    fix: 'Make the parent total equal its children or omit the explicit parent value.' }],
  // V156: ribbon width is a magnitude. sankey's upstream validator rejects non-finite link
  // values (V126) but permits negatives; chord validates values not at all, so both
  // negative and non-finite chord values reach the option.
  ['OODS-V156', { code: 'OODS-V156', category: 'validation', message: 'A sankey/chord link value is negative or non-finite', retryable: true, severity: 'error',
    cause: 'A sankey or chord link has a negative or non-finite magnitude.',
    fix: 'Supply finite non-negative link values.' }],
  // V157: a sankey node's drawn height is not the flow its ribbons carry. Two causes — an
  // explicit node.value that overrides the computed max(incoming, outgoing), and an
  // INTERMEDIATE node (incoming>0 AND outgoing>0) whose two sides disagree. Sources and
  // sinks are endpoints, never leaks, and never fire. The rule reads the data BRANCH
  // because the option erases the provenance: a declared value and a computed one are the
  // same {name, value} pair once emitted.
  ['OODS-V157', { code: 'OODS-V157', category: 'validation', message: "A sankey node's height does not match the flow its links carry", retryable: true, severity: 'error',
    cause: 'A sankey node\'s drawn height does not agree with the flow carried by its links.',
    fix: 'Correct the explicit node value or the incoming and outgoing flow totals.' }],
  // V158: duplicate directed (source,target) pairs stack into one visually-merged ribbon,
  // so the width between those nodes is their SUM while each label describes one part. A
  // deliberate certify-side REOPEN of the s148 F4 sankey exclusion; viz.render is untouched.
  ['OODS-V158', { code: 'OODS-V158', category: 'validation', message: 'A sankey directed flow appears more than once', retryable: true, severity: 'error',
    cause: 'A sankey operand repeats a directed source-target link.',
    fix: 'Merge duplicate directed links so each route is represented once.' }],
  // V159: a choropleth join that matches several rows to one region merges them
  // last-record-wins. Where those rows AGREE this is supported one-to-many behaviour and
  // the rule stays silent; where they CONFLICT on the joined value field the region's shade
  // is decided by input order rather than by the data.
  ['OODS-V159', { code: 'OODS-V159', category: 'validation', message: 'A choropleth region matched rows with conflicting joined values', retryable: true, severity: 'error',
    cause: 'Multiple choropleth rows join to the same region with conflicting encoded values.',
    fix: 'Aggregate or reconcile the rows to one encoded value per region.' }],
  // V160 (sprint-175 m05, decision 11): a KPI numeric aggregate (sum/average/median/min/max/
  // latest) over a field that HAS values but none of them numeric. viz-core's computeKpi throws
  // KpiComputeError{reason:'no_numeric_cells'} instead of the pre-s175 silent value:0;
  // dashboard.render routes it through the onPanelError seam (placeholder/omit), like V137.
  // count/distinct never trip it (defined over any cell type); an absent field or an empty
  // row set keeps value:0.
  ['OODS-V160', { code: 'OODS-V160', category: 'validation', message: 'KPI numeric aggregate over a field with no numeric cells', retryable: true, severity: 'error-or-warning',
    cause: 'A numeric KPI aggregate received non-null values but none are numeric.',
    fix: 'Provide numeric cells or use count or distinct for non-numeric data.' }],
  // V161 (sprint-176 m03a): the DEFAULT baked cartesian categorical palette is shorter
  // than the distinct series count, so Vega recycles domain[i]->range[i mod len] — two+
  // series share a colour (a ΔE00=0 pair certify's render-backed contrast pillar fails).
  // The default-palette twin of V143, which cannot be reused here: V143's registered and
  // emitted messages presuppose an AGENT-SUPPLIED range ("Provide at least N colors"),
  // while V161 fires precisely when the agent supplied none. Threshold is read from the
  // APPLIED compiled scale.range, never a hardcoded 6. WARN — the chart still renders.
  ['OODS-V161', { code: 'OODS-V161', category: 'validation', message: 'Baked categorical palette recycles: more distinct series than palette slots', retryable: true, severity: 'warning',
    cause: 'The applied default categorical palette has fewer slots than distinct series.',
    fix: 'Supply a sufficiently long explicit color range or reduce the series count.' }],
  ['OODS-V162', { code: 'OODS-V162', category: 'validation', message: 'Required hash-bound release evidence is missing; references are not re-executed', retryable: true, severity: 'error',
    cause: 'The release profile is missing readable passed evidence bound to the generated artifact.',
    fix: 'Provide each required local JSON evidence file with its passed status and matching hashes.' }],
  ['OODS-V163', { code: 'OODS-V163', category: 'validation', message: 'Release evidence artifact hash mismatch; references are not re-executed', retryable: true, severity: 'error',
    cause: 'A release evidence file or its declared artifact hash does not match the generated artifact.',
    fix: 'Regenerate the evidence for these exact artifact bytes and update both hashes.' }],
  ['OODS-V164', { code: 'OODS-V164', category: 'validation', message: 'Unknown UI workflow state', retryable: true, severity: 'error-or-warning',
    cause: 'A UI node declares a workflow state outside the canonical state vocabulary.',
    fix: 'Use a supported UI workflow state in the node\'s state field.' }],
  ['OODS-V165', { code: 'OODS-V165', category: 'validation', message: 'SVG rendering failed', retryable: true, severity: 'error-or-warning',
    cause: 'Rendering the compiled chart to SVG failed.',
    fix: 'Inspect the SVG rendering error and correct the spec or rendering environment.' }],
  ['OODS-V166', { code: 'OODS-V166', category: 'validation', message: 'viz.render pattern conflicts with explicit data or source identity/presentation overrides', retryable: true, severity: 'error',
    cause: 'A pattern request overrides data, identity or presentation owned by the source pattern.',
    fix: 'Remove the conflicting options or render an explicit chart instead of a pattern.' }],
  ['OODS-V167', { code: 'OODS-V167', category: 'validation', message: 'viz.render pattern is authoring-only because its source structure is not supported by the public renderer', retryable: false, severity: 'error',
    cause: 'The selected pattern has source structure the public renderer does not support.',
    fix: 'Use its authoring source or select a publicly renderable pattern.' }],

  // s195 m04 operand-profile accuracy findings; renderer behavior is unchanged.
  // V169 reports the public builder's default linear diameter; no size-scale override
  // is exposed. V170 uses emitted coordinates, not the unused bubble geo.join.
  // V172/V173 are directed: reciprocal flows/edges remain valid.
  ['OODS-V174', { code: 'OODS-V174', category: 'validation', message: 'viz.render: pattern retired; use the named supported alternative', retryable: false, severity: 'error',
    cause: 'The requested pattern has been retired from public rendering.',
    fix: 'Use the supported alternative named in the returned message.' }],
  ['OODS-V175', { code: 'OODS-V175', category: 'validation', message: 'viz.render: static SVG shows the default selection state', retryable: false, severity: 'warning',
    cause: 'A chart with interactions was rendered to static SVG in its default selection state.',
    fix: 'Use a client renderer to provide the declared interactive behavior.' }],
  ['OODS-V168', { code: 'OODS-V168', category: 'validation', message: 'artifact.certify: bubble-map size is negative or non-finite', retryable: true, severity: 'error',
    cause: 'A bubble-map row has a negative or non-finite size magnitude.',
    fix: 'Supply finite non-negative size values.' }],
  ['OODS-V169', { code: 'OODS-V169', category: 'validation', message: 'artifact.certify: bubble-map magnitudes use radius rather than area scaling', retryable: true, severity: 'error',
    cause: 'The emitted bubble diameter scales with magnitude instead of its area doing so.',
    fix: 'Choose an encoding that preserves magnitude by area; the current public bubble builder exposes no size-scale override.' }],
  ['OODS-V170', { code: 'OODS-V170', category: 'validation', message: 'artifact.certify: overlapping bubble-map rows have conflicting encoded values', retryable: true, severity: 'error',
    cause: 'Bubble-map rows at the same coordinates have conflicting encoded values.',
    fix: 'Aggregate or separate the rows so one point does not conceal a different value.' }],
  ['OODS-V171', { code: 'OODS-V171', category: 'validation', message: 'artifact.certify: flow-map strength is negative or non-finite', retryable: true, severity: 'error',
    cause: 'A flow-map route has a negative or non-finite strength.',
    fix: 'Supply finite non-negative route strengths.' }],
  ['OODS-V172', { code: 'OODS-V172', category: 'validation', message: 'artifact.certify: a directed geographic flow appears more than once', retryable: true, severity: 'error',
    cause: 'The geographic operand repeats the same directed route between coordinates.',
    fix: 'Merge duplicate directed routes while retaining intentional reciprocal flows.' }],
  ['OODS-V173', { code: 'OODS-V173', category: 'validation', message: 'artifact.certify: a force-graph directed edge appears more than once', retryable: true, severity: 'error',
    cause: 'A force-graph operand repeats a directed source-target edge.',
    fix: 'Merge duplicate directed edges while retaining intentional reciprocal edges.' }],

  // ── Validation: Brand/Map ───────────────────────────────────────────────
  ['OODS-V200', { code: 'OODS-V200', category: 'validation', message: 'Map validation failed', retryable: true, severity: 'error',
    cause: 'This historical map-validation code has no emitter in this runtime.',
    fix: 'Use the map tool\'s current validation response rather than this reserved code.' }],
  ['OODS-V201', { code: 'OODS-V201', category: 'validation', message: 'map.apply input invalid', retryable: true, severity: 'error',
    cause: 'map.apply received neither or both of report and reportPath.',
    fix: 'Provide exactly one of report or reportPath.' }],
  ['OODS-V204', { code: 'OODS-V204', category: 'validation', message: 'Composition edit not applicable to this version', retryable: false, severity: 'error',
    cause: 'An edit or ordering preference cannot apply to the stored composition version.',
    fix: 'Read that version\'s recorded choices and submit an edit valid for its regions, fields and components.' }],
  ['OODS-V205', { code: 'OODS-V205', category: 'validation', message: 'Composition version cannot be accepted', retryable: false, severity: 'error',
    cause: 'The requested composition version cannot be accepted under the acceptance checks.',
    fix: 'Correct the acceptance issue named in the response before accepting the version.' }],
  ['OODS-V203', { code: 'OODS-V203', category: 'validation', message: 'Composition id or version is not well-formed', retryable: false, severity: 'error',
    cause: 'A composition id, version or required composition selector is missing or malformed.',
    fix: 'Use an existing cmp- identifier and a positive integer version, or provide the required fresh composition inputs.' }],
  ['OODS-V202', { code: 'OODS-V202', category: 'validation', message: 'structuredData.fetch input invalid', retryable: true, severity: 'error',
    cause: 'The structured-data request combines unsupported options or omits a required runPath.',
    fix: 'Use the reported fetch-kind contract and provide its required path and supported options.' }],
  // Context beside the design (s203-m05), registered in s205-m01: unregistered, createError degraded both to
  // server_error with an incident id, so a caller's malformed or mis-keyed item read as a server fault.
  ['OODS-V206', { code: 'OODS-V206', category: 'validation', message: 'Context item is malformed or cannot state its provenance', retryable: false, severity: 'error',
    cause: 'A context item or search record lacks required content or valid provenance.',
    fix: 'Supply the named provenance fields, valid timestamps and readable body or excerpt within the item limit.' }],
  ['OODS-V207', { code: 'OODS-V207', category: 'validation', message: 'Context item names a different object from the one on screen', retryable: false, severity: 'error',
    cause: 'A context item names an object other than the one shown by the composition.',
    fix: 'Attach context for the displayed object or compose the intended object.' }],
  // Observation against intent (s204-m04): each refusal writes nothing at all.
  ['OODS-V208', { code: 'OODS-V208', category: 'validation', message: 'Observation run path is not one Stage1 run', retryable: false, severity: 'error',
    cause: 'The observation path does not identify one Stage1 capture run.',
    fix: 'Point the observation path at the directory containing one run\'s manifest.json.' }],
  ['OODS-V209', { code: 'OODS-V209', category: 'validation', message: 'Observation artifact schema_version is outside the accepted contract', retryable: false, severity: 'error',
    cause: 'An observation artifact declares a version outside OODS Foundry\'s admitted contract.',
    fix: 'Use an admitted artifact version or wait for its contract to be reviewed and supported.' }],
  ['OODS-V210', { code: 'OODS-V210', category: 'validation', message: 'Observation names an object the registry does not hold', retryable: false, severity: 'error',
    cause: 'The observation comparison names an object absent from the object registry.',
    fix: 'Register the intended object or use an object already held by the registry.' }],
  // The result-state visual rule (s205-m03): a result state never renders in the severity family.
  ['OODS-V211', { code: 'OODS-V211', category: 'validation', message: 'Result state bound to a component that cannot be held to the result family', retryable: false, severity: 'error',
    cause: 'A result-state field is bound to a component that cannot preserve the result visual family.',
    fix: 'Use a Badge or StatusBadge with the result tone, or render the value as plain text.' }],
  // The run view (s205-m04): each refusal writes nothing at all.
  ['OODS-V212', { code: 'OODS-V212', category: 'validation', message: 'Run view path is not one Stage1 run', retryable: false, severity: 'error',
    cause: 'The run-view path does not identify a Stage1 run with the required manifest shape.',
    fix: 'Point runPath at one capture\'s manifest directory rather than a suite or analysis directory.' }],
  ['OODS-V213', { code: 'OODS-V213', category: 'validation', message: 'Run view artifact is outside the admitted contract', retryable: false, severity: 'error',
    cause: 'A run-view artifact is outside the admitted contract or changed during reading.',
    fix: 'Use a complete unchanged run with admitted versions and matching manifest attestations.' }],
  ['OODS-V214', { code: 'OODS-V214', category: 'validation', message: 'Run does not match the composition it is shown in', retryable: false, severity: 'error',
    cause: 'The requested run, analysis, record or presentation does not match the composition being shown.',
    fix: 'Compose a fresh supported view for that source and use a record id belonging to it.' }],
  // s213-m03: a team's object or trait that does not validate, or does not compose in a context it declares, is not
  // registered; the folder is left as it was.
  ['OODS-V215', { code: 'OODS-V215', category: 'validation', message: 'Definition not registered: it does not validate or compose', retryable: true, severity: 'error',
    cause: 'An object or trait definition does not validate or compose, including a declared unbound trait conflict or an invalid semantic version.',
    fix: 'Fix the reported problems before registering again: remove one conflicting unbound trait or use a semantic version such as 1.2.3 when those checks fail.' }],
  ['OODS-V218', { code: 'OODS-V218', category: 'validation', message: 'Team component mapping has advisory limits', retryable: false, severity: 'warning',
    cause: 'A mapped team component has unmet shared contract obligations, or a React-only shadcn mapping does not apply to Vue or HTML output, which keeps the OODS Foundry component.',
    fix: 'For unmet obligations, read the component-contract report and address them before shipping. For a React-only shadcn mapping, generate React output to use the mapping or keep the OODS Foundry component in Vue or HTML output.' }],
  ['OODS-V217', { code: 'OODS-V217', category: 'validation', message: 'Mapped component package cannot be previewed', retryable: true, severity: 'error',
    cause: 'The preview host cannot resolve, compile or freeze a mapped component package.',
    fix: 'Install a compatible mapped package in the preview environment and correct its imports or build errors.' }],
  ['OODS-V216', { code: 'OODS-V216', category: 'validation', message: 'Brand does not validate; nothing was written', retryable: true, severity: 'error',
    cause: 'The proposed brand fails validation, including its required color contrast.',
    fix: 'Correct the reported brand fields and contrast pairs before applying or creating it.' }],
  ['OODS-V219', { code: 'OODS-V219', category: 'validation', message: 'Mapping creation refused', retryable: true, severity: 'error',
    cause: 'A mapping entry conflicts with another mapping or its local package does not resolve at the pinned name, version and export.',
    fix: 'Correct the named entry using its index, id and reason, then submit the complete list again. No mapping was written.' }],

  // ── Not Found ───────────────────────────────────────────────────────────
  ['OODS-N001', { code: 'OODS-N001', category: 'not_found', message: 'Unknown tool', retryable: false, severity: 'error',
    cause: 'The dispatch request names no registered tool.',
    fix: 'Select a tool from the client\'s advertised tool list.' }],
  ['OODS-N002', { code: 'OODS-N002', category: 'not_found', message: 'Schema not found', retryable: false, severity: 'error',
    cause: 'No saved schema exists under the requested name.',
    fix: 'List saved schemas and load an existing name, or save the schema first.' }],
  ['OODS-N003', { code: 'OODS-N003', category: 'not_found', message: 'SchemaRef not found', retryable: true, severity: 'error',
    cause: 'The schemaRef is not held by this runtime session.',
    fix: 'Compose or load the schema again and use its new schemaRef.' }],
  ['OODS-N004', { code: 'OODS-N004', category: 'not_found', message: 'SchemaRef expired', retryable: true, severity: 'error',
    cause: 'The schemaRef has expired.',
    fix: 'Compose or load the schema again and use its fresh schemaRef.' }],
  ['OODS-N005', { code: 'OODS-N005', category: 'not_found', message: 'Object not found', retryable: false, severity: 'error',
    cause: 'The requested object name is absent from the object registry.',
    fix: 'Use the suggested or listed object name, or register the intended object first.' }],
  ['OODS-N006', { code: 'OODS-N006', category: 'not_found', message: 'Patch node not found', retryable: true, severity: 'error',
    cause: 'The nodeId targeted by a patch is absent from the base tree.',
    fix: 'Inspect the current tree and target an existing node id.' }],
  ['OODS-N007', { code: 'OODS-N007', category: 'not_found', message: 'Artifact not found', retryable: false, severity: 'error',
    cause: 'An artifact is missing, outside an admitted contract or fails its manifest attestation.',
    fix: 'Inspect the returned kind, path and accepted contract, then supply a complete compatible artifact.' }],
  ['OODS-N008', { code: 'OODS-N008', category: 'not_found', message: 'Fixture object not found', retryable: false, severity: 'error',
    cause: 'This historical fixture-object lookup has no emitter in this runtime.',
    fix: 'Use registered objects through the current object tool.' }],
  ['OODS-N009', { code: 'OODS-N009', category: 'not_found', message: 'Registry manifest missing', retryable: false, severity: 'warning',
    cause: 'The structured-data component manifest is missing or unreadable during validation.',
    fix: 'Restore or rebuild the structured-data manifest before relying on registry validation.' }],
  ['OODS-N010', { code: 'OODS-N010', category: 'not_found', message: 'Registry unavailable', retryable: false, severity: 'warning',
    cause: 'No component registry is available to validate the schema.',
    fix: 'Restore the component registry and validate again.' }],
  ['OODS-N011', { code: 'OODS-N011', category: 'not_found', message: 'Token data missing', retryable: false, severity: 'error',
    cause: 'Required token data, token CSS or the shipped token compiler kit is unavailable.',
    fix: 'Restore the runtime\'s token assets or run the supported token build and retry.' }],
  ['OODS-N012', { code: 'OODS-N012', category: 'not_found', message: 'A11y token data missing', retryable: false, severity: 'error',
    cause: 'This historical accessibility token lookup has no emitter in this runtime.',
    fix: 'Use the current accessibility tools and their token diagnostics.' }],
  ['OODS-N013', { code: 'OODS-N013', category: 'not_found', message: 'HTML renderer unavailable; fallback output is forbidden at build or release confidence', retryable: false, severity: 'error-or-warning',
    cause: 'The HTML renderer is unavailable and the requested confidence forbids fallback output.',
    fix: 'Restore the HTML renderer or choose an available target before requesting build or release confidence.' }],
  ['OODS-N014', { code: 'OODS-N014', category: 'not_found', message: 'Registry snapshot payload missing', retryable: false, severity: 'error',
    cause: 'The structured-data fetch returned no components payload for a registry snapshot.',
    fix: 'Restore the components structured-data payload and retry the snapshot.' }],
  ['OODS-N015', { code: 'OODS-N015', category: 'not_found', message: 'Component target unavailable', retryable: false, severity: 'error-or-warning',
    cause: 'A component is unavailable for the requested target or its release attestation is invalid.',
    fix: 'Use a supported target and component, or reinstall the sealed runtime if its attestation is invalid.' }],
  ['OODS-N016', { code: 'OODS-N016', category: 'not_found', message: 'Generated artifact dependency closure is invalid', retryable: false, severity: 'error',
    cause: 'The generated artifact\'s dependencies, runtime support or application options are invalid.',
    fix: 'Correct the reported dependency or application option; runnable React and Vue applications require TypeScript output.' }],
  ['OODS-N017', { code: 'OODS-N017', category: 'not_found', message: 'Generated artifact envelope missing', retryable: false, severity: 'error',
    cause: 'Code generation reported success without the required artifact envelope.',
    fix: 'Report the missing artifact envelope and do not treat the pipeline as successful.' }],
  ['OODS-N018', { code: 'OODS-N018', category: 'not_found', message: 'HTML Tailwind styling unavailable', retryable: false, severity: 'error-or-warning',
    cause: 'HTML generation was requested with Tailwind styling that the HTML target does not support.',
    fix: 'Use the HTML target\'s supported styling or choose a React or Vue target for Tailwind output.' }],

  ['OODS-N022', { code: 'OODS-N022', category: 'not_found', message: 'Composition or version not found in the store', retryable: false, severity: 'error',
    cause: 'The requested composition or version is absent from the composition store.',
    fix: 'Use an existing composition version or compose a fresh view.' }],
  ['OODS-N023', { code: 'OODS-N023', category: 'not_found', message: 'No folder is set for your objects or traits (OODS_OBJECTS_DIR, OODS_TRAITS_DIR)', retryable: false, severity: 'error',
    cause: 'No destination folder is configured for team objects or traits.',
    fix: 'Set OODS_OBJECTS_DIR or OODS_TRAITS_DIR to a writable team folder.' }],
  ['OODS-N021', { code: 'OODS-N021', category: 'not_found', message: 'design.preview: no preview host is reachable; call through the HTTP bridge or the stdio adapter, or set OODS_PREVIEW_HOST_URL', retryable: true, severity: 'error',
    cause: 'No preview host is reachable for design.preview.',
    fix: 'Call through the HTTP bridge or stdio adapter, or configure a reachable OODS_PREVIEW_HOST_URL.' }],
  ['OODS-N020', { code: 'OODS-N020', category: 'not_found', message: 'brand.apply: canonical brand source is not shipped in this runtime', retryable: false, severity: 'error',
    cause: 'The runtime lacks the canonical brand source required by brand.apply.',
    fix: 'Use a runtime containing the token compiler kit and brand source, or restore those assets.' }],
  ['OODS-N024', { code: 'OODS-N024', category: 'not_found', message: 'The brand template is not built; run the token build', retryable: false, severity: 'error',
    cause: 'The brand template has not been built.',
    fix: 'Run the token build before requesting a brand template.' }],
  ['OODS-N025', { code: 'OODS-N025', category: 'not_found', message: 'Creating a brand needs a brands folder (OODS_BRANDS_DIR) or a source checkout, and the token build', retryable: false, severity: 'error',
    cause: 'Brand creation lacks a usable brands folder or source checkout and token build.',
    fix: 'Configure a writable OODS_BRANDS_DIR with the supported token build available.' }],

  // ── Conflict ────────────────────────────────────────────────────────────
  ['OODS-C001', { code: 'OODS-C001', category: 'conflict', message: 'Schema ref missing after compose', retryable: false, severity: 'error',
    cause: 'The compose step completed without a schemaRef required by the pipeline.',
    fix: 'Report the missing compose reference and retry after the compose failure is corrected.' }],
  ['OODS-C002', { code: 'OODS-C002', category: 'conflict', message: 'Tag already exists', retryable: false, severity: 'error',
    cause: 'This historical duplicate-tag check has no emitter in this runtime.',
    fix: 'Use the current schema operations rather than this reserved tag code.' }],
  ['OODS-C003', { code: 'OODS-C003', category: 'conflict', message: 'Duplicate panel id', retryable: false, severity: 'error',
    cause: 'Two dashboard panels have the same id.',
    fix: 'Give every dashboard panel a unique id.' }],
  ['OODS-C004', { code: 'OODS-C004', category: 'conflict', message: 'A definition of this name is already registered; pass overwrite: true to replace it', retryable: true, severity: 'error',
    cause: 'A definition name or its destination file is already occupied.',
    fix: 'Use overwrite only for an intended replacement, or rename the conflicting definition or file.' }],
  ['OODS-C005', { code: 'OODS-C005', category: 'conflict', message: 'A brand with this id already exists; create never replaces a brand', retryable: false, severity: 'error',
    cause: 'Brand creation requested an id already held by a brand.',
    fix: 'Choose a new brand id; brand creation never replaces an existing brand.' }],

  // ── Server Error ────────────────────────────────────────────────────────
  ['OODS-S001', { code: 'OODS-S001', category: 'server_error', message: 'Policy denied', retryable: false, severity: 'error',
    cause: 'The caller\'s role is not allowed to invoke the tool.',
    fix: 'Use an authorized role or ask the operator to review the tool policy.' }],
  ['OODS-S002', { code: 'OODS-S002', category: 'server_error', message: 'Execution timeout', retryable: true, severity: 'error',
    cause: 'The tool handler exceeded its execution time limit.',
    fix: 'Retry after reducing the request size or resolving the slow dependency.' }],
  ['OODS-S003', { code: 'OODS-S003', category: 'server_error', message: 'Bad request', retryable: false, severity: 'error',
    cause: 'An unexpected exception or malformed dispatch request reached the server boundary.',
    fix: 'Correct malformed request data or report the incident and exception details to the runtime maintainer.' }],
  ['OODS-S004', { code: 'OODS-S004', category: 'server_error', message: 'Object load failed', retryable: false, severity: 'error',
    cause: 'This historical object-loading server code has no emitter in this runtime.',
    fix: 'Use the current object\'s structured diagnostics rather than this reserved code.' }],
  ['OODS-S005', { code: 'OODS-S005', category: 'server_error', message: 'Catalog load failed', retryable: true, severity: 'error',
    cause: 'The component catalog or structured-data manifest could not be loaded.',
    fix: 'Restore the catalog and manifest assets and retry the operation.' }],
  ['OODS-S006', { code: 'OODS-S006', category: 'server_error', message: 'HTML render failed', retryable: false, severity: 'error',
    cause: 'The HTML emitter failed to render the schema.',
    fix: 'Inspect the rendering error and correct the schema or renderer dependency.' }],
  ['OODS-S007', { code: 'OODS-S007', category: 'server_error', message: 'Fragment render failed', retryable: false, severity: 'error',
    cause: 'Rendering an individual UI fragment threw an exception.',
    fix: 'Inspect that fragment\'s error and correct its node or component before rendering again.' }],
  ['OODS-S008', { code: 'OODS-S008', category: 'server_error', message: 'Fixture load failed', retryable: false, severity: 'error',
    cause: 'This historical fixture-load server code has no emitter in this runtime.',
    fix: 'Use the fidelity tool\'s current fixture diagnostics.' }],
  ['OODS-S009', { code: 'OODS-S009', category: 'server_error', message: 'Pipeline step failed', retryable: false, severity: 'error',
    cause: 'A pipeline step failed without a usable issue or returned an invalid artifact or validation receipt.',
    fix: 'Inspect the failed step and correct its reported artifact or receipt mismatch before rerunning the pipeline.' }],
  ['OODS-S010', { code: 'OODS-S010', category: 'server_error', message: 'Compose step exception', retryable: false, severity: 'error',
    cause: 'The pipeline compose step threw an unexpected exception.',
    fix: 'Inspect the compose exception and correct its cause before rerunning the pipeline.' }],
  ['OODS-S011', { code: 'OODS-S011', category: 'server_error', message: 'Validate step exception', retryable: false, severity: 'error',
    cause: 'The pipeline validation step threw an unexpected exception.',
    fix: 'Inspect the validation exception and correct its cause before rerunning the pipeline.' }],
  ['OODS-S012', { code: 'OODS-S012', category: 'server_error', message: 'Render step exception', retryable: false, severity: 'error',
    cause: 'Screen rendering or the pipeline render step threw an exception.',
    fix: 'Inspect the render error and correct its cause before retrying the operation.' }],
  ['OODS-S013', { code: 'OODS-S013', category: 'server_error', message: 'Codegen step exception', retryable: false, severity: 'error',
    cause: 'The pipeline code-generation step threw an unexpected exception.',
    fix: 'Inspect the code-generation exception and correct its cause before rerunning the pipeline.' }],
  ['OODS-S014', { code: 'OODS-S014', category: 'server_error', message: 'Save step exception', retryable: false, severity: 'error',
    cause: 'The pipeline save step threw an unexpected exception.',
    fix: 'Inspect the save error and restore a writable schema store before retrying.' }],
  ['OODS-S015', { code: 'OODS-S015', category: 'server_error', message: 'Path not allowed', retryable: false, severity: 'error',
    cause: 'An artifact or token path falls outside the policy\'s allowed location.',
    fix: 'Choose a path under the allowed artifact or token directory.' }],
  ['OODS-S016', { code: 'OODS-S016', category: 'server_error', message: 'Artifact filename empty', retryable: false, severity: 'error',
    cause: 'An artifact manifest entry has an empty filename.',
    fix: 'Repair the manifest entry with a non-empty safe filename.' }],
  ['OODS-S017', { code: 'OODS-S017', category: 'server_error', message: 'Artifact filename unsafe', retryable: false, severity: 'error',
    cause: 'An artifact manifest entry is not a safe filename.',
    fix: 'Use a filename without traversal or path separators in the artifact manifest.' }],
  ['OODS-S018', { code: 'OODS-S018', category: 'server_error', message: 'Fixture provider mismatch', retryable: false, severity: 'error',
    cause: 'This historical fixture-provider mismatch has no emitter in this runtime.',
    fix: 'Use the current fidelity fixture diagnostics rather than this reserved code.' }],

  ['OODS-S019', { code: 'OODS-S019', category: 'server_error', message: 'Token build failed; source writes remain in place', retryable: true, severity: 'error',
    cause: 'The token build failed and any source writes remain in place.',
    fix: 'Inspect the build output, fix the source or build environment and run the token build again.' }],
  ['OODS-S020', { code: 'OODS-S020', category: 'server_error', message: 'Payload directory is not writable; the response carries no payload', retryable: true, severity: 'error',
    cause: 'Generated payload files could not be written to the payload directory.',
    fix: 'Choose a writable payload directory and retry generation.' }],
  ['OODS-S021', { code: 'OODS-S021', category: 'server_error', message: 'Your objects or traits folder is not writable; nothing was registered', retryable: true, severity: 'error',
    cause: 'The configured team object or trait folder could not be written.',
    fix: 'Restore write access to the configured folder and register the definition again.' }],
  ['OODS-S022', { code: 'OODS-S022', category: 'server_error', message: 'Token build failed after a brand was created; the brand was removed', retryable: true, severity: 'error',
    cause: 'The token build failed after brand creation, so the new brand was removed.',
    fix: 'Fix the token-build error and create the brand again.' }],

  // ── Rate Limit ──────────────────────────────────────────────────────────
  ['OODS-R001', { code: 'OODS-R001', category: 'rate_limit', message: 'Rate limit exceeded', retryable: true, severity: 'error',
    cause: 'The tool\'s request rate limit has been exhausted.',
    fix: 'Wait for the rate limit to refill and reduce the request rate.' }],
  ['OODS-R002', { code: 'OODS-R002', category: 'rate_limit', message: 'Concurrency limit exceeded', retryable: true, severity: 'error',
    cause: 'The tool already has its maximum permitted concurrent requests.',
    fix: 'Wait for in-flight requests to finish before retrying.' }],

  // Fidelity renderers return these diagnostics without throwing ToolError.
  ['OODS-FP-001', { code: 'OODS-FP-001', category: 'validation', message: 'Unknown fidelity fixture', retryable: true, severity: 'error',
    cause: 'The requested fidelity fixture is not in the named fixture allowlist.',
    fix: 'Choose a named fixture from the tool schema or pass an inline manifest.' }],
  ['OODS-FP-002', { code: 'OODS-FP-002', category: 'validation', message: 'Fidelity fixture file missing', retryable: false, severity: 'error',
    cause: 'A named fidelity fixture has no file in the installed runtime.',
    fix: 'Restore the runtime fixture files or pass a valid inline manifest.' }],
  ['OODS-FP-003', { code: 'OODS-FP-003', category: 'validation', message: 'Unsupported fidelity kind', retryable: true, severity: 'error',
    cause: 'The request names a fidelity renderer the tool does not support.',
    fix: 'Use boxes-arrows, wireframe, review or branded-mockup.' }],
  ['OODS-FP-004', { code: 'OODS-FP-004', category: 'validation', message: 'Fidelity source selection is ambiguous', retryable: true, severity: 'error',
    cause: 'The request supplies no source or more than one source.',
    fix: 'Supply exactly one of object, objects, schema, schemaRef, fixture or manifest.' }],
  ['OODS-FP-005', { code: 'OODS-FP-005', category: 'validation', message: 'Invalid inline fidelity manifest', retryable: true, severity: 'error',
    cause: 'The inline manifest is not an object with an entities array.',
    fix: 'Pass an Object Catalog manifest containing an entities array.' }],
  ['OODS-FP-006', { code: 'OODS-FP-006', category: 'validation', message: 'Fidelity diagram input is unsupported', retryable: true, severity: 'error',
    cause: 'The diagram source, object set, depth, theme or built brand fails its declared limits or token requirements.',
    fix: 'Use supported inputs, reduce diagram depth or size, and restore the named built brand tokens.' }],
  ['OODS-FP-007', { code: 'OODS-FP-007', category: 'validation', message: 'Fidelity relationship contract failed', retryable: true, severity: 'error',
    cause: 'An object relationship declaration fails the relationship contract checks.',
    fix: 'Correct the reported object relationship fields before generating the diagram.' }],
  ['OODS-FP-008', { code: 'OODS-FP-008', category: 'validation', message: 'Composed fidelity rendering failed', retryable: true, severity: 'error',
    cause: 'The composed schema exceeds diagram limits, duplicates node ids or raises an unexpected rendering error.',
    fix: 'Correct duplicate ids or the reported rendering issue and reduce the composition to the named size limit.' }],
  ['OODS-BM-001', { code: 'OODS-BM-001', category: 'validation', message: 'Entity lacks catalog annotations', retryable: true, severity: 'warning',
    cause: 'The branded-mockup pre-emitter produced no catalog annotations for an entity, so it was skipped.',
    fix: 'Supply the entity\'s Object Catalog annotations and render again.' }],
  ['OODS-BM-002', { code: 'OODS-BM-002', category: 'validation', message: 'Unknown branded-mockup brand overlay', retryable: true, severity: 'error',
    cause: 'A manifest entity or override names a brand overlay outside the supported A and B brands.',
    fix: 'Use A or B for the manifest-based branded mockup.' }],
  ['OODS-BM-003', { code: 'OODS-BM-003', category: 'validation', message: 'Branded-mockup entity rendering failed', retryable: true, severity: 'error',
    cause: 'Rendering a manifest entity as a branded mockup threw an exception.',
    fix: 'Correct the entity or brand-token issue named in the rendering error.' }],
  ['OODS-BM-004', { code: 'OODS-BM-004', category: 'validation', message: 'Deprecated branded-mockup brand alias', retryable: true, severity: 'warning',
    cause: 'A manifest uses a deprecated brand-prefixed alias that is accepted for one release.',
    fix: 'Replace the alias with its returned canonical brand id.' }],
  ['OODS-BA-001', { code: 'OODS-BA-001', category: 'validation', message: 'Entity lacks catalog annotations', retryable: true, severity: 'warning',
    cause: 'The boxes-and-arrows pre-emitter produced no catalog annotations for an entity, so it was skipped.',
    fix: 'Supply the entity\'s Object Catalog annotations and render again.' }],
  ['OODS-BA-002', { code: 'OODS-BA-002', category: 'validation', message: 'Boxes-and-arrows entity rendering failed', retryable: true, severity: 'error',
    cause: 'Rendering a manifest entity as boxes and arrows threw an exception.',
    fix: 'Correct the entity issue named in the rendering error.' }],
  ['OODS-WF-001', { code: 'OODS-WF-001', category: 'validation', message: 'Entity lacks catalog annotations', retryable: true, severity: 'warning',
    cause: 'The wireframe pre-emitter produced no catalog annotations for an entity, so it was skipped.',
    fix: 'Supply the entity\'s Object Catalog annotations and render again.' }],
  ['OODS-WF-002', { code: 'OODS-WF-002', category: 'validation', message: 'Wireframe entity rendering failed', retryable: true, severity: 'error',
    cause: 'Rendering a manifest entity as a wireframe threw an exception.',
    fix: 'Correct the entity issue named in the rendering error.' }],
  ['OODS-REV-001', { code: 'OODS-REV-001', category: 'validation', message: 'Entity lacks catalog annotations', retryable: true, severity: 'warning',
    cause: 'The review pre-emitter produced no catalog annotations for an entity, so it was skipped.',
    fix: 'Supply the entity\'s Object Catalog annotations and render again.' }],
  ['OODS-REV-002', { code: 'OODS-REV-002', category: 'validation', message: 'Review entity rendering failed', retryable: true, severity: 'error',
    cause: 'Rendering a manifest entity for review threw an exception.',
    fix: 'Correct the entity issue named in the rendering error.' }],
]);

/** Codes retained for compatibility or historical receipts, with no emitter in this runtime. */
export const RESERVED_CODES: Readonly<Record<string, string>> = {
  'OODS-V012': 'Reserved for the retired billing fixture validation; no current emitter.',
  'OODS-V013': 'Reserved for the retired fixture-provider validation; no current emitter.',
  'OODS-V014': 'Reserved for the retired fixture-provider selection check; no current emitter.',
  'OODS-V015': 'Reserved for the retired release-verification package check; no current emitter.',
  'OODS-V200': 'Reserved map-validation code; the current map tool does not emit it.',
  'OODS-N008': 'Reserved for the retired fixture-object lookup; no current emitter.',
  'OODS-N012': 'Reserved for the retired accessibility-token lookup; no current emitter.',
  'OODS-N019': 'Retired design-loop-server refusal; retained only in historical tool-ledger evidence, replaced by the preview host route.',
  'OODS-C002': 'Reserved for the retired duplicate-tag check; no current emitter.',
  'OODS-S004': 'Reserved object-load failure; current object loading returns its specific diagnostics.',
  'OODS-S008': 'Reserved fixture-load failure; fidelity preview uses its FP codes.',
  'OODS-S018': 'Reserved for the retired fixture-provider mismatch; no current emitter.',
};

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

export function getDefinition(code: string): ErrorDefinition | undefined {
  return registry.get(code);
}

export function isRetryable(code: string): boolean {
  return registry.get(code)?.retryable ?? false;
}

export function allCodes(): readonly ErrorDefinition[] {
  return [...registry.values()];
}

// ---------------------------------------------------------------------------
// Error factory
// ---------------------------------------------------------------------------

export function createError(code: string, context?: { message?: string; details?: unknown }): StructuredError {
  const def = registry.get(code);
  if (!def) {
    return {
      code,
      category: 'server_error',
      message: context?.message ?? `Unknown error code: ${code}`,
      retryable: false,
      details: context?.details,
      incidentId: randomUUID(),
    };
  }
  return {
    code: def.code,
    category: def.category,
    message: context?.message ?? def.message,
    retryable: def.retryable,
    details: context?.details,
    incidentId: randomUUID(),
  };
}

// ---------------------------------------------------------------------------
// Legacy bridge: maps old ERROR_CODES constants → new OODS codes
// ---------------------------------------------------------------------------

export const LEGACY_CODE_MAP: Record<string, string> = {
  SCHEMA_INPUT: 'OODS-V001',
  SCHEMA_OUTPUT: 'OODS-V002',
  UNKNOWN_TOOL: 'OODS-N001',
  POLICY_DENIED: 'OODS-S001',
  TIMEOUT: 'OODS-S002',
  BAD_REQUEST: 'OODS-S003',
  RATE_LIMIT: 'OODS-R001',
  CONCURRENCY: 'OODS-R002',
};
