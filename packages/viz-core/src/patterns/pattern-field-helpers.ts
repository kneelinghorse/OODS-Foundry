import type { ChartPattern, PatternField } from './index.js';

export interface PatternFieldInfo {
  readonly role: PatternField['role'];
  readonly id: string;
  readonly label: string;
}

export interface PatternFieldBlueprint {
  readonly dimensions: ReadonlyArray<PatternFieldInfo>;
  readonly measures: ReadonlyArray<PatternFieldInfo>;
}

export function extractFieldBlueprint(pattern: ChartPattern): PatternFieldBlueprint {
  const seen = new Set<string>();
  const dimensions: PatternFieldInfo[] = [];
  const measures: PatternFieldInfo[] = [];

  pattern.schema.fields.forEach((field, index) => {
    const suggested = toFieldId(field.example ?? field.name ?? '', `${field.role}_${index + 1}`);
    const id = reserveId(seen, suggested);
    const info: PatternFieldInfo = {
      role: field.role,
      id,
      label: field.example ?? field.name,
    };
    if (field.role === 'dimension') {
      dimensions.push(info);
    } else {
      measures.push(info);
    }
  });

  return { dimensions, measures };
}

function reserveId(seen: Set<string>, candidate: string): string {
  if (!seen.has(candidate)) {
    seen.add(candidate);
    return candidate;
  }
  let index = 2;
  while (seen.has(`${candidate}${index}`)) {
    index += 1;
  }
  const finalId = `${candidate}${index}`;
  seen.add(finalId);
  return finalId;
}

function toFieldId(input: string, fallback: string): string {
  const normalized = input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim();
  if (!normalized) {
    return fallback;
  }
  const [first, ...rest] = normalized.split(/\s+/);
  const base = first.toLowerCase();
  const camel = rest.map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase()).join('');
  return (base + camel).replace(/^[0-9]/, (digit) => `n${digit}`);
}
