import rawStatusMap from '../registry/status-map.json';
import lifecycleTones from '../registry/lifecycle-status-tones.json';

/**
 * s222-m02 (#2502 ruling 11): the status registry and its presentation, shared by every renderer. It moved here from
 * @oods/components-react (which re-exports it unchanged) so the HTML renderer labels, tones and marks a status exactly as
 * the React components do. The map is the token package's saas-billing status map.
 *
 * s222-m03 (#2502 ruling 13): the lifecycle table (registry/lifecycle-status-tones.json) is the StatusBadge contract's
 * lifecycle status-to-tone table: the `lifecycle` domain, and what any domain's badge reads for a status its own table does
 * not know. A settled payment is a success and a failed one critical, not neutral.
 */
export type StatusTone = 'neutral' | 'info' | 'accent' | 'positive' | 'success' | 'warning' | 'critical' | 'danger';
export type StatusDomain = string;

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
  readonly domains: Record<string, Record<string, RawStatusEntry>>;
};

export type StatusTokenSet = {
  readonly background: string;
  readonly border: string;
  readonly foreground: string;
};

export type StatusPresentation = {
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
};

const TONE_ALIASES: Record<string, StatusTone> = {
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

const toLabel = (status: string): string =>
  status
    .split(/[_-]/)
    .filter(Boolean)
    .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');

const inferTone = (entry?: RawStatusTokenSet): StatusTone => {
  if (!entry) return 'neutral';
  for (const reference of [entry.foreground, entry.background, entry.border]) {
    const segments = reference.replace(/^\{|\}$/g, '').split(/[\s./_-]+/).reverse();
    for (const segment of segments) {
      const tone = TONE_ALIASES[segment.toLowerCase()];
      if (tone) return tone;
    }
  }
  return 'neutral';
};

const componentTokenSet = (tone: StatusTone): StatusTokenSet => {
  const normalized = tone === 'positive' ? 'success' : tone === 'danger' ? 'critical' : tone;
  return {
    background: `var(--sys-status-${normalized}-surface)`,
    border: `var(--sys-status-${normalized}-border)`,
    foreground: `var(--sys-status-${normalized}-text)`,
  };
};

const rawTokenSet = (entry: RawStatusTokenSet): StatusTokenSet => {
  const tone = inferTone(entry);
  return componentTokenSet(tone);
};

const bannerFallback = (tone: StatusTone): StatusTokenSet =>
  tone === 'neutral'
    ? {
        background: 'var(--cmp-banner-background)',
        border: 'var(--cmp-banner-border)',
        foreground: 'var(--cmp-banner-text)',
      }
    : componentTokenSet(tone);

const fallback = (
  domain: StatusDomain,
  status: string,
  tone: StatusTone = 'neutral'
): StatusPresentation => ({
  domain,
  status,
  label: toLabel(status || 'Unknown'),
  description: 'Status not found in registry; falling back to the requested token set.',
  tone,
  badge: { subtle: componentTokenSet(tone), solid: componentTokenSet(tone) },
  banner: { subtle: bannerFallback(tone), solid: componentTokenSet(tone) },
});

const registry = new Map<StatusDomain, Map<string, StatusPresentation>>();

for (const [domain, entries] of Object.entries((rawStatusMap as RawStatusMap).domains)) {
  const domainEntries = new Map<string, StatusPresentation>();
  for (const [status, entry] of Object.entries(entries)) {
    const tone = inferTone(entry.chip);
    domainEntries.set(status.toLowerCase(), {
      domain,
      status,
      label: toLabel(status),
      description: entry.description,
      tone,
      iconName: entry.chip.icon ?? entry.banner?.icon,
      badge: { subtle: rawTokenSet(entry.chip), solid: componentTokenSet(tone) },
      banner: {
        subtle: entry.banner ? rawTokenSet(entry.banner) : bannerFallback(tone),
        solid: componentTokenSet(tone),
      },
    });
  }
  registry.set(domain, domainEntries);
}

const lifecycleEntries = new Map<string, StatusPresentation>();
for (const [status, entry] of Object.entries((lifecycleTones as { states: Record<string, { tone: StatusTone; icon: string; description: string }> }).states)) {
  lifecycleEntries.set(status, {
    domain: 'lifecycle',
    status,
    label: toLabel(status),
    description: entry.description,
    tone: entry.tone,
    iconName: entry.icon,
    badge: { subtle: componentTokenSet(entry.tone), solid: componentTokenSet(entry.tone) },
    banner: { subtle: bannerFallback(entry.tone), solid: componentTokenSet(entry.tone) },
  });
}
registry.set('lifecycle', lifecycleEntries);

const LEGACY_STATUS_ALIASES: Record<string, Record<string, string>> = {
  subscription: { delinquent: 'unpaid' },
};

export const STATUS_DOMAINS: readonly StatusDomain[] = Object.freeze([...registry.keys()]);

export function getStatusPresentation(domain: StatusDomain, status: string): StatusPresentation {
  const entries = registry.get(domain);
  const normalized = status.toLowerCase();
  const direct = entries?.get(normalized);
  if (direct) return direct;
  const alias = LEGACY_STATUS_ALIASES[domain]?.[normalized];
  const aliased = alias ? entries?.get(alias) : undefined;
  if (aliased) return { ...aliased, status, label: toLabel(status) };
  const shared = lifecycleEntries.get(normalized);
  return shared ? { ...shared, status, label: toLabel(status) } : fallback(domain, status);
}

export function listStatuses(domain: StatusDomain): readonly StatusPresentation[] {
  return [...(registry.get(domain)?.values() ?? [])];
}

export function getToneTokenSet(tone: StatusTone): StatusTokenSet {
  return componentTokenSet(tone);
}

export function getBannerToneTokenSet(tone: StatusTone): StatusTokenSet {
  return bannerFallback(tone);
}
