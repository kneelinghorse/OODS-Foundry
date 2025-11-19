/* @vitest-environment jsdom */

import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { NotificationMatrix } from '../../../src/components/preferences/NotificationMatrix.js';

describe('NotificationMatrix component', () => {
  it('renders channel toggles and emits updated matrix on change', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<NotificationMatrix onChange={onChange} />);

    const emailMentionToggle = screen.getByRole('switch', {
      name: /email notifications for Mention/i,
    });
    expect(emailMentionToggle).toBeChecked();

    await user.click(emailMentionToggle);

    const matrix = onChange.mock.calls.at(-1)?.[0];
    expect(matrix).toBeDefined();
    expect(matrix.mention.email).toBe(false);
  });

  it('applies bulk enable/disable controls', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<NotificationMatrix onChange={onChange} />);

    const disableAll = screen.getByRole('button', { name: /disable all/i });
    await user.click(disableAll);
    let matrix = onChange.mock.calls.at(-1)?.[0];
    expect(matrix).toBeDefined();
    expect(matrix.new_comment.email).toBe(false);
    expect(matrix.mention.push).toBe(false);

    const enableAll = screen.getByRole('button', { name: /enable all/i });
    await user.click(enableAll);
    matrix = onChange.mock.calls.at(-1)?.[0];
    expect(matrix.new_comment.email).toBe(true);
    expect(matrix.mention.push).toBe(true);
  });

  it('toggles entire channels from header actions', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<NotificationMatrix onChange={onChange} />);

    const enableEmail = screen.getByRole('button', {
      name: /Enable Email for all events/i,
    });
    await user.click(enableEmail);

    let matrix = onChange.mock.calls.at(-1)?.[0];
    expect(matrix.new_comment.email).toBe(true);
    expect(matrix.new_follower.email).toBe(true);

    const disableEmail = screen.getByRole('button', {
      name: /Disable Email for all events/i,
    });
    await user.click(disableEmail);

    matrix = onChange.mock.calls.at(-1)?.[0];
    expect(matrix.new_comment.email).toBe(false);
    expect(matrix.mention.email).toBe(false);
  });
});
