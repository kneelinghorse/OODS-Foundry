#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { generateSpatialScaffold, type SpatialScaffoldOptions } from '@/viz/patterns/spatial-scaffold.js';
import { fileURLToPath } from 'node:url';

export function runVizSpatialScaffold(argv: string[] = process.argv.slice(2)): void {
  const { values } = parseArgs({
    args: argv,
    options: {
      help: { type: 'boolean', short: 'h' },
      type: { type: 'string' },
      geo: { type: 'string' },
      value: { type: 'string' },
      region: { type: 'string' },
      lat: { type: 'string' },
      lon: { type: 'string' },
      size: { type: 'string' },
      color: { type: 'string' },
    },
    strict: false,
  });

  if (values.help) {
    printHelp();
    return;
  }

  const type = normalizeType(values.type);
  const options: SpatialScaffoldOptions = {
    type,
    geoSource: typeof values.geo === 'string' ? values.geo : undefined,
    valueField: typeof values.value === 'string' ? values.value : undefined,
    regionField: typeof values.region === 'string' ? values.region : undefined,
    latField: typeof values.lat === 'string' ? values.lat : undefined,
    lonField: typeof values.lon === 'string' ? values.lon : undefined,
    sizeField: typeof values.size === 'string' ? values.size : undefined,
    colorField: typeof values.color === 'string' ? values.color : undefined,
  };

  const scaffold = generateSpatialScaffold(options);
  console.log('Spatial Scaffold (TypeScript)');
  console.log('============================');
  console.log(scaffold);
}

function normalizeType(input: unknown): SpatialScaffoldOptions['type'] {
  const normalized = typeof input === 'string' ? input.trim().toLowerCase() : '';
  return normalized === 'bubble' ? 'bubble' : 'choropleth';
}

function printHelp(): void {
  console.log(`Usage: pnpm viz:scaffold-spatial --type <choropleth|bubble> [options]

Examples:
  pnpm viz:scaffold-spatial --type choropleth --geo us-states --value sales
  pnpm viz:scaffold-spatial --type bubble --lat latitude --lon longitude --size population

Options:
  --type     choropleth|bubble (default: choropleth)
  --geo      Geo source identifier (e.g., us-states.topojson)
  --value    Value field used for color/size encoding
  --region   Region join key (for choropleth)
  --lat      Latitude field (for bubble)
  --lon      Longitude field (for bubble)
  --size     Size field (for bubble)
  --color    Color field (for bubble)
`);
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  runVizSpatialScaffold();
}
