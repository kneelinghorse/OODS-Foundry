/**
 * E2E coverage for schemaRef passthrough across compose → validate → render → code.generate.
 */
import { describe, it, expect } from 'vitest';
import { handle as composeHandle } from '../../packages/mcp-server/src/tools/design.compose.js';
import { handle as validateHandle } from '../../packages/mcp-server/src/tools/repl.validate.js';
import { handle as renderHandle } from '../../packages/mcp-server/src/tools/repl.render.js';
import { handle as codegenHandle } from '../../packages/mcp-server/src/tools/code.generate.js';
import { validateGeneratedArtifact } from '../../packages/mcp-server/src/codegen/artifact-envelope.js';

const COMPOSE_INPUT: Parameters<typeof composeHandle>[0] = {
  intent: 'Account detail view with tabs for Overview, Billing, Activity, Settings.',
  layout: 'detail',
  preferences: {
    tabCount: 4,
    tabLabels: ['Overview', 'Billing', 'Activity', 'Settings'],
  },
  options: { topN: 1 },
};

function payloadBytes(payload: unknown): number {
  return Buffer.byteLength(JSON.stringify(payload), 'utf8');
}

describe('schemaRef E2E pipeline', () => {
  it('compose → validate → render accepts schemaRef and code.generate preserves target readiness', async () => {
    const compose = await composeHandle(COMPOSE_INPUT);
    expect(compose.status).toBe('ok');
    expect(compose.schemaRef).toBeTruthy();

    const schemaRef = compose.schemaRef!;
    const validation = await validateHandle({ mode: 'full', schemaRef });
    expect(validation.status).toBe('ok');

    const render = await renderHandle({ mode: 'full', schemaRef, apply: true });
    expect(render.status).toBe('ok');
    expect(render.html).toContain('<!DOCTYPE html>');

    const codegen = await codegenHandle({ schemaRef, framework: 'react' });
    expect(codegen.status, JSON.stringify(codegen.errors ?? [])).toBe('ok');
    expect(codegen.fileExtension).toBe('.tsx');
    expect(codegen.imports).toEqual(expect.arrayContaining([
      '@oods/components-react', '@oods/component-styles/css',
    ]));
    expect(codegen.imports).not.toContain('@oods/components-react/ported');
    expect(codegen.imports).not.toContain('@oods/component-styles/css-ported');
    expect(codegen.warnings).toEqual([]);
    expect(codegen.errors).toBeUndefined();
    // The unchanged schemaRef now spans the unified root component surface.
    // Preserve every composed node, including the formerly unavailable header.
    expect(codegen.code).toContain('<DetailHeader ');
    expect(codegen.code).toContain('id="slot-header-2"');
    expect(codegen.code).toContain('<PriceBadge ');
    expect(codegen.code).toContain('<AuditTimeline ');
    expect(codegen.code.match(/data-oods-component=/g)).toHaveLength(15);
    expect(codegen.artifact).toBeDefined();
    expect(codegen.artifact!.files).toHaveLength(1);
    expect(codegen.artifact!.files[0]!.contents).toBe(codegen.code);
    expect(validateGeneratedArtifact(codegen.artifact!)).toEqual([]);
    expect(codegen.validationReceipt.checks).toEqual(expect.arrayContaining([
      'target-readiness', 'normalization-fidelity', 'props-contract', 'dependency-closure',
    ]));
    expect(codegen.meta).toEqual({ nodeCount: 15, componentCount: 6 });
  });

  it('schemaRef payloads are substantially smaller than schema passthrough', async () => {
    const compose = await composeHandle(COMPOSE_INPUT);
    expect(compose.status).toBe('ok');
    expect(compose.schemaRef).toBeTruthy();

    const schemaRef = compose.schemaRef!;
    const schema = compose.schema;

    const schemaPayloads = [
      { mode: 'full', schema },
      { mode: 'full', schema, apply: true },
      { schema, framework: 'react' },
    ];

    const refPayloads = [
      { mode: 'full', schemaRef },
      { mode: 'full', schemaRef, apply: true },
      { schemaRef, framework: 'react' },
    ];

    const schemaBytes = schemaPayloads.reduce((sum, payload) => sum + payloadBytes(payload), 0);
    const refBytes = refPayloads.reduce((sum, payload) => sum + payloadBytes(payload), 0);

    expect(refBytes).toBeLessThan(schemaBytes * 0.2);
  });
});
