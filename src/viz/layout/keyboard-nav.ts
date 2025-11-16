export interface GridNavigationConfig {
  readonly columns: number;
  readonly totalItems: number;
  readonly loop?: boolean;
  readonly focusAt: (index: number) => void;
}

const MOVEMENT_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End']);

export function handleGridNavigationEvent(
  event: Pick<KeyboardEvent, 'key' | 'preventDefault'>,
  currentIndex: number,
  config: GridNavigationConfig
): number | undefined {
  if (!MOVEMENT_KEYS.has(event.key)) {
    return undefined;
  }

  const columns = Math.max(1, Math.floor(config.columns));
  const total = Math.max(0, Math.floor(config.totalItems));
  if (total === 0) {
    return undefined;
  }

  const lastIndex = total - 1;
  let nextIndex = currentIndex;

  switch (event.key) {
    case 'ArrowRight':
      nextIndex = currentIndex + 1;
      break;
    case 'ArrowLeft':
      nextIndex = currentIndex - 1;
      break;
    case 'ArrowDown':
      nextIndex = currentIndex + columns;
      break;
    case 'ArrowUp':
      nextIndex = currentIndex - columns;
      break;
    case 'Home':
      nextIndex = 0;
      break;
    case 'End':
      nextIndex = lastIndex;
      break;
    default:
      return undefined;
  }

  if (nextIndex < 0 || nextIndex > lastIndex) {
    if (config.loop) {
      const normalized = ((nextIndex % total) + total) % total;
      nextIndex = normalized;
    } else {
      nextIndex = Math.min(Math.max(nextIndex, 0), lastIndex);
    }
  }

  if (nextIndex === currentIndex) {
    return undefined;
  }

  event.preventDefault();
  config.focusAt(nextIndex);
  return nextIndex;
}
