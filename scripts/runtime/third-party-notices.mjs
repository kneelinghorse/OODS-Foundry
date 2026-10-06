#!/usr/bin/env node

// Renders THIRD-PARTY-NOTICES.md for the portable runtime bundle from the same
// pnpm-lock-derived production closure that runtime-sbom-lite.json records.
// Every package's declared license, project URL and shipped license text come
// from the package files in the repository's pnpm virtual store, which the
// lockfile integrity hashes pin, so the output is a pure function of the lock.
//
//   node scripts/runtime/third-party-notices.mjs          # write
//   node scripts/runtime/third-party-notices.mjs --check  # fail when stale

import assert from "node:assert/strict";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { RUNTIME_ARCHIVE_FILE, sha256, sha256File } from "./manifest.mjs";
import { buildSbomLite } from "./sbom-lite.mjs";

export const NOTICES_FILE = "THIRD-PARTY-NOTICES.md";
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..", "..");
// The product's names come from its one name source (s211-m03, #2296).
const NAME = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "configs/product/name.json"), "utf8"));
const LICENSE_TEXT_FILE = /^(?:LICEN[CS]E|COPYING|NOTICE)(?:[-._].*)?$/i;
const TEXT_FENCE = "````";

function bytewiseCompare(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

/** pnpm stores `@scope/name@version` as `@scope+name@version[_peer-context]`. */
function storeDirectoryFor(storeEntries, name, version) {
  const key = `${name.replace("/", "+")}@${version}`;
  const matches = storeEntries
    .filter((entry) => entry === key || entry.startsWith(`${key}_`))
    .sort(bytewiseCompare);
  assert(
    matches.length > 0,
    `${name}@${version} is not installed in node_modules/.pnpm; run pnpm install --frozen-lockfile`,
  );
  return matches[0];
}

function declaredLicense(manifest) {
  if (typeof manifest.license === "string" && manifest.license.trim()) {
    return manifest.license.trim();
  }
  if (manifest.license && typeof manifest.license.type === "string") {
    return manifest.license.type.trim();
  }
  if (Array.isArray(manifest.licenses) && manifest.licenses.length > 0) {
    return manifest.licenses
      .map((entry) => (typeof entry === "string" ? entry : entry?.type))
      .filter(Boolean)
      .join(" OR ");
  }
  return "(not declared)";
}

function projectUrl(manifest) {
  if (typeof manifest.homepage === "string" && /^https?:\/\//.test(manifest.homepage)) {
    return manifest.homepage.trim();
  }
  const repository =
    typeof manifest.repository === "string"
      ? manifest.repository
      : manifest.repository?.url;
  if (typeof repository !== "string" || !repository) return null;
  let url = repository.trim().replace(/^git\+/, "").replace(/\.git$/, "");
  if (/^[\w.-]+\/[\w.-]+$/.test(url)) return `https://github.com/${url}`;
  if (url.startsWith("github:")) return `https://github.com/${url.slice(7)}`;
  if (url.startsWith("git://")) url = `https://${url.slice(6)}`;
  if (url.startsWith("git@github.com:")) url = `https://github.com/${url.slice(15)}`;
  if (url.startsWith("ssh://git@")) url = `https://${url.slice(10)}`;
  return /^https?:\/\//.test(url) ? url : null;
}

function normalizeText(bytes) {
  let text = bytes.toString("utf8").replace(/\r\n?/g, "\n").replace(/^﻿/, "");
  text = text.replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n").trim();
  assert(
    !text.split("\n").some((line) => line.startsWith(TEXT_FENCE)),
    "license text contains a four-backtick fence",
  );
  return text;
}

async function packageNotice(repoRoot, storeEntries, entry) {
  const directory = storeDirectoryFor(storeEntries, entry.name, entry.version);
  const packageRoot = path.join(
    repoRoot,
    "node_modules/.pnpm",
    directory,
    "node_modules",
    entry.name,
  );
  const manifest = JSON.parse(
    await fsp.readFile(path.join(packageRoot, "package.json"), "utf8"),
  );
  assert.equal(manifest.name, entry.name, `installed package name differs: ${directory}`);
  assert.equal(
    manifest.version,
    entry.version,
    `installed package version differs: ${directory}`,
  );
  const files = (await fsp.readdir(packageRoot, { withFileTypes: true }))
    .filter((item) => item.isFile() && LICENSE_TEXT_FILE.test(item.name))
    .map((item) => item.name)
    .sort(bytewiseCompare);
  const texts = [];
  for (const file of files) {
    texts.push({
      file,
      text: normalizeText(await fsp.readFile(path.join(packageRoot, file))),
    });
  }
  return {
    id: entry.id,
    name: entry.name,
    version: entry.version,
    license: declaredLicense(manifest),
    url: projectUrl(manifest),
    texts,
  };
}

export async function collectThirdPartyNotices(repoRoot = REPO_ROOT, sbom) {
  const closure = sbom ?? (await buildSbomLite(repoRoot));
  const storeEntries = await fsp.readdir(path.join(repoRoot, "node_modules/.pnpm"));
  const packages = [];
  for (const entry of [...closure.packages].sort((left, right) =>
    bytewiseCompare(left.id, right.id),
  )) {
    packages.push(await packageNotice(repoRoot, storeEntries, entry));
  }
  assert.equal(packages.length, closure.summary.packageCount, "notice count differs from the closure");
  return {
    lockfileSha256: await sha256File(path.join(repoRoot, "pnpm-lock.yaml")),
    packageCount: packages.length,
    packages,
  };
}

export function renderThirdPartyNotices(notices) {
  const byLicense = new Map();
  for (const item of notices.packages) {
    byLicense.set(item.license, (byLicense.get(item.license) ?? 0) + 1);
  }
  const licenseSummary = [...byLicense.entries()]
    .sort((left, right) => right[1] - left[1] || bytewiseCompare(left[0], right[0]))
    .map(([license, count]) => `| ${license} | ${count} |`);
  const withoutText = notices.packages.filter((item) => item.texts.length === 0);
  const lines = [
    "# Third-party notices",
    "",
    `<!-- Generated by scripts/runtime/third-party-notices.mjs from pnpm-lock.yaml (sha256 ${notices.lockfileSha256}). Do not edit; run \`node scripts/runtime/third-party-notices.mjs\` and verify with \`--check\`. -->`,
    "",
    `The ${NAME.product} runtime (\`${RUNTIME_ARCHIVE_FILE}\`, which the npm package \`${NAME.npmPackage}\` carries) ships ${notices.packageCount} third-party npm packages: the production dependency closure of the MCP server, the stdio adapter and the HTTP bridge, resolved from \`pnpm-lock.yaml\` and listed with integrity hashes in \`runtime-sbom-lite.json\`. Each package stays under its own license, reproduced below from the files published with it. The ${NAME.product} license (the Apache License 2.0, see \`LICENSE\`) covers ${NAME.product} itself and none of these packages.`,
    "",
    "## Declared licenses",
    "",
    "| License | Packages |",
    "| --- | --- |",
    ...licenseSummary,
    "",
  ];
  if (withoutText.length > 0) {
    lines.push(
      `Packages that publish no license text carry their declared identifier only: ${withoutText.map((item) => `\`${item.id}\``).join(", ")}.`,
      "",
    );
  }
  lines.push("## Packages", "");
  for (const item of notices.packages) {
    lines.push(`### ${item.id}`, "");
    lines.push(
      `License: ${item.license}. ${item.url ? `Project: <${item.url}>.` : "Project: none declared."}`,
      "",
    );
    if (item.texts.length === 0) {
      lines.push("No license text is shipped in this package.", "");
      continue;
    }
    for (const { file, text } of item.texts) {
      lines.push(`From \`${file}\`:`, "", `${TEXT_FENCE}text`, text, TEXT_FENCE, "");
    }
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

export async function buildThirdPartyNotices(repoRoot = REPO_ROOT, sbom) {
  return renderThirdPartyNotices(await collectThirdPartyNotices(repoRoot, sbom));
}

const isCli =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const check = process.argv.includes("--check");
  const target = path.join(REPO_ROOT, NOTICES_FILE);
  buildThirdPartyNotices(REPO_ROOT)
    .then((rendered) => {
      if (check) {
        const current = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "";
        if (current !== rendered) {
          throw new Error(
            `${NOTICES_FILE} is stale (have sha256 ${sha256(current)}, want ${sha256(rendered)}); run node scripts/runtime/third-party-notices.mjs`,
          );
        }
        process.stdout.write(`${NOTICES_FILE} is fresh (${rendered.length} bytes).\n`);
        return;
      }
      fs.writeFileSync(target, rendered, "utf8");
      process.stdout.write(`wrote ${NOTICES_FILE} (${rendered.length} bytes).\n`);
    })
    .catch((error) => {
      process.stderr.write(`third-party-notices: ${error.stack ?? error.message}\n`);
      process.exitCode = 1;
    });
}
