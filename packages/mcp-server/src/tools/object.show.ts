/**
 * object.show — MCP tool returning full object definition with composed view_extensions.
 */

import { getObjectFilePath, listObjects, loadObject, objectEntry, unknownObjectMessage } from '../objects/object-loader.js';
import type { DefinitionSource } from '../objects/definition-folders.js';
import { composeObject } from '../objects/trait-composer.js';
import type {
  FieldDefinition,
  ObjectRelationship,
  SemanticMapping,
  ViewExtension,
} from '../objects/types.js';
import { ToolError } from '../errors/tool-error.js';

export type ObjectShowInput = {
  name: string;
  context?: string;
};

export type ObjectShowTraitEntry = {
  name: string;
  alias: string | null;
  parameters: Record<string, unknown> | null;
  fieldBindings?: Record<string, string | null>;
};

export type ObjectShowOutput = {
  name: string;
  version: string;
  domain: string;
  description: string;
  tags: string[];
  maturity: string | null;
  traits: ObjectShowTraitEntry[];
  relationships?: ObjectRelationship[];
  schema: Record<string, FieldDefinition>;
  semantics: Record<string, SemanticMapping>;
  viewExtensions: Record<string, ViewExtension[]>;
  tokens: Record<string, unknown>;
  warnings: string[];
  filePath: string;
  /** shipped: Forge's own. user: from the team's folder (s213-m03). */
  source: DefinitionSource;
  replaces?: string;
};

/** Simple Levenshtein distance for closest-match suggestions. */
function levenshtein(a: string, b: string): number {
  const la = a.length;
  const lb = b.length;
  const dp: number[][] = Array.from({ length: la + 1 }, () => Array(lb + 1).fill(0));
  for (let i = 0; i <= la; i++) dp[i][0] = i;
  for (let j = 0; j <= lb; j++) dp[0][j] = j;
  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] !== b[j - 1] ? 1 : 0),
      );
    }
  }
  return dp[la][lb];
}

export function findClosestMatch(name: string, available: string[]): string | null {
  if (available.length === 0) return null;

  const lower = name.toLowerCase();
  let best: string | null = null;
  let bestDist = Infinity;

  for (const candidate of available) {
    const dist = levenshtein(lower, candidate.toLowerCase());
    if (dist < bestDist) {
      bestDist = dist;
      best = candidate;
    }
  }

  // Only suggest if reasonably close (within half the name length)
  if (best && bestDist <= Math.max(3, Math.floor(name.length / 2))) {
    return best;
  }
  return null;
}

export async function handle(input: ObjectShowInput): Promise<ObjectShowOutput> {
  const { name, context } = input;

  // Try to load; on failure, provide closest match
  let objectDef;
  try {
    objectDef = loadObject(name);
  } catch {
    const available = listObjects();
    const suggestion = findClosestMatch(name, available);
    throw new ToolError('OODS-N005', unknownObjectMessage(name, available, suggestion ?? undefined), { name, suggestion, available });
  }

  const composed = composeObject(objectDef);

  // Build traits section
  const traits: ObjectShowTraitEntry[] = composed.traits.map((t) => ({
    name: t.ref.name,
    alias: t.ref.alias ?? null,
    parameters: t.ref.parameters ?? null,
    ...(t.ref.fieldBindings ? { fieldBindings: t.ref.fieldBindings } : {}),
  }));

  // Optionally filter view_extensions to a single context
  let viewExtensions = composed.viewExtensions;
  if (context) {
    const lowerContext = context.toLowerCase();
    const matchedKey = Object.keys(viewExtensions).find(
      (k) => k.toLowerCase() === lowerContext,
    );
    if (matchedKey) {
      viewExtensions = { [matchedKey]: viewExtensions[matchedKey] };
    } else {
      viewExtensions = {};
    }
  }

  return {
    name: composed.object.name,
    version: composed.object.version,
    domain: composed.object.domain,
    description: composed.object.description,
    tags: composed.object.tags ?? [],
    maturity: objectDef.metadata?.maturity ?? null,
    traits,
    ...(objectDef.relationships ? { relationships: objectDef.relationships } : {}),
    schema: composed.schema,
    semantics: composed.semantics,
    viewExtensions,
    tokens: composed.tokens,
    warnings: composed.warnings,
    filePath: getObjectFilePath(name) ?? '',
    source: objectEntry(name)?.source ?? 'shipped',
    ...(objectEntry(name)?.replaces ? { replaces: objectEntry(name)!.replaces } : {}),
  };
}
