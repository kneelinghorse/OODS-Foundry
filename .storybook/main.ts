import type { StorybookConfig } from '@storybook/react-vite';
import baseConfig from '../storybook.config';
const baseViteFinal = baseConfig.viteFinal;

function remapStories(patterns: StorybookConfig['stories']): StorybookConfig['stories'] {
  if (!patterns) return patterns;
  return patterns.map((pattern) => {
    if (typeof pattern === 'string') {
      return pattern.startsWith('./') ? `../${pattern.slice(2)}` : pattern;
    }
    if (typeof pattern === 'object' && pattern && 'directory' in pattern && typeof pattern.directory === 'string') {
      const directory = pattern.directory.startsWith('./')
        ? `../${pattern.directory.slice(2)}`
        : pattern.directory;
      return { ...pattern, directory };
    }
    return pattern;
  });
}

function remapAddons(addons: StorybookConfig['addons']): StorybookConfig['addons'] {
  if (!addons) return addons;
  return addons.map((addon) => {
    if (typeof addon === 'string') {
      return addon.startsWith('./') ? `../${addon.slice(2)}` : addon;
    }
    if (typeof addon === 'object' && addon && 'name' in addon && typeof addon.name === 'string') {
      const name = addon.name.startsWith('./') ? `../${addon.name.slice(2)}` : addon.name;
      return { ...addon, name };
    }
    return addon;
  });
}

const config: StorybookConfig = {
  ...baseConfig,
  stories: remapStories(baseConfig.stories),
  addons: remapAddons(baseConfig.addons),
  viteFinal: async (incomingConfig, options) => {
    const resolved =
      typeof baseViteFinal === 'function' ? await baseViteFinal(incomingConfig, options) : incomingConfig;
    const chunkSizeWarningLimit = Math.max(resolved.build?.chunkSizeWarningLimit ?? 0, 2000);
    return {
      ...resolved,
      build: {
        ...(resolved.build ?? {}),
        chunkSizeWarningLimit,
      },
    };
  },
};

export default config;
