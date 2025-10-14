import { describe, it, expect, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { TraitLoader } from '../../src/registry/trait-loader.js';
import { TraitResolver, TraitResolutionError } from '../../src/registry/resolver.js';
import type { ObjectDefinition } from '../../src/registry/object-definition.js';
import type { ParameterValidator } from '../../src/validation/parameter-validator.js';
import type { ValidationIssue } from '../../src/validation/types.js';
import * as ParserModule from '../../src/parsers/index.js';

const tempDirs: string[] = [];

function createTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function writeTrait(directory: string, name: string, contents: string): void {
  writeFileSync(join(directory, `${name}.trait.yaml`), contents.trim(), 'utf8');
}

afterEach(() => {
  vi.restoreAllMocks();
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('TraitResolver', () => {
  it('resolves trait definitions applying defaults and overrides', async () => {
    const traitDir = createTempDir('trait-resolver-defaults-');

    writeTrait(
      traitDir,
      'Searchable',
      `
trait:
  name: Searchable
  version: 1.0.0
parameters:
  - name: fields
    type: string[]
    required: true
  - name: language
    type: string
    required: false
    default: en
  - name: allowPartial
    type: boolean
    required: false
    default: false
schema:
  query:
    type: string
    required: true
`
    );

    const loader = new TraitLoader({ roots: [traitDir] });
    const resolver = new TraitResolver({ loader, validateParameters: false });

    const definition: ObjectDefinition = {
      object: { name: 'Article' },
      traits: [
        {
          name: 'Searchable',
          alias: 'Search',
          parameters: {
            fields: ['title', 'body'],
            allowPartial: true,
          },
        },
      ],
    };

    const [resolved] = await resolver.resolveObject(definition, {
      objectName: 'Article',
    });

    expect(resolved.reference.alias).toBe('Search');
    expect(resolved.parameters).toEqual({
      fields: ['title', 'body'],
      allowPartial: true,
      language: 'en',
    });
    expect(resolved.definition.metadata?.appliedParameters).toEqual(resolved.parameters);
  });

  it('wraps parameter validation failures with actionable errors', async () => {
    const traitDir = createTempDir('trait-resolver-validation-');

    writeTrait(
      traitDir,
      'Throttled',
      `
trait:
  name: Throttled
  version: 1.0.0
parameters:
  - name: maxRequests
    type: number
    required: true
schema:
  bucket_key:
    type: string
    required: true
`
    );

    const loader = new TraitLoader({ roots: [traitDir] });

    const issue: ValidationIssue = {
      code: 'TE-0203',
      message: 'maxRequests must be a non-negative integer',
      location: {
        file: 'Gateway.object.yaml',
        path: '/traits/0/parameters/maxRequests',
      },
      fixHint: 'Provide a value greater than or equal to 0.',
      severity: 'error',
    };

    const validationResult = {
      valid: false,
      issues: [issue],
      summary: { errors: 1, warnings: 0, info: 0 },
    };

    const failingValidator = {
      validate: () => validationResult,
      validateAsync: async () => validationResult,
      clearCache: () => {},
    } as unknown as ParameterValidator;

    const resolver = new TraitResolver({
      loader,
      validator: failingValidator,
      validateParameters: true,
    });

    const definition: ObjectDefinition = {
      object: { name: 'Gateway' },
      traits: [
        {
          name: 'Throttled',
          parameters: {
            maxRequests: -1,
          },
        },
      ],
    };

    await resolver
      .resolveObject(definition, {
        objectName: 'Gateway',
        objectFilePath: '/objects/Gateway.object.yaml',
      })
      .then(() => {
        throw new Error('Expected parameter validation to fail');
      })
      .catch((error: unknown) => {
        expect(error).toBeInstanceOf(TraitResolutionError);
        expect((error as Error).message).toMatch(/maxRequests must be a non-negative integer/);
      });
  });

  it('augments missing trait errors with object context', async () => {
    const emptyDir = createTempDir('trait-resolver-missing-');

    const loader = new TraitLoader({ roots: [emptyDir] });
    const resolver = new TraitResolver({ loader, validateParameters: false });

    const definition: ObjectDefinition = {
      object: { name: 'Article' },
      traits: [
        {
          name: 'NonexistentTrait',
        },
      ],
    };

    await expect(
      resolver.resolveObject(definition, {
        objectName: 'Article',
        objectFilePath: '/objects/Article.object.yaml',
      })
    ).rejects.toThrow(/object "Article" at \/objects\/Article\.object\.yaml/);
  });

  it('avoids duplicate trait parses when references share the same definition', async () => {
    const traitDir = createTempDir('trait-resolver-cache-');

    writeTrait(
      traitDir,
      'Shareable',
      `
trait:
  name: Shareable
  version: 1.0.0
parameters:
  - name: enabled
    type: boolean
    required: false
    default: false
schema:
  share_url:
    type: string
    required: true
`
    );

    const loader = new TraitLoader({ roots: [traitDir] });
    const resolver = new TraitResolver({ loader, validateParameters: false });

    const parseSpy = vi.spyOn(ParserModule, 'parseTrait');

    const definition: ObjectDefinition = {
      object: { name: 'Content' },
      traits: [
        {
          name: 'Shareable',
          alias: 'PrimaryShare',
          parameters: {
            enabled: true,
          },
        },
        {
          name: 'Shareable',
          alias: 'SecondaryShare',
        },
      ],
    };

    const resolved = await resolver.resolveObject(definition);

    expect(resolved).toHaveLength(2);
    expect(parseSpy).toHaveBeenCalledTimes(1);
    expect(resolved[0].reference.alias).toBe('PrimaryShare');
    expect(resolved[1].reference.alias).toBe('SecondaryShare');

    parseSpy.mockRestore();
  });

  it('skips disabled trait references without attempting to load them', async () => {
    const traitDir = createTempDir('trait-resolver-disabled-');

    writeTrait(
      traitDir,
      'Auditable',
      `
trait:
  name: Auditable
  version: 1.0.0
schema:
  audit_id:
    type: string
    required: true
`
    );

    const loader = new TraitLoader({ roots: [traitDir] });
    const resolver = new TraitResolver({ loader, validateParameters: false });

    const definition: ObjectDefinition = {
      object: { name: 'Ledger' },
      traits: [
        {
          name: 'DeprecatedTrait',
          disabled: true,
        },
        {
          name: 'Auditable',
        },
      ],
    };

    const resolved = await resolver.resolveObject(definition);

    expect(resolved).toHaveLength(1);
    expect(resolved[0].reference.name).toBe('Auditable');
  });
});
