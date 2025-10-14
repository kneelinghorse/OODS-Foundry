import { describe, expect, it } from 'vitest';
import type { RenderContext } from '../../src/types/render-context.js';
import type { PageHeaderProps } from '../../src/modifiers/withStatusBadge.modifier.js';
import { withStatusBadge } from '../../src/modifiers/withStatusBadge.modifier.js';
import { validateModifierPurity } from '../../src/compositor/tests/purityHarness.js';

type StatusData = { readonly status?: string };

function createRenderContext(data: StatusData): RenderContext<StatusData> {
  return {
    object: {
      id: 'sample-object',
      tokens: {},
    },
    data,
    theme: {
      id: 'default',
      mode: 'light',
      tokens: {},
    },
    permissions: [],
    viewport: {
      width: 1280,
      height: 720,
    },
  };
}

describe('withStatusBadge modifier', () => {
  it('passes the purity harness and returns deterministic badge output', () => {
    const baseProps: PageHeaderProps = {
      badges: [
        {
          id: 'existing-badge',
          label: 'Existing',
          tone: 'neutral',
        },
      ],
    };

    const context = {
      renderContext: createRenderContext({ status: 'active' }),
    };

    const result = validateModifierPurity(withStatusBadge, baseProps, {
      context,
    });

    expect(result.badges).toHaveLength(2);
    const [existing, generated] = result.badges ?? [];

    expect(existing?.id).toBe('existing-badge');
    expect(generated?.id).toBe('status-active');
    expect(generated?.tone).toBe('success');
    expect(generated?.label).toBe('Active');
  });

  it('does not duplicate badges when descriptor already present', () => {
    const props: PageHeaderProps = {
      badges: [
        {
          id: 'status-active',
          label: 'Active',
          tone: 'success',
        },
      ],
    };

    const output = withStatusBadge(props, {
      renderContext: createRenderContext({ status: 'active' }),
    });

    expect(output).toEqual({});
  });

  it('returns empty diff when status is missing or unknown', () => {
    expect(
      withStatusBadge(
        {},
        {
          renderContext: createRenderContext({}),
        }
      )
    ).toEqual({});

    expect(
      withStatusBadge(
        {},
        {
          renderContext: createRenderContext({ status: 'archived' }),
        }
      )
    ).toEqual({});
  });
});
