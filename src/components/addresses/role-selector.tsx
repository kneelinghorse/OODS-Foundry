import * as React from 'react';
import { useId, useState, useEffect } from 'react';

import './address.css';

import type { FieldDensity, FieldValidation } from '@/components/base/fieldUtils.js';
import { Select } from '@/components/base/Select.js';
import { TextField } from '@/components/base/TextField.js';
import { normalizeAddressRole } from '@/traits/addressable/address-entry.js';

export interface RoleSelectorProps {
  readonly id?: string;
  readonly label?: string;
  readonly value?: string;
  readonly roles?: readonly string[];
  readonly allowCustom?: boolean;
  readonly onChange?: (role: string) => void;
  readonly onCreateRole?: (role: string) => void;
  readonly density?: FieldDensity;
  readonly disabled?: boolean;
  readonly validation?: FieldValidation;
  readonly description?: React.ReactNode;
  readonly required?: boolean;
}

export const RoleSelector: React.FC<RoleSelectorProps> = ({
  id,
  label = 'Address role',
  value,
  roles = [],
  allowCustom = false,
  onChange,
  onCreateRole,
  density = 'comfortable',
  disabled,
  validation,
  description,
  required,
}) => {
  const autoId = useId();
  const selectId = id ?? `${autoId}-role`;
  const [customRole, setCustomRole] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
  }, [value]);

  const emitChange = (nextRole: string) => {
    onChange?.(nextRole);
  };

  const handleCustomSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!customRole.trim()) {
      return;
    }
    try {
      const normalized = normalizeAddressRole(customRole);
      onCreateRole?.(normalized);
      emitChange(normalized);
      setCustomRole('');
      setError(null);
    } catch (exception) {
      const message = exception instanceof Error ? exception.message : 'Invalid role name.';
      setError(message);
    }
  };

  return (
    <div className="address-role-selector">
      <Select
        id={selectId}
        label={label}
        value={value ?? ''}
        onChange={(event) => emitChange(event.currentTarget.value)}
        disabled={disabled}
        density={density}
        required={required}
        validation={validation}
        description={description}
      >
        <option value="" disabled>
          Select a role
        </option>
        {roles.map((role) => (
          <option key={role} value={role}>
            {role}
          </option>
        ))}
      </Select>
      {allowCustom ? (
        <form className="address-role-selector__custom" onSubmit={handleCustomSubmit} aria-live="polite">
          <TextField
            id={`${selectId}-custom`}
            label="Create custom role"
            value={customRole}
            onChange={(event) => setCustomRole(event.currentTarget.value)}
            disabled={disabled}
            density={density}
            autoComplete="off"
            required={false}
          />
          <button type="submit" className="address-role-selector__add" disabled={disabled || customRole.trim().length === 0}>
            Add role
          </button>
          {error ? (
            <p className="address-role-selector__error" role="alert">
              {error}
            </p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
};

RoleSelector.displayName = 'OODS.RoleSelector';
