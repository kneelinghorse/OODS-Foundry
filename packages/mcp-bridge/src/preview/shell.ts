import { renderMeasurementPanel } from './measurements.js';
import { escapeHtml, scriptJson } from './page.js';
import type { AcceptedSummary, CompositionVersion, PreviewBrand, PreviewFramework, PreviewTheme, VersionSummary } from './store.js';

export interface PreviewShellInput {
  record: CompositionVersion;
  versions: VersionSummary[];
  framework: PreviewFramework;
  brand: PreviewBrand;
  theme: PreviewTheme;
  /** A fixed width, a typed width ('free'), or the width of the window ('fit', the default since s211-m02). */
  width: number | 'free' | 'fit';
  base: string;
  /** The composition's standing acceptance; the lineage and the version list show it when there is one. */
  accepted?: AcceptedSummary;
  /** The design system's stylesheet the running app loads; the page's own chrome is drawn from the same tokens. */
  stylesHref?: string;
  /** s213-m04: the token build's CSS, linked before the runtime styles (which carry the component CSS only). */
  tokensHref?: string;
  /** The token build's brands, for the brand switch (s213-m04). */
  brands: readonly PreviewBrand[];
}

export const FIXED_WIDTHS = [390, 820, 1440] as const;

type Node = { id: string; component: string; props?: Record<string, unknown>; children?: Node[]; meta?: { intent?: string } };
const isSlot = (node: Node) => /^slot-/.test(node.id) || (typeof node.meta?.intent === 'string' && node.meta.intent.startsWith('slot:'));
/** The field a sibling stands for: its own field, or the first field a slot places (the composer applies the same rule). */
function fieldKeyOf(node: Node): string | undefined {
  if (typeof node.props?.field === 'string') return node.props.field;
  const fields = new Set<string>();
  const walk = (child: Node) => { if (typeof child.props?.field === 'string') fields.add(child.props.field); child.children?.forEach(walk); };
  node.children?.forEach(walk);
  if (isSlot(node)) return fields.values().next().value;
  return fields.size === 1 ? fields.values().next().value : undefined;
}

/** A link to one context item's source, so the page can render an anchor and the app a button. */
export type ContextLink = (item: { url?: string; title: string }) => string;

/**
 * The decisions and evidence about this object, beside the design (Sprint 203 m05).
 *
 * One renderer, two surfaces: the browser page and the conversation app both call this, and pass the
 * link callback that suits them — the Sprint 202 pattern that keeps renderLineage and renderVersionList
 * honest across both. A version with no context renders nothing at all, so the page it produces for
 * every composition that has none is byte-identical to what it produced before this existed.
 *
 * Every item states where it came from, the query that produced it and when it was fetched, because
 * Forge did not fetch it and cannot vouch for it — the provenance is the only reason to believe it. An
 * item fetched before this version was composed is marked rather than hidden. A source that returned
 * nothing is printed as what was searched, so an empty panel reads as "nothing was found" rather than
 * "nobody asked".
 */
export function renderContext(record: CompositionVersion, link: ContextLink): string {
  const context = record.context;
  if (!context) return '';
  const { items, searched } = context;
  if (!items.length && !searched.length) return '';
  const stale = items.filter(item => item.staleForVersion).length;
  const rows = items.map(item => {
    const content = item.excerpt ?? item.body ?? '';
    const when = item.timestamp ? `<time datetime="${escapeHtml(item.timestamp)}">${escapeHtml(item.timestamp)}</time>` : '';
    return [
      `<li data-oods-context-item="${escapeHtml(item.source)}"${item.staleForVersion ? ' data-oods-context-stale="true"' : ''}>`,
      `<strong>${link(item)}</strong>`,
      item.staleForVersion ? ' <span data-oods-context-stale-note="true">fetched before this version</span>' : '',
      `<p class="context-body">${escapeHtml(content.length > 400 ? `${content.slice(0, 400)}…` : content)}</p>`,
      `<p class="context-provenance">${escapeHtml(item.source)} · <code>${escapeHtml(item.id)}</code>`,
      when ? ` · ${when}` : '',
      ` · found by <q>${escapeHtml(item.query)}</q> · fetched ${escapeHtml(item.fetchedAt)}</p>`,
      '</li>',
    ].join('');
  }).join('');
  const empties = searched.map(search =>
    `<li data-oods-context-searched="${escapeHtml(search.source)}">${escapeHtml(search.source)} · <q>${escapeHtml(search.query)}</q> · ${search.found === 0 ? 'nothing found' : `${search.found} found`} · searched ${escapeHtml(search.fetchedAt)}</li>`,
  ).join('');
  return [
    '<section class="context" data-oods-context="true">',
    `<h3>Context <span class="count">${items.length} ${items.length === 1 ? 'item' : 'items'} about ${escapeHtml(context.object)}${stale ? `, ${stale} fetched before this version` : ''}</span></h3>`,
    `<p class="context-keyed">Keyed to <code>${escapeHtml(context.urn)}</code>. Supplied by the caller and stored on this version; OODS Foundry fetched none of it.</p>`,
    items.length ? `<ul data-oods-context-items="true">${rows}</ul>` : '',
    searched.length ? `<h4>Searched</h4><ul data-oods-context-searched-list="true">${empties}</ul>` : '',
    '</section>',
  ].filter(Boolean).join('');
}

/** A link to the screen a row was observed on: an anchor on the page, the destination as text in the app. */
export type ObservationLink = (href: string, text: string) => string;

const CATEGORY_LABEL: Record<string, string> = { disagreeing: 'Disagrees', agreeing: 'Agrees', 'observed-only': 'Observed only', 'composed-only': 'Composed only' };

/**
 * What Stage1 observed on the live app beside what Forge composes for this object (Sprint 204 m05).
 *
 * The same renderer serves the browser page and the conversation app, each passing the link callback
 * that suits it, as renderContext does. Every row names both sides' provenance — the Stage1 run, target,
 * artifact and capture time, and the Forge object, context and URN — or the reader has no reason to
 * believe it. Rows gathered for an earlier version are marked, never re-dated. There is nothing to act on
 * here: no approve, no reject, no queue. A person reads the difference and decides outside Forge.
 *
 * A version with no observation renders nothing at all, and neither does its stylesheet.
 */
export function renderObservation(record: CompositionVersion, link: ObservationLink): string {
  const observation = record.observation;
  if (!observation) return '';
  const { run, rows } = observation;
  const stale = rows.filter(row => row.staleForVersion).length;
  const count = (category: string) => rows.filter(row => row.category === category).length;
  const tally = ['disagreeing', 'agreeing', 'observed-only', 'composed-only'].map(category => [category, count(category)] as const).filter(([, n]) => n > 0).map(([category, n]) => `${n} ${CATEGORY_LABEL[category]!.toLowerCase()}`).join(', ');
  const screenOf = (row: typeof rows[number]) => {
    if (!row.screen) return 'no observed screen';
    const route = row.routes[0];
    return route ? link(new URL(route, run.target).href, row.screen) : escapeHtml(row.screen);
  };
  const items = rows.map(row => [
    `<li data-oods-observation-row="${escapeHtml(row.category)}" data-oods-observation-axis="${escapeHtml(row.axis)}"${row.staleForVersion ? ' data-oods-observation-stale="true"' : ''}>`,
    `<strong>${escapeHtml(CATEGORY_LABEL[row.category] ?? row.category)} · ${escapeHtml(row.axis)}</strong> · ${screenOf(row)}`,
    row.staleForVersion ? ' <span data-oods-observation-stale-note="true">compared an earlier version</span>' : '',
    `<p class="observation-side"><span>Observed</span> ${escapeHtml(row.observed)}</p>`,
    `<p class="observation-side"><span>Composed</span> ${escapeHtml(row.composed)}</p>`,
    `<p class="observation-provenance">Stage1 run <code>${escapeHtml(row.stage1.runId)}</code> · ${escapeHtml(row.stage1.target)} · <code>${escapeHtml(row.stage1.artifactKind)}</code> ${escapeHtml(row.stage1.readPath)}${row.stage1.pointers.length ? ` (${row.stage1.pointers.length} pointer${row.stage1.pointers.length === 1 ? '' : 's'})` : ' (none found)'} · captured ${escapeHtml(row.stage1.capturedAt ?? 'unrecorded')}</p>`,
    `<p class="observation-provenance">OODS Foundry ${row.forge.object ? `${escapeHtml(row.forge.object)} ${escapeHtml(row.forge.context ?? '')} · <code>${escapeHtml(row.forge.urn ?? '')}</code>` : 'no compared object'} · searched ${escapeHtml(row.forge.searched)}</p>`,
    '</li>',
  ].join('')).join('');
  return [
    '<section class="observation" data-oods-observation="true">',
    `<h3>Observed on the live app <span class="count">${rows.length ? `${rows.length} ${rows.length === 1 ? 'row' : 'rows'} about ${escapeHtml(observation.object)}: ${tally}` : `nothing found about ${escapeHtml(observation.object)}`}${stale ? `, ${stale} compared an earlier version` : ''}</span></h3>`,
    `<p class="observation-keyed">Stage1 run <code>${escapeHtml(run.runId)}</code> of ${escapeHtml(run.target)}, captured ${escapeHtml(run.capturedAt ?? 'unrecorded')}, compared with <code>${escapeHtml(observation.urn)}</code> (${escapeHtml(observation.context)}). ${escapeHtml(observation.judgement)}</p>`,
    rows.length
      ? `<ul data-oods-observation-rows="true">${items}</ul>`
      : `<p data-oods-observation-empty="true">Searched ${escapeHtml(observation.searched.screens.join(', ') || 'no comparable screen of this context')} against ${observation.searched.observedScreens} observed screens (${observation.searched.observedRoutes} routes) in run <code>${escapeHtml(run.runId)}</code>: nothing found.</p>`,
    '</section>',
  ].join('');
}

/**
 * The four edits, from the page: regions up/down, a slot swapped to one of the composer's candidates,
 * fields up/down per region, a new seed. Each posts one operation; the host re-composes a new version.
 */
export function renderEditControls(record: CompositionVersion): string {
  const screen = (record.schema as { screens: Node[] }).screens[0];
  const regions = screen?.children ?? [];
  const regionList = regions.length > 1
    ? `<ol data-regions="${escapeHtml(JSON.stringify(regions.map(node => node.id)))}">${regions.map((node, index) => `<li><code>${escapeHtml(node.id)}</code> ${escapeHtml(node.component)} <button type="button" class="move" data-kind="region" data-index="${index}" data-delta="-1" aria-label="Move ${escapeHtml(node.id)} up"${index === 0 ? ' disabled' : ''}>↑</button><button type="button" class="move" data-kind="region" data-index="${index}" data-delta="1" aria-label="Move ${escapeHtml(node.id)} down"${index === regions.length - 1 ? ' disabled' : ''}>↓</button></li>`).join('')}</ol>`
    : `<p>${regions.length} region; nothing to reorder.</p>`;
  // s211-m02: a swap is offered only for a slot this version places on screen; a slot the composer left empty or
  // dropped offered a swap that changed nothing a person could see.
  const placed = new Set<string>();
  const collect = (node: Node) => { if (typeof node.meta?.intent === 'string' && node.meta.intent.startsWith('slot:')) placed.add(node.meta.intent.slice(5)); node.children?.forEach(collect); };
  (record.schema as { screens: Node[] }).screens.forEach(collect);
  const slots = record.slots.filter(slot => (slot.candidates ?? []).length > 1 && placed.has(slot.slotName));
  const slotForms = slots.length
    ? slots.map(slot => `<form data-edit="swap-slot" data-slot="${escapeHtml(slot.slotName)}" data-current="${escapeHtml(slot.selectedComponent ?? '')}"><label>${escapeHtml(slot.slotName)} <select name="component" aria-label="Component for slot ${escapeHtml(slot.slotName)}">${(slot.candidates ?? []).map(candidate => `<option value="${escapeHtml(candidate)}"${candidate === slot.selectedComponent ? ' selected' : ''}>${escapeHtml(candidate)}</option>`).join('')}</select></label> <button type="submit">Swap</button></form>`).join('')
    : '<p>No slot on screen has more than one composer candidate.</p>';
  const fieldLists = regions.map(region => {
    const names: string[] = [];
    const walk = (node: Node) => { for (const child of node.children ?? []) { const key = fieldKeyOf(child); if (key && !names.includes(key)) names.push(key); if (!isSlot(child)) walk(child); } };
    walk(region);
    if (names.length < 2) return '';
    return `<h3>${escapeHtml(region.id)}</h3><ol data-fields="${escapeHtml(JSON.stringify(names))}" data-region="${escapeHtml(region.id)}">${names.map((name, index) => `<li><code>${escapeHtml(name)}</code> <button type="button" class="move" data-kind="field" data-index="${index}" data-delta="-1" aria-label="Move ${escapeHtml(name)} up"${index === 0 ? ' disabled' : ''}>↑</button><button type="button" class="move" data-kind="field" data-index="${index}" data-delta="1" aria-label="Move ${escapeHtml(name)} down"${index === names.length - 1 ? ' disabled' : ''}>↓</button></li>`).join('')}</ol>`;
  }).join('');
  const seed = (record.schema as { seed?: string }).seed ?? '';
  return [
    '<h3>Regions</h3>', regionList,
    '<h3>Slots</h3>', slotForms,
    '<h3>Fields</h3>', fieldLists || '<p>No region carries two or more fields.</p>',
    '<h3>Seed</h3>', `<form data-edit="seed" data-current="${escapeHtml(seed)}"><input name="seed" value="${escapeHtml(seed)}" maxlength="64" placeholder="sample-data seed" aria-label="Sample-data seed"> <button type="submit">Re-seed</button></form>`,
  ].join('');
}
const short = (hash: string | null) => hash ? hash.replace(/^sha256:/, '').slice(0, 12) : 'none';

/** A link to another version of the same composition: an anchor on the page, a button that opens it in place in the preview app. */
export type VersionLink = (version: number, label: string) => string;

/** The lineage of one version: composition, version of how many, parent, operation, build, schema, created, generated for, and the accepted version when the composition has one. */
export function renderLineage(record: CompositionVersion, versionCount: number, link: VersionLink, accepted?: AcceptedSummary): string {
  const row = (term: string, value: string) => `<div class="row"><dt>${escapeHtml(term)}</dt><dd>${value}</dd></div>`;
  return [
    row('Composition', `<code>${escapeHtml(record.compositionId)}</code>`),
    row('Version', `<strong>${record.version}</strong> of ${versionCount}`),
    row('Parent', record.parentVersion === null ? 'none (first version)' : link(record.parentVersion, `version ${record.parentVersion}`)),
    row('Operation', `<code>${escapeHtml(record.operation)}</code>`),
    // s211-m03: "Build", one plain word on one line; the value is the head the version was made by, or the source checkout.
    row('Build', `<code>${escapeHtml(record.head ?? 'source checkout')}</code>`),
    row('Schema', `<code>${escapeHtml(short(record.schemaHash))}</code>`),
    row('Created', `<time datetime="${escapeHtml(record.createdAt)}">${escapeHtml(record.createdAt.replace('T', ' ').replace(/\.\d+Z$/, ' UTC'))}</time>`),
    row('Generated for', `${escapeHtml(record.brand)} / ${escapeHtml(record.theme)}`),
    ...(accepted ? [row('Accepted', `${accepted.version === record.version ? '<strong data-oods-accepted="this">this version</strong>' : `<span data-oods-accepted="other">${link(accepted.version, `version ${accepted.version}`)}</span>`} · ${escapeHtml(accepted.acceptedAt)}${accepted.acceptances > 1 ? ` · ${accepted.acceptances} acceptances` : ''}`)] : []),
  ].join('');
}

/** The composition's versions with their operation and parent, the current one marked, and the accepted one when there is one. */
export function renderVersionList(versions: VersionSummary[], current: number, link: VersionLink, acceptedVersion?: number): string {
  const mark = (version: number) => version === acceptedVersion ? ' · <strong data-oods-accepted="true">accepted</strong>' : '';
  return versions.map(entry => entry.version === current
    ? `<li aria-current="true"><strong>v${entry.version}</strong> · ${escapeHtml(entry.operation)}${entry.parentVersion === null ? '' : ` ← v${entry.parentVersion}`}${mark(entry.version)}</li>`
    : `<li>${link(entry.version, `v${entry.version}`)} · ${escapeHtml(entry.operation)}${entry.parentVersion === null ? '' : ` ← v${entry.parentVersion}`}${mark(entry.version)}</li>`).join('');
}

/**
 * The page a URL opens. s211-m02: it leads with the running app under a plain title, with the framework, brand, theme
 * and width switches beside the title. The lineage (composition, version, parent, operation, head), the versions and the
 * measurements are one toggle below the app, the four edits another, so nothing a reader needs first is an identifier.
 * Brand and theme re-mount the framed app in place through postMessage; framework and version navigate. The chrome is
 * drawn from the design system's tokens and follows the brand and theme the app is shown in.
 */
export function renderPreviewShell({ record, versions, framework, brand, theme, width, base, accepted, stylesHref, tokensHref, brands }: PreviewShellInput): string {
  const versionBase = `${base}/${record.compositionId}/${record.version}`;
  const appUrl = `${versionBase}/app?framework=${framework}&brand=${brand}&theme=${theme}`;
  const label = `${record.compose.object ?? 'composition'} ${record.compose.context ?? ''}`.trim();
  const title = label.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  const frameworks = (Object.keys(record.artifacts) as PreviewFramework[]).filter(name => record.artifacts[name]);
  const state = { compositionId: record.compositionId, version: record.version, framework, brand, theme, width, base };
  const pixelWidth = typeof width === 'number' ? width : 1024;
  const link: VersionLink = (version, text) => `<a href="${base}/${escapeHtml(record.compositionId)}/${version}?framework=${framework}&brand=${brand}&theme=${theme}">${text}</a>`;
  const lineage = renderLineage(record, versions.length, link, accepted);
  const contextLink: ContextLink = item => item.url
    ? `<a href="${escapeHtml(item.url)}" rel="noreferrer noopener" target="_blank">${escapeHtml(item.title)}</a>`
    : escapeHtml(item.title);
  const context = renderContext(record, contextLink);
  const observationLink: ObservationLink = (href, text) => `<a href="${escapeHtml(href)}" rel="noreferrer noopener" target="_blank">${escapeHtml(text)}</a>`;
  const observation = renderObservation(record, observationLink);
  const versionList = renderVersionList(versions, record.version, link, accepted?.version);
  const options = <T extends string | number>(name: string, values: readonly T[], current: T) => values.map(value => `<button type="button" data-control="${name}" data-value="${escapeHtml(String(value))}" aria-pressed="${String(value === current)}">${escapeHtml(String(value))}</button>`).join('');
  const widthLabel = width === 'fit' ? 'fits the window' : width === 'free' ? `${pixelWidth}px (free)` : `${width}px`;
  const group = (name: string, text: string, controls: string) => `<div class="switch"><span class="switch-label" id="switch-${name}">${text}</span><div class="controls" role="group" aria-labelledby="switch-${name}" data-oods-controls="${name}">${controls}</div></div>`;
  return [
    '<!doctype html>',
    `<html lang="en"${theme === 'dark' ? ' class="dark"' : ''} data-theme="${escapeHtml(theme)}" data-brand="${escapeHtml(brand)}">`,
    '<head>',
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(title)} v${record.version} · ${escapeHtml(framework)}</title>`,
    ...(tokensHref ? [`<link rel="stylesheet" href="${escapeHtml(tokensHref)}">`] : []),
    ...(stylesHref ? [`<link rel="stylesheet" href="${escapeHtml(stylesHref)}">`] : []),
    '<style>',
    'html,body{margin:0}body{background:var(--sys-surface-canvas,#f4f4f5);color:var(--sys-text-primary,#18181b);font-family:var(--sys-text-scale-body-md-font-family,system-ui,sans-serif);font-size:var(--sys-text-size-sm,.875rem);line-height:1.45}',
    '.bar{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:12px 24px;padding:16px var(--sys-page-gutter,24px);border-bottom:1px solid var(--sys-border-subtle,#d4d4d8);background:var(--sys-surface-raised,#fff)}',
    '.bar h1{margin:0;font-size:var(--sys-text-scale-heading-lg-font-size,1.5rem);line-height:1.2;font-weight:var(--ref-typography-weights-semibold,600)}',
    '.status{margin:4px 0 0;color:var(--sys-text-secondary,#52525b)}',
    '.switches{display:flex;flex-wrap:wrap;gap:12px 16px;align-items:flex-end}',
    '.switch{display:grid;gap:4px}.switch-label{font-size:var(--sys-text-size-xs,.75rem);color:var(--sys-text-secondary,#52525b)}',
    '.controls{display:flex;flex-wrap:wrap;gap:6px;align-items:center}',
    '.controls button{min-block-size:2rem;padding:0 var(--cmp-button-padding-inline-sm,.75rem);border:1px solid var(--sys-border-strong,#a1a1aa);border-radius:var(--cmp-button-radius,.5rem);background:var(--sys-surface-raised,#fff);color:var(--sys-text-primary,#18181b);font:inherit;font-weight:var(--ref-typography-weights-semibold,600);cursor:pointer}',
    '.controls button[aria-pressed="true"]{background:var(--sys-surface-interactive-primary-default,#18181b);border-color:var(--sys-surface-interactive-primary-default,#18181b);color:var(--sys-text-on-interactive,#fff)}',
    // Keep the system highlight pair together: Chromium's automatic text backplate can otherwise hide the label.
    '@media(forced-colors:active){.controls button[aria-pressed="true"]{forced-color-adjust:none;background:Highlight;border-color:Highlight;color:HighlightText}}',
    '.controls input{inline-size:5.5rem;min-block-size:2rem;box-sizing:border-box;padding:0 8px;border:1px solid var(--sys-border-strong,#a1a1aa);border-radius:var(--cmp-input-radius,.5rem);background:var(--sys-surface-raised,#fff);color:inherit;font:inherit}',
    // The typed width shows only while "free" is chosen; disabled beside the other widths it read as a stray field.
    '.controls input:disabled{display:none}',
    'main{padding:16px var(--sys-page-gutter,24px) 32px}',
    // A fixed width is exact: the frame keeps it and the stage scrolls sideways when the window is narrower.
    '.stage{overflow-x:auto}.frame{box-sizing:content-box;border:1px solid var(--sys-border-subtle,#d4d4d8);border-radius:var(--cmp-card-radius,.5rem);background:var(--sys-surface-canvas,#fff);overflow:hidden}',
    'iframe{display:block;border:0;width:100%;height:80vh;min-height:480px}',
    'details.panel{margin-top:16px;border:1px solid var(--sys-border-subtle,#d4d4d8);border-radius:var(--cmp-card-radius,.5rem);background:var(--sys-surface-raised,#fff)}',
    'details.panel>summary{padding:12px 16px;cursor:pointer;font-weight:var(--ref-typography-weights-semibold,600)}',
    'details.panel>.panel-body{padding:0 16px 16px;display:grid;gap:16px}',
    '.panel-body h2{font-size:var(--sys-text-size-xs,.75rem);text-transform:uppercase;letter-spacing:.04em;margin:0 0 6px;color:var(--sys-text-secondary,#52525b)}',
    'dl{margin:0}.row{display:grid;grid-template-columns:120px 1fr;gap:6px;padding:4px 0;border-bottom:1px solid var(--sys-border-subtle,#e4e4e7)}dt{color:var(--sys-text-secondary,#52525b)}dd{margin:0;overflow-wrap:anywhere}',
    'code{font:12px ui-monospace,monospace}',
    '@media(max-width:480px){.row{grid-template-columns:1fr;gap:2px}.row dd{min-width:0}}',
    'ul{padding-left:18px;margin:0}li[aria-current="true"]{list-style:"▸ "}',
    'a{color:inherit}',
    '.edit ol{padding-left:18px;margin:0 0 8px}.edit li{margin:0 0 4px}.edit button{padding:2px 8px;border:1px solid var(--sys-border-strong,#a1a1aa);border-radius:var(--cmp-button-radius,.375rem);background:var(--sys-surface-raised,#fff);color:inherit;font:inherit;cursor:pointer}.edit button:disabled{opacity:.45;cursor:default}.edit select,.edit input{padding:3px 6px;border:1px solid var(--sys-border-strong,#a1a1aa);border-radius:var(--cmp-input-radius,.375rem);background:var(--sys-surface-raised,#fff);color:inherit;font:inherit;max-width:100%}.edit h3{font-size:var(--sys-text-size-sm,.875rem);margin:12px 0 4px}.edit form{margin:0 0 6px}.edit-status{margin:0;color:var(--sys-text-secondary,#52525b);min-height:1.2em}',
    // Emitted only when there is context to style, so a version carrying none produces the same page it did before this existed.
    ...(context ? ['.context{background:var(--sys-surface-raised,#fafafa);border:1px solid var(--sys-border-subtle,#d4d4d8);border-radius:8px;padding:12px;margin-top:16px}.context h3{font-size:13px;margin:0 0 4px}.context h4{font-size:12px;margin:12px 0 4px;color:var(--sys-text-secondary,#52525b)}.context ul{padding-left:18px;margin:0}.context li{margin:0 0 10px}.context-body{margin:2px 0;white-space:pre-wrap}.context-provenance{margin:2px 0;font-size:12px;color:var(--sys-text-secondary,#52525b)}.context-keyed{margin:0 0 8px;font-size:12px;color:var(--sys-text-secondary,#52525b)}[data-oods-context-stale="true"] .context-body{color:var(--sys-text-secondary,#52525b)}[data-oods-context-stale-note]{font-size:11px;border:1px solid var(--sys-border-strong,#a1a1aa);border-radius:4px;padding:0 4px;color:var(--sys-text-secondary,#52525b)}'] : []),
    // Likewise only when there is an observation, so a version carrying none keeps its page byte for byte.
    ...(observation ? ['.observation{background:var(--sys-surface-raised,#fafafa);border:1px solid var(--sys-border-subtle,#d4d4d8);border-radius:8px;padding:12px;margin-top:16px}.observation h3{font-size:13px;margin:0 0 4px}.observation ul{padding-left:18px;margin:0}.observation li{margin:0 0 10px}.observation-side{margin:2px 0}.observation-side span{display:inline-block;min-width:72px;color:var(--sys-text-secondary,#52525b)}.observation-provenance,.observation-keyed{margin:2px 0;font-size:12px;color:var(--sys-text-secondary,#52525b);word-break:break-word}.observation-keyed{margin:0 0 8px}[data-oods-observation-row="disagreeing"]>strong{color:var(--sys-status-warning-text,#9a3412)}[data-oods-observation-stale-note]{font-size:11px;border:1px solid var(--sys-border-strong,#a1a1aa);border-radius:4px;padding:0 4px;color:var(--sys-text-secondary,#52525b)}'] : []),
    '.measurements section{display:grid;gap:4px}.measurements h3{font-size:var(--sys-text-size-sm,.875rem);margin:0}.measurements h4{font-size:12px;margin:12px 0 4px;color:var(--sys-text-secondary,#52525b)}.measurements ul{padding-left:18px;margin:0}.measurements li{margin:0 0 4px;overflow-wrap:anywhere}.count{color:var(--sys-text-secondary,#52525b);font-weight:400}',
    '@media (max-width:820px){.bar{align-items:flex-start}.switches{gap:10px 12px}}',
    '</style>',
    '</head>',
    '<body>',
    '<header class="bar">',
    `<div><h1>${escapeHtml(title)}</h1><p class="status" data-oods-status="true">${escapeHtml(framework)} · brand ${escapeHtml(brand)} · ${escapeHtml(theme)} · ${escapeHtml(widthLabel)}</p></div>`,
    '<div class="switches">',
    group('framework', 'Framework', options('framework', frameworks, framework)),
    group('brand', 'Brand', options('brand', brands, brand)),
    group('theme', 'Theme', options('theme', ['light', 'dark', 'hc'] as const, theme)),
    group('width', 'Width', `${options('width', ['fit'] as const, width as 'fit')}${options('width', FIXED_WIDTHS, width as number)}<button type="button" data-control="width" data-value="free" aria-pressed="${String(width === 'free')}">free</button><input type="number" min="200" max="3840" step="10" value="${pixelWidth}" aria-label="Free width in pixels" data-control="width-input"${width === 'free' ? '' : ' disabled'}>`),
    '</div>',
    '</header>',
    '<main>',
    `<div class="stage"><div class="frame" data-oods-frame="true" data-width="${width === 'fit' ? 'fit' : 'fixed'}" style="width:${width === 'fit' ? 'auto' : `${pixelWidth}px`}"><iframe data-oods-app="true" src="${appUrl}" title="${escapeHtml(title)} running (${escapeHtml(framework)})"></iframe></div></div>`,
    ...(context || observation ? [`<div class="beside">${context}${observation}</div>`] : []),
    `<details class="panel" data-oods-details="lineage"><summary>Version ${record.version} of ${versions.length}: lineage and measurements</summary><div class="panel-body">`,
    '<section data-oods-lineage="true" aria-label="Lineage">',
    '<h2>Lineage</h2>',
    `<dl>${lineage}</dl>`,
    '<h2>Versions</h2>',
    `<ul data-oods-versions="true">${versionList}</ul>`,
    '</section>',
    `<div class="measurements">${renderMeasurementPanel(record, brands)}</div>`,
    '</div></details>',
    '<details class="panel" data-oods-details="edit"><summary>Edit this version</summary><div class="panel-body">',
    `<div class="edit" data-oods-edit="true">${renderEditControls(record)}</div>`,
    `<p class="edit-status" data-oods-edit-status="true" aria-live="polite"></p>`,
    '</div></details>',
    '</main>',
    `<script type="module">\nconst state = ${scriptJson(state)};\nconst frame = document.querySelector('[data-oods-app]');\nconst box = document.querySelector('[data-oods-frame]');\nconst status = document.querySelector('[data-oods-status]');\nconst input = document.querySelector('[data-control="width-input"]');\nfunction press(name, value) { for (const button of document.querySelectorAll('button[data-control="' + name + '"]')) button.setAttribute('aria-pressed', String(button.dataset.value === String(value))); }\nfunction syncUrl() { const url = new URL(location.href); url.searchParams.set('framework', state.framework); url.searchParams.set('brand', state.brand); url.searchParams.set('theme', state.theme); url.searchParams.set('width', String(state.width)); history.replaceState(null, '', url); }\nfunction describe() { const px = state.width === 'fit' ? 'fits the window' : state.width === 'free' ? input.value + 'px (free)' : state.width + 'px'; status.textContent = state.framework + ' · brand ' + state.brand + ' · ' + state.theme + ' · ' + px; }\nfunction applyWidth() { box.dataset.width = state.width === 'fit' ? 'fit' : 'fixed'; box.style.width = state.width === 'fit' ? 'auto' : (state.width === 'free' ? Number(input.value) : state.width) + 'px'; input.disabled = state.width !== 'free'; press('width', state.width); describe(); syncUrl(); }\ndocument.addEventListener('click', event => {\n  const button = event.target.closest('button[data-control]');\n  if (!button) return;\n  const { control, value } = button.dataset;\n  if (control === 'framework') { location.href = state.base + '/' + state.compositionId + '/' + state.version + '?framework=' + value + '&brand=' + state.brand + '&theme=' + state.theme + '&width=' + state.width; return; }\n  if (control === 'brand' || control === 'theme') {\n    state[control] = value; press(control, value);\n    document.documentElement.dataset[control] = value; document.documentElement.classList.toggle('dark', state.theme === 'dark');\n    frame.contentWindow.postMessage({ type: 'oods-preview-scope', brand: state.brand, theme: state.theme }, '*');\n    describe(); syncUrl(); return;\n  }\n  if (control === 'width') { state.width = value === 'free' || value === 'fit' ? value : Number(value); applyWidth(); }\n});\ninput.addEventListener('input', () => { if (state.width === 'free') applyWidth(); });\nwindow.addEventListener('message', async event => {\n  if (!event.data) return;\n  if (event.data.type === 'oods-preview-mounted') { document.documentElement.dataset.oodsAppMounted = 'true'; window.__oodsPreviewApp = event.data; }\n  // The app says how tall it is, so the page scrolls once and the whole screen shows without a scrollbar inside the frame.\n  if (event.data.type === 'oods-preview-size' && event.source === frame.contentWindow && Number(event.data.height) > 0) frame.style.height = Math.min(20000, Math.max(480, Math.ceil(Number(event.data.height)))) + 'px';\n  if (event.data.type === 'oods-preview-measured') { const panel = document.querySelector('[data-oods-measurements]'); const response = await fetch(state.base + '/' + state.compositionId + '/' + state.version + '/measurements'); if (panel && response.ok) { panel.outerHTML = await response.text(); document.documentElement.dataset.oodsMeasured = String(Number(document.documentElement.dataset.oodsMeasured || 0) + 1); } }\n});\n// Edits: one operation each, POSTed to the host, which re-composes and re-generates a new version; the page then opens it.\nconst editStatus = document.querySelector('[data-oods-edit-status]');\nasync function edit(operation, fields) {\n  editStatus.textContent = 'Re-composing ' + operation + '…';\n  const response = await fetch(state.base + '/' + state.compositionId + '/' + state.version + '/edit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ operation, ...fields, framework: state.framework, brand: state.brand, theme: state.theme }) });\n  const body = await response.json().catch(() => ({}));\n  if (!response.ok) { editStatus.textContent = 'Refused: ' + (body.error && body.error.message ? body.error.message : response.status); document.documentElement.dataset.oodsEditRefused = String(body.error && body.error.code || response.status); return; }\n  editStatus.textContent = 'Version ' + body.version + ' recorded (' + body.operation + ' ← v' + body.parentVersion + '); opening…';\n  location.href = body.url + '&width=' + state.width;\n}\nfunction moveIn(list, index, delta) { const next = [...list]; const target = index + delta; if (target < 0 || target >= next.length) return null; [next[index], next[target]] = [next[target], next[index]]; return next; }\ndocument.addEventListener('click', event => {\n  const move = event.target.closest('button.move');\n  if (!move) return;\n  const kind = move.dataset.kind, index = Number(move.dataset.index), delta = Number(move.dataset.delta);\n  if (kind === 'region') { const order = moveIn(JSON.parse(move.closest('[data-regions]').dataset.regions), index, delta); if (order) edit('reorder-region', { regionOrder: order }); }\n  if (kind === 'field') { const holder = move.closest('[data-fields]'); const order = moveIn(JSON.parse(holder.dataset.fields), index, delta); if (order) edit('reorder-fields', { region: holder.dataset.region, fieldOrder: order }); }\n});\ndocument.addEventListener('submit', event => {\n  const form = event.target.closest('form[data-edit]');\n  if (!form) return;\n  event.preventDefault();\n  if (form.dataset.edit === 'swap-slot') { const select = form.querySelector('select'); if (select.value && select.value !== form.dataset.current) edit('swap-slot', { slot: form.dataset.slot, component: select.value }); else editStatus.textContent = 'Choose a different candidate.'; }\n  if (form.dataset.edit === 'seed') { const input = form.querySelector('input'); if (input.value && input.value !== form.dataset.current) edit('seed', { seed: input.value }); else editStatus.textContent = 'Enter a different seed.'; }\n});\nwindow.__oodsPreviewShell = state;\n</script>`,
    '</body>',
    '</html>',
    '',
  ].join('\n');
}
