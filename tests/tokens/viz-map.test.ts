import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it, beforeAll } from 'vitest';

const VIZ_MAP_FILE = path.resolve(process.cwd(), 'packages/tokens/src/tokens/viz-map.json');

interface DtcgToken {
  $type: string;
  $value: string | number;
  $description?: string;
}

interface TokenNode {
  [key: string]: TokenNode | DtcgToken;
}

function isDtcgToken(node: TokenNode | DtcgToken): node is DtcgToken {
  return '$type' in node && '$value' in node;
}

function collectTokens(
  node: TokenNode,
  path: string[] = []
): { path: string[]; token: DtcgToken }[] {
  const tokens: { path: string[]; token: DtcgToken }[] = [];

  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('$')) continue;

    const currentPath = [...path, key];

    if (isDtcgToken(value)) {
      tokens.push({ path: currentPath, token: value });
    } else {
      tokens.push(...collectTokens(value as TokenNode, currentPath));
    }
  }

  return tokens;
}

function isSemanticReference(value: string): boolean {
  return typeof value === 'string' && value.startsWith('{') && value.endsWith('}');
}

function isOklchColor(value: string): boolean {
  return typeof value === 'string' && value.startsWith('oklch(');
}

function isDimensionValue(value: string): boolean {
  return typeof value === 'string' && /^\d+(\.\d+)?(px|rem|em|%)$/.test(value);
}

describe('viz-map tokens', () => {
  let tokens: TokenNode;
  let allTokens: { path: string[]; token: DtcgToken }[];

  beforeAll(() => {
    tokens = JSON.parse(readFileSync(VIZ_MAP_FILE, 'utf-8'));
    allTokens = collectTokens(tokens);
  });

  describe('token structure', () => {
    it('has viz.map namespace', () => {
      expect(tokens.viz).toBeDefined();
      expect((tokens.viz as TokenNode).map).toBeDefined();
    });

    it('has viz.scale namespace', () => {
      expect(tokens.viz).toBeDefined();
      expect((tokens.viz as TokenNode).scale).toBeDefined();
    });

    it('has basemap tokens', () => {
      const mapTokens = (tokens.viz as TokenNode).map as TokenNode;
      expect(mapTokens.basemap).toBeDefined();
      expect((mapTokens.basemap as TokenNode).fill).toBeDefined();
      expect((mapTokens.basemap as TokenNode).stroke).toBeDefined();
      expect((mapTokens.basemap as TokenNode)['stroke-width']).toBeDefined();
    });

    it('has region tokens', () => {
      const mapTokens = (tokens.viz as TokenNode).map as TokenNode;
      expect(mapTokens.region).toBeDefined();
      expect((mapTokens.region as TokenNode).stroke).toBeDefined();
      expect((mapTokens.region as TokenNode)['stroke-width']).toBeDefined();
      expect((mapTokens.region as TokenNode)['hover-stroke']).toBeDefined();
      expect((mapTokens.region as TokenNode)['hover-stroke-width']).toBeDefined();
    });

    it('has symbol tokens', () => {
      const mapTokens = (tokens.viz as TokenNode).map as TokenNode;
      expect(mapTokens.symbol).toBeDefined();
      expect((mapTokens.symbol as TokenNode).stroke).toBeDefined();
      expect((mapTokens.symbol as TokenNode)['stroke-width']).toBeDefined();
      expect((mapTokens.symbol as TokenNode)['min-radius']).toBeDefined();
      expect((mapTokens.symbol as TokenNode)['max-radius']).toBeDefined();
    });

    it('has route tokens', () => {
      const mapTokens = (tokens.viz as TokenNode).map as TokenNode;
      expect(mapTokens.route).toBeDefined();
      expect((mapTokens.route as TokenNode)['stroke-opacity']).toBeDefined();
      expect((mapTokens.route as TokenNode)['min-width']).toBeDefined();
      expect((mapTokens.route as TokenNode)['max-width']).toBeDefined();
    });
  });

  describe('sequential color scales', () => {
    it('has blue sequential scale with 7 steps', () => {
      const scaleTokens = (tokens.viz as TokenNode).scale as TokenNode;
      const sequential = scaleTokens.sequential as TokenNode;
      const blue = sequential.blue as TokenNode;

      expect(blue).toBeDefined();
      expect(Object.keys(blue).filter((k) => !k.startsWith('$'))).toHaveLength(7);
    });

    it('has green sequential scale with 7 steps', () => {
      const scaleTokens = (tokens.viz as TokenNode).scale as TokenNode;
      const sequential = scaleTokens.sequential as TokenNode;
      const green = sequential.green as TokenNode;

      expect(green).toBeDefined();
      expect(Object.keys(green).filter((k) => !k.startsWith('$'))).toHaveLength(7);
    });

    it('has orange sequential scale with 7 steps', () => {
      const scaleTokens = (tokens.viz as TokenNode).scale as TokenNode;
      const sequential = scaleTokens.sequential as TokenNode;
      const orange = sequential.orange as TokenNode;

      expect(orange).toBeDefined();
      expect(Object.keys(orange).filter((k) => !k.startsWith('$'))).toHaveLength(7);
    });
  });

  describe('diverging color scales', () => {
    it('has blue-orange diverging scale', () => {
      const scaleTokens = (tokens.viz as TokenNode).scale as TokenNode;
      const diverging = scaleTokens.diverging as TokenNode;

      expect(diverging['blue-orange']).toBeDefined();
    });

    it('has red-green diverging scale', () => {
      const scaleTokens = (tokens.viz as TokenNode).scale as TokenNode;
      const diverging = scaleTokens.diverging as TokenNode;

      expect(diverging['red-green']).toBeDefined();
    });

    it('has neutral midpoint in diverging scales', () => {
      const scaleTokens = (tokens.viz as TokenNode).scale as TokenNode;
      const diverging = scaleTokens.diverging as TokenNode;

      const blueOrange = diverging['blue-orange'] as TokenNode;
      expect(blueOrange.neutral).toBeDefined();

      const redGreen = diverging['red-green'] as TokenNode;
      expect(redGreen.neutral).toBeDefined();
    });
  });

  describe('DTCG format compliance', () => {
    it('all tokens have $type field', () => {
      for (const { path, token } of allTokens) {
        expect(token.$type, `Token ${path.join('.')} missing $type`).toBeDefined();
      }
    });

    it('all tokens have $value field', () => {
      for (const { path, token } of allTokens) {
        expect(token.$value, `Token ${path.join('.')} missing $value`).toBeDefined();
      }
    });

    it('all tokens have $description field', () => {
      for (const { path, token } of allTokens) {
        expect(token.$description, `Token ${path.join('.')} missing $description`).toBeDefined();
        expect(token.$description?.length, `Token ${path.join('.')} has empty $description`).toBeGreaterThan(0);
      }
    });

    it('color tokens have valid color type', () => {
      const colorTokens = allTokens.filter(({ token }) => token.$type === 'color');

      expect(colorTokens.length).toBeGreaterThan(0);

      for (const { path, token } of colorTokens) {
        const value = token.$value as string;
        const isValid = isSemanticReference(value) || isOklchColor(value);
        expect(isValid, `Token ${path.join('.')} has invalid color value: ${value}`).toBe(true);
      }
    });

    it('dimension tokens have valid dimension type', () => {
      const dimensionTokens = allTokens.filter(({ token }) => token.$type === 'dimension');

      expect(dimensionTokens.length).toBeGreaterThan(0);

      for (const { path, token } of dimensionTokens) {
        const value = token.$value as string;
        expect(isDimensionValue(value), `Token ${path.join('.')} has invalid dimension value: ${value}`).toBe(true);
      }
    });

    it('number tokens have valid number type', () => {
      const numberTokens = allTokens.filter(({ token }) => token.$type === 'number');

      for (const { path, token } of numberTokens) {
        expect(typeof token.$value, `Token ${path.join('.')} has invalid number value`).toBe('number');
      }
    });
  });

  describe('semantic reference validation', () => {
    it('basemap fill uses semantic neutral reference', () => {
      const mapTokens = (tokens.viz as TokenNode).map as TokenNode;
      const basemap = mapTokens.basemap as TokenNode;
      const fill = basemap.fill as DtcgToken;

      expect(isSemanticReference(fill.$value as string)).toBe(true);
      expect(fill.$value).toContain('neutral');
    });

    it('basemap stroke uses semantic neutral reference', () => {
      const mapTokens = (tokens.viz as TokenNode).map as TokenNode;
      const basemap = mapTokens.basemap as TokenNode;
      const stroke = basemap.stroke as DtcgToken;

      expect(isSemanticReference(stroke.$value as string)).toBe(true);
      expect(stroke.$value).toContain('neutral');
    });

    it('region hover stroke uses semantic primary reference', () => {
      const mapTokens = (tokens.viz as TokenNode).map as TokenNode;
      const region = mapTokens.region as TokenNode;
      const hoverStroke = region['hover-stroke'] as DtcgToken;

      expect(isSemanticReference(hoverStroke.$value as string)).toBe(true);
      expect(hoverStroke.$value).toContain('primary');
    });

    it('symbol stroke uses semantic neutral reference', () => {
      const mapTokens = (tokens.viz as TokenNode).map as TokenNode;
      const symbol = mapTokens.symbol as TokenNode;
      const stroke = symbol.stroke as DtcgToken;

      expect(isSemanticReference(stroke.$value as string)).toBe(true);
      expect(stroke.$value).toContain('neutral');
    });
  });

  describe('no direct color literals', () => {
    it('map tokens do not contain hex color values', () => {
      const mapTokenPaths = allTokens.filter(({ path }) => path[0] === 'viz' && path[1] === 'map');

      for (const { path, token } of mapTokenPaths) {
        if (token.$type === 'color') {
          const value = token.$value as string;
          expect(value.startsWith('#'), `Token ${path.join('.')} uses hex literal: ${value}`).toBe(false);
          expect(value.startsWith('rgb'), `Token ${path.join('.')} uses rgb literal: ${value}`).toBe(false);
          expect(value.startsWith('hsl'), `Token ${path.join('.')} uses hsl literal: ${value}`).toBe(false);
        }
      }
    });
  });

  describe('scale color progression', () => {
    it('sequential blue scale has increasing chroma/lightness progression', () => {
      const scaleTokens = (tokens.viz as TokenNode).scale as TokenNode;
      const sequential = scaleTokens.sequential as TokenNode;
      const blue = sequential.blue as TokenNode;

      const steps = Object.entries(blue)
        .filter(([key]) => !key.startsWith('$'))
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([, token]) => token as DtcgToken);

      // Extract lightness values from oklch
      const lightnesses: number[] = [];
      for (const step of steps) {
        const match = (step.$value as string).match(/oklch\(([\d.]+)/);
        if (match) {
          lightnesses.push(parseFloat(match[1]));
        }
      }

      // Should have decreasing lightness (lighter to darker)
      expect(lightnesses.length).toBe(7);
      for (let i = 1; i < lightnesses.length; i++) {
        expect(
          lightnesses[i],
          `Step ${i + 1} should be darker than step ${i}`
        ).toBeLessThan(lightnesses[i - 1]);
      }
    });

    it('diverging scale has symmetric structure', () => {
      const scaleTokens = (tokens.viz as TokenNode).scale as TokenNode;
      const diverging = scaleTokens.diverging as TokenNode;
      const blueOrange = diverging['blue-orange'] as TokenNode;

      const keys = Object.keys(blueOrange).filter((k) => !k.startsWith('$'));

      // Should have negative, neutral, and positive
      expect(keys.some((k) => k.includes('negative'))).toBe(true);
      expect(keys.some((k) => k === 'neutral')).toBe(true);
      expect(keys.some((k) => k.includes('positive'))).toBe(true);
    });
  });
});
