import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { componentRenderers } from '../../src/render/component-map.js';
import { handle as renderHandle } from '../../src/tools/repl.render.js';
import { loadComponentRegistry } from '../../src/tools/repl.utils.js';
import { handle as validateHandle } from '../../src/tools/repl.validate.js';
import type { UiElement, UiSchema } from '../../src/schemas/generated.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const FIXTURE_DIR = path.resolve(__dirname, '../fixtures/ui');
const FIXTURE_FILES = ['basic-mix.ui-schema.json', 'trait-mix.ui-schema.json', 'viz-mix.ui-schema.json'] as const;

function loadFixture(fileName: string): UiSchema {
  const fullPath = path.join(FIXTURE_DIR, fileName);
  return JSON.parse(fs.readFileSync(fullPath, 'utf8')) as UiSchema;
}

function safeNodeId(component: string, index: number): string {
  return `coverage-${index + 1}-${component.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/[^a-zA-Z0-9-]+/g, '-').toLowerCase()}`;
}

function minimalPropsFor(component: string): Record<string, unknown> | undefined {
  switch (component) {
    case 'Button':
      return { label: 'Save' };
    case 'Text':
      return { text: 'Coverage node' };
    case 'Select':
      return { options: [{ value: 'a', label: 'A' }], value: 'a' };
    case 'Table':
      return { columns: [{ key: 'name', label: 'Name' }], rows: [{ name: 'row-1' }] };
    case 'Tabs':
      return { tabs: [{ id: 'tab-1', label: 'Tab 1', content: 'Panel 1', active: true }] };
    case 'RoleBadgeList':
      return { roles: ['admin'] };
    case 'StatusColorLegend':
      return { legend: [{ label: 'Active', color: 'green' }] };
    case 'TagPills':
      return { tags: ['alpha', 'beta'], maxVisible: 1 };
    case 'RelativeTimestamp':
      return { datetime: '2026-02-26T03:00:00Z', relative: 'just now' };
    case 'AuditTimeline':
    case 'AddressValidationTimeline':
    case 'MembershipAuditTimeline':
    case 'MessageEventTimeline':
    case 'PreferenceTimeline':
    case 'StatusTimeline':
      return { events: [{ label: 'Event', timestamp: '2026-02-26T03:00:00Z' }] };
    case 'AuditEvent':
    case 'CancellationEvent':
      return { label: component, timestamp: '2026-02-26T03:00:00Z' };
    // s223-m01 (#2527 ruling 7): an event card with no events renders nothing, so each carries the data its contract reads.
    case 'ArchiveEvent':
      return { label: component, archivedAt: '2026-02-26T03:00:00Z' };
    case 'StateTransitionEvent':
      return { label: component, history: [{ from_state: 'pending', to_state: 'active', transitioned_at: '2026-02-26T03:00:00Z' }] };
    case 'TagInput':
    case 'TagManager':
      return { tags: ['alpha'] };
    case 'VizAreaPreview':
    case 'VizMarkPreview':
    case 'VizLinePreview':
    case 'VizPointPreview':
      return { width: 800, height: 400 };
    case 'VizEncodingBadge':
      return { axis: 'x', field: 'revenue' };
    case 'VizRoleBadge':
      return { role: 'mark' };
    case 'Grid':
      return { columns: 2, gap: 'md' };
    default:
      return undefined;
  }
}

function buildCoverageSchema(componentNames: string[]): UiSchema {
  const children: UiElement[] = componentNames.map((component, index) => {
    const props = minimalPropsFor(component);
    return {
      id: safeNodeId(component, index),
      component,
      ...(props ? { props } : {}),
    };
  });

  return {
    version: '2026.02',
    dsVersion: '2026-02-24',
    theme: 'light',
    screens: [
      {
        id: 'coverage-screen',
        component: 'Stack',
        children,
      },
    ],
  };
}

describe('REPL e2e integration verification', () => {
  it.each(FIXTURE_FILES)('validates and renders fixture %s without fallback', async (fileName) => {
    const schema = loadFixture(fileName);

    const validation = await validateHandle({ mode: 'full', schema });
    expect(validation.status).toBe('ok');
    expect(validation.errors).toHaveLength(0);

    const render = await renderHandle({ mode: 'full', schema, apply: true });
    expect(render.status).toBe('ok');
    expect(render.html).toContain('<!DOCTYPE html>');
    expect(render.html).toContain('<main id="oods-preview-root">');
    expect(render.html).not.toContain('data-oods-fallback="true"');
  });

  it('renders every component with a mapped renderer with no fallback markers', async () => {
    const registry = loadComponentRegistry();
    const componentNames = Object.keys(componentRenderers).sort();
    expect(componentNames.length).toBeGreaterThan(0);
    const missing = componentNames.filter((component) => !registry.names.has(component));
    expect(missing).toHaveLength(0);

    const schema = buildCoverageSchema(componentNames);
    const render = await renderHandle({ mode: 'full', schema, apply: true });

    expect(render.status).toBe('ok');
    expect(render.errors).toHaveLength(0);
    expect(render.html).toContain('<!DOCTYPE html>');
    expect(render.html).not.toContain('data-oods-fallback="true"');

    for (const component of componentNames) {
      expect(render.html).toContain(`data-oods-component="${component}"`);
    }
  });
});
