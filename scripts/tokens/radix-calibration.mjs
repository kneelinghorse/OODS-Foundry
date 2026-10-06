#!/usr/bin/env node
/**
 * s222-m01 (#2502 ruling 2): write the Radix Colors calibration table the palette recipe reads.
 *
 *   node scripts/tokens/radix-calibration.mjs <unpacked @radix-ui/colors package folder>
 *
 * The table holds, for every Radix Colors hue family, the OKLCH lightness, chroma and hue of its 12 light and 12 dark
 * steps. packages/tokens/src/palette/recipe.mjs interpolates it by hue, so any accent or status hue gets steps with
 * Radix's jobs, and a Radix hue gets Radix's own values. Radix Colors is MIT licensed; its notice ships in NOTICE
 * (configs/license/third-party/radix-colors.txt). The package is read from a folder, never installed.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUTPUT = path.join(ROOT, 'packages/tokens/src/palette/radix-calibration.json');
/** Hue families with a chromatic step 9. The six greys and the three earth tones (bronze, gold, brown) are left out. */
export const CHROMATIC = ['tomato', 'red', 'ruby', 'crimson', 'pink', 'plum', 'purple', 'violet', 'iris', 'indigo', 'blue',
  'cyan', 'teal', 'jade', 'green', 'grass', 'orange', 'amber', 'yellow', 'lime', 'mint', 'sky'];

/** sRGB hex to OKLCH, with the standard OKLab matrices (the same ones recipe.mjs inverts). */
export function hexToOklch(hex) {
  const channel = (i) => {
    const v = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = [0, 1, 2].map(channel);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const C = Math.hypot(A, B);
  const H = C < 1e-4 ? 0 : (Math.atan2(B, A) * 180 / Math.PI + 360) % 360;
  const round = (value) => Number(value.toFixed(5));
  return [round(L), round(C), Number(H.toFixed(3))];
}

function main() {
  const folder = process.argv[2];
  if (!folder) throw new Error('usage: node scripts/tokens/radix-calibration.mjs <unpacked @radix-ui/colors package folder>');
  const manifest = JSON.parse(fs.readFileSync(path.join(folder, 'package.json'), 'utf8'));
  if (manifest.name !== '@radix-ui/colors') throw new Error(`${folder} is ${manifest.name}, not @radix-ui/colors`);
  const radix = createRequire(import.meta.url)(path.resolve(folder, 'index.js'));
  const scale = (name) => Object.values(radix[name]).map(hexToOklch);
  const families = Object.fromEntries(CHROMATIC.map((name) => [name, { light: scale(name), dark: scale(`${name}Dark`) }]));
  const table = {
    source: `@radix-ui/colors ${manifest.version} (MIT, Copyright (c) 2021 Radix)`,
    license: fs.readFileSync(path.join(folder, 'LICENSE'), 'utf8').split('\n')[0],
    indexSha256: createHash('sha256').update(fs.readFileSync(path.join(folder, 'index.js'))).digest('hex'),
    format: 'Each step is [OKLCH lightness, chroma, hue]; light and dark hold steps 1-12 in order.',
    families,
  };
  fs.writeFileSync(OUTPUT, `${JSON.stringify(table, null, 1)}\n`);
  console.log(`wrote ${path.relative(ROOT, OUTPUT)}: ${CHROMATIC.length} families from ${table.source}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
