/**
 * Coercion engine for map prop mappings.
 * Applies typed transforms to source values during map_resolve.
 */
import type { CoercionDef } from './map.shared.js';

export class CoercionError extends Error {
  constructor(
    public readonly coercionType: string,
    message: string,
  ) {
    super(message);
    this.name = 'CoercionError';
  }
}

/**
 * Apply a coercion transform to a value.
 * Throws CoercionError on type mismatch.
 */
export function coerce(value: unknown, coercion: CoercionDef): unknown {
  switch (coercion.type) {
    case 'identity':
      return value;

    case 'enum': {
      const key = String(value);
      if (!(key in coercion.mapping)) {
        throw new CoercionError(
          'enum',
          `No mapping for value '${key}'. Valid keys: ${Object.keys(coercion.mapping).join(', ')}`,
        );
      }
      return coercion.mapping[key];
    }

    case 'boolean_to_string': {
      if (typeof value !== 'boolean') {
        throw new CoercionError(
          'boolean_to_string',
          `Expected boolean, got ${typeof value}`,
        );
      }
      return value ? coercion.trueValue : coercion.falseValue;
    }

    case 'template': {
      return coercion.pattern.replace(/\{\{value\}\}/g, String(value));
    }

    default: {
      const _exhaustive: never = coercion;
      throw new CoercionError('unknown', `Unknown coercion type: ${(_exhaustive as any).type}`);
    }
  }
}

/**
 * Normalize legacy null coercion to identity.
 */
export function normalizeCoercion(coercion: CoercionDef | null | undefined): CoercionDef {
  if (coercion == null) {
    return { type: 'identity' };
  }
  return coercion;
}
