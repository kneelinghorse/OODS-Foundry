/**
 * Multi-field semantic pattern detection (s80-m02).
 *
 * Detects cross-field relationships in objectSchema and maps them
 * to composite component groups. Moves beyond independent per-field
 * decisions to relationship-aware composition.
 *
 * Examples:
 *   status + statusUpdatedAt → StatusTimeline
 *   price + billingCycle     → PricingSummary
 *   firstName + lastName + avatar → UserIdentityCard
 */
import type { FieldDefinition } from '../objects/types.js';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface FieldPatternMatch {
  /** Pattern identifier (e.g., "status-timeline", "pricing-summary"). */
  patternId: string;
  /** Human-readable pattern name. */
  name: string;
  /** Fields that matched this pattern. */
  matchedFields: string[];
  /** Suggested composite component for this group. */
  compositeComponent: string;
  /** Score boost for the composite component in selection (0–0.35). */
  selectionBoost: number;
  /** Suggested slot group name for slot-expander integration. */
  slotGroup: string;
  /** Confidence score (0–1) based on matched vs max possible fields. */
  confidence: number;
}

export interface PatternDetectionResult {
  /** All detected patterns. */
  patterns: FieldPatternMatch[];
  /** Fields consumed by patterns (should be grouped together). */
  consumedFields: Set<string>;
  /** Fields not part of any pattern. */
  ungroupedFields: string[];
}

/* ------------------------------------------------------------------ */
/*  Pattern definitions                                                */
/* ------------------------------------------------------------------ */

interface PatternRule {
  id: string;
  name: string;
  compositeComponent: string;
  selectionBoost: number;
  slotGroup: string;
  /** Maximum number of fields this pattern can match (for confidence calculation). */
  maxFields: number;
  /**
   * Detect whether this pattern matches the given fields.
   * Returns the matched field names, or null if no match.
   */
  detect: (
    fields: Record<string, FieldDefinition>,
    semanticTypes?: Record<string, string>,
  ) => string[] | null;
}

function fieldNameMatches(fieldName: string, patterns: RegExp[]): boolean {
  const lower = fieldName.toLowerCase();
  return patterns.some(p => p.test(lower));
}

function hasFieldMatching(
  fields: Record<string, FieldDefinition>,
  patterns: RegExp[],
  accept?: (name: string, def: FieldDefinition) => boolean,
): string | undefined {
  for (const [name, def] of Object.entries(fields)) {
    if (!fieldNameMatches(name, patterns)) continue;
    if (accept && !accept(name, def)) continue;
    return name;
  }
  return undefined;
}

/**
 * Whether a field actually holds a moment in time, rather than merely being named like one.
 * A trailing `?` marks the type optional and says nothing about what it holds.
 */
function isTimestampValued(
  name: string,
  def: FieldDefinition,
  semanticTypes?: Record<string, string>,
): boolean {
  const type = def.type.replace(/\?$/, '');
  if (type === 'datetime' || type === 'date') return true;
  return hasSemanticType(name, semanticTypes, ['timestamp']);
}

function hasFieldsMatching(
  fields: Record<string, FieldDefinition>,
  patterns: RegExp[],
): string[] {
  const matches: string[] = [];
  for (const name of Object.keys(fields)) {
    if (fieldNameMatches(name, patterns)) matches.push(name);
  }
  return matches;
}

function hasSemanticType(
  fieldName: string,
  semanticTypes: Record<string, string> | undefined,
  types: string[],
): boolean {
  const sem = semanticTypes?.[fieldName];
  if (!sem) return false;
  const lower = sem.toLowerCase();
  return types.some(t => lower === t || lower.includes(t));
}

const PATTERN_RULES: PatternRule[] = [
  // 1. Status + Timestamp → StatusTimeline
  {
    id: 'status-timeline',
    name: 'StatusTimeline',
    compositeComponent: 'StatusTimeline',
    selectionBoost: 0.30,
    slotGroup: 'status',
    maxFields: 2,
    detect(fields, semanticTypes) {
      const statusField = hasFieldMatching(fields, [
        /^status$/i, /^state$/i, /status$/i, /^lifecycle/i,
      ]);
      if (!statusField) return null;

      // A StatusTimeline pairs a status with the MOMENT it was last set, so the second field has to
      // be a real timestamp and not merely named like one. Matching on the name alone let
      // /transition/i pick up Stateful's `allowed_transitions` — a `string[]` of state names whose
      // semantic type is `status.navigation`, an internal field and not a time at all — so every
      // detail of every object composing Stateful carried an "Allowed transitions: None recorded" row
      // (s203-m04 measured it; the s203 review ruled it fixed here in #2180).
      //
      // The type check below is the same one the fallback loop underneath already applies; requiring
      // it on this path too is what makes the two agree. Subscription's group re-pairs with
      // `updated_at` as a result, which reshapes tabs an earlier sprint certified — that
      // re-certification is part of this mission rather than a reason not to fix it.
      const timestampField = hasFieldMatching(fields, [
        /updated.?at$/i, /changed.?at$/i, /modified.?at$/i,
        /status.?updated/i, /state.?changed/i, /last.?modified/i,
        /transition/i,
      ], (name, def) => isTimestampValued(name, def, semanticTypes));
      if (timestampField) return [statusField, timestampField];

      // Also check for any datetime field with "status" or "update" in name
      for (const [name, def] of Object.entries(fields)) {
        if (name === statusField) continue;
        if ((def.type === 'datetime' || def.type === 'date') &&
            fieldNameMatches(name, [/update/i, /change/i, /modif/i])) {
          return [statusField, name];
        }
        if (hasSemanticType(name, semanticTypes, ['timestamp']) &&
            fieldNameMatches(name, [/update/i, /change/i, /status/i])) {
          return [statusField, name];
        }
      }
      return null;
    },
  },

  // 2. Currency + Billing Cycle → PricingSummary
  {
    id: 'pricing-summary',
    name: 'PricingSummary',
    compositeComponent: 'PricingSummary',
    selectionBoost: 0.30,
    slotGroup: 'pricing',
    maxFields: 3,
    detect(fields, semanticTypes) {
      const priceField = hasFieldMatching(fields, [
        /^price$/i, /^cost$/i, /^amount$/i, /^fee$/i, /^rate$/i,
        /price$/i, /cost$/i, /amount$/i,
      ]);
      // Also match by semantic type
      const currencyFields: string[] = [];
      for (const name of Object.keys(fields)) {
        if (hasSemanticType(name, semanticTypes, ['currency'])) {
          currencyFields.push(name);
        }
      }

      const moneyField = priceField ?? currencyFields[0];
      if (!moneyField) return null;

      const cycleField = hasFieldMatching(fields, [
        /billing.?cycle/i, /billing.?period/i, /frequency/i,
        /interval/i, /recurrence/i, /plan.?type/i, /subscription.?type/i,
      ]);
      if (cycleField) return [moneyField, cycleField];

      // Price + currency combo
      if (currencyFields.length >= 2) {
        return currencyFields.slice(0, 3);
      }

      return null;
    },
  },

  // 3. First Name + Last Name + Avatar → UserIdentityCard
  {
    id: 'user-identity',
    name: 'UserIdentityCard',
    compositeComponent: 'UserIdentityCard',
    selectionBoost: 0.35,
    slotGroup: 'identity',
    maxFields: 4,
    detect(fields) {
      const firstName = hasFieldMatching(fields, [
        /^first.?name$/i, /^given.?name$/i, /^fname$/i,
      ]);
      const lastName = hasFieldMatching(fields, [
        /^last.?name$/i, /^surname$/i, /^family.?name$/i, /^lname$/i,
      ]);
      if (!firstName || !lastName) return null;

      const matched = [firstName, lastName];
      const avatar = hasFieldMatching(fields, [
        /^avatar$/i, /^profile.?image/i, /^photo$/i, /^picture$/i, /^image.?url$/i,
      ]);
      if (avatar) matched.push(avatar);

      // Also pull in display name if present
      const displayName = hasFieldMatching(fields, [/^display.?name$/i, /^full.?name$/i]);
      if (displayName) matched.push(displayName);

      return matched;
    },
  },

  // 4. Address block → AddressBlock
  {
    id: 'address-block',
    name: 'AddressBlock',
    compositeComponent: 'AddressBlock',
    selectionBoost: 0.30,
    slotGroup: 'address',
    maxFields: 5,
    detect(fields) {
      const streetFields = hasFieldsMatching(fields, [
        /^street$/i, /^address$/i, /^address.?line/i, /^street.?address/i,
      ]);
      const cityField = hasFieldMatching(fields, [/^city$/i, /^town$/i, /^locality$/i]);

      if (streetFields.length === 0 || !cityField) return null;

      const matched = [...streetFields, cityField];

      const state = hasFieldMatching(fields, [/^state$/i, /^province$/i, /^region$/i]);
      if (state) matched.push(state);

      const zip = hasFieldMatching(fields, [/^zip$/i, /^postal/i, /^postcode$/i, /^zip.?code$/i]);
      if (zip) matched.push(zip);

      const country = hasFieldMatching(fields, [/^country$/i, /^country.?code$/i]);
      if (country) matched.push(country);

      return matched;
    },
  },

  // 5. Date range → DateRange
  {
    id: 'date-range',
    name: 'DateRange',
    compositeComponent: 'DateRange',
    selectionBoost: 0.25,
    slotGroup: 'temporal',
    maxFields: 2,
    detect(fields) {
      const startField = hasFieldMatching(fields, [
        /^start.?date$/i, /^from.?date$/i, /^begin.?date$/i,
        /^start.?at$/i, /^starts.?at$/i, /^valid.?from$/i,
        /^effective.?date$/i, /^check.?in$/i,
      ]);
      const endField = hasFieldMatching(fields, [
        /^end.?date$/i, /^to.?date$/i, /^finish.?date$/i,
        /^end.?at$/i, /^ends.?at$/i, /^valid.?until$/i,
        /^expir/i, /^check.?out$/i,
      ]);

      if (startField && endField) return [startField, endField];
      return null;
    },
  },

  // 6. Metric + Trend → MetricTrend
  {
    id: 'metric-trend',
    name: 'MetricTrend',
    compositeComponent: 'MetricTrend',
    selectionBoost: 0.25,
    slotGroup: 'metrics',
    maxFields: 2,
    detect(fields, semanticTypes) {
      const valueField = hasFieldMatching(fields, [
        /^value$/i, /^score$/i, /^total$/i, /^count$/i, /^revenue$/i,
        /^amount$/i, /^metric$/i,
      ]);
      if (!valueField) {
        // Try semantic type match for numeric metrics
        for (const [name, def] of Object.entries(fields)) {
          if ((def.type === 'number' || def.type === 'integer') &&
              hasSemanticType(name, semanticTypes, ['metric', 'count', 'currency'])) {
            const trendField = hasFieldMatching(fields, [
              /^change$/i, /^delta$/i, /^trend$/i, /^growth$/i,
              /^diff$/i, /^variance$/i, /percent.?change/i,
            ]);
            if (trendField) return [name, trendField];
          }
        }
        return null;
      }

      const trendField = hasFieldMatching(fields, [
        /^change$/i, /^delta$/i, /^trend$/i, /^growth$/i,
        /^diff$/i, /^variance$/i, /percent.?change/i,
      ]);
      if (trendField) return [valueField, trendField];
      return null;
    },
  },

  // 7. Contact info → ContactInfo
  {
    id: 'contact-info',
    name: 'ContactInfo',
    compositeComponent: 'ContactInfo',
    selectionBoost: 0.25,
    slotGroup: 'contact',
    maxFields: 2,
    detect(fields, semanticTypes) {
      const emailField = hasFieldMatching(fields, [/email/i, /^e.?mail$/i]);
      const phoneField = hasFieldMatching(fields, [/phone/i, /mobile/i, /(?:^|_)tel(?:$|_)/i, /(?:^|_)cell(?:$|_)/i]);

      // Also check semantic types
      if (!emailField && !phoneField) {
        for (const [name] of Object.entries(fields)) {
          if (hasSemanticType(name, semanticTypes, ['email', 'phone'])) {
            // Found at least one contact semantic field — look for a pair
            const otherContact = Object.keys(fields).find(
              n => n !== name && hasSemanticType(n, semanticTypes, ['email', 'phone']),
            );
            if (otherContact) return [name, otherContact];
          }
        }
        return null;
      }

      if (emailField && phoneField) return [emailField, phoneField];
      return null;
    },
  },

  // 8. Dimensions → Dimensions
  {
    id: 'dimensions',
    name: 'Dimensions',
    compositeComponent: 'Dimensions',
    selectionBoost: 0.20,
    slotGroup: 'sizing',
    maxFields: 3,
    detect(fields) {
      const widthField = hasFieldMatching(fields, [/^width$/i, /^w$/i]);
      const heightField = hasFieldMatching(fields, [/^height$/i, /^h$/i]);

      if (widthField && heightField) {
        const matched = [widthField, heightField];
        const depth = hasFieldMatching(fields, [/^depth$/i, /^d$/i, /^length$/i, /^l$/i]);
        if (depth) matched.push(depth);
        return matched;
      }

      // length + width combo
      const lengthField = hasFieldMatching(fields, [/^length$/i]);
      if (lengthField && widthField) return [lengthField, widthField];

      return null;
    },
  },
];

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Detect multi-field semantic patterns in an object's field schema.
 *
 * Returns all detected patterns, consumed fields, and ungrouped fields.
 * Each field is consumed by at most one pattern (first match wins).
 */
export function detectFieldPatterns(
  fields: Record<string, FieldDefinition>,
  semanticTypes?: Record<string, string>,
): PatternDetectionResult {
  const consumed = new Set<string>();
  const patterns: FieldPatternMatch[] = [];

  for (const rule of PATTERN_RULES) {
    const matched = rule.detect(fields, semanticTypes);
    if (!matched || matched.length === 0) continue;

    // Skip if any matched field is already consumed
    if (matched.some(f => consumed.has(f))) continue;

    for (const f of matched) consumed.add(f);

    patterns.push({
      patternId: rule.id,
      name: rule.name,
      matchedFields: matched,
      compositeComponent: rule.compositeComponent,
      selectionBoost: rule.selectionBoost,
      slotGroup: rule.slotGroup,
      confidence: Math.round((matched.length / rule.maxFields) * 100) / 100,
    });
  }

  const ungroupedFields = Object.keys(fields).filter(f => !consumed.has(f));

  return { patterns, consumedFields: consumed, ungroupedFields };
}

/**
 * Get the selection boost for a component based on detected patterns.
 *
 * If the component matches a detected pattern's composite component,
 * returns the pattern's boost. Otherwise returns 0.
 */
export function getPatternBoost(
  componentName: string,
  patterns: FieldPatternMatch[],
): { boost: number; reason: string } {
  for (const pattern of patterns) {
    if (componentName === pattern.compositeComponent) {
      return {
        boost: pattern.selectionBoost,
        reason: `multi-field pattern: ${pattern.name} (${pattern.matchedFields.join(', ')})`,
      };
    }
  }
  return { boost: 0, reason: '' };
}

/**
 * Build pattern-aware field groups for slot-expander integration.
 *
 * Returns a map where pattern-matched fields are grouped by their
 * slotGroup name, and ungrouped fields are returned separately.
 */
export function buildPatternGroups(
  result: PatternDetectionResult,
): Record<string, string[]> {
  const groups: Record<string, string[]> = {};

  for (const pattern of result.patterns) {
    const existing = groups[pattern.slotGroup] ?? [];
    existing.push(...pattern.matchedFields);
    groups[pattern.slotGroup] = existing;
  }

  if (result.ungroupedFields.length > 0) {
    groups['general'] = result.ungroupedFields;
  }

  return groups;
}

/**
 * Get the total number of defined pattern rules.
 */
export function getPatternRuleCount(): number {
  return PATTERN_RULES.length;
}

/**
 * Every composite component a pattern group can name, read from the rules themselves so the target
 * contracts cannot fall behind the composer: until Sprint 203 the Stack contract admitted only
 * StatusTimeline, and the first object with both a start and an end date composed a DateRange group
 * that generation then refused.
 */
export const PATTERN_COMPOSITE_COMPONENTS: readonly string[] =
  [...new Set(PATTERN_RULES.map(rule => rule.compositeComponent))].sort();
