import fs from 'node:fs';
import { createHash } from 'node:crypto';

// ── MCP Apps (io.modelcontextprotocol/ui) ────────────────────────────
// The preview inside the conversation (Sprint 202): design_preview points at a ui:// resource the host
// renders in its sandbox. The app is one self-contained HTML file the bridge build emits; the compiled
// composition modules and their styles are readable resources served through the lazily started preview
// host. The extension is bilateral: the tool carries _meta.ui.resourceUri only when the client advertised
// capabilities.extensions["io.modelcontextprotocol/ui"] in its initialize request (or the operator forced
// it with OODS_MCP_APPS_UI=1); every other client keeps the text result with the localhost URLs.

export const UI_EXTENSION = 'io.modelcontextprotocol/ui';
export const APP_MIME_TYPE = 'text/html;profile=mcp-app';
export const APP_RESOURCE_PREFIX = 'ui://oods-forge/preview/';
export const COMPOSITION_RESOURCE_PREFIX = 'ui://oods-forge/compositions/';
/** s213-m04: the token build's brands and CSS, read live through the preview host (the app carries neither). */
export const TOKENS_RESOURCE = 'ui://oods-forge/tokens.json';
const COMPOSITION_RESOURCE = /^ui:\/\/oods-forge\/compositions\/(cmp-[a-f0-9]{12})\/([1-9]\d{0,6})\/(react|vue)\.(js|css)(?:\?([^#]*))?$/;
const RECORD_RESOURCE = /^ui:\/\/oods-forge\/compositions\/(cmp-[a-f0-9]{12})\/([1-9]\d{0,6})\/record\.json$/;
const VERSIONS_RESOURCE = /^ui:\/\/oods-forge\/compositions\/(cmp-[a-f0-9]{12})\/versions\.json$/;
/** A brand id's shape only; which brands exist is the token build's answer, which the preview host checks (s213-m04). */
const BRAND_ID = /^[A-Za-z][A-Za-z0-9]{0,31}$/;
const THEMES = new Set(['light', 'dark', 'hc']);

/** The app resource: its content hash is the revision in the URI, so a host that caches resources by URI refetches when the app changes. */
export class PreviewApp {
  constructor(candidates) { this.candidates = candidates; this.cache = null; }
  locate() { return this.candidates.find(file => fs.existsSync(file)) ?? null; }
  /** The current app, re-read when the file changes; null when the bridge was built without it. */
  current() {
    const file = this.locate();
    if (!file) { this.cache = null; return null; }
    const stat = fs.statSync(file);
    if (this.cache && this.cache.file === file && this.cache.mtimeMs === stat.mtimeMs && this.cache.size === stat.size) return this.cache;
    const html = fs.readFileSync(file, 'utf8');
    const sha256 = createHash('sha256').update(html).digest('hex');
    const revision = sha256.slice(0, 12);
    this.cache = { file, mtimeMs: stat.mtimeMs, size: stat.size, html, sha256, revision, bytes: Buffer.byteLength(html), uri: `${APP_RESOURCE_PREFIX}${revision}/app.html` };
    return this.cache;
  }
}

/**
 * ui://oods-forge/compositions/<id>/<n>/<framework>.(js|css)[?brand=&theme=] (the compiled module and its styles),
 * ui://oods-forge/compositions/<id>/<n>/record.json (the version record: lineage, schema, model, artifacts, measurements)
 * and ui://oods-forge/compositions/<id>/versions.json (the lineage list) → their parts, or null.
 */
export function parseCompositionResource(uri) {
  const record = RECORD_RESOURCE.exec(uri);
  if (record) return { compositionId: record[1], version: Number(record[2]), kind: 'record' };
  const versions = VERSIONS_RESOURCE.exec(uri);
  if (versions) return { compositionId: versions[1], version: null, kind: 'versions' };
  const match = COMPOSITION_RESOURCE.exec(uri);
  if (!match) return null;
  const query = new URLSearchParams(match[5] ?? '');
  const brand = query.get('brand') ?? undefined;
  const theme = query.get('theme') ?? undefined;
  if ((brand !== undefined && !BRAND_ID.test(brand)) || (theme !== undefined && !THEMES.has(theme))) return null;
  for (const key of query.keys()) if (key !== 'brand' && key !== 'theme') return null;
  return { compositionId: match[1], version: Number(match[2]), framework: match[3], kind: match[4], brand, theme };
}

/** The resource URIs a design_preview result maps to, beside the unchanged text result. */
export function previewResources(result, app) {
  if (!result || typeof result !== 'object' || !Array.isArray(result.previews)) return undefined;
  const scope = result.brand && result.theme ? `?brand=${result.brand}&theme=${result.theme}` : '';
  const base = `${COMPOSITION_RESOURCE_PREFIX}${result.compositionId}/${result.version}/`;
  return {
    app: app ? app.uri : null,
    record: `${base}record.json`,
    versions: `${COMPOSITION_RESOURCE_PREFIX}${result.compositionId}/versions.json`,
    modules: Object.fromEntries(result.previews.map(entry => [entry.framework, `${base}${entry.framework}.js${scope}`])),
    styles: Object.fromEntries(result.previews.map(entry => [entry.framework, `${base}${entry.framework}.css${scope}`])),
    tokens: TOKENS_RESOURCE,
  };
}

/** What the client said at initialize, read from the raw message: the SDK's capability schema drops unknown keys such as extensions. */
export function readNegotiation(params, env = process.env) {
  const capabilities = (params && typeof params === 'object' && params.capabilities && typeof params.capabilities === 'object') ? params.capabilities : {};
  const declared = capabilities.extensions?.[UI_EXTENSION] ?? capabilities.experimental?.[UI_EXTENSION] ?? null;
  return {
    client: params?.clientInfo ?? null,
    protocolVersion: params?.protocolVersion ?? null,
    extension: Boolean(declared),
    mimeTypes: Array.isArray(declared?.mimeTypes) ? declared.mimeTypes : null,
    capabilityKeys: Object.keys(capabilities),
    forced: env.OODS_MCP_APPS_UI === '1',
  };
}
