/**
 * Shared utilities for map.create, map.list, and map.resolve tools.
 * Handles mapping file I/O, trait validation, and ID generation.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { ToolError } from "../errors/tool-error.js";
import { listTraits } from "../objects/trait-loader.js";
import type { ComponentSubstitution } from "./component-substitution.js";
import { fileURLToPath } from "node:url";
import type {
  Stage1CapabilityEntity,
  Stage1DisambiguationDecision,
  Stage1PreferredTermEntity,
  Stage1ProjectionVariant,
} from "./types.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../../../");

export const MAPPINGS_PATH_ENV = "MCP_MAPPINGS_PATH";

export type CoercionEnum = {
  type: "enum";
  mapping: Record<string, string>;
};

export type CoercionBooleanToString = {
  type: "boolean_to_string";
  trueValue: string;
  falseValue: string;
};

export type CoercionTemplate = {
  type: "template";
  pattern: string;
};

export type CoercionIdentity = {
  type: "identity";
};

export type CoercionDef =
  | CoercionEnum
  | CoercionBooleanToString
  | CoercionTemplate
  | CoercionIdentity;

/** @deprecated Use CoercionDef instead */
export type CoercionHint = CoercionDef;

/**
 * Stage1 v1.6.0 emits propMappings[].coercion as a raw string label
 * ("enum-map", "type-cast", "identity") rather than a structured CoercionDef.
 * Persisted as-is for round-trip fidelity; resolution exposes the original
 * label as coercionType without applying it to values. Executable team
 * substitutions use ComponentSubstitution, in the opposite direction.
 */
export type CoercionString = string;

export type PropMapping = {
  externalProp: string;
  oodsProp: string;
  coercion?: CoercionDef | CoercionString | null;
};

export type MappingMetadata = {
  createdAt?: string;
  updatedAt?: string;
  author?: string;
  notes?: string;
};

export type ComponentMapping = {
  id: string;
  externalSystem: string;
  externalComponent: string;
  oodsTraits: string[];
  substitution?: ComponentSubstitution;
  propMappings?: PropMapping[];
  confidence: "auto" | "manual";
  metadata?: MappingMetadata;
  projection_variants?: Stage1ProjectionVariant[];
};

export type MappingsDoc = {
  $schema?: string;
  generatedAt: string;
  version: string;
  stats: { mappingCount: number; systemCount: number };
  mappings: ComponentMapping[];
  /** Draft v1.4.0-gated registry-level review-decision events. Additive; absent on pre-v1.4.0 docs. */
  disambiguation_decisions?: Stage1DisambiguationDecision[];
  /** Draft v1.4.0-gated canonical-term entities. Additive; absent on pre-v1.4.0 docs. */
  preferred_terms?: Stage1PreferredTermEntity[];
  /** Draft v1.4.0-gated first-class capability entities. Additive; absent on pre-v1.4.0 docs. */
  capabilities?: Stage1CapabilityEntity[];
};

export function getMappingsPath(): string {
  const override = process.env[MAPPINGS_PATH_ENV]?.trim();
  if (!override) return path.join(path.resolve(process.env.OODS_MAPPINGS_DIR?.trim() || path.join(os.homedir(), ".oods-foundry", "mappings")), "component-mappings.json");
  return path.isAbsolute(override) ? override : path.resolve(REPO_ROOT, override);
}

export function loadMappings(): MappingsDoc {
  const mappingsPath = mappingsTarget();
  if (!fs.existsSync(mappingsPath)) {
    const now = new Date().toISOString();
    return {
      $schema:
        "https://designlab.local/schemas/component-mapping.schema.json",
      generatedAt: now,
      version: now.slice(0, 10),
      stats: { mappingCount: 0, systemCount: 0 },
      mappings: [],
    };
  }
  return JSON.parse(fs.readFileSync(mappingsPath, "utf8")) as MappingsDoc;
}

/** Replace the target atomically, preserving a team's shared-store symlink. */
function mappingsTarget(): string {
  const mappingsPath = getMappingsPath();
  if (!fs.lstatSync(mappingsPath, { throwIfNoEntry: false })?.isSymbolicLink()) return mappingsPath;
  try { return fs.realpathSync(mappingsPath); }
  catch (error) {
    throw new ToolError('OODS-V219', `Cannot resolve symlinked mappings file '${mappingsPath}': ${error instanceof Error ? error.message : String(error)}`, { path: mappingsPath });
  }
}

export function saveMappings(doc: MappingsDoc): void {
  const mappingsPath = mappingsTarget();
  const now = new Date().toISOString();
  doc.generatedAt = now;
  doc.version = now.slice(0, 10);
  doc.stats.mappingCount = doc.mappings.length;
  doc.stats.systemCount = new Set(
    doc.mappings.map((m) => m.externalSystem),
  ).size;
  fs.mkdirSync(path.dirname(mappingsPath), { recursive: true });
  const pending = `${mappingsPath}.${crypto.randomUUID()}.partial`;
  try {
    fs.writeFileSync(pending, JSON.stringify(doc, null, 2) + "\n", { encoding: "utf8", flag: "wx" });
    fs.renameSync(pending, mappingsPath);
  } finally {
    fs.rmSync(pending, { force: true });
  }
}

function stableSort(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableSort);
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const ordered: Record<string, unknown> = Object.create(null);
    for (const [key, val] of entries) {
      ordered[key] = stableSort(val);
    }
    return ordered;
  }
  return value;
}

export function computeMappingsEtag(doc: MappingsDoc): string {
  const base = Object.assign(
    Object.create(null),
    doc as Record<string, unknown>,
  );
  delete base.generatedAt;
  const canonical = JSON.stringify(stableSort(base));
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

export function slugify(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export function generateMappingId(
  externalSystem: string,
  externalComponent: string,
): string {
  return `${slugify(externalSystem)}-${slugify(externalComponent)}`;
}

export function loadKnownTraits(): Set<string> {
  return new Set(listTraits());
}
