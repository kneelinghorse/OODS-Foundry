import type { CSSProperties, ReactNode } from 'react';

type Brand = 'A' | 'B';

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

function resolveCurrentBrand(): Brand {
  if (typeof document === 'undefined') {
    return 'A';
  }
  const attribute = document.documentElement.getAttribute('data-brand');
  return attribute === 'B' ? 'B' : 'A';
}

export function BrandADarkSurface({
  children,
  style
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  const brand = resolveCurrentBrand();
  return (
    <div data-brand={brand} data-theme="dark" style={{ ...baseCanvasStyle, ...style }}>
      {children}
    </div>
  );
}
