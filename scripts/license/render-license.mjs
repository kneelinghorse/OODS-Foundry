#!/usr/bin/env node
/**
 * Render the license and its holder from ONE source into every place they appear.
 *
 *   node scripts/license/render-license.mjs          # write
 *   node scripts/license/render-license.mjs --check  # exit 1 if any rendered file differs
 *
 * Inputs: configs/license/holder.json (the only place the holder string is authored) and
 * configs/license/Apache-2.0.txt, https://www.apache.org/licenses/LICENSE-2.0.txt verbatim,
 * whose sha256 must equal configs/license/apache-2.0.sha256 (#2372).
 * Outputs: LICENSE (the canonical text, unchanged) and NOTICE (the product name and the holder, then any
 * third-party notices from configs/license/third-party/)
 * at the root and in each licensed package, and the holder span between the license-holder
 * markers in README.md and docs/LICENSE-FAQ.md.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const HOLDER_PATH = 'configs/license/holder.json';
export const CANONICAL_PATH = 'configs/license/Apache-2.0.txt';
export const CANONICAL_SHA256_PATH = 'configs/license/apache-2.0.sha256';
export const CANONICAL_SOURCE = 'https://www.apache.org/licenses/LICENSE-2.0.txt';
export const SPDX_ID = 'Apache-2.0';
// The product name comes from its one source (#2296).
export const PRODUCT_NAME = JSON.parse(fs.readFileSync(path.join(ROOT, 'configs/product/name.json'), 'utf8')).product;
export const LICENSED_DIRS = ['', 'packages/tokens', 'packages/tw-variants', 'packages/a11y-tools', 'packages/viz-core', 'packages/viz-render', 'packages/components-react', 'packages/components-vue', 'packages/component-styles', 'packages/component-contracts', 'tests/fixtures/team-components', 'packages/foundry/quickstart/team-components', 'plugins/oods-foundry'];
export const LICENSE_FILES = LICENSED_DIRS.map(dir => path.posix.join(dir, 'LICENSE'));
export const NOTICE_FILES = LICENSED_DIRS.map(dir => path.posix.join(dir, 'NOTICE'));
export const MARKER_START = '<!-- license-holder:start -->';
export const MARKER_END = '<!-- license-holder:end -->';
/**
 * The holder's statement on generated output (#2372), rendered into README, the npm README and the FAQ. s224-m01 (#2542
 * ruling 7): the fonts the package bundles keep their own licence in whatever carries them, and generated HTML that embeds
 * them carries their notice (packages/mcp-server/src/render/document.ts inlineTokenFonts).
 */
export const GENERATED_OUTPUT = `What ${PRODUCT_NAME} generates for you is yours. You may use, change and distribute generated code, markup, styles and other output under any terms you choose, without including ${PRODUCT_NAME}'s LICENSE or NOTICE. The fonts ${PRODUCT_NAME} bundles (Geist, Geist Mono and DM Sans) stay under the SIL Open Font License 1.1 wherever they go, so generated HTML that embeds them carries their notice. The ${PRODUCT_NAME} packages that generated code installs as dependencies remain under the Apache License 2.0.`;

const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const sha256 = (text) => createHash('sha256').update(text).digest('hex');

export function loadHolder(root = ROOT) {
  const holder = JSON.parse(fs.readFileSync(path.join(root, HOLDER_PATH), 'utf8'));
  for (const key of ['holder', 'url', 'contact', 'year']) if (holder[key] === undefined || holder[key] === '') throw new Error(`${HOLDER_PATH} is missing ${key}`);
  return holder;
}

export function loadCanonical(root = ROOT) {
  const text = fs.readFileSync(path.join(root, CANONICAL_PATH), 'utf8');
  const recorded = fs.readFileSync(path.join(root, CANONICAL_SHA256_PATH), 'utf8').trim().split(/\s+/)[0];
  const actual = sha256(text);
  if (actual !== recorded) throw new Error(`${CANONICAL_PATH} sha256 ${actual} differs from the recorded ${recorded}`);
  return { text, sha256: actual };
}

/** The NOTICE file: the product name and the holder's copyright line. */
export const renderNotice = (holder) => `${PRODUCT_NAME}\nCopyright ${holder.year} ${holder.holder} (${holder.url})\n`;
/**
 * Third-party notices a package's NOTICE carries after its own two lines, each rendered verbatim from its source
 * (s221-m02, #2482 ruling 6): @oods/tokens bundles the DM Sans font files under the SIL OFL 1.1. s222-m01 (#2502
 * rulings 2 and 4): it also bundles Geist and Geist Mono (SIL OFL 1.1) and a calibration table derived from Radix Colors
 * (MIT), which the repository's palette generator reads too. s223-m03 (the website's message 74efb63e, I52): @oods/foundry
 * ships the root NOTICE and carries @oods/tokens, fonts included, inside its runtime archive, so the root NOTICE carries the
 * font notices verbatim too, after a preface that says where those files are.
 */
export const THIRD_PARTY_SECTIONS = {
  NOTICE: ['configs/license/third-party/fonts-in-tokens.txt', 'configs/license/third-party/dm-sans.txt', 'configs/license/third-party/geist.txt', 'configs/license/third-party/radix-colors.txt'],
  'packages/tokens/NOTICE': ['configs/license/third-party/dm-sans.txt', 'configs/license/third-party/geist.txt', 'configs/license/third-party/radix-colors.txt'],
};

/** The holder spans rendered between the markers of the two prose carriers. */
export function holderSpans(holder) {
  return {
    'README.md': `Copyright ${holder.year} ${holder.holder} (${holder.url}). ${PRODUCT_NAME} is licensed under the Apache License 2.0 (SPDX \`${SPDX_ID}\`), the text in [LICENSE](LICENSE), with the notice in [NOTICE](NOTICE). Questions: ${holder.contact}.`,
    'docs/LICENSE-FAQ.md': `${holder.holder} (${holder.url}). Questions go to ${holder.contact}.`,
  };
}

function renderSpan(document, span, file) {
  const start = document.indexOf(MARKER_START), end = document.indexOf(MARKER_END);
  if (start < 0 || end < 0 || end < start || document.indexOf(MARKER_START, start + 1) >= 0) throw new Error(`${file} must carry exactly one license-holder marker pair`);
  return `${document.slice(0, start + MARKER_START.length)}\n${span}\n${document.slice(end)}`;
}

/** Every rendered output as { relativePath: contents }. */
export function renderAll(root = ROOT) {
  const holder = loadHolder(root);
  const canonical = loadCanonical(root);
  const notice = renderNotice(holder);
  const sections = (file) => (THIRD_PARTY_SECTIONS[file] ?? []).map(source => `\n${fs.readFileSync(path.join(root, source), 'utf8')}`).join('');
  const outputs = Object.fromEntries([...LICENSE_FILES.map(file => [file, canonical.text]), ...NOTICE_FILES.map(file => [file, notice + sections(file)])]);
  for (const [file, span] of Object.entries(holderSpans(holder))) outputs[file] = renderSpan(fs.readFileSync(path.join(root, file), 'utf8'), span, file);
  return { holder, canonical, outputs };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  const { holder, canonical, outputs } = renderAll();
  const stale = Object.entries(outputs).filter(([file, contents]) => !fs.existsSync(path.join(ROOT, file)) || read(file) !== contents).map(([file]) => file);
  if (check) {
    if (stale.length) { console.error(`license render is stale: ${stale.join(', ')} (run node scripts/license/render-license.mjs)`); process.exitCode = 1; }
    else console.log(`license render is fresh: ${Object.keys(outputs).length} files carry ${holder.holder} over ${SPDX_ID} (canonical sha256 ${canonical.sha256.slice(0, 12)}…)`);
  } else {
    for (const [file, contents] of Object.entries(outputs)) fs.writeFileSync(path.join(ROOT, file), contents);
    console.log(`rendered ${Object.keys(outputs).length} files for ${holder.holder}; ${stale.length} changed`);
  }
}
