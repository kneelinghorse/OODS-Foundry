import { describe, expect, it } from 'vitest';
import { ESLint } from 'eslint';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const tenancyRule = require('../../eslint/rules/no-unsafe-tenancy-override.cjs');

async function lintTenancy(code: string, filePath: string) {
  const eslint = new ESLint({
    useEslintrc: false,
    plugins: {
      oods: {
        rules: {
          'no-unsafe-tenancy-override': tenancyRule,
        },
      },
    },
    overrideConfig: {
      parser: require.resolve('@typescript-eslint/parser'),
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
      plugins: ['oods'],
      rules: {
        'oods/no-unsafe-tenancy-override': 'error',
      },
    },
  });

  const [{ messages }] = await eslint.lintText(code, {
    filePath,
  });
  return messages;
}

describe('no-unsafe-tenancy-override', () => {
  it('flags TenancyContext.setCurrentTenant in application code', async () => {
    const results = await lintTenancy(
      `
        declare const TenancyContext: any;
        TenancyContext.setCurrentTenant('tenant-alice');
      `,
      path.join(process.cwd(), 'src/services/example.ts')
    );

    expect(results).toHaveLength(1);
    expect(results[0].messageId).toBe('noManualTenantOverride');
  });

  it('allows TenancyContext.setCurrentTenant in tests', async () => {
    const results = await lintTenancy(
      `
        declare const TenancyContext: any;
        TenancyContext.setCurrentTenant('tenant-test');
      `,
      path.join(process.cwd(), 'tests/tenancy/example.spec.ts')
    );

    expect(results).toHaveLength(0);
  });

  it('flags direct mutation of TenancyContext.config', async () => {
    const results = await lintTenancy(
      `
        declare const TenancyContext: any;
        TenancyContext.config.mode = 'shared-schema';
      `,
      path.join(process.cwd(), 'src/services/example.ts')
    );

    expect(results).toHaveLength(1);
    expect(results[0].messageId).toBe('noConfigMutation');
  });
});
