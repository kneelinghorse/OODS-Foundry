import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Config } from 'tailwindcss';
import contextVariants from '../../packages/tw-variants/src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tokensUrl = import.meta.resolve('@oods/tokens/tailwind', import.meta.url);
const tokensPath = fileURLToPath(new URL(tokensUrl));

const config: Config = {
  content: [
    './pages/**/*.{ts,tsx,html}',
    './components/**/*.{ts,tsx,html}',
    './layouts/**/*.{ts,tsx,html}',
  ],
  safelist: [
    'context-list',
    'context-detail',
    'context-form',
    'context-timeline',
  ],
  theme: {
    extend: {},
  },
  plugins: [
    contextVariants({
      tokensPath,
    }),
  ],
};

export default config;
