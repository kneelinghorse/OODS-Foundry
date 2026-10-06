import { createServer } from 'vite';
import { chromium } from 'playwright';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NUCLEUS_COMPONENT_IDS, componentContracts } from '@oods/component-contracts';
import { SUPPORTED_COMPONENT_THEME_CELLS } from '@oods/component-styles';
import { runComponentThemeProof } from '../../../scripts/product-reality/component-theme-proof.mjs';

await runComponentThemeProof({ framework: 'vue', packageRoot: resolve(dirname(fileURLToPath(import.meta.url)), '..'),
  canonicalIds: NUCLEUS_COMPONENT_IDS, supportedCells: SUPPORTED_COMPONENT_THEME_CELLS, contracts: componentContracts, createServer, chromium });
