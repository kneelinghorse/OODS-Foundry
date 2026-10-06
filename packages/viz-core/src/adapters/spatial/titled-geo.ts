import type { GeoComponentOption } from 'echarts';

/**
 * s213-m01 (Sprint 212 builder carry): a spatial chart that paints its title reserves a band for it, as the sankey and
 * graph adapters do (their series start 40px down under an 8px-top title). The geo component was laid out from the top
 * of the chart, so a wide, short panel — the eleven-panel dashboard's 600x320 "State sales" choropleth — drew its
 * regions under its own title in high contrast.
 */
export const TITLED_GEO_TOP = 40;
export const TITLED_GEO_BOTTOM = 16;

export function withTitleBand<T extends GeoComponentOption | undefined>(geo: T, title: string | undefined): T {
  return (geo && title ? { ...geo, top: TITLED_GEO_TOP, bottom: TITLED_GEO_BOTTOM } : geo) as T;
}
