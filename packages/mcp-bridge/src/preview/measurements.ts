import type { SubstitutionContractReport } from '@oods/component-contracts';
import { escapeHtml } from './page.js';
import type { CompositionVersion, PreviewBrand, PreviewFramework, PreviewTheme } from './store.js';

const THEMES = ['light', 'dark', 'hc'] as const;

/**
 * Every scope the page can be measured in (s221-m03, the website's defect (b)): each brand the token build carries, which
 * the brand switch offers, and the version's own, in light, dark and hc; then any other scope already generated or
 * measured. design.preview's measured.notMeasured lists the same (packages/mcp-server/src/tools/design.preview.ts).
 */
export function measurableScopes(record: CompositionVersion, brands: readonly string[]): string[] {
  const axe = (record.measurements?.axe as Record<string, Record<string, unknown>> | undefined) ?? {};
  const own = [...new Set([...brands, record.brand])].flatMap(brand => THEMES.map(theme => `${brand}/${theme}`));
  const seen = [...Object.keys(record.scopes ?? {}), ...Object.values(axe).flatMap(scopes => Object.keys(scopes))].filter(scope => !own.includes(scope));
  return [...own, ...[...new Set(seen)].sort()];
}

/** What the running page posts back after axe-core ran for one framework, brand and theme. */
export interface AxeResult {
  engine: { name: string; version: string };
  ranAt: string;
  url: string;
  framework: PreviewFramework;
  brand: PreviewBrand;
  theme: PreviewTheme;
  violations: Array<{ id: string; impact: string | null; help: string; helpUrl: string; tags: string[]; nodes: number; targets: string[] }>;
  passes: number;
  incomplete: number;
  inapplicable: number;
}

type Validation = { profile?: string; checks?: Array<{ name?: string; status?: string } | string>; notChecked?: string[]; axes?: unknown };
type Certification = { status: string; coverage: string | null; conformant: boolean | null; pillars: Record<string, { status?: string } | string | boolean> | null; findings: unknown[] };
type Chart = { path: string; chartType: string; name: string; theme: string; brand: string; certification: Certification; narrow?: { path: string; certification: Certification }; wide?: { path: string; certification: Certification } };

const checkName = (check: { name?: string } | string) => typeof check === 'string' ? check : check.name ?? '?';

/** Validate the posted axe body before it is stored; only its shape, never its verdicts. `isBrand` is the token build's brand list. */
export function parseAxeResult(body: unknown, isBrand: (value: unknown) => boolean): AxeResult | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const raw = body as Record<string, unknown>;
  const framework = raw.framework, brand = raw.brand, theme = raw.theme;
  if (framework !== 'react' && framework !== 'vue') return undefined;
  if (typeof brand !== 'string' || !isBrand(brand)) return undefined;
  if (theme !== 'light' && theme !== 'dark' && theme !== 'hc') return undefined;
  const engine = raw.engine as { name?: unknown; version?: unknown } | undefined;
  if (!engine || typeof engine.name !== 'string' || typeof engine.version !== 'string') return undefined;
  if (!Array.isArray(raw.violations)) return undefined;
  for (const key of ['passes', 'incomplete', 'inapplicable']) if (!Number.isInteger(raw[key]) || (raw[key] as number) < 0) return undefined;
  const violations = raw.violations.map(violation => {
    const item = violation as Record<string, unknown>;
    if (typeof item.id !== 'string') throw new Error('violation without an id');
    return { id: item.id, impact: typeof item.impact === 'string' ? item.impact : null, help: String(item.help ?? ''), helpUrl: String(item.helpUrl ?? ''), tags: Array.isArray(item.tags) ? item.tags.map(String) : [], nodes: Number.isInteger(item.nodes) ? item.nodes as number : 0, targets: Array.isArray(item.targets) ? item.targets.slice(0, 5).map(String) : [] };
  });
  return { engine: { name: engine.name, version: engine.version }, ranAt: typeof raw.ranAt === 'string' ? raw.ranAt : new Date().toISOString(), url: String(raw.url ?? ''), framework, brand, theme, violations, passes: raw.passes as number, incomplete: raw.incomplete as number, inapplicable: raw.inapplicable as number };
}

/**
 * The measurement panel of one version: the generation receipt per framework (checks that ran and
 * notChecked), artifact.certify for every placed chart, and axe-core per framework and scope run
 * inside the running page. Every measurement the version does not carry is named as not run.
 */
export function renderMeasurementPanel(record: CompositionVersion, brands: readonly string[]): string {
  const measurements = record.measurements ?? {};
  const validation = (measurements.validation as Record<string, Validation> | undefined) ?? {};
  const charts = (measurements.charts as Chart[] | undefined);
  const axe = (measurements.axe as Record<string, Record<string, AxeResult>> | undefined) ?? {};
  const frameworks = (['react', 'vue'] as PreviewFramework[]).filter(framework => record.artifacts[framework]);
  const sections: string[] = [];
  if (Object.values(record.artifacts).some(entry => entry?.artifact.substitutions?.some(mapping => mapping.source.shadcn))) {
    sections.push('<p data-oods-theme-limit="shadcn-hc">In hc, the team’s shadcn components keep their light palette: shadcn has no high-contrast theme.</p>');
  }

  const validationRows = frameworks.map(framework => {
    const receipt = validation[framework];
    if (!receipt) return `<li data-oods-not-measured="validation:${framework}"><strong>${framework}</strong>: generation receipt not stored (not run).</li>`;
    const ran = (receipt.checks ?? []).map(checkName);
    const not = receipt.notChecked ?? [];
    return `<li data-oods-measured="validation:${framework}"><strong>${framework}</strong> · profile <code>${escapeHtml(String(receipt.profile ?? '?'))}</code> · ${ran.length} checks ran (${ran.map(escapeHtml).join(', ') || 'none'}) · ${not.length} not checked (${not.map(escapeHtml).join(', ') || 'none'}).</li>`;
  });
  sections.push(`<h4>Generation receipt (code.generate)</h4><ul>${validationRows.join('') || '<li data-oods-not-measured="validation">No framework generated yet (not run).</li>'}</ul>`);

  const components = (measurements.componentContracts as Record<string, SubstitutionContractReport[]> | undefined) ?? {};
  if (Object.keys(components).length) {
    const reports = Object.values(components).flat().map(report => `<details data-oods-component-contract="${escapeHtml(`${report.framework}:${report.component}`)}"><summary>${escapeHtml(report.framework)} · ${escapeHtml(report.component)}: ${report.summary.met} met, ${report.summary.unmet} unmet, ${report.summary['not-checked']} not checked</summary><p>${escapeHtml(report.source.shadcn?.module ?? report.source.package ?? '')}@${escapeHtml(report.source.shadcn?.closureHash ?? report.source.version ?? '')} · ${escapeHtml(report.source.export)}</p>${report.summary.unmet ? '<p role="status"><strong>Warning:</strong> this component has unmet obligations. Generation remains available.</p>' : ''}<p>${escapeHtml(report.browser ?? 'Browser check not run')} · ${escapeHtml(report.checkedAt ?? 'No check time')}</p><ul>${report.obligations.map(row => `<li><strong>${escapeHtml(row.status)}</strong> · ${escapeHtml(row.id)}: ${escapeHtml(row.reason)}</li>`).join('')}</ul></details>`);
    sections.push(`<h4>Team component contract reports</h4><p>Advisory shared-scenario checks. Unchecked obligations are not conformance claims.</p>${reports.join('')}`);
  }

  const verdictOf = (certification: Certification) => certification.conformant === true ? 'conformant' : certification.conformant === false ? 'not conformant' : 'not on the certified path (conformant null)';
  const chartRow = (chart: Chart, scope?: string) => {
    const pillars = chart.certification.pillars ? Object.entries(chart.certification.pillars).map(([pillar, value]) => `${escapeHtml(pillar)}=${escapeHtml(typeof value === 'object' && value ? String(value.status ?? JSON.stringify(value)) : String(value))}`).join(' ') : 'no pillars';
    const narrow = chart.narrow ? ` · narrow render <code>${escapeHtml(chart.narrow.path)}</code> <strong>${verdictOf(chart.narrow.certification)}</strong> (${chart.narrow.certification.findings.length} findings)` : '';
    const wide = chart.wide ? ` · wide render <code>${escapeHtml(chart.wide.path)}</code> <strong>${verdictOf(chart.wide.certification)}</strong> (${chart.wide.certification.findings.length} findings)` : '';
    return `<li data-oods-measured="chart:${escapeHtml(chart.path)}${scope ? `@${escapeHtml(scope)}` : ''}"><code>${escapeHtml(chart.path)}</code> · ${escapeHtml(chart.chartType)} · ${escapeHtml(chart.brand)}/${escapeHtml(chart.theme)} · <strong>${verdictOf(chart.certification)}</strong> · coverage ${escapeHtml(String(chart.certification.coverage ?? 'null'))} · ${pillars} · ${chart.certification.findings.length} findings${narrow}${wide}.</li>`;
  };
  if (charts === undefined) sections.push('<h4>Placed charts (artifact.certify)</h4><ul><li data-oods-not-measured="charts">Placed charts not certified (not run).</li></ul>');
  else if (charts.length === 0) sections.push('<h4>Placed charts (artifact.certify)</h4><ul><li data-oods-measured="charts:none">No chart is placed on this version; nothing to certify.</li></ul>');
  else {
    sections.push(`<h4>Placed charts (artifact.certify) <span class="count">${charts.length}</span></h4><ul>${charts.map(chart => chartRow(chart)).join('')}</ul>`);
    // A brand or theme switch renders and certifies the placed charts for that scope; each stored scope is listed as measured.
    for (const [scope, generation] of Object.entries(record.scopes ?? {})) {
      const scoped = generation?.charts as Chart[] | undefined;
      if (!scoped?.length) continue;
      sections.push(`<h4>Placed charts rendered for ${escapeHtml(scope)} (artifact.certify, on a brand or theme switch) <span class="count">${scoped.length}</span></h4><ul data-oods-chart-scope="${escapeHtml(scope)}">${scoped.map(chart => chartRow(chart, scope)).join('')}</ul>`);
    }
  }

  const axeRows: string[] = [];
  // s211-m02: each scope the page measured is a line; the scopes not yet measured share one line per framework, each
  // still named and marked, instead of a line apiece saying "axe not run".
  for (const framework of frameworks) {
    const notRun: string[] = [];
    for (const scope of measurableScopes(record, brands)) {
      const result = axe[framework]?.[scope];
      if (!result) { notRun.push(`<span data-oods-not-measured="axe:${framework}:${scope}">${scope}</span>`); continue; }
      const violations = result.violations.length ? result.violations.map(violation => `<code>${escapeHtml(violation.id)}</code> (${escapeHtml(violation.impact ?? 'n/a')}, ${violation.nodes} nodes)`).join(', ') : 'none';
      axeRows.push(`<li data-oods-measured="axe:${framework}:${scope}"><strong>${framework}</strong> ${scope} · ${escapeHtml(result.engine.name)} ${escapeHtml(result.engine.version)} · ${result.violations.length} violations (${violations}) · ${result.passes} passes · ${result.incomplete} incomplete · ${result.inapplicable} inapplicable · ran ${escapeHtml(result.ranAt)}.</li>`);
    }
    if (notRun.length) axeRows.push(`<li data-oods-not-run="axe:${framework}"><strong>${framework}</strong> not measured yet in ${notRun.join(', ')}: axe runs when the page opens in that brand and theme.</li>`);
  }
  sections.push(`<h4>Accessibility in the running page (axe-core)</h4><ul>${axeRows.join('') || '<li data-oods-not-measured="axe">No framework generated yet (not run).</li>'}</ul>`);

  const notRun = sections.join('').match(/data-oods-not-measured="/g)?.length ?? 0;
  return `<section data-oods-measurements="${escapeHtml(record.compositionId)}@${record.version}" data-oods-not-measured-count="${notRun}"><h3>Measurements · v${record.version}</h3>${sections.join('')}</section>`;
}

/** Store one axe result on the version: measurements.axe[framework][brand/theme]. */
export function withAxeResult(record: CompositionVersion, result: AxeResult): CompositionVersion {
  const axe = { ...((record.measurements?.axe as Record<string, Record<string, AxeResult>> | undefined) ?? {}) };
  axe[result.framework] = { ...(axe[result.framework] ?? {}), [`${result.brand}/${result.theme}`]: result };
  return { ...record, measurements: { ...(record.measurements ?? {}), axe } };
}
