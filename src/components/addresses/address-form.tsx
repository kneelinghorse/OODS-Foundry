import * as React from 'react';
import { useEffect, useId, useMemo, useState } from 'react';

import './address.css';
import type { FieldDensity } from '@/components/base/fieldUtils.js';
import { Select } from '@/components/base/Select.js';
import { AddressFieldSet, type AddressFormField } from './address-field-set.js';
import { RoleSelector } from './role-selector.js';
import { ValidationStatusBadge } from './validation-status-badge.js';
import {
  coerceAddressDraft,
  tryNormalizeDraft,
  type AddressCountryOption,
  type AddressFormEntry,
} from './address-types.js';
import type { Address } from '@/schemas/address.js';
import type { AddressMetadata } from '@/schemas/address-metadata.js';
import type { ComponentValidationResult } from '@/traits/addressable/validation-service.js';
import { listTemplates, tryGetTemplate } from '@/traits/addressable/format-templates.js';
import type { AddressFormatTemplate } from '@/traits/addressable/template-parser.js';

export interface AddressFormProps {
  readonly entry: AddressFormEntry;
  readonly roles?: readonly string[];
  readonly allowCustomRoles?: boolean;
  readonly onEntryChange?: (next: AddressFormEntry) => void;
  readonly onValidate?: (entry: AddressFormEntry, normalized: Address | null) => void;
  readonly validationComponents?: readonly ComponentValidationResult[];
  readonly locale?: string;
  readonly countryOptions?: readonly AddressCountryOption[];
  readonly templateKey?: string;
  readonly density?: FieldDensity;
  readonly disabled?: boolean;
  readonly isBusy?: boolean;
  readonly actions?: React.ReactNode;
  readonly className?: string;
  readonly style?: React.CSSProperties;
}

function ensureEntry(entry: AddressFormEntry): AddressFormEntry {
  return {
    ...entry,
    address: coerceAddressDraft(entry.address),
  };
}

function useCountryOptions(locale?: string, overrides?: readonly AddressCountryOption[]): readonly AddressCountryOption[] {
  return useMemo(() => {
    if (overrides && overrides.length > 0) {
      return overrides;
    }
    const templates = listTemplates();
    const displayNames = typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function'
      ? new Intl.DisplayNames(locale ? [locale] : undefined, { type: 'region' })
      : null;

    const deduped = new Map<string, AddressCountryOption>();
    templates.forEach((template) => {
      const label = displayNames?.of(template.countryCode) ?? template.countryCode;
      deduped.set(template.key, {
        countryCode: template.countryCode,
        templateKey: template.key,
        label: `${label} (${template.key})`,
        description: template.description,
      });
    });
    return Array.from(deduped.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [locale, overrides]);
}

function deriveCorrections(metadata?: AddressMetadata): Partial<Record<AddressFormField, string | readonly string[]>> {
  if (!metadata?.correctedAddress) {
    return {};
  }
  const corrected = metadata.correctedAddress;
  return {
    organizationName: corrected.organizationName,
    addressLines: corrected.addressLines,
    locality: corrected.locality,
    dependentLocality: corrected.dependentLocality,
    administrativeArea: corrected.administrativeArea,
    postalCode: corrected.postalCode,
  };
}

export const AddressForm: React.FC<AddressFormProps> = ({
  entry,
  roles,
  allowCustomRoles,
  onEntryChange,
  onValidate,
  validationComponents,
  locale,
  countryOptions,
  templateKey,
  density = 'comfortable',
  disabled,
  isBusy,
  actions,
  className,
  style,
}) => {
  const autoId = useId();
  const [internalEntry, setInternalEntry] = useState<AddressFormEntry>(() => ensureEntry(entry));

  useEffect(() => {
    setInternalEntry(ensureEntry(entry));
  }, [entry]);

  const activeEntry = onEntryChange ? ensureEntry(entry) : internalEntry;

  const emitEntryChange = (updater: (current: AddressFormEntry) => AddressFormEntry) => {
    if (onEntryChange) {
      onEntryChange(updater(ensureEntry(entry)));
      return;
    }
    setInternalEntry((current) => updater(ensureEntry(current)));
  };

  const resolvedCountryOptions = useCountryOptions(locale, countryOptions);

  const resolvedTemplate: AddressFormatTemplate = useMemo(() => {
    const candidates = [templateKey, activeEntry.address.formatTemplateKey, activeEntry.address.countryCode].filter(Boolean) as string[];
    for (const candidate of candidates) {
      if (!candidate) {
        continue;
      }
      const template = tryGetTemplate(candidate);
      if (template) {
        return template;
      }
    }
    const fallbackKey = resolvedCountryOptions[0]?.templateKey;
    if (fallbackKey) {
      const template = tryGetTemplate(fallbackKey);
      if (template) {
        return template;
      }
    }
    const all = listTemplates();
    return all[0];
  }, [activeEntry.address, resolvedCountryOptions, templateKey]);

  const metadata = activeEntry.metadata;
  const corrections = useMemo(() => deriveCorrections(metadata), [metadata]);
  const normalizedAddress = tryNormalizeDraft(activeEntry.address);

  const containerClassName = ['address-form', className].filter(Boolean).join(' ');

  const handleCountryChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextKey = event.currentTarget.value;
    const option = resolvedCountryOptions.find((candidate) => candidate.templateKey === nextKey);
    if (!option) {
      return;
    }
    emitEntryChange((current) => ({
      ...current,
      address: {
        ...current.address,
        countryCode: option.countryCode,
        formatTemplateKey: option.templateKey,
      },
    }));
  };

  const handleValidate = () => {
    if (!onValidate) {
      return;
    }
    onValidate(activeEntry, normalizedAddress);
  };

  const validationSummary = validationComponents?.slice(0, 4) ?? [];

  return (
    <div className={containerClassName} style={style} data-disabled={disabled ? 'true' : undefined}>
      <div className="address-form__header">
        <RoleSelector
          id={`${autoId}-role`}
          value={activeEntry.role}
          roles={roles}
          allowCustom={allowCustomRoles}
          onChange={(role) => emitEntryChange((current) => ({ ...current, role }))}
          density={density}
          disabled={disabled}
        />
        <ValidationStatusBadge metadata={metadata} className="address-form__status" />
      </div>
      <div className="address-form__row">
        <Select
          id={`${autoId}-country`}
          label="Country or region"
          value={resolvedTemplate.key}
          onChange={handleCountryChange}
          disabled={disabled}
          density={density}
          required
        >
          {resolvedCountryOptions.map((option) => (
            <option key={option.templateKey} value={option.templateKey}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>
      <AddressFieldSet
        idPrefix={`${autoId}-fields`}
        legend="Address details"
        template={resolvedTemplate}
        value={activeEntry.address}
        onChange={(draft) => emitEntryChange((current) => ({ ...current, address: draft }))}
        disabled={disabled}
        density={density}
        componentStatuses={validationComponents}
        corrections={corrections}
      />
      {validationSummary.length > 0 ? (
        <div className="address-form__validation" aria-live="polite">
          <h3>Validation insights</h3>
          <ul>
            {validationSummary.map((component) => (
              <li key={component.component} data-status={component.status}>
                <strong>{component.component}</strong>: {component.status}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="address-form__actions">
        <button
          type="button"
          className="address-form__action"
          onClick={handleValidate}
          disabled={disabled || !onValidate || !normalizedAddress || isBusy}
        >
          {isBusy ? 'Validating…' : 'Validate address'}
        </button>
        {actions}
      </div>
      {metadata?.geocode ? (
        <div className="address-form__geocode" aria-live="polite">
          <h4>Geocode preview</h4>
          <p>
            {metadata.geocode.latitude.toFixed(4)}, {metadata.geocode.longitude.toFixed(4)}{' '}
            {metadata.geocode.precision ? `(${metadata.geocode.precision})` : null}
          </p>
        </div>
      ) : null}
    </div>
  );
};

AddressForm.displayName = 'OODS.AddressForm';
