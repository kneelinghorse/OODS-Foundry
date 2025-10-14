// CommonJS fixture representing a valid TraitDefinition-like object
module.exports = {
  trait: {
    name: 'JsColorized',
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
      enumValues: ['default', 'primary', 'secondary', 'accent'],
    },
    {
      name: 'allowCustomColors',
      type: 'boolean',
      required: false,
      default: false,
      description: 'Whether to allow custom color values',
    },
  ],

  schema: {
    color: {
      type: 'string',
      required: false,
    },
  },

  semantics: {
    color: {
      semantic_type: 'color_field',
      ui_hints: { component: 'ColorPicker' },
    },
  },

  view_extensions: {
    list: [{ component: 'ColorSwatch', props: { size: 'sm' } }],
  },

  tokens: {
    'colorized-swatch-size-sm': '1rem',
  },

  metadata: {
    created: '2025-10-07',
    author: 'OODS Team',
  },
};

