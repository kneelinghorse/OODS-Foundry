import AjvImport from 'ajv';
import addFormats from 'ajv-formats';
import RandExp from 'randexp';
import { canonical, hash, type MapValue } from './source.js';

const ajv = new (AjvImport as any)({ strict: false, validateFormats: true, multipleOfPrecision: 12, logger: false });
(addFormats as any)(ajv);
// These formats are declarations used by readers, beyond JSON Schema's standard set.
ajv.addFormat('phone', /^\+[1-9]\d{6,14}$/);
ajv.addFormat('iso-4217', /^[A-Z]{3}$/);
ajv.addFormat('iso-3166-1-alpha-2', /^[A-Z]{2}$/);
const validators = new Map<string, (value: unknown) => boolean>();
const constraints = ['type', 'enum', 'const', 'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf', 'minLength', 'maxLength', 'pattern', 'format', 'minItems', 'maxItems', 'uniqueItems'];
function contract(schema: MapValue): MapValue {
  const result = Object.fromEntries(constraints.filter(key => schema[key] !== undefined).map(key => [key, schema[key]]));
  if (schema.type === 'array' && schema.items) result.items = contract(schema.items);
  return result;
}
export function validSample(schema: MapValue, value: unknown): boolean {
  const shape = contract(schema), key = canonical(shape);
  let validate = validators.get(key);
  if (!validate) {
    try { validate = ajv.compile(shape); } catch { return false; }
    // A large API must not retain a compiled validator for every field indefinitely.
    if (validators.size >= 2048) validators.clear();
    validators.set(key, validate!);
  }
  return validate!(value);
}

/** Bounded, deterministic illustrative data. Every candidate is checked before it can reach a screen. */
export function sampleValue(schema: MapValue, field: string, index: number): unknown {
  const examples = schema.examples ?? (schema.example !== undefined ? [schema.example] : []);
  const supplied = Array.isArray(examples) ? examples.filter(value => validSample(schema, value)) : [];
  if (index < supplied.length) return supplied[index];
  if (schema.const !== undefined && validSample(schema, schema.const)) return schema.const;
  if (Array.isArray(schema.enum) && schema.enum.length) {
    const values = schema.enum.filter((value: unknown) => validSample(schema, value));
    return values[index % values.length];
  }
  const type = Array.isArray(schema.type) ? schema.type.find((value: string) => value !== 'null') : schema.type;
  let value: unknown;
  if (type === 'boolean') value = index % 2 === 0;
  else if (type === 'integer' || type === 'number') {
    const step = schema.multipleOf > 0 ? schema.multipleOf : 1;
    const lo = Math.max(schema.minimum ?? -Infinity, typeof schema.exclusiveMinimum === 'number' ? schema.exclusiveMinimum + step : -Infinity);
    const hi = Math.min(schema.maximum ?? Infinity, typeof schema.exclusiveMaximum === 'number' ? schema.exclusiveMaximum - step : Infinity);
    // Prefer ordinary positive values where legal; a machine integer bound is not a useful invoice number.
    const anchor = Math.min(Math.max(1, lo), hi);
    const start = Math.min(Math.ceil(anchor / step), Math.floor(hi / step)) * step;
    const count = Math.max(1, Math.floor((hi - start) / step) + 1);
    value = Number((start + (index % count) * step).toPrecision(14));
  } else if (type === 'array') {
    const count = Math.min(schema.maxItems ?? 3, Math.max(schema.minItems ?? 0, 2));
    if (count > 64) return undefined;
    value = Array.from({ length: count }, (_, n) => sampleValue(schema.items ?? { type: 'string' }, field, index + n));
  } else if (type === 'string') {
    const n = index + 1;
    const formatted: Record<string, string> = {
      date: `2026-01-${String(n % 28 || 28).padStart(2, '0')}`,
      'date-time': `2026-01-${String(n % 28 || 28).padStart(2, '0')}T12:00:00Z`,
      time: `12:${String(index % 60).padStart(2, '0')}:00Z`,
      email: `person${n}@example.com`, hostname: `host${n}.example.com`,
      uri: `https://example.com/records/${n}`, url: `https://example.com/records/${n}`,
      uuid: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
      ipv4: `192.0.2.${n % 254 || 1}`, ipv6: `2001:db8::${n}`,
      phone: `+1202555${String(100 + n).padStart(4, '0')}`,
      'iso-4217': ['USD', 'EUR', 'GBP'][index % 3], 'iso-3166-1-alpha-2': ['US', 'GB', 'CA'][index % 3],
    };
    value = formatted[schema.format] ?? `${field.replace(/_/g, ' ')} ${n}`;
    if (!schema.format) {
      const min = Math.min(schema.minLength ?? 0, 4096), max = Math.min(schema.maxLength ?? 120, 4096);
      if (max > 0 && String(value).length > max) value = `${String(value).slice(0, Math.max(0, max - String(n).length))}${n}`.slice(-max);
      value = String(value).padEnd(min, 'x').slice(0, max);
    }
    if (schema.pattern && !validSample(schema, value)) {
      try {
        const generator = new RandExp(schema.pattern);
        generator.max = Math.min(schema.maxLength ?? 20, 64);
        // Refuse huge explicit repetitions before randexp allocates them.
        if (/\{\d{5,}(?:,\d*)?\}|\{\d*,\d{5,}\}/.test(schema.pattern)) return undefined;
        let seed = parseInt(hash(`${field}:${index}`).slice(0, 8), 16);
        generator.randInt = (from, to) => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return from + seed % (to - from + 1); };
        for (let attempt = 0; attempt < 24; attempt++) {
          const candidate = generator.gen();
          if (validSample(schema, candidate)) return candidate;
        }
      } catch { /* Unsupported patterns have an explicit missing-sample outcome. */ }
    }
  }
  if (value !== undefined && validSample(schema, value)) return value;
  if (supplied.length) return supplied[index % supplied.length];
  if (schema.default !== undefined && validSample(schema, schema.default)) return schema.default;
  if (Array.isArray(schema.type) && schema.type.includes('null') && validSample(schema, null)) return null;
  return undefined;
}
