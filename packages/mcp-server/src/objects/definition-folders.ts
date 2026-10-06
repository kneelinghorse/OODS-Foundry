/**
 * The folders object and trait definitions are read from (s213-m03): the ones Forge ships, then a team's own folder,
 * named by an environment variable. The npm launcher defaults them to ~/.oods-foundry/objects and
 * ~/.oods-foundry/traits, outside the unpacked runtime, so a team's definitions survive upgrades; a source checkout
 * sets the same variables.
 *
 * Nothing found here is skipped silently: a file that does not parse, or declares no name, becomes an issue that
 * `object list`, `object validate` and `health` report with the file it came from.
 */

import { load as parseYaml } from 'js-yaml';
import * as fs from 'node:fs';
import * as path from 'node:path';

export type DefinitionSource = 'shipped' | 'user';

export type DefinitionIssueKind =
  | 'malformed'
  | 'unnamed'
  | 'duplicate'
  | 'replaces-shipped'
  | 'shipped-name'
  | 'unknown-trait'
  | 'unreadable-folder';

export interface DefinitionIssue {
  kind: DefinitionIssueKind;
  /** An error keeps the definition out of use; a notice reports something that is in use. */
  severity: 'error' | 'notice';
  file: string;
  name?: string;
  message: string;
}

export interface FoundDefinition {
  name: string;
  file: string;
  /** The file as messages name it: a shipped file relative to the runtime root, a team's file as it is. */
  shown: string;
  source: DefinitionSource;
  header: Record<string, unknown>;
  document: Record<string, unknown>;
}

export const USER_OBJECTS_VARIABLE = 'OODS_OBJECTS_DIR';
export const USER_TRAITS_VARIABLE = 'OODS_TRAITS_DIR';

/** The team's folder named by `variable`, resolved to an absolute path, or null when the variable is not set. */
export function userFolder(variable: typeof USER_OBJECTS_VARIABLE | typeof USER_TRAITS_VARIABLE): string | null {
  const configured = process.env[variable]?.trim();
  return configured ? path.resolve(configured) : null;
}

/** The YAML parser's own sentence for a file that does not parse, which names the line and column. */
export function parseProblem(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split('\n')[0]!.trim();
}

/**
 * Every `*<suffix>` file under `root`, in path order, with its parsed header. A missing root is not an issue (the
 * team's folder does not exist until something is registered); an unreadable one is. Shipped files are named relative
 * to `runtimeRoot`, so a report reads the same on every machine.
 */
export function scanDefinitions(root: string, suffix: string, headerKey: 'object' | 'trait', source: DefinitionSource, issues: DefinitionIssue[], runtimeRoot?: string): FoundDefinition[] {
  const found: FoundDefinition[] = [];
  const kind = headerKey === 'object' ? 'object' : 'trait';
  const show = (file: string) => (source === 'shipped' && runtimeRoot ? path.relative(runtimeRoot, file) : file);
  const visit = (dir: string, top: boolean) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (top && code === 'ENOENT') return;
      issues.push({ kind: 'unreadable-folder', severity: 'error', file: show(dir), message: `The ${kind} folder ${show(dir)} could not be read (${code ?? parseProblem(error)}).` });
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) { visit(file, false); continue; }
      if (!entry.name.endsWith(suffix)) continue;
      let document: unknown;
      try {
        document = parseYaml(fs.readFileSync(file, 'utf8'));
      } catch (error) {
        issues.push({ kind: 'malformed', severity: 'error', file: show(file), message: `${show(file)} is not valid YAML, so it is not used: ${parseProblem(error)}` });
        continue;
      }
      const header = typeof document === 'object' && document && !Array.isArray(document) ? (document as Record<string, unknown>)[headerKey] : undefined;
      const name = typeof header === 'object' && header && !Array.isArray(header) ? (header as Record<string, unknown>).name : undefined;
      if (typeof name !== 'string' || !name.trim()) {
        issues.push({ kind: 'unnamed', severity: 'error', file: show(file), message: `${show(file)} declares no ${headerKey}.name, so it is not used. A ${kind} file starts with "${headerKey}:" and a "name:" under it.` });
        continue;
      }
      found.push({ name, file, shown: show(file), source, header: header as Record<string, unknown>, document: document as Record<string, unknown> });
    }
  };
  visit(root, true);
  return found;
}

/** Group definitions by name, keeping path order. */
export function byName(definitions: readonly FoundDefinition[]): Map<string, FoundDefinition[]> {
  const grouped = new Map<string, FoundDefinition[]>();
  for (const definition of definitions) grouped.set(definition.name, [...(grouped.get(definition.name) ?? []), definition]);
  return grouped;
}

/** The issue for two or more files in one folder declaring the same name: none of them is used until one is renamed. */
export function duplicateIssue(kind: 'object' | 'trait', name: string, files: readonly FoundDefinition[]): DefinitionIssue {
  return {
    kind: 'duplicate', severity: 'error', file: files[0]!.shown, name,
    message: `${files.length} files declare the ${kind} "${name}": ${files.map(file => file.shown).join(', ')}. None of them is used until only one declares it.`,
  };
}
