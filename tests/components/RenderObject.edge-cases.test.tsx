import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RenderObject } from '../../src/components/RenderObject.js';
import type { ObjectSpec, TraitAdapter } from '../../src/types/render-context.js';

interface DemoData {
  readonly id: string;
  readonly label?: string;
}

function createSafeTrait(): TraitAdapter<DemoData> {
  return {
    id: 'SafeTrait',
    view: () => [
      {
        id: 'safe-section',
        region: 'main',
        type: 'section',
        render: ({ data }) => <div data-safe-section>{data.label ?? 'fallback'}</div>,
      },
    ],
  };
}

function createFailingTrait(message: string): TraitAdapter<DemoData> {
  return {
    id: 'FailingTrait',
    view: () => {
      throw new Error(message);
    },
  };
}

function createNullableTrait(): TraitAdapter<DemoData | null> {
  return {
    id: 'NullableSafeTrait',
    view: () => [
      {
        id: 'nullable-safe-section',
        region: 'main',
        type: 'section',
        render: ({ data }) => (
          <div data-safe-section>{data && 'label' in data ? data.label : 'loading…'}</div>
        ),
      },
    ],
  };
}

describe('<RenderObject> edge cases', () => {
  it('renders without throwing when the object has no traits', () => {
    const object: ObjectSpec<DemoData> = {
      id: 'object:none',
      name: 'EmptyObject',
      traits: [],
    };

    const render = () =>
      renderToStaticMarkup(
        <RenderObject object={object} context="detail" data={{ id: 'demo-1' }} />
      );

    expect(render).not.toThrow();
  });

  it('continues rendering when a trait view throws and debug is disabled', () => {
    const object: ObjectSpec<DemoData> = {
      id: 'object:resilient',
      traits: [createFailingTrait('trait boom'), createSafeTrait()],
    };

    const markup = renderToStaticMarkup(
      <RenderObject object={object} context="detail" data={{ id: 'demo-2', label: 'safe' }} />
    );

    expect(markup).toContain('data-safe-section');
    expect(markup).toContain('safe');
  });

  it('renders gracefully when provided null data to simulate a loading state', () => {
    const object: ObjectSpec<DemoData | null> = {
      id: 'object:loading',
      traits: [createNullableTrait()],
    };

    const render = () =>
      renderToStaticMarkup(
        <RenderObject object={object} context="detail" data={null} />
      );

    expect(render).not.toThrow();
  });

  it('logs trait view errors when debug is enabled', () => {
    const object: ObjectSpec<DemoData> = {
      id: 'object:debug',
      traits: [createFailingTrait('expected failure'), createSafeTrait()],
    };

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const consoleGroup = vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {});
    const consoleGroupEnd = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});

    try {
      const render = () =>
        renderToStaticMarkup(
          <RenderObject
            object={object}
            context="detail"
            data={{ id: 'demo-3', label: 'safe' }}
            debug
          />
        );

      expect(render).not.toThrow();
      expect(consoleError).toHaveBeenCalled();
      expect(consoleGroup).toHaveBeenCalled();
      expect(consoleGroupEnd).toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
      consoleGroup.mockRestore();
      consoleGroupEnd.mockRestore();
    }
  });
});
