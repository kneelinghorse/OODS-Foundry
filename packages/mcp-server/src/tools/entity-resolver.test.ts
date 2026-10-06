import { describe, it, expect, beforeEach } from 'vitest';
import {
  CANONICAL_NAME_MIN_CONFIDENCE,
  clearEntityAliasCache,
  isResolved,
  resolveEntity,
  slugifyEntityId,
  stripEntityPrefix,
} from './entity-resolver.js';

const KNOWN = new Set([
  'Customer',
  'Organization',
  'Subscription',
  'User',
  'UserRole',
  'Address',
]);

// Alias table matching the shipped docs/integration/stage1-entity-aliases.json
// surface. We inject rather than read the file in unit tests so the resolver's
// IO path is covered separately (by the E2E spec reading a real Stage1 run).
const ALIASES: Record<string, string> = {
  'entity-customer': 'Customer',
  'entity-companies': 'Company', // maps to a name not in the OODS index → should fall through
  'entity-changelog': 'Changelog', // also not in index
  'entity-account': 'Organization', // valid alias: maps to known Organization
};

beforeEach(() => {
  clearEntityAliasCache();
});

describe('stripEntityPrefix (contract v1.2.4 §3)', () => {
  it('strips the entity- prefix and lowercases the rest', () => {
    // Stage1 normalizes name shaping upstream, so the slug is already the
    // final form. OODS should NOT split, PascalCase, or singularize.
    expect(stripEntityPrefix('entity-customer')).toBe('customer');
    expect(stripEntityPrefix('entity-user')).toBe('user');
    expect(stripEntityPrefix('entity-userrole')).toBe('userrole');
    expect(stripEntityPrefix('entity-address')).toBe('address');
  });

  it('preserves the stripped form verbatim (no singularization)', () => {
    // Per §3 ¶126: consumer must not mirror Stage1's internal slugify.ts.
    expect(stripEntityPrefix('entity-customers')).toBe('customers');
    expect(stripEntityPrefix('entity-addresses')).toBe('addresses');
  });

  it('returns empty string for empty / prefix-only input', () => {
    expect(stripEntityPrefix('')).toBe('');
    expect(stripEntityPrefix('entity-')).toBe('');
  });
});

describe('slugifyEntityId (deprecated shim)', () => {
  it('delegates to stripEntityPrefix to keep older callers compiling', () => {
    expect(slugifyEntityId('entity-customer')).toBe(stripEntityPrefix('entity-customer'));
    expect(slugifyEntityId('entity-userrole')).toBe('userrole');
  });
});

describe('resolveEntity — canonical_name hint path', () => {
  it('honors canonical_name when confidence ≥ threshold and object exists', () => {
    const result = resolveEntity('entity-customer', {
      canonicalName: 'Customer',
      canonicalNameConfidence: CANONICAL_NAME_MIN_CONFIDENCE,
      knownObjects: KNOWN,
      aliases: ALIASES,
    });
    expect(result.via).toBe('canonical_name');
    if (result.via !== 'unresolved') {
      expect(result.objectName).toBe('Customer');
      expect(result.confidence).toBe(CANONICAL_NAME_MIN_CONFIDENCE);
    }
  });

  it('ignores canonical_name below confidence threshold (falls through)', () => {
    const result = resolveEntity('entity-customer', {
      canonicalName: 'Customer',
      canonicalNameConfidence: 0.74,
      knownObjects: KNOWN,
      aliases: ALIASES,
    });
    // Alias table also hits here → resolves via alias, not canonical_name.
    expect(result.via).toBe('alias');
  });

  it('ignores canonical_name when the hinted object is not indexed', () => {
    const result = resolveEntity('entity-widget', {
      canonicalName: 'Widget',
      canonicalNameConfidence: 0.95,
      knownObjects: KNOWN,
      aliases: ALIASES,
    });
    expect(result.via).toBe('unresolved');
  });

  it('overrides alias when both are present (canonical_name wins)', () => {
    const result = resolveEntity('entity-account', {
      canonicalName: 'User',
      canonicalNameConfidence: 0.9,
      knownObjects: KNOWN,
      aliases: ALIASES,
    });
    expect(result.via).toBe('canonical_name');
    if (result.via !== 'unresolved') expect(result.objectName).toBe('User');
  });
});

describe('resolveEntity — alias table path', () => {
  it('resolves via alias when the alias target exists in the object index', () => {
    const result = resolveEntity('entity-account', {
      knownObjects: KNOWN,
      aliases: ALIASES,
    });
    expect(result.via).toBe('alias');
    if (result.via !== 'unresolved') expect(result.objectName).toBe('Organization');
  });

  it('falls through when the alias target is NOT in the object index', () => {
    const result = resolveEntity('entity-companies', {
      knownObjects: KNOWN,
      aliases: ALIASES,
    });
    // slugified would be "Companie" which is also not indexed → unresolved.
    expect(result.via).toBe('unresolved');
    if (result.via === 'unresolved') {
      expect(result.reason).toContain('Company');
    }
  });
});

describe('resolveEntity — §3 narrow slug fallback path', () => {
  it('case-insensitively matches the stripped id against known object names', () => {
    // Stage1 emits `entity-userrole` (lowercased upstream), OODS object is
    // `UserRole`. Lowercase-equality match returns the canonical OODS casing.
    const result = resolveEntity('entity-userrole', {
      knownObjects: KNOWN,
      aliases: ALIASES,
    });
    expect(result.via).toBe('slug');
    if (result.via !== 'unresolved') expect(result.objectName).toBe('UserRole');
  });

  it('matches exact-lowercase id to the PascalCase OODS object', () => {
    const result = resolveEntity('entity-address', {
      knownObjects: KNOWN,
      aliases: {},
    });
    expect(result.via).toBe('slug');
    if (result.via !== 'unresolved') expect(result.objectName).toBe('Address');
  });

  it('does NOT singularize / PascalCase / strip punctuation (§3 ¶126 drift guard)', () => {
    // `entity-customers` (plural) must NOT be mapped to `Customer`. Stage1
    // normalizes plural→singular upstream; if this slug ever arrives it means
    // Stage1 genuinely emitted it and the consumer should respect that.
    const result = resolveEntity('entity-customers', {
      knownObjects: KNOWN,
      aliases: {},
    });
    expect(result.via).toBe('unresolved');
  });

  it('does NOT split on hyphens to PascalCase (§3 ¶126 drift guard)', () => {
    // If Stage1 were to emit `entity-user-role`, that would be an upstream
    // bug (hyphens should have been stripped before slug). Consumer refuses
    // to paper over it with PascalCase splitting.
    const result = resolveEntity('entity-user-role', {
      knownObjects: KNOWN,
      aliases: {},
    });
    expect(result.via).toBe('unresolved');
  });
});

describe('resolveEntity — §4 canonical_name taxonomy', () => {
  it('honors canonical_name at the exact 0.75 emission threshold', () => {
    const result = resolveEntity('entity-account', {
      canonicalName: 'Subscription',
      canonicalNameConfidence: 0.75,
      knownObjects: KNOWN,
      aliases: ALIASES,
    });
    expect(result.via).toBe('canonical_name');
    if (result.via !== 'unresolved') expect(result.objectName).toBe('Subscription');
  });

  it('honors canonical_name at max combined confidence (0.40 + 0.30 + 0.35 + 0.10 capped)', () => {
    // Sum-with-cap per §4.2: all four signals would total 1.15, capped at 1.0.
    const result = resolveEntity('entity-account', {
      canonicalName: 'User',
      canonicalNameConfidence: 1.0,
      knownObjects: KNOWN,
      aliases: {},
    });
    expect(result.via).toBe('canonical_name');
    if (result.via !== 'unresolved') expect(result.objectName).toBe('User');
  });

  it('sub-threshold confidence is a signal to fall through, not to honor the hint', () => {
    // §4.3: below 0.75 Stage1 omits canonical_name; on pure-DOM captures the
    // envelope carries { id, hint, confidence:0, signals:[] } but the hint
    // must NOT be treated as authoritative. Alias / slug paths take over.
    const result = resolveEntity('entity-account', {
      canonicalName: 'User',
      canonicalNameConfidence: 0.3,
      knownObjects: KNOWN,
      aliases: ALIASES,
    });
    // entity-account has a valid alias → Organization wins over sub-threshold
    // canonical_name hint.
    expect(result.via).toBe('alias');
    if (result.via !== 'unresolved') expect(result.objectName).toBe('Organization');
  });

  it('empty-state envelope { confidence: 0, signals: [] } falls through cleanly', () => {
    // Pure-DOM capture per §4 caveat (Stage1 Sprint 42 infrastructure gap).
    // Consumer should behave identically to "no canonical_name supplied".
    const withEmpty = resolveEntity('entity-customer', {
      canonicalName: '',
      canonicalNameConfidence: 0,
      knownObjects: KNOWN,
      aliases: ALIASES,
    });
    const withAbsent = resolveEntity('entity-customer', {
      knownObjects: KNOWN,
      aliases: ALIASES,
    });
    expect(withEmpty.via).toBe(withAbsent.via);
  });
});

describe('resolveEntity — unresolved retention', () => {
  it('returns unresolved for unknown entity ids', () => {
    const result = resolveEntity('entity-developer', {
      knownObjects: KNOWN,
      aliases: ALIASES,
    });
    expect(result.via).toBe('unresolved');
    if (result.via === 'unresolved') {
      expect(result.rawId).toBe('entity-developer');
      expect(result.reason).toContain('entity-developer');
    }
    expect(isResolved(result)).toBe(false);
  });

  it('returns unresolved for empty / missing input', () => {
    for (const input of [null, undefined, '', '   ']) {
      const result = resolveEntity(input, {
        knownObjects: KNOWN,
        aliases: ALIASES,
      });
      expect(result.via).toBe('unresolved');
    }
  });

  it('returns unresolved when alias maps to a non-indexed object', () => {
    const result = resolveEntity('entity-changelog', {
      knownObjects: KNOWN,
      aliases: ALIASES,
    });
    expect(result.via).toBe('unresolved');
    if (result.via === 'unresolved') {
      expect(result.reason).toContain('Changelog');
    }
  });
});

describe('isResolved type guard', () => {
  it('narrows to the resolved variants', () => {
    const resolved = resolveEntity('entity-customer', {
      knownObjects: KNOWN,
      aliases: ALIASES,
    });
    if (isResolved(resolved)) {
      // Compile-time: objectName must be present.
      expect(typeof resolved.objectName).toBe('string');
    } else {
      throw new Error('expected resolved');
    }
  });

  it('narrows unresolved path', () => {
    const result = resolveEntity('entity-nope', {
      knownObjects: KNOWN,
      aliases: ALIASES,
    });
    expect(isResolved(result)).toBe(false);
  });
});

describe('resolveEntity — default alias file integration', () => {
  it('reads docs/integration/stage1-entity-aliases.json when no override is provided', () => {
    // Exercises the default IO path end-to-end. The shipped alias file maps
    // entity-customer → User (pragmatic mapping against the current object
    // index). The test pins the happy path and proves unresolved retention for
    // an id that is neither aliased nor slug-resolvable.
    const known = new Set(['User']);
    const resolved = resolveEntity('entity-customer', { knownObjects: known });
    expect(resolved.via).toBe('alias');
    if (resolved.via !== 'unresolved') {
      expect(resolved.objectName).toBe('User');
    }

    const unresolved = resolveEntity('entity-quasar', { knownObjects: known });
    expect(unresolved.via).toBe('unresolved');
  });
});
