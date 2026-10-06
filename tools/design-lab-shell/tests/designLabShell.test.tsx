import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { DesignLabShell } from '../src/components/DesignLabShell.js';
import { sampleSchema } from '../src/sampleSchema.js';
import type { RenderRequest, RenderResponse } from '../src/rendererClient.js';
import * as agentWorkflow from '../src/agentWorkflow.js';
import * as rendererClient from '../src/rendererClient.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DesignLabShell', () => {
  it('renders three panes and surfaces renderer preview data', async () => {
    const okRenderer = vi.fn<[RenderRequest], Promise<RenderResponse>>().mockResolvedValue({
      status: 'ok',
      output: {
        status: 'ok',
        mode: 'full',
        dslVersion: '2025.11',
        registryVersion: '2025-11-22',
        errors: [],
        warnings: [],
        preview: {
          screens: ['audit-screen'],
          routes: ['main'],
          activeScreen: 'audit-screen',
          summary: 'Render ready for 1 screen'
        },
        renderedTree: sampleSchema
      }
    });

    render(<DesignLabShell schema={sampleSchema} renderer={okRenderer} />);

    expect(screen.getByTestId('pane-chat')).toBeInTheDocument();
    expect(screen.getByTestId('pane-json')).toBeInTheDocument();
    expect(screen.getByTestId('pane-preview')).toBeInTheDocument();

    await waitFor(() => expect(screen.getByTestId('preview-summary')).toHaveTextContent(/render ready/i));
    expect(screen.getByTestId('json-view')).toHaveTextContent('audit-screen');
    expect(screen.getByTestId('preview-screens')).toHaveTextContent('audit-screen');
    expect(okRenderer).toHaveBeenCalledWith(expect.objectContaining({ schema: sampleSchema }));
  });

  it('supports editing and applies full schema updates with history and diff', async () => {
    const updatedSchema = {
      ...sampleSchema,
      screens: [{ ...(sampleSchema.screens?.[0] || {}), id: 'updated-screen' }]
    };
    const renderer = vi
      .fn<[RenderRequest], Promise<RenderResponse>>()
      .mockResolvedValueOnce({
        status: 'ok',
        output: {
          status: 'ok',
          mode: 'full',
          dslVersion: '1.0.0',
          errors: [],
          warnings: [],
          preview: { summary: 'Initial', screens: ['audit-screen'] },
          renderedTree: sampleSchema
        }
      })
      .mockResolvedValueOnce({
        status: 'ok',
        output: {
          status: 'ok',
          mode: 'full',
          dslVersion: '1.0.0',
          errors: [],
          warnings: [],
          preview: { summary: 'Updated', screens: ['updated-screen'] },
          renderedTree: updatedSchema
        }
      });

    render(<DesignLabShell schema={sampleSchema} renderer={renderer} />);
    await waitFor(() => expect(renderer).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByTestId('json-editor'), {
      target: { value: JSON.stringify(updatedSchema, null, 2) }
    });
    fireEvent.click(screen.getByTestId('apply-json'));

    await waitFor(() => expect(renderer).toHaveBeenCalledTimes(2));
    const secondCall = renderer.mock.calls[1][0];
    expect(secondCall.schema?.screens?.[0]?.id).toBe('updated-screen');

    await waitFor(() => expect(screen.getByTestId('history-list')).toHaveTextContent('v2'));
    expect(screen.getByTestId('diff-summary')).toHaveTextContent('/screens/0/id');
  });

  it('applies patch updates using the current base tree and records diffs', async () => {
    const patchedTree = {
      ...sampleSchema,
      screens: [{ ...(sampleSchema.screens?.[0] || {}), component: 'UpdatedComponent' }]
    };
    const renderer = vi
      .fn<[RenderRequest], Promise<RenderResponse>>()
      .mockResolvedValueOnce({
        status: 'ok',
        output: {
          status: 'ok',
          mode: 'full',
          dslVersion: '1.0.0',
          errors: [],
          warnings: [],
          preview: { summary: 'Initial', screens: ['audit-screen'] },
          renderedTree: sampleSchema
        }
      })
      .mockResolvedValueOnce({
        status: 'ok',
        output: {
          status: 'ok',
          mode: 'patch',
          dslVersion: '1.0.0',
          errors: [],
          warnings: [],
          preview: { summary: 'Patched', screens: ['audit-screen'] },
          renderedTree: patchedTree
        }
      });

    render(<DesignLabShell schema={sampleSchema} renderer={renderer} />);
    await waitFor(() => expect(renderer).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByTestId('mode-patch'));
    fireEvent.change(screen.getByTestId('patch-editor'), {
      target: {
        value: '[{"op":"replace","path":"/screens/0/component","value":"UpdatedComponent"}]'
      }
    });
    fireEvent.click(screen.getByTestId('apply-json'));

    await waitFor(() => expect(renderer).toHaveBeenCalledTimes(2));
    const call = renderer.mock.calls[1][0];
    expect(call.mode).toBe('patch');
    expect(Array.isArray(call.patch)).toBe(true);
    expect(call.baseTree).toBeDefined();

    await waitFor(() => expect(screen.getByTestId('diff-summary')).toHaveTextContent('/screens/0/component'));
  });

  it('shows validation feedback for parse errors', async () => {
    const renderer = vi.fn<[RenderRequest], Promise<RenderResponse>>().mockResolvedValue({
      status: 'ok',
      output: { status: 'ok', mode: 'full', dslVersion: '0.0.0', errors: [], warnings: [], renderedTree: sampleSchema }
    });

    render(<DesignLabShell schema={sampleSchema} renderer={renderer} />);
    await waitFor(() => expect(renderer).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByTestId('json-editor'), { target: { value: '{' } });
    fireEvent.click(screen.getByTestId('validate-json'));

    expect(await screen.findByTestId('validation-summary')).toHaveTextContent(/JSON_PARSE/i);
  });

  it('shows empty placeholders when no schema is provided', () => {
    render(<DesignLabShell />);

    expect(screen.getByTestId('json-placeholder')).toHaveTextContent(/No mission schema provided/i);
    expect(screen.getByTestId('preview-placeholder')).toHaveTextContent(/No mission schema provided/i);
  });

  it('surfaces renderer errors visibly', async () => {
    const erroringRenderer = vi.fn<[RenderRequest], Promise<RenderResponse>>().mockResolvedValue({
      status: 'ok',
      output: {
        status: 'error',
        mode: 'full',
        dslVersion: '2025.11',
        errors: [{ code: 'UNKNOWN_COMPONENT', message: 'UnknownWidget', path: '/screens/0/children/0/component' }],
        warnings: []
      }
    });

    render(<DesignLabShell schema={sampleSchema} renderer={erroringRenderer} />);
    await waitFor(() => expect(screen.getByTestId('preview-errors')).toBeInTheDocument());

    expect(screen.getByTestId('preview-errors')).toHaveTextContent(/UnknownWidget/i);
  });

  it('surfaces renderer warnings such as token issues', async () => {
    const renderer = vi.fn<[RenderRequest], Promise<RenderResponse>>().mockResolvedValue({
      status: 'ok',
      output: {
        status: 'ok',
        mode: 'full',
        dslVersion: '2025.11',
        errors: [],
        warnings: [{ code: 'UNKNOWN_TOKEN', message: 'gapToken spacing.unknown', path: '/screens/0/layout/gapToken' }],
        preview: { summary: 'Warning surfaced', screens: ['audit-screen'] },
        renderedTree: sampleSchema
      }
    });

    render(<DesignLabShell schema={sampleSchema} renderer={renderer} />);

    const warningBadge = await screen.findByTestId('preview-warnings');
    expect(warningBadge).toHaveTextContent(/UNKNOWN_TOKEN/i);
    expect(warningBadge).toHaveTextContent(/gapToken/i);
  });

  it('runs the agent workflow to call MCP tools and apply a patch', async () => {
    const patchedTree = {
      ...sampleSchema,
      screens: [
        {
          ...(sampleSchema.screens?.[0] || {}),
          meta: { ...(sampleSchema.screens?.[0]?.meta || {}), label: 'Agent label' }
        }
      ]
    };

    const renderer = vi
      .fn<[RenderRequest], Promise<RenderResponse>>()
      .mockResolvedValueOnce({
        status: 'ok',
        output: {
          status: 'ok',
          mode: 'full',
          dslVersion: '1.0.0',
          errors: [],
          warnings: [],
          preview: { summary: 'Initial render', screens: ['audit-screen'] },
          renderedTree: sampleSchema
        }
      })
      .mockResolvedValueOnce({
        status: 'ok',
        output: {
          status: 'ok',
          mode: 'patch',
          dslVersion: '1.0.0',
          errors: [],
          warnings: [],
          preview: { summary: 'Patched preview', screens: ['audit-screen'] },
          renderedTree: patchedTree
        }
      });

    vi.spyOn(agentWorkflow, 'fetchRegistrySummary').mockImplementation(async (dataset) => ({
      dataset,
      summary: dataset === 'components' ? '70 components' : '120 tokens',
      version: '2025-11-22',
      sampleComponents: ['AuditTimeline', 'StatusBadge']
    }));

    vi.spyOn(agentWorkflow, 'buildAgentPlan').mockReturnValue({
      mode: 'patch',
      request: {
        mode: 'patch',
        baseTree: sampleSchema,
        patch: [{ op: 'add', path: '/screens/0/meta/label', value: 'Agent label' }]
      },
      description: 'Planned agent updates',
      note: 'Agent patch applied',
      patchSummary: ['add label']
    });

    vi.spyOn(rendererClient, 'validateDesignLab').mockResolvedValue({
      status: 'ok',
      output: { status: 'ok', mode: 'patch', errors: [], warnings: [], meta: { screenCount: 1 } }
    });

    render(<DesignLabShell schema={sampleSchema} renderer={renderer} />);
    await waitFor(() => expect(renderer).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByTestId('agent-input'), { target: { value: 'Add a status badge' } });
    fireEvent.click(screen.getByTestId('agent-run'));

    await waitFor(() => expect(renderer).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId('chat-log')).toHaveTextContent(/structuredData.fetch\(components\)/i);
    expect(screen.getByTestId('chat-log')).toHaveTextContent(/Planned agent updates/i);
    await waitFor(() => expect(screen.getByTestId('json-view')).toHaveTextContent(/Agent label/));
  });

  it('handles renderer exceptions gracefully', async () => {
    const failingRenderer = vi.fn<[RenderRequest], Promise<RenderResponse>>().mockResolvedValue({
      status: 'error',
      error: new Error('boom')
    });

    render(<DesignLabShell schema={sampleSchema} renderer={failingRenderer} />);
    await waitFor(() => expect(screen.getByTestId('preview-errors')).toHaveTextContent(/boom/));
  });

  it('injects responsive grid styles', async () => {
    render(
      <DesignLabShell
        schema={sampleSchema}
        renderer={() =>
          Promise.resolve({
            status: 'ok',
            output: { status: 'ok', mode: 'full', dslVersion: '0.0.0', errors: [], warnings: [] }
          })
        }
      />
    );

    await waitFor(() => expect(document.getElementById('design-lab-shell-styles')).not.toBeNull());
    const styleEl = document.getElementById('design-lab-shell-styles');
    expect(styleEl?.textContent).toContain('grid-template-columns');
    expect(styleEl?.textContent).toContain('@media (max-width: 1100px)');
  });
});
