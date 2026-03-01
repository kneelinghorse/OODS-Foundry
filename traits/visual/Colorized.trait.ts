import type { TraitDefinition } from '../../src/core/trait-definition.ts';

export const COLORIZED_TONES = [
  'neutral',
  'info',
  'accent',
  'success',
  'warning',
  'critical',
] as const;

/** @deprecated Use COLORIZED_TONES instead. */
export const COLORIZED_STATES = COLORIZED_TONES;

export type ColorizedTone = (typeof COLORIZED_TONES)[number];
export type ContrastLevel = 'AA' | 'AAA';
export type ColorMode = 'semantic' | 'custom';

const ColorizedTrait = {
  trait: {
    name: 'Colorized',
    version: '2.0.0',
    description:
      'Maps lifecycle states to semantic color tokens for consistent status theming. ' +
      'Bridges the Stateful trait to the OODS token system via OKLCH-based, WCAG-compliant color resolution.',
    category: 'visual',
    tags: ['color', 'semantic', 'status', 'theming', 'accessibility', 'oklch', 'tokens'],
  },

  parameters: [
    {
      name: 'colorStates',
      type: 'string[]',
      required: true,
      description:
        'Semantic tone keys that define the palette of status colors available to this object.',
      default: COLORIZED_TONES,
      validation: {
        items: { enum: COLORIZED_TONES },
      },
    },
    {
      name: 'contrastLevel',
      type: 'string',
      required: false,
      description: 'WCAG contrast compliance target (AA = 4.5:1 text / 3:1 UI, AAA = 7:1 / 4.5:1).',
      default: 'AA',
      validation: { enum: ['AA', 'AAA'] },
    },
    {
      name: 'colorMode',
      type: 'string',
      required: false,
      description:
        'Token resolution mode. "semantic" uses system status tokens; "custom" uses object-specific tokens.',
      default: 'semantic',
      validation: { enum: ['semantic', 'custom'] },
    },
    {
      name: 'fallbackTone',
      type: 'string',
      required: false,
      description: 'Tone applied when a status value cannot be resolved to a known color state.',
      default: 'neutral',
      validation: { enum: COLORIZED_TONES },
    },
  ] as const,

  schema: {
    color_state: {
      type: 'string',
      required: true,
      description: 'Active semantic tone key derived from the current Stateful status.',
      validation: {
        enumFromParameter: 'colorStates',
      },
    },
    resolved_token_set: {
      type: 'object',
      required: false,
      description:
        'Materialized CSS custom property map for the active color_state (surface, border, text, icon). Computed at render time.',
      validation: {
        computed: true,
        properties: ['surface', 'border', 'text', 'icon'],
      },
    },
    accessibility_label: {
      type: 'string',
      required: false,
      description:
        'Human-readable status label for screen readers, generated from color_state via toLabel(). Computed at render time.',
      validation: {
        computed: true,
      },
    },
  },

  semantics: {
    color_state: {
      semantic_type: 'status.visual',
      token_mapping: 'tokenMap(status.state.*)',
      ui_hints: {
        component: 'ColorTokenBadge',
        parameterSource: 'colorStates',
      },
    },
    resolved_token_set: {
      semantic_type: 'status.visual.tokens',
      token_mapping: 'computed',
      ui_hints: {
        component: 'internal',
      },
    },
  },

  view_extensions: {
    list: [
      {
        component: 'ColorSwatch',
        props: {
          field: 'color_state',
          size: 'sm',
        },
      },
    ],
    detail: [
      {
        component: 'StatusColorLegend',
        position: 'top',
        props: {
          parameter: 'colorStates',
          badgeField: 'color_state',
          showTokenReferences: true,
        },
      },
    ],
    form: [
      {
        component: 'ColorStatePicker',
        position: 'top',
        props: {
          parameter: 'colorStates',
          field: 'color_state',
        },
      },
    ],
    card: [
      {
        component: 'ColorizedBadge',
        position: 'before',
        props: {
          field: 'color_state',
          tone: 'status',
          showIcon: true,
        },
      },
    ],
  },

  tokens: {
    'status.state.badge.radius': 'var(--radius-md)',
    'status.state.badge.gap': 'var(--space-1)',
    'status.state.badge.icon.size': 'var(--size-2)',
  },

  dependencies: [
    {
      trait: 'Stateful',
      optional: false,
    },
  ] as const,

  metadata: {
    created: '2025-10-12',
    updated: '2026-02-28',
    owners: ['design@oods.systems', 'engineering@oods.systems'],
    maturity: 'stable',
    accessibility: {
      keyboard: 'n/a — visual presentation trait with no interactive elements.',
      screenreader:
        'StatusBadge announces the accessibility_label and tone. Color is never the sole status channel.',
      colorBlind:
        'All status badges MUST include icon+text alongside color. Ensures deuteranopia/protanopia/tritanopia safety.',
      contrastEnforcement:
        'Build-time: tokens:guardrails checks OKLCH delta-L >= 10, delta-C <= 0.04. ' +
        'Design-time: text-on-surface meets contrastLevel (4.5:1 AA, 7:1 AAA).',
    },
    regionsUsed: ['badges', 'forms', 'detail', 'card'],
    examples: ['Incident', 'Release', 'Subscription', 'Invoice'],
    references: [
      'Trait Engine Spec v0.1 section 2',
      'WCAG 2.1 SC 1.4.1 — Use of Color',
      'WCAG 2.1 SC 1.4.3 — Contrast (Minimum)',
      'WCAG 2.1 SC 1.4.11 — Non-text Contrast',
      'src/components/statusables/statusRegistry.ts',
    ],
  },
} as const satisfies TraitDefinition;

export default ColorizedTrait;
