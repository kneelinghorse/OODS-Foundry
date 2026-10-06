/* @vitest-environment node */

import { sharedScenarios } from '@oods/component-contracts';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { renderSharedScenario } from './scenario-fixtures.js';

describe('@oods/components-react server rendering', () => {
  it('server-renders every shared nucleus scenario without browser globals', () => {
    for (const scenario of sharedScenarios) {
      const html = renderToString(renderSharedScenario(scenario));
      expect(html).toContain(`data-oods-component="${scenario.oodsComponentId}"`);
      expect(html.length).toBeGreaterThan(30);
    }
  });
});
