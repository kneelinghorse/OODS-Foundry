import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { getAjv } from '../../lib/ajv.js';
import type { UiSchema } from '../../schemas/generated.js';
import inputSchema from '../../schemas/code.generate.input.json' assert { type: 'json' };
import { isKnownComponentForCodegen, preflightTargetCapabilities } from '../../codegen/target-readiness.js';
import { handle, type CodeGenerateDependencies } from '../code.generate.js';

// A known component can lose target evidence independently of emitted syntax.
// All production roots are governed, so make the unavailable operand explicit.
const unavailableArchiveEvent: CodeGenerateDependencies = {
  targetCapabilityPreflight: (screens, framework) => {
    const visit = (node: UiSchema['screens'][number]): UiSchema['screens'] => [node, ...(node.children ?? []).flatMap(visit)];
    return [...preflightTargetCapabilities(screens, framework), ...screens.flatMap(visit)
      .filter(node => node.component === 'ArchiveEvent').map(node => ({
        code: 'OODS-N015', nodeId: node.id, component: node.component,
        message: `Component ArchiveEvent is not emission-eligible for ${framework}; evidence state: unavailable.`,
      }))];
  },
};

const ajv = getAjv();
const validateInput = ajv.compile(inputSchema);
const vueCompiler = createRequire(
  new URL('../../../../components-vue/package.json', import.meta.url),
)('@vue/compiler-sfc');

const schemaFixture: UiSchema = {
  version: '2026.03',
  screens: [
    {
      id: 'screen-root',
      component: 'Stack',
      layout: { type: 'stack', gapToken: 'stack-compact' },
      children: [
        {
          id: 'primary-button',
          component: 'Button',
          props: {
            label: 'Save',
            intent: 'primary',
            size: 'sm',
          },
        },
        {
          id: 'secondary-button',
          component: 'Button',
          props: {
            label: 'Cancel',
            intent: 'secondary',
            size: 'lg',
          },
        },
      ],
    },
  ],
};

const buildChecks = [
  'schema-structure',
  'component-registry',
  'state-contract',
  'target-readiness',
  'normalization-fidelity',
  'binding-contract',
  'props-contract',
  'slots-contract',
  'events-contract',
  'dependency-closure',
  'fallback-policy',
] as const;

const releaseChecks = [
  'rendered-evidence',
  'interaction-evidence',
  'accessibility-evidence',
  'theme-evidence',
  'determinism-evidence',
  'performance-evidence',
  'certification-evidence',
] as const;

const validationChecks = [...buildChecks, ...releaseChecks] as const;

function expectedDefaultBuildReceipt(
  framework: 'react' | 'vue' | 'html',
  checks: readonly (typeof validationChecks)[number][],
) {
  const completed = new Set<string>(checks);
  return {
    profile: 'build',
    defaulted: true,
    // s213-m02: every receipt states what the gate checked. It never compiles or runs the artifact, so it must not call it runnable.
    rationale: 'Build is the default blocking gate: target, bindings, dependencies and fallbacks must resolve under static checks; the static gate does not install or run the generated application.',
    axes: {
      scope: 'generated-artifact',
      enforcement: 'blocking',
      fallback: 'forbidden',
      target: { requested: framework, resolved: framework, source: 'explicit' },
    },
    checks: [...checks],
    notChecked: validationChecks.filter((check) => !completed.has(check)),
    evidence: {
      required: [],
      provided: [],
      missing: [],
      mismatched: [],
      accepted: [],
      notApplicable: [],
    },
  };
}

function evidenceDigest(result: Awaited<ReturnType<typeof handle>>): string {
  const evidence = {
    status: result.status,
    framework: result.framework,
    fileExtension: result.fileExtension,
    imports: result.imports,
    warnings: result.warnings,
    errors: result.errors,
    meta: result.meta,
  };
  return createHash('sha256').update(JSON.stringify(evidence)).digest('hex');
}

describe('code.generate tool', () => {
  it('falls back to capability-baseline membership when the structured registry is empty', () => {
    const emptyRegistry = new Set<string>();
    expect(isKnownComponentForCodegen('Stack', emptyRegistry)).toBe(true);
    expect(isKnownComponentForCodegen('ArchiveSummary', emptyRegistry)).toBe(true);
    expect(isKnownComponentForCodegen('DefinitelyNotAnOodsComponent', emptyRegistry)).toBe(false);
  });

  it('emits Vue script comments safely when descriptions contain closing script tags', async () => {
    const result = await handle({
      framework: 'vue',
      schema: {
        version: '2026.03',
        objectSchema: {
          first: {
            type: 'string',
            required: true,
            description: 'break </script> after',
          },
          second: {
            type: 'string',
            required: true,
            description: 'mixed </ScRiPt> after',
          },
        },
        // s213-m01 (finding 6): a field no node reads gets no ref and no comment, so both descriptions need a reader.
        screens: [{ id: 'first-input', component: 'Input', props: { field: 'first' } }, { id: 'second-input', component: 'Input', props: { field: 'second' } }],
      },
    });

    expect(result.status).toBe('ok');
    expect(result.code.match(/<\/script/gi)).toHaveLength(1);
    expect(result.code).toContain('\\x3c/script>');
    expect(result.code).toContain('\\x3c/ScRiPt>');

    const parsed = vueCompiler.parse(result.code, { filename: 'DescriptionSafety.vue' });
    expect(parsed.errors).toEqual([]);
    expect(() => vueCompiler.compileScript(parsed.descriptor, {
      id: 's182-description-safety',
    })).not.toThrow();
    const template = vueCompiler.compileTemplate({
      id: 's182-description-safety',
      filename: 'DescriptionSafety.vue',
      source: parsed.descriptor.template!.content,
    });
    expect(template.errors).toEqual([]);
  });

  it('accepts tailwind styling in input schema', () => {
    const valid = validateInput({
      framework: 'react',
      schema: schemaFixture,
      options: {
        styling: 'tailwind',
      },
    });

    expect(valid).toBe(true);
  });

  it('preserves profile omission through input validation so the receipt names the build default', async () => {
    const input = {
      framework: 'react' as const,
      schema: schemaFixture,
    };

    expect(validateInput(input), JSON.stringify(validateInput.errors ?? [])).toBe(true);
    expect(input).not.toHaveProperty('profile');

    const result = await handle(input);
    expect(result.validationReceipt).toMatchObject({
      profile: 'build',
      defaulted: true,
    });
  });

  it('emits Tailwind classes for React and Vue when styling=tailwind', async () => {
    const reactResult = await handle({
      framework: 'react',
      schema: schemaFixture,
      options: {
        styling: 'tailwind',
      },
    });
    const vueResult = await handle({
      framework: 'vue',
      schema: schemaFixture,
      options: {
        styling: 'tailwind',
      },
    });

    expect(reactResult.status).toBe('ok');
    expect(reactResult.code).toContain('className=');
    expect(reactResult.code).not.toContain('style={{');

    expect(vueResult.status).toBe('ok');
    expect(vueResult.code).toContain(':class=');
    expect(vueResult.code).not.toContain('style="display:');
  });

  it('defaults to tokens styling when options are omitted', async () => {
    const result = await handle({
      framework: 'react',
      schema: schemaFixture,
    });

    expect(result.status).toBe('ok');
    expect(result.code).toContain('style={{');
  });

  it('rejects valid-schema keys and identifiers that cannot be emitted safely', async () => {
    const unsafeSchema: UiSchema = {
      version: '2026.03',
      objectSchema: {
        'first-name': { type: 'string', required: true },
        firstName: { type: 'string', required: true },
        first_name: { type: 'string', required: true },
      },
      screens: [{
        id: 'safe-root',
        component: 'Stack',
        props: { 'aria-label': 'Safe label', 'data-test-id': 'safe-root' },
        children: [{
          id: 'unsafe-button',
          component: 'Button',
          props: {
            content: 'Safe content',
            'foo="safe" @click': 'globalThis.pwned=true',
          },
          bindings: {
            onActivate: 'firstName',
            onClick: 'bad-name',
            'onClick bad': 'safeHandler',
          },
        }],
      }],
    };

    const expectedErrors = [
      {
        code: 'OODS-V007',
        message: 'Binding Button.onClick is not in the supported generation vocabulary.',
        nodeId: 'unsafe-button',
        component: 'Button',
      },
      {
        code: 'OODS-V007',
        message: 'Binding Button.onClick bad is not in the supported generation vocabulary.',
        nodeId: 'unsafe-button',
        component: 'Button',
      },
      {
        code: 'OODS-V007',
        message: 'Object schema field "first-name" does not normalize to a safe JavaScript identifier.',
      },
      {
        code: 'OODS-V007',
        message: 'Object schema fields "firstName" and "first_name" normalize to the same JavaScript identifier "firstName".',
      },
      {
        code: 'OODS-V007',
        message: 'Prop key "foo=\\"safe\\" @click" cannot be emitted safely as a framework attribute.',
        nodeId: 'unsafe-button',
        component: 'Button',
      },
      {
        code: 'OODS-V007',
        message: 'Binding handler "firstName" collides with an object schema field identifier.',
        nodeId: 'unsafe-button',
        component: 'Button',
      },
      {
        code: 'OODS-V007',
        message: 'Binding handler "bad-name" is not a safe JavaScript identifier.',
        nodeId: 'unsafe-button',
        component: 'Button',
      },
      {
        code: 'OODS-V007',
        message: 'Binding key "onClick bad" cannot be emitted safely as a framework event.',
        nodeId: 'unsafe-button',
        component: 'Button',
      },
    ];

    for (const framework of ['react', 'vue'] as const) {
      await expect(handle({ framework, schema: unsafeSchema })).resolves.toEqual({
        status: 'error',
        framework,
        code: '',
        fileExtension: '',
        imports: [],
        warnings: [],
        validationReceipt: expectedDefaultBuildReceipt(framework, [
          'schema-structure',
          'component-registry',
          'state-contract',
          'target-readiness',
          'normalization-fidelity',
          'binding-contract',
          'events-contract',
        ]),
        errors: expectedErrors,
        meta: { nodeCount: 2, componentCount: 2 },
      });
    }
  });

  it('preserves identifier, data-*, and aria-* prop keys', async () => {
    const safeSchema: UiSchema = {
      version: '2026.03',
      screens: [{
        id: 'safe-button',
        component: 'Button',
        props: {
          ariaLabel: 'Camel case label',
          'aria-describedby': 'safe-help',
          content: 'Save',
          'data-test-id': 'safe-button',
        },
      }],
    };

    for (const framework of ['react', 'vue'] as const) {
      const result = await handle({ framework, schema: safeSchema });
      expect(result.status).toBe('ok');
      expect(result.code).toContain('aria-describedby="safe-help"');
      expect(result.code).toContain('data-test-id="safe-button"');
    }
  });

  it('rejects generated-name collisions for each target', async () => {
    const reactSchema: UiSchema = {
      version: '2026.03',
      objectSchema: {
        Button: { type: 'string', required: true },
        React: { type: 'string', required: true },
        arguments: { type: 'string', required: true },
      },
      screens: [{ id: 'button', component: 'Button', props: { content: 'Save' } }],
    };
    const reactResult = await handle({ framework: 'react', schema: reactSchema });
    expect(reactResult.status).toBe('error');
    expect(reactResult.code).toBe('');
    expect(reactResult.errors).toEqual([
      {
        code: 'OODS-V007',
        message: 'Object schema field "Button" collides with generated identifier "Button" for react.',
      },
      {
        code: 'OODS-V007',
        message: 'Object schema field "React" collides with generated identifier "React" for react.',
      },
      {
        code: 'OODS-V007',
        message: 'Object schema field "arguments" does not normalize to a safe JavaScript identifier.',
      },
    ]);

    const vueSchema: UiSchema = {
      version: '2026.03',
      objectSchema: {
        Button: { type: 'string', required: true },
        address: { type: 'string', required: true },
        arguments: { type: 'string', required: true },
        buttonVariants: { type: 'string', required: true },
        city: { type: 'string', required: true },
        computed: { type: 'string', required: true },
        cva: { type: 'string', required: true },
        firstName: { type: 'string', required: true },
        fullAddress: { type: 'string', required: true },
        fullName: { type: 'string', required: true },
        lastName: { type: 'string', required: true },
        ref: { type: 'string', required: true },
      },
      screens: [{
        id: 'root',
        component: 'Stack',
        children: [
          { id: 'name-input', component: 'Input', props: { field: 'firstName' } },
          { id: 'primary', component: 'Button', props: { content: 'Save', intent: 'primary' } },
          { id: 'secondary', component: 'Button', props: { content: 'Cancel', intent: 'secondary' } },
        ],
      }],
    };
    const vueResult = await handle({
      framework: 'vue',
      schema: vueSchema,
      options: { styling: 'tailwind' },
    });
    expect(vueResult.status).toBe('error');
    expect(vueResult.code).toBe('');
    expect(vueResult.errors).toEqual([
      {
        code: 'OODS-V007',
        message: 'Object schema field "Button" collides with generated identifier "Button" for vue.',
      },
      {
        code: 'OODS-V007',
        message: 'Object schema field "arguments" does not normalize to a safe JavaScript identifier.',
      },
      {
        code: 'OODS-V007',
        message: 'Object schema field "buttonVariants" collides with generated identifier "buttonVariants" for vue.',
      },
      {
        code: 'OODS-V007',
        message: 'Object schema field "computed" collides with generated identifier "computed" for vue.',
      },
      {
        code: 'OODS-V007',
        message: 'Object schema field "cva" collides with generated identifier "cva" for vue.',
      },
      {
        code: 'OODS-V007',
        message: 'Object schema field "fullAddress" collides with generated identifier "fullAddress" for vue.',
      },
      {
        code: 'OODS-V007',
        message: 'Object schema field "fullName" collides with generated identifier "fullName" for vue.',
      },
      {
        code: 'OODS-V007',
        message: 'Object schema field "ref" collides with generated identifier "ref" for vue.',
      },
    ]);
  });

  it('rejects emitter-owned and duplicate attributes before emission', async () => {
    const duplicateSchema: UiSchema = {
      version: '2026.03',
      screens: [{
        id: 'root',
        component: 'Stack',
        layout: { type: 'stack' },
        props: {
          'data-layout': 'inline',
          'data-oods-component': 'Injected',
          'data-x.y': 'unsafe',
          onEdit: 'not-a-handler',
        },
        bindings: { onEdit: 'handleEdit' },
      }],
    };

    const react = await handle({ framework: 'react', schema: duplicateSchema });
    expect(react.status).toBe('error');
    expect(react.code).toBe('');
    expect(react.errors).toEqual([
      {
        code: 'OODS-V007',
        message: 'Prop key "data-layout" collides with an emitter-owned attribute.',
        nodeId: 'root',
        component: 'Stack',
      },
      {
        code: 'OODS-V007',
        message: 'Prop key "data-oods-component" collides with an emitter-owned attribute.',
        nodeId: 'root',
        component: 'Stack',
      },
      {
        code: 'OODS-V007',
        message: 'Prop key "data-x.y" cannot be emitted safely as a framework attribute.',
        nodeId: 'root',
        component: 'Stack',
      },
      {
        code: 'OODS-V007',
        message: 'Prop key "onEdit" duplicates a binding attribute for react.',
        nodeId: 'root',
        component: 'Stack',
      },
    ]);

    const vue = await handle({ framework: 'vue', schema: duplicateSchema });
    expect(vue.status).toBe('error');
    expect(vue.code).toBe('');
    expect(vue.errors).toEqual(react.errors?.slice(0, 3));
  });

  it('rejects handlers that shadow imported components', async () => {
    const handlerSchema: UiSchema = {
      version: '2026.03',
      screens: [{
        id: 'button',
        component: 'Button',
        props: { content: 'Save' },
        bindings: { onActivate: 'Button' },
      }],
    };

    for (const framework of ['react', 'vue'] as const) {
      const result = await handle({ framework, schema: handlerSchema });
      expect(result.status).toBe('error');
      expect(result.code).toBe('');
      expect(result.errors).toEqual([{
        code: 'OODS-V007',
        message: `Binding handler "Button" collides with a generated identifier for ${framework}.`,
        nodeId: 'button',
        component: 'Button',
      }]);
    }
  });

  it('retains the original ArchiveSummary operands after its Sprint-187 port', async () => {
    const unsafe = await handle({ framework: 'react', schema: { version: '2026.03', screens: [{
      id: 'unready', component: 'ArchiveSummary', props: { 'data-x.y': 'would fail syntax preflight' },
    }] } });
    expect(unsafe.status).toBe('error');
    expect(unsafe.errors?.map((error) => error.code)).toEqual(['OODS-V007']);
    expect(unsafe.errors?.[0]?.component).toBe('ArchiveSummary');
    const original = await handle({ framework: 'react', schema: { version: '2026.03', screens: [{
      id: 'readiness-root', component: 'Stack', children: [
        { id: 'archive-summary', component: 'ArchiveSummary' }, { id: 'tag-input', component: 'TagInput' },
      ],
    }] } });
    expect(original.status).toBe('ok');
    expect(original.errors).toBeUndefined();
    expect(original.meta).toMatchObject({ nodeCount: 3, componentCount: 3 });
    for (const id of ['readiness-root', 'archive-summary', 'tag-input']) expect(original.code).toContain(`id="${id}"`);
    expect(original.validationReceipt.checks).toContain('dependency-closure');
  });

  it('checks known target readiness before emitted-syntax safety', async () => {
    const result = await handle({
      framework: 'react',
      schema: {
        version: '2026.03',
        screens: [{
          id: 'unready',
          component: 'ArchiveEvent',
          props: { 'data-x.y': 'would fail syntax preflight' },
        }],
      },
    }, unavailableArchiveEvent);

    expect(result).toEqual({
      status: 'error',
      framework: 'react',
      code: '',
      fileExtension: '',
      imports: [],
      warnings: [],
      validationReceipt: expectedDefaultBuildReceipt('react', [
        'schema-structure',
        'component-registry',
        'state-contract',
        'target-readiness',
      ]),
      errors: [{
        code: 'OODS-N015',
        message: 'Component ArchiveEvent is not emission-eligible for react; evidence state: unavailable.',
        nodeId: 'unready',
        component: 'ArchiveEvent',
      }],
      meta: { nodeCount: 1, componentCount: 1 },
    });
  });

  it('B-11 returns exact OODS-N015 only for the unready component while retaining the now-ready TagInput input', async () => {
    const result = await handle({
      framework: 'react',
      schema: {
        version: '2026.03',
        screens: [
          {
            id: 'readiness-root',
            component: 'Stack',
            children: [
              { id: 'archive-event', component: 'ArchiveEvent' },
              { id: 'tag-input', component: 'TagInput' },
            ],
          },
        ],
      },
    }, unavailableArchiveEvent);

    expect(result).toEqual({
      status: 'error',
      framework: 'react',
      code: '',
      fileExtension: '',
      imports: [],
      warnings: [],
      validationReceipt: expectedDefaultBuildReceipt('react', [
        'schema-structure',
        'component-registry',
        'state-contract',
        'target-readiness',
      ]),
      errors: [
        {
          code: 'OODS-N015',
          message: 'Component ArchiveEvent is not emission-eligible for react; evidence state: unavailable.',
          nodeId: 'archive-event',
          component: 'ArchiveEvent',
        },
      ],
      meta: {
        nodeCount: 3,
        componentCount: 3,
      },
    });
    expect(result.meta).not.toHaveProperty('unknownComponents');
  });

  it('B-14 emits byte-identical governed source and evidence on repeated runs', async () => {
    for (const framework of ['react', 'vue'] as const) {
      const first = await handle({ framework, schema: schemaFixture });
      const second = await handle({ framework, schema: schemaFixture });

      expect(first.status).toBe('ok');
      expect(second.status).toBe('ok');
      expect(Buffer.from(first.code)).toEqual(Buffer.from(second.code));
      expect(evidenceDigest(first)).toBe(evidenceDigest(second));
    }
  });
});
