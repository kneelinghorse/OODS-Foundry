import { createHash } from 'node:crypto';
import dagre from '@dagrejs/dagre';
import { resolveTokenToColor } from '@oods/viz-core';
import { knownBrands } from '../lib/brand-registry.js';
import type { UiElement, UiSchema } from '../schemas/generated.js';
import { executeCompositionDirectives } from './composition-directives.js';
import { escapeHtml as escape } from '../render/escape-html.js';
import { DiagramError, diagramOverflowScript } from './relationship-diagram.js';

type Options = { title: string; includeStyles?: boolean; reviewThreshold?: number; brandOverlay?: string; theme?: 'light' | 'dark' | 'hc' };
function palette(options: Options) {
  const requested = options.brandOverlay ?? 'A', theme = options.theme ?? 'light';
  const brand = knownBrands().find(id => id === requested || `brand-${id.toLowerCase()}` === requested);
  if (!brand) throw new DiagramError('OODS-FP-006', `Unknown built brand ${requested}. Available: ${knownBrands().join(', ')}.`);
  const color = (name: string) => {
    const value = resolveTokenToColor(`--sys-${name}`, { brand, theme });
    if (!value) throw new DiagramError('OODS-FP-006', `Missing ${name} in ${brand}/${theme}.`);
    return value;
  };
  return { brand, theme, text: color('text-primary'), canvas: color('surface-canvas'), raised: color('surface-raised'), subtle: color('surface-subtle'), border: color('border-strong'), focus: color('focus-ring-outer') };
}

/** Field references are authored props/chart operands, never guessed from a component's name. */
function bindings(node: UiElement): string[] {
  const result: string[] = [];
  for (const [prefix, values] of [['', node.props], ['chart.', node.chart]] as const) {
    for (const [key, value] of Object.entries(values ?? {})) {
      if ((key === 'field' || key.endsWith('Field')) && typeof value === 'string') result.push(`${prefix}${key} → ${value}`);
      if ((key === 'fields' || key.endsWith('Fields')) && Array.isArray(value)) result.push(`${prefix}${key} → ${value.filter(v => typeof v === 'string').join(', ')}`);
    }
  }
  if (node.collection) result.push(`collection → ${node.collection.source}`, `key → ${node.collection.keyField}`, `label → ${node.collection.labelField}`, ...(node.collection.historyField ? [`history → ${node.collection.historyField}`] : []));
  return result;
}
function authoredText(node: UiElement): string[] {
  return [...new Set(['label', 'content', 'text', 'title', 'heading', 'message'].flatMap(key => {
    const value = node.props?.[key];
    return typeof value === 'string' && value.trim() ? [value] : [];
  }))];
}
function prepared(schema: UiSchema) {
  let count = 0;
  const ids = new Set<string>();
  const check = (node: UiElement, depth: number) => {
    if (++count > 500 || depth > 24) throw new DiagramError('OODS-FP-008', 'Composed fidelity is limited to 500 nodes and 24 nesting levels.');
    if (ids.has(node.id)) throw new DiagramError('OODS-FP-008', `Duplicate component id "${node.id}".`);
    ids.add(node.id); node.children?.forEach(child => check(child, depth + 1));
  };
  schema.screens.forEach(node => check(node, 0));
  return { schema: executeCompositionDirectives(schema), count };
}
const styles = `*{box-sizing:border-box}body{margin:0;padding:24px;font:14px/1.45 system-ui,sans-serif;color:var(--wire-text);background:var(--wire-canvas)}h1{font-size:24px;margin:0 0 8px}.legend{max-width:90ch;margin:0 0 24px}.wire-screen{margin:0 0 24px}.wire-node{min-width:0;padding:12px;border:1px solid var(--wire-border);background:var(--wire-raised);border-radius:4px;overflow-wrap:anywhere}.wire-node[data-region]{border:2px solid var(--wire-border);background:var(--wire-subtle)}.wire-label{display:flex;gap:8px;flex-wrap:wrap;align-items:baseline;margin-bottom:8px}.wire-label strong{font-size:14px}.wire-label span{font-size:12px}.wire-bindings{margin:0 0 10px;padding:0;list-style:none;font:12px/1.5 ui-monospace,monospace}.wire-note{margin:0 0 8px;font-size:12px}.wire-children{display:flex;flex-direction:column;gap:12px}.wire-node[data-layout=grid]>.wire-children{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))}.wire-node[data-layout=inline]>.wire-children{flex-direction:row;flex-wrap:wrap}.wire-node[data-layout=inline]>.wire-children>*{flex:1 1 180px}.wire-node[data-layout=sidebar]>.wire-children{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr)}.needs-review{border-style:dashed;border-width:2px}.diagram{overflow:auto;max-width:100%;border:1px solid var(--wire-border)}svg{display:block}.diagram:focus-visible{outline:3px solid var(--wire-text)}@media(max-width:600px){body{padding:12px}.wire-node{padding:8px}.wire-node[data-layout]>.wire-children{display:flex;flex-direction:column;gap:8px}.wire-node[data-layout=inline]>.wire-children>*{flex:initial}}`;
function document(title: string, legend: string, content: string, options: Options): string {
  const colors = palette(options);
  const vars = Object.entries(colors).filter(([key]) => !['brand', 'theme'].includes(key)).map(([key, value]) => `--wire-${key}:${value}`).join(';');
  return `<!doctype html><html lang="en"${colors.theme === 'dark' ? ' class="dark"' : ''} data-brand="${escape(colors.brand)}" data-theme="${colors.theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title>${options.includeStyles !== false ? `<style>:root{${vars}}${styles}</style>` : ''}</head><body><header><h1>${escape(title)}</h1><p class="legend">${escape(legend)}</p></header><main>${content}</main></body></html>`;
}

/** A drawing of the lowered component tree and its regions, not catalog entity cards or live controls. */
export function composedWireframe(input: UiSchema, options: Options, review = false) {
  const { schema, count } = prepared(input), threshold = options.reviewThreshold ?? 0.7;
  const draw = (node: UiElement, depth: number): string => {
    const fields = [...authoredText(node), ...bindings(node)], confidence = node.meta?.confidence;
    const region = depth === 1 ? node.meta?.label ?? node.id : undefined;
    const notes = [node.meta?.label, node.state ? `State: ${node.state}` : undefined, node.route ? `Route: ${node.route}` : undefined].filter(Boolean);
    return `<section class="wire-node${review && confidence !== undefined && confidence < threshold ? ' needs-review' : ''}" data-wire-node="${escape(node.id)}" data-component="${escape(node.component)}" data-layout="${escape(node.layout?.type ?? 'stack')}"${region ? ` data-region="${escape(region)}"` : ''}><div class="wire-label"><strong>${escape(node.component)}</strong>${region ? `<span>Region: ${escape(region)}</span>` : ''}</div>${notes.length ? `<p class="wire-note">${notes.map(note => escape(String(note))).join(' · ')}</p>` : ''}${fields.length ? `<ul class="wire-bindings">${fields.map(field => `<li>${escape(field)}</li>`).join('')}</ul>` : ''}${review ? `<p class="wire-note">Composition confidence: ${confidence === undefined ? 'Not recorded' : `${Math.round(confidence * 100)}%${confidence < threshold ? ' · Review' : ''}`}</p>` : ''}${node.children?.length ? `<div class="wire-children">${node.children.map(child => draw(child, depth + 1)).join('')}</div>` : ''}</section>`;
  };
  const title = `${options.title} — ${review ? 'composition review' : 'wireframe'}`;
  const html = document(title, `Token-coloured structural drawing · ${count} components. Boxes follow the composed tree; direct screen children are regions. Field references name the authored bindings. Controls are drawings, not an application. Alternate states and tab panels are shown together for inspection.${review ? ' Confidence is the value recorded on each node; missing scores are not inferred.' : ''}`, schema.screens.map(node => `<div class="wire-screen">${draw(node, 0)}</div>`).join(''), options);
  return { html, meta: { entityCount: schema.screens.length, componentCount: count } };
}

/** A composition has containment edges, not authoritative object relationship identity. */
export function compositionDiagram(input: UiSchema, options: Options) {
  const { schema, count } = prepared(input);
  if (count > 128) throw new DiagramError('OODS-FP-008', 'Component containment diagrams are limited to 128 nodes. Use wireframe for larger compositions.');
  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: 'TB', nodesep: 28, ranksep: 54, marginx: 24, marginy: 24 }); graph.setDefaultEdgeLabel(() => ({}));
  const lines = new Map<string, string[]>();
  const visit = (node: UiElement, parent?: string) => {
    const label = [node.component, ...[...authoredText(node), ...bindings(node)].flatMap(field => field.match(/.{1,36}/gu) ?? [])];
    lines.set(node.id, label); graph.setNode(node.id, { width: 310, height: 36 + label.length * 19 });
    if (parent) graph.setEdge(parent, node.id);
    node.children?.forEach(child => visit(child, node.id));
  };
  schema.screens.forEach(node => visit(node)); dagre.layout(graph);
  const width = Math.ceil(graph.graph().width!), height = Math.ceil(graph.graph().height!), id = `tree-${createHash('sha256').update(JSON.stringify(schema)).digest('hex').slice(0, 12)}`;
  const colors = palette(options);
  const title = `Component containment: ${options.title}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="${id}-title ${id}-desc" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="font-family:system-ui,sans-serif;background:${escape(colors.canvas)}"><title id="${id}-title">${escape(title)}</title><desc id="${id}-desc">${count} components. Arrows show parent to child containment in the composed tree, not object relationships.</desc><defs><marker id="${id}-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="${escape(colors.border)}"/></marker></defs>${graph.edges().map((edge: { v: string; w: string }) => `<polyline data-parent="${escape(edge.v)}" data-child="${escape(edge.w)}" points="${graph.edge(edge).points.map((p: { x: number; y: number }) => `${p.x},${p.y}`).join(' ')}" fill="none" stroke="${escape(colors.border)}" stroke-width="2" marker-end="url(#${id}-arrow)"/>`).join('')}${graph.nodes().map((name: string) => { const node = graph.node(name); return `<g data-component-node="${escape(name)}" transform="translate(${node.x - node.width / 2} ${node.y - node.height / 2})"><rect width="${node.width}" height="${node.height}" fill="${escape(colors.subtle)}" stroke="${escape(colors.border)}" rx="4"/><text x="14" y="26" fill="${escape(colors.text)}" font-size="13">${lines.get(name)!.map((line, i) => `<tspan x="14" dy="${i ? 19 : 0}">${escape(line)}</tspan>`).join('')}</text></g>`; }).join('')}</svg>`;
  return { html: document(title, 'Arrows show component containment, not declared object relationships.', `<div class="diagram" role="region" aria-label="Component containment diagram" tabindex="0">${svg}</div><p data-diagram-overflow hidden>Scroll to inspect the full graph.</p>${diagramOverflowScript}`, options), svg, meta: { entityCount: schema.screens.length, componentCount: count, edgeCount: graph.edgeCount(), width, height } };
}
