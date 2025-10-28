import { test as base, expect } from '@playwright/test';

import type { PerformanceSnapshot } from './schema';
import { recordSnapshot } from './resultsStore';

type PerfFixtures = {
  recordSnapshot: (snapshot: PerformanceSnapshot) => void;
};

const perfTest = base.extend<PerfFixtures>({
  recordSnapshot: async ({}, use) => {
    await use(async (snapshot) => {
      await recordSnapshot(snapshot);
    });
  },
});

export { perfTest as test, expect };
