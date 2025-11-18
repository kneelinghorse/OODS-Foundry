const IDENTIFIER_PATTERN = /^[a-z0-9][a-z0-9_-]{1,63}$/i;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LTREE_SEGMENT_PATTERN = /^[a-z0-9_]+$/;

export const CATEGORY_IDENTIFIER_PATTERN = IDENTIFIER_PATTERN;
export const CATEGORY_SLUG_PATTERN = SLUG_PATTERN;
export const LTREE_PATH_PATTERN = /^[a-z0-9_]+(?:\.[a-z0-9_]+)*$/;

export function normalizeIdentifier(value: string, maxLength: number = 64): string {
  return normalizeDelimited(value, { allowUnderscore: true, maxLength, pattern: IDENTIFIER_PATTERN });
}

export function normalizeSlug(value: string, maxLength: number = 64): string {
  return normalizeDelimited(value, { allowUnderscore: false, maxLength, pattern: SLUG_PATTERN });
}

interface NormalizeOptions {
  allowUnderscore: boolean;
  maxLength: number;
  pattern: RegExp;
}

function normalizeDelimited(value: string, options: NormalizeOptions): string {
  if (typeof value !== 'string') {
    throw new TypeError('value must be a string.');
  }

  const trimmed = value.trim().toLowerCase();
  const replaced = trimmed.replace(/[^a-z0-9_-]+/g, '-');
  const collapsed = replaced.replace(/-+/g, '-').replace(/_+/g, '_');
  const stripped = collapsed.replace(/^[-_]+|[-_]+$/g, '');
  if (!stripped) {
    throw new Error('Normalized value cannot be empty.');
  }

  const normalized = options.allowUnderscore ? stripped : stripped.replace(/_/g, '-');
  const truncated = normalized.slice(0, options.maxLength);

  if (!options.pattern.test(truncated)) {
    throw new Error(`Value "${value}" cannot be normalized to required pattern.`);
  }

  return truncated;
}

export function normalizeSynonymList(input?: readonly string[], maxLength: number = 32): string[] {
  if (!input || input.length === 0) {
    return [];
  }

  const normalized: string[] = [];
  for (const candidate of input) {
    if (typeof candidate !== 'string') {
      continue;
    }
    const slug = normalizeSlug(candidate, 64);
    if (!normalized.includes(slug)) {
      normalized.push(slug);
    }
    if (normalized.length >= maxLength) {
      break;
    }
  }

  return normalized;
}

export function normalizeLtreePath(
  input: string | readonly string[] | undefined,
  fallbackSegments: readonly string[]
): string {
  const rawSegments = collectSegments(input);
  const segments = rawSegments.length > 0 ? rawSegments : [...fallbackSegments];
  if (segments.length === 0) {
    throw new Error('At least one path segment is required to build an ltree path.');
  }

  const normalized = segments.map((segment) => {
    const trimmed = segment.trim().toLowerCase();
    const replaced = trimmed.replace(/[^a-z0-9_-]+/g, '-');
    const collapsed = replaced.replace(/-+/g, '-').replace(/^[-_]+|[-_]+$/g, '');
    const prepared = collapsed.replace(/-/g, '_');
    if (!prepared || !LTREE_SEGMENT_PATTERN.test(prepared)) {
      throw new Error(`Segment "${segment}" cannot be represented as an ltree label.`);
    }
    return prepared;
  });

  return normalized.join('.');
}

function collectSegments(input: string | readonly string[] | undefined): string[] {
  if (!input) {
    return [];
  }

  if (typeof input === 'string') {
    return input
      .split(/[./]/)
      .map((segment) => segment.trim())
      .filter((segment): segment is string => segment.length > 0);
  }

  const segments = Array.from(input);
  return segments.filter((segment) => typeof segment === 'string' && segment.trim().length > 0);
}
