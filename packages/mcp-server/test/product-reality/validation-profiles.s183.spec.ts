import { passedEvidence } from '../helpers/release-evidence.js';
import { NUCLEUS_COMPONENT_IDS } from '@oods/component-contracts';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  RELEASE_EVIDENCE_CLASSES,
  createValidationReceipt,
  enforceValidationProfile,
} from '../../src/codegen/validation-profile.js';
import type {
  CodegenFramework,
  CodegenIssue,
  CodegenReleaseEvidence,
  CodegenValidationCheck,
  CodegenValidationProfile,
  CodegenValidationReceipt,
} from '../../src/codegen/types.js';
import type { UiSchema } from '../../src/schemas/generated.js';
import { getAjv } from '../../src/lib/ajv.js';
import codeGenerateInputSchema from '../../src/schemas/code.generate.input.json' assert { type: 'json' };
import pipelineInputSchema from '../../src/schemas/pipeline.input.json' assert { type: 'json' };
import { preflightTargetCapabilities } from '../../src/codegen/target-readiness.js';
import { componentRenderers } from '../../src/render/component-map.js';
import { handle as generateCode } from '../../src/tools/code.generate.js';
import { handle as runPipeline } from '../../src/tools/pipeline.js';
import type { CodeGenerateInput } from '../../src/tools/types.js';

const BUILD_CHECKS = [
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
] as const satisfies readonly CodegenValidationCheck[];

const RELEASE_CHECKS = [
  'rendered-evidence',
  'interaction-evidence',
  'accessibility-evidence',
  'theme-evidence',
  'determinism-evidence',
  'performance-evidence',
  'certification-evidence',
] as const satisfies readonly CodegenValidationCheck[];

// This carrier is the policy oracle. Do not derive the expected semantics from
// the implementation under test or a mutant can weaken both at once.
const EXPECTED_PROFILE_AXES = {
  draft: {
    scope: 'structural',
    enforcement: 'advisory',
    fallback: 'visible',
  },
  build: {
    scope: 'generated-artifact',
    enforcement: 'blocking',
    fallback: 'forbidden',
  },
  release: {
    scope: 'release-evidence',
    enforcement: 'blocking',
    fallback: 'forbidden',
  },
} as const;

const SUPPORTED_SCHEMA: UiSchema = {
  version: '1.0',
  screens: [{
    id: 'message',
    component: 'Text',
    props: { content: 'Validation profile proof' },
  }],
};

// All 109 rows are now governed. Keep the profile-policy fault explicit instead
// of moving a sentinel to another real component and depending on missing work.
// Physical export/ref deletion gates are covered by readiness-ref-enforcement.
const TARGET_GAP_COMPONENT = 'CommunicationDetailPanel';
const TARGET_GAP_SCHEMA: UiSchema = {
  version: '1.0',
  screens: [{
    id: 'target-gap',
    component: TARGET_GAP_COMPONENT,
    props: {},
  }],
};

const targetGapDependencies = {
  targetCapabilityPreflight: (screens: readonly UiSchema['screens'][number][], framework: 'react' | 'vue') => [
    ...preflightTargetCapabilities(screens, framework),
    ...screens.filter(node => node.id === 'target-gap').map(node => ({
      code: 'OODS-N015' as const,
      message: 'Explicit unavailable-target fault for profile-policy verification.',
      nodeId: node.id,
      component: node.component,
    })),
  ],
};
const generateTargetGap = (input: CodeGenerateInput) => generateCode(input, targetGapDependencies);

const HTML_FALLBACK_SCHEMA: UiSchema = {
  version: '1.0',
  screens: [{
    id: 'html-fallback',
    // Sprint 192 maps every catalog row. This negative control temporarily
    // removes its real renderer, then restores it in a finally block.
    component: 'AuditSummaryCard',
    props: {},
  }],
};

type TargetSource = 'explicit' | 'options-alias' | 'oodsrc' | 'default';

function plannedChecks(profile: CodegenValidationProfile): CodegenValidationCheck[] {
  void profile;
  return [...BUILD_CHECKS, ...RELEASE_CHECKS];
}

function expectDisclosure(
  receipt: CodegenValidationReceipt,
  profile: CodegenValidationProfile,
  target: CodegenFramework,
  options: {
    defaulted?: boolean;
    source?: TargetSource;
    requested?: CodegenFramework;
  } = {},
): void {
  expect(receipt.profile).toBe(profile);
  expect(receipt.defaulted).toBe(options.defaulted ?? false);
  expect(receipt.rationale.trim().length).toBeGreaterThan(0);
  expect(receipt.axes).toMatchObject({
    ...EXPECTED_PROFILE_AXES[profile],
    target: {
      ...(options.requested === undefined ? {} : { requested: options.requested }),
      resolved: target,
      source: options.source ?? 'explicit',
    },
  });

  expect(Array.isArray(receipt.checks)).toBe(true);
  expect(Array.isArray(receipt.notChecked)).toBe(true);
  expect(new Set(receipt.checks).size).toBe(receipt.checks.length);
  expect(new Set(receipt.notChecked).size).toBe(receipt.notChecked.length);
  expect(receipt.checks.filter((check) => receipt.notChecked.includes(check))).toEqual([]);
  expect([...receipt.checks, ...receipt.notChecked].sort()).toEqual(
    plannedChecks(profile).sort(),
  );
  expect(receipt.evidence).toMatchObject({
    required: expect.any(Array),
    provided: expect.any(Array),
    missing: expect.any(Array),
    mismatched: expect.any(Array),
    notApplicable: expect.any(Array),
  });
}

function releaseEvidence(artifactContentHash: string): CodegenReleaseEvidence {
  return Object.fromEntries(RELEASE_EVIDENCE_CLASSES.map((evidenceClass) => [
    evidenceClass,
    passedEvidence(artifactContentHash, evidenceClass),
  ])) as CodegenReleaseEvidence;
}

function acceptedEvidence(artifactContentHash: string) {
  return RELEASE_EVIDENCE_CLASSES.map((evidenceClass) => ({
    class: evidenceClass,
    ...passedEvidence(artifactContentHash, evidenceClass),
  }));
}

describe('Sprint 183 M03 validation profiles', () => {
  it('preserves pipeline profile omission through AJV so build is disclosed as a runtime default', async () => {
    const input = {
      intent: 'simple text card',
      options: { skipValidation: true, skipRender: true },
    };
    const validateInput = getAjv().compile(pipelineInputSchema);

    expect(validateInput(input), JSON.stringify(validateInput.errors ?? [])).toBe(true);
    expect(input).not.toHaveProperty('profile');

    const result = await runPipeline(input);
    expect(result.error, JSON.stringify(result)).toBeUndefined();
    expect(result.validationReceipt).toMatchObject({
      profile: 'build',
      defaulted: true,
    });
  });

  it.each([
    {
      surface: 'code.generate',
      schema: codeGenerateInputSchema,
      baseInput: () => ({ framework: 'react', schema: SUPPORTED_SCHEMA }),
    },
    {
      surface: 'pipeline',
      schema: pipelineInputSchema,
      baseInput: () => ({ intent: 'public validation-profile contract' }),
    },
  ])('$surface public input accepts only the three profiles and validates evidence shape', ({ schema, baseInput }) => {
    const validateInput = getAjv().compile(schema);
    for (const profile of ['draft', 'build', 'release'] as const) {
      const input = { ...baseInput(), profile };
      expect(validateInput(input), JSON.stringify(validateInput.errors ?? [])).toBe(true);
    }

    const unknownProfile = { ...baseInput(), profile: 'production' };
    expect(validateInput(unknownProfile)).toBe(false);
    expect(validateInput.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ keyword: 'enum', instancePath: '/profile' }),
    ]));

    const validHash = `sha256:${'a'.repeat(64)}`;
    for (const malformed of [
      { status: 'failed', artifactContentHash: validHash, reference: 'evidence/rendered.json' },
      { status: 'passed', artifactContentHash: 'sha256:not-a-hash', reference: 'evidence/rendered.json' },
      { status: 'passed', artifactContentHash: validHash, reference: '' },
    ]) {
      const input = {
        ...baseInput(),
        profile: 'release',
        releaseEvidence: { rendered: malformed },
      };
      expect(validateInput(input), JSON.stringify(malformed)).toBe(false);
      expect(validateInput.errors?.some(({ instancePath }: { instancePath?: string }) => (
        instancePath?.startsWith('/releaseEvidence/rendered')
      ))).toBe(true);
    }
  });

  it('defaults to build and discloses every performed or omitted contract check', async () => {
    const result = await generateCode({ framework: 'react', schema: SUPPORTED_SCHEMA });

    expect(result.status, JSON.stringify(result.errors ?? [])).toBe('ok');
    expectDisclosure(result.validationReceipt, 'build', 'react', {
      defaulted: true,
      requested: 'react',
    });
    expect(result.validationReceipt.checks).toEqual(expect.arrayContaining([
      'props-contract',
      'slots-contract',
      'events-contract',
    ]));
    expect(result.validationReceipt.notChecked).toEqual(['fallback-policy', ...RELEASE_CHECKS]);
  });

  it('the governed fixture is only unavailable when the profile test injects its explicit fault', () => {
    expect(NUCLEUS_COMPONENT_IDS).toContain(TARGET_GAP_COMPONENT);
    for (const framework of ['react', 'vue'] as const) {
      expect(preflightTargetCapabilities(TARGET_GAP_SCHEMA.screens, framework)).toEqual([]);
      expect(targetGapDependencies.targetCapabilityPreflight(TARGET_GAP_SCHEMA.screens, framework)).toMatchObject([{ code: 'OODS-N015', component: TARGET_GAP_COMPONENT }]);
    }
  });

  it('lets the same target gap proceed only under draft, with the gap visible', async () => {
    const draft = await generateTargetGap({
      framework: 'react',
      schema: TARGET_GAP_SCHEMA,
      profile: 'draft',
    });
    const build = await generateTargetGap({
      framework: 'react',
      schema: TARGET_GAP_SCHEMA,
      profile: 'build',
    });

    expect(draft.status, JSON.stringify(draft.errors ?? [])).toBe('ok');
    expect(draft.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'OODS-N015', component: TARGET_GAP_COMPONENT }),
    ]));
    expect(draft.code).toContain(TARGET_GAP_COMPONENT);
    expectDisclosure(draft.validationReceipt, 'draft', 'react', { requested: 'react' });

    expect(build.status).toBe('error');
    expect(build.artifact).toBeUndefined();
    expect(build.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'OODS-N015', component: TARGET_GAP_COMPONENT }),
    ]));
    expectDisclosure(build.validationReceipt, 'build', 'react', { requested: 'react' });
  });

  const targetCells = (['build', 'release'] as const).flatMap((profile) => (
    (['react', 'vue'] as const).flatMap((framework) => (
      (['inline', 'tailwind', 'tokens'] as const).flatMap((styling) => (
        ([false, true] as const).map((typescript) => ({
          profile,
          framework,
          styling,
          typescript,
        }))
      ))
    ))
  ));

  it.each(targetCells)(
    '$profile blocks an unresolved $framework import for $styling/typescript=$typescript',
    async ({ profile, framework, styling, typescript }) => {
      const result = await generateTargetGap({
        framework,
        schema: TARGET_GAP_SCHEMA,
        profile,
        options: { styling, typescript },
      });

      expect(result.status).toBe('error');
      expect(result.artifact).toBeUndefined();
      expect(result.code).toBe('');
      expect(result.errors).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'OODS-N015', component: TARGET_GAP_COMPONENT }),
      ]));
      expectDisclosure(result.validationReceipt, profile, framework, { requested: framework });
      expect(result.validationReceipt.axes.fallback).toBe('forbidden');
    },
  );

  it('allows a disclosed HTML renderer fallback in draft but rejects an unmapped renderer before emission in build and release', async () => {
    const renderer = componentRenderers.AuditSummaryCard;
    expect(renderer).toBeTypeOf('function');
    delete componentRenderers.AuditSummaryCard;
    try {
      const draft = await generateCode({
        framework: 'html',
        schema: HTML_FALLBACK_SCHEMA,
        profile: 'draft',
      });

      expect(draft.status, JSON.stringify(draft.errors ?? [])).toBe('ok');
      expect(draft.code).toContain('data-oods-fallback="true"');
      expect(draft.warnings.map(({ message }) => message).join('\n')).toMatch(/fallback/i);
      expectDisclosure(draft.validationReceipt, 'draft', 'html', { requested: 'html' });

      for (const profile of ['build', 'release'] as const) {
        const blocked = await generateCode({
          framework: 'html',
          schema: HTML_FALLBACK_SCHEMA,
          profile,
        });
        expect(blocked.status, profile).toBe('error');
        expect(blocked.artifact, profile).toBeUndefined();
        expect(blocked.errors?.map(({ message }) => message).join('\n'), profile).toMatch(
          /no mapped HTML renderer/i,
        );
        expectDisclosure(blocked.validationReceipt, profile, 'html', { requested: 'html' });
        expect(blocked.validationReceipt.checks, profile).toContain('target-readiness');
        expect(blocked.validationReceipt.notChecked, profile).toContain('fallback-policy');
      }
    } finally {
      componentRenderers.AuditSummaryCard = renderer;
    }
  });

  it('preserves HTML domain bindings as honest controls and still requires release evidence', async () => {
    const schema: UiSchema = { version: '1.0', screens: [{ id: 'bound-save', component: 'Button', props: { content: 'Save changes' }, bindings: { onActivate: 'saveChanges' } }] };
    for (const profile of ['draft', 'build'] as const) {
      const result = await generateCode({ framework: 'html', profile, schema });
      expect(result.status).toBe('ok');
      expect(result.code).toContain('data-oods-action="saveChanges"');
      expect(result.code).toContain('No record was changed.');
      expect(result.artifact.actions.map(action => action.name)).toContain('saveChanges');
      expectDisclosure(result.validationReceipt, profile, 'html', { requested: 'html' });
    }
    const release = await generateCode({ framework: 'html', profile: 'release', schema });
    expect(release.status).toBe('error');
    expect(release.errors.some(error => error.code === 'OODS-V007')).toBe(false);
    expect(release.validationReceipt.evidence.missing.length).toBeGreaterThan(0);
  });

  it.each(['react', 'vue'] as const)(
    '%s build ignores a fallback-marker literal in generated user content',
    async (framework) => {
      const result = await generateCode({
        framework,
        profile: 'build',
        schema: {
          version: '1.0',
          objectSchema: {
            message: {
              type: 'string',
              required: false,
              description: 'Literal data-oods-fallback="true" is ordinary field documentation.',
            },
          },
          screens: [{
            id: 'message',
            component: 'Text',
            props: { content: 'Safe content' },
          }],
        },
      });

      expect(result.status, JSON.stringify(result.errors ?? [])).toBe('ok');
      expect(result.code).toContain('data-oods-fallback="true"');
      expect(result.errors ?? []).not.toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'OODS-N013' }),
      ]));
      expectDisclosure(result.validationReceipt, 'build', framework, { requested: framework });
    },
  );

  it('renders canonical HTML Tabs items instead of an empty shell', async () => {
    const result = await generateCode({
      framework: 'html',
      profile: 'build',
      schema: {
        version: '1.0',
        screens: [{
          id: 'settings-tabs',
          component: 'Tabs',
          props: {
            ariaLabel: 'Settings sections',
            defaultSelectedId: 'security',
            items: [
              { id: 'profile', label: 'Profile', panel: 'Profile settings' },
              { id: 'security', label: 'Security', panel: 'Security settings' },
            ],
          },
        }],
      },
    });

    expect(result.status, JSON.stringify(result.errors ?? [])).toBe('ok');
    expect(result.code).toContain('aria-label="Settings sections"');
    expect(result.code).toContain('role="tablist"');
    expect(result.code).toContain('aria-selected="false" tabindex="-1">Profile</button>');
    expect(result.code).toContain('aria-selected="true" tabindex="0">Security</button>');
    expect(result.code).toContain(' hidden>Profile settings</div>');
    expect(result.code).toContain('>Security settings</div>');
    expect(result.code).not.toContain('data-oods-fallback="true"');
    expectDisclosure(result.validationReceipt, 'build', 'html', { requested: 'html' });
  });

  it.each([
    {
      component: 'Text',
      props: { content: 'Canonical text content' },
      // s223-m02 (#2527 ruling 13c): HTML writes Text as the span.oods-text React and Vue write.
      expected: ['class="oods-text" data-oods-component="Text"', '>Canonical text content</span>'],
    },
    {
      component: 'Button',
      props: { content: 'Canonical button content' },
      expected: ['>Canonical button content</button>'],
    },
    {
      component: 'Badge',
      props: { content: 'Canonical badge content' },
      expected: ['>Canonical badge content</span>'],
    },
    {
      component: 'Banner',
      props: {
        title: 'Canonical banner title',
        detail: 'Canonical banner detail',
        content: 'Canonical banner content',
      },
      expected: [
        '>Canonical banner title</strong>',
        '>Canonical banner detail</p>',
        // s222-m02 (#2502 ruling 11): React's Banner markup, the content its own paragraph inside the banner.
        '<p class="oods-banner__body">Canonical banner content</p></div></section>',
      ],
    },
    {
      component: 'Card',
      props: { children: 'Canonical card content' },
      expected: ['>Canonical card content</article>'],
    },
  ] as const)(
    'renders canonical $component content into HTML instead of dropping it into metadata',
    async ({ component, props, expected }) => {
      const result = await generateCode({
        framework: 'html',
        profile: 'build',
        schema: {
          version: '1.0',
          screens: [{ id: `canonical-${component.toLowerCase()}`, component, props }],
        },
      });

      expect(result.status, JSON.stringify(result.errors ?? [])).toBe('ok');
      for (const snippet of expected) expect(result.code).toContain(snippet);
      expect(result.code).not.toMatch(/data-prop-(?:content|children)=/);
      expectDisclosure(result.validationReceipt, 'build', 'html', { requested: 'html' });
    },
  );

  it.each((['react', 'vue', 'html'] as const).flatMap((framework) => (
    (['build', 'release'] as const).flatMap((profile) => [
    {
      framework,
      profile,
      shape: 'nested child content',
      schema: {
        version: '1.0',
        screens: [{
          id: 'nested-tabs',
          component: 'Tabs',
          props: { ariaLabel: 'Nested tabs' },
          children: [{
            id: 'account-panel',
            component: 'Text',
            props: { content: 'Account' },
            children: [{
              id: 'nested-copy',
              component: 'Text',
              props: { content: 'Content that must not disappear' },
            }],
          }],
        }],
      } satisfies UiSchema,
      message: /Nested content.*cannot be preserved/i,
      nodeId: 'account-panel',
    },
    {
      framework,
      profile,
      shape: 'items plus children',
      schema: {
        version: '1.0',
        screens: [{
          id: 'mixed-tabs',
          component: 'Tabs',
          props: {
            ariaLabel: 'Mixed tabs',
            items: [{ id: 'declared', label: 'Declared', panel: 'Declared panel' }],
          },
          children: [{
            id: 'discarded-panel',
            component: 'Text',
            props: { content: 'This child must not disappear' },
          }],
        }],
      } satisfies UiSchema,
      message: /cannot combine explicit items with children.*discard the child tree/i,
      nodeId: 'mixed-tabs',
    },
    ])
  )))(
    '$profile preserves panel trees or refuses ambiguous Tabs $shape for $framework',
    async ({ framework, profile, schema, shape, message, nodeId }) => {
      const result = await generateCode({ framework, profile, schema });
      if (shape === 'nested child content') {
        if (profile === 'build') {
          expect(result.status, JSON.stringify(result.errors)).toBe('ok');
          expect(result.code).toContain('Content that must not disappear');
        } else {
          expect(result.errors).toEqual([expect.objectContaining({ code: 'OODS-V162' })]);
        }
        expect(result.warnings).toEqual([]);
        expect(result.validationReceipt.checks).toContain('slots-contract');
        return;
      }

      expect(result.status).toBe('error');
      expect(result.artifact).toBeUndefined();
      expect(result.code).toBe('');
      expect(result.errors).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'OODS-V007', nodeId, message: expect.stringMatching(message) }),
      ]));
      expect(result.validationReceipt.checks).toEqual([
        'schema-structure',
        'component-registry',
        'state-contract',
        'target-readiness',
        'normalization-fidelity',
      ]);
      expect(result.validationReceipt.notChecked).toEqual([
        'binding-contract',
        'props-contract',
        'slots-contract',
        'events-contract',
        'dependency-closure',
        'fallback-policy',
        ...RELEASE_CHECKS,
      ]);
      expectDisclosure(result.validationReceipt, profile, framework, { requested: framework });
    },
  );

  it(
    'draft HTML preserves nested tab content without a false loss warning',
    async () => {
      const framework = 'html' as const;
      const result = await generateCode({
        framework,
        profile: 'draft',
        schema: {
          version: '1.0',
          screens: [{
            id: 'nested-tabs-draft',
            component: 'Tabs',
            props: { ariaLabel: 'Draft tabs' },
            children: [{
              id: 'draft-panel',
              component: 'Text',
              props: { content: 'Draft panel' },
              children: [{
                id: 'draft-nested-copy',
                component: 'Text',
                props: { content: 'Visible normalization gap' },
              }],
            }],
          }],
        },
      });

      expect(result.status, JSON.stringify(result.errors ?? [])).toBe('ok');
      expect(result.artifact).toBeDefined();
      expect(result.warnings).toEqual([]);
      expect(result.code).toContain('Visible normalization gap');
      expect(result.validationReceipt.checks).toContain('normalization-fidelity');
      expectDisclosure(result.validationReceipt, 'draft', framework, { requested: framework });
    },
  );

  it.each(['react', 'vue'] as const)(
    '$framework build preserves nested and binding-bearing Tabs panel trees',
    async (framework) => {
      const result = await generateCode({
        framework,
        profile: 'build',
        schema: {
          version: '1.0',
          screens: [{
            id: 'unsafe-tabs',
            component: 'Tabs',
            props: { ariaLabel: 'Unsafe tabs' },
            children: [{
              id: 'save-panel',
              component: 'Button',
              props: { content: 'Save' },
              bindings: { onActivate: 'saveChanges' },
            }],
          }],
        },
      });

      expect(result.status, JSON.stringify(result.errors ?? [])).toBe('ok');
      expect(result.artifact).toBeDefined();
      expect(result.code).toContain('save-panel');
      expect(result.code).toContain('saveChanges');
      if (framework === 'react') {
        expect(result.code).toMatch(/panel: \(\s*<Button/);
      } else {
        expect(result.code).toContain('<template #panel="{ item }">');
        expect(result.code).toContain("item.id === 'save-panel'");
      }
      expect(result.validationReceipt.checks).toEqual(BUILD_CHECKS.filter(check => check !== 'fallback-policy' || result.framework === 'html'));
      expect(result.validationReceipt.notChecked).toEqual(['fallback-policy', ...RELEASE_CHECKS]);
      expectDisclosure(result.validationReceipt, 'build', framework, { requested: framework });
    },
  );

  it('preserves an HTML tab action as an integration control', async () => {
    const result = await generateCode({
      framework: 'html',
      profile: 'build',
      schema: {
        version: '1.0',
        screens: [{
          id: 'unsafe-tabs',
          component: 'Tabs',
          props: { ariaLabel: 'Unsafe tabs' },
          children: [{
            id: 'save-panel',
            component: 'Button',
            props: { content: 'Save' },
            bindings: { onActivate: 'saveChanges' },
          }],
        }],
      },
    });

    expect(result.status).toBe('ok');
    expect(result.code).toContain('data-oods-action="saveChanges"');
    expect(result.code).toContain('data-oods-runtime="tabs"');
    expect(result.artifact.actions.map(action => action.name)).toContain('saveChanges');
    expect(result.validationReceipt.checks).toEqual(BUILD_CHECKS.filter(check => check !== 'fallback-policy' || result.framework === 'html'));
  });

  it.each([
    {
      check: 'props-contract',
      distinguishingText: 'definitelyUnsupported',
      schema: {
        version: '1.0',
        screens: [{
          id: 'bad-prop',
          component: 'Button',
          props: { content: 'Save', definitelyUnsupported: true },
        }],
      },
    },
    {
      check: 'slots-contract',
      distinguishingText: 'default',
      schema: {
        version: '1.0',
        screens: [{
          id: 'bad-slot',
          component: 'Input',
          props: { id: 'field', label: 'Field' },
          children: [{ id: 'illegal-child', component: 'Text', props: { content: 'No default slot' } }],
        }],
      },
    },
    {
      check: 'events-contract',
      distinguishingText: 'onDismiss',
      schema: {
        version: '1.0',
        screens: [{
          id: 'bad-event',
          component: 'Button',
          props: { content: 'Save' },
          bindings: { onDismiss: 'dismissButton' },
        }],
      },
    },
  ] as const)(
    'build $check is an executable gate, not an aspirational receipt label',
    async ({ check, distinguishingText, schema }) => {
      const result = await generateCode({
        framework: 'react',
        schema: schema as UiSchema,
        profile: 'build',
      });

      expect(result.status).toBe('error');
      expect(result.artifact).toBeUndefined();
      expect(result.validationReceipt.checks).toContain(check);
      expect(result.errors?.map(({ message }) => message).join('\n')).toContain(distinguishingText);
      expectDisclosure(result.validationReceipt, 'build', 'react', { requested: 'react' });
    },
  );

  const generatedArtifactHashes = {} as Record<CodegenFramework, string>;

  beforeAll(async () => {
    for (const framework of ['react', 'vue', 'html'] as const) {
      const result = await generateCode({
        framework,
        schema: SUPPORTED_SCHEMA,
        profile: 'build',
      });
      if (result.status !== 'ok') {
        throw new Error(
          `${framework} build fixture did not generate: ${JSON.stringify(result.errors ?? [])}`,
        );
      }
      generatedArtifactHashes[framework] = result.artifact.contentHash;
    }
  });

  it.each(RELEASE_EVIDENCE_CLASSES)(
    'release names and blocks the individually missing %s evidence class',
    async (missingClass) => {
      const generatedArtifactHash = generatedArtifactHashes.react;
      const evidence = releaseEvidence(generatedArtifactHash);
      delete evidence[missingClass];
      const result = await generateCode({
        framework: 'react',
        schema: SUPPORTED_SCHEMA,
        profile: 'release',
        releaseEvidence: evidence,
      });

      expect(result.status).toBe('error');
      expect(result.artifact).toBeUndefined();
      expect(result.errors?.map(({ message }) => message).join('\n')).toContain(missingClass);
      expect(result.validationReceipt.evidence.missing).toEqual([missingClass]);
      expect(result.validationReceipt.evidence.artifactContentHash).toBe(generatedArtifactHash);
      expectDisclosure(result.validationReceipt, 'release', 'react', { requested: 'react' });
    },
  );

  it('release blocks evidence bound to a different artifact hash', async () => {
    const generatedArtifactHash = generatedArtifactHashes.react;
    const evidence = releaseEvidence(generatedArtifactHash);
    evidence.performance = {
      ...evidence.performance!,
      artifactContentHash: `sha256:${'0'.repeat(64)}`,
    };
    const result = await generateCode({
      framework: 'react',
      schema: SUPPORTED_SCHEMA,
      profile: 'release',
      releaseEvidence: evidence,
    });

    expect(result.status).toBe('error');
    expect(result.validationReceipt.evidence.missing).toEqual([]);
    expect(result.validationReceipt.evidence.mismatched).toEqual(['performance']);
    expect(result.errors?.map(({ message }) => message).join('\n')).toContain('performance');
    expectDisclosure(result.validationReceipt, 'release', 'react', { requested: 'react' });
  });

  it.each(['react', 'vue', 'html'] as const)(
    '%s release succeeds only with all six hash-bound classes and retains accepted references',
    async (framework) => {
      const generatedArtifactHash = generatedArtifactHashes[framework];
      const result = await generateCode({
        framework,
        schema: SUPPORTED_SCHEMA,
        profile: 'release',
        releaseEvidence: releaseEvidence(generatedArtifactHash),
      });

      expect(result.status, JSON.stringify(result.errors ?? [])).toBe('ok');
      expect(result.artifact.contentHash).toBe(generatedArtifactHash);
      expectDisclosure(result.validationReceipt, 'release', framework, { requested: framework });
      expect(result.validationReceipt.checks).toEqual(plannedChecks('release').filter(check => check !== 'fallback-policy' || framework === 'html'));
      expect(result.validationReceipt.notChecked).toEqual(framework === 'html' ? [] : ['fallback-policy']);
      expect(result.validationReceipt.evidence).toMatchObject({
        required: [...RELEASE_EVIDENCE_CLASSES],
        provided: [...RELEASE_EVIDENCE_CLASSES],
        missing: [],
        mismatched: [],
        artifactContentHash: generatedArtifactHash,
        accepted: acceptedEvidence(generatedArtifactHash),
        notApplicable: [{
          class: 'certification',
          rationale: expect.stringMatching(/no .*certification|not applicable/i),
        }],
      });
    },
  );

  it.each(['draft', 'build', 'release'] as const)(
    'discloses %s and all not-reached checks on an early error response',
    async (profile) => {
      const result = await generateCode({ framework: 'react', profile } as CodeGenerateInput);

      expect(result.status).toBe('error');
      expect(result.artifact).toBeUndefined();
      expectDisclosure(result.validationReceipt, profile, 'react', { requested: 'react' });
      expect(result.validationReceipt.checks).toEqual([]);
      expect(result.validationReceipt.notChecked).toEqual([
        ...BUILD_CHECKS,
        ...RELEASE_CHECKS,
      ]);
    },
  );

  it('its build discriminator rejects a mutant weakened to draft enforcement', () => {
    const issue: CodegenIssue = {
      code: 'OODS-N015',
      message: 'A generated target import is unresolved.',
      nodeId: 'target-gap',
      component: TARGET_GAP_COMPONENT,
    };
    const buildReceipt = createValidationReceipt('build', 'react');
    const weakenedMutant: CodegenValidationReceipt = {
      ...buildReceipt,
      axes: {
        ...buildReceipt.axes,
        enforcement: 'advisory',
        fallback: 'visible',
      },
    };
    const blocksTargetGap = (receipt: CodegenValidationReceipt): boolean => {
      const outcome = enforceValidationProfile(receipt, [issue]);
      return outcome.errors.length === 1 && outcome.warnings.length === 0;
    };

    expect(blocksTargetGap(buildReceipt)).toBe(true);
    expect(blocksTargetGap(weakenedMutant)).toBe(false);
  });

  it.each([
    {
      input: { framework: 'vue' as const },
      expected: { requested: 'vue', resolved: 'vue', source: 'explicit' as const },
    },
    {
      input: { options: { framework: 'vue' as const } },
      expected: { requested: 'vue', resolved: 'vue', source: 'options-alias' as const },
    },
    {
      input: {},
      expected: { resolved: 'react', source: 'default' as const },
    },
  ])('pipeline discloses requested/resolved target provenance from $expected.source', async ({ input, expected }) => {
    const result = await runPipeline({
      intent: 'simple text card',
      profile: 'draft',
      options: { skipValidation: true, skipRender: true, ...input.options },
      ...('framework' in input ? { framework: input.framework } : {}),
    });

    expect(result.error, JSON.stringify(result)).toBeUndefined();
    expect(result.validationReceipt.axes.target).toEqual(expected);
    expectDisclosure(result.validationReceipt, 'draft', expected.resolved, {
      requested: expected.requested,
      source: expected.source,
    });
  });

  it('pipeline forwards release without downgrade and adopts the exact codegen receipt', async () => {
    const build = await runPipeline({
      intent: 'simple text card',
      framework: 'react',
      profile: 'build',
      options: { skipValidation: true, skipRender: true },
    });
    expect(build.error, JSON.stringify(build)).toBeUndefined();
    const artifactHash = build.code!.artifact.contentHash;

    const missing = await runPipeline({
      intent: 'simple text card',
      framework: 'react',
      profile: 'release',
      options: { skipValidation: true, skipRender: true },
    });
    expect(missing.error?.step).toBe('codegen');
    expect(missing.code).toBeUndefined();
    expect(missing.validationReceipt.profile).toBe('release');
    expect(missing.validationReceipt.evidence.missing).toEqual([...RELEASE_EVIDENCE_CLASSES]);

    const released = await runPipeline({
      intent: 'simple text card',
      framework: 'react',
      profile: 'release',
      releaseEvidence: releaseEvidence(artifactHash),
      options: { skipValidation: true, skipRender: true },
    });
    expect(released.error, JSON.stringify(released)).toBeUndefined();
    expect(released.code!.artifact.contentHash).toBe(artifactHash);
    expectDisclosure(released.validationReceipt, 'release', 'react', {
      requested: 'react',
      source: 'explicit',
    });
    expect(released.validationReceipt.evidence.provided).toEqual([...RELEASE_EVIDENCE_CLASSES]);
    expect(released.validationReceipt.evidence).toMatchObject({
      accepted: acceptedEvidence(artifactHash),
    });
  });
});
