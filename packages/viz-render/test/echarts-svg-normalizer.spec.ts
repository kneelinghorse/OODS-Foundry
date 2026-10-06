import { describe, expect, it } from "vitest";
import { createFirstAppearanceRemap } from "../src/first-appearance-remap.js";
import {
  discoverEChartsStructuralTokens,
  normalizeEChartsSvg,
} from "../src/echarts-svg-normalizer.js";

const RICH_CARRIER = `<svg aria-label="zr41-cls-9 author label">
  <title>zr41-ani-7 author text</title>
  <defs>
    <style><![CDATA[
      /* .zr41-s5 { fill:url(#zr41-g3); } */
      .zr41-cls-9:hover, #zr41-g3 {
        animation:zr41-ani-7 1s linear both;
        fill:url(#zr41-g3);
        stroke:url('#zr41-p4');
        filter:url(#zr41-s5);
      }
      @keyframes zr41-ani-7 { from { opacity:0; } to { opacity:1; } }
      .author::after { content:"zr41-c2"; }
    ]]></style>
    <linearGradient id="zr41-g3"><stop offset="1" /></linearGradient>
    <filter id="zr41-s5"><feDropShadow /></filter>
    <pattern id='zr41-p4'><rect /></pattern>
    <clipPath id="zr41-c2"><rect /></clipPath>
  </defs>
  <path
    id="author-id"
    class="author zr41-cls-9"
    fill="url(#zr41-g3)"
    stroke="url('#zr41-p4')"
    filter="url(#zr41-s5)"
    clip-path="url(#zr41-c2)"
    style="animation-name:zr41-ani-7;fill:url(#zr41-g3)"
    aria-description="zr41-g3"
    ecmeta_data_name="zr41-s5"
    data-author="zr41-p4"
    d="M0 0 zr41-c2"
    transform="translate(zr41-cls-9)"
  />
  <g id="zr41-cls-9-suffix" class="zr41-cls-9-suffix" />
  <text>zr41-cls-9</text>
</svg>`;

describe("createFirstAppearanceRemap", () => {
  it("assigns one replacement per token in first-appearance order", () => {
    const remap = createFirstAppearanceRemap(
      ["late-counter", "early-counter", "late-counter", "third-counter"],
      (index) => `stable-${index}`,
    );

    expect([...remap]).toEqual([
      ["late-counter", "stable-0"],
      ["early-counter", "stable-1"],
      ["third-counter", "stable-2"],
    ]);
  });
});

describe("normalizeEChartsSvg", () => {
  it("uses one first-appearance map for rich cls/ani/s/g/p/c definitions and references", () => {
    expect(discoverEChartsStructuralTokens(RICH_CARRIER)).toEqual([
      "zr41-cls-9",
      "zr41-g3",
      "zr41-ani-7",
      "zr41-p4",
      "zr41-s5",
      "zr41-c2",
    ]);

    const normalized = normalizeEChartsSvg(RICH_CARRIER);
    expect(normalized).toContain(".oods-zr-0:hover, #oods-zr-1");
    expect(normalized).toContain("animation:oods-zr-2 1s linear both");
    expect(normalized).toContain("@keyframes oods-zr-2");
    expect(normalized).toContain('id="oods-zr-1"');
    expect(normalized).toContain('id="oods-zr-4"');
    expect(normalized).toContain("id='oods-zr-3'");
    expect(normalized).toContain('id="oods-zr-5"');
    expect(normalized).toContain('class="author oods-zr-0"');
    expect(normalized).toContain('fill="url(#oods-zr-1)"');
    expect(normalized).toContain("stroke=\"url('#oods-zr-3')\"");
    expect(normalized).toContain('filter="url(#oods-zr-4)"');
    expect(normalized).toContain('clip-path="url(#oods-zr-5)"');
    expect(normalized).toContain(
      'style="animation-name:oods-zr-2;fill:url(#oods-zr-1)"',
    );
  });

  it.each([
    [
      "cls",
      '<path class="zr8-cls-2"/><style>.zr8-cls-2:hover{opacity:1}</style>',
    ],
    ["ani", "<style>.x{animation:zr8-ani-2 1s}@keyframes zr8-ani-2{}</style>"],
    ["s", '<filter id="zr8-s2"/><path filter="url(#zr8-s2)"/>'],
    ["g", '<linearGradient id="zr8-g2"/><path fill="url(#zr8-g2)"/>'],
    ["p", '<pattern id="zr8-p2"/><path stroke="url(#zr8-p2)"/>'],
    ["c", '<clipPath id="zr8-c2"/><path clip-path="url(#zr8-c2)"/>'],
  ])("keeps the %s definition-reference pair linked", (_kind, carrier) => {
    const normalized = normalizeEChartsSvg(`<svg>${carrier}</svg>`);
    expect(normalized.match(/oods-zr-0/g)).toHaveLength(2);
    expect(normalized).not.toContain("zr8-");
  });

  it("does not rewrite token lookalikes outside admitted structural contexts", () => {
    const normalized = normalizeEChartsSvg(RICH_CARRIER);

    expect(normalized).toContain('aria-label="zr41-cls-9 author label"');
    expect(normalized).toContain("<title>zr41-ani-7 author text</title>");
    expect(normalized).toContain("/* .zr41-s5 { fill:url(#zr41-g3); } */");
    expect(normalized).toContain('content:"zr41-c2"');
    expect(normalized).toContain('aria-description="zr41-g3"');
    expect(normalized).toContain('ecmeta_data_name="zr41-s5"');
    expect(normalized).toContain('data-author="zr41-p4"');
    expect(normalized).toContain('d="M0 0 zr41-c2"');
    expect(normalized).toContain('transform="translate(zr41-cls-9)"');
    expect(normalized).toContain('id="zr41-cls-9-suffix"');
    expect(normalized).toContain('class="zr41-cls-9-suffix"');
    expect(normalized).toContain("<text>zr41-cls-9</text>");
    expect(normalized).toContain('id="author-id"');
  });

  it("is idempotent and preserves an SVG with no structural tokens byte-for-byte", () => {
    const once = normalizeEChartsSvg(RICH_CARRIER);
    expect(normalizeEChartsSvg(once)).toBe(once);

    const authored = '<svg><text aria-label="zr7-cls-2">zr7-g4</text></svg>';
    expect(normalizeEChartsSvg(authored)).toBe(authored);
  });
});
