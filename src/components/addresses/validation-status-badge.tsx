import * as React from 'react';
import { useMemo } from 'react';

import './address.css';

import { Badge } from '@/components/base/Badge.js';
import type { BadgeProps } from '@/components/base/Badge.js';
import type { AddressMetadata, AddressValidationStatus } from '@/schemas/address-metadata.js';

export interface ValidationStatusBadgeProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  readonly status?: AddressValidationStatus;
  readonly metadata?: AddressMetadata;
  readonly provider?: string;
  readonly timestamp?: string;
  readonly condensed?: boolean;
  readonly badgeProps?: Partial<BadgeProps>;
}

const STATUS_LABELS: Record<AddressValidationStatus, string> = {
  unvalidated: 'Not validated',
  validated: 'Validated',
  corrected: 'Corrected',
  enriched: 'Enriched',
};

const STATUS_TONES: Record<AddressValidationStatus, BadgeProps['tone']> = {
  unvalidated: 'neutral',
  validated: 'success',
  corrected: 'accent',
  enriched: 'info',
};

function formatTimestamp(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

export const ValidationStatusBadge: React.FC<ValidationStatusBadgeProps> = ({
  status: statusProp,
  metadata,
  provider,
  timestamp,
  condensed,
  badgeProps,
  className,
  ...rest
}) => {
  const status = statusProp ?? metadata?.validationStatus ?? 'unvalidated';
  const resolvedProvider = provider ?? metadata?.validationProvider;
  const resolvedTimestamp = formatTimestamp(timestamp ?? metadata?.validationTimestamp);
  const tone = STATUS_TONES[status] ?? 'neutral';
  const label = STATUS_LABELS[status] ?? status;

  const meta = useMemo(() => {
    if (!resolvedProvider && !resolvedTimestamp) {
      return null;
    }
    if (resolvedProvider && resolvedTimestamp) {
      return `${resolvedProvider} • ${resolvedTimestamp}`;
    }
    return resolvedProvider ?? resolvedTimestamp ?? null;
  }, [resolvedProvider, resolvedTimestamp]);

  const containerClassName = ['validation-status-badge', condensed ? 'validation-status-badge--condensed' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={containerClassName} {...rest}>
      <Badge
        status={status}
        domain="address.validation"
        tone={tone}
        emphasis="subtle"
        {...badgeProps}
      >
        {label}
      </Badge>
      {meta ? (
        <span className="validation-status-badge__meta">{meta}</span>
      ) : null}
    </div>
  );
};

ValidationStatusBadge.displayName = 'OODS.ValidationStatusBadge';
