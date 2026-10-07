#!/usr/bin/env node
/**
 * What may ship (s211-m03): one rule set for the runtime archive and the npm package, run on the real shipped bytes
 * by the assembler and the package builder, and on the repository's would-ship files by its spec.
 *
 * A finding names its rule, the shipped path and what was found. First-party files (everything outside node_modules)
 * are read as text; third-party packages are checked only for internal members, since their own text is theirs.
 *
 *   node scripts/runtime/package-contents.mjs <root>   # exit 1 and list the findings for an extracted package
 */
import fs from "node:fs";
import path from "node:path";
import { load as loadYaml } from "js-yaml";
import { fileURLToPath } from "node:url";
import { retiredToolReferences } from "./tool-name-guard.mjs";
import { staleGuideVersions } from "./guide-versions.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export const RULES = Object.freeze({
  "missing-shadcn-item": "the shipped shadcn adapters or mapping file are missing",
  "missing-mapping-example": "the shipped Harbor component set is missing its mapping file",
  "retired-tool-name": "a shipped guide names a retired tool call",
  "stale-guide-version": "a shipped guide names a different OODS Foundry release",
  "internal-member": "a member under cmos/ or .worktrees/",
  "local-path": "an absolute path on a developer's machine",
  "internal-path": "a cmos/ or .worktrees/ path in shipped text",
  "unread-receipt": "a record the runtime does not read",
  "owner-link": "a link to the owner's GitHub account",
  "registry-reference": "a registry citation whose distributed target does not resolve",
  "dead-link": "a link to a file that does not ship",
  "owner-name": "the owner's name outside LICENSE and NOTICE",
  "foreign-address": "an address under someone else's domain (oods.dev) or an unregistered one (open-oods.dev)",
});

// The two security files hold redaction patterns that name a home directory on purpose.
const LOCAL_PATH_EXEMPT = new Set(["packages/mcp-server/dist/security/policy.json", "packages/mcp-server/dist/security/redactions.json"]);
const OWNER_NAME_EXEMPT = new Set(["LICENSE", "NOTICE"]);
const LOCAL_PATH = /\/Users\/[^/\s"'`]+|\/home\/[a-z][^/\s"'`]*\/|[A-Za-z]:\\Users\\/;
const INTERNAL_PATH = /(^|[^A-Za-z0-9_.-])(cmos|\.worktrees)\/[A-Za-z0-9_.-]/;
const OWNER_LINK = /github\.com\/kneelinghorse/i;
// Only the public source mirror and plugin marketplace may identify this account.
// Require a repository boundary so a similarly named private repository cannot pass.
const PUBLIC_OWNER_LINK = /github\.com\/kneelinghorse\/(?:oods-foundry-claude-plugin|OODS-Foundry)(?:\.git)?(?=[/#?\s"'`)\]]|$)/gi;
// Spec identifiers ($schema, $id) live under https://oods-foundry.com/, which the holder owns (s211 handoff, Settled).
const FOREIGN_ADDRESS = /https?:\/\/(?:open-)?oods\.dev(?![A-Za-z0-9-])/;
const MARKDOWN_LINK = /!?\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)|<(?:img|a)\b[^>]*\b(?:src|href)="([^"]+)"/g;

/**
 * The owner's first name, which shipped text never uses to speak about him (#2293), and the holder's contact address,
 * which every shipped page may give (configs/license/holder.json).
 */
export function ownerFacts(root = ROOT) {
  const holder = JSON.parse(fs.readFileSync(path.join(root, "configs/license/holder.json"), "utf8"));
  return { contact: holder.contact, ownerName: "Derek" };
}

const isThirdParty = (member) => member.split("/").includes("node_modules");
const isText = (bytes) => !bytes.subarray(0, 8192).includes(0);

/**
 * Every file under root as { path, bytes }, symlinks skipped (their targets are members themselves). Third-party
 * files are listed by path only: the rules read no third-party text.
 */
export function readTree(root) {
  const entries = [];
  const visit = (relative) => {
    for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
      const member = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) visit(member);
      else if (entry.isFile()) entries.push({ path: member, bytes: isThirdParty(member) ? Buffer.alloc(0) : fs.readFileSync(path.join(root, member)) });
    }
  };
  visit("");
  return entries;
}

/**
 * The findings for one package root's files. `receipts` names what the runtime reads under each receipt directory:
 * { "packages/component-contracts/registry/": [...paths] }; structured data is read from the shipped manifest.
 * `cdnBase` is the package's own CDN prefix (https://cdn.jsdelivr.net/npm/<name>@<version>/), whose paths must ship.
 */
export function packageContentFindings(entries, { contact, ownerName, receipts = {}, cdnBase = null }) {
  const findings = [];
  const add = (rule, member, detail) => findings.push({ rule, path: member, detail });
  const packageEntry = entries.find(entry => entry.path === "package.json");
  const packageManifest = packageEntry ? JSON.parse(packageEntry.bytes.toString("utf8")) : null;
  const release = packageManifest?.name === "@oods/foundry" ? packageManifest.version : null;
  const members = new Set(entries.map((entry) => entry.path));
  if (release) for (const prefix of ["", "vue/"]) for (const name of ["registry", "mappings", "oods-button", "oods-card", "oods-status-badge", "oods-tabs", "oods-select", "oods-search-input", "oods-pagination-bar", "oods-banner", "oods-input", "oods-textarea", "oods-checkbox", "oods-date-picker", "oods-tag-input", "oods-status-selector", "oods-card-header", "oods-price-badge"]) {
    const file = `shadcn/${prefix}${name}.json`;
    if (!members.has(file)) add("missing-shadcn-item", file, "Ship the sixteen React and Vue OODS adapters, catalogs and checked mapping lists.");
  }
  if (release && members.has("quickstart/team-components/package.json") && !members.has("quickstart/team-components/mappings.json")) add("missing-mapping-example", "quickstart/team-components/mappings.json", "Ship the checked-list template beside the example package.");
  const directories = new Set([...members].flatMap((member) => member.split("/").slice(0, -1).map((_, index, parts) => parts.slice(0, index + 1).join("/"))));
  const manifestEntry = entries.find((entry) => entry.path === "artifacts/structured-data/manifest.json");
  const structuredReads = new Set(["artifacts/structured-data/manifest.json", "artifacts/structured-data/component-mappings.json",
    ...(manifestEntry ? JSON.parse(manifestEntry.bytes.toString("utf8")).artifacts.map((artifact) => artifact.path) : [])]);
  const ownerWord = new RegExp(`\\b${ownerName}\\b`, "i");

  for (const entry of entries) {
    const member = entry.path;
    if (member.split("/").some((part) => part === "cmos" || part === ".worktrees")) add("internal-member", member, member);
    if (isThirdParty(member)) continue;
    if (member.startsWith("artifacts/") && !structuredReads.has(member)) add("unread-receipt", member, "not named by artifacts/structured-data/manifest.json");
    for (const [directory, read] of Object.entries(receipts)) {
      if (member.startsWith(directory) && !read.includes(member)) add("unread-receipt", member, `not among the files the runtime reads under ${directory}`);
    }
    if (!isText(entry.bytes)) continue;
    const text = entry.bytes.toString("utf8");
    const local = LOCAL_PATH.exec(text);
    if (local && !LOCAL_PATH_EXEMPT.has(member)) add("local-path", member, local[0]);
    const internal = INTERNAL_PATH.exec(text);
    if (internal) add("internal-path", member, text.slice(internal.index, internal.index + 60).trim());
    const link = OWNER_LINK.exec(text.replace(PUBLIC_OWNER_LINK, ""));
    if (link) add("owner-link", member, text.slice(link.index, link.index + 60));
    const foreign = FOREIGN_ADDRESS.exec(text);
    if (foreign) add("foreign-address", member, text.slice(foreign.index, foreign.index + 60));
    if (!OWNER_NAME_EXEMPT.has(path.posix.basename(member))) {
      const named = ownerWord.exec(text.split(contact).join(""));
      if (named) add("owner-name", member, text.split(contact).join("").slice(Math.max(0, named.index - 30), named.index + 30).trim());
    }
    if (/\.ya?ml$/.test(member) && /^(objects|traits|domains)\//.test(member)) {
      const document = loadYaml(text);
      for (const reference of document?.metadata?.references ?? []) {
        if (typeof reference !== "string") continue;
        const location = reference.split(" — ")[0];
        if (!/^(objects|traits|domains|schemas|packages|src|docs|tokens|stories|artifacts)\//.test(location)) continue;
        const [file, pointer] = location.split("#");
        const target = entries.find(entry => entry.path === file);
        if (!target) { add("registry-reference", member, location); continue; }
        if (pointer?.startsWith("/")) {
          let value;
          try {
            value = JSON.parse(target.bytes.toString("utf8"));
            for (const key of pointer.slice(1).split("/")) value = value?.[key.replaceAll("~1", "/").replaceAll("~0", "~")];
          } catch { value = undefined; }
          if (value === undefined) add("registry-reference", member, location);
        }
      }
    }
    if (member.endsWith(".md")) {
      if (release) for (const found of retiredToolReferences(text, member)) add("retired-tool-name", member, `${found.name}; use ${found.replacement}`);
      if (release && !["CHANGELOG.md", "THIRD-PARTY-NOTICES.md"].includes(path.posix.basename(member)) && !member.startsWith("runtime/")) {
        for (const found of staleGuideVersions(text, release)) add("stale-guide-version", member, `${found}; expected ${release}`);
      }
      for (const match of text.matchAll(MARKDOWN_LINK)) {
        const target = (match[1] ?? match[2]).trim();
        if (/^(#|mailto:)/.test(target)) continue;
        if (/^https?:\/\//.test(target)) {
          if (cdnBase && target.startsWith(cdnBase) && !members.has(target.slice(cdnBase.length).split(/[?#]/)[0])) add("dead-link", member, target);
          continue;
        }
        const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(member), decodeURI(target.split(/[?#]/)[0])));
        if (!members.has(resolved) && !directories.has(resolved.replace(/\/$/, ""))) add("dead-link", member, target);
      }
    }
  }
  return findings;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.argv[2];
  if (!root) {
    process.stderr.write("usage: package-contents.mjs <extracted package root>\n");
    process.exit(2);
  }
  const findings = packageContentFindings(readTree(path.resolve(root)), ownerFacts());
  for (const finding of findings) process.stdout.write(`${finding.rule}\t${finding.path}\t${finding.detail}\n`);
  process.stdout.write(`${findings.length} finding(s)\n`);
  process.exitCode = findings.length ? 1 : 0;
}
