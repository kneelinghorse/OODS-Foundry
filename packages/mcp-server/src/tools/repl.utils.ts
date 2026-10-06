import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAjv } from '../lib/ajv.js';
import { withinAllowed } from '../lib/security.js';
import { isUnsafeKey } from '../lib/safety.js';
import { patchExampleHint } from './repl.patch-hint.js';

export { patchExampleHint };
import type {
  ReplIssue,
  ReplJsonPatchOperation,
  ReplNodePatch,
  ReplPatch,
  ReplRenderPreview,
  ReplValidationMeta,
  UiElement,
  UiSchema,
} from '../schemas/generated.js';

type NodeRef = { node: UiElement; pointer: string };

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const UI_SCHEMA_PATH = path.join(__dirname, '../schemas/repl.ui.schema.json');
const REPO_ROOT = path.resolve(__dirname, '../../../../');
const STRUCTURED_DATA_DIR = path.join(REPO_ROOT, 'artifacts', 'structured-data');
const COMPONENT_MANIFEST = path.join(STRUCTURED_DATA_DIR, 'manifest.json');

function relativeToRepo(target: string): string {
  const rel = path.relative(REPO_ROOT, target);
  return rel.startsWith('..') || path.isAbsolute(rel) ? target : rel.split(path.sep).join('/');
}

const ajv = getAjv();
const uiSchemaJson = JSON.parse(fs.readFileSync(UI_SCHEMA_PATH, 'utf8'));
type ValidateFn = ((schema: UiSchema) => boolean) & {
  errors?: Array<{ message?: string; instancePath?: string; schemaPath?: string }>;
};
const validateUiSchema = (
  (typeof uiSchemaJson.$id === 'string' && ajv.getSchema(uiSchemaJson.$id)) || ajv.compile(uiSchemaJson)
) as ValidateFn;

type RegistryInfo = {
  names: Set<string>;
  version: string | null;
  warnings: ReplIssue[];
};

let registryCache: RegistryInfo | null = null;

function issue(code: string, message: string, pathValue?: string, hint?: string): ReplIssue {
  const payload: ReplIssue = { code, message };
  if (pathValue) payload.path = pathValue;
  if (hint) payload.hint = hint;
  return payload;
}

function readJson(filePath: string): any {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizePointer(pathValue: string): string {
  return pathValue || '/';
}

function resolveInRepo(target: string): string {
  const trimmed = target.startsWith('OODS-Foundry-mcp/')
    ? target.replace(/^OODS-Foundry-mcp\//, '')
    : target;
  return path.isAbsolute(trimmed) ? trimmed : path.join(REPO_ROOT, trimmed);
}

function collectNodeIndex(tree: UiSchema): { index: Map<string, NodeRef>; duplicateIds: string[] } {
  const index = new Map<string, NodeRef>();
  const duplicateIds: string[] = [];

  function walk(element: UiElement, pointer: string) {
    if (index.has(element.id)) {
      duplicateIds.push(element.id);
    } else {
      index.set(element.id, { node: element, pointer });
    }
    if (Array.isArray(element.children)) {
      element.children.forEach((child, idx) => walk(child, `${pointer}/children/${idx}`));
    }
  }

  if (Array.isArray(tree.screens)) {
    tree.screens.forEach((screen, idx) => walk(screen, `/screens/${idx}`));
  }

  return { index, duplicateIds };
}

function escapePointerSegment(segment: string): string {
  return segment.replace(/~/g, '~0').replace(/\//g, '~1');
}

function decodePointerSegment(segment: string): string {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isJsonPatchOp(entry: unknown): entry is ReplJsonPatchOperation {
  if (!isPlainObject(entry)) return false;
  return typeof entry.op === 'string' && typeof entry.path === 'string';
}

function isNodePatch(entry: unknown): entry is ReplNodePatch {
  if (!isPlainObject(entry)) return false;
  return typeof entry.nodeId === 'string' && typeof entry.path === 'string';
}

function pointerSegments(pointer: string, issues: ReplIssue[]): string[] | null {
  if (!pointer.startsWith('/')) {
    issues.push(issue('OODS-V100', `Invalid JSON pointer: ${pointer}`, pointer));
    return null;
  }
  const segments = pointer
    .split('/')
    .slice(1)
    .map((value) => decodePointerSegment(value));
  for (const segment of segments) {
    if (isUnsafeKey(segment)) {
      issues.push(
        issue(
          'OODS-V101',
          `Unsafe JSON pointer segment '${segment}' is not allowed`,
          pointer,
          'Prototype access segments are blocked for safety.'
        )
      );
      return null;
    }
  }
  return segments;
}

function resolveParent(container: any, segments: string[]): { parent: any; key: string } | null {
  if (!segments.length) return null;
  let cursor: any = container;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const segment = segments[i];
    const next =
      cursor && (typeof cursor === 'object' || typeof cursor === 'function') && Object.prototype.hasOwnProperty.call(cursor, segment)
        ? cursor[segment]
        : undefined;
    if (next === undefined || next === null) {
      return null;
    }
    cursor = next;
  }
  return { parent: cursor, key: segments[segments.length - 1] };
}

function applyJsonPatch(target: UiSchema, operations: ReplJsonPatchOperation[]): { tree: UiSchema; issues: ReplIssue[] } {
  const clone: UiSchema = structuredClone(target);
  const issues: ReplIssue[] = [];

  for (const [index, op] of operations.entries()) {
    if (!op || typeof op.path !== 'string' || typeof op.op !== 'string') {
      issues.push(issue('OODS-V102', 'Patch operation is malformed', `/patch/${index}`, patchExampleHint()));
      continue;
    }
    try {
      const segments = pointerSegments(op.path, issues);
      if (!segments) {
        continue;
      }
      if (!segments.length) {
        issues.push(issue('OODS-V103', 'Root-level patch operations are not supported', op.path));
        continue;
      }
      const resolved = resolveParent(clone as any, segments);
      if (!resolved) {
        issues.push(issue('OODS-V104', `Cannot resolve patch path ${op.path}`, op.path));
        continue;
      }
      const { parent, key } = resolved;

      if (op.op === 'remove') {
        if (Array.isArray(parent)) {
          const idx = Number(key);
          if (Number.isNaN(idx) || idx < 0 || idx >= parent.length) {
            issues.push(issue('OODS-V105', `Invalid array index ${key} for ${op.path}`, op.path));
            continue;
          }
          parent.splice(idx, 1);
        } else if (Object.prototype.hasOwnProperty.call(parent, key)) {
          delete parent[key];
        } else {
          issues.push(issue('OODS-V104', `Nothing to remove at ${op.path}`, op.path));
        }
        continue;
      }

      const value = op.value;
      if (Array.isArray(parent)) {
        const idx = Number(key);
        if (Number.isNaN(idx) || idx < 0 || idx > parent.length) {
          issues.push(issue('OODS-V105', `Invalid array index ${key} for ${op.path}`, op.path));
          continue;
        }
        parent[idx] = value as any;
      } else {
        parent[key] = value as any;
      }
    } catch (err: any) {
      issues.push(issue('OODS-V106', String(err?.message || err), op.path));
    }
  }

  return { tree: clone, issues };
}

function normalizeNodePatch(
  baseTree: UiSchema,
  patch: ReplNodePatch,
  pointerBase: string,
): { operations: ReplJsonPatchOperation[]; issues: ReplIssue[] } {
  const issues: ReplIssue[] = [];
  if (!patch || typeof patch !== 'object') {
    issues.push(issue('OODS-V107', 'Node patch must be an object', pointerBase, patchExampleHint()));
    return { operations: [], issues };
  }
  if (!patch.nodeId || typeof patch.nodeId !== 'string') {
    issues.push(
      issue('OODS-V108', 'nodeId is required for node patches', `${pointerBase}/nodeId`, patchExampleHint())
    );
    return { operations: [], issues };
  }
  if (!patch.path || typeof patch.path !== 'string') {
    issues.push(
      issue('OODS-V104', 'path is required for node patches', `${pointerBase}/path`, patchExampleHint())
    );
    return { operations: [], issues };
  }
  const { index } = collectNodeIndex(baseTree);
  const ref = index.get(patch.nodeId);
  if (!ref) {
    issues.push(issue('OODS-N006', `Node ${patch.nodeId} not found in base tree`));
    return { operations: [], issues };
  }

  const rawPath = patch.path.startsWith('/') ? patch.path.slice(1) : patch.path;
  const segmentsRaw = rawPath
    .split(/[/.]/)
    .filter((segment) => segment.length > 0)
    .map((segment) => segment.trim());

  for (const segment of segmentsRaw) {
    if (isUnsafeKey(segment)) {
      issues.push(issue('OODS-V101', `Unsafe patch path segment '${segment}' is not allowed`, patch.path));
      return { operations: [], issues };
    }
  }

  const segments = segmentsRaw.map((segment) => escapePointerSegment(segment));
  const pointer = `${ref.pointer}/${segments.join('/')}`;
  const op: ReplJsonPatchOperation = {
    op: patch.op ?? 'replace',
    path: pointer,
    value: patch.value,
  };
  return { operations: [op], issues };
}

export function normalizePatch(baseTree: UiSchema | undefined, patch: ReplPatch): { operations: ReplJsonPatchOperation[]; issues: ReplIssue[] } {
  const issues: ReplIssue[] = [];
  if (!patch) {
    issues.push(issue('OODS-V011', 'patch is required when mode=patch', '/patch', patchExampleHint()));
    return { operations: [], issues };
  }

  if (Array.isArray(patch)) {
    if (patch.length === 0) {
      issues.push(issue('OODS-V109', 'Patch payload is empty', '/patch', patchExampleHint()));
      return { operations: [], issues };
    }

    let hasJsonPatch = false;
    let hasNodePatch = false;
    const jsonOps: ReplJsonPatchOperation[] = [];
    const nodeOps: ReplJsonPatchOperation[] = [];

    patch.forEach((entry, index) => {
      const pointerBase = `/patch/${index}`;
      if (!isPlainObject(entry)) {
        issues.push(issue('OODS-V107', 'Patch entry must be an object', pointerBase, patchExampleHint()));
        return;
      }
      if (isJsonPatchOp(entry) && (entry as any).nodeId === undefined) {
        hasJsonPatch = true;
        jsonOps.push(entry);
        return;
      }
      if (isNodePatch(entry)) {
        hasNodePatch = true;
        if (!baseTree) {
          issues.push(issue('OODS-V010', 'baseTree is required when applying node-targeted patches', '/baseTree', patchExampleHint()));
          return;
        }
        const normalized = normalizeNodePatch(baseTree, entry, pointerBase);
        issues.push(...normalized.issues);
        nodeOps.push(...normalized.operations);
        return;
      }
      issues.push(
        issue(
          'OODS-V107',
          'Patch entry must include op/path (JSON Patch) or nodeId/path (node patch)',
          pointerBase,
          patchExampleHint()
        )
      );
    });

    if (hasJsonPatch && hasNodePatch) {
      issues.push(
        issue(
          'OODS-V114',
          'Patch array mixes JSON Patch ops and node patches. Use one format per request.',
          '/patch',
          patchExampleHint()
        )
      );
      return { operations: [], issues };
    }

    if (hasJsonPatch) {
      return { operations: jsonOps, issues };
    }
    if (hasNodePatch) {
      return { operations: nodeOps, issues };
    }
    return { operations: [], issues };
  }

  if (!isPlainObject(patch)) {
    issues.push(issue('OODS-V110', 'patch must be an array or object', '/patch', patchExampleHint()));
    return { operations: [], issues };
  }

  if (isJsonPatchOp(patch) && (patch as any).nodeId === undefined) {
    issues.push(
      issue(
        'OODS-V115',
        'JSON Patch operations must be provided as an array',
        '/patch',
        patchExampleHint()
      )
    );
    return { operations: [], issues };
  }

  if (!baseTree) {
    issues.push(issue('OODS-V010', 'baseTree is required when applying node-targeted patches', '/baseTree', patchExampleHint()));
    return { operations: [], issues };
  }
  if (!isNodePatch(patch)) {
    issues.push(
      issue(
        'OODS-V102',
        'Patch must be a JSON Patch array or a node patch object',
        '/patch',
        patchExampleHint()
      )
    );
    return { operations: [], issues };
  }
  const normalized = normalizeNodePatch(baseTree, patch, '/patch');
  return { operations: normalized.operations, issues: [...issues, ...normalized.issues] };
}

export function applyPatch(baseTree: UiSchema, patch: ReplPatch): { tree: UiSchema; issues: ReplIssue[]; normalized: ReplJsonPatchOperation[] } {
  const normalized = normalizePatch(baseTree, patch);
  const applied = applyJsonPatch(baseTree, normalized.operations);
  return { tree: applied.tree, issues: [...normalized.issues, ...applied.issues], normalized: normalized.operations };
}

export function validateSchema(tree: UiSchema): ReplIssue[] {
  const ok = validateUiSchema(tree);
  if (ok) return [];
  return (validateUiSchema.errors || []).map((err: { message?: string; instancePath?: string; schemaPath?: string }) => {
    const message = err.message || 'Schema validation failed';
    const pathValue = normalizePointer(err.instancePath || err.schemaPath || '/');
    return issue('OODS-V007', message, pathValue);
  });
}

export function validateComponents(tree: UiSchema, registry: RegistryInfo): ReplIssue[] {
  const problems: ReplIssue[] = [];
  const { index, duplicateIds } = collectNodeIndex(tree);

  for (const dup of duplicateIds) {
    problems.push(issue('OODS-V008', `Duplicate id '${dup}' found in UI tree`, '/', 'IDs must be unique for patching and analytics'));
  }

  for (const { node, pointer } of index.values()) {
    if (registry.names.size > 0 && !registry.names.has(node.component)) {
      problems.push(issue('OODS-V006', `Component '${node.component}' is not in the OODS registry`, `${pointer}/component`));
    }
  }
  return problems;
}

export function summarizeMeta(tree: UiSchema, registry: RegistryInfo): ReplValidationMeta {
  const { index, duplicateIds } = collectNodeIndex(tree);
  const missingComponents = new Set<string>();

  for (const { node } of index.values()) {
    if (registry.names.size > 0 && !registry.names.has(node.component)) {
      missingComponents.add(node.component);
    }
  }

  return {
    screenCount: Array.isArray(tree.screens) ? tree.screens.length : 0,
    nodeCount: index.size,
    duplicateIds: duplicateIds.length ? duplicateIds : undefined,
    missingComponents: missingComponents.size ? Array.from(missingComponents) : undefined,
  };
}

export function buildPreviewSummary(screenCount: number, errorCount = 0, dryRun = false): string {
  if (errorCount > 0) {
    return `Render blocked: ${errorCount} validation error${errorCount === 1 ? '' : 's'}`;
  }
  // s211-m01: a dry run said "ready" and returned no HTML, with nothing saying why.
  return `Render ready for ${screenCount} screen${screenCount === 1 ? '' : 's'}${dryRun ? '; dry run, so no HTML: pass apply: true to render it' : ''}`;
}

export function buildPreview(tree: UiSchema): ReplRenderPreview {
  const screens = Array.isArray(tree.screens) ? tree.screens.map((screen) => screen.id) : [];
  const routes = Array.isArray(tree.screens)
    ? tree.screens
      .map((screen) => screen.route)
      .filter((route): route is string => typeof route === 'string' && route.length > 0)
    : [];
  return {
    screens,
    routes,
    activeScreen: screens.length ? screens[0] : null,
    summary: buildPreviewSummary(screens.length),
  };
}

export function loadComponentRegistry(): RegistryInfo {
  if (registryCache) return registryCache;
  const names = new Set<string>();
  const warnings: ReplIssue[] = [];
  let version: string | null = null;

  try {
    const manifest = readJson(COMPONENT_MANIFEST);
    version = typeof manifest?.version === 'string' ? manifest.version : null;
    const artifact = Array.isArray(manifest?.artifacts)
      ? manifest.artifacts.find((entry: any) => entry?.name === 'components')
      : null;
    const targetPath = artifact?.path ? resolveInRepo(String(artifact.path)) : null;
    const resolved =
      targetPath && withinAllowed(REPO_ROOT, targetPath) && withinAllowed(STRUCTURED_DATA_DIR, targetPath) && fs.existsSync(targetPath)
        ? targetPath
        : null;
    if (resolved) {
      const data = readJson(resolved);
      const components = Array.isArray(data?.components) ? data.components : [];
      for (const entry of components) {
        if (entry?.id) names.add(String(entry.id));
      }
    }
  } catch {
    warnings.push(
      issue('OODS-N009', 'Structured-data manifest missing or unreadable', relativeToRepo(COMPONENT_MANIFEST))
    );
  }

  if (names.size === 0) {
    warnings.push(issue('OODS-N010', 'No component registry available for validation'));
  }

  registryCache = { names, version, warnings };
  return registryCache;
}
