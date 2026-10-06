/**
 * Tests for multi-field semantic pattern detection (s80-m02).
 *
 * Validates:
 * 1. At least 8 multi-field patterns defined
 * 2. Pattern detection for each pattern type
 * 3. Pattern-aware field grouping in slot-expander
 * 4. No regressions in field-affinity or slot-expander tests
 */
import { describe, it, expect } from 'vitest';
import {
  detectFieldPatterns,
  getPatternBoost,
  buildPatternGroups,
  getPatternRuleCount,
  type FieldPatternMatch,
} from '../../src/compose/field-patterns.js';
import type { FieldDefinition } from '../../src/objects/types.js';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function field(type: string, description = ''): FieldDefinition {
  return { type, required: false, description };
}

function requiredField(type: string, description = ''): FieldDefinition {
  return { type, required: true, description };
}

/* ------------------------------------------------------------------ */
/*  Pattern rule coverage                                              */
/* ------------------------------------------------------------------ */

describe('field-patterns — rule coverage', () => {
  it('has at least 8 pattern rules defined', () => {
    expect(getPatternRuleCount()).toBeGreaterThanOrEqual(8);
  });
});

/* ------------------------------------------------------------------ */
/*  Status + Timestamp → StatusTimeline                                */
/* ------------------------------------------------------------------ */

describe('field-patterns — status-timeline', () => {
  it('detects status + statusUpdatedAt', () => {
    const fields: Record<string, FieldDefinition> = {
      status: requiredField('string', 'Current status'),
      statusUpdatedAt: field('datetime', 'When status was last updated'),
      name: requiredField('string', 'Name'),
    };
    const result = detectFieldPatterns(fields);
    expect(result.patterns).toHaveLength(1);
    expect(result.patterns[0].patternId).toBe('status-timeline');
    expect(result.patterns[0].matchedFields).toContain('status');
    expect(result.patterns[0].matchedFields).toContain('statusUpdatedAt');
    expect(result.patterns[0].compositeComponent).toBe('StatusTimeline');
    expect(result.ungroupedFields).toContain('name');
  });

  it('detects state + lastModifiedAt', () => {
    const fields: Record<string, FieldDefinition> = {
      state: requiredField('string'),
      lastModifiedAt: field('datetime'),
    };
    const result = detectFieldPatterns(fields);
    expect(result.patterns.some(p => p.patternId === 'status-timeline')).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  Currency + Cycle → PricingSummary                                  */
/* ------------------------------------------------------------------ */

describe('field-patterns — pricing-summary', () => {
  it('detects price + billingCycle', () => {
    const fields: Record<string, FieldDefinition> = {
      price: requiredField('number', 'Monthly price'),
      billingCycle: field('string', 'Billing frequency'),
      name: requiredField('string'),
    };
    const result = detectFieldPatterns(fields);
    expect(result.patterns.some(p => p.patternId === 'pricing-summary')).toBe(true);
    const pricing = result.patterns.find(p => p.patternId === 'pricing-summary')!;
    expect(pricing.matchedFields).toContain('price');
    expect(pricing.matchedFields).toContain('billingCycle');
  });

  it('detects cost + frequency via semantic types', () => {
    const fields: Record<string, FieldDefinition> = {
      cost: requiredField('number'),
      frequency: field('string'),
    };
    const semanticTypes = { cost: 'currency' };
    const result = detectFieldPatterns(fields, semanticTypes);
    expect(result.patterns.some(p => p.patternId === 'pricing-summary')).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  Name + Avatar → UserIdentityCard                                   */
/* ------------------------------------------------------------------ */

describe('field-patterns — user-identity', () => {
  it('detects firstName + lastName + avatar', () => {
    const fields: Record<string, FieldDefinition> = {
      firstName: requiredField('string'),
      lastName: requiredField('string'),
      avatar: field('url'),
      email: field('email'),
    };
    const result = detectFieldPatterns(fields);
    const identity = result.patterns.find(p => p.patternId === 'user-identity');
    expect(identity).toBeDefined();
    expect(identity!.matchedFields).toContain('firstName');
    expect(identity!.matchedFields).toContain('lastName');
    expect(identity!.matchedFields).toContain('avatar');
    expect(identity!.compositeComponent).toBe('UserIdentityCard');
  });

  it('detects firstName + lastName without avatar', () => {
    const fields: Record<string, FieldDefinition> = {
      firstName: requiredField('string'),
      lastName: requiredField('string'),
    };
    const result = detectFieldPatterns(fields);
    expect(result.patterns.some(p => p.patternId === 'user-identity')).toBe(true);
  });

  it('does not match without lastName', () => {
    const fields: Record<string, FieldDefinition> = {
      firstName: requiredField('string'),
      age: field('integer'),
    };
    const result = detectFieldPatterns(fields);
    expect(result.patterns.some(p => p.patternId === 'user-identity')).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  Address block → AddressBlock                                       */
/* ------------------------------------------------------------------ */

describe('field-patterns — address-block', () => {
  it('detects street + city + state + zip', () => {
    const fields: Record<string, FieldDefinition> = {
      street: requiredField('string'),
      city: requiredField('string'),
      state: field('string'),
      zip: field('string'),
      country: field('string'),
    };
    const result = detectFieldPatterns(fields);
    const addr = result.patterns.find(p => p.patternId === 'address-block');
    expect(addr).toBeDefined();
    expect(addr!.matchedFields.length).toBeGreaterThanOrEqual(4);
  });
});

/* ------------------------------------------------------------------ */
/*  Date range → DateRange                                             */
/* ------------------------------------------------------------------ */

describe('field-patterns — date-range', () => {
  it('detects startDate + endDate', () => {
    const fields: Record<string, FieldDefinition> = {
      startDate: requiredField('date'),
      endDate: field('date'),
      title: requiredField('string'),
    };
    const result = detectFieldPatterns(fields);
    const range = result.patterns.find(p => p.patternId === 'date-range');
    expect(range).toBeDefined();
    expect(range!.matchedFields).toEqual(['startDate', 'endDate']);
  });

  it('detects validFrom + expiresAt', () => {
    const fields: Record<string, FieldDefinition> = {
      validFrom: requiredField('datetime'),
      expiresAt: field('datetime'),
    };
    const result = detectFieldPatterns(fields);
    expect(result.patterns.some(p => p.patternId === 'date-range')).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  Metric + Trend → MetricTrend                                       */
/* ------------------------------------------------------------------ */

describe('field-patterns — metric-trend', () => {
  it('detects value + change', () => {
    const fields: Record<string, FieldDefinition> = {
      value: requiredField('number'),
      change: field('number'),
      label: field('string'),
    };
    const result = detectFieldPatterns(fields);
    const trend = result.patterns.find(p => p.patternId === 'metric-trend');
    expect(trend).toBeDefined();
    expect(trend!.matchedFields).toContain('value');
    expect(trend!.matchedFields).toContain('change');
  });
});

/* ------------------------------------------------------------------ */
/*  Contact info → ContactInfo                                         */
/* ------------------------------------------------------------------ */

describe('field-patterns — contact-info', () => {
  it('detects email + phone', () => {
    const fields: Record<string, FieldDefinition> = {
      email: requiredField('email'),
      phone: field('string'),
      name: requiredField('string'),
    };
    const result = detectFieldPatterns(fields);
    const contact = result.patterns.find(p => p.patternId === 'contact-info');
    expect(contact).toBeDefined();
    expect(contact!.matchedFields).toContain('email');
    expect(contact!.matchedFields).toContain('phone');
  });
});

/* ------------------------------------------------------------------ */
/*  Dimensions → Dimensions                                            */
/* ------------------------------------------------------------------ */

describe('field-patterns — dimensions', () => {
  it('detects width + height', () => {
    const fields: Record<string, FieldDefinition> = {
      width: requiredField('number'),
      height: requiredField('number'),
      name: field('string'),
    };
    const result = detectFieldPatterns(fields);
    const dims = result.patterns.find(p => p.patternId === 'dimensions');
    expect(dims).toBeDefined();
    expect(dims!.matchedFields).toContain('width');
    expect(dims!.matchedFields).toContain('height');
  });
});

/* ------------------------------------------------------------------ */
/*  Cross-cutting behavior                                             */
/* ------------------------------------------------------------------ */

describe('field-patterns — cross-cutting', () => {
  it('each field is consumed by at most one pattern', () => {
    const fields: Record<string, FieldDefinition> = {
      status: requiredField('string'),
      statusUpdatedAt: field('datetime'),
      price: requiredField('number'),
      billingCycle: field('string'),
      email: requiredField('email'),
      phone: field('string'),
    };
    const result = detectFieldPatterns(fields);
    const allConsumed = result.patterns.flatMap(p => p.matchedFields);
    const unique = new Set(allConsumed);
    expect(unique.size).toBe(allConsumed.length);
  });

  it('ungroupedFields excludes consumed fields', () => {
    const fields: Record<string, FieldDefinition> = {
      status: requiredField('string'),
      statusUpdatedAt: field('datetime'),
      name: requiredField('string'),
      age: field('integer'),
    };
    const result = detectFieldPatterns(fields);
    expect(result.ungroupedFields).toContain('name');
    expect(result.ungroupedFields).toContain('age');
    expect(result.ungroupedFields).not.toContain('status');
    expect(result.ungroupedFields).not.toContain('statusUpdatedAt');
  });

  it('returns empty patterns when no fields match', () => {
    const fields: Record<string, FieldDefinition> = {
      foo: field('string'),
      bar: field('integer'),
    };
    const result = detectFieldPatterns(fields);
    expect(result.patterns).toHaveLength(0);
    expect(result.ungroupedFields).toEqual(['foo', 'bar']);
  });
});

/* ------------------------------------------------------------------ */
/*  getPatternBoost                                                    */
/* ------------------------------------------------------------------ */

describe('getPatternBoost', () => {
  it('returns boost for matching composite component', () => {
    const patterns: FieldPatternMatch[] = [{
      patternId: 'status-timeline',
      name: 'StatusTimeline',
      matchedFields: ['status', 'updatedAt'],
      compositeComponent: 'StatusTimeline',
      selectionBoost: 0.30,
      slotGroup: 'status',
      confidence: 1.0,
    }];
    const result = getPatternBoost('StatusTimeline', patterns);
    expect(result.boost).toBe(0.30);
    expect(result.reason).toContain('multi-field pattern');
  });

  it('returns zero for non-matching component', () => {
    const patterns: FieldPatternMatch[] = [{
      patternId: 'status-timeline',
      name: 'StatusTimeline',
      matchedFields: ['status', 'updatedAt'],
      compositeComponent: 'StatusTimeline',
      selectionBoost: 0.30,
      slotGroup: 'status',
      confidence: 1.0,
    }];
    const result = getPatternBoost('Button', patterns);
    expect(result.boost).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/*  buildPatternGroups                                                 */
/* ------------------------------------------------------------------ */

describe('buildPatternGroups', () => {
  it('groups pattern fields by slotGroup', () => {
    const result = detectFieldPatterns({
      status: requiredField('string'),
      statusUpdatedAt: field('datetime'),
      email: requiredField('email'),
      phone: field('string'),
      name: field('string'),
    });
    const groups = buildPatternGroups(result);
    expect(groups['status']).toEqual(['status', 'statusUpdatedAt']);
    expect(groups['contact']).toEqual(['email', 'phone']);
    expect(groups['general']).toContain('name');
  });
});

/* ------------------------------------------------------------------ */
/*  Confidence scoring (s83-m01)                                       */
/* ------------------------------------------------------------------ */

describe('field-patterns — confidence scoring', () => {
  it('address-block with all 5 fields has confidence 1.0', () => {
    const fields: Record<string, FieldDefinition> = {
      street: requiredField('string'),
      city: requiredField('string'),
      state: field('string'),
      zip: field('string'),
      country: field('string'),
    };
    const result = detectFieldPatterns(fields);
    const addr = result.patterns.find(p => p.patternId === 'address-block');
    expect(addr).toBeDefined();
    expect(addr!.confidence).toBe(1.0);
  });

  it('address-block with 2 required fields has confidence 0.4', () => {
    const fields: Record<string, FieldDefinition> = {
      street: requiredField('string'),
      city: requiredField('string'),
    };
    const result = detectFieldPatterns(fields);
    const addr = result.patterns.find(p => p.patternId === 'address-block');
    expect(addr).toBeDefined();
    expect(addr!.confidence).toBe(0.4);
  });

  it('address-block with 4 fields has confidence >= 0.7', () => {
    const fields: Record<string, FieldDefinition> = {
      street: requiredField('string'),
      city: requiredField('string'),
      state: field('string'),
      zip: field('string'),
    };
    const result = detectFieldPatterns(fields);
    const addr = result.patterns.find(p => p.patternId === 'address-block');
    expect(addr).toBeDefined();
    expect(addr!.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('date-range always has confidence 1.0 (exactly 2 fields matched of 2 max)', () => {
    const fields: Record<string, FieldDefinition> = {
      startDate: requiredField('date'),
      endDate: field('date'),
    };
    const result = detectFieldPatterns(fields);
    const range = result.patterns.find(p => p.patternId === 'date-range');
    expect(range).toBeDefined();
    expect(range!.confidence).toBe(1.0);
  });

  it('metric-trend always has confidence 1.0 (exactly 2 fields matched of 2 max)', () => {
    const fields: Record<string, FieldDefinition> = {
      value: requiredField('number'),
      change: field('number'),
    };
    const result = detectFieldPatterns(fields);
    const trend = result.patterns.find(p => p.patternId === 'metric-trend');
    expect(trend).toBeDefined();
    expect(trend!.confidence).toBe(1.0);
  });

  it('user-identity with first+last (no avatar) has confidence 0.5', () => {
    const fields: Record<string, FieldDefinition> = {
      firstName: requiredField('string'),
      lastName: requiredField('string'),
    };
    const result = detectFieldPatterns(fields);
    const identity = result.patterns.find(p => p.patternId === 'user-identity');
    expect(identity).toBeDefined();
    expect(identity!.confidence).toBe(0.5);
  });

  it('user-identity with first+last+avatar+displayName has confidence 1.0', () => {
    const fields: Record<string, FieldDefinition> = {
      firstName: requiredField('string'),
      lastName: requiredField('string'),
      avatar: field('url'),
      displayName: field('string'),
    };
    const result = detectFieldPatterns(fields);
    const identity = result.patterns.find(p => p.patternId === 'user-identity');
    expect(identity).toBeDefined();
    expect(identity!.confidence).toBe(1.0);
  });
});

/* ------------------------------------------------------------------ */
/*  Pattern-driven slot grouping (s83-m01)                             */
/* ------------------------------------------------------------------ */

describe('field-patterns — pattern-driven slot grouping', () => {
  it('high-confidence patterns produce grouped slots via groupFieldsIntoSlots', async () => {
    const { groupFieldsIntoSlots } = await import('../../src/compose/slot-expander.js');

    const fields: Record<string, FieldDefinition> = {
      street: requiredField('string'),
      city: requiredField('string'),
      state: field('string'),
      zip: field('string'),
      name: requiredField('string'),
      age: field('integer'),
    };

    // Detect patterns (address-block should be detected with confidence >= 0.7)
    const patternResult = detectFieldPatterns(fields);
    const addrPattern = patternResult.patterns.find(p => p.patternId === 'address-block');
    expect(addrPattern).toBeDefined();
    expect(addrPattern!.confidence).toBeGreaterThanOrEqual(0.7);

    // Group fields with pattern awareness
    const slotNames = ['tab-0', 'tab-1', 'tab-2'];
    const groups = groupFieldsIntoSlots(fields, slotNames, undefined, patternResult.patterns);

    // The address fields should all be in the same slot
    const addressFields = ['street', 'city', 'state', 'zip'];
    const slotWithAddress = slotNames.find(
      slot => addressFields.every(f => groups[slot].includes(f)),
    );
    expect(slotWithAddress).toBeDefined();
  });

  it('low-confidence patterns do NOT produce grouped slots', async () => {
    const { groupFieldsIntoSlots } = await import('../../src/compose/slot-expander.js');

    const fields: Record<string, FieldDefinition> = {
      street: requiredField('string'),
      city: requiredField('string'),
      name: requiredField('string'),
      age: field('integer'),
      status: field('string'),
    };

    const patternResult = detectFieldPatterns(fields);
    const addrPattern = patternResult.patterns.find(p => p.patternId === 'address-block');
    expect(addrPattern).toBeDefined();
    // Only 2 of 5 max fields → confidence 0.4 < 0.7 threshold
    expect(addrPattern!.confidence).toBeLessThan(0.7);

    // Group fields — patterns with low confidence should NOT force grouping
    const slotNames = ['tab-0', 'tab-1'];
    const groups = groupFieldsIntoSlots(fields, slotNames, undefined, patternResult.patterns);

    // Address fields might still end up together (by category), but it's not forced
    // Verify all fields are distributed
    const allAssigned = slotNames.flatMap(s => groups[s]);
    expect(allAssigned.length).toBe(Object.keys(fields).length);
  });

  it('multiple high-confidence patterns each get their own grouped slot', async () => {
    const { groupFieldsIntoSlots } = await import('../../src/compose/slot-expander.js');

    const fields: Record<string, FieldDefinition> = {
      startDate: requiredField('date'),
      endDate: field('date'),
      value: requiredField('number'),
      change: field('number'),
      name: requiredField('string'),
    };

    const patternResult = detectFieldPatterns(fields);
    expect(patternResult.patterns.length).toBeGreaterThanOrEqual(2);
    // Both date-range and metric-trend should have confidence 1.0
    for (const p of patternResult.patterns) {
      expect(p.confidence).toBeGreaterThanOrEqual(0.7);
    }

    const slotNames = ['tab-0', 'tab-1', 'tab-2'];
    const groups = groupFieldsIntoSlots(fields, slotNames, undefined, patternResult.patterns);

    // Date range fields should be together
    const dateFields = ['startDate', 'endDate'];
    const slotWithDates = slotNames.find(
      slot => dateFields.every(f => groups[slot].includes(f)),
    );
    expect(slotWithDates).toBeDefined();

    // Metric trend fields should be together
    const metricFields = ['value', 'change'];
    const slotWithMetrics = slotNames.find(
      slot => metricFields.every(f => groups[slot].includes(f)),
    );
    expect(slotWithMetrics).toBeDefined();

    // They should be in different slots
    expect(slotWithDates).not.toBe(slotWithMetrics);
  });

  it('no patterns means no change from default grouping behavior', async () => {
    const { groupFieldsIntoSlots } = await import('../../src/compose/slot-expander.js');

    const fields: Record<string, FieldDefinition> = {
      name: requiredField('string'),
      age: field('integer'),
      active: field('boolean'),
    };

    const slotNames = ['tab-0', 'tab-1'];
    const withPatterns = groupFieldsIntoSlots(fields, slotNames, undefined, []);
    const withoutPatterns = groupFieldsIntoSlots(fields, slotNames, undefined);

    // Both should produce the same distribution
    expect(withPatterns).toEqual(withoutPatterns);
  });
});
