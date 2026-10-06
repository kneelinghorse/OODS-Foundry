import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  REPOSITORY_ROOT,
  SCHEMA_NAMES,
  runLiveGenerationOnly,
  runLiveWorkflowProof,
  type S184M06SchemaName,
  type FreshCompositionInput,
} from './s184-m06-live-consumers.js';
import { S185_SCHEMA_NAMES, S186_SCHEMA_NAMES } from './s185-m04-consumer-contract.js';

export const S185_ALL_SCHEMA_NAMES = Object.freeze([...S185_SCHEMA_NAMES, ...SCHEMA_NAMES]);
/** Sprint 186 reuses this harness unchanged; only the selectable corpus and the mission label grow. */
export const S186_ALL_SCHEMA_NAMES = Object.freeze([...S186_SCHEMA_NAMES, ...S185_ALL_SCHEMA_NAMES]);

export async function runS185M04LiveConsumers(
  options: Omit<Parameters<typeof runLiveWorkflowProof>[0], 'mission'> & { mission?: string },
) {
  const { mission = 's185-m04', ...rest } = options;
  return runLiveWorkflowProof({ ...rest, mission, schemaNames: options.schemaNames ?? (options.freshInputs ? undefined : S185_ALL_SCHEMA_NAMES) });
}

async function main() {
  const args = process.argv.slice(2);
  let artifactRoot = path.join(REPOSITORY_ROOT, 'artifacts/product-reality/sprint-185/m04/live-consumers');
  let generationOnly = false;
  let mission = 's185-m04';
  let schemaStore: string | undefined;
  let schemaNames: readonly S184M06SchemaName[] | undefined;
  let freshInputs: FreshCompositionInput[] | undefined;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--generation-only') generationOnly = true;
    else if (args[index] === '--output' && args[index + 1]) artifactRoot = path.resolve(args[++index]!);
    else if (args[index] === '--mission' && args[index + 1]) mission = args[++index]!;
    else if (args[index] === '--store' && args[index + 1]) schemaStore = args[++index]!;
    else if (args[index] === '--fresh' && args[index + 1]) {
      freshInputs = args[++index]!.split(',').map((value) => {
        const parts = value.split('/');
        if (parts.length !== 2) throw new Error('--fresh requires Object/context operands.');
        return { object: parts[0]!, context: parts[1]! as FreshCompositionInput['context'] };
      });
    } else if (args[index] === '--schemas' && args[index + 1]) {
      const selected = args[++index]!.split(',');
      if (!selected.length || selected.some((name) => !S186_ALL_SCHEMA_NAMES.some((available) => available === name))
        || new Set(selected).size !== selected.length) throw new Error('--schemas requires distinct saved schema names from the supported corpus.');
      schemaNames = selected as S184M06SchemaName[];
    } else throw new Error(`Unknown or incomplete argument: ${args[index]}`);
  }
  if (freshInputs && (schemaNames || schemaStore)) throw new Error('--fresh cannot be combined with --schemas or --store.');
  schemaNames = freshInputs ? undefined : schemaNames ?? S185_ALL_SCHEMA_NAMES;
  const result = generationOnly
    ? await runLiveGenerationOnly({ artifactRoot, schemaNames, freshInputs, mission, ...(schemaStore ? { schemaStore } : {}) })
    : await runS185M04LiveConsumers({ artifactRoot, schemaNames, freshInputs, mission, ...(schemaStore ? { schemaStore } : {}) });
  process.stdout.write(`${JSON.stringify(result.report, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
