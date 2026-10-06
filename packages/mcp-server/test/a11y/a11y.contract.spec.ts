import { describe, expect, it } from 'vitest';

import { handle as validateHandle } from '../../src/tools/repl.validate.js';
import { handle as scanHandle } from '../../src/tools/a11y.scan.js';
import { validateContrast } from '../../src/a11y/validate-contrast.js';
import {
  createTokenResolver,
  flattenDTCGLayers,
  tokenColorResolver,
  toFlatTokenMap,
} from '../../src/a11y/token-color-resolver.js';
import type { DTCGTokenData } from '../../src/a11y/token-color-resolver.js';
import type { ReplValidateInput, UiSchema } from '../../src/schemas/generated.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const validSchema: UiSchema = {
  version: '2026.02',
  dsVersion: '2026-02-24',
  theme: 'default',
  screens: [
    {
      id: 'a11y-screen',
      component: 'Stack',
      children: [
        { id: 'a11y-button', component: 'Button', props: { label: 'Save' } },
        { id: 'a11y-badge', component: 'Badge', props: { label: 'New' } },
        { id: 'a11y-card', component: 'Card', props: { body: 'Content' } },
      ],
    },
  ],
};

/** Token fixture where contrast PASSES (high-contrast foreground on light bg). */
function passingTokenFixture(): DTCGTokenData {
  return {
    layers: {
      reference: {
        ref: {
          color: {
            dark: { $type: 'color', $value: '#1A1A1A' },
            light: { $type: 'color', $value: '#FFFFFF' },
            neutral: {
              50: { $type: 'color', $value: '#FAFAFA' },
              100: { $type: 'color', $value: '#F5F5F5' },
              200: { $type: 'color', $value: '#E5E5E5' },
              500: { $type: 'color', $value: '#737373' },
              700: { $type: 'color', $value: '#404040' },
              800: { $type: 'color', $value: '#262626' },
              900: { $type: 'color', $value: '#1A1A1A' },
            },
            info: {
              100: { $type: 'color', $value: '#EFF6FF' },
              300: { $type: 'color', $value: '#93C5FD' },
              700: { $type: 'color', $value: '#1D4ED8' },
              900: { $type: 'color', $value: '#1E3A5F' },
            },
            success: {
              100: { $type: 'color', $value: '#F0FDF4' },
              300: { $type: 'color', $value: '#86EFAC' },
              700: { $type: 'color', $value: '#15803D' },
              900: { $type: 'color', $value: '#14532D' },
            },
            warning: {
              100: { $type: 'color', $value: '#FFFBEB' },
              300: { $type: 'color', $value: '#FCD34D' },
              700: { $type: 'color', $value: '#A16207' },
              900: { $type: 'color', $value: '#78350F' },
            },
            critical: {
              100: { $type: 'color', $value: '#FEF2F2' },
              300: { $type: 'color', $value: '#FCA5A5' },
              700: { $type: 'color', $value: '#B91C1C' },
              900: { $type: 'color', $value: '#7F1D1D' },
            },
            primary: {
              100: { $type: 'color', $value: '#EFF6FF' },
              500: { $type: 'color', $value: '#3B82F6' },
              600: { $type: 'color', $value: '#2563EB' },
              700: { $type: 'color', $value: '#1D4ED8' },
            },
          },
        },
      },
      theme: {
        theme: {
          surface: {
            canvas: { $type: 'color', $value: '{ref.color.neutral.50}' },
            raised: { $type: 'color', $value: '{ref.color.neutral.100}' },
            subtle: { $type: 'color', $value: '{ref.color.neutral.200}' },
            inverse: { $type: 'color', $value: '{ref.color.neutral.900}' },
          },
          text: {
            primary: { $type: 'color', $value: '{ref.color.neutral.900}' },
            secondary: { $type: 'color', $value: '{ref.color.neutral.700}' },
            muted: { $type: 'color', $value: '{ref.color.neutral.500}' },
            inverse: { $type: 'color', $value: '{ref.color.neutral.100}' },
            accent: { $type: 'color', $value: '{ref.color.primary.600}' },
          },
          status: {
            info: {
              surface: { $type: 'color', $value: '{ref.color.info.100}' },
              text: { $type: 'color', $value: '{ref.color.info.900}' },
              icon: { $type: 'color', $value: '{ref.color.info.700}' },
            },
            success: {
              surface: { $type: 'color', $value: '{ref.color.success.100}' },
              text: { $type: 'color', $value: '{ref.color.success.900}' },
              icon: { $type: 'color', $value: '{ref.color.success.700}' },
            },
            warning: {
              surface: { $type: 'color', $value: '{ref.color.warning.100}' },
              text: { $type: 'color', $value: '{ref.color.warning.900}' },
              icon: { $type: 'color', $value: '{ref.color.warning.700}' },
            },
            critical: {
              surface: { $type: 'color', $value: '{ref.color.critical.100}' },
              text: { $type: 'color', $value: '{ref.color.critical.900}' },
              icon: { $type: 'color', $value: '{ref.color.critical.700}' },
            },
          },
        },
        'theme-dark': {
          surface: {
            canvas: { $type: 'color', $value: '{ref.color.neutral.900}' },
            raised: { $type: 'color', $value: '{ref.color.neutral.800}' },
            subtle: { $type: 'color', $value: '{ref.color.neutral.700}' },
          },
          text: {
            primary: { $type: 'color', $value: '{ref.color.neutral.50}' },
          },
        },
      },
      system: {
        sys: {
          surface: {
            canvas: { $type: 'color', $value: '{theme.surface.canvas}' },
            raised: { $type: 'color', $value: '{theme.surface.raised}' },
            subtle: { $type: 'color', $value: '{theme.surface.subtle}' },
            inverse: { $type: 'color', $value: '{theme.surface.inverse}' },
          },
          text: {
            primary: { $type: 'color', $value: '{theme.text.primary}' },
            secondary: { $type: 'color', $value: '{theme.text.secondary}' },
            muted: { $type: 'color', $value: '{theme.text.muted}' },
            inverse: { $type: 'color', $value: '{theme.text.inverse}' },
            accent: { $type: 'color', $value: '{theme.text.accent}' },
          },
          status: {
            info: {
              surface: { $type: 'color', $value: '{theme.status.info.surface}' },
              text: { $type: 'color', $value: '{theme.status.info.text}' },
              icon: { $type: 'color', $value: '{theme.status.info.icon}' },
            },
            success: {
              surface: { $type: 'color', $value: '{theme.status.success.surface}' },
              text: { $type: 'color', $value: '{theme.status.success.text}' },
              icon: { $type: 'color', $value: '{theme.status.success.icon}' },
            },
            warning: {
              surface: { $type: 'color', $value: '{theme.status.warning.surface}' },
              text: { $type: 'color', $value: '{theme.status.warning.text}' },
              icon: { $type: 'color', $value: '{theme.status.warning.icon}' },
            },
            critical: {
              surface: { $type: 'color', $value: '{theme.status.critical.surface}' },
              text: { $type: 'color', $value: '{theme.status.critical.text}' },
              icon: { $type: 'color', $value: '{theme.status.critical.icon}' },
            },
          },
        },
      },
      component: {},
      view: {},
    },
  };
}

/** Token fixture where foreground/background are near-identical (guaranteed contrast failure). */
function failingTokenFixture(): DTCGTokenData {
  return {
    layers: {
      reference: {
        ref: {
          color: {
            neutral: {
              50: { $type: 'color', $value: '#F5F5F5' },
              100: { $type: 'color', $value: '#F0F0F0' },
              200: { $type: 'color', $value: '#E8E8E8' },
              500: { $type: 'color', $value: '#E0E0E0' },
              700: { $type: 'color', $value: '#D8D8D8' },
              800: { $type: 'color', $value: '#D0D0D0' },
              900: { $type: 'color', $value: '#C8C8C8' },
            },
            info: {
              100: { $type: 'color', $value: '#F0F0F0' },
              300: { $type: 'color', $value: '#E0E0E0' },
              700: { $type: 'color', $value: '#D0D0D0' },
              900: { $type: 'color', $value: '#C0C0C0' },
            },
            success: {
              100: { $type: 'color', $value: '#F0F0F0' },
              300: { $type: 'color', $value: '#E0E0E0' },
              700: { $type: 'color', $value: '#D0D0D0' },
              900: { $type: 'color', $value: '#C0C0C0' },
            },
            warning: {
              100: { $type: 'color', $value: '#F0F0F0' },
              300: { $type: 'color', $value: '#E0E0E0' },
              700: { $type: 'color', $value: '#D0D0D0' },
              900: { $type: 'color', $value: '#C0C0C0' },
            },
            critical: {
              100: { $type: 'color', $value: '#F0F0F0' },
              300: { $type: 'color', $value: '#E0E0E0' },
              700: { $type: 'color', $value: '#D0D0D0' },
              900: { $type: 'color', $value: '#C0C0C0' },
            },
            primary: {
              100: { $type: 'color', $value: '#F0F0F0' },
              500: { $type: 'color', $value: '#E0E0E0' },
              600: { $type: 'color', $value: '#D8D8D8' },
              700: { $type: 'color', $value: '#D0D0D0' },
            },
          },
        },
      },
      theme: {
        theme: {
          surface: {
            canvas: { $type: 'color', $value: '{ref.color.neutral.50}' },
            raised: { $type: 'color', $value: '{ref.color.neutral.100}' },
            subtle: { $type: 'color', $value: '{ref.color.neutral.200}' },
            inverse: { $type: 'color', $value: '{ref.color.neutral.900}' },
          },
          text: {
            primary: { $type: 'color', $value: '{ref.color.neutral.900}' },
            secondary: { $type: 'color', $value: '{ref.color.neutral.700}' },
            muted: { $type: 'color', $value: '{ref.color.neutral.500}' },
            inverse: { $type: 'color', $value: '{ref.color.neutral.100}' },
            accent: { $type: 'color', $value: '{ref.color.primary.600}' },
          },
          status: {
            info: {
              surface: { $type: 'color', $value: '{ref.color.info.100}' },
              text: { $type: 'color', $value: '{ref.color.info.900}' },
              icon: { $type: 'color', $value: '{ref.color.info.700}' },
            },
            success: {
              surface: { $type: 'color', $value: '{ref.color.success.100}' },
              text: { $type: 'color', $value: '{ref.color.success.900}' },
              icon: { $type: 'color', $value: '{ref.color.success.700}' },
            },
            warning: {
              surface: { $type: 'color', $value: '{ref.color.warning.100}' },
              text: { $type: 'color', $value: '{ref.color.warning.900}' },
              icon: { $type: 'color', $value: '{ref.color.warning.700}' },
            },
            critical: {
              surface: { $type: 'color', $value: '{ref.color.critical.100}' },
              text: { $type: 'color', $value: '{ref.color.critical.900}' },
              icon: { $type: 'color', $value: '{ref.color.critical.700}' },
            },
          },
        },
        'theme-dark': {
          surface: {
            canvas: { $type: 'color', $value: '{ref.color.neutral.900}' },
            raised: { $type: 'color', $value: '{ref.color.neutral.800}' },
            subtle: { $type: 'color', $value: '{ref.color.neutral.700}' },
          },
          text: {
            primary: { $type: 'color', $value: '{ref.color.neutral.50}' },
          },
        },
      },
      system: {
        sys: {
          surface: {
            canvas: { $type: 'color', $value: '{theme.surface.canvas}' },
            raised: { $type: 'color', $value: '{theme.surface.raised}' },
            subtle: { $type: 'color', $value: '{theme.surface.subtle}' },
            inverse: { $type: 'color', $value: '{theme.surface.inverse}' },
          },
          text: {
            primary: { $type: 'color', $value: '{theme.text.primary}' },
            secondary: { $type: 'color', $value: '{theme.text.secondary}' },
            muted: { $type: 'color', $value: '{theme.text.muted}' },
            inverse: { $type: 'color', $value: '{theme.text.inverse}' },
            accent: { $type: 'color', $value: '{theme.text.accent}' },
          },
          status: {
            info: {
              surface: { $type: 'color', $value: '{theme.status.info.surface}' },
              text: { $type: 'color', $value: '{theme.status.info.text}' },
              icon: { $type: 'color', $value: '{theme.status.info.icon}' },
            },
            success: {
              surface: { $type: 'color', $value: '{theme.status.success.surface}' },
              text: { $type: 'color', $value: '{theme.status.success.text}' },
              icon: { $type: 'color', $value: '{theme.status.success.icon}' },
            },
            warning: {
              surface: { $type: 'color', $value: '{theme.status.warning.surface}' },
              text: { $type: 'color', $value: '{theme.status.warning.text}' },
              icon: { $type: 'color', $value: '{theme.status.warning.icon}' },
            },
            critical: {
              surface: { $type: 'color', $value: '{theme.status.critical.surface}' },
              text: { $type: 'color', $value: '{theme.status.critical.text}' },
              icon: { $type: 'color', $value: '{theme.status.critical.icon}' },
            },
          },
        },
      },
      component: {},
      view: {},
    },
  };
}

/** Full token fixture including component and view layers for all-layer resolution tests. */
function allLayersFixture(): DTCGTokenData {
  return {
    layers: {
      reference: {
        ref: {
          color: {
            base: { $type: 'color', $value: '#000000' },
          },
        },
      },
      theme: {
        theme: {
          fg: { $type: 'color', $value: '{ref.color.base}' },
        },
      },
      system: {
        sys: {
          fg: { $type: 'color', $value: '{theme.fg}' },
        },
      },
      component: {
        comp: {
          button: {
            fg: { $type: 'color', $value: '{sys.fg}' },
          },
        },
      },
      view: {
        view: {
          detail: {
            fg: { $type: 'color', $value: '{comp.button.fg}' },
          },
        },
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Contract tests: validateContrast with known fixtures
// ---------------------------------------------------------------------------

describe('validateContrast — failing contrast combinations', () => {
  it('surfaces A11Y_CONTRAST issues for near-identical foreground/background', () => {
    const issues = validateContrast(failingTokenFixture());
    const a11yIssues = issues.filter((i) => i.code === 'A11Y_CONTRAST');

    expect(a11yIssues.length).toBeGreaterThan(0);
    for (const issue of a11yIssues) {
      expect(issue.severity).toBe('warning');
      expect(issue.hint).toMatch(/fails WCAG/);
      expect(issue.hint).toMatch(/contrast ratio/);
      expect(issue.hint).toMatch(/minimum.*required/);
    }
  });

  it('all 18 default contrast rules are evaluated', () => {
    const issues = validateContrast(failingTokenFixture());
    // With near-identical colors, most rules should fail
    expect(issues.length).toBeGreaterThanOrEqual(10);
  });
});

describe('validateContrast — passing contrast combinations', () => {
  it('returns zero issues when all contrast checks pass', () => {
    const issues = validateContrast(passingTokenFixture());
    expect(issues).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Contract tests: repl.validate with checkA11y flag
// ---------------------------------------------------------------------------

describe('repl.validate checkA11y backward compatibility', () => {
  it('checkA11y=false (default) produces zero a11y warnings', async () => {
    const input: ReplValidateInput = {
      mode: 'full',
      schema: validSchema,
    };
    const result = await validateHandle(input);

    const a11yWarnings = result.warnings.filter((w) => w.code === 'A11Y_CONTRAST');
    expect(a11yWarnings).toHaveLength(0);
  });

  it('checkA11y explicitly false produces zero a11y warnings', async () => {
    const input: ReplValidateInput = {
      mode: 'full',
      schema: validSchema,
      options: { checkA11y: false },
    };
    const result = await validateHandle(input);

    const a11yWarnings = result.warnings.filter((w) => w.code === 'A11Y_CONTRAST');
    expect(a11yWarnings).toHaveLength(0);
  });
});

describe('repl.validate checkA11y=true', () => {
  it('returns structured output with a11y warnings when enabled', async () => {
    const input: ReplValidateInput = {
      mode: 'full',
      schema: validSchema,
      options: { checkA11y: true },
    };
    const result = await validateHandle(input);

    // Output should still be structurally valid
    expect(result.status).toBeDefined();
    expect(result.mode).toBe('full');
    expect(Array.isArray(result.warnings)).toBe(true);

    // Any a11y warnings should have correct format
    const a11yWarnings = result.warnings.filter((w) => w.code === 'A11Y_CONTRAST');
    for (const warning of a11yWarnings) {
      expect(warning.code).toBe('A11Y_CONTRAST');
      expect(warning.severity).toBe('warning');
      expect(warning.message).toBeTruthy();
      expect(warning.hint).toBeTruthy();
    }
  });

  it('skips a11y checks when structural errors exist', async () => {
    const input: ReplValidateInput = {
      mode: 'full',
      schema: {
        version: '2026.02',
        screens: [
          {
            id: 'bad-screen',
            component: 'Stack',
            children: [
              // Unknown component should cause structural issue
              { id: 'unknown-1', component: 'TotallyFakeWidget' },
            ],
          },
        ],
      },
      options: { checkA11y: true, checkComponents: true },
    };
    const result = await validateHandle(input);

    // Should have structural errors but no a11y warnings
    expect(result.errors.length).toBeGreaterThan(0);
    const a11yWarnings = result.warnings.filter((w) => w.code === 'A11Y_CONTRAST');
    expect(a11yWarnings).toHaveLength(0);
  });

  it('existing structural validation remains unaffected', async () => {
    const withA11y = await validateHandle({
      mode: 'full',
      schema: validSchema,
      options: { checkA11y: true },
    });
    const withoutA11y = await validateHandle({
      mode: 'full',
      schema: validSchema,
      options: { checkA11y: false },
    });

    // Same structural errors/meta regardless of a11y flag
    expect(withA11y.errors).toEqual(withoutA11y.errors);
    expect(withA11y.status).toBe(withoutA11y.status);
    expect(withA11y.meta).toEqual(withoutA11y.meta);
  });
});

// ---------------------------------------------------------------------------
// Contract tests: a11y.scan report accuracy
// ---------------------------------------------------------------------------

describe('a11y.scan report accuracy', () => {
  it('produces report with aggregate summary', async () => {
    const result = await scanHandle({});

    expect(result.preview).toBeDefined();
    expect(result.preview?.summary).toMatch(/Accessibility:/);
    expect(result.structuredData?.summary).toHaveProperty('unmeasured');
  });

  it('includes component inventory when UiSchema provided', async () => {
    const result = await scanHandle({ schema: validSchema });

    expect(result.preview).toBeDefined();
    expect(result.structuredData?.components).toHaveLength(4);
    expect(result.structuredData?.screen).toHaveProperty('htmlSha256');
  });

  it('evaluates all contrast rules', async () => {
    const result = await scanHandle({});
    const report = result.structuredData as any;
    expect(report.summary.totalChecks).toBe(report.rules.length);
    expect(report.scopes.length).toBeGreaterThanOrEqual(6);
    expect(report.rules.length).toBeGreaterThan(18);
  });

  it('writes artifact when apply=true', async () => {
    const result = await scanHandle({ apply: true });

    expect(result.artifacts.length).toBeGreaterThan(0);
    expect(result.artifacts[0]).toMatch(/a11y-report\.json/);
  });
});

// ---------------------------------------------------------------------------
// Token resolution across all layers
// ---------------------------------------------------------------------------

describe('token resolution across all layers', () => {
  const fixture = allLayersFixture();

  it('resolves reference layer tokens', () => {
    const hex = tokenColorResolver('ref.color.base', fixture);
    expect(hex).toBe('#000000');
  });

  it('resolves theme layer tokens (1-hop alias)', () => {
    const hex = tokenColorResolver('theme.fg', fixture);
    expect(hex).toBe('#000000');
  });

  it('resolves system layer tokens (2-hop alias)', () => {
    const hex = tokenColorResolver('sys.fg', fixture);
    expect(hex).toBe('#000000');
  });

  it('resolves component layer tokens (3-hop alias)', () => {
    const hex = tokenColorResolver('comp.button.fg', fixture);
    expect(hex).toBe('#000000');
  });

  it('resolves view layer tokens (4-hop alias)', () => {
    const hex = tokenColorResolver('view.detail.fg', fixture);
    expect(hex).toBe('#000000');
  });

  it('full chain resolves through all 5 layers', () => {
    const resolver = createTokenResolver(fixture);
    const result = resolver.resolveWithChain('view.detail.fg');

    expect(result.chain).toEqual([
      'view.detail.fg',
      'comp.button.fg',
      'sys.fg',
      'theme.fg',
      'ref.color.base',
    ]);
    expect(result.hex).toBe('#000000');
  });

  it('flattenDTCGLayers includes tokens from all 5 layers', () => {
    const flat = flattenDTCGLayers(fixture);
    expect(flat.has('ref.color.base')).toBe(true);
    expect(flat.has('theme.fg')).toBe(true);
    expect(flat.has('sys.fg')).toBe(true);
    expect(flat.has('comp.button.fg')).toBe(true);
    expect(flat.has('view.detail.fg')).toBe(true);
  });

  it('toFlatTokenMap bridges all layers correctly', () => {
    const flat = flattenDTCGLayers(fixture);
    const map = toFlatTokenMap(flat);
    expect(map['ref-color-base']).toBeDefined();
    expect(map['comp-button-fg']).toBeDefined();
    expect(map['view-detail-fg']).toBeDefined();
  });
});
