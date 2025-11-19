// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PreferenceForm } from '@/components/preferences/PreferenceForm.tsx';
import { getPreferenceExample } from '@/traits/preferenceable/schema-registry.ts';

describe('PreferenceForm (RJSF integration)', () => {
  it('renders schema-driven inputs for older versions', async () => {
    const document = getPreferenceExample('1.1.0');
    const onDocumentChange = vi.fn();

    render(<PreferenceForm version="1.1.0" document={document} onDocumentChange={onDocumentChange} />);

    const frequencySelect = screen.getByLabelText(/frequency/i);
    await userEvent.selectOptions(frequencySelect, 'weekly');

    expect(onDocumentChange).toHaveBeenCalled();
    const payload = onDocumentChange.mock.calls[onDocumentChange.mock.calls.length - 1]?.[0];
    expect(payload?.document.preferences.notifications.digest.frequency).toBe('weekly');
  });

  it('defaults to the latest schema when version is omitted', async () => {
    const onDocumentChange = vi.fn();
    render(<PreferenceForm onDocumentChange={onDocumentChange} />);

    const shareActivityToggle = screen.getByLabelText(/shareactivity/i);
    expect(shareActivityToggle).toBeInTheDocument();

    await userEvent.click(shareActivityToggle);
    expect(onDocumentChange).toHaveBeenCalled();
    expect(onDocumentChange.mock.calls[0]?.[0].version).toBe('2.0.0');
  });
});
