import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Tabs } from '@oods/components-react';
import type { CompositionVersion } from './store.js';
import { escapeHtml, scriptJson } from './page.js';

/** The day a retained instant falls on, in UTC, so every host renders the same words. */
const dayLabel = (iso: string | undefined): string => { if (!iso) return ''; const date = new Date(iso); return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }); };
/** A recorded state or artifact kind in a person's words: not_measured → Not measured. */
const humanize = (value: string): string => value.replaceAll('_', ' ').replace(/^./, letter => letter.toUpperCase());

type NavItem = { id: string; label: string; href: string };
/**
 * s210-m01: the views of one inspection are the design system's Tabs (packages/components-react/src/tabs.tsx), rendered
 * once as static markup with the current view selected. The page script turns a tab activation into navigation and lets
 * every tab take focus. The header carries no hand-written navigation link; the evidence links are links.
 */
function navigation(items: NavItem[], selectedId: string, ariaLabel: string): { html: string; hrefs: Record<string, string> } {
  const markup = renderToStaticMarkup(createElement(Tabs, { ariaLabel, selectedId, items: items.map(item => ({ id: item.id, label: item.label, panel: null })) }));
  return { html: `<div data-inspection-nav="true">${markup}</div>`, hrefs: Object.fromEntries(items.map(item => [item.id, item.href])) };
}

/** Read-only navigation around the generated screen; rows and detail remain the generated components. */
export function inspectionPage(record: CompositionVersion, versionBase: string, scope: string, resultState?: string): { html: string; script: string } {
  const run = record.runView;
  const comparison = record.comparisonView;
  if (!run && !comparison) return { html: '', script: '' };
  const url = (object: string, extra = '') => `${versionBase}/${comparison ? 'comparison' : 'inspect'}?${scope}&object=${object}${extra}`;
  const link = (href: string, text: string) => `<a href="${escapeHtml(href)}">${escapeHtml(text)}</a>`;
  const safeWeb = (value: unknown) => {
    if (typeof value !== 'string') return undefined;
    try { const parsed = new URL(value); return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : undefined; } catch { return undefined; }
  };
  const references = (run?.evidence ?? []).map(item => link(`${versionBase}/evidence?locator=${encodeURIComponent(item.locator)}`, `Open attested evidence: ${item.locator}`));
  for (const [key, label] of [['pageUrl', 'Captured page'], ['helpUrl', 'Rule guidance']] as const) {
    const href = safeWeb(record.model?.[key]); if (href) references.push(link(href, label));
  }
  const object = String(record.compose.object ?? '');
  const nav = comparison
    ? navigation([{ id: 'Comparison', label: 'Summary', href: url('Comparison') }, { id: 'ComparisonSignal', label: 'Signals', href: url('ComparisonSignal') }], object, 'Comparison views')
    : navigation([
        { id: 'Run', label: 'Run', href: url('Run') },
        { id: 'violations', label: 'Violations', href: url('Finding', '&resultState=violation') },
        { id: 'needs-review', label: 'Needs review', href: url('Finding', '&resultState=needs_review') },
        { id: 'CapturedArtifact', label: 'Artifacts', href: url('CapturedArtifact') },
      ], object === 'Finding' ? (resultState === 'needs_review' ? 'needs-review' : 'violations') : object, 'Capture views');
  const limited = (run?.limits ?? []).filter(item => item.state !== 'measured');
  const stateNotes: Record<string, string> = { measured_zero: 'Measured; none recorded.', not_measured: 'Not measured; no conformance conclusion.', not_applicable: 'Recorded as not applicable.', needs_review: 'Needs human review.', unknown: 'No result recorded; conformance unknown.' };
  const limitGroups = [...new Set(limited.map(item => item.state))].map(state => ({ state, kinds: limited.filter(item => item.state === state).map(item => item.kind) }));
  // The recorded states and artifact kinds read in words; the exact names stay in the recorded notes beneath.
  const limits = run?.presentation === 'stage1-inspection' ? `<section aria-label="Measurement limits"><h2>Measurement limits</h2><p>Automated findings need interpretation. Unmeasured and unknown results do not establish conformance.</p><ul>${limitGroups.map(group => `<li><strong>${escapeHtml(humanize(group.state))}</strong>: ${escapeHtml(stateNotes[group.state] ?? 'See recorded notes.')} Applies to ${escapeHtml(group.kinds.map(kind => humanize(kind).toLowerCase()).join(', '))}.</li>`).join('')}</ul>${limited.length ? `<details><summary>Recorded measurement notes (${limited.length})</summary><ul>${limited.map(item => `<li><strong>${escapeHtml(humanize(item.kind))} (${escapeHtml(item.kind)}, ${escapeHtml(item.state)})</strong>: ${escapeHtml(item.note)}</li>`).join('')}</ul></details>` : ''}</section>` : '';
  const captureHtml = run ? `<header class="oods-inspection">${nav.html}<p class="oods-inspection__subject">Stage1 capture of ${escapeHtml(run.target)}.</p>${references.length ? `<nav aria-label="Evidence and references">${references.join(' ')}</nav>` : ''}${record.compose.object === 'Finding' && record.compose.context === 'list' ? '<label for="inspection-result-state">Result state</label> <select id="inspection-result-state"><option value="">All results</option><option value="violation">Violations</option><option value="needs_review">Needs review</option></select><p id="inspection-count" role="status"></p>' : ''}${limits}</header>` : '';
  const html = comparison ? `<header class="oods-inspection">${nav.html}<p class="oods-inspection__subject">${escapeHtml(comparison.target)}: the live site captured ${escapeHtml(dayLabel(comparison.capturedAt))}, compared with its design values on ${escapeHtml(dayLabel(comparison.analyzedAt))}.</p>${comparison.evidence.length ? `<nav aria-label="Comparison evidence">${comparison.evidence.map(item => link(`${versionBase}/comparison-evidence?locator=${encodeURIComponent(item.locator)}&pointer=${encodeURIComponent(item.jsonPointer)}`, item.label)).join(' ')}</nav>` : ''}</header>` : captureHtml;
  // The schema identifies the collection's existing filter and sort fields, so this does not replace their semantics.
  const controls: Record<string, string> = {};
  const walk = (value: unknown): void => { if (!value || typeof value !== 'object') return; const node = value as { collectionControl?: string; props?: { field?: string }; children?: unknown[]; screens?: unknown[] }; if (node.collectionControl && node.props?.field) controls[node.collectionControl] = node.props.field.replace(/_([a-z])/g, (_, char) => char.toUpperCase()); node.children?.forEach(walk); node.screens?.forEach(walk); };
  walk(record.schema);
  // s211-m02: every signal of one comparison carries the analysis instant the header already names, so a comparison
  // list hides a row time that all its rows share.
  const rowTimes: string[] = [];
  const timeFields = (value: unknown): void => { if (!value || typeof value !== 'object') return; const node = value as { component?: string; props?: { field?: string; fallbackField?: string }; children?: unknown[]; screens?: unknown[] }; if (node.component === 'RelativeTimestamp') for (const field of [node.props?.field, node.props?.fallbackField]) if (field) rowTimes.push(field.replace(/_([a-z])/g, (_, char) => char.toUpperCase())); node.children?.forEach(timeFields); node.screens?.forEach(timeFields); };
  if (comparison && record.compose.context === 'list') timeFields(record.schema);
  const script = `
const inspectionNav = ${scriptJson(nav.hrefs)};
for (const tab of document.querySelectorAll('[data-inspection-nav] [role="tab"]')) {
  tab.tabIndex = 0;
  tab.addEventListener('click', () => { const href = inspectionNav[tab.dataset.tabId]; if (href && tab.getAttribute('aria-selected') !== 'true') location.assign(href); });
}
const inspectionRows = Array.isArray(model.rows) ? model.rows.slice() : null;
const inspectionControls = ${scriptJson(controls)};
// Names compare by their text and by the value of each number in them, decimals included: "Font size 12px" sorts before
// "Font size 12.8px", which a digit-by-digit comparison put after it.
const inspectionParts = value => String(value ?? '').match(/\\d+(?:\\.\\d+)?|\\D+/g) || [];
function inspectionOrder(a, b) {
  const left = inspectionParts(a), right = inspectionParts(b);
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    const x = left[index], y = right[index];
    const order = /^\\d/.test(x) && /^\\d/.test(y) ? Number(x) - Number(y) : x.localeCompare(y);
    if (order) return order;
  }
  return left.length - right.length;
}
const inspectionTimes = ${scriptJson(rowTimes)};
const inspectionParams = new URLSearchParams(location.search);
let inspectionQuery = { ...model.collectionQuery, status: inspectionParams.get('status') || '', search: inspectionParams.get('search') || '', descending: inspectionParams.get('descending') === 'true' };
let inspectionState = inspectionParams.get('resultState') || '';
function updateInspection(writeUrl = false) {
  if (!inspectionRows) return;
  let rows = inspectionRows.filter(row => (!inspectionState || row.resultState === inspectionState) && (!inspectionQuery.status || String(row[inspectionControls.filter]) === inspectionQuery.status) && (!inspectionQuery.search || JSON.stringify(row).toLowerCase().includes(inspectionQuery.search.toLowerCase())));
  const field = inspectionControls.sort;
  if (field) rows.sort((a,b) => inspectionOrder(a[field], b[field]) * (inspectionQuery.descending ? -1 : 1));
  const pageSize = inspectionQuery.pageSize || 10;
  const page = Math.max(1, Math.min(inspectionQuery.page || 1, Math.ceil(rows.length / pageSize) || 1));
  model.collectionQuery = { ...inspectionQuery, page, total: rows.length };
  model.rows = rows.slice((page - 1) * pageSize, page * pageSize);
  const count = document.getElementById('inspection-count'); if (count) count.textContent = rows.length + ' results';
  const times = new Set(rows.map(row => inspectionTimes.map(time => row[time] ?? '').join('|')));
  if (inspectionTimes.length && rows.length > 1 && times.size === 1) document.body.dataset.oodsUniformTime = 'true'; else delete document.body.dataset.oodsUniformTime;
  const state = document.getElementById('inspection-result-state'); if (state) state.value = inspectionState;
  if (writeUrl) { const params = new URLSearchParams(location.search); for (const [key,value] of Object.entries({status:inspectionQuery.status,search:inspectionQuery.search,descending:inspectionQuery.descending ? 'true' : '',resultState:inspectionState})) { if(value) params.set(key,value); else params.delete(key); } history.replaceState(null,'',location.pathname + '?' + params); }
}
updateInspection();
document.getElementById('inspection-result-state')?.addEventListener('change', event => { inspectionState = event.target.value; inspectionQuery.page = 1; updateInspection(true); mount(); });
window.addEventListener('oods-design-loop-action', event => {
  const {name,args} = event.detail;
  if (name === 'handleRowClick') { const next = new URL(${scriptJson(url(String(record.compose.object)))}, location.origin); next.searchParams.set('recordId', String(args[0])); location.assign(next); return; }
  if (!inspectionRows) return;
  if (name === 'handleFilter') inspectionQuery = { ...inspectionQuery, ...args[0], page:1 };
  else if (name === 'handleSort') inspectionQuery = { ...inspectionQuery, descending: !inspectionQuery.descending };
  else if (name === 'handlePageChange') inspectionQuery = { ...inspectionQuery, page:args[0] };
  else return;
  updateInspection(true); mount();
});
`;
  return { html, script };
}
