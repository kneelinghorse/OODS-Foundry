import { describe, expect, it } from 'vitest';
import { ESLint } from 'eslint';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const metadataRule = require('../../eslint/rules/no-account-unsafe-metadata.cjs');

async function lintMetadata(code: string) {
  const eslint = new ESLint({
    useEslintrc: false,
    plugins: {
      oods: {
        rules: {
          'no-account-unsafe-metadata': metadataRule,
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
        'oods/no-account-unsafe-metadata': 'error',
      },
    },
  });

  const [{ messages }] = await eslint.lintText(code, {
    filePath: path.join(process.cwd(), 'src/domain/accounts/example.ts'),
  });
  return messages;
}

describe('no-account-unsafe-metadata', () => {
  it('flags direct metadata writes with no validation', async () => {
    const results = await lintMetadata(`
      const account = { metadata: {} };
      account.metadata = { foo: 'bar' };
    `);

    expect(results).toHaveLength(1);
    expect(results[0].messageId).toBe('unsafeMetadataWrite');
  });

  it('flags metadata writes when MetadataPolicy is imported but validation missing', async () => {
    const results = await lintMetadata(`
      import { MetadataPolicy } from 'domain/accounts/metadata-policy';

      export function update(account: { metadata?: unknown }) {
        account.metadata = { foo: 'bar' };
        MetadataPolicy; // prevent unused import stripping in parser
      }
    `);

    expect(results).toHaveLength(1);
    expect(results[0].messageId).toBe('missingValidation');
  });

  it('allows metadata writes when validation precedes assignment', async () => {
    const results = await lintMetadata(`
      import { MetadataPolicy } from 'domain/accounts/metadata-policy';

      export function update(account: { metadata?: unknown }) {
        MetadataPolicy.validate(account);
        account.metadata = { foo: 'bar' };
      }
    `);

    expect(results).toHaveLength(0);
  });

  it('requires validation for each account reference independently', async () => {
    const results = await lintMetadata(`
      import { MetadataPolicy } from 'domain/accounts/metadata-policy';

      export function update(primaryAccount: { metadata?: unknown }, secondaryAccount: { metadata?: unknown }) {
        MetadataPolicy.validate(primaryAccount);
        primaryAccount.metadata = { foo: 'primary' };

        secondaryAccount.metadata = { foo: 'secondary' };
      }
    `);

    expect(results).toHaveLength(1);
    expect(results[0].messageId).toBe('missingValidation');
  });
});
