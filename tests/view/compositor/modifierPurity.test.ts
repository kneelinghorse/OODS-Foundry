import { describe, expect, it } from 'vitest';
import { validateModifierPurity } from '../../../src/compositor/tests/purityHarness.js';

type ButtonProps = {
  readonly disabled?: boolean;
  readonly label: string;
  readonly className?: string;
};

describe('validateModifierPurity', () => {
  it('passes for pure deterministic modifiers', () => {
    const withDisabledState = (props: ButtonProps) => {
      if (!props.disabled) {
        return {
          disabled: props.label === 'Archive',
          className: `${props.className ?? ''} btn`.trim(),
        };
      }

      return {
        className: `${props.className ?? ''} btn-disabled`.trim(),
      };
    };

    const result = validateModifierPurity(withDisabledState, {
      label: 'Archive',
      className: 'primary',
    });

    expect(result.disabled).toBe(true);
    expect(result.className).toBe('primary btn');
  });

  it('throws when modifier mutates props', () => {
    const mutatingModifier = (props: ButtonProps) => {
      (props as { className?: string }).className = 'mutated';
      return {
        className: props.className,
      };
    };

    expect(() =>
      validateModifierPurity(mutatingModifier, {
        label: 'Save',
      })
    ).toThrow(TypeError);
  });

  it('throws when modifier is non-deterministic', () => {
    const randomModifier = () => ({
      className: `btn-${Math.random()}`,
    });

    expect(() =>
      validateModifierPurity(randomModifier, {
        label: 'Save',
      })
    ).toThrowError('Modifier produced inconsistent output across identical inputs.');
  });

  it('throws when modifier mutates context', () => {
    type ModifierContext = { readonly flags: string[] };

    const mutatingContextModifier = (_props: ButtonProps, context?: ModifierContext) => {
      if (context) {
        (context.flags as string[]).push('mutated');
      }

      return {
        className: 'btn',
      };
    };

    expect(() =>
      validateModifierPurity(
        mutatingContextModifier,
        {
          label: 'Save',
        },
        { context: { flags: ['initial'] } }
      )
    ).toThrow(TypeError);
  });

  it('supports providing custom context for deterministic modifiers', () => {
    type ModifierContext = { readonly audience: 'admin' | 'viewer' };

    const withAudience = (_props: ButtonProps, context?: ModifierContext) => ({
      className: context?.audience === 'admin' ? 'btn btn-admin' : 'btn',
    });

    const result = validateModifierPurity(
      withAudience,
      {
        label: 'Save',
      },
      {
        context: { audience: 'admin' },
      }
    );

    expect(result.className).toBe('btn btn-admin');
  });
});
