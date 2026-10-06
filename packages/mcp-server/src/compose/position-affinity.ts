/**
 * Slot-position affinity scoring (s73-m03).
 *
 * Applies a position multiplier to component scores based on where
 * the component will be placed. SearchInput scores higher in header,
 * PaginationBar higher in footer, data components higher in main/tab.
 *
 * Multiplier range: 0.8x–1.2x (dampens poor fits, boosts good fits).
 * No multiplier (1.0x) when position is unknown.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type SlotPosition = 'header' | 'main' | 'footer' | 'sidebar' | 'tab';

export interface PositionAffinityResult {
  /** Multiplier to apply to the component score (0.8–1.2) */
  multiplier: number;
  /** Human-readable reason */
  reason: string;
}

/* ------------------------------------------------------------------ */
/*  Affinity map                                                       */
/* ------------------------------------------------------------------ */

/**
 * Component → position affinity.
 * Positive positions get a boost (1.1–1.2x).
 * Negative positions get a penalty (0.8–0.9x).
 * Unlisted positions get 1.0x (neutral).
 */
interface PositionProfile {
  boost: SlotPosition[];
  penalty: SlotPosition[];
}

const COMPONENT_POSITION_MAP: Record<string, PositionProfile> = {
  // Search-like components → header/sidebar
  SearchInput: { boost: ['header', 'sidebar'], penalty: ['footer', 'tab'] },
  Input: { boost: ['header', 'sidebar'], penalty: ['footer'] },
  Select: { boost: ['header', 'sidebar', 'main', 'tab'], penalty: ['footer'] },
  FilterPanel: { boost: ['header', 'sidebar'], penalty: ['footer', 'tab'] },

  // Pagination → footer
  PaginationBar: { boost: ['footer'], penalty: ['header', 'sidebar', 'tab'] },

  // Navigation → header/sidebar
  Tabs: { boost: ['main'], penalty: ['footer', 'sidebar'] },
  Breadcrumbs: { boost: ['header'], penalty: ['footer', 'sidebar', 'tab'] },

  // Data display → main/tab
  Table: { boost: ['main', 'tab'], penalty: ['header', 'sidebar'] },
  Card: { boost: ['main', 'tab'], penalty: ['header', 'footer'] },
  Stack: { boost: ['main', 'tab', 'sidebar'], penalty: [] },
  Grid: { boost: ['main', 'tab'], penalty: ['header', 'footer'] },

  // Status/badges → header/sidebar
  StatusBadge: { boost: ['header', 'sidebar'], penalty: ['footer'] },
  Badge: { boost: ['header', 'sidebar'], penalty: ['footer'] },
  ColorizedBadge: { boost: ['header', 'sidebar'], penalty: ['footer'] },

  // Action components → footer/header
  Button: { boost: ['footer', 'header'], penalty: ['tab'] },

  // Text → flexible, slight header preference
  Text: { boost: ['header', 'main', 'tab'], penalty: [] },
  DetailHeader: { boost: ['header'], penalty: ['footer', 'sidebar'] },

  // Chart/viz → main/tab
  Chart: { boost: ['main', 'tab'], penalty: ['header', 'footer'] },
  BarChart: { boost: ['main', 'tab'], penalty: ['header', 'footer'] },
  LineChart: { boost: ['main', 'tab'], penalty: ['header', 'footer'] },

  // Metadata → sidebar
  MetadataPanel: { boost: ['sidebar', 'tab'], penalty: ['header', 'footer'] },
  Timeline: { boost: ['main', 'tab', 'sidebar'], penalty: ['header'] },

  // Form components → main/tab
  Toggle: { boost: ['main', 'tab'], penalty: ['header', 'footer'] },
  Checkbox: { boost: ['main', 'tab'], penalty: ['header', 'footer'] },
  Textarea: { boost: ['main', 'tab'], penalty: ['header', 'footer'] },
  DatePicker: { boost: ['main', 'tab', 'header'], penalty: ['footer'] },
};

const BOOST_MULTIPLIER = 1.15;
const PENALTY_MULTIPLIER = 0.85;

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Compute position affinity multiplier for a component in a given slot position.
 *
 * @param componentName - The component being scored
 * @param position - Where the component will be placed
 * @returns Multiplier (0.8–1.2) and reason string
 */
export function getPositionAffinity(
  componentName: string,
  position: SlotPosition,
): PositionAffinityResult {
  const profile = COMPONENT_POSITION_MAP[componentName];
  if (!profile) {
    return { multiplier: 1.0, reason: '' };
  }

  if (profile.boost.includes(position)) {
    return {
      multiplier: BOOST_MULTIPLIER,
      reason: `position affinity: ${componentName} fits well in ${position}`,
    };
  }

  if (profile.penalty.includes(position)) {
    return {
      multiplier: PENALTY_MULTIPLIER,
      reason: `position affinity: ${componentName} is a poor fit for ${position}`,
    };
  }

  return { multiplier: 1.0, reason: '' };
}

/**
 * Infer slot position from a slot name.
 * Returns undefined if the name doesn't map to a known position.
 */
export function inferSlotPosition(slotName: string): SlotPosition | undefined {
  if (
    slotName === 'header'
    || slotName === 'title'
    || slotName === 'banner'
    || slotName === 'search'
    || slotName === 'toolbar-actions'
  ) {
    return 'header';
  }
  if (
    slotName === 'main-content'
    || slotName === 'items'
    || slotName === 'metrics'
    || slotName.startsWith('field-')
    || slotName.startsWith('main-section-')
    || slotName.startsWith('metrics-section-')
  ) {
    return 'main';
  }
  if (slotName === 'footer' || slotName === 'actions' || slotName === 'pagination') {
    return 'footer';
  }
  if (
    slotName === 'sidebar'
    || slotName === 'metadata'
    || slotName === 'filters'
    || slotName.startsWith('sidebar-section-')
  ) {
    return 'sidebar';
  }
  if (slotName.startsWith('tab-')) {
    return 'tab';
  }
  return undefined;
}
