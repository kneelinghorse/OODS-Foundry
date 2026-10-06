#!/usr/bin/env node
/**
 * s223-m03 (#2527 ruling 16; the website's message 2b348bfa, ask 3): the numbers and names a reader of @oods/foundry
 * otherwise copies out of prose, published as data in the package's facts.json. Each value is derived from its source and
 * names the file that states it: a file at the package root, or a file inside the runtime archive the package carries.
 * Nothing here is typed by hand.
 *
 *   node scripts/runtime/facts.mjs --write   # rewrite packages/foundry/facts.json
 *   node scripts/runtime/facts.mjs --check   # exit 1 when facts.json differs from its sources (docs:check)
 *
 * The chart facts are read from @oods/viz-core's built bundle, the file the runtime archive ships, so a stale build is a
 * stale fact: build viz-core first (the freeze does).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  NPX_ARGS, PLUGIN_INSTALL, PLUGIN_INSTALL_COMMANDS, PLUGIN_MARKETPLACE, MCP_REGISTRY_NAME, SERVER_NAME,
  SUPPORTED_CLIENTS, SUPPORTED_PLATFORMS, orList,
} from "./client-configs.mjs";
import { RUNTIME_ARCHIVE_FILE } from "./manifest.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const FACTS_FILE = "packages/foundry/facts.json";
/** Where the chart facts live inside the runtime archive (layout packages/*). */
const VIZ_CORE_BUNDLE = "packages/viz-core/dist/index.js";
/** The census's stamp in the source, which the bundle must carry unchanged (s190-viz-census.ts --check --stamp). */
const CENSUS_STAMP = "packages/viz-core/src/registry/viz-recipes.measured.json";

const inPackage = (file, detail = {}) => ({ file, ...detail });
const inArchive = (file, detail = {}) => ({ file: `runtime/${RUNTIME_ARCHIVE_FILE}`, path: file, ...detail });

/** The facts, derived from their sources in this checkout. */
export async function buildFacts(root = REPO_ROOT) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "packages/foundry/package.json"), "utf8"));
  const server = JSON.parse(fs.readFileSync(path.join(root, "packages/foundry/server.json"), "utf8"));
  const viz = await import(pathToFileURL(path.join(root, VIZ_CORE_BUNDLE)).href);
  for (const name of ["ACCURACY_RULES", "ECHARTS_ACCURACY_RULES", "VIZ_EQUIVALENCE_RULE_IDS", "VIZ_RECIPES", "VIZ_RECIPES_CENSUS"]) {
    assert(name in viz, `${VIZ_CORE_BUNDLE} does not export ${name}: build @oods/viz-core first`);
  }
  const accuracyCodes = [...viz.ACCURACY_RULES, ...viz.ECHARTS_ACCURACY_RULES].map((rule) => rule.code);
  assert.equal(new Set(accuracyCodes).size, accuracyCodes.length, "accuracy rule codes must be unique");
  const equivalence = [...viz.VIZ_EQUIVALENCE_RULE_IDS];
  // A certified scope is a chart type measured as certified and conformant in one theme and brand.
  const certified = viz.VIZ_RECIPES.filter((recipe) => recipe.certifyCoverage === "certified");
  const scopes = certified.flatMap((recipe) => recipe.certifyScopes
    .filter((scope) => scope.coverage === "certified" && scope.conformant === true)
    .map((scope) => ({ chartType: recipe.chartType, theme: scope.theme, brand: scope.brand })));
  const census = viz.VIZ_RECIPES_CENSUS;
  // A bundle built before the census last stamped would state an older measurement than the one the source records.
  assert.deepEqual(census, JSON.parse(fs.readFileSync(path.join(root, CENSUS_STAMP), "utf8")), `${VIZ_CORE_BUNDLE} bundles an older census stamp than ${CENSUS_STAMP}: build @oods/viz-core first`);
  assert.equal(census.certifiedScopes, scopes.length, "the census stamp counts the registry's certified scopes");
  assert.equal(census.chartTypes, certified.length, "the census stamp counts the registry's certified chart types");
  assert.equal(manifest.bin?.[SERVER_NAME], "bin/oods-foundry.js", "the install key is the package's bin name");
  assert.equal(server.name, MCP_REGISTRY_NAME, "server.json names the registry entry");
  const objectFiles = [];
  const visit = directory => {
    for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
      const file = `${directory}/${entry.name}`;
      if (entry.isDirectory()) visit(file);
      else if (file.endsWith('.object.yaml')) objectFiles.push(file);
    }
  };
  visit('objects'); visit('domains');
  return {
    schema: "oods-foundry-facts/v1",
    package: manifest.name,
    version: manifest.version,
    facts: {
      objects: {
        value: objectFiles.length,
        public: objectFiles.filter(file => !file.includes('/capture/')).length,
        internalCapture: objectFiles.filter(file => file.includes('/capture/')).length,
        source: inArchive("objects", { also: "domains", suffix: ".object.yaml" }),
      },
      platforms: { value: [...SUPPORTED_PLATFORMS], source: inPackage("README.md", { section: "Requirements" }) },
      clients: { value: [...SUPPORTED_CLIENTS], source: inPackage("README.md", { section: "Requirements" }) },
      installCommand: { value: `npx ${NPX_ARGS.join(" ")}`, source: inPackage("README.md", { section: "Install" }) },
      installKey: { value: SERVER_NAME, source: inPackage("package.json", { field: "bin" }) },
      plugin: {
        value: { marketplaceUrl: PLUGIN_MARKETPLACE, id: PLUGIN_INSTALL, installCommands: [...PLUGIN_INSTALL_COMMANDS] },
        source: inPackage("README.md", { section: "Agent skill, plugin and registry entry" }),
      },
      mcpRegistryName: { value: server.name, source: inPackage("server.json", { field: "name" }) },
      accuracyRuleCodes: { value: accuracyCodes, count: accuracyCodes.length, source: inArchive(VIZ_CORE_BUNDLE, { exports: ["ACCURACY_RULES", "ECHARTS_ACCURACY_RULES"] }) },
      equivalenceRules: { value: equivalence, count: equivalence.length, source: inArchive(VIZ_CORE_BUNDLE, { exports: ["VIZ_EQUIVALENCE_RULE_IDS"] }) },
      certifiedChartScopes: {
        value: scopes.length,
        chartTypes: certified.length,
        themes: [...new Set(scopes.map((scope) => scope.theme))],
        brands: [...new Set(scopes.map((scope) => scope.brand))],
        source: inArchive(VIZ_CORE_BUNDLE, { exports: ["VIZ_RECIPES", "VIZ_RECIPES_CENSUS"] }),
        // s223-m03 (#2527 ruling 17): the census run these scopes were measured in, as health reports it.
        measuredOn: census.measuredOn,
      },
    },
  };
}

export const renderFacts = (facts) => `${JSON.stringify(facts, null, 2)}\n`;

/**
 * Where the package's prose states a fact differently from facts.json: the README's requirements, install and plugin
 * sentences, and artifact_certify's reference guide (its ACCURACY paragraph's codes, its equivalence-rule count and its
 * certified scopes). Empty when they agree; a number in prose cannot drift from the data without failing --check.
 */
export function proseDisagreements(document, { readme, certifyDescription }) {
  const { facts } = document;
  const findings = [];
  const expectIn = (label, text, sentence) => { if (!text.includes(sentence)) findings.push(`${label} does not say: ${sentence}`); };
  expectIn("README.md", readme, `- ${orList(facts.platforms.value)}.`);
  expectIn("README.md", readme, `- One of ${orList(facts.clients.value)}.`);
  expectIn("README.md", readme, `Every client starts the same command, \`${facts.installCommand.value}\`, and registers it under the name \`${facts.installKey.value}\`.`);
  for (const command of facts.plugin.value.installCommands) expectIn("README.md", readme, command);
  expectIn("README.md", readme, `\`${facts.mcpRegistryName.value}\``);
  const accuracy = certifyDescription.split("\n\n").find((paragraph) => paragraph.startsWith("ACCURACY."));
  if (!accuracy) findings.push("artifact_certify's reference guide has no ACCURACY paragraph");
  else {
    const stated = [...new Set([...accuracy.matchAll(/\b(?:OODS-)?(V\d{3})\b/g)].map((match) => `OODS-${match[1]}`))].sort();
    const published = [...facts.accuracyRuleCodes.value].sort();
    if (JSON.stringify(stated) !== JSON.stringify(published)) findings.push(`artifact_certify's ACCURACY paragraph names ${stated.join(", ")}; facts.json has ${published.join(", ")}`);
  }
  expectIn("artifact_certify's reference guide", certifyDescription, `The ${facts.equivalenceRules.count} equivalence rules`);
  expectIn("artifact_certify's reference guide", certifyDescription, `All ${facts.certifiedChartScopes.chartTypes} chart types render and certify conformantly in the ${facts.certifiedChartScopes.value} measured light/dark/HC and A/B scopes`);
  return findings;
}

/** The prose this checkout ships, as proseDisagreements reads it. */
export function shippedProse(root = REPO_ROOT) {
  return {
    readme: fs.readFileSync(path.join(root, "packages/foundry/README.md"), "utf8"),
    certifyDescription: fs.readFileSync(path.join(root, "packages/foundry/TOOL-REFERENCE.md"), "utf8"),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2];
  if (mode !== "--write" && mode !== "--check") {
    process.stderr.write("usage: facts.mjs --write | --check\n");
    process.exit(2);
  }
  const facts = await buildFacts();
  const text = renderFacts(facts);
  const file = path.join(REPO_ROOT, FACTS_FILE);
  const disagreements = proseDisagreements(facts, shippedProse());
  if (disagreements.length) {
    process.stderr.write(`The package's prose disagrees with its facts:\n${disagreements.map((line) => `- ${line}`).join("\n")}\n`);
    process.exitCode = 1;
  } else if (mode === "--write") {
    fs.writeFileSync(file, text);
    process.stdout.write(`Wrote ${FACTS_FILE}.\n`);
  } else if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== text) {
    process.stderr.write(`${FACTS_FILE} is stale: run node scripts/runtime/facts.mjs --write.\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(`${FACTS_FILE} is fresh.\n`);
  }
}
