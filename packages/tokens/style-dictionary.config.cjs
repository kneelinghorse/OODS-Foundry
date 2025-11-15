/**
 * Style Dictionary configuration for the @oods/tokens package.
 * The heavy lifting (custom formats, expand config) happens inside scripts/build.mjs.
 */
const prefix = 'oods';

module.exports = {
  prefix,
  source: ['src/**/*.json'],
  preprocessors: ['tokens-studio'],
  expand: {},
  log: {
    warnings: 'warn',
    verbosity: 'info',
  },
  platforms: {
    css: {
      transformGroup: 'tokens-studio',
      transforms: ['name/kebab', 'name/css-prefix'],
      buildPath: 'dist/css/',
      files: [
        {
          destination: 'tokens.css',
          format: 'css/variables',
          options: {
            selector: ':root',
            outputReferences: true,
          },
        },
      ],
    },
    ts: {
      transformGroup: 'tokens-studio',
      transforms: ['name/kebab'],
      buildPath: 'dist/ts/',
      files: [
        {
          destination: 'tokens.ts',
          format: 'typescript/tokens',
          options: {
            prefix,
            banner: true,
          },
        },
      ],
    },
    tailwind: {
      transformGroup: 'tokens-studio',
      transforms: ['name/kebab'],
      buildPath: 'dist/tailwind/',
      files: [
        {
          destination: 'tokens.json',
          format: 'tailwind/tokens',
          options: {
            prefix,
            indent: 2,
          },
        },
      ],
    },
  },
};
