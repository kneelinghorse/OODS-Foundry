/* @vitest-environment jsdom */

import { describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';

import { PreferenceForm } from '../../../src/components/preferences/PreferenceForm.js';

describe('PreferenceForm accessibility', () => {
  it('renders without axe violations', async () => {
    const { container } = render(<PreferenceForm />);
    const results = await axe(container, {
      rules: {
        'color-contrast': { enabled: false },
      },
    });
    expect(results.violations).toHaveLength(0);
  });
});
