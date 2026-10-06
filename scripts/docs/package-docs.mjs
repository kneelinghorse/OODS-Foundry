#!/usr/bin/env node

// s220-m03: what the six published packages say about themselves, checked against the release they belong to.
//
// An audit of the published 0.3.1 packages found relative
// LICENSE and NOTICE links that npm's page turns into its sign-in page (F04), "Forge" in product prose (F05), a guide
// linking the previous release (F07) and libraries with no homepage or support route (F11). Every package-version
// reference in a current document follows its package's version, so a release bump rewrites them all; CHANGELOG files
// and lines marked `<!-- history -->` keep the versions they record.
//
//   node scripts/docs/package-docs.mjs          # write the versioned links and legal links
//   node scripts/docs/package-docs.mjs --check  # exit 1 on anything stale or wrong

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** The six packages published under @oods, by folder. */
export const PUBLISHED = Object.freeze(["foundry", "tokens", "components-react", "components-vue", "component-styles", "component-contracts"]);
export const HOMEPAGE = "https://oods-foundry.com/";
export const PUBLIC_REPOSITORY = "git+https://github.com/kneelinghorse/OODS-Foundry.git";
export const ISSUES = "https://github.com/kneelinghorse/OODS-Foundry/issues";
/**
 * Release documents outside the six packages: the plugin's copies of the foundry skill (client-configs.mjs keeps them in
 * step with packages/foundry) and the install guide that goes beside the runtime archive.
 */
const RELEASE_MARKDOWN = Object.freeze(["plugins/oods-foundry/skills/oods-foundry/SKILL.md", "plugins/oods-foundry/skills/oods-foundry/references/QUICKSTART.md", "docs/runtime/install.md"]);
const HISTORY_MARK = "<!-- history -->";
const VERSION_REFERENCE = /@oods\/([a-z][a-z-]*)@(\d+\.\d+\.\d+)/g;

const readJson = (root, relative) => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
const walk = (root, relative) => {
  const full = path.join(root, relative);
  if (!fs.existsSync(full)) return [];
  if (!fs.statSync(full).isDirectory()) return [relative];
  return fs.readdirSync(full).sort().flatMap((name) => walk(root, path.posix.join(relative, name)));
};

/** Every Markdown file a published package carries (its `files` list), and the other release documents. */
export function shippedMarkdown(root = REPO_ROOT) {
  const files = PUBLISHED.flatMap((name) => readJson(root, `packages/${name}/package.json`).files
    .flatMap((entry) => walk(root, path.posix.join("packages", name, entry.replace(/\/$/, ""))))
    .filter((file) => file.endsWith(".md")));
  return [...new Set([...files, ...RELEASE_MARKDOWN.filter((file) => fs.existsSync(path.join(root, file)))])].sort();
}

/** The version each @oods package is at, by its npm name. */
export function packageVersions(root = REPO_ROOT) {
  return Object.fromEntries(PUBLISHED.map((name) => [`@oods/${name}`, readJson(root, `packages/${name}/package.json`).version]));
}

const isHistory = (file) => path.posix.basename(file) === "CHANGELOG.md";
const blank = (text) => text.replace(/[^\n]/g, " ");
/** Prose only: fenced code, inline code spans and HTML comments blanked, line breaks kept. */
export function prose(text) {
  return text.replace(/```[\s\S]*?```/g, blank).replace(/<!--[\s\S]*?-->/g, blank).replace(/`[^`\n]*`/g, blank);
}

/** Each package-version reference that does not name its package's current version, with the line it is on. */
export function staleVersionReferences(file, text, versions) {
  if (isHistory(file)) return [];
  return text.split("\n").flatMap((line, index) => line.includes(HISTORY_MARK) ? [] : [...line.matchAll(VERSION_REFERENCE)]
    .filter(([, name, version]) => versions[`@oods/${name}`] && versions[`@oods/${name}`] !== version)
    .map(([reference, name]) => ({ file, line: index + 1, reference, current: `@oods/${name}@${versions[`@oods/${name}`]}` })));
}

export const legalLink = (name, version, document) => `https://cdn.jsdelivr.net/npm/${name}@${version}/${document}`;

/** A library README's legal links: absolute and at the package's own version, never relative (npm cannot follow those). */
export function legalLinkProblems(file, text, name, version) {
  const problems = [];
  if (/\]\((?:\.\/)?(?:LICENSE|NOTICE)\)/.test(text)) problems.push(`${file}: a relative LICENSE or NOTICE link; npm's page cannot follow it`);
  for (const document of ["LICENSE", "NOTICE"]) {
    if (!text.includes(`[${document}](${legalLink(name, version, document)})`)) problems.push(`${file}: no [${document}](${legalLink(name, version, document)})`);
  }
  return problems;
}

/** "Forge" used as a product name in prose; identifiers in code spans keep the earlier name (lock ruling #2463e). */
export function forgeInProse(file, text) {
  return prose(text).split("\n").flatMap((line, index) => /\bForge\b/.test(line) ? [{ file, line: index + 1 }] : []);
}

/** A published manifest's route back to the product (F11): homepage, Issues, source, a description and keywords. */
export function manifestProblems(name, manifest) {
  const problems = [];
  if (manifest.homepage !== HOMEPAGE) problems.push(`${name}: homepage must be ${HOMEPAGE}`);
  if (JSON.stringify(manifest.bugs) !== JSON.stringify({ url: ISSUES })) problems.push(`${name}: bugs must point to public Issues`);
  if (typeof manifest.description !== "string" || !manifest.description.includes("OODS Foundry")) problems.push(`${name}: the description must say what it is for OODS Foundry`);
  if (!Array.isArray(manifest.keywords) || manifest.keywords.length < 3 || manifest.keywords.length > 12 || !manifest.keywords.includes("oods")) problems.push(`${name}: keywords must be a small set (3 to 12) including "oods"`);
  const repository = { type: "git", url: PUBLIC_REPOSITORY, directory: `packages/${name.replace(/^@oods\//, "")}` };
  if (JSON.stringify(manifest.repository) !== JSON.stringify(repository)) problems.push(`${name}: repository must identify its public source directory`);
  return problems;
}

/** Everything wrong, and the rewritten documents that fix the versioned and legal links. */
export function audit(root = REPO_ROOT) {
  const versions = packageVersions(root);
  const problems = [];
  const rewritten = new Map();
  for (const file of shippedMarkdown(root)) {
    const text = fs.readFileSync(path.join(root, file), "utf8");
    let next = isHistory(file) ? text : text.split("\n").map((line) => line.includes(HISTORY_MARK) ? line
      : line.replace(VERSION_REFERENCE, (reference, name) => versions[`@oods/${name}`] ? `@oods/${name}@${versions[`@oods/${name}`]}` : reference)).join("\n");
    for (const stale of staleVersionReferences(file, text, versions)) problems.push(`${stale.file}:${stale.line}: ${stale.reference} is not the current ${stale.current}`);
    const library = /^packages\/([^/]+)\/README\.md$/.exec(file)?.[1];
    if (library && library !== "foundry") {
      const name = `@oods/${library}`;
      next = next.replace(/\]\((?:\.\/)?(LICENSE|NOTICE)\)/g, (_match, document) => `](${legalLink(name, versions[name], document)})`);
      problems.push(...legalLinkProblems(file, text, name, versions[name]));
    }
    for (const found of forgeInProse(file, text)) problems.push(`${found.file}:${found.line}: "Forge" in product prose; the product is OODS Foundry`);
    if (next !== text) rewritten.set(file, next);
  }
  for (const name of PUBLISHED) problems.push(...manifestProblems(`@oods/${name}`, readJson(root, `packages/${name}/package.json`)));
  return { problems, rewritten };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes("--check");
  const { problems, rewritten } = audit();
  if (!check) {
    for (const [file, text] of rewritten) fs.writeFileSync(path.join(REPO_ROOT, file), text, "utf8");
    const remaining = audit().problems;
    if (rewritten.size) console.log(`rewrote ${rewritten.size} file(s): ${[...rewritten.keys()].join(", ")}`);
    if (remaining.length) { console.error(remaining.join("\n")); process.exitCode = 1; }
  } else if (problems.length) {
    console.error(`package documents and manifests are stale or wrong (${problems.length}); run node scripts/docs/package-docs.mjs to rewrite links:\n${problems.join("\n")}`);
    process.exitCode = 1;
  } else {
    console.log(`package documents and manifests match their releases (${shippedMarkdown().length} documents, ${PUBLISHED.length} manifests).`);
  }
}
