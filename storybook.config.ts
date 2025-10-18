import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { StorybookConfig } from '@storybook/react-vite';
import tsconfigPaths from 'vite-tsconfig-paths';

const workspaceRoot = path.dirname(fileURLToPath(import.meta.url));

const storiesRoot = path.join(workspaceRoot, 'src', 'stories');
const explorerStoriesRoot = path.join(workspaceRoot, 'apps', 'explorer', 'src', 'stories');
const tokensDistDir = path.join(workspaceRoot, 'packages', 'tokens', 'dist');
const tokensTailwindPath = path.join(tokensDistDir, 'tailwind', 'tokens.json');
const tokensCssPath = path.join(tokensDistDir, 'css', 'tokens.css');
const tokensModulePath = path.join(tokensDistDir, 'index.js');

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
    baseConfig.plugins = [...(baseConfig.plugins ?? []), tsconfigPaths()];
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
