import * as React from 'react';
import { useId, useMemo } from 'react';

import './address.css';

import type { Address } from '@/schemas/address.js';
import type { AddressGeocode, AddressMetadata } from '@/schemas/address-metadata.js';
import type { FormatAddressOptions, FormatAddressResult } from '@/traits/addressable/address-formatter.js';
import { formatAddress } from '@/traits/addressable/address-formatter.js';
import type { AddressableEntry } from '@/traits/addressable/address-entry.js';
import { Badge } from '@/components/base/Badge.js';
import { ValidationStatusBadge } from './validation-status-badge.js';
import { createAddressDraft, tryNormalizeDraft, type AddressFormEntry } from './address-types.js';

export type AddressDisplayEntry = AddressableEntry | AddressFormEntry;

export interface AddressDisplayProps {
  readonly entry: AddressDisplayEntry;
  readonly variant?: 'card' | 'inline';
  readonly locale?: string;
  readonly formatOptions?: FormatAddressOptions;
  readonly onEdit?: () => void;
  readonly onDelete?: () => void;
  readonly onSetDefault?: () => void;
  readonly actions?: React.ReactNode;
  readonly showRole?: boolean;
  readonly showValidation?: boolean;
  readonly showMapPreview?: boolean;
  readonly mapPreview?: React.ReactNode;
  readonly className?: string;
  readonly style?: React.CSSProperties;
}

function isAddressableEntry(entry: AddressDisplayEntry): entry is AddressableEntry {
  return (entry as AddressableEntry).updatedAt !== undefined;
}

function normalizeEntryAddress(entry: AddressDisplayEntry): Address | null {
  if (isAddressableEntry(entry)) {
    return entry.address;
  }
  return tryNormalizeDraft(entry.address);
}

function buildFallbackLines(entry: AddressDisplayEntry): string[] {
  const draft = createAddressDraft(entry.address as Address);
  const lines: string[] = []; // degrade to known fields
  draft.addressLines.forEach((line) => {
    if (line && line.trim().length > 0) {
      lines.push(line.trim());
    }
  });
  const localityBlock = [draft.locality, draft.administrativeArea].filter(Boolean).join(', ');
  if (localityBlock) {
    lines.push(localityBlock);
  }
  if (draft.postalCode) {
    lines.push(draft.postalCode);
  }
  return lines.length > 0 ? lines : ['Address not available'];
}

function formatGeocode(geocode?: AddressGeocode): string | undefined {
  if (!geocode) {
    return undefined;
  }
  const { latitude, longitude, precision } = geocode;
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}${precision ? ` • ${precision}` : ''}`;
}

export const AddressDisplay: React.FC<AddressDisplayProps> = ({
  entry,
  variant = 'card',
  locale,
  formatOptions,
  onEdit,
  onDelete,
  onSetDefault,
  actions,
  showRole = true,
  showValidation = true,
  showMapPreview = true,
  mapPreview,
  className,
  style,
}) => {
  const sectionId = useId();
  const metadata: AddressMetadata | undefined = entry.metadata;

  const normalized = normalizeEntryAddress(entry);
  const formatted: FormatAddressResult | null = useMemo(() => {
    if (!normalized) {
      return null;
    }
    const options: FormatAddressOptions = {
      locale,
      ...formatOptions,
    };
    return formatAddress(normalized, options);
  }, [normalized, locale, formatOptions]);

  const lines = formatted?.lines ?? buildFallbackLines(entry);
  const geocode = metadata?.geocode;
  const geocodeText = formatGeocode(geocode);

  const containerClassName = ['address-display', `address-display--${variant}`, className]
    .filter(Boolean)
    .join(' ');

  return (
    <article
      className={containerClassName}
      style={style}
      aria-labelledby={`${sectionId}-title`}
      data-variant={variant}
    >
      <header className="address-display__header" id={`${sectionId}-title`}>
        <div className="address-display__title">
          {showRole ? (
            <Badge domain="address.role" status={entry.role} tone={entry.isDefault ? 'accent' : 'neutral'}>
              {entry.role}
            </Badge>
          ) : null}
          {entry.isDefault ? <span className="address-display__default">Default</span> : null}
        </div>
        <div className="address-display__actions">
          {actions}
          {onEdit ? (
            <button type="button" onClick={onEdit} className="address-display__action">
              Edit
            </button>
          ) : null}
          {onDelete ? (
            <button type="button" onClick={onDelete} className="address-display__action" data-variant="danger">
              Remove
            </button>
          ) : null}
          {onSetDefault ? (
            <button type="button" onClick={onSetDefault} className="address-display__action" data-variant="ghost">
              Set default
            </button>
          ) : null}
        </div>
      </header>
      <div className="address-display__body">
        <div className="address-display__lines" aria-live="polite">
          {lines.map((line, index) => (
            <div key={`${line}-${index}`} className="address-display__line">
              {line}
            </div>
          ))}
        </div>
        {showValidation && metadata ? (
          <ValidationStatusBadge metadata={metadata} />
        ) : null}
        {showMapPreview && (mapPreview || geocodeText) ? (
          <div className="address-display__map" aria-label="Location preview">
            {mapPreview ?? <span>{geocodeText}</span>}
          </div>
        ) : null}
      </div>
    </article>
  );
};

AddressDisplay.displayName = 'OODS.AddressDisplay';
