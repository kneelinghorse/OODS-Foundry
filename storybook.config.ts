import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import type { StorybookConfig } from '@storybook/react-vite';
import tsconfigPaths from 'vite-tsconfig-paths';

const workspaceRoot = path.dirname(fileURLToPath(import.meta.url));

const storiesRoot = path.join(workspaceRoot, 'src', 'stories');
const explorerStoriesRoot = path.join(workspaceRoot, 'apps', 'explorer', 'src', 'stories');
const tokensDistDir = path.resolve(workspaceRoot, 'packages', 'tokens', 'dist');
const tokensTailwindPath = path.resolve(tokensDistDir, 'tailwind', 'tokens.json');
const tokensCssPath = path.resolve(tokensDistDir, 'css', 'tokens.css');
const tokensModulePath = path.resolve(tokensDistDir, 'index.js');
let tokensBuilt = false;

const config: StorybookConfig = {
  stories: [
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
