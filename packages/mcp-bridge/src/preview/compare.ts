import type { CompositionDiff, DiffCategory } from './diff.js';
import { renderMeasurementPanel } from './measurements.js';
import { escapeHtml, scriptJson } from './page.js';
import { FIXED_WIDTHS } from './shell.js';
import type { CompositionVersion, PreviewBrand, PreviewFramework, PreviewTheme } from './store.js';

export interface ComparePageInput {
  left: CompositionVersion;
  right: CompositionVersion;
  diff: CompositionDiff;
  frameworks: PreviewFramework[];
  framework: PreviewFramework;
  brand: PreviewBrand;
  /** The token build's brands, for the brand switch (s213-m04). */
  brands: readonly PreviewBrand[];
  theme: PreviewTheme;
  width: number | 'free';
  base: string;
}

const CATEGORY_LABELS: Record<DiffCategory, string> = { regions: 'Regions', slots: 'Slots', nodes: 'Nodes', props: 'Props', fieldOrder: 'Field order', seed: 'Seed', artifacts: 'Artifact files', definition: 'Definition' };
const short = (hash: string | null) => hash ? hash.replace(/^sha256:/, '').slice(0, 12) : 'none';
const json = (value: unknown) => escapeHtml(JSON.stringify(value));

/** The structural what-changed, one list per category, or the no-differences note; the compare page and the preview app both show it. */
export function renderWhatChanged(diff: CompositionDiff): string {
  return diff.identical
    ? '<p data-oods-identical="true">No differences: the two versions have the same regions, slots, nodes, props, field order, definition, seed and artifact files, with equal schema hashes.</p>'
    : (Object.keys(CATEGORY_LABELS) as DiffCategory[]).filter(category => diff.summary[category] > 0).map(category => `<h3>${CATEGORY_LABELS[category]} <span class="count">${diff.summary[category]}</span></h3><ul data-oods-diff="${category}">${diff.differences.filter(entry => entry.category === category).map(entry => `<li><code>${escapeHtml(entry.field)}</code> <em>${escapeHtml(entry.note)}</em><br><span class="before">${json(entry.before)}</span> → <span class="after">${json(entry.after)}</span></li>`).join('')}</ul>`).join('');
}

/** Two running apps side by side with the structural what-changed and both measurement panels. */
export function renderComparePage({ left, right, diff, frameworks, framework, brand, brands, theme, width, base }: ComparePageInput): string {
  const pixelWidth = width === 'free' ? 720 : width;
  const app = (record: CompositionVersion) => `${base}/${record.compositionId}/${record.version}/app?framework=${framework}&brand=${brand}&theme=${theme}`;
  const page = (record: CompositionVersion) => `${base}/${record.compositionId}/${record.version}?framework=${framework}&brand=${brand}&theme=${theme}`;
  const label = (record: CompositionVersion) => `${record.compose.object ?? 'composition'} ${record.compose.context ?? ''} · <a href="${page(record)}">${escapeHtml(record.compositionId)} v${record.version}</a> · ${escapeHtml(record.operation)}${record.parentVersion === null ? '' : ` ← v${record.parentVersion}`} · schema <code>${escapeHtml(short(record.schemaHash))}</code>`;
  const options = <T extends string | number>(name: string, values: readonly T[], current: T) => values.map(value => `<button type="button" data-control="${name}" data-value="${escapeHtml(String(value))}" aria-pressed="${String(value === current)}">${escapeHtml(String(value))}</button>`).join('');
  const changes = renderWhatChanged(diff);
  const state = { left: `${left.compositionId}@${left.version}`, right: `${right.compositionId}@${right.version}`, framework, brand, theme, width, base };
  return [
    '<!doctype html>',
    `<html lang="en"${theme === 'dark' ? ' class="dark"' : ''} data-theme="${escapeHtml(theme)}" data-brand="${escapeHtml(brand)}">`,
    '<head>',
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>Compare ${escapeHtml(left.compositionId)} v${left.version} · ${escapeHtml(right.compositionId)} v${right.version}</title>`,
    '<style>',
    'html,body{margin:0;font:14px/1.45 system-ui,sans-serif;background:#f4f4f5;color:#18181b}',
    'header{padding:12px 16px;border-bottom:1px solid #d4d4d8;background:#fafafa;display:flex;flex-wrap:wrap;gap:16px;align-items:center}',
    'header h1{font-size:15px;margin:0}.controls button{margin:0 4px 0 0;padding:4px 10px;border:1px solid #a1a1aa;border-radius:6px;background:#fff;cursor:pointer}.controls button[aria-pressed="true"]{background:#18181b;color:#fff;border-color:#18181b}.controls input{width:80px;padding:4px 6px;border:1px solid #a1a1aa;border-radius:6px}',
    '.sides{display:flex;gap:16px;padding:16px;overflow:auto}.side{flex:0 0 auto}.side h2{font-size:13px;margin:0 0 6px;font-weight:500}.frame{border:1px solid #d4d4d8;background:#fff}iframe{display:block;border:0;width:100%;height:70vh}',
    '.panels{display:grid;grid-template-columns:2fr 1fr 1fr;gap:16px;padding:0 16px 16px}section{background:#fafafa;border:1px solid #d4d4d8;border-radius:8px;padding:12px}section h2,section h3{font-size:13px;margin:0 0 8px}section h3{margin-top:12px}.count{color:#52525b;font-weight:400}ul{padding-left:18px;margin:0}li{margin:0 0 6px;word-break:break-all}code{font:12px ui-monospace,monospace}em{color:#52525b}.before{color:#991b1b}.after{color:#166534}',
    '@media (max-width:1100px){.panels{grid-template-columns:1fr}}',
    '</style>',
    '</head>',
    '<body>',
    '<header>',
    `<h1>Compare</h1>`,
    `<div class="controls" data-oods-controls="framework">${options('framework', frameworks, framework)}</div>`,
    `<div class="controls" data-oods-controls="brand">${options('brand', brands, brand)}</div>`,
    `<div class="controls" data-oods-controls="theme">${options('theme', ['light', 'dark', 'hc'] as const, theme)}</div>`,
    `<div class="controls" data-oods-controls="width">${options('width', FIXED_WIDTHS, width as number)}<button type="button" data-control="width" data-value="free" aria-pressed="${String(width === 'free')}">free</button> <input type="number" min="200" max="3840" step="10" value="${pixelWidth}" aria-label="Free width in pixels" data-control="width-input"${width === 'free' ? '' : ' disabled'}></div>`,
    '</header>',
    '<div class="sides">',
    `<div class="side" data-oods-side="left"><h2>${label(left)}</h2><div class="frame" data-oods-frame="left" style="width:${pixelWidth}px"><iframe data-oods-app="left" src="${app(left)}" title="left: ${escapeHtml(left.compositionId)} v${left.version}"></iframe></div></div>`,
    `<div class="side" data-oods-side="right"><h2>${label(right)}</h2><div class="frame" data-oods-frame="right" style="width:${pixelWidth}px"><iframe data-oods-app="right" src="${app(right)}" title="right: ${escapeHtml(right.compositionId)} v${right.version}"></iframe></div></div>`,
    '</div>',
    '<div class="panels">',
    `<section data-oods-what-changed="true"><h2>What changed <span class="count">${diff.differenceCount}</span></h2>${changes}</section>`,
    renderMeasurementPanel(left, brands),
    renderMeasurementPanel(right, brands),
    '</div>',
    `<script type="module">\nconst state = ${scriptJson(state)};\nconst frames = [...document.querySelectorAll('[data-oods-app]')];\nconst boxes = [...document.querySelectorAll('[data-oods-frame]')];\nconst input = document.querySelector('[data-control="width-input"]');\nfunction press(name, value) { for (const button of document.querySelectorAll('button[data-control="' + name + '"]')) button.setAttribute('aria-pressed', String(button.dataset.value === String(value))); }\nfunction syncUrl() { const url = new URL(location.href); for (const key of ['framework', 'brand', 'theme', 'width']) url.searchParams.set(key, String(state[key])); history.replaceState(null, '', url); }\nfunction applyWidth() { const px = state.width === 'free' ? Number(input.value) : state.width; for (const box of boxes) box.style.width = px + 'px'; input.disabled = state.width !== 'free'; press('width', state.width); syncUrl(); }\ndocument.addEventListener('click', event => {\n  const button = event.target.closest('button[data-control]');\n  if (!button) return;\n  const { control, value } = button.dataset;\n  if (control === 'framework') { location.href = state.base.replace(/\\/preview$/, '') + '/compare/' + state.left + '/' + state.right + '?framework=' + value + '&brand=' + state.brand + '&theme=' + state.theme + '&width=' + state.width; return; }\n  if (control === 'brand' || control === 'theme') { state[control] = value; press(control, value); document.documentElement.dataset[control] = value; document.documentElement.classList.toggle('dark', state.theme === 'dark'); for (const frame of frames) frame.contentWindow.postMessage({ type: 'oods-preview-scope', brand: state.brand, theme: state.theme }, '*'); syncUrl(); return; }\n  if (control === 'width') { state.width = value === 'free' ? 'free' : Number(value); applyWidth(); }\n});\ninput.addEventListener('input', () => { if (state.width === 'free') applyWidth(); });\nlet mounted = 0;\nwindow.addEventListener('message', async event => {\n  if (!event.data) return;\n  if (event.data.type === 'oods-preview-mounted') { mounted += 1; document.documentElement.dataset.oodsAppsMounted = String(mounted); }\n  if (event.data.type === 'oods-preview-measured') { const ref = event.data.compositionId + '@' + event.data.version; const panel = document.querySelector('[data-oods-measurements="' + ref + '"]'); if (!panel) return; const response = await fetch(state.base + '/' + event.data.compositionId + '/' + event.data.version + '/measurements'); if (response.ok) panel.outerHTML = await response.text(); }\n});\nwindow.__oodsCompare = state;\n</script>`,
    '</body>',
    '</html>',
    '',
  ].join('\n');
}
