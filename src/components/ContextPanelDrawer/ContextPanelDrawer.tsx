/**
 * @file The contextPanel drawer — opt-in composition, not a layout change.
 * @module components/ContextPanelDrawer
 *
 * s173 m03 (crawl 2). When the view shell is narrower than the collapse threshold, the CSS
 * releases the rail and the contextPanel becomes a full-width block above or below the
 * main content. That is correct but not always what you want on a phone: a filter panel
 * pushing the list below the fold is a worse read than a button that opens it.
 *
 * THIS IS OPT-IN. It is NOT injected into RenderObject's markup, and no view gains a drawer
 * by upgrading. A caller composes it inside their own contextPanel region; every existing
 * view renders exactly as before. That is deliberate: injecting a modal into every view's
 * rail would be a behaviour change to eight contexts on the strength of one hypothesis
 * about phones, and the context snapshots would move to prove it.
 *
 * The overlay is the existing `Sheet` (role=dialog, aria-modal, focus management, inert
 * outside, Esc + backdrop dismissal, overlay-manager mounted). Modal is the right mode
 * here: at this width the panel would cover the content anyway, and a non-modal drawer
 * would leave a screen-reader user in a two-column mental model the screen no longer has.
 */

import { useId, useState, type PropsWithChildren, type ReactNode, type RefObject } from 'react';
import { Sheet, type SheetAnchor } from '../Sheet/Sheet.js';
import { useContainerNarrow } from './useContainerNarrow.js';

export type ContextPanelDrawerProps = PropsWithChildren<{
  /** The element whose width decides the collapse — normally the `[data-view]` shell. */
  readonly containerRef: RefObject<HTMLElement | null>;
  /** Accessible name for the drawer and its trigger, e.g. "Filters" or "Record details". */
  readonly label: string;
  /** Trigger text when collapsed. Defaults to the label. */
  readonly triggerLabel?: string;
  /** Which edge the sheet flies in from. Bottom reads best on phones; right matches the rail. */
  readonly anchor?: SheetAnchor;
  /** Override the collapse threshold in px. Defaults to sys.breakpoint.md, as the CSS does. */
  readonly thresholdPx?: number;
  /** Rendered instead of the trigger when the panel is empty — e.g. a count of active filters. */
  readonly triggerBadge?: ReactNode;
}>;

/**
 * Renders `children` inline while the container is wide, and behind a trigger + Sheet once
 * it is narrow. The wide path adds NO wrapper element, so a composed panel and a plain one
 * produce the same markup above the collapse threshold.
 */
export function ContextPanelDrawer({
  containerRef,
  label,
  triggerLabel,
  anchor = 'bottom',
  thresholdPx,
  triggerBadge,
  children,
}: ContextPanelDrawerProps) {
  const narrow = useContainerNarrow(
    thresholdPx === undefined ? { containerRef } : { containerRef, thresholdPx },
  );
  const [open, setOpen] = useState(false);
  const headingId = useId();

  if (!narrow) {
    return <>{children}</>;
  }

  return (
    <>
      <button
        type="button"
        data-context-panel-trigger="true"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        {triggerLabel ?? label}
        {triggerBadge}
      </button>
      <Sheet open={open} onOpenChange={setOpen} anchor={anchor} size="md" labelledBy={headingId}>
        <h2 id={headingId} data-context-panel-drawer-heading="true">
          {label}
        </h2>
        {children}
      </Sheet>
    </>
  );
}
