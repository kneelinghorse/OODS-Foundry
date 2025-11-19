/* @vitest-environment jsdom */

import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  PreferenceForm,
  type PreferenceDocumentChange,
  type PreferenceFormValidationState,
} from '../../../src/components/preferences/PreferenceForm.js';
import type { PreferenceDocument } from '../../../src/schemas/preferences/preference-document.js';

describe('PreferenceForm', () => {
  it('emits document changes when schema-driven fields update', async () => {
    const onDocumentChange = vi.fn();
    const user = userEvent.setup();
    render(<PreferenceForm onDocumentChange={onDocumentChange} />);

    const timezoneField = screen.getAllByLabelText(/timezone/i)[0];
    await user.clear(timezoneField);
    await user.type(timezoneField, 'Europe/Paris');

    expect(onDocumentChange).toHaveBeenCalled();
    const payload = onDocumentChange.mock.calls.at(-1)?.[0] as PreferenceDocumentChange<PreferenceDocument>;
    expect(payload.version).toBeTruthy();
    expect(payload.document.preferences.display.timezone).toBe('Europe/Paris');
  });

  it('reports validation issues for invalid inputs via onValidationChange', async () => {
    const onValidationChange = vi.fn();
    const user = userEvent.setup();
    render(<PreferenceForm onValidationChange={onValidationChange} />);

    const timezoneField = screen.getAllByLabelText(/timezone/i)[0];
    await user.clear(timezoneField);
    await user.type(timezoneField, 'invalid timezone');

    const state = onValidationChange.mock.calls.at(-1)?.[0] as PreferenceFormValidationState<PreferenceDocument> | undefined;
    expect(state).toBeDefined();
    expect(state?.issues.length ?? 0).toBeGreaterThan(0);
    expect(state?.issues.some((issue) => issue.path.includes('display') || issue.path.includes('timezone'))).toBe(true);
  });

  it('applies form context attributes to the RJSF form element', () => {
    const { container } = render(<PreferenceForm />);
    const form = container.querySelector('form');
    expect(form).toHaveAttribute('data-context', 'form');
    expect(form).toHaveClass('preference-form');
  });

  it('marks SMS phone number as required when the SMS channel is enabled (conditional schema logic)', async () => {
    const user = userEvent.setup();
    const { container } = render(<PreferenceForm version="1.1.0" />);

    const smsCheckbox = container.querySelector<HTMLInputElement>('#root_preferences_notifications_channels-sms');
    const phoneInput = container.querySelector<HTMLInputElement>('input[id$="_sms_phoneNumber"]');
    expect(phoneInput).toBeTruthy();
    expect(smsCheckbox).toBeTruthy();
    if (!phoneInput) {
      throw new Error('SMS phone number input not rendered');
    }
    if (!smsCheckbox) {
      throw new Error('SMS channel checkbox not rendered');
    }
    expect(phoneInput).not.toBeRequired();
    await user.click(smsCheckbox);
    expect(phoneInput).toBeRequired();
  });
});
