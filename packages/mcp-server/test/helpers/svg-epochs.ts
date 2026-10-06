/** Deliberate changes after the s213 chart epoch, undone exactly: #2411 (s216-m04, 8edb5e4b9) escaped root
 *  role/name/description + <title>/<desc>; #2416 (s217, 87b5f94f8) and #2425 (s218-m01, cfe37cde1) dashboard export CSS
 *  and the computed KPI sparkline. (Font quoting needs no undo: typography.json was fixed at the source in s221-m01.) */
export const withoutSvgMetadata = (t: string) => t.replace(/ role="img" aria-label="[^"]*" aria-description="[^"]*"><title>[^<]*<\/title><desc>[^<]*<\/desc>/g, '>');
export const beforeSprint216Svg = (svg: string) => withoutSvgMetadata(svg);
const DASHBOARD_RULES_SINCE_S213 = ['body{margin:0;background:var(--oods-color-bg,#ffffff)}',
  '@media(max-width:600px){.oods-dashboard-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.oods-dashboard-grid>.oods-panel{grid-column:1/-1!important;grid-row:auto!important;min-width:0;margin:0}.oods-dashboard-grid>.oods-kpi{grid-column:auto!important}}',
  '.oods-dashboard-links{grid-column:1/-1;font-size:13px}.oods-dashboard-links h2{font-size:16px}',
  '.oods-kpi-sparkline{display:block;width:100%;max-width:200px;height:48px;color:var(--oods-color-accent)}',
  '.oods-kpi-breach,.oods-kpi-anomaly{color:var(--oods-color-negative);font-size:13px;margin:4px 0}'];
export const beforeSprint216Dashboard = (html: string) => DASHBOARD_RULES_SINCE_S213.reduce((o, r) => o.replace(r, ''), beforeSprint216Svg(html)).replace(/<svg class="oods-kpi-sparkline"[\s\S]*?<\/svg>/g, '');
/** s221-m03 (#2482 ruling 13): OODS points are filled and lines 2.5px wide by default, and a chart that encodes size draws
 *  its size legend's symbols in the neutral text colour. That moves a Vega render's series mark groups and legend symbols,
 *  and the geometry fitted around them, and nothing else: with those groups set aside and every number normalised (a
 *  colour's hex digits protected first, so a colour change still shows), the two renders are identical. A filled point
 *  carries its colour as fill, so Vega's description of a point legend says "fill color" where it said "stroke color";
 *  that phrase is the one word the comparison sets aside. */
const SERIES_MARK_GROUPS = ['mark-line role-mark', 'mark-symbol role-mark', 'mark-symbol role-legend-symbol'];
export function withoutSeriesMarks(svg: string): string {
  let out = svg;
  for (const name of SERIES_MARK_GROUPS) {
    for (;;) {
      const start = out.indexOf(`<g class="${name}`);
      if (start < 0) break;
      let depth = 0, at = start, end = -1;
      while (at < out.length) {
        const open = out.indexOf('<g', at), close = out.indexOf('</g>', at);
        if (close < 0) break;
        if (open >= 0 && open < close) { depth += 1; at = open + 2; continue; }
        depth -= 1; at = close + 4;
        if (depth === 0) { end = at; break; }
      }
      if (end < 0) throw new Error(`unbalanced ${name} group`);
      out = out.slice(0, start) + `<!--${name}-->` + out.slice(end);
    }
  }
  return out;
}
const seriesMarkShape = (svg: string) => withoutSeriesMarks(svg)
  .replace(/(aria-label="Symbol legend titled '[^']*' for )(?:stroke|fill) color/g, '$1color')
  .replace(/#[0-9A-Fa-f]{3,8}\b/g, hex => hex.toUpperCase().replace(/\d/g, digit => String.fromCharCode(0x2460 + Number(digit))))
  .replace(/-?\d+(?:\.\d+)?(?:e-?\d+)?/g, 'N');
/** True when two renders differ, and only in their series marks, legend symbols and fitted geometry (s221-m03). */
export const onlySeriesMarksMoved = (before: string, after: string) => before !== after && seriesMarkShape(before) === seriesMarkShape(after);
