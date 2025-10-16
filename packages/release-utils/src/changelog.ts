import path from 'node:path';
import { runCommand } from './command.js';

export type ConventionalCommit = {
  type: string;
  scope: string | null;
  description: string;
  breaking: boolean;
  raw: string;
};

export type ChangelogOptions = {
  cwd?: string;
  baseTag?: string;
};

export type ChangelogResult = {
  baseTag?: string;
  commits: ConventionalCommit[];
  markdown: string;
  warnings: string[];
};

async function detectBaseTag(cwd: string): Promise<string | undefined> {
  try {
    const { stdout } = await runCommand('git', ['describe', '--tags', '--abbrev=0', '--match', 'v*'], { cwd });
    const tag = stdout.trim();
    return tag || undefined;
  } catch {
    return undefined;
  }
}

const TYPE_LABELS: Record<string, string> = {
  feat: 'Features',
  fix: 'Fixes',
  perf: 'Performance',
  refactor: 'Refactors',
  docs: 'Documentation',
  test: 'Tests',
  build: 'Build System',
  chore: 'Chores',
  ci: 'CI',
};

function parseConventional(line: string): ConventionalCommit | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(?<type>[a-z]+)(?<breaking>!?)(?:\((?<scope>[^)]+)\))?:\s*(?<desc>.+)$/i);
  if (!match || !match.groups) {
    return null;
  }
  const type = match.groups.type.toLowerCase();
  const scope = match.groups.scope ? match.groups.scope.trim() : null;
  const description = match.groups.desc.trim();
  const breaking = match.groups.breaking === '!';
  return {
    type,
    scope,
    description,
    breaking,
    raw: trimmed,
  };
}

function formatEntry(entry: ConventionalCommit): string {
  const scope = entry.scope ? `**${entry.scope}:** ` : '';
  return `- ${scope}${entry.description}`;
}

function buildMarkdown(baseTag: string | undefined, entries: ConventionalCommit[], warnings: string[]): string {
  const header = baseTag ? `## Changes since ${baseTag}` : '## Unreleased Changes';
  if (entries.length === 0) {
    const suffix = warnings.length ? '\n\n_No conventional commits detected; see warnings._' : '\n\n_No commits found._';
    return `${header}${suffix}`;
  }
  const sections: string[] = [header];
  const breaking = entries.filter((entry) => entry.breaking);
  if (breaking.length) {
    sections.push('\n### Breaking Changes');
    sections.push(...breaking.map(formatEntry));
  }
  const grouped = new Map<string, ConventionalCommit[]>();
  for (const entry of entries) {
    const label = TYPE_LABELS[entry.type] ?? 'Other';
    if (!grouped.has(label)) {
      grouped.set(label, []);
    }
    grouped.get(label)!.push(entry);
  }
  for (const [label, items] of grouped) {
    const filtered = breaking.length ? items.filter((entry) => !entry.breaking) : items;
    if (!filtered.length) continue;
    sections.push(`\n### ${label}`);
    sections.push(...filtered.map(formatEntry));
  }
  if (warnings.length) {
    sections.push('\n### Warnings');
    for (const line of warnings) {
      sections.push(`- ${line}`);
    }
  }
  return sections.join('\n');
}

export async function generateChangelog(options: ChangelogOptions = {}): Promise<ChangelogResult> {
  const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();
  const baseTag = options.baseTag ?? (await detectBaseTag(cwd));
  const rangeArg = baseTag ? `${baseTag}..HEAD` : 'HEAD';
  const { stdout } = await runCommand('git', ['log', '--pretty=format:%s', rangeArg], { cwd });
  const lines = stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const commits: ConventionalCommit[] = [];
  const warnings: string[] = [];
  for (const line of lines) {
    const parsed = parseConventional(line);
    if (!parsed) {
      warnings.push(`Non-conventional commit skipped: ${line}`);
      continue;
    }
    commits.push(parsed);
  }
  const markdown = buildMarkdown(baseTag, commits, warnings);
  return {
    baseTag,
    commits,
    markdown,
    warnings,
  };
}
