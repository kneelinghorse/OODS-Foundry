/**
 * @file Is this container narrower than the collapse threshold?
 * @module components/ContextPanelDrawer/useContainerNarrow
 *
 * s173 m03 (crawl 2). The CSS collapse is a container query; this is the JS half, for the
 * one decision CSS cannot make — whether the contextPanel's content should be behind a
 * drawer trigger instead of in the rail.
 *
 * It measures the CONTAINER, not the viewport, for the same reason the CSS does: a view is
 * a component and can render inside a narrow pane on a wide screen. The measurement is the
 * element's own `offsetWidth` through a ResizeObserver, following the useOverflowMenu
 * precedent in src/components/tabs — including its fallback to a window resize listener
 * where ResizeObserver is absent (jsdom, older engines), so behaviour degrades to
 * viewport-driven rather than to nothing.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { VIEW_COLLAPSE_PX } from '../../styles/breakpoints.js';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export interface UseContainerNarrowOptions {
  /** The element whose inline size decides the collapse — normally the view shell. */
  readonly containerRef: RefObject<HTMLElement | null>;
  /** Override the threshold. Defaults to sys.breakpoint.md, the same width the CSS collapses at. */
  readonly thresholdPx?: number;
}

export function useContainerNarrow({
  containerRef,
  thresholdPx = VIEW_COLLAPSE_PX,
}: UseContainerNarrowOptions): boolean {
  const [narrow, setNarrow] = useState(false);
  // Kept in a ref so the measure callback is stable across threshold-identical renders.
  const thresholdRef = useRef(thresholdPx);
  thresholdRef.current = thresholdPx;

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const width = container.offsetWidth;
    // A zero width means "not laid out yet" (display:none, detached, pre-paint), not "very
    // narrow". Treating it as narrow would flash the drawer trigger on every mount.
    if (width === 0) {
      return;
    }
    setNarrow(width <= thresholdRef.current);
  }, [containerRef]);

  // Bumped to re-run the effect once the ancestor ref exists — see below.
  const [attachTick, setAttachTick] = useState(0);

  useIsomorphicLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) {
      /*
       * THE CONTAINER REF BELONGS TO AN ANCESTOR, and React attaches refs bottom-up: when
       * this descendant's layout effect runs on the first commit, the view shell's ref is
       * still null. Without a retry the hook simply never measures — no container, no
       * ResizeObserver, no second chance — and the drawer never appears in a real render.
       *
       * Found by the Playwright leg, not by the unit tests, and that is the point worth
       * remembering: every jsdom test here hands the hook an element that is ALREADY
       * attached, so all of them passed against a hook that could not work in the DOM it
       * was written for. Re-run on the next frame, when the ancestor ref is populated.
       */
      const frame = requestAnimationFrame(() => setAttachTick((value) => value + 1));
      return () => cancelAnimationFrame(frame);
    }

    measure();

    if (typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver(() => measure());
      observer.observe(container);
      return () => observer.disconnect();
    }

    if (typeof window === 'undefined') {
      return undefined;
    }
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [containerRef, measure, attachTick]);

  return narrow;
}
