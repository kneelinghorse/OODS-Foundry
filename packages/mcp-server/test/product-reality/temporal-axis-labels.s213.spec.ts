/**
 * s213-m01: a date axis names the month on every day tick.
 *
 * Found looking at m01's own screens (learning #722): the Subscription payment chart's wide render (finding 5) labelled
 * its ticks "Tue 02, Wed 10 … Sat 04", while the design render beside it read "Jun 07 … Aug 30". Vega's default date
 * format prints a weekday and a day for a tick that falls on no week or month start, and a wider axis carries more,
 * finer ticks, so the month disappeared exactly where the chart grew. Usage's placed line chart, over a short span, had
 * read "Mon 16, Tue 17 …" at every size since Sprint 202. A reader cannot tell which month "Tue 02" is.
 *
 * The rule is at the producer, the Vega-Lite adapter: a raw date axis keeps Vega's own format for every tick except
 * the day tick, which reads month and day, as a week tick already does. A binned axis (timeUnit) keeps its own format.
 */
import { describe, expect, it } from 'vitest';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as render } from '../../src/tools/viz.render.js';
import { placedChartRequests } from '../../src/codegen/chart-assets.js';
import { shownSampleRecord, workflowSampleRecords } from '../../src/codegen/workflow-data-emitter.js';
import { seedSchema } from '../../src/compose/workflow-assembler.js';

const WEEKDAY_TICK = /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d{2}$/;
/** The x-axis tick labels Vega shows, in order: its overlap rule draws a hidden label at opacity 0, never read. */
function xAxisLabels(svg: string): string[] {
  const axis = svg.split('<g class="mark-group role-axis"').find(part => part.includes('aria-label="X-axis')) ?? '';
  const labels = /class="mark-text role-axis-label"[^>]*>([\s\S]*?)<\/g>/.exec(axis)?.[1] ?? '';
  return [...labels.matchAll(/<text\b([^>]*)>([^<]*)<\/text>/g)].filter(match => !/opacity="0"/.test(match[1]!)).map(match => match[2]!);
}

describe('a date axis names the month on every day tick (s213-m01)', () => {
  for (const object of ['Subscription', 'Usage'] as const) {
    it(`${object}: the design, narrow and wide renders of the placed chart`, async () => {
      const composed = await compose({ object, context: 'detail' });
      const shown = shownSampleRecord(workflowSampleRecords((await seedSchema({ object }, compose))!));
      const [placed] = placedChartRequests(composed.schema!, { theme: 'light', brand: 'A' }, shown);
      expect(placed, `${object} places a chart`).toBeDefined();
      for (const [size, request] of [['design', placed!.request], ['narrow', placed!.narrow.request], ['wide', placed!.wide.request]] as const) {
        const rendered = await render(request as never);
        expect(rendered.status, `${object} ${size}`).toBe('ok');
        const labels = xAxisLabels(rendered.svg!);
        expect(labels.length, `${object} ${size}: tick labels found`).toBeGreaterThan(2);
        expect(labels.filter(label => WEEKDAY_TICK.test(label)), `${object} ${size}: ${labels.join(', ')}`).toEqual([]);
      }
    });
  }

  it('keeps the format of a binned (timeUnit) axis', async () => {
    const rows = Array.from({ length: 12 }, (_, month) => ({ month: `2026-${String(month + 1).padStart(2, '0')}-01`, value: month + 1 }));
    const rendered = await render({ chartType: 'bar', rows, encodings: { x: { field: 'month', timeUnit: 'month' }, y: { field: 'value', aggregate: 'sum' } }, output: { svg: true } } as never);
    expect(rendered.status).toBe('ok');
    expect(xAxisLabels(rendered.svg!)).toContain('Jan');
  });
});
