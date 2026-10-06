import { placedChartRequests } from '../codegen/chart-assets.js';
import type { CodegenOptions } from '../codegen/types.js';
import type { UiSchema, VizRenderInput } from '../schemas/generated.js';
import { handle as certify } from '../tools/artifact.certify.js';
import { handle as render } from '../tools/viz.render.js';

/** What artifact.certify said about one placed chart, keyed by the artifact path it renders to. */
export interface PlacedChartCertification {
  path: string;
  chartType: string;
  source: string;
  name: string;
  theme: string;
  brand: string;
  contentHash: string;
  svgHash: string;
  certification: ChartCertification;
  /** The same chart certified at the narrow size the figure shows below the breakpoint (Sprint 202 m01). */
  narrow: { path: string; contentHash: string; svgHash: string; certification: ChartCertification };
  /** The same chart certified at the wide size the figure shows from the wide breakpoint up (s213-m01). */
  wide: { path: string; contentHash: string; svgHash: string; certification: ChartCertification };
  certifiedAt: string;
}
export interface ChartCertification { status: string; coverage: string | null; conformant: boolean | null; pillars: unknown; findings: unknown[]; determinism: unknown; accuracySummary: unknown; notes: unknown[]; contrastNote: string | null }

/**
 * Certify every placed chart of a schema: re-render each generation request with its normalized
 * spec and run artifact.certify on it with the same theme, brand and data operand. The result is
 * exactly what the two tools return for the same inputs; nothing is summarised away except bulk.
 */
export async function certifyPlacedCharts(schema: UiSchema, options: Pick<CodegenOptions, 'theme' | 'brand'> = {}, shown?: Record<string, unknown>): Promise<PlacedChartCertification[]> {
  const results: PlacedChartCertification[] = [];
  const certifyRender = async (path: string, input: VizRenderInput) => {
    const request: VizRenderInput = { ...input, output: { ...input.output, svg: true, includeNormalizedSpec: true } };
    const rendered = await render(request);
    if (rendered.status !== 'ok' || !rendered.normalizedSpec) throw new Error(`Placed chart render failed for ${path}: ${JSON.stringify(rendered.errors)}`);
    const data = 'network' in input && input.network ? { network: input.network } : undefined;
    const certified = await certify({ spec: rendered.normalizedSpec as never, theme: request.theme as never, brand: request.brand as never, ...(data ? { data: data as never } : {}) });
    const certification: ChartCertification = { status: String(certified.status), coverage: (certified.coverage as string | undefined) ?? null, conformant: (certified.conformant as boolean | null | undefined) ?? null, pillars: certified.pillars ?? null, findings: (certified.findings as unknown[] | undefined) ?? [], determinism: certified.determinism ?? null, accuracySummary: certified.accuracySummary ?? null, notes: (certified.notes as unknown[] | undefined) ?? [], contrastNote: (certified.contrastNote as string | undefined) ?? null };
    return { request, contentHash: String(rendered.contentHash ?? ''), svgHash: String(rendered.svgHash ?? ''), certification };
  };
  for (const placed of placedChartRequests(schema, options, shown)) {
    const design = await certifyRender(placed.path, placed.request);
    const narrow = await certifyRender(placed.narrow.path, placed.narrow.request);
    const wide = await certifyRender(placed.wide.path, placed.wide.request);
    results.push({
      path: placed.path, chartType: String(design.request.chartType), source: placed.source, name: String(design.request.name ?? ''), theme: String(design.request.theme), brand: String(design.request.brand),
      contentHash: design.contentHash, svgHash: design.svgHash, certification: design.certification,
      narrow: { path: placed.narrow.path, contentHash: narrow.contentHash, svgHash: narrow.svgHash, certification: narrow.certification },
      wide: { path: placed.wide.path, contentHash: wide.contentHash, svgHash: wide.svgHash, certification: wide.certification },
      certifiedAt: new Date().toISOString(),
    });
  }
  return results;
}
