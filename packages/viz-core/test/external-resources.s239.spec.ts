import { describe, expect, it } from 'vitest';
import {
  assertNormalizedVizSpec,
  EXTERNAL_RESOURCE_KEYWORD,
  externalOperandErrors,
  isNormalizedVizSpec,
  NormalizedVizSpecError,
  toVegaLiteSpec,
  validateNormalizedVizSpec,
  type NormalizedVizSpec,
} from '@oods/viz-core';

// s239 (audit F-03): the schema still describes DataSource.url, but the renderer's
// default Vega loader would fetch it (http) or read it (file://), and a viewer showing a
// chart loads every image and follows every link the output names. A chart renders only
// the data it carries, so chart input may name no URL, file, image or link: the
// assertion every chart handler calls refuses each such field by name, and the same walk
// covers the data operands whose node and link fields become ECharts options. Free-form
// blocks reach the renderers unchanged, which is why nested positions are covered too.

function spec(extra: Record<string, unknown> = {}): NormalizedVizSpec {
  return {
    data: { values: [{ k: 'a', v: 3 }, { k: 'b', v: 5 }] },
    marks: [{ trait: 'MarkBar' }],
    encoding: {
      x: { field: 'k', trait: 'EncodingPositionX', channel: 'x' },
      y: { field: 'v', trait: 'EncodingPositionY', channel: 'y' },
    },
    a11y: { description: 'Bars of v by k.' },
    ...extra,
  } as NormalizedVizSpec;
}

function refusal(input: unknown): NormalizedVizSpecError {
  try {
    assertNormalizedVizSpec(input);
  } catch (error) {
    expect(error).toBeInstanceOf(NormalizedVizSpecError);
    return error as NormalizedVizSpecError;
  }
  throw new Error('expected the spec to be refused');
}

const refusedPaths = (errors: readonly { keyword: string; path: string }[]): string[] =>
  errors.filter((entry) => entry.keyword === EXTERNAL_RESOURCE_KEYWORD).map((entry) => entry.path);

const INLINE = 'OODS Foundry renders charts from inline data only, so chart input cannot name a URL, file, image or link.';
const HTTP = 'http://127.0.0.1:9/x.png';
// An inline data: URI fetches nothing, but it is still an image or link a viewer would
// load or open, it can carry its own external references, and no chart needs one: refused.
const DATA_URI = 'data:image/svg+xml;base64,PHN2Zy8+';

describe('assertNormalizedVizSpec refuses resources a renderer would load (s239)', () => {
  it.each([
    ['an http url', 'http://127.0.0.1:9/rows.json'],
    ['a file:// url', 'file:///etc/hosts'],
    ['a bare path the schema already rejects as a uri', '/etc/hosts'],
  ])('data.url as %s: names the field and says to pass the rows inline', (_label, url) => {
    const error = refusal(spec({ data: { url } }));
    expect(error.message).toBe(`data.url is not accepted: ${INLINE} Pass the rows inline as data.values instead.`);
    expect(error.errors).toContainEqual({ path: '/data/url', keyword: EXTERNAL_RESOURCE_KEYWORD, message: error.message });
  });

  it('refuses a lookup data url inside transform params, which reach Vega-Lite verbatim', () => {
    const lookup = { lookup: 'k', from: { data: { url: 'http://127.0.0.1:9/lookup.json' }, key: 'k', fields: ['w'] } };
    const error = refusal(spec({ transforms: [{ type: 'filter', params: lookup }] }));
    expect(error.message).toBe(`transforms[0].params.from.data.url is not accepted: ${INLINE} Pass the rows inline as transforms[0].params.from.data.values instead.`);
  });

  it('refuses image sources and links in mark options and mark config, literal or expression', () => {
    const marks = [{ trait: 'MarkBar', options: { type: 'image', url: { expr: 'datum.k' }, href: 'javascript:alert(1)', link: 'https://example.test/' } }];
    const error = refusal(spec({ marks, config: { mark: { url: HTTP, href: 'http://127.0.0.1:9/', sublink: 'https://example.test/' } } }));
    expect(refusedPaths(error.errors)).toEqual([
      '/marks/0/options/url', '/marks/0/options/href', '/marks/0/options/link', '/config/mark/url', '/config/mark/href', '/config/mark/sublink',
    ]);
    expect(error.message).toContain(`marks[0].options.url is not accepted: ${INLINE} Remove it.`);
    expect(error.message).toContain(`config.mark.sublink is not accepted: ${INLINE} Remove it.`);
  });

  it('refuses ECharts image sources, image symbols and external url() paints in passthrough options', () => {
    const options = {
      itemStyle: { color: { image: DATA_URI, repeat: 'repeat' }, decal: { symbol: `image://${HTTP}` } },
      areaStyle: { color: { image: HTTP } },
      symbol: `IMAGE://${HTTP}`,
      fill: `url(${HTTP})`,
      cursor: `url( "file:///tmp/c.cur" ), auto`,
    };
    const error = refusal(spec({ marks: [{ trait: 'MarkBar', options }], encoding: { ...spec().encoding, color: { field: 'k', trait: 'EncodingColor', range: [`url('${DATA_URI}')`, '#123456'] } } }));
    expect(refusedPaths(error.errors)).toEqual([
      '/marks/0/options/itemStyle/color/image', '/marks/0/options/itemStyle/decal/symbol', '/marks/0/options/areaStyle/color/image',
      '/marks/0/options/symbol', '/marks/0/options/fill', '/marks/0/options/cursor', '/encoding/color/range/0',
    ]);
    expect(error.message).toContain(`encoding.color.range[0] is not accepted: ${INLINE} Remove it.`);
  });

  it('accepts what draws nothing from outside: local url(#id) paints, path:// symbols, and text that mentions url()', () => {
    const options = { fill: 'url(#oods-gradient)', stroke: "url( '#edge' )", symbol: 'path://M0,0L10,0L5,8Z', cursor: 'pointer' };
    const named = spec({ marks: [{ trait: 'MarkBar', options }], name: 'Where url(x) appears', a11y: { description: 'Counts of url(x), var(--y) and image://z in style sheets.' } });
    expect(validateNormalizedVizSpec(named)).toEqual({ valid: true, errors: [] });
  });

  it('validate, is and assert agree, so no caller can take a refused spec for a valid one', () => {
    const refused = spec({ data: { url: 'https://example.test/rows.json' } });
    expect(validateNormalizedVizSpec(refused).valid).toBe(false);
    expect(isNormalizedVizSpec(refused)).toBe(false);
  });

  it('accepts inline rows whose fields are named url, href, link or image: rows are data, never addresses', () => {
    const rows = [{ k: 'a', v: 3, url: 'https://example.test/a', href: '/a', link: 'javascript:void 0', image: `url(${HTTP})` }];
    const withRows = spec({
      data: { values: rows },
      datasets: { links: [{ href: 'https://example.test/b' }] },
      transforms: [{ type: 'filter', params: { lookup: 'k', from: { data: { values: [{ k: 'a', url: 'x' }] }, key: 'k', fields: ['url'] } } }],
    });
    expect(validateNormalizedVizSpec(withRows)).toEqual({ valid: true, errors: [] });
    expect(toVegaLiteSpec(assertNormalizedVizSpec(withRows))).toMatchObject({ data: { values: rows } });
  });

  it('keeps the existing message for schema failures that name no resource', () => {
    expect(refusal({ ...spec(), a11y: { description: '' } }).message).toBe('Normalized Viz Spec validation failed');
  });
});

describe('externalOperandErrors refuses the same fields in chart data operands (s239)', () => {
  // Node and link fields are copied into ECharts data items, where ECharts reads them as
  // options: a label background, a pattern fill, an image symbol or a treemap link there is
  // drawn or followed by whoever views the chart.
  it('names each refused field from the root of the caller input, at any depth', () => {
    const hierarchy = {
      type: 'nested',
      data: {
        name: 'Total',
        children: [
          { name: 'Alpha', value: 4, label: { show: true, formatter: '{a|x}', rich: { a: { backgroundColor: { image: HTTP } } } } },
          { name: 'Beta', value: 3, link: 'javascript:alert(1)', children: [{ name: 'Leaf', value: 3, itemStyle: { color: { image: DATA_URI } } }] },
        ],
      },
    };
    const errors = externalOperandErrors(['hierarchy'], hierarchy);
    expect(refusedPaths(errors)).toEqual([
      '/hierarchy/data/children/0/label/rich/a/backgroundColor/image',
      '/hierarchy/data/children/1/link',
      '/hierarchy/data/children/1/children/0/itemStyle/color/image',
    ]);
    expect(errors[0].message).toBe(`hierarchy.data.children[0].label.rich.a.backgroundColor.image is not accepted: ${INLINE} Remove it.`);
    expect(refusedPaths(externalOperandErrors(['data', 'hierarchy'], hierarchy))[1]).toBe('/data/hierarchy/data/children/1/link');
  });

  it('refuses a node color that is an external url() paint, a link pattern, an image symbol and an item tooltip', () => {
    const sankey = { nodes: [{ name: 'A', color: `url(${HTTP})` }, { name: 'B' }], links: [{ source: 'A', target: 'B', value: 1, lineStyle: { color: { image: HTTP } } }] };
    expect(refusedPaths(externalOperandErrors(['sankey'], sankey))).toEqual(['/sankey/nodes/0/color', '/sankey/links/0/lineStyle/color/image']);
    const network = { nodes: [{ id: 'a', symbol: `image://${HTTP}`, tooltip: { formatter: `<img src="${HTTP}">` } }, { id: 'b' }], links: [{ source: 'a', target: 'b' }] };
    const errors = externalOperandErrors(['network'], network);
    expect(refusedPaths(errors)).toEqual(['/network/nodes/0/symbol', '/network/nodes/0/tooltip']);
    expect(errors[1].message).toBe("network.nodes[0].tooltip is not accepted: an item tooltip is rendered as HTML, which can load images and follow links, and OODS Foundry builds every chart's tooltip itself. Remove it.");
  });

  it('leaves geo rows and inline geometry alone: ECharts reads neither as options', () => {
    const geo = {
      geojson: { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { name: 'CA', url: 'https://example.test/ca' }, geometry: { type: 'Point', coordinates: [0, 0] } }] },
      rows: [{ state: 'CA', sales: 5, link: 'https://example.test/', image: `image://${HTTP}` }],
      valueField: 'sales',
    };
    expect(externalOperandErrors(['geo'], geo)).toEqual([]);
    expect(refusedPaths(externalOperandErrors(['geo'], { ...geo, join: { dataKey: 'state', featureProperty: 'name', image: HTTP } }))).toEqual(['/geo/join/image']);
  });

  it('accepts a styled operand that names nothing outside the chart', () => {
    const styled = { nodes: [{ name: 'A', color: '#0055aa', itemStyle: { borderColor: 'url(#ring)' }, label: { formatter: '{b}' } }, { name: 'B' }], links: [{ source: 'A', target: 'B', value: 2 }] };
    expect(externalOperandErrors(['sankey'], styled)).toEqual([]);
  });
});
