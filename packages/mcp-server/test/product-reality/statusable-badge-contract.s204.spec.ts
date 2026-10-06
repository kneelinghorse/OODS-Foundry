import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { load as parseYaml } from 'js-yaml';
import { describe, expect, it } from 'vitest';

import { preflightTargetContracts } from '../../src/codegen/target-contracts.js';
import type { CodegenFramework } from '../../src/codegen/types.js';
import type { UiSchema } from '../../src/schemas/generated.js';

/**
 * s204-m02 (g): `traits/visual/Statusable.trait.yaml` authored its LIST extension as a `Badge` with
 * `statusField`, `domainField`, `emphasis` and `showIcon`. The canonical `Badge` contract carries no
 * field directive, so the target contracts refuse three of those four props — but no object composes
 * Statusable's list extension today, so the refusal never fired on a real screen. It sat as a LATENT
 * refusal: authored wrong, waiting for the first object to compose it.
 *
 * `lifecycle/Supersedable` already had the answer — `StatusBadge`, whose contract takes all four —
 * and every other context in Statusable itself already authored `StatusBadge`. The list context was
 * the odd one out.
 *
 * The negative control is the important half. A test that only asserts the fixed trait passes would
 * also pass if the preflight stopped checking anything at all; asserting that the ORIGINAL authoring
 * still reds is what proves the check is live and the fix is real.
 */

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const FRAMEWORKS: CodegenFramework[] = ['react', 'vue'];

type ViewExtension = { component: string; props?: Record<string, unknown> };
type Trait = { view_extensions?: Record<string, ViewExtension[]> };

function readTrait(relativePath: string): Trait {
  return parseYaml(readFileSync(path.join(repositoryRoot, relativePath), 'utf8')) as Trait;
}

/** A one-node schema carrying exactly what the trait authors, so the preflight judges the authoring and nothing else. */
function schemaAuthoring(extension: ViewExtension): UiSchema {
  return {
    version: '1.0.0',
    screens: [{
      id: 'screen-1',
      component: 'Stack',
      children: [{ id: 'authored-1', component: extension.component, props: { ...(extension.props ?? {}) } }],
    }],
    objectSchema: {
      status: { type: 'string', required: true, enum: ['active', 'paused'] },
      domain: { type: 'string', required: false },
    },
  } as unknown as UiSchema;
}

const blocking = (schema: UiSchema, framework: CodegenFramework) => {
  const result = preflightTargetContracts(schema, framework);
  return [...result.issues, ...result.bindingSafetyIssues];
};

describe('s204-m02 (g) — Statusable authors a component that accepts what it authors', () => {
  const statusable = readTrait('traits/visual/Statusable.trait.yaml');

  it('no longer authors a Badge on the list context', () => {
    const list = statusable.view_extensions?.list ?? [];
    expect(list.length).toBeGreaterThan(0);
    expect(list.map(entry => entry.component)).not.toContain('Badge');
  });

  /**
   * The one refusal left in this trait, typed rather than hidden.
   *
   * Sweeping the whole trait — rather than only the `list` context the mission named — found that
   * `detail` authors a `Banner` with the SAME three props on the SAME codes: `statusField`,
   * `domainField` and `showIcon` are not in the canonical `Banner` contract. It is the identical
   * defect one block below the one that was fixed.
   *
   * It is not fixed the same way, because it cannot be. `Badge` had a sibling that takes field
   * directives — `StatusBadge` — and swapping to it cost nothing. `Banner` has no such sibling and
   * its contract carries NO field directive of any kind, so there is no authoring of a Banner that
   * expresses "bind this to the object's status field". Closing it means giving the Banner contract
   * field directives, which is a contract change with consumers, and a craft pass does not widen a
   * canonical contract on its way past (the same rule that kept `@oods/component-contracts` out of
   * the generated artifacts in defect (b)).
   *
   * Latent, and measured as latent: no object in the registry composes Statusable, so neither this
   * nor the Badge refusal has ever fired on a real screen. It is carried for the review as a
   * contract-level finding.
   */
  const TYPED_REFUSALS = new Set(['detail/Banner']);

  it.each(FRAMEWORKS)('generates every Statusable view extension with no refusal in %s, beyond the one typed above', (framework) => {
    const offenders: string[] = [];
    for (const [context, extensions] of Object.entries(statusable.view_extensions ?? {})) {
      for (const extension of extensions) {
        const key = `${context}/${extension.component}`;
        const issues = blocking(schemaAuthoring(extension), framework);
        if (issues.length && !TYPED_REFUSALS.has(key)) offenders.push(`${key}: ${issues.map(issue => issue.message).join('; ')}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it.each(FRAMEWORKS)('holds the typed refusal to exactly what was measured in %s, so it cannot quietly grow', (framework) => {
    // A typed exception that is never re-checked becomes a licence. This pins the refusal to the
    // three props it actually is: if Banner starts refusing a fourth, or stops refusing these, the
    // exception above has to be revisited rather than silently covering something new.
    const banner = (statusable.view_extensions?.detail ?? []).find(entry => entry.component === 'Banner');
    expect(banner, 'the typed refusal names a Banner that is no longer authored').toBeDefined();
    const refused = blocking(schemaAuthoring(banner!), framework)
      .map(issue => /Prop "([^"]+)"/.exec(issue.message ?? '')?.[1])
      .filter((name): name is string => Boolean(name))
      .sort();
    expect(refused).toEqual(['domainField', 'showIcon', 'statusField']);
  });

  it.each(FRAMEWORKS)('still refuses the authoring this replaced, so the check is live in %s', (framework) => {
    // The exact props the trait carried before the fix, on the component it carried them on.
    const asAuthoredBefore: ViewExtension = {
      component: 'Badge',
      props: { statusField: 'status', domainField: 'domain', emphasis: 'subtle', showIcon: true },
    };
    const issues = blocking(schemaAuthoring(asAuthoredBefore), framework);
    expect(issues.length).toBeGreaterThan(0);
  });

  it('agrees with lifecycle/Supersedable, which already knew the answer', () => {
    // The fix is not a local preference. Supersedable authors the same intent and reached
    // StatusBadge first; this keeps the two traits from drifting apart again.
    const supersedable = readTrait('traits/lifecycle/Supersedable.trait.yaml');
    const authored = Object.values(supersedable.view_extensions ?? {}).flat()
      .filter(entry => /Badge$/.test(entry.component))
      .map(entry => entry.component);
    expect(authored).not.toContain('Badge');
  });
});
