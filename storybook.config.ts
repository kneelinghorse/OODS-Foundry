import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import type { StorybookConfig } from '@storybook/react-vite';
import tsconfigPaths from 'vite-tsconfig-paths';

const workspaceRoot = path.dirname(fileURLToPath(import.meta.url));

const missionStoriesRoot = path.join(workspaceRoot, 'stories');
const storiesRoot = path.join(workspaceRoot, 'src', 'stories');
const explorerStoriesRoot = path.join(workspaceRoot, 'apps', 'explorer', 'src', 'stories');
const explorerIntroRoot = path.join(workspaceRoot, 'apps', 'explorer', '.storybook');
const tokensDistDir = path.resolve(workspaceRoot, 'packages', 'tokens', 'dist');
const tokensTailwindPath = path.resolve(tokensDistDir, 'tailwind', 'tokens.json');
const tokensCssPath = path.resolve(tokensDistDir, 'css', 'tokens.css');
const tokensModulePath = path.resolve(tokensDistDir, 'index.js');
const provenanceCandidate = path.resolve(workspaceRoot, 'dist', 'pkg', 'provenance.json');
const provenanceFallback = path.resolve(workspaceRoot, 'configs', 'provenance.placeholder.json');
let provenancePayload: Record<string, unknown> = {
  generated_at: 'unavailable',
  sb_build_hash: 'unavailable',
  vr_baseline_id: 'unavailable',
};

try {
  const provenanceSource = fs.existsSync(provenanceCandidate) ? provenanceCandidate : provenanceFallback;
  const raw = fs.readFileSync(provenanceSource, 'utf8');
  const parsed = JSON.parse(raw);
  if (parsed && typeof parsed === 'object') {
    provenancePayload = parsed as Record<string, unknown>;
  }
} catch (error) {
  console.warn('[storybook] Unable to load provenance metadata. Falling back to placeholder.', error);
}

const provenanceSerialized = JSON.stringify(provenancePayload).replace(/</g, '\\u003c');
const provenanceScriptTag = `<script>window.__OODS_PROVENANCE__ = ${provenanceSerialized};</script>`;
let tokensBuilt = false;

const config: StorybookConfig = {
  stories: [
    `${explorerIntroRoot}/**/*.mdx`,
    `${missionStoriesRoot}/**/*.mdx`,
    `${missionStoriesRoot}/**/*.stories.@(ts|tsx)`,
    `${storiesRoot}/**/*.mdx`,
    `${storiesRoot}/**/*.stories.@(ts|tsx)`,
    `${explorerStoriesRoot}/**/*.mdx`,
    `${explorerStoriesRoot}/**/*.stories.@(ts|tsx)`,
  ],
  addons: [
    '@storybook/addon-docs',
    '@storybook/addon-a11y',
    '@storybook/addon-onboarding',
    '@storybook/addon-vitest',
    '@chromatic-com/storybook',
    './apps/explorer/addons/storybook-addon-agent/register.tsx',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  managerHead: (head) => `${head ?? ''}${provenanceScriptTag}`,
  previewHead: (head) => `${head ?? ''}${provenanceScriptTag}`,
  docs: {
    autodocs: true,
  },
  viteFinal: async (baseConfig) => {
    if (!tokensBuilt) {
      execSync('pnpm --filter @oods/tokens run build', {
        stdio: 'inherit',
        cwd: workspaceRoot,
      });
      tokensBuilt = true;
    }
    baseConfig.plugins = [
      ...(baseConfig.plugins ?? []),
      tsconfigPaths({
        projects: [path.resolve(workspaceRoot, 'tsconfig.storybook.json')],
      }),
    ];
    baseConfig.root = workspaceRoot;
    baseConfig.resolve = {
      ...(baseConfig.resolve ?? {}),
      alias: {
        ...(baseConfig.resolve?.alias ?? {}),
        '~': workspaceRoot,
        '@': path.join(workspaceRoot, 'src'),
        '@storybook/blocks': '@storybook/addon-docs/blocks',
        '@oods/tokens/css': tokensCssPath,
        '@oods/tokens/tailwind': tokensTailwindPath,
        '@oods/tokens': tokensModulePath,
      },
    };
    const fsAllow = new Set<string>(
      [
        ...(Array.isArray(baseConfig?.server?.fs?.allow) ? baseConfig.server!.fs!.allow! : []),
        workspaceRoot,
        path.join(workspaceRoot, 'apps'),
        path.join(workspaceRoot, 'packages'),
        path.join(workspaceRoot, 'tokens'),
        path.join(workspaceRoot, 'docs'),
        path.join(workspaceRoot, 'domains'),
      ].filter(Boolean)
    );
    baseConfig.server = {
      ...(baseConfig.server ?? {}),
      fs: {
        allow: Array.from(fsAllow),
      },
    };
    return baseConfig;
  },
};

export default config;
