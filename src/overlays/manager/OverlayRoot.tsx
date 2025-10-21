import { PropsWithChildren } from 'react';
import { createPortal } from 'react-dom';
import { usePortalRoot } from './hooks';

export function OverlayRoot({ children, rootId }: PropsWithChildren<{ rootId?: string }>) {
  const host = usePortalRoot(rootId);
  if (!host) return null;
  return createPortal(children, host);
}

