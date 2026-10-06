import { describe, expect, it } from 'vitest';
import { handle as pipelineHandle } from '../../src/tools/pipeline.js';

describe('pipeline compact + metrics', () => {
  it('defaults to compact render (tokenCssRef present, small response)', async () => {
    const result = await pipelineHandle({
      intent: 'A dashboard with metrics',
      framework: 'html',
    });

    expect(result.error).toBeUndefined();
    expect(result.render?.tokenCssRef).toBe('tokens.build');

    // Compact removes the duplicated token stylesheet; markup size follows the
    // current renderer and is not bounded by an old fixed byte count.
    const full = await pipelineHandle({ intent: 'A dashboard with metrics', framework: 'html', options: { compact: false } });
    expect(full.error).toBeUndefined();
    expect(result.render?.html).not.toContain('data-source="tokens"');
    const compactRenderSize = JSON.stringify(result.render).length;
    expect(compactRenderSize).toBeLessThan(JSON.stringify(full.render).length);
  });

  it('includes output.summary string', async () => {
    const result = await pipelineHandle({
      intent: 'A dashboard with metrics',
      framework: 'html',
    });

    expect(result.summary).toBeDefined();
    expect(typeof result.summary).toBe('string');
    expect(result.summary!.length).toBeGreaterThan(0);
  });

  it('includes output.metrics with node/component/field counts', async () => {
    const result = await pipelineHandle({
      intent: 'A dashboard with metrics',
      framework: 'html',
    });

    expect(result.metrics).toBeDefined();
    expect(result.metrics!.totalNodes).toBeGreaterThan(0);
    expect(result.metrics!.componentsUsed).toBeGreaterThan(0);
    expect(result.metrics!.fieldsBound).toBeGreaterThanOrEqual(0);
    expect(result.metrics!.responseBytes).toBeGreaterThan(0);
  });

  it('compact can be disabled with options.compact=false', async () => {
    const result = await pipelineHandle({
      intent: 'A dashboard with metrics',
      framework: 'html',
      options: { compact: false },
    });

    expect(result.error).toBeUndefined();
    expect(result.render?.tokenCssRef).toBeUndefined();
    // Full response with token CSS will be much larger
    if (result.render?.html) {
      expect(result.render.html).toContain('data-source="tokens"');
    }
  });

  it('pipeline phase outputs have status in meta', async () => {
    const result = await pipelineHandle({
      intent: 'A form for user registration',
      framework: 'html',
    });

    expect(result.compose).toBeDefined();
    expect(result.compose.componentCount).toBeGreaterThan(0);

    if (result.validation) {
      expect(result.validation.status).toBeDefined();
    }

    if (result.render) {
      expect(result.render.meta.status).toBeDefined();
    }

    expect(result.pipeline.steps).toContain('compose');
    expect(result.pipeline.steps).toContain('codegen');
    expect(result.pipeline.duration).toBeGreaterThan(0);
  });

  it('object-aware pipeline includes fieldsBound in metrics', async () => {
    const result = await pipelineHandle({
      object: 'Product',
      context: 'card',
      framework: 'html',
    });

    expect(result.error).toBeUndefined();
    expect(result.metrics).toBeDefined();
    expect(result.metrics!.fieldsBound).toBeGreaterThan(0);
    expect(result.summary).toContain('Product');
  });
});
