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

/** A field name's words: displayName, display_name and display-name all give ['display', 'name']; TripID gives ['trip', 'id']. */
function words(field: string): string[] {
  return field.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}
const pick = <T>(list: readonly T[], index: number): T => list[index % list.length]!;
const FIRST_NAMES = ['Ava', 'Ben', 'Chloe', 'Dev', 'Elena'];
const LAST_NAMES = ['Martin', 'Okafor', 'Chen', 'Silva', 'Novak'];
const CITIES = ['Lisbon', 'Austin', 'Osaka', 'Toronto', 'Nairobi'];
const STREETS = ['12 Harbour Street', '48 Elm Avenue', '7 Market Square', '230 King Road', '91 River Lane'];
const POSTAL_CODES = ['10115', '94107', '75008', '00144', '60601'];
const COUNTRY_CODES_2 = ['US', 'GB', 'CA', 'DE', 'JP'];
const COUNTRY_CODES_3 = ['USA', 'GBR', 'CAN', 'DEU', 'JPN'];
const COUNTRIES = ['United States', 'United Kingdom', 'Canada', 'Germany', 'Japan'];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD'];
const LOCALES = ['en-US', 'fr-FR', 'de-DE', 'ja-JP', 'es-ES'];
const COMPANIES = ['Northwind Traders', 'Acme Supply', 'Blue Harbor Co.', 'Juniper Labs', 'Summit Foods'];
// s239 (site SITE-11, second report): fields the generator did not recognise still read "Subject 3" or "Handle 3".
const TITLES = ['Quarterly review', 'Renewal reminder', 'Welcome aboard', 'Invoice follow-up', 'Project kickoff'];
const ROLES = ['Designer', 'Engineer', 'Analyst', 'Manager', 'Coordinator'];
const DEPARTMENTS = ['Finance', 'Design', 'Operations', 'Sales', 'Support'];
const CATEGORIES = ['General', 'Priority', 'Standard', 'Internal', 'External'];
const LATER = new Set(['end', 'ends', 'due', 'expires', 'expiry', 'expiration', 'until', 'finish', 'finished', 'close', 'closed', 'completed', 'deadline', 'to']);
const PROSE = new Set(['description', 'summary', 'notes', 'note', 'memo', 'comment', 'comments', 'body', 'details', 'bio', 'remarks']);
const CODES = new Set(['id', 'key', 'ref', 'reference', 'code', 'sku', 'number', 'no']);

/**
 * A realistic candidate for a plain string, read from the field's name: emails, people's names, places, ISO codes,
 * record codes and short prose instead of "email 3" or "cu3" (website audit SITE-11, 0.10.1). The name only chooses
 * the illustration; every candidate is still checked against the field's constraints, and a candidate that fails
 * falls back to the general generator.
 */
function namedString(schema: MapValue, field: string, index: number): string | undefined {
  const w = words(field), n = index + 1, last = w[w.length - 1] ?? '';
  const has = (...names: string[]) => names.some(name => w.includes(name));
  if (has('email') || (has('e') && has('mail'))) return `person${n}@example.com`;
  if (['phone', 'mobile', 'telephone', 'fax', 'tel'].includes(last)) return `+1202555${String(100 + n).padStart(4, '0')}`;
  if (has('url', 'website', 'homepage', 'uri', 'link')) return `https://example.com/records/${n}`;
  if (has('currency', 'ccy')) return pick(CURRENCIES, index);
  if (has('country')) return pick((schema.maxLength ?? Infinity) <= 2 ? COUNTRY_CODES_2 : schema.maxLength === 3 ? COUNTRY_CODES_3 : COUNTRIES, index);
  if (has('locale', 'language', 'lang')) return pick(LOCALES, index);
  if (has('name') && has('first', 'given', 'forename')) return pick(FIRST_NAMES, index);
  if (has('surname') || (has('name') && has('last', 'family'))) return pick(LAST_NAMES, index);
  if (has('city', 'town')) return pick(CITIES, index);
  if (has('street') || (has('address') && has('line')) || /^address[_-]?\d$/i.test(field)) return pick(STREETS, index);
  if (has('zip', 'postcode') || (has('postal') && has('code'))) return pick(POSTAL_CODES, index);
  if (has('company', 'organization', 'organisation', 'employer', 'vendor', 'supplier') && (last === 'name' || w.length === 1)) return pick(COMPANIES, index);
  if (has('handle', 'username', 'login', 'nickname') || (has('user', 'screen') && last === 'name')) return `${pick(FIRST_NAMES, index).toLowerCase()}.${pick(LAST_NAMES, index).toLowerCase()}`;
  if (has('full', 'display', 'contact', 'customer', 'person') && last === 'name') return `${pick(FIRST_NAMES, index)} ${pick(LAST_NAMES, index)}`;
  if ((has('job') && last === 'title') || ['role', 'position', 'occupation'].includes(last)) return pick(ROLES, index);
  if (['title', 'subject', 'headline', 'heading', 'caption', 'label'].includes(last)) return pick(TITLES, index);
  if (['department', 'dept', 'team', 'division'].includes(last)) return pick(DEPARTMENTS, index);
  if (['category', 'tag', 'type', 'kind', 'segment', 'tier'].includes(last)) return pick(CATEGORIES, index);
  if (PROSE.has(last)) return `Example ${w.join(' ')} for record ${n}.`;
  if (CODES.has(last)) {
    // INV-001 for invoiceNumber, TRIP-001 for TripID; the prefix shrinks to fit a short maximum length.
    const prefix = (w.length > 1 ? w.slice(0, -1).join('') : last).toUpperCase().replace(/[^A-Z0-9]/g, '');
    const room = Math.min(4, (schema.maxLength ?? 12) - 4);
    return room >= 1 ? `${prefix.slice(0, room)}-${String(n).padStart(3, '0')}` : undefined;
  }
  return undefined;
}

/** Ordinary values for amounts, ages, years and coordinates; checked like every other candidate. */
function namedNumber(type: string, field: string, index: number): number | undefined {
  const w = words(field), has = (...names: string[]) => names.some(name => w.includes(name));
  if (has('amount', 'total', 'price', 'cost', 'subtotal', 'balance', 'fee', 'revenue', 'salary', 'budget')) {
    if (has('cents', 'minor')) return pick([12950, 4200, 98025, 1599, 31000], index);
    return type === 'integer' ? pick([129, 42, 980, 16, 310], index) : pick([129.5, 42, 980.25, 15.99, 310], index);
  }
  if (has('age')) return pick([34, 27, 45, 52, 19], index);
  if (has('year')) return pick([2022, 2023, 2024, 2025, 2026], index);
  if (type === 'number' && has('lat', 'latitude')) return pick([38.7223, 30.2672, 34.6937, 43.6532, -1.2921], index);
  if (type === 'number' && has('lng', 'lon', 'long', 'longitude')) return pick([-9.1393, -97.7431, 135.5023, -79.3832, 36.8219], index);
  return undefined;
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
    const named = namedNumber(type, field, index);
    if (named !== undefined && validSample(schema, named)) return named;
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
    // s239: an end, due or expiry date falls two weeks after the record's start date instead of on the same day.
    const day = String(((index + (words(field).some(word => LATER.has(word)) ? 14 : 0)) % 28) + 1).padStart(2, '0');
    const formatted: Record<string, string> = {
      date: `2026-01-${day}`,
      'date-time': `2026-01-${day}T12:00:00Z`,
      time: `12:${String(index % 60).padStart(2, '0')}:00Z`,
      email: `person${n}@example.com`, hostname: `host${n}.example.com`,
      uri: `https://example.com/records/${n}`, url: `https://example.com/records/${n}`,
      uuid: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
      ipv4: `192.0.2.${n % 254 || 1}`, ipv6: `2001:db8::${n}`,
      phone: `+1202555${String(100 + n).padStart(4, '0')}`,
      'iso-4217': ['USD', 'EUR', 'GBP'][index % 3], 'iso-3166-1-alpha-2': ['US', 'GB', 'CA'][index % 3],
    };
    if (!schema.format) {
      const named = namedString(schema, field, index);
      if (named !== undefined && validSample(schema, named)) return named;
    }
    const label = words(field).join(' ') || field;
    value = formatted[schema.format] ?? `${label.charAt(0).toUpperCase()}${label.slice(1)} ${n}`;
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
