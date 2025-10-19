import rawStatusMap from '../../../tokens/maps/saas-billing.status-map.json';

type RawStatusTokenSet = {
  readonly foreground: string;
  readonly background: string;
  readonly border: string;
  readonly icon?: string;
};

type RawStatusEntry = {
  readonly description: string;
  readonly chip: RawStatusTokenSet;
  readonly banner?: RawStatusTokenSet;
};

type RawStatusMap = {
  readonly version: string;
  readonly generated_at: string;
  readonly domains: Record<string, Record<string, RawStatusEntry>>;
};

export type StatusTone = 'neutral' | 'info' | 'accent' | 'success' | 'warning' | 'critical';
export type StatusDomain = string;

export interface StatusTokenSet {
  readonly background: string;
  readonly border: string;
  readonly foreground: string;
}

export interface StatusPresentation {
  readonly domain: StatusDomain;
  readonly status: string;
  readonly label: string;
  readonly description: string;
  readonly tone: StatusTone;
  readonly iconName?: string;
  readonly badge: {
    readonly subtle: StatusTokenSet;
    readonly solid: StatusTokenSet;
  };
  readonly banner: {
    readonly subtle: StatusTokenSet;
    readonly solid: StatusTokenSet;
  };
}

const statusMap = rawStatusMap as RawStatusMap;
const registry = new Map<StatusDomain, Map<string, StatusPresentation>>();

const TOKEN_TONE_ALIASES: Record<string, StatusTone> = {
  info: 'info',
  informational: 'info',
  accent: 'accent',
  highlight: 'accent',
  positive: 'success',
  success: 'success',
  ok: 'success',
  warning: 'warning',
  caution: 'warning',
  danger: 'critical',
  critical: 'critical',
  error: 'critical',
  negative: 'critical',
  neutral: 'neutral',
  pending: 'info',
};

const STATUS_TONES: readonly StatusTone[] = Object.freeze([
  'neutral',
  'info',
  'accent',
  'success',
  'warning',
  'critical',
]);

function toLabel(status: string): string {
  return status
    .split(/[_-]/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function buildCssVariableName(pathSegments: readonly string[]): string {
  const slug = pathSegments
    .map((segment) => segment.replace(/\s+/g, '-'))
    .join('-')
    .replace(/--+/g, '-')
    .toLowerCase();

  return `--${slug}`;
}

function toCssVariable(reference: string | undefined): string | undefined {
  if (!reference) {
    return undefined;
  }

  const trimmed = reference.trim();
  if (!trimmed) {
    return undefined;
  }

  if (trimmed.startsWith('var(') || trimmed.startsWith('#') || trimmed.includes('(')) {
    return trimmed;
  }

  const segments = trimmed.replace(/^\{|\}$/g, '').split('.');
  return `var(${buildCssVariableName(segments)})`;
}

function inferTone(reference: string | undefined): StatusTone | undefined {
  if (!reference) {
    return undefined;
  }

  const normalized = reference
    .replace(/^\{|\}$/g, '')
    .split(/[\s./_-]+/)
    .filter(Boolean)
    .map((segment) => segment.toLowerCase());

  for (let index = normalized.length - 1; index >= 0; index -= 1) {
    const candidate = normalized[index];
    if (candidate in TOKEN_TONE_ALIASES) {
      return TOKEN_TONE_ALIASES[candidate];
    }
  }

  return undefined;
}

function resolveTone(entry: RawStatusTokenSet | undefined): StatusTone {
  if (!entry) {
    return 'neutral';
  }

  const candidates = [entry.foreground, entry.background, entry.border];

  for (const candidate of candidates) {
    const tone = inferTone(candidate);
    if (tone) {
      return tone;
    }
  }

  return 'neutral';
}

function toCssTokenSet(entry: RawStatusTokenSet | undefined): StatusTokenSet | undefined {
  if (!entry) {
    return undefined;
  }

  const background = toCssVariable(entry.background);
  const border = toCssVariable(entry.border);
  const foreground = toCssVariable(entry.foreground);

  if (!background || !border || !foreground) {
    return undefined;
  }

  return {
    background,
    border,
    foreground,
  };
}

function buildComponentTokenSet(tone: StatusTone): StatusTokenSet {
  const normalized = STATUS_TONES.includes(tone) ? tone : 'neutral';

  return {
    background: `var(--cmp-status-${normalized}-surface)`,
    border: `var(--cmp-status-${normalized}-border)`,
    foreground: `var(--cmp-status-${normalized}-text)`,
  };
}

function buildBannerFallback(tone: StatusTone): StatusTokenSet {
  if (tone === 'neutral') {
    return {
      background: 'var(--cmp-banner-background)',
      border: 'var(--cmp-banner-border)',
      foreground: 'var(--cmp-banner-text)',
    };
  }

  return buildComponentTokenSet(tone);
}

function buildFallbackPresentation(
  domain: StatusDomain,
  status: string,
  tone: StatusTone,
  label?: string
): StatusPresentation {
  const resolvedTone = STATUS_TONES.includes(tone) ? tone : 'neutral';
  const fallbackLabel = label ?? toLabel(status || 'Unknown');

  return {
    domain,
    status,
    label: fallbackLabel,
    description: 'Status not found in registry; falling back to neutral token set.',
    tone: resolvedTone,
    iconName: undefined,
    badge: {
      subtle: buildComponentTokenSet(resolvedTone),
      solid: buildComponentTokenSet(resolvedTone),
    },
    banner: {
      subtle: buildBannerFallback(resolvedTone),
      solid: buildComponentTokenSet(resolvedTone),
    },
  };
}

for (const [domain, entries] of Object.entries(statusMap.domains)) {
  const domainMap = new Map<string, StatusPresentation>();

  for (const [status, entry] of Object.entries(entries)) {
    const registryKey = status.toLowerCase();
    const tone = resolveTone(entry.chip);
    const iconName = entry.chip.icon ?? entry.banner?.icon;
    const label = toLabel(status);
    const badgeSubtle = toCssTokenSet(entry.chip) ?? buildComponentTokenSet(tone);
    const bannerSubtle =
      toCssTokenSet(entry.banner) ??
      (tone === 'neutral' ? buildBannerFallback(tone) : buildComponentTokenSet(tone));

    domainMap.set(registryKey, {
      domain,
      status,
      label,
      description: entry.description,
      tone,
      iconName,
      badge: {
        subtle: badgeSubtle,
        solid: buildComponentTokenSet(tone),
      },
      banner: {
        subtle: bannerSubtle,
        solid: buildComponentTokenSet(tone),
      },
    });
  }

  registry.set(domain, domainMap);
}

export const STATUS_DOMAINS: readonly StatusDomain[] = Object.freeze(Array.from(registry.keys()));

export function getStatusPresentation(domain: StatusDomain, status: string): StatusPresentation {
  const domainMap = registry.get(domain);
  if (!domainMap) {
    return buildFallbackPresentation(domain, status, 'neutral');
  }

  const normalizedStatus = status.toLowerCase();
  const entry = domainMap.get(normalizedStatus);
  if (entry) {
    return entry;
  }

  return buildFallbackPresentation(domain, status, 'neutral');
}

export function listStatuses(domain: StatusDomain): readonly StatusPresentation[] {
  const domainMap = registry.get(domain);
  if (!domainMap) {
    return [];
  }

  return Array.from(domainMap.values());
}

export function getToneTokenSet(tone: StatusTone): StatusTokenSet {
  return buildComponentTokenSet(tone);
}

export function getBannerToneTokenSet(tone: StatusTone): StatusTokenSet {
  return buildBannerFallback(tone);
}
