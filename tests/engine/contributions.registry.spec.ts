import { afterEach, describe, expect, it } from 'vitest';
import {
  clearContributions,
  collectContributionExtensions,
  registerContribution,
} from '../../src/engine/contributions/index.js';
import { buildRenderContext } from '../../src/context/buildRenderContext.js';
import type { ObjectSpec, TraitAdapter } from '../../src/types/render-context.js';

interface TestData {
  readonly status?: string;
}

const baseTrait: TraitAdapter<TestData> = Object.freeze({
  id: 'test-trait',
  view: () => [],
});

const objectSpec: ObjectSpec<TestData> = Object.freeze({
  id: 'object',
  traits: [baseTrait],
});

afterEach(() => {
  clearContributions();
});

describe('collectContributionExtensions', () => {
  it('preserves registration order for equal priorities so stable sorts remain deterministic', () => {
    registerContribution<TestData>({
      id: 'first',
      traitId: baseTrait.id,
      context: 'detail',
      region: 'pageHeader',
      priority: 30,
      render: () => null,
    });
    registerContribution<TestData>({
      id: 'second',
      traitId: baseTrait.id,
      context: 'detail',
      region: 'pageHeader',
      priority: 30,
      render: () => null,
    });
    registerContribution<TestData>({
      id: 'third',
      traitId: baseTrait.id,
      context: 'detail',
      region: 'pageHeader',
      priority: 20,
      render: () => null,
    });

    const renderContext = buildRenderContext<TestData>({ object: objectSpec, data: {} });
    const extensions = collectContributionExtensions<TestData>({
      object: objectSpec,
      context: 'detail',
      renderContext,
    });

    expect(extensions.map((ext) => ext.id)).toEqual(['first', 'second', 'third']);
    expect(extensions.map((ext) => ext.priority)).toEqual([30, 30, 20]);
  });

  it('applies when() predicates and augments metadata tags with contribution marker', () => {
    registerContribution<TestData>({
      id: 'eligible',
      traitId: baseTrait.id,
      context: 'detail',
      region: 'viewToolbar',
      metadata: { tags: ['toolbar', 'contribution'], note: 'existing' },
      when: ({ renderContext }) => Boolean(renderContext.data.status),
      render: () => 'toolbar',
    });

    registerContribution<TestData>({
      id: 'skipped',
      traitId: baseTrait.id,
      context: 'detail',
      region: 'viewToolbar',
      metadata: { tags: ['skipped'] },
      when: () => false,
      render: () => 'ignored',
    });

    const renderContext = buildRenderContext<TestData>({
      object: objectSpec,
      data: { status: 'active' },
    });

    const extensions = collectContributionExtensions<TestData>({
      object: objectSpec,
      context: 'detail',
      renderContext,
    });

    expect(extensions).toHaveLength(1);
    const [extension] = extensions;
    expect(extension.id).toBe('eligible');
    expect(extension.metadata?.sourceTrait).toBe(baseTrait.id);
    expect(extension.metadata?.tags).toEqual(['toolbar', 'contribution']);
  });

  it('supports mixed context registrations and retains per-region metadata', () => {
    registerContribution<TestData>({
      id: 'detail-context',
      traitId: baseTrait.id,
      context: ['detail', 'list'],
      region: 'pageHeader',
      priority: 10,
      render: () => 'detail header',
    });

    registerContribution<TestData>({
      id: 'timeline-only',
      traitId: baseTrait.id,
      context: 'timeline',
      region: 'main',
      priority: 60,
      metadata: { tags: ['timeline'] },
      render: () => 'timeline',
    });

    const detailContext = buildRenderContext<TestData>({ object: objectSpec, data: {} });
    const detailExtensions = collectContributionExtensions<TestData>({
      object: objectSpec,
      context: 'detail',
      renderContext: detailContext,
    });
    expect(detailExtensions.map((ext) => ext.id)).toEqual(['detail-context']);

    const timelineContext = buildRenderContext<TestData>({ object: objectSpec, data: {} });
    const timelineExtensions = collectContributionExtensions<TestData>({
      object: objectSpec,
      context: 'timeline',
      renderContext: timelineContext,
    });
    expect(timelineExtensions.map((ext) => ext.id)).toEqual(['timeline-only']);
    expect(timelineExtensions[0]?.metadata?.tags).toEqual(['timeline', 'contribution']);
    expect(timelineExtensions[0]?.region).toBe('main');
  });
});
