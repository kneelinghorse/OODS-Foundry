import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { compile, type JSONSchema } from 'json-schema-to-typescript';

import registryDocument from '~/data/authz-schemas/registry.json';

import { AUTHZ_REGISTRY_VERSION, type AuthzSchemaId } from './schema-registry.js';

const DEFAULT_OUTPUT = 'generated/types/authz.d.ts';

interface AuthzSchemaEntry {
  readonly id: AuthzSchemaId;
  readonly schema: JSONSchema;
}

export interface GenerateAuthzTypesOptions {
  readonly bannerComment?: string;
  readonly outputPath?: string;
}

const INTERFACE_NAME_MAP: Record<AuthzSchemaId, string> = {
  role: 'AuthzRoleDocument',
  permission: 'AuthzPermissionDocument',
  membership: 'AuthzMembershipDocument',
  'role-hierarchy': 'AuthzRoleHierarchyEdge',
};

function getRegistryEntries(): AuthzSchemaEntry[] {
  const schemas = registryDocument.schemas as unknown as Array<{ id: string; schema: JSONSchema }>;
  return schemas.map((definition) => ({
    id: definition.id as AuthzSchemaId,
    schema: structuredClone(definition.schema) as JSONSchema,
  }));
}

function getInterfaceName(schemaId: AuthzSchemaId): string {
  return INTERFACE_NAME_MAP[schemaId];
}

export async function generateAuthzTypeDeclarations(
  options: GenerateAuthzTypesOptions = {}
): Promise<string> {
  const banner =
    options.bannerComment ??
    `/**\n * Authz RBAC types generated from data/authz-schemas/registry.json v${AUTHZ_REGISTRY_VERSION}.\n * Source of truth: R21.2 Part 4.2 canonical model.\n */`;

  const segments: string[] = [banner];

  for (const entry of getRegistryEntries()) {
    const interfaceName = getInterfaceName(entry.id);
    const schemaClone = structuredClone(entry.schema) as JSONSchema;
    if ('$id' in schemaClone) {
      delete (schemaClone as Record<string, unknown>).$id;
    }
    const compiled = await compile(schemaClone, interfaceName, {
      bannerComment: '',
      additionalProperties: false,
      style: {
        singleQuote: true,
        semi: true,
      },
    });
    segments.push(compiled.trim());
  }

  return `${segments.join('\n\n')}\n`;
}

export async function writeAuthzTypeDeclarations(
  options: GenerateAuthzTypesOptions = {}
): Promise<string> {
  const outputPath = options.outputPath ?? DEFAULT_OUTPUT;
  const declarations = await generateAuthzTypeDeclarations(options);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, declarations, 'utf8');
  return outputPath;
}

function isCliExecution(): boolean {
  const entryFile = fileURLToPath(import.meta.url);
  const cliArg = process.argv[1];
  if (!cliArg) {
    return false;
  }
  const resolvedArg = path.resolve(cliArg);
  return entryFile === resolvedArg || pathToFileURL(resolvedArg).href === import.meta.url;
}

async function runCli(): Promise<void> {
  const args = process.argv.slice(2);
  let outPath: string | undefined;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--out' && args[i + 1]) {
      outPath = args[i + 1];
      i += 1;
    }
  }
  const target = outPath ?? DEFAULT_OUTPUT;
  const written = await writeAuthzTypeDeclarations({ outputPath: target });
  // eslint-disable-next-line no-console -- CLI utility
  console.log(`Authz types written to ${written}`);
}

if (isCliExecution()) {
  runCli().catch((error) => {
    // eslint-disable-next-line no-console -- CLI utility
    console.error('Failed to generate Authz types:', error);
    process.exitCode = 1;
  });
}
