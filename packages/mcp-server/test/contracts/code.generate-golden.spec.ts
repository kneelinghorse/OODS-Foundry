import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { handle as codegenHandle } from '../../src/tools/code.generate.js';
import type { UiSchema } from '../../src/schemas/generated.js';
import { createValidationReceipt, recordValidationChecks } from '../../src/codegen/validation-profile.js';
import { validateGeneratedArtifact } from '../../src/codegen/artifact-envelope.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FIXTURE_DIR = path.resolve(__dirname, '../fixtures/ui');
const GOLDEN_DIR = path.resolve(__dirname, '../fixtures/codegen');

const FIXTURES = [
  {
    name: 'dashboard-page',
    schemaFile: 'dashboard-page.ui-schema.json',
    expectedFile: 'dashboard-page.ready.json',
  },
  {
    name: 'form-page',
    schemaFile: 'form-page.ui-schema.json',
    expectedFile: 'form-page.ready.json',
  },
  {
    name: 'detail-page',
    schemaFile: 'detail-page.ui-schema.json',
    expectedFile: 'detail-page.v007.json',
  },
];

const options = { styling: 'tokens', typescript: true } as const;

function loadSchema(fileName: string): UiSchema {
  const schemaPath = path.join(FIXTURE_DIR, fileName);
  return JSON.parse(readFileSync(schemaPath, 'utf8')) as UiSchema;
}

type UnreadyGolden = {
  status?: 'error';
  meta: { nodeCount: number; componentCount: number };
  affectedNodes: Array<{ nodeId: string; component: string; state: string }>;
  portedReadyComponents?: string[];
};

type ReadyGolden = {
  status: 'ok';
  meta: { nodeCount: number; componentCount: number };
  newlyReadyNodes: Array<{ nodeId: string; component: string }>;
  historicalReadinessGolden: string;
};

type PropsErrorGolden = {
  status: 'props-error';
  meta: { nodeCount: number; componentCount: number };
  errors: Array<{ code: string; message: string; nodeId: string; component: string }>;
  historicalReadinessGolden: string;
};

function loadGolden(fileName: string): UnreadyGolden | ReadyGolden | PropsErrorGolden {
  const filePath = path.join(GOLDEN_DIR, fileName);
  return JSON.parse(readFileSync(filePath, 'utf8')) as UnreadyGolden | ReadyGolden | PropsErrorGolden;
}

function expectedTargetReadinessReceipt(framework: 'react' | 'vue') {
  return recordValidationChecks(
    createValidationReceipt(undefined, framework),
    'schema-structure',
    'component-registry',
    'state-contract',
    'target-readiness',
  );
}

describe('code.generate golden readiness outcomes', () => {
  for (const fixture of FIXTURES) {
    for (const framework of ['react', 'vue'] as const) {
      it(`matches the ${framework} golden readiness outcome for ${fixture.name}`, async () => {
        const schema = loadSchema(fixture.schemaFile);
        const expected = loadGolden(fixture.expectedFile);
        const result = await codegenHandle({ schema, framework, options });

        if (expected.status === 'ok') {
          expect(result).toMatchObject({
            status: 'ok', framework, warnings: [], meta: expected.meta,
            fileExtension: framework === 'react' ? '.tsx' : '.vue',
          });
          expect(result.errors).toBeUndefined();
          expect(result.imports).toEqual([
            ...(framework === 'react' ? ['react'] : []),
            `@oods/components-${framework}`, '@oods/component-styles/css',
          ]);
          expect(result.artifact).toBeDefined();
          expect(validateGeneratedArtifact(result.artifact!)).toEqual([]);
          expect(result.artifact!.files).toHaveLength(1);
          expect(result.artifact!.files[0]!.contents).toBe(result.code);
          expect(result.artifact!.actions).toEqual([]);
          expect(result.code.match(/data-oods-component=/g)).toHaveLength(expected.meta.nodeCount);
          const nodes = [...schema.screens];
          while (nodes.length > 0) {
            const node = nodes.shift()!;
            // An explicit native id connects the original FormLabelGroup htmlFor to its input.
            const renderedId = node.props?.id ?? node.id;
            expect(result.code).toContain(`id="${renderedId}" data-oods-component="${node.component}"`);
            nodes.push(...(node.children ?? []));
          }
          const historical = loadGolden(expected.historicalReadinessGolden) as UnreadyGolden;
          expect(historical.affectedNodes.map(({ nodeId, component }) => ({ nodeId, component })))
            .toEqual(expected.newlyReadyNodes);
          // s221-m01: fallback-policy is an HTML check since s216-m05 (#2412); React and Vue receipts list it as not checked.
          expect(result.validationReceipt.checks).toEqual([
            'schema-structure', 'component-registry', 'state-contract', 'target-readiness',
            'normalization-fidelity', 'binding-contract', 'props-contract', 'slots-contract',
            'events-contract', 'dependency-closure',
          ]);
          expect(result.validationReceipt.notChecked).toContain('fallback-policy');
          return;
        }

        if (expected.status === 'props-error') {
          // Ports remove readiness failures without legitimizing unsupported legacy props.
          const historical = loadGolden(expected.historicalReadinessGolden) as UnreadyGolden;
          expect(historical.affectedNodes).toHaveLength(3);
          expect(result).toEqual({
            status: 'error', framework, code: '', fileExtension: '', imports: [], warnings: [],
            meta: expected.meta, errors: expected.errors,
            validationReceipt: recordValidationChecks(expectedTargetReadinessReceipt(framework),
              'normalization-fidelity', 'binding-contract', 'props-contract', 'slots-contract', 'events-contract'),
          });
          expect(result.errors?.some((error) => error.code === 'OODS-N015')).toBe(false);
          return;
        }

        for (const component of expected.portedReadyComponents ?? []) {
          expect(
            result.errors?.some((error) => error.component === component && error.code === 'OODS-N015') ?? false,
            `${component} should no longer contribute an OODS-N015 error`,
          ).toBe(false);
        }

        expect(result).toEqual({
          status: 'error',
          framework,
          code: '',
          fileExtension: '',
          imports: [],
          warnings: [],
          validationReceipt: expectedTargetReadinessReceipt(framework),
          errors: expected.affectedNodes.map(({ nodeId, component, state }) => ({
            code: 'OODS-N015',
            message: `Component ${component} is not emission-eligible for ${framework}; evidence state: ${state}.`,
            nodeId,
            component,
          })),
          meta: expected.meta,
        });
      });
    }
  }
});
