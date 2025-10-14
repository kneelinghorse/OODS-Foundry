/**
 * Colorized Trait (TypeScript version)
 *
 * Adds color theming capabilities to objects.
 * Demonstrates parameterized trait using 'as const' pattern (Research R1).
 */

import type { TraitDefinition } from '../../src/core/trait-definition.ts';

const ColorizedTrait = {
  trait: {
    name: 'Colorized',
    version: '1.0.0',
    description: 'Adds customizable color properties to objects',
    category: 'styling',
    tags: ['color', 'theme', 'styling'],
  },

  parameters: [
    {
      name: 'colorScheme',
      type: 'enum',
      required: false,
      default: 'default',
      description: 'The color scheme to use',
      enumValues: ['default', 'primary', 'secondary', 'accent'] as const,
    },
    {
      name: 'allowCustomColors',
      type: 'boolean',
      required: false,
      default: false,
      description: 'Whether to allow custom color values',
    },
  ] as const,

  schema: {
    color: {
      type: 'string',
      required: false,
      description: 'Primary color value (hex, rgb, or named)',
      validation: {
        pattern: '^(#[0-9A-Fa-f]{6}|rgb\\(.*\\)|[a-z]+)$',
      },
    },
    backgroundColor: {
      type: 'string',
      required: false,
      description: 'Background color value',
    },
    borderColor: {
      type: 'string',
      required: false,
      description: 'Border color value',
    },
  },

  semantics: {
    color: {
      semantic_type: 'color_field',
      ui_hints: {
        component: 'ColorPicker',
      },
    },
    backgroundColor: {
      semantic_type: 'color_field',
      ui_hints: {
        component: 'ColorPicker',
      },
    },
    borderColor: {
      semantic_type: 'color_field',
      ui_hints: {
        component: 'ColorPicker',
      },
    },
  },

  view_extensions: {
    list: [
      {
        component: 'ColorSwatch',
        props: {
          size: 'sm',
          showLabel: false,
        },
      },
    ],
    detail: [
      {
        component: 'ColorPalette',
        position: 'top',
        props: {
          showAllColors: true,
        },
      },
    ],
    form: [
      {
        component: 'ColorPickerGroup',
        position: 'top',
        props: {
          showPresets: true,
        },
      },
    ],
  },

  tokens: {
    'colorized-swatch-size-sm': '1rem',
    'colorized-swatch-size-md': '1.5rem',
    'colorized-swatch-size-lg': '2rem',
    'colorized-border-width': '2px',
  },

  metadata: {
    created: '2025-10-07',
    author: 'OODS Team',
  },
} as const satisfies TraitDefinition;

export default ColorizedTrait;
