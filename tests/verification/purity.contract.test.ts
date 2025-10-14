import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { FlatESLint } from 'eslint/use-at-your-own-risk';
import { describe, expect, it } from 'vitest';
import type { PageHeaderProps } from '../../src/modifiers/withStatusBadge.modifier.js';

function locateHarnessModule(): { readonly path: string | null; readonly expectationMessage: string } {
  const here = fileURLToPath(new URL('.', import.meta.url));
  const tsPath = resolve(here, '../../src/compositor/tests/purityHarness.ts');
  const jsPath = resolve(here, '../../src/compositor/tests/purityHarness.js');

  if (existsSync(tsPath)) {
    return {
      path: tsPath,
      expectationMessage: 'Expected purity harness at src/compositor/tests/purityHarness.ts',
    };
  }

  if (existsSync(jsPath)) {
    return {
      path: jsPath,
      expectationMessage: 'Expected purity harness at src/compositor/tests/purityHarness.ts',
    };
  }

  return {
    path: null,
    expectationMessage: 'Expected purity harness at src/compositor/tests/purityHarness.ts',
  };
}

describe('B3.3 — Purity Harness', () => {
  it('exposes validateModifierPurity under src/compositor/tests', async () => {
    const { path, expectationMessage } = locateHarnessModule();
    expect(path, expectationMessage).not.toBeNull();

    if (!path) {
      return;
    }

    const harnessModule = await import(/* @vite-ignore */ pathToFileURL(path).href);
    expect(typeof harnessModule.validateModifierPurity).toBe('function');
  });

  it('validates sample modifiers for deterministic output', async () => {
    const { path, expectationMessage } = locateHarnessModule();
    expect(path, expectationMessage).not.toBeNull();

    if (!path) {
      return;
    }

    const harnessModule = await import(/* @vite-ignore */ pathToFileURL(path).href);
    const { withStatusBadge } = await import('../../src/modifiers/withStatusBadge.modifier.js');

    const toValidate = harnessModule.validateModifierPurity as (
      modifier: typeof withStatusBadge,
      props: PageHeaderProps,
      options?: { readonly context?: unknown }
    ) => Partial<PageHeaderProps>;

    const baseProps: PageHeaderProps = {
      badges: [
        {
          id: 'existing',
          label: 'Existing',
          tone: 'neutral',
        },
      ],
    };

    const result = toValidate(withStatusBadge, baseProps, {
      context: {
        renderContext: {
          object: { id: 'sample', tokens: {} },
          data: { status: 'active' },
          theme: { id: 'default', mode: 'light', tokens: {} },
          permissions: [],
          viewport: { width: 1280, height: 720 },
        },
      },
    });

    expect(result.badges?.map((badge) => badge.id)).toContain('status-active');
  });

  it('enforces the oods/no-hooks-in-modifiers ESLint rule for modifier modules', async () => {
    const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
    const eslint = new FlatESLint({
      cwd: projectRoot,
    });

    const invalidModifier = `
      import { useState } from 'react';

      export const impureModifier = (props) => {
        const [count] = useState(0);
        return {
          ...props,
          count,
        };
      };
    `;

    const [result] = await eslint.lintText(invalidModifier, {
      filePath: 'src/modifiers/__tmp__/impure.modifier.ts',
    });

    expect(result.errorCount).toBeGreaterThan(0);
    const matchingRule = result.messages.find(
      (message) => message.ruleId === 'oods/no-hooks-in-modifiers'
    );
    expect(matchingRule, 'Expected lint failure from oods/no-hooks-in-modifiers').toBeDefined();
  });
  it('documents the modifier purity contract for trait authors', () => {
    const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
    const docPath = resolve(projectRoot, 'docs/patterns/modifier-purity.md');

    expect(
      existsSync(docPath),
      'Expected app/docs/patterns/modifier-purity.md to exist with the purity checklist.'
    ).toBe(true);

    if (!existsSync(docPath)) {
      return;
    }

    const contents = readFileSync(docPath, 'utf8');
    expect(contents).toMatch(/Pure Modifier Pattern/);
    expect(contents).toMatch(/Developer Checklist/);
    expect(contents).toMatch(/validateModifierPurity/);
    expect(contents).toMatch(/Forbidden Anti-Patterns/);
  });
});
