/**
 * View-context collapse — the crawl-2 proof surface (s173 m03).
 *
 * These stories exist to make the container-query collapse visible and drivable: a human
 * can see the rail become a block, and m04's Playwright specs read computed
 * `grid-template-columns` off them at 375 and 1280.
 *
 * THE MARKUP IS HAND-COMPOSED, deliberately, and that is a limitation worth stating: it
 * mirrors what `RenderObject` emits — `[data-view]`, `[data-view-context]`,
 * `[data-view-has-contextpanel]`, `[data-region-group]`, `aside[data-region='contextPanel']`
 * — rather than driving RenderObject itself, because the drawer is OPT-IN composition and
 * RenderObject takes no region override. tests/styles/view-context-collapse.test.ts pins
 * that these attribute names are the ones the engine really produces, so the mirror cannot
 * drift into fiction.
 *
 * Story names avoid the word "States": the light/dark capture harness falls back to a
 * name heuristic when Storybook's index carries no tags, and a story called "…States"
 * would be swept into the 1280px capture set by accident.
 */
import { useRef, type CSSProperties, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { ContextPanelDrawer } from '~/src/components/ContextPanelDrawer';

import '~/apps/explorer/src/styles/index.css';

const frameStyle = (width: number): CSSProperties => ({
  width: `${width}px`,
  maxWidth: '100%',
  border: '1px dashed var(--cmp-border-default)',
  resize: 'horizontal',
  overflow: 'auto',
});

const captionStyle: CSSProperties = { margin: 0, color: 'var(--cmp-text-muted)', fontSize: '0.8125rem' };

interface ShellProps {
  readonly context: 'detail' | 'list' | 'form' | 'chart' | 'dashboard' | 'timeline';
  readonly group: string;
  readonly panel: ReactNode;
  readonly shellRef?: React.RefObject<HTMLDivElement | null>;
}

/** One view shell, in the shape the view engine emits it. */
function ViewShell({ context, group, panel, shellRef }: ShellProps) {
  return (
    <div
      ref={shellRef}
      data-view=""
      data-view-context={context}
      data-view-has-contextpanel="true"
      data-testid={`shell-${context}`}
    >
      <div>
        <div data-region-group={group} data-testid={`group-${context}`}>
          <main data-region="main">
            <section>
              <h3 style={{ marginTop: 0 }}>Main region</h3>
              <p>
                Above the threshold this sits beside the rail; below it, the rail is released and this
                becomes the only column.
              </p>
            </section>
          </main>
          <aside data-region="contextPanel" aria-label="Context panel" data-testid={`panel-${context}`}>
            {panel}
          </aside>
        </div>
      </div>
    </div>
  );
}

function CollapseProof({ width }: { readonly width: number }) {
  return (
    // minmax(0,1fr) is load-bearing: an auto-sized grid track grows to its content, so a
    // frame declared `width: 1100px; max-width: 100%` would resolve 100% against 1100px and
    // never shrink at a 375 viewport. Measured, before this line existed.
    <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <p style={captionStyle}>
        Container width: {width}px. The collapse fires at 48rem (768px) of CONTAINER width — drag the
        frame's corner to cross it.
      </p>
      <div style={frameStyle(width)}>
        <ViewShell
          context="detail"
          group="detail-content"
          panel={
            <>
              <h3 style={{ marginTop: 0 }}>Context panel</h3>
              <p>Related records, metadata, actions.</p>
            </>
          }
        />
      </div>
    </div>
  );
}

/** The drawer composition: the same panel content, behind a trigger, once the shell is narrow. */
function DrawerProof({ width }: { readonly width: number }) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  return (
    // minmax(0,1fr) is load-bearing: an auto-sized grid track grows to its content, so a
    // frame declared `width: 1100px; max-width: 100%` would resolve 100% against 1100px and
    // never shrink at a 375 viewport. Measured, before this line existed.
    <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <p style={captionStyle}>
        Container width: {width}px. Below 768px the panel content moves into a modal Sheet behind a
        trigger; above it, the same children render inline with no extra wrapper.
      </p>
      <div style={frameStyle(width)}>
        <ViewShell
          context="detail"
          group="detail-content"
          shellRef={shellRef}
          panel={
            <ContextPanelDrawer containerRef={shellRef} label="Context panel" triggerLabel="Show context">
              <p>Related records, metadata, actions.</p>
              <button type="button">An action</button>
            </ContextPanelDrawer>
          }
        />
      </div>
    </div>
  );
}

const meta = {
  title: 'Contexts/View Collapse',
  parameters: {
    layout: 'padded',
    // Not a capture target: the collapse is verified behaviourally in Playwright, and adding
    // resizable frames to the 1280px image corpus would only add flake.
    chromatic: { disableSnapshot: true },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const RailAtWideContainer: Story = {
  name: 'Rail at a wide container',
  render: () => <CollapseProof width={1100} />,
};

export const RailAtNarrowContainer: Story = {
  name: 'Rail at a narrow container',
  render: () => <CollapseProof width={375} />,
};

export const DrawerAtNarrowContainer: Story = {
  name: 'Drawer at a narrow container',
  render: () => <DrawerProof width={375} />,
};

export const DrawerAtWideContainer: Story = {
  name: 'Drawer at a wide container',
  render: () => <DrawerProof width={1100} />,
};
