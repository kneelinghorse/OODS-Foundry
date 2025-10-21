import { execFileSync } from 'node:child_process';
import fsp from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { inc, valid } from 'semver';

type ReleaseType = 'major' | 'minor' | 'patch';

type ConventionalEntry = {
  type: string;
  scope: string | null;
  description: string;
  breaking: boolean;
  rawSubject: string;
};

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function runGit(args: string[]): string | null {
  try {
    return execFileSync('git', args, {
      cwd: WORKSPACE_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    return null;
  }
}

function parseCommit(raw: string): ConventionalEntry {
  const [subjectLine, ...bodyLines] = raw.split('\n');
  const subject = subjectLine?.trim() ?? '';
  const body = bodyLines.join('\n');
  const match =
    /^(?<type>[a-z]+)(?<breaking>!?)(?:\((?<scope>[^)]+)\))?:\s*(?<description>.+)$/.exec(subject) ?? null;

  const breakingFromBody = /BREAKING CHANGE/i.test(body);
  const type = match?.groups?.type ?? 'other';
  const description = match?.groups?.description?.trim() ?? subject;
  const scope = match?.groups?.scope ?? null;
  const breaking = Boolean(match?.groups?.breaking === '!') || breakingFromBody;

  return {
    type,
    scope,
    description,
    breaking,
    rawSubject: subject,
  };
}

function determineReleaseType(commits: ConventionalEntry[]): ReleaseType {
  let releaseType: ReleaseType = 'patch';
  for (const entry of commits) {
    if (entry.breaking) {
      return 'major';
    }
    if (entry.type === 'feat' && releaseType === 'patch') {
      releaseType = 'minor';
    }
  }
  return releaseType;
}

function formatCommit(entry: ConventionalEntry): string {
  const scopePrefix = entry.scope ? `**${entry.scope}**: ` : '';
  const breakingSuffix = entry.breaking ? ' (breaking)' : '';
  return `- ${scopePrefix}${entry.description}${breakingSuffix}`;
}

function buildSections(commits: ConventionalEntry[]): Map<string, string[]> {
  const sections = new Map<string, string[]>([
    ['Features', []],
    ['Fixes', []],
    ['Docs', []],
    ['Chores', []],
    ['Other', []],
  ]);

  for (const entry of commits) {
    let bucket = 'Other';
    if (entry.type === 'feat') {
      bucket = 'Features';
    } else if (entry.type === 'fix') {
      bucket = 'Fixes';
    } else if (entry.type === 'docs') {
      bucket = 'Docs';
    } else if (entry.type === 'chore' || entry.type === 'refactor') {
      bucket = 'Chores';
    }
    sections.get(bucket)!.push(formatCommit(entry));
  }

  for (const [name, items] of Array.from(sections.entries())) {
    if (items.length === 0) {
      sections.delete(name);
    }
  }

  return sections;
}

async function updatePackageJson(newVersion: string): Promise<void> {
  const packagePath = path.join(WORKSPACE_ROOT, 'package.json');
  const raw = await fsp.readFile(packagePath, 'utf8');
  const data = JSON.parse(raw) as Record<string, unknown>;
  data.version = newVersion;
  await fsp.writeFile(`${packagePath}`, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function updateChangelog(newVersion: string, sections: Map<string, string[]>): Promise<void> {
  const changelogPath = path.join(WORKSPACE_ROOT, 'CHANGELOG.md');
  let current = '# Changelog\n\n';
  try {
    current = await fsp.readFile(changelogPath, 'utf8');
    if (!current.trim().startsWith('# Changelog')) {
      current = `# Changelog\n\n${current.trimStart()}`;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  let entry = `## v${newVersion} — ${today}\n\n`;
  for (const [section, items] of sections) {
    entry += `### ${section}\n`;
    entry += `${items.join('\n')}\n\n`;
  }

  const withoutHeader = current.slice('# Changelog'.length).trimStart();
  const updated = `# Changelog\n\n${entry}${withoutHeader}`;

  await fsp.writeFile(changelogPath, updated.replace(/\s+$/, '\n'), 'utf8');
}

async function main(): Promise<void> {
  const packagePath = path.join(WORKSPACE_ROOT, 'package.json');
  const pkg = JSON.parse(await fsp.readFile(packagePath, 'utf8')) as Record<string, unknown>;
  const currentVersionRaw = String(pkg.version ?? '');
  if (!valid(currentVersionRaw)) {
    throw new Error(`Invalid current version "${currentVersionRaw}" in package.json`);
  }

  const lastTag = runGit(['describe', '--tags', '--abbrev=0']);
  const rangeArgs = lastTag ? [`${lastTag.trim()}..HEAD`] : [];
  const logArgs = ['log', ...rangeArgs, '--pretty=%s%n%b%n==END=='];
  const rawLog = runGit(logArgs);
  if (!rawLog) {
    console.error('No conventional commits found for versioning.');
    process.exitCode = 1;
    return;
  }

  const commits = rawLog
    .split('\n==END==\n')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map(parseCommit);

  if (commits.length === 0) {
    console.error('No commits detected since last tag; aborting version bump.');
    process.exitCode = 1;
    return;
  }

  const releaseType = determineReleaseType(commits);
  const nextVersion = inc(currentVersionRaw, releaseType);
  if (!nextVersion) {
    throw new Error(`Failed to increment version ${currentVersionRaw} with release type ${releaseType}`);
  }

  const sections = buildSections(commits);

  await updatePackageJson(nextVersion);
  await updateChangelog(nextVersion, sections);

  console.log(`\nVersion bumped: ${currentVersionRaw} → ${nextVersion} (${releaseType})`);
  console.log('CHANGELOG.md updated with:');
  for (const [section, items] of sections) {
    console.log(`  ${section}: ${items.length} item(s)`);
  }
  console.log('');
}

await main().catch((error) => {
  console.error('pkg:version failed');
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
