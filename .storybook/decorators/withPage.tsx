import type { Decorator } from '@storybook/react';
import type { CSSProperties } from 'react';

type PagePosition = 'start' | 'center';

export interface WithPageOptions {
  /**
   * When true the inner wrapper stretches to the full viewport width.
   * Use for full-bleed demonstrations (e.g. Banner, PageHeader).
   */
  fullWidth?: boolean;
  /**
   * Override the max width applied to the inner wrapper when `fullWidth` is false.
   */
  maxWidth?: string;
  /**
   * Vertical alignment for the rendered story.
   */
  position?: PagePosition;
  /**
    * Gap between stacked sections inside the wrapper.
    */
  gap?: string;
  /**
   * Override the wrapper padding.
   */
  padding?: string;
}

const DEFAULT_PADDING = 'var(--cmp-spacing-inset-spacious, clamp(1.5rem, 1.5vw + 1rem, 3rem))';
const DEFAULT_MAX_WIDTH = 'min(72rem, 100%)';
const DEFAULT_GAP = 'var(--cmp-spacing-stack-default, 1.5rem)';

export const withPage = (options: WithPageOptions = {}): Decorator => {
  const {
    fullWidth = false,
    maxWidth = DEFAULT_MAX_WIDTH,
    position = 'start',
    gap = DEFAULT_GAP,
    padding = DEFAULT_PADDING,
  } = options;

  return (Story) => {
    const outerStyle: CSSProperties = {
      minHeight: '100vh',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'stretch',
      justifyContent: position === 'center' ? 'center' : 'flex-start',
      padding,
      background: 'var(--cmp-surface-canvas, Canvas)',
      color: 'var(--cmp-text-body, CanvasText)',
      boxSizing: 'border-box',
    };

    const innerStyle: CSSProperties = {
      width: fullWidth ? '100%' : maxWidth,
      margin: position === 'center' && !fullWidth ? '0 auto' : '0',
      display: 'grid',
      gap,
    };

    if (fullWidth) {
      innerStyle.maxWidth = '100%';
    }

    return (
      <div style={outerStyle} data-decorator="withPage">
        <div style={innerStyle}>
          <Story />
        </div>
      </div>
    );
  };
};

export default withPage;
