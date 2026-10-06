/**
 * The Forge design preview as an MCP App (Sprint 202 m03, m04): the generated React or Vue app actually running inside the
 * host's sandbox, with the Sprint 201 page's lineage, versions and measurements beside it, and the acts that decide a
 * design from the conversation. The bridge build inlines the runtime (React, ReactDOM, Vue, the foundation packages and
 * their CSS) in this document; the version record, the lineage list and the compiled module for the mounted framework,
 * brand and theme come through the host (resources/read), and the module runs as an inline script, so everything works
 * under the host's default CSP with no network. Framework, brand, theme and version switches re-mount in place; when the
 * placed chart was rendered for another scope, design_preview renders and certifies it for the mounted one first. The four
 * edits, compare, and accept are design_preview calls through the host (tools/call); an accepted version is put into the
 * model's context (ui/update-model-context) and a change request is sent into the conversation (ui/message).
 */
import { App, applyHostStyleVariables, type McpUiHostContext } from '@modelcontextprotocol/ext-apps';
import { renderWhatChanged } from '../src/preview/compare.js';
import type { CompositionDiff } from '../src/preview/diff.js';
import { renderMeasurementPanel } from '../src/preview/measurements.js';
import { MODULES_GLOBAL, RUNTIME_GLOBAL, moduleKey } from '../src/preview/module-globals.js';
import { escapeHtml } from '../src/preview/page.js';
import { hasPlacedChart, scopeKey, servedArtifact } from '../src/preview/scope.js';
import { FIXED_WIDTHS, renderContext, renderEditControls, renderLineage, renderObservation, renderVersionList, type ContextLink, type ObservationLink } from '../src/preview/shell.js';
import type { AcceptedSummary, CompositionVersion, PreviewArtifact, PreviewBrand, PreviewFramework, PreviewTheme, VersionSummary } from '../src/preview/store.js';

declare const __OODS_PREVIEW_APP_VERSION__: string;

type Json = Record<string, unknown>;
type Scope = { compositionId: string; version: number; framework: PreviewFramework; brand: PreviewBrand; theme: PreviewTheme };
type GeneratedFor = { brand: PreviewBrand; theme: PreviewTheme; chartScoped: boolean };
type ToolResult = { isError?: boolean; content?: Array<{ type: string; text?: string }>; structuredContent?: Json };
/** design_preview's result as the adapter returns it in structuredContent, with the resources it offers this app. */
type PreviewResult = {
  status?: string; action?: string; compositionId?: string; version?: number; latest?: number; parentVersion?: number | null; operation?: string;
  brand?: PreviewBrand; theme?: PreviewTheme;
  previews?: Array<{ framework: PreviewFramework; appUrl: string; artifactContentHash: string; generatedFor: GeneratedFor }>;
  left?: { compositionId: string; version: number };
  resources?: { app: string | null; record: string; versions: string; modules: Partial<Record<PreviewFramework, string>>; styles: Partial<Record<PreviewFramework, string>>; tokens?: string };
};
type AcceptResult = { compositionId: string; version: number; parentVersion: number | null; operation: string; acceptances: number; accepted: { version: number; acceptedAt: string; schemaHash: string; measured: Json; supersedes: { version: number; acceptedAt: string } | null } };
type CompareResult = { identical: boolean; differenceCount: number; diff: CompositionDiff; frameworks: PreviewFramework[] };
type VersionsResource = { versions: VersionSummary[]; accepted: AcceptedSummary | null };
type Side = { compositionId: string; version: number; components: number; componentNames: string[]; generatedFor: GeneratedFor };
type Act = 'edit' | 'accept' | 'compare' | 'request-changes';

const TOOL = 'design_preview';
/** The adapter's readable composition resources (packages/mcp-adapter/mcp-apps.js). */
const COMPOSITIONS = 'ui://oods-forge/compositions/';
/** s213-m04: the token build's brands and CSS, read live through the host; the app carries neither. */
const TOKENS = 'ui://oods-forge/tokens.json';
const FRAMEWORKS: readonly PreviewFramework[] = ['react', 'vue'];
const THEMES: readonly PreviewTheme[] = ['light', 'dark', 'hc'];
const WIDTHS: readonly (string | number)[] = ['fit', ...FIXED_WIDTHS];
/** design_preview takes ten calls a minute, one at a time (the server's policy): a call that meets either limit waits and asks again. */
const RETRY_DELAYS_MS = [7_000, 15_000, 30_000];
const LIMITED = new Set(['OODS-R001', 'OODS-R002']);

interface PreviewAppState {
  app: string;
  connected: boolean;
  hostContext: McpUiHostContext | null;
  toolInput: Json | null;
  result: PreviewResult | null;
  record: CompositionVersion | null;
  versions: VersionSummary[] | null;
  /** The composition's standing acceptance, from versions.json. */
  accepted: AcceptedSummary | null;
  /** The scope the latest switch asked for; the mounted scope below follows it once it has mounted. */
  requested: Scope | null;
  framework: PreviewFramework | null;
  brand: PreviewBrand | null;
  /** The token build's brands, from the tokens resource: the brand switch offers these (s213-m04). */
  brands: PreviewBrand[];
  /** The sha256 of the token CSS this view applied. */
  tokensSha256: string | null;
  theme: PreviewTheme | null;
  /** Where the theme came from: the call named one, the host's theme, the version's own, or a switch in this view. */
  themeSource: 'call' | 'host' | 'version' | 'switch' | null;
  /** The scope the mounted module was generated for; it differs from the mounted scope only when the chart could not be rendered for it. */
  generatedFor: GeneratedFor | null;
  width: 'fit' | number;
  containerWidth: number | null;
  appWidth: number;
  displayMode: string;
  displayModeRequests: Array<{ mode: string; reason: string; answer: string | null }>;
  module: { uri: string; key: string; bytes: number; mimeType: string; registers: boolean; workflow: boolean } | null;
  styles: { uri: string; bytes: number } | null;
  /** single: one running app; compare: two versions side by side with what changed. */
  view: 'single' | 'compare';
  compare: { left: Side; right: Side; identical: boolean; differenceCount: number; summary: Record<string, number>; renderedChanges: number; frameworks: PreviewFramework[] } | null;
  compares: number;
  mounted: boolean;
  mounts: number;
  components: number;
  componentNames: string[];
  pending: string | null;
  toolCalls: Array<{ arguments: Json; ok: boolean; code?: string; ms: number }>;
  reads: string[];
  actStatus: Partial<Record<Act, string>>;
  acts: Array<{ act: Act; ok: boolean; detail: Json }>;
  modelContext: Array<{ text: string; structuredContent: Json }>;
  messages: string[];
  actions: Array<{ name: string; at: string }>;
  errors: string[];
}

const state: PreviewAppState = {
  app: __OODS_PREVIEW_APP_VERSION__, connected: false, hostContext: null, toolInput: null, result: null, record: null, versions: null, accepted: null, requested: null,
  framework: null, brand: null, brands: [], tokensSha256: null, theme: null, themeSource: null, generatedFor: null, width: 'fit', containerWidth: null, appWidth: 0, displayMode: 'inline', displayModeRequests: [],
  module: null, styles: null, view: 'single', compare: null, compares: 0, mounted: false, mounts: 0, components: 0, componentNames: [], pending: null, toolCalls: [], reads: [],
  actStatus: {}, acts: [], modelContext: [], messages: [], actions: [], errors: [],
};
(window as unknown as { __oodsPreviewApp: PreviewAppState }).__oodsPreviewApp = state;

function element<T extends HTMLElement>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`preview-app/index.html lacks ${selector}`);
  return found;
}
const toolbar = element('[data-oods-toolbar]');
const statusLine = element('[data-oods-preview-status]');
const stage = element('[data-oods-stage]');
const frame = element('[data-oods-app-frame]');
const compareView = element('[data-oods-compare]');
const compareTitle = element('[data-oods-compare-title]');
const whatChanged = element('[data-oods-what-changed]');
const comparePanels = element('[data-oods-compare-panels]');
const panel = element('[data-oods-panel]');
const errorBox = element('[data-oods-preview-errors]');

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
const nextFrames = (count: number) => new Promise<void>(resolve => { const step = (left: number) => { if (left <= 0) resolve(); else requestAnimationFrame(() => step(left - 1)); }; step(count); });
const messageOf = (error: unknown) => error instanceof Error ? error.message : String(error);
const isOneOf = <T extends string>(values: readonly T[], value: unknown): value is T => typeof value === 'string' && (values as readonly string[]).includes(value);
const labelOf = (record: CompositionVersion) => `${record.compose.object ?? 'composition'} ${record.compose.context ?? ''}`.trim();
const utf8Bytes = (text: string) => new TextEncoder().encode(text).length;
const componentsIn = (root: ParentNode) => Array.from(root.querySelectorAll('[data-oods-component]'));
const namesOf = (nodes: Element[]) => [...new Set(nodes.map(node => node.getAttribute('data-oods-component') ?? ''))].sort();

/** Every failure is shown in the view and kept on the state; nothing is logged to the console instead. */
function fail(context: string, error: unknown): void {
  state.errors.push(`${context}: ${messageOf(error)}`);
  errorBox.textContent = state.errors.join('\n');
  errorBox.hidden = false;
}

function renderStatus(): void {
  let text: string;
  if (state.pending) text = state.pending;
  else if (state.view === 'compare' && state.compare) text = `Comparing v${state.compare.left.version} and v${state.compare.right.version} · ${state.framework} · brand ${state.brand} · ${state.theme} · ${state.compare.differenceCount} differences`;
  else if (state.mounted && state.record) {
    const width = state.width === 'fit' ? `${state.appWidth}px (fit)` : `${state.width}px`;
    const chart = state.generatedFor && (state.generatedFor.brand !== state.brand || state.generatedFor.theme !== state.theme) ? ` · placed chart rendered for ${state.generatedFor.brand}/${state.generatedFor.theme}` : '';
    text = `${labelOf(state.record)} v${state.record.version} · ${state.framework} · brand ${state.brand} · ${state.theme} · ${width} · ${state.components} components${chart}`;
  } else if (!state.connected) text = 'Connecting to the host…';
  else text = state.errors.length ? 'Nothing is mounted.' : 'Waiting for a design_preview result…';
  statusLine.textContent = text;
  statusLine.dataset.state = state.pending ? 'pending' : state.mounted ? 'mounted' : 'idle';
}
function setPending(text: string | null): void { state.pending = text; renderStatus(); }
function setActStatus(act: Act, text: string): void {
  state.actStatus[act] = text;
  const node = panel.querySelector(`[data-oods-act-status="${act}"]`);
  if (node) node.textContent = text;
}

const controlGroup = (name: string, label: string, values: readonly (string | number)[]) => `<div class="controls" role="group" aria-label="${label}" data-oods-controls="${name}"><span class="label">${label}</span>${values.map(value => `<button type="button" data-control="${name}" data-value="${escapeHtml(String(value))}" aria-pressed="false">${escapeHtml(String(value))}</button>`).join('')}</div>`;
function buildControls(): void {
  if (toolbar.querySelector('[data-oods-controls]')) return;
  toolbar.insertAdjacentHTML('beforeend', controlGroup('framework', 'Framework', FRAMEWORKS) + controlGroup('brand', 'Brand', state.brands) + controlGroup('theme', 'Theme', THEMES) + controlGroup('width', 'Width', WIDTHS));
}
/** Apply the token build's CSS ahead of the runtime styles (the order a generated app loads them in) and offer its brands. */
async function loadTokens(uri: string): Promise<void> {
  const tokens = await readJson<{ brands: PreviewBrand[]; sha256: string; css: string }>(uri);
  let style = document.getElementById('oods-tokens');
  if (!style) {
    style = document.createElement('style');
    style.id = 'oods-tokens';
    document.head.insertBefore(style, document.getElementById('oods-runtime-styles') ?? document.head.firstChild);
  }
  if (state.tokensSha256 !== tokens.sha256) { style.textContent = tokens.css; state.tokensSha256 = tokens.sha256; }
  state.brands = tokens.brands;
  const group = toolbar.querySelector('[data-oods-controls="brand"]');
  if (group) group.outerHTML = controlGroup('brand', 'Brand', state.brands);
  syncControls();
}
function syncControls(): void {
  const pressed: Record<string, string | undefined> = { framework: state.requested?.framework, brand: state.requested?.brand, theme: state.requested?.theme, width: String(state.width) };
  for (const button of toolbar.querySelectorAll<HTMLButtonElement>('button[data-control]')) button.setAttribute('aria-pressed', String(pressed[button.dataset.control ?? ''] === button.dataset.value));
}

/**
 * The conversation app's half of the Sprint 202 callback pattern. The page renders each context item as
 * an anchor; this view cannot open one from inside the host's sandbox, so it prints the destination
 * beside the title rather than offering a link that would do nothing when clicked.
 */
const contextLink: ContextLink = item => item.url
  ? `${escapeHtml(item.title)} <span class="note">${escapeHtml(item.url)}</span>`
  : escapeHtml(item.title);
/** The same half for an observation row's screen: its live URL as text beside the route, not a dead link. */
const observationLink: ObservationLink = (href, text) => `${escapeHtml(text)} <span class="note">${escapeHtml(href)}</span>`;

/** The Sprint 201 page's lineage, versions, edits and measurement panel, and the acts; another version opens in place instead of navigating. */
const openButton = (version: number, label: string) => `<button type="button" class="link" data-open-version="${version}">${label}</button>`;
const actStatus = (act: Act) => `<span class="status" data-oods-act-status="${act}" aria-live="polite">${escapeHtml(state.actStatus[act] ?? '')}</span>`;
function renderPanel(): void {
  const record = state.record;
  if (!record) { panel.replaceChildren(); return; }
  const versions = state.versions ?? [];
  const accepted = state.accepted ?? undefined;
  const others = versions.filter(entry => entry.version !== record.version);
  panel.innerHTML = [
    `<details open data-oods-lineage="true"><summary>Lineage · ${escapeHtml(labelOf(record))}</summary><dl>${renderLineage(record, versions.length, openButton, accepted)}</dl></details>`,
    `<details open><summary>Versions <span class="count">${versions.length}</span></summary><ul data-oods-versions="true">${renderVersionList(versions, record.version, openButton, accepted?.version)}</ul></details>`,
    '<details open data-oods-acts="true"><summary>Decide</summary>',
    `<div class="act"><button type="button" data-act="accept"${accepted?.version === record.version ? ' disabled' : ''}>Accept v${record.version}</button> ${actStatus('accept')}</div>`,
    others.length
      ? `<form class="act" data-act="compare"><label>Compare v${record.version} with <select name="against">${others.map(entry => `<option value="${entry.version}">v${entry.version} · ${escapeHtml(entry.operation)}</option>`).join('')}</select></label> <button type="submit">Compare side by side</button> ${actStatus('compare')}</form>`
      : `<p class="note">One version so far; an edit records another to compare with. ${actStatus('compare')}</p>`,
    `<form class="act" data-act="request-changes"><label for="oods-request-changes">Request changes to v${record.version}</label><textarea id="oods-request-changes" name="text" rows="2" required></textarea><button type="submit">Send to the conversation</button> ${actStatus('request-changes')}</form>`,
    '</details>',
    `<details open data-oods-edit-panel="true"><summary>Edit</summary><div class="edit" data-oods-edit="true">${renderEditControls(record)}</div><p class="note">${actStatus('edit')}</p></details>`,
    `<details open data-oods-context-panel="true"><summary>Context</summary>${renderContext(record, contextLink) || '<p class="note">No context was supplied with this preview. OODS Foundry fetches none of its own: an agent passes design_preview the decisions and evidence it already found, and they are stored on the version.</p>'}</details>`,
    // Only when the version carries an observation: the shared renderer returns nothing otherwise, and so does this.
    ...(record.observation ? [`<details open data-oods-observation-panel="true"><summary>Observed</summary>${renderObservation(record, observationLink)}</details>`] : []),
    `<details open data-oods-measurements-panel="true"><summary>Measurements</summary>${renderMeasurementPanel(record, state.brands)}<p class="note" data-oods-axe-scope="stored-document-run">Every axe-core result above was measured by the browser preview page, which runs the engine over the whole generated page as its own document, and stored on this version; this view shows those stored results and re-runs nothing. Here the design is mounted beside this app's own chrome in one document, so neither scope would measure it honestly: a run scoped to the mounted design cannot evaluate the nine document-level rules — including <code>landmark-one-main</code>, <code>page-has-heading-one</code> and <code>region</code>, the three the generated shell exists to satisfy — and a run over this whole document would report this app's chrome as the design's findings.</p></details>`,
  ].join('');
}

// Width: the app is as wide as the host's container unless a fixed width is chosen; a width the container cannot show asks for fullscreen, and so does compare.
let fullscreenBy: 'width' | 'compare' | null = null;
let lastModeRequest: string | null = null;
function containerWidthOf(context: McpUiHostContext | null): number | null {
  const dimensions = context?.containerDimensions as { width?: number; maxWidth?: number } | undefined;
  return typeof dimensions?.width === 'number' ? dimensions.width : typeof dimensions?.maxWidth === 'number' ? dimensions.maxWidth : null;
}
function applyWidth(): void {
  for (const node of [frame, ...compareView.querySelectorAll<HTMLElement>('[data-oods-side-frame]')]) node.style.width = state.width === 'fit' ? '100%' : `${state.width}px`;
  const measured = state.view === 'compare' ? compareView.querySelector<HTMLElement>('[data-oods-side-frame]') ?? frame : frame;
  state.appWidth = Math.round(measured.getBoundingClientRect().width);
  state.containerWidth = containerWidthOf(state.hostContext);
  const modes = (state.hostContext?.availableDisplayModes ?? []) as string[];
  if (state.view === 'single') {
    if (state.width !== 'fit' && state.width > stage.clientWidth && state.displayMode !== 'fullscreen' && modes.includes('fullscreen')) void requestMode('fullscreen', 'width');
    else if (fullscreenBy === 'width' && state.displayMode === 'fullscreen' && (state.width === 'fit' || state.width <= (state.containerWidth ?? stage.clientWidth))) void requestMode('inline', 'width');
  }
  renderStatus();
}
async function requestMode(mode: 'inline' | 'fullscreen', reason: 'width' | 'compare'): Promise<void> {
  const key = `${mode}:${reason}:${state.width}`;
  if (lastModeRequest === key) return;
  if (mode === 'fullscreen' && !((state.hostContext?.availableDisplayModes ?? []) as string[]).includes('fullscreen')) return;
  lastModeRequest = key;
  const entry: { mode: string; reason: string; answer: string | null } = { mode, reason, answer: null };
  state.displayModeRequests.push(entry);
  try {
    const answer = await app.requestDisplayMode({ mode });
    entry.answer = answer.mode;
    state.displayMode = answer.mode;
    fullscreenBy = answer.mode === 'fullscreen' ? reason : null;
  } catch (error) { fail(`ui/request-display-mode ${mode}`, error); }
  applyWidth();
}

// Everything the app reads comes through the host: the version record, the lineage list, the compiled module and its styles.
async function read(uri: string): Promise<{ text: string; mimeType: string }> {
  state.reads.push(uri);
  const result = await app.readServerResource({ uri });
  const content = result.contents[0] as { text?: string; mimeType?: string } | undefined;
  if (typeof content?.text !== 'string') throw new Error(`resources/read ${uri} returned no text`);
  return { text: content.text, mimeType: content.mimeType ?? '' };
}
const readJson = async <T>(uri: string): Promise<T> => JSON.parse((await read(uri)).text) as T;
/** A compiled module or stylesheet never changes for one artifact: cached by its content hash with the URI (a scope's URI serves the version's own artifact until that scope is generated). */
const artifactTexts = new Map<string, Promise<{ text: string; mimeType: string }>>();
function readArtifactText(uri: string, contentHash: string): Promise<{ text: string; mimeType: string }> {
  const key = `${contentHash} ${uri}`;
  let pending = artifactTexts.get(key);
  if (!pending) {
    pending = read(uri);
    artifactTexts.set(key, pending);
    pending.catch(() => artifactTexts.delete(key));
  }
  return pending;
}

const textOf = (result: ToolResult) => result.content?.find(block => block.type === 'text')?.text ?? '';
function errorOf(result: ToolResult): { code?: string; message: string } {
  const text = textOf(result);
  try {
    const parsed = JSON.parse(text) as { error?: { code?: string; message?: string } };
    if (parsed?.error) return { ...(parsed.error.code ? { code: parsed.error.code } : {}), message: parsed.error.message ?? text };
  } catch { /* the adapter's plain failure text */ }
  return { message: text || 'no error text' };
}
async function callPreview(args: Json, purpose: string): Promise<Json> {
  for (let attempt = 0; ; attempt += 1) {
    const started = performance.now();
    const result = await app.callServerTool({ name: TOOL, arguments: args }) as ToolResult;
    const ms = Math.round(performance.now() - started);
    if (!result.isError) {
      state.toolCalls.push({ arguments: args, ok: true, ms });
      return (result.structuredContent ?? JSON.parse(textOf(result))) as Json;
    }
    const error = errorOf(result);
    state.toolCalls.push({ arguments: args, ok: false, ...(error.code ? { code: error.code } : {}), ms });
    if (error.code !== undefined && LIMITED.has(error.code) && attempt < RETRY_DELAYS_MS.length) {
      const delay = RETRY_DELAYS_MS[attempt]!;
      setPending(`${purpose}: design_preview is at its limit (ten calls a minute, one at a time); asking again in ${delay / 1000}s…`);
      await sleep(delay);
      continue;
    }
    throw new Error(`${TOOL} refused${error.code ? ` (${error.code})` : ''}: ${error.message}`);
  }
}

// Mounting, as the Sprint 201 page does: the field model as props, every action dispatching an observable oods-design-loop-action.
type Mounted = { unmount(): void };
type Slot = { name: 'main' | 'left' | 'right'; frame: HTMLElement; handle: Mounted | null };
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the runtime packages are untyped globals here
type RuntimeModule = Record<string, any>;
function runtimeModule(specifier: string): RuntimeModule {
  const module = (globalThis as unknown as Record<string, Record<string, RuntimeModule> | undefined>)[RUNTIME_GLOBAL]?.[specifier];
  if (!module) throw new Error(`the app was built without ${specifier} in its runtime (globalThis.${RUNTIME_GLOBAL})`);
  return module;
}
const registered = (key: string): Json | undefined => (globalThis as unknown as Record<string, Record<string, Json> | undefined>)[MODULES_GLOBAL]?.[key];

/** Run compiled code as an inline script, the only kind the default CSP allows; an exception it throws fails this mount. */
function runInline(code: string, label: string): void {
  const thrown: string[] = [];
  const listener = (event: ErrorEvent) => { thrown.push(event.message); event.preventDefault(); };
  window.addEventListener('error', listener);
  const script = document.createElement('script');
  script.dataset.oodsModule = label;
  script.textContent = code;
  try { document.head.appendChild(script); } finally { window.removeEventListener('error', listener); script.remove(); }
  if (thrown.length) throw new Error(`the compiled module ${label} threw: ${thrown.join('; ')}`);
}
function setArtifactStyles(slot: Slot['name'], css: string): void {
  const id = `oods-artifact-styles-${slot}`;
  let style = document.getElementById(id);
  if (!style) { style = document.createElement('style'); style.id = id; document.head.appendChild(style); }
  style.textContent = css;
}
function actionsFor(artifact: PreviewArtifact): Record<string, (...args: unknown[]) => void> {
  return Object.fromEntries(artifact.actions.map(action => [action.name, (...args: unknown[]) => {
    state.actions.push({ name: action.name, at: new Date().toISOString() });
    window.dispatchEvent(new CustomEvent('oods-design-loop-action', { detail: { name: action.name, args } }));
  }]));
}
function mountComponent(container: HTMLElement, framework: PreviewFramework, exported: Json, props: Json): Mounted {
  if (framework === 'react') {
    const Page = exported.GeneratedUI ?? exported.default;
    if (typeof Page !== 'function') throw new Error('the compiled React module exports no GeneratedUI component');
    const React = runtimeModule('react');
    const root = runtimeModule('react-dom/client').createRoot(container);
    // Committed synchronously, so what is counted after the mount is the mounted tree.
    runtimeModule('react-dom').flushSync(() => root.render(React.createElement(Page, props)));
    return { unmount: () => root.unmount() };
  }
  const Page = exported.default ?? exported.GeneratedUI;
  if (!Page) throw new Error('the compiled Vue module has no default export');
  const vueApp = runtimeModule('vue').createApp(Page, props);
  vueApp.mount(container);
  return { unmount: () => vueApp.unmount() };
}

type Prepared = { target: Scope; record: CompositionVersion; generatedFor: GeneratedFor; artifact: PreviewArtifact; moduleUri: string; stylesUri: string; module: { text: string; mimeType: string }; styles: { text: string; mimeType: string }; scopeError: unknown };
/** Read a version for a scope, have design_preview generate what the scope lacks (the framework, or the placed chart for that scope), and read the compiled module and styles. */
async function prepare(target: Scope, stale: () => boolean): Promise<Prepared | null> {
  const versionUri = `${COMPOSITIONS}${target.compositionId}/${target.version}/`;
  setPending(`Reading ${target.compositionId} version ${target.version}…`);
  let record = await readJson<CompositionVersion>(`${versionUri}record.json`);
  if (stale()) return null;
  const key = scopeKey(target.brand, target.theme);
  const lacksFramework = !record.artifacts[target.framework];
  const lacksScope = hasPlacedChart(record.schema) && key !== scopeKey(record.brand, record.theme) && !record.scopes?.[key]?.artifacts[target.framework];
  let scopeError: unknown = null;
  if (lacksFramework || lacksScope) {
    const purpose = lacksScope ? `Rendering the placed chart of v${target.version} for ${key} (${target.framework})` : `Generating the ${target.framework} app for v${target.version}`;
    setPending(`${purpose}…`);
    try {
      state.result = await callPreview({ compositionId: target.compositionId, version: target.version, framework: target.framework, preferences: { brand: target.brand, theme: target.theme } }, purpose) as PreviewResult;
    } catch (error) {
      // Without the framework there is nothing to mount; without the scoped chart the version's own module mounts, labelled with its scope.
      if (lacksFramework) throw error;
      scopeError = error;
    }
    if (stale()) return null;
    record = await readJson<CompositionVersion>(`${versionUri}record.json`);
    if (stale()) return null;
  }
  const served = servedArtifact(record, target.framework, target.brand, target.theme);
  if (!served) throw new Error(`version ${target.version} carries no ${target.framework} artifact`);
  const query = `?brand=${target.brand}&theme=${target.theme}`;
  const moduleUri = `${versionUri}${target.framework}.js${query}`;
  const stylesUri = `${versionUri}${target.framework}.css${query}`;
  setPending(`Reading the compiled ${target.framework} module of v${target.version}…`);
  const [module, styles] = await Promise.all([readArtifactText(moduleUri, served.entry.artifact.contentHash), readArtifactText(stylesUri, served.entry.artifact.contentHash)]);
  if (stale()) return null;
  return { target, record, generatedFor: { ...served.generatedFor, chartScoped: hasPlacedChart(record.schema) }, artifact: served.entry.artifact, moduleUri, stylesUri, module, styles, scopeError };
}

const slots: Record<Slot['name'], Slot> = {
  main: { name: 'main', frame, handle: null },
  left: { name: 'left', frame: element('[data-oods-side-frame="left"]'), handle: null },
  right: { name: 'right', frame: element('[data-oods-side-frame="right"]'), handle: null },
};
/** Mount a prepared version in a frame: a standalone module runs once per artifact and is re-mounted from its registered exports; a workflow module mounts itself when it runs. */
function mountInto(slot: Slot, prepared: Prepared): void {
  const { target, record, artifact, module, styles } = prepared;
  const workflow = artifact.files.some(file => file.path === 'package.json');
  if (workflow && slot.name !== 'main') throw new Error('a workflow app mounts itself into the page, so it cannot be shown side by side here; compare the list, detail or form screens');
  const name = moduleKey(artifact.contentHash);
  if (!workflow && !registered(name)) runInline(module.text, `${target.framework}:${name}`);
  const exported = registered(name);
  if (!workflow && !exported) throw new Error(`${prepared.moduleUri} did not register ${MODULES_GLOBAL}.${name}: the host served another artifact than version ${target.version} names`);
  unmountSlot(slot);
  const container = document.createElement('div');
  if (slot.name === 'main') container.id = 'app';
  container.dataset.oodsPreview = record.compositionId;
  container.dataset.oodsPreviewVersion = String(record.version);
  container.dataset.oodsPreviewFramework = target.framework;
  slot.frame.replaceChildren(container);
  // The scope goes on the document as on the Sprint 201 page: the runtime CSS resolves its --sys-* aliases on :root, so a
  // brand or theme set only on the frame would leave the app on the root's tokens. The frame carries it too.
  document.documentElement.classList.toggle('dark', target.theme === 'dark');
  for (const node of [document.documentElement, document.body, slot.frame]) { node.dataset.theme = target.theme; node.dataset.brand = target.brand; }
  slot.frame.style.colorScheme = target.theme === 'dark' ? 'dark' : 'light';
  setArtifactStyles(slot.name, styles.text);
  if (workflow) runInline(module.text, `${target.framework}:${name}`);
  else slot.handle = mountComponent(container, target.framework, exported!, { ...(record.model ?? {}), actions: actionsFor(artifact) });
}
function unmountSlot(slot: Slot): void {
  if (!slot.handle) return;
  const previous = slot.handle;
  slot.handle = null;
  previous.unmount();
}
function closeCompare(): void {
  if (state.view !== 'compare') return;
  unmountSlot(slots.left);
  unmountSlot(slots.right);
  slots.left.frame.replaceChildren();
  slots.right.frame.replaceChildren();
  setArtifactStyles('left', '');
  setArtifactStyles('right', '');
  compareView.hidden = true;
  frame.hidden = false;
  state.view = 'single';
  state.compare = null;
  if (fullscreenBy === 'compare' && state.displayMode === 'fullscreen') void requestMode('inline', 'compare');
}

let sequence = 0;
/** Mount a scope in the single view: prepare it, mount it in place, show its lineage, versions, acts and measurements. */
async function show(target: Scope, reason: string): Promise<void> {
  const request = ++sequence;
  const stale = () => request !== sequence;
  state.requested = target;
  syncControls();
  try {
    const prepared = await prepare(target, stale);
    if (!prepared) return;
    const { versions, accepted } = await readJson<VersionsResource>(`${COMPOSITIONS}${target.compositionId}/versions.json`);
    if (stale()) return;
    closeCompare();
    mountInto(slots.main, prepared);
    await nextFrames(2);
    if (stale()) return;

    const nodes = componentsIn(document);
    Object.assign(state, {
      record: prepared.record, versions, accepted: accepted ?? null, framework: target.framework, brand: target.brand, theme: target.theme, generatedFor: prepared.generatedFor,
      module: { uri: prepared.moduleUri, key: moduleKey(prepared.artifact.contentHash), bytes: utf8Bytes(prepared.module.text), mimeType: prepared.module.mimeType, registers: Boolean(registered(moduleKey(prepared.artifact.contentHash))), workflow: prepared.artifact.files.some(file => file.path === 'package.json') },
      styles: { uri: prepared.stylesUri, bytes: utf8Bytes(prepared.styles.text) },
      mounted: true, mounts: state.mounts + 1, components: nodes.length, componentNames: namesOf(nodes), pending: null,
    });
    document.documentElement.dataset.oodsPreviewMounts = String(state.mounts);
    renderPanel();
    syncControls();
    applyWidth();
    if (prepared.scopeError) fail(`the placed chart could not be rendered for ${scopeKey(target.brand, target.theme)} (${target.framework}); it shows ${prepared.generatedFor.brand}/${prepared.generatedFor.theme}`, prepared.scopeError);
    window.dispatchEvent(new CustomEvent('oods-preview-mounted', { detail: { compositionId: prepared.record.compositionId, version: prepared.record.version, framework: target.framework, brand: target.brand, theme: target.theme, components: nodes.length } }));
  } catch (error) {
    if (stale()) return;
    setPending(null);
    fail(reason, error);
    renderStatus();
  }
}

/** Two versions side by side in one scope: the tool's what-changed, both running apps, both measurement panels; fullscreen is asked for. */
async function compare(against: number, scope: Scope): Promise<void> {
  const request = ++sequence;
  const stale = () => request !== sequence;
  const left: Scope = scope;
  const right: Scope = { ...scope, version: against };
  state.requested = left;
  syncControls();
  setActStatus('compare', `Comparing v${left.version} with v${right.version}…`);
  try {
    setPending(`Comparing v${left.version} with v${right.version}…`);
    const result = await callPreview({ action: 'compare', compositionId: left.compositionId, version: left.version, against: { version: right.version }, framework: scope.framework }, 'Compare') as unknown as CompareResult;
    if (stale()) return;
    const preparedLeft = await prepare(left, stale);
    if (!preparedLeft) return;
    const preparedRight = await prepare(right, stale);
    if (!preparedRight) return;
    unmountSlot(slots.main);
    slots.main.frame.replaceChildren();
    setArtifactStyles('main', '');
    frame.hidden = true;
    compareView.hidden = false;
    state.view = 'compare';
    for (const [side, prepared] of [['left', preparedLeft], ['right', preparedRight]] as const) {
      const title = compareView.querySelector<HTMLElement>(`[data-oods-side-title="${side}"]`)!;
      title.textContent = `v${prepared.record.version} · ${prepared.record.operation}${prepared.record.parentVersion === null ? '' : ` ← v${prepared.record.parentVersion}`}`;
    }
    mountInto(slots.left, preparedLeft);
    mountInto(slots.right, preparedRight);
    whatChanged.innerHTML = `<h2>What changed <span class="count">${result.differenceCount}</span></h2>${renderWhatChanged(result.diff)}`;
    comparePanels.innerHTML = renderMeasurementPanel(preparedLeft.record, state.brands) + renderMeasurementPanel(preparedRight.record, state.brands);
    await nextFrames(2);
    if (stale()) return;
    const side = (prepared: Prepared, slot: Slot): Side => { const nodes = componentsIn(slot.frame); return { compositionId: prepared.record.compositionId, version: prepared.record.version, components: nodes.length, componentNames: namesOf(nodes), generatedFor: prepared.generatedFor }; };
    Object.assign(state, {
      compare: { left: side(preparedLeft, slots.left), right: side(preparedRight, slots.right), identical: result.identical, differenceCount: result.differenceCount, summary: result.diff.summary as unknown as Record<string, number>, renderedChanges: whatChanged.querySelectorAll('[data-oods-diff] li').length, frameworks: result.frameworks },
      compares: state.compares + 1, framework: scope.framework, brand: scope.brand, theme: scope.theme, pending: null,
    });
    compareTitle.textContent = `v${left.version} and v${right.version} side by side · ${result.differenceCount} ${result.differenceCount === 1 ? 'difference' : 'differences'}`;
    state.acts.push({ act: 'compare', ok: true, detail: { left: left.version, right: right.version, differenceCount: result.differenceCount } });
    setActStatus('compare', `Side by side: v${left.version} and v${right.version}.`);
    syncControls();
    applyWidth();
    void requestMode('fullscreen', 'compare');
  } catch (error) {
    if (stale()) return;
    setPending(null);
    state.acts.push({ act: 'compare', ok: false, detail: { left: left.version, right: right.version, error: messageOf(error) } });
    setActStatus('compare', `Could not compare: ${messageOf(error)}`);
    renderStatus();
  }
}

/** One edit = one new version through design_preview action edit (re-composed, never hand-edited); it opens in place with its lineage. */
async function edit(operation: string, fields: Json): Promise<void> {
  const current = state.requested;
  const record = state.record;
  if (!current || !record) return;
  setActStatus('edit', `Re-composing ${operation} from v${record.version}…`);
  try {
    const result = await callPreview({ action: 'edit', compositionId: record.compositionId, version: record.version, edit: { operation, ...fields } }, `Edit ${operation}`) as PreviewResult;
    state.result = result;
    state.acts.push({ act: 'edit', ok: true, detail: { operation, parentVersion: record.version, version: result.version } });
    setActStatus('edit', `v${result.version} recorded (${operation} ← v${record.version}).`);
    await show({ ...current, version: result.version! }, `edit ${operation}`);
  } catch (error) {
    state.acts.push({ act: 'edit', ok: false, detail: { operation, parentVersion: record.version, error: messageOf(error) } });
    setActStatus('edit', `Refused: ${messageOf(error)}`);
  }
}
const moveIn = (list: string[], index: number, delta: number): string[] | null => {
  const next = [...list];
  const target = index + delta;
  if (target < 0 || target >= next.length) return null;
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
};

/** What the model is told when a version is accepted: the version, its lineage, when, and what it measured then, from the acceptance itself. */
function acceptedSummary(record: CompositionVersion, result: AcceptResult): string {
  const measured = result.accepted.measured as { validation?: string[]; charts?: { placed: number; conformant: number; scopes?: string[] }; axe?: string[]; notMeasured?: string[] };
  const charts = measured.charts;
  return [
    `Accepted design: ${labelOf(record)}, composition ${result.compositionId} version ${result.version} (${result.operation}${result.parentVersion === null ? '' : ` from v${result.parentVersion}`}), accepted ${result.accepted.acceptedAt}${result.accepted.supersedes ? `, superseding v${result.accepted.supersedes.version}` : ''}.`,
    `Schema ${result.accepted.schemaHash}.`,
    `Measured at acceptance: generation receipts for ${measured.validation?.length ? measured.validation.join(' and ') : 'no framework'}; ${charts ? `${charts.placed} placed ${charts.placed === 1 ? 'chart' : 'charts'}, ${charts.conformant} conformant${charts.scopes?.length ? ` (certified for ${charts.scopes.join(', ')})` : ''}` : 'no placed-chart record'}; axe-core ${measured.axe?.length ? measured.axe.join(', ') : 'not run'}.`,
    measured.notMeasured?.length ? `Not measured: ${measured.notMeasured.join(', ')}.` : 'Nothing listed as not measured.',
  ].join(' ');
}
/** Accept the version on screen through design_preview action accept; the model's context then names what stands. */
async function acceptVersion(): Promise<void> {
  const record = state.record;
  if (!record) return;
  setActStatus('accept', `Accepting v${record.version}…`);
  let result: AcceptResult;
  try {
    result = await callPreview({ action: 'accept', compositionId: record.compositionId, version: record.version }, `Accept v${record.version}`) as unknown as AcceptResult;
  } catch (error) {
    state.acts.push({ act: 'accept', ok: false, detail: { version: record.version, error: messageOf(error) } });
    setActStatus('accept', `Refused: ${messageOf(error)}`);
    return;
  }
  const accepted = `v${result.version} accepted ${result.accepted.acceptedAt}${result.accepted.supersedes ? `, superseding v${result.accepted.supersedes.version}` : ''}`;
  // The acceptance is recorded; the act is complete once the panel shows it and the model's context names it.
  try {
    const listed = await readJson<VersionsResource>(`${COMPOSITIONS}${record.compositionId}/versions.json`);
    state.versions = listed.versions;
    state.accepted = listed.accepted ?? null;
    const text = acceptedSummary(record, result);
    const structuredContent = { compositionId: result.compositionId, version: result.version, parentVersion: result.parentVersion, operation: result.operation, acceptedAt: result.accepted.acceptedAt, schemaHash: result.accepted.schemaHash, supersedes: result.accepted.supersedes, acceptances: result.acceptances, measured: result.accepted.measured };
    await app.updateModelContext({ content: [{ type: 'text', text }], structuredContent });
    state.modelContext.push({ text, structuredContent });
    state.actStatus.accept = `${accepted}; the conversation's context names it.`;
  } catch (error) {
    fail(`v${result.version} was accepted, but the view or the conversation's context was not updated`, error);
    state.actStatus.accept = `${accepted}; the context update failed.`;
  }
  renderPanel();
  state.acts.push({ act: 'accept', ok: true, detail: { version: result.version, acceptances: result.acceptances, supersedes: result.accepted.supersedes } });
}
/** Ask for a change in the conversation: a message naming the composition, the version and the request. The schema is never edited here. */
async function requestChanges(text: string): Promise<void> {
  const record = state.record;
  if (!record) return;
  const message = `Request changes to ${labelOf(record)}, composition ${record.compositionId} version ${record.version}: ${text}`;
  setActStatus('request-changes', 'Sending…');
  try {
    const result = await app.sendMessage({ role: 'user', content: [{ type: 'text', text: message }] });
    if (result.isError) throw new Error('the host did not deliver the message');
    state.messages.push(message);
    state.acts.push({ act: 'request-changes', ok: true, detail: { version: record.version } });
    const box = panel.querySelector<HTMLTextAreaElement>('#oods-request-changes');
    if (box) box.value = '';
    setActStatus('request-changes', 'Sent to the conversation.');
  } catch (error) {
    state.acts.push({ act: 'request-changes', ok: false, detail: { version: record.version, error: messageOf(error) } });
    setActStatus('request-changes', `Not sent: ${messageOf(error)}`);
  }
}

/** A design_preview result opens its version: the framework the call asked for, the result's brand, and the theme the call named or else the host's. */
async function open(result: PreviewResult): Promise<void> {
  const input = state.toolInput ?? {};
  const compositionId = result.compositionId ?? result.left?.compositionId;
  const version = result.version ?? result.latest ?? result.left?.version;
  if (!compositionId || !version) throw new Error(`the ${result.action ?? 'result'} names no composition version to mount`);
  const framework = isOneOf(FRAMEWORKS, input.framework) ? input.framework : result.previews?.[0]?.framework ?? 'react';
  let brand = result.brand;
  let theme = result.theme;
  if (!brand || !theme) {
    const record = await readJson<CompositionVersion>(`${COMPOSITIONS}${compositionId}/${version}/record.json`);
    brand ??= record.brand;
    theme ??= record.theme;
  }
  await loadTokens(result.resources?.tokens ?? TOKENS);
  const named = (input.preferences as Json | undefined)?.theme;
  const hostTheme = (app.getHostContext() ?? state.hostContext)?.theme;
  if (isOneOf(THEMES, named)) state.themeSource = 'call';
  else if (hostTheme === 'light' || hostTheme === 'dark') { theme = hostTheme; state.themeSource = 'host'; }
  else state.themeSource = 'version';
  await show({ compositionId, version, framework, brand, theme }, `design_preview ${result.action ?? 'result'}`);
}

const app = new App({ name: 'oods-forge-preview', version: __OODS_PREVIEW_APP_VERSION__ }, { availableDisplayModes: ['inline', 'fullscreen'] });

function applyHostContext(context: McpUiHostContext | null): void {
  if (!context) return;
  if (context.styles?.variables) applyHostStyleVariables(context.styles.variables);
  if (context.theme) document.documentElement.dataset.hostTheme = context.theme;
  if (context.displayMode) state.displayMode = context.displayMode;
}

app.ontoolinput = params => { state.toolInput = (params.arguments ?? null) as Json | null; };
app.ontoolresult = result => {
  const toolResult = result as ToolResult;
  if (toolResult.isError) { fail(TOOL, errorOf(toolResult).message); renderStatus(); return; }
  let structured = toolResult.structuredContent as PreviewResult | undefined;
  if (!structured) { try { structured = JSON.parse(textOf(toolResult)) as PreviewResult; } catch { structured = undefined; } }
  if (!structured) { fail(TOOL, 'the result carries neither structured content nor JSON text'); renderStatus(); return; }
  state.result = structured;
  buildControls();
  open(structured).catch(error => { setPending(null); fail(`${TOOL} result`, error); renderStatus(); });
};
app.onhostcontextchanged = context => {
  const previousTheme = state.hostContext?.theme;
  state.hostContext = { ...(state.hostContext ?? {}), ...context };
  applyHostContext(state.hostContext);
  applyWidth();
  // The mounted theme follows the host's while neither the call nor a switch named one.
  const theme = context.theme;
  if ((theme === 'light' || theme === 'dark') && theme !== previousTheme && state.themeSource === 'host' && state.requested && state.view === 'single' && theme !== state.requested.theme) void show({ ...state.requested, theme }, 'host theme change');
};

document.addEventListener('click', event => {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;
  const control = target.closest<HTMLButtonElement>('button[data-control]');
  if (control) {
    const { control: name, value } = control.dataset;
    if (name === 'width') { state.width = value === 'fit' ? 'fit' : Number(value); syncControls(); applyWidth(); return; }
    const current = state.requested;
    if (!current) return;
    let next: Scope | null = null;
    if (name === 'framework' && isOneOf(FRAMEWORKS, value)) next = { ...current, framework: value };
    else if (name === 'brand' && isOneOf(state.brands, value)) next = { ...current, brand: value };
    else if (name === 'theme' && isOneOf(THEMES, value)) { state.themeSource = 'switch'; next = { ...current, theme: value }; }
    // A switch keeps the view: side by side re-mounts both versions in the new scope.
    if (next && state.view === 'compare' && state.compare) void compare(state.compare.right.version, next);
    else if (next) void show(next, `${name} ${value}`);
    return;
  }
  const opener = target.closest<HTMLButtonElement>('button[data-open-version]');
  if (opener && state.requested) { void show({ ...state.requested, version: Number(opener.dataset.openVersion) }, `version ${opener.dataset.openVersion}`); return; }
  const act = target.closest<HTMLButtonElement>('button[data-act]');
  if (act?.dataset.act === 'accept') { void acceptVersion(); return; }
  if (act?.dataset.act === 'close-compare' && state.requested) { void show(state.requested, 'close compare'); return; }
  const move = target.closest<HTMLButtonElement>('[data-oods-edit] button.move');
  if (move) {
    const index = Number(move.dataset.index);
    const delta = Number(move.dataset.delta);
    if (move.dataset.kind === 'region') { const order = moveIn(JSON.parse(move.closest<HTMLElement>('[data-regions]')!.dataset.regions!) as string[], index, delta); if (order) void edit('reorder-region', { regionOrder: order }); }
    if (move.dataset.kind === 'field') { const holder = move.closest<HTMLElement>('[data-fields]')!; const order = moveIn(JSON.parse(holder.dataset.fields!) as string[], index, delta); if (order) void edit('reorder-fields', { region: holder.dataset.region, fieldOrder: order }); }
  }
});
document.addEventListener('submit', event => {
  const form = event.target instanceof Element ? event.target.closest<HTMLFormElement>('form[data-edit], form[data-act]') : null;
  if (!form) return;
  event.preventDefault();
  if (form.dataset.edit === 'swap-slot') {
    const select = form.querySelector('select')!;
    if (select.value && select.value !== form.dataset.current) void edit('swap-slot', { slot: form.dataset.slot, component: select.value });
    else setActStatus('edit', 'Choose a different candidate.');
  }
  if (form.dataset.edit === 'seed') {
    const input = form.querySelector('input')!;
    if (input.value && input.value !== form.dataset.current) void edit('seed', { seed: input.value });
    else setActStatus('edit', 'Enter a different seed.');
  }
  if (form.dataset.act === 'compare' && state.requested) void compare(Number(form.querySelector('select')!.value), state.requested);
  if (form.dataset.act === 'request-changes') {
    const text = form.querySelector('textarea')!.value.trim();
    if (text) void requestChanges(text);
  }
});
new ResizeObserver(() => { if (state.connected) applyWidth(); }).observe(stage);

renderStatus();
app.connect().then(() => {
  state.connected = true;
  state.hostContext = app.getHostContext() ?? null;
  applyHostContext(state.hostContext);
  applyWidth();
}, error => { fail('connect', error); renderStatus(); });
