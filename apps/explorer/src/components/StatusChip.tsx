import type { ReactNode } from 'react';
import saasBillingStatusMap from '~/tokens/maps/saas-billing.status-map.json';
import paymentIntentMapping from '../../../../examples/mapping/payments.PaymentIntent.status.json';
import ticketMapping from '../../../../examples/mapping/support.Ticket.status.json';
import userMapping from '../../../../examples/mapping/iam.User.status.json';

type StatusDomain = 'subscription' | 'invoice' | 'payment_intent' | 'ticket' | 'user';
export type StatusTone = 'neutral' | 'info' | 'accent' | 'success' | 'warning' | 'critical';

type MappingTokenPayload = {
  foregroundColor: string;
  backgroundColor: string;
  borderColor: string;
  iconName?: string;
};

type MappingEntry = {
  description: string;
  default: MappingTokenPayload;
  contexts?: Record<string, MappingTokenPayload>;
};

type MappingManifest = {
  mappings: Record<string, MappingEntry>;
};

type StatusRegistryEntry = {
  domain: StatusDomain;
  status: string;
  label: string;
  description: string;
  iconName: string;
  tone: StatusTone;
};

export type StatusStyle = StatusRegistryEntry;

export type StatusChipProps = {
  status: string;
  domain?: StatusDomain;
  context?: 'list' | 'detail' | 'form' | 'timeline';
  className?: string;
  prefixIcon?: ReactNode;
  suffixIcon?: ReactNode;
  tabIndex?: number;
};

const ICON_GLYPHS: Record<string, string> = {
  success: '✔︎',
  warning: '⚠︎',
  critical: '⨯',
  error: '⨯',
  danger: '⨯',
  info: 'ℹ︎',
  pending: '…',
  scheduled: '⏳',
  processing: '⟳',
  trial: '★',
  paused: '⏸',
  canceled: '∅',
  terminated: '∅',
  draft: '✎',
  void: '∅',
  paid: '✔︎',
  open: '○',
  future: '⏲',
  refunded: '↺',
  delinquent: '⚠︎'
};

const toLabel = (status: string): string =>
  status
    .split(/[_-]/)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');

const TOKEN_TONE_ALIASES: Record<string, StatusTone> = {
  info: 'info',
  accent: 'accent',
  positive: 'success',
  success: 'success',
  warning: 'warning',
  danger: 'critical',
  critical: 'critical',
  error: 'critical',
  negative: 'critical',
  neutral: 'neutral',
  pending: 'info'
};

const inferTone = (tokenReference?: string): StatusTone | undefined => {
  if (typeof tokenReference !== 'string') {
    return undefined;
  }

  const segments = tokenReference
    .split('.')
    .map((segment) => segment.trim().toLowerCase())
    .filter(Boolean);

  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const candidate = segments[index];
    if (candidate in TOKEN_TONE_ALIASES) {
      return TOKEN_TONE_ALIASES[candidate];
    }
  }

  return undefined;
};

const resolveTone = (definition: MappingTokenPayload): StatusTone => {
  const candidates = [definition.foregroundColor, definition.backgroundColor, definition.borderColor];

  for (const candidate of candidates) {
    const tone = inferTone(candidate);
    if (tone) {
      return tone;
    }
  }

  return 'neutral';
};

const buildRegistry = (manifest: MappingManifest, domain: StatusDomain): Map<string, StatusRegistryEntry> => {
  const map = new Map<string, StatusRegistryEntry>();

  Object.entries(manifest.mappings).forEach(([status, definition]) => {
    const label = toLabel(status);
    const tone = resolveTone(definition.default);
    const iconName = definition.default.iconName ?? 'icon.status.unknown';

    map.set(status, {
      domain,
      status,
      label,
      description: definition.description,
      iconName,
      tone
    });
  });

  return map;
};

type SaasStatusTokenBlock = {
  foreground: string;
  background: string;
  border: string;
  icon: string;
};

type SaasStatusEntry = {
  description: string;
  chip: SaasStatusTokenBlock;
  banner?: SaasStatusTokenBlock;
};

type SaasBillingStatusManifest = {
  version: string;
  generated_at: string;
  domains: Record<'subscription' | 'invoice', Record<string, SaasStatusEntry>>;
};

const toManifestFromSaas = (domain: 'subscription' | 'invoice'): MappingManifest => {
  const manifest = saasBillingStatusMap as SaasBillingStatusManifest;
  const domainDefinitions = manifest.domains[domain];

  if (!domainDefinitions) {
    return { mappings: {} };
  }
  const mappings: Record<string, MappingEntry> = {};

  Object.entries(domainDefinitions).forEach(([status, entry]) => {
    mappings[status] = {
      description: entry.description,
      default: {
        foregroundColor: entry.chip.foreground,
        backgroundColor: entry.chip.background,
        borderColor: entry.chip.border,
        iconName: entry.chip.icon
      }
    };

    if (entry.banner) {
      mappings[status].contexts = {
        banner: {
          foregroundColor: entry.banner.foreground,
          backgroundColor: entry.banner.background,
          borderColor: entry.banner.border,
          iconName: entry.banner.icon
        }
      };
    }
  });

  return { mappings };
};

const SUBSCRIPTION_REGISTRY = buildRegistry(toManifestFromSaas('subscription'), 'subscription');
const INVOICE_REGISTRY = buildRegistry(toManifestFromSaas('invoice'), 'invoice');
const PAYMENT_INTENT_REGISTRY = buildRegistry(paymentIntentMapping as MappingManifest, 'payment_intent');
const TICKET_REGISTRY = buildRegistry(ticketMapping as MappingManifest, 'ticket');
const USER_REGISTRY = buildRegistry(userMapping as MappingManifest, 'user');

const REGISTRY_LOOKUP: Record<StatusDomain, Map<string, StatusRegistryEntry>> = {
  subscription: SUBSCRIPTION_REGISTRY,
  invoice: INVOICE_REGISTRY,
  payment_intent: PAYMENT_INTENT_REGISTRY,
  ticket: TICKET_REGISTRY,
  user: USER_REGISTRY
};

const sanitizeClassName = (parts: Array<string | undefined | false>): string =>
  parts.filter(Boolean).join(' ');

const getIconGlyph = (iconName: string): string => {
  const segment = iconName.split('.').pop()?.toLowerCase() ?? '';
  return ICON_GLYPHS[segment] ?? '•';
};

export const getStatusStyle = (domain: StatusDomain, status: string): StatusStyle => {
  const registry = REGISTRY_LOOKUP[domain];
  const entry = registry.get(status);

  if (entry) {
    return entry;
  }

  const fallbackLabel = toLabel(status || 'Unmapped');
  return {
    domain,
    status,
    label: fallbackLabel,
    description: 'Status not found in registry; falling back to neutral palette.',
    iconName: 'icon.status.unknown',
    tone: 'neutral'
  };
};

export const StatusChip = ({
  status,
  domain = 'subscription',
  context,
  className,
  prefixIcon,
  suffixIcon,
  tabIndex
}: StatusChipProps) => {
  const style = getStatusStyle(domain, status);
  const glyph = getIconGlyph(style.iconName);

  return (
    <span
      role="status"
      tabIndex={typeof tabIndex === 'number' ? tabIndex : 0}
      aria-label={`${style.label} status`}
      title={style.description}
      data-region="badges"
      data-status={style.status}
      data-domain={style.domain}
      data-context={context}
      data-tone={style.tone}
      className={sanitizeClassName(['status-chip', className])}
    >
      {prefixIcon}
      <span className="status-chip__icon" aria-hidden>
        {glyph}
      </span>
      <span className="status-chip__label">{style.label}</span>
      {suffixIcon}
    </span>
  );
};

StatusChip.displayName = 'StatusChip';
