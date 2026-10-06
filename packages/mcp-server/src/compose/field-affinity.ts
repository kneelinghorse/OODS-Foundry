/**
 * Field-type-aware affinity scoring for component selection (s73-m01).
 *
 * Given a field hint (type, enum, semanticType), returns a score boost
 * and preferred component list that biases the selector toward components
 * that naturally fit the field.
 *
 * Scoring: 0.15–0.30 boost added to the composite selection score.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/** Hint about the field being rendered, passed to selectComponent. */
export interface FieldHint {
  /** Field data type: string, integer, number, boolean, datetime, date, email, url, uuid, array */
  type: string;
  /** Enum values, if field is constrained to a set */
  enum?: string[];
  /** Semantic type from object semantics: currency, percentage, status, identifier, etc. */
  semanticType?: string;
}

export interface FieldAffinityResult {
  /** Score boost to add (0–0.30) */
  boost: number;
  /** Preferred component names, highest affinity first */
  preferredComponents: string[];
  /** Human-readable reason for the affinity match */
  reason: string;
}

/* ------------------------------------------------------------------ */
/*  Affinity maps                                                      */
/* ------------------------------------------------------------------ */

interface AffinityEntry {
  components: string[];
  boost: number;
}

/**
 * Field type → component affinities.
 * Higher boost = stronger type match.
 */
const TYPE_AFFINITY: Record<string, AffinityEntry> = {
  boolean: {
    components: ['Toggle', 'Checkbox', 'Switch'],
    boost: 0.25,
  },
  datetime: {
    components: ['DatePicker', 'Timeline', 'Text'],
    boost: 0.20,
  },
  date: {
    components: ['DatePicker', 'Timeline', 'Text'],
    boost: 0.20,
  },
  email: {
    components: ['Input', 'Text', 'Link'],
    boost: 0.15,
  },
  url: {
    components: ['Link', 'Input', 'Text'],
    boost: 0.20,
  },
  integer: {
    components: ['Text', 'Badge', 'Input'],
    boost: 0.10,
  },
  number: {
    components: ['Text', 'Badge', 'Input'],
    boost: 0.10,
  },
  array: {
    components: ['TagInput', 'Stack', 'Table'],
    boost: 0.15,
  },
  uuid: {
    components: ['Text', 'Badge'],
    boost: 0.10,
  },
};

/**
 * Semantic type → component affinities.
 * These override/supplement type-based affinity when present.
 */
const SEMANTIC_AFFINITY: Record<string, AffinityEntry> = {
  currency: {
    components: ['CurrencyDisplay', 'Text', 'Badge'],
    boost: 0.30,
  },
  percentage: {
    components: ['ProgressBar', 'Text', 'Badge'],
    boost: 0.25,
  },
  status: {
    components: ['StatusBadge', 'Badge', 'ColorizedBadge'],
    boost: 0.30,
  },
  identifier: {
    components: ['Badge', 'Text'],
    boost: 0.15,
  },
  timestamp: {
    components: ['DatePicker', 'Timeline', 'Text'],
    boost: 0.20,
  },
  color: {
    components: ['ColorSwatch', 'Badge', 'Text'],
    boost: 0.25,
  },
  phone: {
    components: ['Input', 'Text', 'Link'],
    boost: 0.15,
  },
  rating: {
    components: ['RatingStars', 'Badge', 'Text'],
    boost: 0.25,
  },
  'preferences.toggle': {
    components: ['PreferenceEditor', 'Select', 'Input'],
    boost: 0.30,
  },
  priority: {
    components: ['Badge', 'Select', 'StatusBadge'],
    boost: 0.20,
  },
  severity: {
    components: ['StatusBadge', 'Badge', 'ColorizedBadge'],
    boost: 0.25,
  },
  category: {
    components: ['Badge', 'Select', 'Text'],
    boost: 0.20,
  },
  duration: {
    components: ['Text', 'Badge', 'Input'],
    boost: 0.15,
  },
  quantity: {
    components: ['Text', 'Badge', 'Input'],
    boost: 0.15,
  },
  description: {
    components: ['Textarea', 'Text', 'Input'],
    boost: 0.20,
  },
  address: {
    components: ['Text', 'Textarea', 'Input'],
    boost: 0.15,
  },
  score: {
    components: ['ProgressBar', 'Badge', 'Text'],
    boost: 0.25,
  },
};

/**
 * Enum fields get special treatment: prefer selection/status components.
 */
const ENUM_AFFINITY: AffinityEntry = {
  components: ['Select', 'StatusBadge', 'Badge', 'ColorizedBadge'],
  boost: 0.25,
};

/* ------------------------------------------------------------------ */
/*  Scoring engine                                                     */
/* ------------------------------------------------------------------ */

/**
 * Compute field affinity for a component candidate.
 *
 * Returns a boost score (0–0.30) and the preferred components list
 * for the given field hint. The caller uses this to augment the
 * existing composite selection score.
 */
export function computeFieldAffinity(hint: FieldHint): FieldAffinityResult {
  // Priority: semanticType > enum > type
  if (hint.semanticType) {
    const semantic = SEMANTIC_AFFINITY[hint.semanticType];
    if (semantic) {
      return {
        boost: semantic.boost,
        preferredComponents: semantic.components,
        reason: `semantic type "${hint.semanticType}"`,
      };
    }
  }

  if (hint.enum && hint.enum.length > 0) {
    return {
      boost: ENUM_AFFINITY.boost,
      preferredComponents: ENUM_AFFINITY.components,
      reason: `enum field (${hint.enum.length} values)`,
    };
  }

  const typeEntry = TYPE_AFFINITY[hint.type];
  if (typeEntry) {
    return {
      boost: typeEntry.boost,
      preferredComponents: typeEntry.components,
      reason: `field type "${hint.type}"`,
    };
  }

  // Unknown type — no boost
  return {
    boost: 0,
    preferredComponents: [],
    reason: 'no affinity match',
  };
}

/**
 * Score how well a specific component matches a field hint.
 *
 * Returns a score between 0 and the affinity's max boost.
 * First preferred component gets full boost, subsequent get diminishing values.
 */
export function scoreFieldAffinity(
  componentName: string,
  hint: FieldHint,
): { boost: number; reason: string } {
  const affinity = computeFieldAffinity(hint);
  if (affinity.boost === 0 || affinity.preferredComponents.length === 0) {
    return { boost: 0, reason: '' };
  }

  const rank = affinity.preferredComponents.indexOf(componentName);
  if (rank === -1) {
    return { boost: 0, reason: '' };
  }

  // Diminishing boost: rank 0 = full, rank 1 = 70%, rank 2 = 50%
  const diminish = [1.0, 0.7, 0.5];
  const factor = diminish[rank] ?? 0.3;
  const boost = Math.round(affinity.boost * factor * 100) / 100;

  return {
    boost,
    reason: `field affinity: ${affinity.reason} (rank ${rank + 1})`,
  };
}
