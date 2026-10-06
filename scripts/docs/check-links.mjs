#!/usr/bin/env node

// s206-m04: every internal link in README.md, the docs and the release install page resolves.
//
// A link resolves when its target is a file (or a directory) the repository tracks, since the published repository is
// what a reader follows, and, for a Markdown target with a `#fragment`, when that heading or explicit anchor exists,
// computed the way GitHub computes heading anchors. External links (http, https, mailto) are not fetched.
//
//   node scripts/docs/check-links.mjs                 # report
//   node scripts/docs/check-links.mjs --check         # exit 1 on a broken internal link
//   node scripts/docs/check-links.mjs --reachable     # also the docs a reader reaches from the entry pages

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * What the check covers: every Markdown page at the repository root (the README, CONTRIBUTING, CHANGELOG, FEEDBACK and
 * the terms pages a reader reaches from it), and every Markdown and HTML document under docs/ (install.md among them).
 */
export const LINK_SCOPE = Object.freeze(["*.md", "docs"]);
/** Where a newcomer starts. */
export const ENTRY_PAGES = Object.freeze(["README.md", "docs/README.md", "docs/runtime/install.md"]);

/** Tracked files and new ones not yet committed (but not ignored), so a page added in the working tree counts. */
export function trackedFiles(root = REPO_ROOT) {
  return execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { cwd: root, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 }).split("\0").filter(Boolean);
}

export function documentsInScope(tracked) {
  return tracked.filter((file) => (file.startsWith("docs/") ? /\.(md|html)$/i.test(file) : !file.includes("/") && /\.md$/i.test(file))).sort();
}

const blank = (match) => match.replace(/[^\n]/g, " ");

/** Blank out HTML comments and fenced code, keeping line breaks so line numbers stay true. */
export function withoutFences(text) {
  return text
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/^( {0,3})(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:\n {0,3}\2[`~]*[ \t]*(?=\n|$)|$(?![\s\S]))/gm, blank);
}

/** Prose only: also blank inline code, where a bracket or a path is text, not a link. */
export function proseOnly(text) {
  return withoutFences(text).replace(/(`+)(?!`)[\s\S]*?[^`]\1(?!`)/g, blank);
}

export function extractLinks(text, file) {
  const prose = file.endsWith(".html") ? text.replace(/<!--[\s\S]*?-->/g, (match) => match.replace(/[^\n]/g, " ")) : proseOnly(text);
  const links = [];
  const lineOf = (index) => prose.slice(0, index).split("\n").length;
  const patterns = file.endsWith(".html")
    ? [/\b(?:href|src)\s*=\s*"([^"]*)"/g, /\b(?:href|src)\s*=\s*'([^']*)'/g]
    : [
      // [text](target "title") and ![alt](target); the text may hold one level of brackets.
      /!?\[(?:[^[\]\n]|\[[^\]\n]*\])*\]\(\s*<([^>\n]+)>(?:\s+["'(][^\n]*?["')])?\s*\)/g,
      /!?\[(?:[^[\]\n]|\[[^\]\n]*\])*\]\(\s*([^()\s]+(?:\([^()\s]*\)[^()\s]*)*)(?:\s+["'(][^\n]*?["')])?\s*\)/g,
      // [label]: target
      /^ {0,3}\[[^\]\n]+\]:\s*<?([^\s>]+)>?/gm,
      /\b(?:href|src)\s*=\s*"([^"]*)"/g,
    ];
  for (const pattern of patterns) {
    for (const match of prose.matchAll(pattern)) links.push({ line: lineOf(match.index), target: match[1].trim() });
  }
  return links;
}

/** GitHub's heading anchor: rendered text, lower-cased, punctuation dropped, spaces to hyphens, repeats numbered. */
export function headingSlug(heading) {
  const text = heading
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/[*_`~]/g, (character) => (character === "_" ? "_" : ""))
    .trim()
    .toLowerCase();
  return text.replace(/[^\p{L}\p{N}\p{M}\p{Pc}\- ]/gu, "").replace(/ /g, "-");
}

export function anchorsOf(text, file) {
  const anchors = new Set();
  // An anchor shown as an example is not a destination on the rendered page.
  const rendered = file.endsWith(".md") ? proseOnly(text) : text.replace(/<!--[\s\S]*?-->/g, blank);
  for (const match of rendered.matchAll(/\b(?:id|name)\s*=\s*["']([^"']+)["']/g)) anchors.add(match[1]);
  if (!file.endsWith(".md")) return anchors;
  // Headings keep their inline code: GitHub builds the anchor from the rendered text, backticks dropped.
  const prose = withoutFences(text).split("\n");
  const seen = new Map();
  const add = (heading) => {
    const slug = headingSlug(heading);
    const count = seen.get(slug) ?? 0;
    seen.set(slug, count + 1);
    anchors.add(count === 0 ? slug : `${slug}-${count}`);
  };
  prose.forEach((line, index) => {
    const atx = /^ {0,3}#{1,6}[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/.exec(line);
    if (atx) return add(atx[1]);
    if (index > 0 && /^ {0,3}(=+|-+)[ \t]*$/.test(line) && prose[index - 1].trim() && !/^ {0,3}([-*+]|\d+[.)])\s/.test(prose[index - 1]) && !/^ {0,3}(=+|-+)[ \t]*$/.test(prose[index - 1])) add(prose[index - 1]);
  });
  return anchors;
}

/** Where an internal link points, or null for an external one. */
export function resolveLink(target, fromFile) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("//")) return null;
  const hashAt = target.indexOf("#");
  const pathPart = (hashAt >= 0 ? target.slice(0, hashAt) : target).split("?")[0];
  let anchor = hashAt >= 0 ? target.slice(hashAt + 1) : "";
  try { anchor = decodeURIComponent(anchor); } catch { /* Report the literal fragment as a broken link. */ }
  let decoded;
  try { decoded = decodeURIComponent(pathPart); } catch { decoded = pathPart; }
  const resolved = decoded === ""
    ? fromFile
    : decoded.startsWith("/")
      ? path.posix.normalize(decoded.slice(1))
      : path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), decoded));
  return { path: resolved.replace(/\/$/, ""), anchor };
}

export function checkLinks({ root = REPO_ROOT, tracked = trackedFiles(root) } = {}) {
  const trackedSet = new Set(tracked);
  const directories = new Set();
  for (const file of tracked) for (let dir = path.posix.dirname(file); dir !== "."; dir = path.posix.dirname(dir)) directories.add(dir);
  const anchorCache = new Map();
  const anchorsFor = (file) => {
    if (!anchorCache.has(file)) anchorCache.set(file, anchorsOf(fs.readFileSync(path.join(root, file), "utf8"), file));
    return anchorCache.get(file);
  };
  const documents = documentsInScope(tracked);
  const broken = [];
  const edges = new Map();
  let internal = 0;
  for (const file of documents) {
    const targets = new Set();
    for (const link of extractLinks(fs.readFileSync(path.join(root, file), "utf8"), file)) {
      const resolved = resolveLink(link.target, file);
      if (!resolved) continue;
      internal += 1;
      const isFile = trackedSet.has(resolved.path);
      const isDirectory = !isFile && (resolved.path === "" || resolved.path === "." || directories.has(resolved.path));
      if (!isFile && !isDirectory) {
        broken.push({ file, line: link.line, target: link.target, reason: resolved.path.startsWith("..") ? "outside the repository" : "no such tracked file or directory" });
        continue;
      }
      if (isFile) targets.add(resolved.path);
      else if (trackedSet.has(`${resolved.path}/README.md`)) targets.add(`${resolved.path}/README.md`);
      if (resolved.anchor && isFile && /\.(md|html)$/.test(resolved.path) && !/^L\d+(-L\d+)?$/.test(resolved.anchor)) {
        if (!anchorsFor(resolved.path).has(resolved.anchor)) broken.push({ file, line: link.line, target: link.target, reason: `no heading or anchor #${resolved.anchor} in ${resolved.path}` });
      }
    }
    edges.set(file, [...targets].filter((target) => /\.(md|html)$/.test(target)));
  }
  return { documents: documents.length, internal, broken, edges };
}

/** Each document a reader reaches from the entry pages, with the fewest links it takes. */
export function reachable(edges, maxDepth = 2, entries = ENTRY_PAGES) {
  const depth = new Map(entries.map((entry) => [entry, 0]));
  let frontier = [...entries];
  for (let level = 1; level <= maxDepth; level += 1) {
    const next = [];
    for (const file of frontier) for (const target of edges.get(file) ?? []) if (!depth.has(target)) { depth.set(target, level); next.push(target); }
    frontier = next;
  }
  return depth;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = checkLinks();
  const summary = { documents: result.documents, internalLinks: result.internal, broken: result.broken.length };
  if (process.argv.includes("--reachable")) summary.reachable = Object.fromEntries([...reachable(result.edges)].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0])));
  console.log(JSON.stringify(summary, null, 2));
  for (const link of result.broken) console.error(`${link.file}:${link.line} ${link.target} — ${link.reason}`);
  if (process.argv.includes("--check") && result.broken.length) process.exitCode = 1;
}
