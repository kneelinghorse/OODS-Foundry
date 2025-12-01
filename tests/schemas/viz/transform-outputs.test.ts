import { readFileSync } from 'node:fs';
import path from 'node:path';

import Ajv from 'ajv';
import { beforeAll, describe, expect, it } from 'vitest';

const SCHEMA_ROOT = path.resolve(process.cwd(), 'schemas/viz');

describe('Transform output schemas', () => {
  let treemap: ReturnType<Ajv['compile']>;
  let sunburst: ReturnType<Ajv['compile']>;
  let force: ReturnType<Ajv['compile']>;
  let sankey: ReturnType<Ajv['compile']>;

  beforeAll(() => {
    const ajv = new Ajv({ strict: false, allErrors: true });
    treemap = ajv.compile(loadSchema('treemap-output.schema.json'));
    sunburst = ajv.compile(loadSchema('sunburst-output.schema.json'));
    force = ajv.compile(loadSchema('force-output.schema.json'));
    sankey = ajv.compile(loadSchema('sankey-output.schema.json'));
  });

  it('validates treemap output structures', () => {
    const output = {
      nodes: [
        {
          id: 'root',
          x0: 0,
          y0: 0,
          x1: 800,
          y1: 600,
          depth: 0,
          value: 100,
          label: 'Root',
        },
      ],
    };

    expect(treemap(output)).toBe(true);
  });

  it('validates sunburst output structures', () => {
    const output = {
      nodes: [
        {
          id: 'root',
          startAngle: 0,
          endAngle: Math.PI * 2,
          innerRadius: 0,
          outerRadius: 120,
          depth: 0,
          value: 100,
        },
      ],
    };

    expect(sunburst(output)).toBe(true);
  });

  it('validates force layout outputs', () => {
    const output = {
      nodes: [
        { id: 'a', x: 100.5, y: 200.25 },
        { id: 'b', x: 180.75, y: 260.0 },
      ],
      links: [
        {
          source: 'a',
          target: 'b',
          x1: 100.5,
          y1: 200.25,
          x2: 180.75,
          y2: 260.0,
        },
      ],
    };

    expect(force(output)).toBe(true);
  });

  it('validates sankey outputs including SVG path', () => {
    const output = {
      nodes: [
        { name: 'Coal', x0: 0, y0: 0, x1: 12, y1: 100, value: 100 },
        { name: 'Electricity', x0: 24, y0: 20, x1: 36, y1: 120, value: 100 },
      ],
      links: [
        {
          source: 'Coal',
          target: 'Electricity',
          value: 100,
          width: 50,
          y0: 40,
          y1: 60,
          svgPath: 'M0,40 C50,40 50,60 100,60',
        },
      ],
    };

    expect(sankey(output)).toBe(true);
  });
});

function loadSchema(fileName: string): unknown {
  const raw = readFileSync(path.join(SCHEMA_ROOT, fileName), 'utf-8');
  return JSON.parse(raw);
}
