import { expect, it } from 'vitest';
import { getAjv } from '../../src/lib/ajv.js';
import { handle as pipeline } from '../../src/tools/pipeline.js';
import schema from '../../src/schemas/pipeline.output.json';

it('the pipeline wire contract preserves a generated artifact with team substitution provenance', async () => {
  const result = await pipeline({ object: 'Subscription', context: 'card', framework: 'react' });
  expect(result.error).toBeUndefined();
  const artifact = result.code!.artifact;
  // Real generation envelope plus the team provenance that the packed journey exposed.
  artifact.substitutions = [{ mappingId: 'team-button', component: 'Button',
    packageContentHash: `sha256:${'a'.repeat(64)}`,
    source: { package: '@forge-test/team-components/react', export: 'TeamButton', version: '1.0.0',
      props: { intent: { name: 'appearance', values: { primary: 'prominent' } } } } }];
  const validate = getAjv().compile(schema);
  expect(validate(result), JSON.stringify(validate.errors)).toBe(true);
  artifact.substitutions[0].source.version = 'latest';
  expect(validate(result), 'A substitution still requires the exact team package version').toBe(false);
});
