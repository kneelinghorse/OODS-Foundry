import { describe, expect, it } from 'vitest';

import { handle } from '../../src/tools/code.generate.js';
import {
  collectFixtureComponents,
  FOUNDATION_V1_IDS,
  FOUNDATION_V1_SHOWCASE_SCHEMA,
} from './foundation-fixture.s182.js';
import { verifyGeneratedSource } from '../../../../scripts/product-reality/s182-m04-consumer-harness.mjs';

const stylings = ['inline', 'tokens', 'tailwind'] as const;
const typescriptOptions = [false, true] as const;
const frameworks = ['react', 'vue'] as const;
const matrix = frameworks.flatMap((framework) => (
  stylings.flatMap((styling) => (
    typescriptOptions.map((typescript) => ({ framework, styling, typescript }))
  ))
));

describe('Sprint 182 M04 public codegen matrix', () => {
  it('uses the exact 14-family nondegenerate showcase fixture', () => {
    expect(collectFixtureComponents(FOUNDATION_V1_SHOWCASE_SCHEMA)).toEqual([...FOUNDATION_V1_IDS].sort());

    const stack = [...FOUNDATION_V1_SHOWCASE_SCHEMA.screens];
    const covered = new Set<string>();
    const nodeIds: string[] = [];
    while (stack.length > 0) {
      const node = stack.pop()!;
      nodeIds.push(node.id);
      const props = node.props && typeof node.props === 'object' ? Object.keys(node.props) : [];
      const bindings = node.bindings ? Object.keys(node.bindings) : [];
      const children = node.children ?? [];
      if (props.length > 0 || bindings.length > 0 || children.length > 0) covered.add(node.component);
      stack.push(...children);
    }
    expect([...covered].sort()).toEqual([...FOUNDATION_V1_IDS].sort());
    expect(nodeIds).toHaveLength(18);
    expect(new Set(nodeIds).size).toBe(18);
  });

  it.each(matrix)(
    'compiles and closes dependencies for $framework/$styling/typescript=$typescript',
    async ({ framework, styling, typescript }) => {
      // The Vue verifier performs synchronous compiler work. Yield between
      // matrix rows so Vitest can acknowledge the previous row's task update
      // instead of accumulating more than its 60-second worker RPC timeout.
      await new Promise<void>((resolve) => setImmediate(resolve));

      const result = await handle({
        framework,
        schema: FOUNDATION_V1_SHOWCASE_SCHEMA,
        options: { styling, typescript },
      });

      expect(result.status, JSON.stringify(result.errors ?? [])).toBe('ok');
      expect(result.meta).toMatchObject({ nodeCount: 18, componentCount: 14 });
      expect(result.warnings).toEqual([]);
      // Sprint 183 promotes the Select default into Forge-owned controlled
      // state instead of leaving the old uncontrolled prop beside a no-op.
      expect(result.code).toContain("handlePlanChangeState");
      expect(result.code).toContain("'pro'");
      const proof = verifyGeneratedSource({
        framework,
        styling,
        typescript,
        code: result.code,
        imports: result.imports,
      });
      expect(proof).toMatchObject({
        status: 'passed',
        framework,
        styling,
        typescript,
        compilerErrors: 0,
        canonicalComponents: 14,
        requiredShowcaseMarkers: 14,
        requiredEventBindings: 10,
        tailwindCva: styling === 'tailwind' ? 'activated' : 'not-applicable',
      });
    },
  );
});
