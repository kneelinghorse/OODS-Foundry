import { ComponentType } from 'react';
import { OverlayRoot } from './OverlayRoot';

export function withOverlay<T extends object>(Comp: ComponentType<T>, rootId?: string) {
  return function Wrapped(props: T) {
    return (
      <OverlayRoot rootId={rootId}>
        <Comp {...props} />
      </OverlayRoot>
    );
  };
}

