import * as React from 'react';
import { useId, useMemo } from 'react';

import './address.css';

import type { FieldDensity, FieldValidation } from '@/components/base/fieldUtils.js';
import { TextField } from '@/components/base/TextField.js';
import type { AddressDraft } from './address-types.js';
import { coerceAddressDraft, normalizeLines } from './address-types.js';
import type { AddressFormatTemplate, AddressTemplateComponent } from '@/traits/addressable/template-parser.js';
import type { ComponentValidationResult } from '@/traits/addressable/validation-service.js';
import { ADDRESS_MAX_LINES } from '@/schemas/address.js';

export type AddressFormField = Extract<
  AddressTemplateComponent,
  'organizationName' | 'addressLines' | 'locality' | 'dependentLocality' | 'administrativeArea' | 'postalCode'
>;

export interface AddressFieldSetProps {
  readonly idPrefix?: string;
  readonly legend?: string;
  readonly template: AddressFormatTemplate;
  readonly value: AddressDraft;
  readonly onChange?: (next: AddressDraft) => void;
  readonly disabled?: boolean;
  readonly density?: FieldDensity;
  readonly validationMap?: Partial<Record<AddressFormField, FieldValidation>>;
  readonly componentStatuses?: readonly ComponentValidationResult[];
  readonly corrections?: Partial<Record<AddressFormField, string | readonly string[]>>;
}

const EDITABLE_COMPONENTS: readonly AddressFormField[] = [
  'organizationName',
  'addressLines',
  'locality',
  'dependentLocality',
  'administrativeArea',
  'postalCode',
] as const;

const DEFAULT_FIELD_ORDER: readonly AddressFormField[] = [
  'organizationName',
  'addressLines',
  'locality',
  'administrativeArea',
  'postalCode',
  'dependentLocality',
];

const DEFAULT_LABELS: Record<AddressFormField, string> = {
  organizationName: 'Organization name',
  addressLines: 'Address line',
  locality: 'City / locality',
  dependentLocality: 'District / sublocality',
  administrativeArea: 'State / region',
  postalCode: 'Postal code',
};

const COUNTRY_LABELS: Record<string, Partial<Record<AddressFormField, string>>> = {
  US: {
    administrativeArea: 'State',
    postalCode: 'ZIP code',
  },
  CA: {
    administrativeArea: 'Province',
    postalCode: 'Postal code',
  },
  GB: {
    administrativeArea: 'County',
    postalCode: 'Postcode',
    locality: 'Town / City',
  },
  JP: {
    administrativeArea: 'Prefecture',
    locality: 'City / Ward',
    dependentLocality: 'District',
    postalCode: 'Postal code',
  },
  AU: {
    administrativeArea: 'State / Territory',
  },
  DE: {
    locality: 'Town / Municipality',
  },
};

const AUTOCOMPLETE_MAP: Record<AddressFormField, string> = {
  organizationName: 'organization',
  addressLines: 'address-line1',
  locality: 'address-level2',
  dependentLocality: 'address-level3',
  administrativeArea: 'address-level1',
  postalCode: 'postal-code',
};

const STATUS_COPY: Record<ComponentValidationResult['status'], { label: string; tone: 'info' | 'warning' | 'critical' }> = {
  confirmed: { label: 'Confirmed by validation provider', tone: 'info' },
  inferred: { label: 'Value inferred by provider', tone: 'info' },
  missing: { label: 'Missing from validation response', tone: 'critical' },
  unconfirmed: { label: 'Provider could not confirm this field', tone: 'warning' },
};

function resolveFieldOrder(template: AddressFormatTemplate): AddressFormField[] {
  const seen = new Set<AddressFormField>();
  const order: AddressFormField[] = [];

  template.lines.forEach((line) => {
    line.tokens.forEach((token) => {
      if (token.kind !== 'component') {
        return;
      }
      if (!EDITABLE_COMPONENTS.includes(token.component as AddressFormField)) {
        return;
      }
      const component = token.component as AddressFormField;
      if (!seen.has(component)) {
        seen.add(component);
        order.push(component);
      }
    });
  });

  DEFAULT_FIELD_ORDER.forEach((component) => {
    if (!seen.has(component)) {
      seen.add(component);
      order.push(component);
    }
  });

  return order;
}

function resolveLabels(template: AddressFormatTemplate): Record<AddressFormField, string> {
  const overrides = COUNTRY_LABELS[template.countryCode] ?? {};
  const labels: Record<AddressFormField, string> = { ...DEFAULT_LABELS };
  (Object.keys(overrides) as AddressFormField[]).forEach((field) => {
    labels[field] = overrides[field] ?? labels[field];
  });
  return labels;
}

function resolveAutoComplete(component: AddressFormField, index: number): string | undefined {
  if (component === 'addressLines') {
    return index === 0 ? 'address-line1' : `address-line${index + 1}`;
  }
  return AUTOCOMPLETE_MAP[component];
}

function formatCorrection(
  value: string | readonly string[] | undefined,
  index?: number
): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (Array.isArray(value)) {
    if (typeof index === 'number') {
      return value[index] ?? undefined;
    }
    return value.join(', ');
  }
  if (typeof value === 'string') {
    return value;
  }
  return undefined;
}

function resolveRequiredFlags(template: AddressFormatTemplate): Partial<Record<AddressFormField, boolean>> {
  const flags: Partial<Record<AddressFormField, boolean>> = {};
  template.lines.forEach((line) => {
    line.tokens.forEach((token) => {
      if (token.kind !== 'component') {
        return;
      }
      if (!EDITABLE_COMPONENTS.includes(token.component as AddressFormField)) {
        return;
      }
      if (token.options.required) {
        flags[token.component as AddressFormField] = true;
      }
    });
  });
  return flags;
}

export const AddressFieldSet: React.FC<AddressFieldSetProps> = ({
  idPrefix,
  legend,
  template,
  value,
  onChange,
  disabled,
  density = 'comfortable',
  validationMap,
  componentStatuses,
  corrections,
}) => {
  const autoId = useId();
  const draft = useMemo(() => coerceAddressDraft(value), [value]);
  const order = useMemo(() => resolveFieldOrder(template), [template]);
  const labels = useMemo(() => resolveLabels(template), [template]);
  const requiredMap = useMemo(() => resolveRequiredFlags(template), [template]);
  const statusMap = useMemo(() => {
    const map = new Map<AddressFormField, ComponentValidationResult>();
    componentStatuses?.forEach((status) => {
      const component = status.component as AddressFormField;
      if (component) {
        map.set(component, status);
      }
    });
    return map;
  }, [componentStatuses]);

  const emitChange = (updater: (draftValue: AddressDraft) => AddressDraft) => {
    if (!onChange) {
      return;
    }
    const next = updater(coerceAddressDraft(value));
    const normalized = {
      ...next,
      addressLines: normalizeLines(next.addressLines),
    };
    onChange(normalized);
  };

  const handleFieldChange = (component: AddressFormField, nextValue: string) => {
    emitChange((current) => ({
      ...current,
      [component]: nextValue,
    }));
  };

  const handleAddressLineChange = (index: number, nextValue: string) => {
    emitChange((current) => {
      const nextLines = current.addressLines.slice();
      nextLines[index] = nextValue;
      return {
        ...current,
        addressLines: nextLines,
      };
    });
  };

  const addAddressLine = () => {
    emitChange((current) => {
      if (current.addressLines.length >= ADDRESS_MAX_LINES) {
        return current;
      }
      return {
        ...current,
        addressLines: [...current.addressLines, ''],
      };
    });
  };

  const removeAddressLine = (index: number) => {
    emitChange((current) => {
      if (current.addressLines.length <= 1) {
        return current;
      }
      const nextLines = current.addressLines.slice();
      nextLines.splice(index, 1);
      if (nextLines.length === 0) {
        nextLines.push('');
      }
      return {
        ...current,
        addressLines: nextLines,
      };
    });
  };

  const fieldsetId = idPrefix ?? `${autoId}-address`;

  return (
    <fieldset className="address-field-set" aria-describedby={legend ? `${fieldsetId}-legend` : undefined}>
      {legend ? (
        <legend id={`${fieldsetId}-legend`} className="address-field-set__legend">
          {legend}
        </legend>
      ) : null}
      <div className="address-field-set__grid">
        {order.map((field) => {
          if (field === 'addressLines') {
            return (
              <div key="address-lines" className="address-field-set__group" data-field="addressLines">
                {draft.addressLines.map((line, index) => {
                  const fieldId = `${fieldsetId}-line-${index + 1}`;
                  const validation = validationMap?.addressLines;
                  const correctionValue = formatCorrection(corrections?.addressLines, index);
                  const status = statusMap.get('addressLines');
                  return (
                    <div key={fieldId} className="address-field-set__line">
                      <TextField
                        id={fieldId}
                        label={`${labels.addressLines} ${index + 1}`}
                        value={line ?? ''}
                        required={index === 0 || requiredMap.addressLines === true}
                        disabled={disabled}
                        density={density}
                        autoComplete={resolveAutoComplete('addressLines', index)}
                        onChange={(event) => handleAddressLineChange(index, event.currentTarget.value)}
                        validation={validation}
                      />
                      {draft.addressLines.length > 1 ? (
                        <button
                          type="button"
                          className="address-field-set__line-remove"
                          onClick={() => removeAddressLine(index)}
                          aria-label={`Remove address line ${index + 1}`}
                        >
                          Remove
                        </button>
                      ) : null}
                      {correctionValue ? (
                        <p className="address-field-set__helper" data-variant="correction">
                          Suggested: {correctionValue}
                        </p>
                      ) : null}
                      {status ? (
                        <p
                          className="address-field-set__helper"
                          data-variant={STATUS_COPY[status.status]?.tone ?? 'info'}
                        >
                          {STATUS_COPY[status.status]?.label ?? status.status}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
                {draft.addressLines.length < ADDRESS_MAX_LINES ? (
                  <button
                    type="button"
                    className="address-field-set__line-add"
                    onClick={addAddressLine}
                    data-variant="ghost"
                  >
                    Add address line
                  </button>
                ) : null}
              </div>
            );
          }

          const fieldId = `${fieldsetId}-${field}`;
          const validation = validationMap?.[field];
          const correctionValue = formatCorrection(corrections?.[field]);
          const status = statusMap.get(field);

          return (
            <div key={field} className="address-field-set__group" data-field={field}>
              <TextField
                id={fieldId}
                label={labels[field]}
                value={(draft[field] as string | undefined) ?? ''}
                disabled={disabled}
                required={requiredMap[field] === true}
                density={density}
                autoComplete={resolveAutoComplete(field, 0)}
                onChange={(event) => handleFieldChange(field, event.currentTarget.value)}
                validation={validation}
              />
              {correctionValue ? (
                <p className="address-field-set__helper" data-variant="correction">
                  Suggested: {correctionValue}
                </p>
              ) : null}
              {status ? (
                <p
                  className="address-field-set__helper"
                  data-variant={STATUS_COPY[status.status]?.tone ?? 'info'}
                >
                  {STATUS_COPY[status.status]?.label ?? status.status}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
};

AddressFieldSet.displayName = 'OODS.AddressFieldSet';
