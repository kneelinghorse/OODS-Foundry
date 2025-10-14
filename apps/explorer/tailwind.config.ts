import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Config } from 'tailwindcss';
import contextVariants from '../../packages/tw-variants/src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tokensPath = path.resolve(
  __dirname,
  '../../packages/tokens/dist/tailwind/tokens.json',
);

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
