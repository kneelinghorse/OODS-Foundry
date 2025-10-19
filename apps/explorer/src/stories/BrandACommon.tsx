import type { CSSProperties, ReactNode } from 'react';

const baseCanvasStyle: CSSProperties = {
  minHeight: '100vh',
  width: '100%',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'flex-start',
  padding: '3rem',
  boxSizing: 'border-box',
  background: 'var(--cmp-surface-canvas)',
  color: 'var(--cmp-text-body)'
};

export const contentCardStyle: CSSProperties = {
  width: 'min(64rem, 100%)',
  display: 'grid',
  gap: '2rem'
};

export function BrandADarkSurface({
  children,
  style
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div data-brand="A" data-theme="dark" style={{ ...baseCanvasStyle, ...style }}>
      {children}
    </div>
  );
}
