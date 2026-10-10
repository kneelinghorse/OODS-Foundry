import { createHash } from 'node:crypto';
import dagre from '@dagrejs/dagre';
import { resolveTokenToColor } from '@oods/viz-core';
import { knownBrands } from '../lib/brand-registry.js';
import { listObjects, loadObject } from '../objects/object-loader.js';
import { recordTitleField } from '../compose/record-label.js';
import { composeObject, viewStateFields } from '../objects/trait-composer.js';
import { relationshipProblems } from '../objects/relationships.js';
import type { ObjectDefinition, ObjectRelationship } from '../objects/types.js';
import { escapeHtml as escape } from '../render/escape-html.js';

export type DiagramOptions = { depth?: number; brandOverlay?: string; theme?: 'light' | 'dark' | 'hc'; includeStyles?: boolean };
export class DiagramError extends Error {
  constructor(public code: string, message: string) { super(message); }
}
/** Both relationship and containment drawings can fit on desktop and overflow on a phone. */
export const diagramOverflowScript = `<script>(()=>{const region=document.querySelector('.diagram'),notice=document.querySelector('[data-diagram-overflow]');if(!region||!notice)return;const update=()=>{notice.hidden=region.scrollWidth<=region.clientWidth;};update();new ResizeObserver(update).observe(region);})();</script>`;
const fail = (message: string): never => { throw new DiagramError('OODS-FP-006', message); };
const wrap = (text: string, limit = 38): string[] => {
  const lines: string[] = [];
  for (const word of text.split(/\s+/)) {
    if (!word) continue;
    if (word.length > limit) { lines.push(...word.match(new RegExp(`.{1,${limit}}`, 'gu'))!); continue; }
    const last = lines.length - 1;
    if (last >= 0 && lines[last]!.length + word.length < limit) lines[last] += ` ${word}`;
    else lines.push(word);
  }
  return lines;
};

/** Declared type associations; no records are joined and no *_id heuristic creates edges. */
export function relationshipDiagram(source: { object?: string; objects?: string[] }, options: DiagramOptions = {}) {
  const depth = options.depth ?? 1, theme = options.theme ?? 'light', requestedBrand = options.brandOverlay ?? 'A';
  const brand = knownBrands().find(id => id === requestedBrand || `brand-${id.toLowerCase()}` === requestedBrand);
  if (!brand) fail(`Unknown built brand "${requestedBrand}". Available: ${knownBrands().join(', ')}.`);
  if (!['light', 'dark', 'hc'].includes(theme)) fail('theme must be light, dark or hc.');
  if (!Number.isInteger(depth) || depth < 0 || depth > 3) fail('depth must be a whole number from 0 through 3.');
  if (Boolean(source.object) === Boolean(source.objects)) fail('Provide exactly one object or objects set for a relationship diagram.');
  const roots = source.objects ?? [source.object!];
  if (!Array.isArray(roots) || !roots.length || roots.length > 32 || roots.some(name => typeof name !== 'string' || !name.trim())) fail('objects must contain 1–32 registered object names.');
  const available = listObjects(), definitions = new Map<string, ObjectDefinition>(), shapes = new Map<string, ReturnType<typeof composeObject>>();
  const expanded = new Map<string, number>();
  const visit = (name: string, remaining: number) => {
    if ((expanded.get(name) ?? -1) >= remaining) return;
    expanded.set(name, remaining);
    if (!available.includes(name)) fail(`Object "${name}" not found. Available: ${available.join(', ')}.`);
    if (!definitions.has(name)) {
      if (definitions.size >= 48) fail('The relationship diagram exceeds 48 objects. Reduce depth or choose an explicit set.');
      const definition = loadObject(name), shape = composeObject(definition);
      const problems = relationshipProblems(definition.relationships, name, shape.schema, available);
      if (problems.length) throw new DiagramError('OODS-FP-007', problems.map(problem => `${name}.${problem.path}: ${problem.message}`).join(' '));
      definitions.set(name, definition); shapes.set(name, shape);
    }
    if (remaining > 0) for (const relation of definitions.get(name)!.relationships ?? []) visit(relation.target, remaining - 1);
  };
  for (const name of [...new Set(roots)].sort()) visit(name, source.objects ? 0 : depth);
  const names = [...definitions.keys()].sort();
  const edges: Array<ObjectRelationship & { source: string }> = names.flatMap(name => (definitions.get(name)!.relationships ?? []).filter(relation => definitions.has(relation.target)).map(relation => ({ source: name, ...relation }))).sort((a, b) => `${a.source}/${a.target}/${a.via}`.localeCompare(`${b.source}/${b.target}/${b.via}`));
  if (edges.length > 128) fail('The relationship diagram exceeds 128 edges. Reduce depth or choose a smaller set.');
  const graph = new dagre.graphlib.Graph({ multigraph: true });
  graph.setGraph({ rankdir: 'TB', ranksep: 70, nodesep: 44, edgesep: 28, marginx: 32, marginy: 32 });
  graph.setDefaultEdgeLabel(() => ({}));
  const nodeLines = new Map<string, string[]>();
  for (const name of names) {
    const shape = shapes.get(name)!, definition = definitions.get(name)!;
    const viewState = viewStateFields(definition, shape);
    const own = new Set(Object.keys(definition.schema));
    const idField = Object.keys(definition.schema).find(field => field === 'id' || field === `${name.toLowerCase()}_id`);
    const titleField = recordTitleField(name, Object.fromEntries(Object.entries(shape.schema).map(([field, entry]) => [field, { type: entry.type, required: entry.required, semanticType: shape.semantics[field]?.semantic_type, enum: entry.validation?.enum }])), idField ?? '');
    const via = new Set((definitions.get(name)!.relationships ?? []).map(relation => relation.via));
    const priority = (field: string) => field === idField ? 5 : field === titleField ? 4 : via.has(field) ? 3 : own.has(field) ? 2 : 1;
    const fields = Object.entries(shape.schema).filter(([field, entry]) => !viewState.has(field) && !entry.unavailable).sort(([a, av], [b, bv]) => priority(b) - priority(a) || Number(bv.required) - Number(av.required) || a.localeCompare(b));
    const lines = [
      ...wrap(`Traits: ${shape.traits.map(trait => trait.ref.name.split('/').pop()).join(', ') || 'None'}`),
      `Key fields (${Math.min(6, fields.length)} of ${fields.length})`,
      ...fields.slice(0, 6).flatMap(([field, entry]) => wrap(`${field}: ${entry.type}${entry.required ? ' *' : ''}`)),
    ];
    nodeLines.set(name, lines);
    graph.setNode(name, { width: 340, height: 68 + lines.length * 19 });
  }
  edges.forEach((edge, index) => {
    const lines = [...wrap(edge.label, 30), edge.cardinality, ...wrap(`via ${edge.via}`, 30)];
    graph.setEdge(edge.source, edge.target, { width: Math.max(...lines.map(line => line.length)) * 7.5 + 20, height: lines.length * 18 + 12, lines }, String(index));
  });
  dagre.layout(graph);
  const scope = { brand, theme };
  const color = (token: string) => { const value = resolveTokenToColor(token, scope); if (!value) fail(`Built ${brand}/${theme} token ${token} is missing.`); return escape(value!); };
  const palette = { canvas: color('--sys-surface-canvas'), surface: color('--sys-surface-raised'), text: color('--sys-text-primary'), border: color('--sys-border-strong'), accent: color('--sys-text-accent') };
  const id = `relationships-${createHash('sha256').update(JSON.stringify([names, edges, brand, theme])).digest('hex').slice(0, 12)}`;
  const width = Math.ceil(graph.graph().width!), height = Math.ceil(graph.graph().height!);
  const title = `Relationships: ${roots.join(', ')}`;
  const description = `${names.length} object ${names.length === 1 ? 'type' : 'types'} and ${edges.length} declared ${edges.length === 1 ? 'association' : 'associations'}. Arrows point from source to target. Labels state source-relative cardinality and the via field; they do not assert live referential integrity. ${edges.map(edge => `${edge.source} to ${edge.target}: ${edge.label}, ${edge.cardinality}, via ${edge.via}.`).join(' ')}`;
  const text = (lines: string[], x: number, y: number, size = 13) => `<text x="${x}" y="${y}" fill="${palette.text}" font-size="${size}">${lines.map((line, i) => `<tspan x="${x}" dy="${i ? 19 : 0}">${escape(line)}</tspan>`).join('')}</text>`;
  const edgeMarkup = edges.map((edge, index) => {
    const placed = graph.edge({ v: edge.source, w: edge.target, name: String(index) });
    // Dagre reserves a right-hand label slot for TB self edges, but 3.1.1's self-edge
    // points do not return to the node. Route the loop through that reserved slot.
    if (edge.source === edge.target) {
      const node = graph.node(edge.source), right = node.x + node.width / 2;
      const outer = placed.x + placed.width / 2 + 16;
      const top = node.y - node.height / 4, bottom = node.y + node.height / 4;
      placed.points = [{ x: right, y: top }, { x: outer, y: top }, { x: outer, y: bottom }, { x: right, y: bottom }];
    }
    const points = placed.points.map((point: { x: number; y: number }) => `${point.x},${point.y}`).join(' ');
    return `<g data-relationship-source="${escape(edge.source)}" data-relationship-target="${escape(edge.target)}" data-via="${escape(edge.via)}"><polyline points="${points}" fill="none" stroke="${palette.accent}" stroke-width="2" marker-end="url(#${id}-arrow)"/><rect x="${placed.x - placed.width / 2}" y="${placed.y - placed.height / 2}" width="${placed.width}" height="${placed.height}" rx="4" fill="${palette.canvas}"/>${text(placed.lines, placed.x - placed.width / 2 + 10, placed.y - placed.height / 2 + 18)}</g>`;
  }).join('');
  const nodes = names.map(name => { const node = graph.node(name), x = node.x - node.width / 2, y = node.y - node.height / 2;
    return `<g data-object="${escape(name)}" transform="translate(${x} ${y})"><title>${escape(definitions.get(name)!.object.description)}</title><rect width="${node.width}" height="${node.height}" rx="10" fill="${palette.surface}" stroke="${palette.border}" stroke-width="2"/>${text([name], 18, 30, 18)}<path d="M 18 43 H 322" stroke="${palette.border}"/>${text(nodeLines.get(name)!, 18, 65)}</g>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="${id}-title ${id}-desc" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="font-family:system-ui,sans-serif;background:${palette.canvas};forced-color-adjust:none"><title id="${id}-title">${escape(title)}</title><desc id="${id}-desc">${escape(description)}</desc><defs><marker id="${id}-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${palette.accent}"/></marker></defs>${edgeMarkup}${nodes}</svg>`;
  const html = `<!doctype html><html lang="en"${theme === 'dark' ? ' class="dark"' : ''} data-brand="${escape(brand!)}" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><style>body{margin:0;padding:24px;font-family:system-ui,sans-serif;background:${palette.canvas};color:${palette.text};}h1{font-size:24px;margin:0 0 8px}p{max-width:80ch}.diagram{max-width:100%;overflow:auto;border:1px solid ${palette.border};border-radius:12px}.diagram:focus-visible{outline:3px solid ${palette.accent}}svg{display:block}</style></head><body><h1>${escape(title)}</h1><p>Declared object associations · ${edges.length} ${edges.length === 1 ? 'edge' : 'edges'} · * required field. These are object types, not joined records. <span data-diagram-overflow hidden>Scroll the diagram to inspect it.</span></p><div class="diagram" role="region" aria-label="Relationship diagram" tabindex="0">${svg}</div>${diagramOverflowScript}</body></html>`;
  return { html: options.includeStyles === false ? html.replace(/<style>[\s\S]*?<\/style>/, '') : html, svg, meta: { entityCount: names.length, edgeCount: edges.length, appliedBrandOverlay: brand!, theme, width, height }, objects: names, edges };
}
