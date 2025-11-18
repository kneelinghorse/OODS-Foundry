/* @vitest-environment jsdom */

import { render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AddressForm } from '@/components/addresses/address-form.js';
import { createAddressDraft, type AddressFormEntry } from '@/components/addresses/address-types.js';

expect.extend({ toHaveNoViolations });

let originalCanvasContext: typeof HTMLCanvasElement.prototype.getContext;

beforeAll(() => {
  originalCanvasContext = HTMLCanvasElement.prototype.getContext;
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: () => null,
  });
});

afterAll(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: originalCanvasContext,
  });
});

const entry: AddressFormEntry = {
  role: 'billing',
  address: createAddressDraft({
    countryCode: 'US',
    postalCode: '94105',
    administrativeArea: 'CA',
    locality: 'San Francisco',
    addressLines: ['500 Howard St'],
    organizationName: 'OODS Foundry',
  }),
  metadata: { validationStatus: 'unvalidated', validationFlags: {} },
};

describe('AddressForm accessibility', () => {
  it(
    'has no axe violations',
    async () => {
      const { container } = render(<AddressForm entry={entry} roles={['billing', 'shipping']} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    },
    15000
  );
});
