import type { EChartsOption, GeoComponentOption, VisualMapComponentOption } from 'echarts';

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

/** ECharts evaluates this JSON media rule at the receiving chart's actual width. */
export function phoneGeoLayout(title: string | undefined, maps?: VisualMapComponentOption | VisualMapComponentOption[], textColor?: string): NonNullable<EChartsOption['media']> {
  const legends = maps ? (Array.isArray(maps) ? maps : [maps]) : [];
  const hasLegend = legends.some(map => map.show !== false);
  return [{ query: { maxWidth: 420 }, option: {
    geo: { left: 8, right: 8, top: title ? 40 : 8, bottom: hasLegend ? 76 : 16 },
    ...(hasLegend ? { visualMap: legends.map(map => ({ orient: 'horizontal' as const, left: 'center', top: 'auto', bottom: 8,
      itemWidth: 12, itemHeight: map.type === 'continuous' ? 110 : 12, calculable: false, textStyle: { fontSize: 12, color: textColor },
      ...(map.type === 'continuous' ? { text: [String(map.max), String(map.min)] } : {}),
    })) } : {}),
  } }];
}
