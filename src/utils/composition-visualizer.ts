/* c8 ignore file */
/**
 * Composition Report Visualizer
 *
 * Provides utilities for visualizing composition results in various formats:
 * - Console-friendly ASCII diagrams
 * - HTML reports
 * - JSON exports
 * - Mermaid diagrams
 */

import type { ComposedObject, CollisionInfo } from '../core/composed-object.js';
import { formatTokenReference } from './token-values.js';

/**
 * Generate an ASCII diagram showing the composition flow
 */
export function generateCompositionFlow(composed: ComposedObject): string {
  const lines: string[] = [];
  const width = 80;

  lines.push('┌' + '─'.repeat(width - 2) + '┐');
  lines.push('│' + ' COMPOSITION FLOW'.padEnd(width - 2) + '│');
  lines.push('├' + '─'.repeat(width - 2) + '┤');

  // Show trait order with arrows
  const traitOrder = composed.metadata.traitOrder;
  if (traitOrder.length > 0) {
    lines.push('│' + ' '.repeat(width - 2) + '│');

    // Build flow diagram
    const flowParts: string[] = [];
    for (let i = 0; i < traitOrder.length; i++) {
      flowParts.push(traitOrder[i]);
      if (i < traitOrder.length - 1) {
        flowParts.push('→');
      }
    }

    const flowText = flowParts.join(' ');
    const padding = Math.max(0, Math.floor((width - 2 - flowText.length) / 2));
    lines.push('│' + ' '.repeat(padding) + flowText + ' '.repeat(width - 2 - padding - flowText.length) + '│');
    lines.push('│' + ' '.repeat(width - 2) + '│');
  }

  lines.push('└' + '─'.repeat(width - 2) + '┘');

  return lines.join('\n');
}

/**
 * Generate a field-by-field provenance table
 */
export function generateProvenanceTable(composed: ComposedObject): string {
  const lines: string[] = [];

  lines.push('┌─────────────────────────┬──────────────┬────────┬───────────┐');
  lines.push('│ Field                   │ Source       │ Layer  │ Override? │');
  lines.push('├─────────────────────────┼──────────────┼────────┼───────────┤');

  const sortedFields = Array.from(composed.metadata.provenance.entries()).sort(
    ([a], [b]) => a.localeCompare(b)
  );

  for (const [fieldName, prov] of sortedFields) {
    const field = fieldName.padEnd(23).substring(0, 23);
    const source = prov.source.padEnd(12).substring(0, 12);
    const layer = prov.layer.padEnd(6).substring(0, 6);
    const override = (prov.overridden ? 'Yes' : 'No').padEnd(9);

    lines.push(`│ ${field} │ ${source} │ ${layer} │ ${override} │`);
  }

  lines.push('└─────────────────────────┴──────────────┴────────┴───────────┘');

  return lines.join('\n');
}

/**
 * Generate a collision resolution table
 */
export function generateCollisionTable(collisions: CollisionInfo[]): string {
  if (collisions.length === 0) {
    return 'No collisions detected.';
  }

  const lines: string[] = [];

  lines.push('┌─────────────────┬──────────────────────┬──────────────┬──────────┐');
  lines.push('│ Field           │ Conflicting Traits   │ Resolution   │ Winner   │');
  lines.push('├─────────────────┼──────────────────────┼──────────────┼──────────┤');

  for (const collision of collisions) {
    const field = collision.fieldName.padEnd(15).substring(0, 15);
    const traits = collision.conflictingTraits.join(', ').padEnd(20).substring(0, 20);
    const resolution = collision.resolution.padEnd(12).substring(0, 12);
    const winner = collision.winner.padEnd(8).substring(0, 8);

    lines.push(`│ ${field} │ ${traits} │ ${resolution} │ ${winner} │`);
  }

  lines.push('└─────────────────┴──────────────────────┴──────────────┴──────────┘');

  return lines.join('\n');
}

/**
 * Generate a view extensions summary by context
 */
export function generateViewExtensionsTable(composed: ComposedObject): string {
  const lines: string[] = [];

  lines.push('┌──────────────┬──────────────────────┬──────────┐');
  lines.push('│ Context      │ Component            │ Priority │');
  lines.push('├──────────────┼──────────────────────┼──────────┤');

  const contexts = Object.keys(composed.viewExtensions).sort();

  for (const context of contexts) {
    const extensions = composed.viewExtensions[context];
    if (!extensions || extensions.length === 0) continue;

    for (let i = 0; i < extensions.length; i++) {
      const ext = extensions[i];
      const contextStr = (i === 0 ? context : '').padEnd(12).substring(0, 12);
      const component = ext.component?.padEnd(20).substring(0, 20) || '';
      const priority = String(ext.priority ?? 50).padStart(8);

      lines.push(`│ ${contextStr} │ ${component} │ ${priority} │`);
    }

    if (extensions.length > 0) {
      lines.push('├──────────────┼──────────────────────┼──────────┤');
    }
  }

  // Remove last separator
  if (lines[lines.length - 1].startsWith('├')) {
    lines.pop();
  }

  lines.push('└──────────────┴──────────────────────┴──────────┘');

  return lines.join('\n');
}

/**
 * Generate a Mermaid diagram of the composition
 */
export function generateMermaidDiagram(composed: ComposedObject): string {
  const lines: string[] = [];

  lines.push('```mermaid');
  lines.push('graph TD');
  lines.push('');

  // Base object node
  lines.push(`  BASE[${composed.name} Base]`);
  lines.push('');

  // Trait nodes
  for (const trait of composed.traits) {
    const traitName = trait.trait.name;
    const fieldCount = Object.keys(trait.schema || {}).length;
    lines.push(`  ${traitName}["${traitName}<br/>(${fieldCount} fields)"]`);
  }
  lines.push('');

  // Dependencies
  for (const trait of composed.traits) {
    const traitName = trait.trait.name;

    if (trait.dependencies && trait.dependencies.length > 0) {
      for (const dep of trait.dependencies) {
        const depName = typeof dep === 'string' ? dep : dep.trait;
        lines.push(`  ${depName} --> ${traitName}`);
      }
    }
  }
  lines.push('');

  // Composition flow
  lines.push(`  BASE --> COMPOSED[${composed.name}<br/>Composed Object]`);
  for (const traitName of composed.metadata.traitOrder) {
    lines.push(`  ${traitName} --> COMPOSED`);
  }

  lines.push('```');

  return lines.join('\n');
}

/**
 * Export composition data as JSON
 */
export function exportAsJSON(composed: ComposedObject): string {
  const exportData = {
    id: composed.id,
    name: composed.name,
    traits: composed.metadata.traitOrder,
    schema: composed.schema,
    semantics: composed.semantics,
    tokens: composed.tokens,
    actions: composed.actions.map((a) => ({ name: a.name, label: a.label })),
    viewExtensions: Object.fromEntries(
      Object.entries(composed.viewExtensions).map(([context, exts]) => [
        context,
        exts?.map((e) => ({ component: e.component, priority: e.priority })),
      ])
    ),
    metadata: {
      composedAt: composed.metadata.composedAt.toISOString(),
      traitCount: composed.metadata.traitCount,
      collisions: composed.metadata.collisions.length,
      warnings: composed.metadata.warnings.length,
      performance: composed.metadata.performance,
    },
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Generate an HTML report
 */
export function generateHTMLReport(composed: ComposedObject): string {
  const palette = {
    surfacePanel: formatTokenReference('sys.surface.raised', '--cmp-surface-panel', 'Canvas'),
    surfaceSubtle: formatTokenReference('sys.surface.subtle', '--cmp-surface-subtle', 'Canvas'),
    textBody: formatTokenReference('sys.text.primary', '--cmp-text-body', 'CanvasText'),
    textMuted: formatTokenReference('sys.text.muted', '--cmp-text-muted', 'GrayText'),
    textAccent: formatTokenReference('sys.text.accent', '--cmp-text-accent', 'CanvasText'),
    borderDefault: formatTokenReference('sys.border.subtle', '--cmp-border-default', 'CanvasText'),
    borderInfo: formatTokenReference('sys.status.info.border', '--cmp-status-info-border', 'CanvasText'),
    borderStrong: formatTokenReference('sys.border.strong', '--cmp-border-strong', 'CanvasText'),
    badgeSuccessSurface: formatTokenReference('sys.status.success.surface', '--cmp-status-success-surface', 'Canvas'),
    badgeSuccessText: formatTokenReference('sys.status.success.text', '--cmp-status-success-text', 'CanvasText'),
    badgeWarningSurface: formatTokenReference('sys.status.warning.surface', '--cmp-status-warning-surface', 'Canvas'),
    badgeWarningText: formatTokenReference('sys.status.warning.text', '--cmp-status-warning-text', 'CanvasText'),
    badgeInfoSurface: formatTokenReference('sys.status.info.surface', '--cmp-status-info-surface', 'Canvas'),
    badgeInfoText: formatTokenReference('sys.status.info.text', '--cmp-status-info-text', 'CanvasText'),
    shadowCard: formatTokenReference(
      'sys.shadow.elevation.card',
      '--sys-shadow-elevation-card',
      '0 18px 36px color-mix(in srgb, var(--cmp-text-body, CanvasText) 16%, transparent)'
    ),
    flowArrow: formatTokenReference('sys.status.info.text', '--cmp-status-info-text', 'CanvasText')
  };

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Composition Report: ${composed.name}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
      background: ${palette.surfaceSubtle};
      color: ${palette.textBody};
    }
    .header {
      background: ${palette.surfacePanel};
      padding: 2rem;
      border-radius: 8px;
      margin-bottom: 2rem;
      box-shadow: ${palette.shadowCard};
    }
    h1 { margin: 0 0 0.5rem 0; }
    .meta { color: ${palette.textMuted}; font-size: 0.9rem; }
    .section {
      background: ${palette.surfacePanel};
      padding: 1.5rem;
      border-radius: 8px;
      margin-bottom: 1.5rem;
      box-shadow: ${palette.shadowCard};
    }
    .section h2 {
      margin-top: 0;
      border-bottom: 2px solid ${palette.borderInfo};
      padding-bottom: 0.5rem;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      padding: 0.75rem;
      text-align: left;
      border-bottom: 1px solid ${palette.borderDefault};
    }
    th {
      background: ${palette.surfaceSubtle};
      font-weight: 600;
    }
    .badge {
      display: inline-block;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.85rem;
      font-weight: 500;
    }
    .badge-success { background: ${palette.badgeSuccessSurface}; color: ${palette.badgeSuccessText}; }
    .badge-warning { background: ${palette.badgeWarningSurface}; color: ${palette.badgeWarningText}; }
    .badge-info { background: ${palette.badgeInfoSurface}; color: ${palette.badgeInfoText}; }
    .flow {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem;
      background: ${palette.surfaceSubtle};
      border-radius: 4px;
      overflow-x: auto;
    }
    .flow-item {
      padding: 0.5rem 1rem;
      background: ${palette.surfacePanel};
      border: 2px solid ${palette.borderInfo};
      border-radius: 4px;
      white-space: nowrap;
    }
    .flow-arrow { color: ${palette.flowArrow}; font-size: 1.5rem; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🎨 ${composed.name}</h1>
    <div class="meta">
      Composed at: ${composed.metadata.composedAt.toISOString()} |
      Traits: ${composed.metadata.traitCount} |
      Fields: ${Object.keys(composed.schema).length}
    </div>
  </div>

  <div class="section">
    <h2>Composition Flow</h2>
    <div class="flow">
      ${composed.metadata.traitOrder
        .map((t) => `<div class="flow-item">${t}</div>`)
        .join('<div class="flow-arrow">→</div>')}
    </div>
  </div>

  <div class="section">
    <h2>Schema (${Object.keys(composed.schema).length} fields)</h2>
    <table>
      <thead>
        <tr>
          <th>Field</th>
          <th>Type</th>
          <th>Required</th>
          <th>Source</th>
        </tr>
      </thead>
      <tbody>
        ${Object.entries(composed.schema)
          .map(([name, field]) => {
            const prov = composed.metadata.provenance.get(name);
            return `
            <tr>
              <td><code>${name}</code></td>
              <td>${field.type}</td>
              <td>${field.required ? '<span class="badge badge-warning">Required</span>' : '<span class="badge badge-info">Optional</span>'}</td>
              <td>${prov ? prov.source : 'Base'}</td>
            </tr>
          `;
          })
          .join('')}
      </tbody>
    </table>
  </div>

  ${
    composed.metadata.collisions.length > 0
      ? `
  <div class="section">
    <h2>Collisions (${composed.metadata.collisions.length})</h2>
    <table>
      <thead>
        <tr>
          <th>Field</th>
          <th>Conflicting Traits</th>
          <th>Resolution</th>
          <th>Winner</th>
        </tr>
      </thead>
      <tbody>
        ${composed.metadata.collisions
          .map(
            (c) => `
          <tr>
            <td><code>${c.fieldName}</code></td>
            <td>${c.conflictingTraits.join(', ')}</td>
            <td><span class="badge badge-info">${c.resolution}</span></td>
            <td>${c.winner}</td>
          </tr>
        `
          )
          .join('')}
      </tbody>
    </table>
  </div>
  `
      : ''
  }

  ${
    composed.actions.length > 0
      ? `
  <div class="section">
    <h2>Actions (${composed.actions.length})</h2>
    <ul>
      ${composed.actions.map((a) => `<li><strong>${a.name}</strong>: ${a.label || '(no label)'}</li>`).join('')}
    </ul>
  </div>
  `
      : ''
  }

  ${
    composed.metadata.performance
      ? `
  <div class="section">
    <h2>Performance</h2>
    <ul>
      <li>Duration: ${composed.metadata.performance.durationMs}ms</li>
      <li>Fields Processed: ${composed.metadata.performance.fieldsProcessed}</li>
      <li>View Extensions: ${composed.metadata.performance.viewExtensionsProcessed}</li>
    </ul>
  </div>
  `
      : ''
  }
</body>
</html>
  `.trim();

  return html;
}

/**
 * Generate a comprehensive visualization with all formats
 */
export function generateFullVisualization(composed: ComposedObject): {
  ascii: {
    flow: string;
    provenance: string;
    collisions: string;
    viewExtensions: string;
  };
  mermaid: string;
  json: string;
  html: string;
} {
  return {
    ascii: {
      flow: generateCompositionFlow(composed),
      provenance: generateProvenanceTable(composed),
      collisions: generateCollisionTable(composed.metadata.collisions),
      viewExtensions: generateViewExtensionsTable(composed),
    },
    mermaid: generateMermaidDiagram(composed),
    json: exportAsJSON(composed),
    html: generateHTMLReport(composed),
  };
}
