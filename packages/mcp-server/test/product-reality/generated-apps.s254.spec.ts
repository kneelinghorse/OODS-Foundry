import { expect, it } from 'vitest';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { typecheckWorkflow } from './workflow-typecheck.js';

// The released apps compile their seeded App as well as the generated component.
// Read-only record fields on a form and list-only props on an inline screen broke that contract.
const cases = [
  ...['Approval', 'Article', 'Grant', 'Task', 'Transaction'].map(object => ({ object, context: 'form' as const })),
  { object: 'Media', context: 'inline' },
  ...(['card', 'detail', 'list', 'timeline', 'workflow'] as const).map(context => ({ object: 'Subscription', context })),
] as const;

for (const framework of ['react', 'vue'] as const) {
  it.each(cases)(framework + ' compiles the shipped $object $context app with its seeded props', async ({ object, context }) => {
    const composed = await compose({ object, context, options: { transient: true } });
    expect(composed.status, JSON.stringify(composed.errors)).toBe('ok');
    const generated = await generate({ schema: composed.schema!, framework,
      options: { styling: 'tokens', typescript: true, ...(context !== 'workflow' && { output: 'application' as const }) } });
    expect(generated.status, JSON.stringify(generated.errors)).toBe('ok');
    const result = typecheckWorkflow(generated.artifact!);
    expect(result.status, result.stdout + result.stderr).toBe(0);
  });
}
