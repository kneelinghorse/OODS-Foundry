/**
 * BubbleMap Component
 *
 * Symbol map for discrete locations with size and color encoding.
 */

import tokensBundle from '@oods/tokens';
import {
  useMemo,
  useRef,
  useState,
  useEffect,
  useId,
  useCallback,
  type JSX,
} from 'react';
import type { Feature, FeatureCollection } from 'geojson';
import type { EChartsType } from 'echarts';
import type { GeoProjection } from 'd3-geo';
import { geoPath } from 'd3-geo';
import { BubbleMapPoint } from './BubbleMapPoint.js';
import { BubbleMapCluster } from './BubbleMapCluster.js';
import { useSpatialContext } from './SpatialContext.js';
import { createProjection, fitProjectionToFeatures } from './utils/projection-utils.js';
import {
  clusterPoints,
  type ClusterResult,
  type ClusteredPoint,
  type ClusterPoint,
} from './utils/clustering-utils.js';
import {
  createLinearSizeScale,
  createLogSizeScale,
  createSqrtSizeScale,
  getSizeForValue,
  type SizeScale,
} from './utils/size-scale-utils.js';
import { createLinearScale } from './utils/color-scale-utils.js';
import type { DataRecord } from '../../../viz/adapters/spatial/geo-data-joiner.js';
import type {
  ProjectionType,
  SizeScaleType,
  SpatialA11yConfig,
} from '../../../types/viz/spatial.js';
import type { NormalizedVizSpec } from '../../../viz/spec/normalized-viz-spec.js';
import {
  loadVegaEmbed,
  type EmbedOptions,
  type EmbedResult,
  type VisualizationSpec,
} from '../../../viz/runtime/vega-embed-loader.js';

type BubbleColorType = 'categorical' | 'continuous';

export interface BubbleMapProps {
  spec: NormalizedVizSpec;
  geoData?: FeatureCollection;
  data: DataRecord[];
  longitudeField: string;
  latitudeField: string;
  sizeField?: string;
  sizeRange?: [number, number];
  sizeScale?: SizeScaleType;
  colorField?: string;
  colorType?: BubbleColorType;
  colorRange?: string[];
  projection?: ProjectionType;
  cluster?: {
    enabled: boolean;
    radius: number;
    minPoints: number;
  };
  onPointClick?: (datum: DataRecord) => void;
  onPointHover?: (datum: DataRecord) => void;
  onClusterClick?: (points: DataRecord[]) => void;
  a11y: SpatialA11yConfig;
  preferredRenderer?: 'echarts' | 'vega-lite' | 'svg';
}

interface RenderedPoint {
  id: string;
  datum: DataRecord;
  longitude: number;
  latitude: number;
  x: number;
  y: number;
  radius: number;
  color: string;
}

const CSS_VARIABLE_MAP: Record<string, string> =
  (tokensBundle?.cssVariables as Record<string, string>) ?? {};

const DEFAULT_SIZE_RANGE: [number, number] = [4, 40];
const DEFAULT_COLOR_RANGE = [
  'var(--oods-viz-scale-sequential-03, var(--sys-accent-strong))',
  'var(--oods-viz-scale-sequential-07, var(--sys-accent-strong))',
];
const DEFAULT_POINT_COLOR = 'var(--oods-viz-scale-sequential-05, var(--sys-accent-strong))';
const DEFAULT_BASEMAP_STROKE = 'var(--oods-viz-map-outline, var(--sys-border-strong))';
const DEFAULT_CLUSTER_FILL = 'var(--oods-viz-map-cluster-fill, #6366f1)'; // Indigo fallback
const DEFAULT_CLUSTER_STROKE = 'var(--oods-viz-map-cluster-stroke, #4338ca)';

function normalizeTokenName(name: string): string {
  return name.startsWith('--') ? name : `--${name}`;
}

function parseCssVariable(color: string): string | undefined {
  const match = color.match(/var\((--[^,)\s]+)/);
  if (!match) {
    return undefined;
  }
  return normalizeTokenName(match[1]);
}

function parseOklch(value: string): { l: number; c: number; h: number } | undefined {
  const match = value
    .replace(/deg/gi, '')
    .replace(/\s+/g, ' ')
    .match(/oklch\(\s*([0-9.+-]+%?)\s+([0-9.+-]+)\s+([0-9.+-]+)\s*\)/i);
  if (!match) {
    return undefined;
  }
  const l = match[1].includes('%') ? Number.parseFloat(match[1]) / 100 : Number(match[1]);
  const c = Number(match[2]);
  const h = Number(match[3]);
  if (!Number.isFinite(l) || !Number.isFinite(c) || !Number.isFinite(h)) {
    return undefined;
  }
  return { l, c, h };
}

function convertOklchToRgb(input: string): string | undefined {
  const parsed = parseOklch(input);
  if (!parsed) {
    return undefined;
  }
  const { l, c, h } = parsed;
  const hr = (h * Math.PI) / 180;
  const a = Math.cos(hr) * c;
  const b = Math.sin(hr) * c;

  const l1 = l + 0.3963377774 * a + 0.2158037573 * b;
  const m1 = l - 0.1055613458 * a - 0.0638541728 * b;
  const s1 = l - 0.0894841775 * a - 1.291485548 * b;

  const l3 = l1 ** 3;
  const m3 = m1 ** 3;
  const s3 = s1 ** 3;

  const rLinear = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  const gLinear = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  const bLinear = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;

  const linearToSrgb = (value: number): number => {
    if (value <= 0.0) return 0;
    if (value >= 1.0) return 1;
    if (value <= 0.0031308) return 12.92 * value;
    return 1.055 * Math.pow(value, 1 / 2.4) - 0.055;
  };
  const clampChannel = (channel: number): number =>
    Math.round(Math.min(255, Math.max(0, channel * 255)));

  return `rgb(${clampChannel(linearToSrgb(rLinear))}, ${clampChannel(
    linearToSrgb(gLinear)
  )}, ${clampChannel(linearToSrgb(bLinear))})`;
}

function resolveColorValue(color: string): string {
  const tokenName = parseCssVariable(color);
  if (!tokenName) {
    return color.toLowerCase().startsWith('oklch(') ? convertOklchToRgb(color) ?? color : color;
  }

  const direct = CSS_VARIABLE_MAP[tokenName];
  const fallback =
    tokenName.startsWith('--oods-') || tokenName.startsWith('--viz')
      ? undefined
      : CSS_VARIABLE_MAP[`--oods-${tokenName.slice(2)}`];
  const resolved = direct ?? fallback ?? color;
  if (resolved.toLowerCase().startsWith('oklch(')) {
    return convertOklchToRgb(resolved) ?? resolved;
  }
  return resolved;
}

function numericDomain(values: Array<number | null>): [number, number] {
  const filtered = values.filter(
    (value): value is number => value !== null && Number.isFinite(value)
  );
  if (filtered.length === 0) {
    return [0, 1];
  }
  return [Math.min(...filtered), Math.max(...filtered)];
}

function projectWithFallback(
  project: ((lon: number, lat: number) => [number, number] | null) | undefined,
  projection: GeoProjection | null | undefined,
  lon: number,
  lat: number
): [number, number] | null {
  if (project) {
    return project(lon, lat);
  }
  if (projection) {
    const projected = projection([lon, lat]);
    return projected ? [projected[0], projected[1]] : null;
  }
  return null;
}

/**
 * BubbleMap component for point/symbol visualizations.
 */
export function BubbleMap({
  spec,
  geoData,
  data,
  longitudeField,
  latitudeField,
  sizeField,
  sizeRange = DEFAULT_SIZE_RANGE,
  sizeScale: sizeScaleType = 'sqrt',
  colorField,
  colorType = 'continuous',
  colorRange = DEFAULT_COLOR_RANGE,
  projection: projectionOverride,
  cluster,
  onPointClick,
  onPointHover,
  onClusterClick,
  a11y,
  preferredRenderer = 'svg',
}: BubbleMapProps): JSX.Element {
  const titleId = useId();
  const descId = useId();
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const vegaHandleRef = useRef<EmbedResult | null>(null);
  const echartsInstanceRef = useRef<EChartsType | null>(null);
  const [rendererError, setRendererError] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const {
    projection: contextProjection,
    projectionInstance,
    project,
    dimensions,
    features: contextFeatures,
  } = useSpatialContext();

  const resolvedDimensions = dimensions ?? { width: 800, height: 600 };

  const projectionObject = useMemo(() => {
    const projectionType: ProjectionType =
      projectionOverride ?? contextProjection?.type ?? 'mercator';
    const projectionConfig = { ...contextProjection, type: projectionType };
    const projectionWithCopy = projectionInstance as unknown as { copy?: () => GeoProjection } | null;
    const copiedProjection = projectionWithCopy?.copy ? projectionWithCopy.copy() : null;
    const baseProjection =
      copiedProjection ?? projectionInstance ?? createProjection(projectionType, projectionConfig, resolvedDimensions);

    if (geoData) {
      return fitProjectionToFeatures(baseProjection, geoData, resolvedDimensions);
    }
    if (contextFeatures && contextFeatures.length > 0) {
      return fitProjectionToFeatures(
        baseProjection,
        { type: 'FeatureCollection', features: contextFeatures } as FeatureCollection,
        resolvedDimensions
      );
    }
    return baseProjection;
  }, [contextFeatures, contextProjection, geoData, projectionInstance, projectionOverride, resolvedDimensions]);

  const projectPoint = useCallback(
    (lon: number, lat: number) => projectWithFallback(project, projectionObject, lon, lat),
    [project, projectionObject]
  );

  const sizeValues = useMemo(
    () =>
      sizeField
        ? data.map((datum) => {
            const value = datum[sizeField];
            return typeof value === 'number' ? value : Number.isFinite(Number(value)) ? Number(value) : null;
          })
        : [],
    [data, sizeField]
  );
  const sizeDomain: [number, number] = sizeField ? numericDomain(sizeValues) : [0, 1];
  const sizeScale: SizeScale = useMemo(() => {
    switch (sizeScaleType) {
      case 'linear':
        return createLinearSizeScale(sizeDomain, sizeRange);
      case 'log':
        return createLogSizeScale(sizeDomain, sizeRange);
      case 'sqrt':
      default:
        return createSqrtSizeScale(sizeDomain, sizeRange);
    }
  }, [sizeDomain, sizeRange, sizeScaleType]);

  const continuousColorDomain = useMemo(() => {
    if (!colorField || colorType === 'categorical') {
      return [0, 1] as [number, number];
    }
    const values = data.map((datum) => {
      const value = datum[colorField];
      return typeof value === 'number' ? value : Number.isFinite(Number(value)) ? Number(value) : null;
    });
    return numericDomain(values);
  }, [colorField, colorType, data]);

  const colorScale = useMemo(() => {
    if (!colorField || colorType === 'categorical') {
      return undefined;
    }
    // Resolve CSS variables to actual color values before d3 interpolation
    // d3-scale cannot interpolate CSS variable strings correctly
    const resolvedRange = colorRange.map((color) => resolveColorValue(color));
    return createLinearScale(continuousColorDomain, resolvedRange);
  }, [colorField, colorRange, colorType, continuousColorDomain]);

  const categoricalColorMap = useMemo(() => {
    if (!colorField || colorType !== 'categorical') {
      return null;
    }
    // Resolve CSS variables upfront for categorical colors
    const rawPalette = colorRange.length > 0 ? colorRange : [DEFAULT_POINT_COLOR];
    const palette = rawPalette.map((color) => resolveColorValue(color));
    const mapping = new Map<string, string>();
    data.forEach((datum) => {
      const value = datum[colorField];
      if (value === null || value === undefined) {
        return;
      }
      const key = String(value);
      if (!mapping.has(key)) {
        mapping.set(key, palette[mapping.size % palette.length]);
      }
    });
    return mapping;
  }, [colorField, colorRange, colorType, data]);

  // Resolve default colors once
  const resolvedDefaultColor = useMemo(() => resolveColorValue(DEFAULT_POINT_COLOR), []);
  const resolvedClusterFill = useMemo(() => resolveColorValue(DEFAULT_CLUSTER_FILL), []);
  const resolvedClusterStroke = useMemo(() => resolveColorValue(DEFAULT_CLUSTER_STROKE), []);

  const projectedPoints: RenderedPoint[] = useMemo(() => {
    return data
      .map((datum, index) => {
        const lon = Number(datum[longitudeField]);
        const lat = Number(datum[latitudeField]);
        if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
          return null;
        }
        const projected = projectPoint(lon, lat);
        if (!projected) {
          return null;
        }
        const sizeValue = sizeField ? (typeof datum[sizeField] === 'number' ? (datum[sizeField] as number) : Number(datum[sizeField])) : undefined;
        const radius = sizeField ? getSizeForValue(sizeScale, Number.isFinite(sizeValue) ? (sizeValue as number) : null) : sizeScale.range[0];
        let color = resolvedDefaultColor;
        if (colorField) {
          if (colorType === 'categorical') {
            const value = datum[colorField];
            const mapped =
              (value !== null && value !== undefined && categoricalColorMap?.get(String(value))) ??
              categoricalColorMap?.values().next().value ??
              resolvedDefaultColor;
            color = mapped;
          } else if (colorScale) {
            const raw = datum[colorField];
            const numeric = typeof raw === 'number' ? raw : Number(raw);
            color = colorScale.getValue(Number.isFinite(numeric) ? numeric : null);
          }
        }

        return {
          id: `bubble-point-${index}`,
          datum,
          longitude: lon,
          latitude: lat,
          x: projected[0],
          y: projected[1],
          radius,
          color,
        };
      })
      .filter((candidate): candidate is RenderedPoint => Boolean(candidate));
  }, [
    categoricalColorMap,
    colorField,
    colorScale,
    colorType,
    data,
    latitudeField,
    longitudeField,
    projectPoint,
    resolvedDefaultColor,
    sizeField,
    sizeScale,
  ]);

  const clusterResult: ClusterResult = useMemo(() => {
    if (!cluster?.enabled) {
      return {
        clusters: [],
        points: projectedPoints.map<ClusteredPoint>((point) => ({
          id: point.id,
          longitude: point.longitude,
          latitude: point.latitude,
          datum: point.datum,
          projected: [point.x, point.y],
          style: { color: point.color, radius: point.radius, id: point.id },
        })),
      };
    }

    const inputs: ClusterPoint[] = projectedPoints.map((point) => ({
      id: point.id,
      longitude: point.longitude,
      latitude: point.latitude,
      datum: point.datum,
      projected: [point.x, point.y],
      style: { color: point.color, radius: point.radius, id: point.id },
    }));

    return clusterPoints(inputs, projectPoint, cluster.radius, cluster.minPoints ?? 2);
  }, [cluster, projectedPoints, projectPoint]);

  const unclusteredPoints: RenderedPoint[] = useMemo(
    () =>
      clusterResult.points.map((point, index) => ({
        id: point.style?.id ? String(point.style.id) : point.id ?? `bubble-point-${index}`,
        datum: point.datum,
        longitude: point.longitude,
        latitude: point.latitude,
        x: point.projected[0],
        y: point.projected[1],
        radius: point.style?.radius ?? sizeScale.range[0],
        color: point.style?.color ?? resolvedDefaultColor,
      })),
    [clusterResult.points, resolvedDefaultColor, sizeScale.range]
  );

  const clustersForRender = useMemo(
    () =>
      clusterResult.clusters.map((clusterItem) => {
        const maxRadius = sizeScale.range[1] * 1.2;
        const minRadius = sizeScale.range[0] * 1.5;
        const radius = Math.max(
          minRadius,
          Math.min(maxRadius, Math.sqrt(clusterItem.count) * (sizeScale.range[0] * 1.25))
        );
        return {
          id: clusterItem.id,
          x: clusterItem.centroid[0],
          y: clusterItem.centroid[1],
          count: clusterItem.count,
          radius,
          points: clusterItem.points,
        };
      }),
    [clusterResult.clusters, sizeScale.range]
  );

  const basemapFeatures: Feature[] = useMemo(() => {
    if (geoData?.features?.length) {
      return geoData.features as Feature[];
    }
    return (contextFeatures as Feature[]) ?? [];
  }, [contextFeatures, geoData?.features]);

  const basemapPaths = useMemo(() => {
    if (!projectionObject || basemapFeatures.length === 0) {
      return [];
    }
    const pathGenerator = geoPath(projectionObject);
    return basemapFeatures
      .map((feature, index) => ({
        id: String(feature.id ?? `basemap-${index}`),
        d: pathGenerator(feature) ?? undefined,
      }))
      .filter((item) => Boolean(item.d));
  }, [basemapFeatures, projectionObject]);

  const cleanupVega = useCallback(() => {
    if (vegaHandleRef.current) {
      vegaHandleRef.current.view?.finalize();
      vegaHandleRef.current = null;
    }
  }, []);

  const cleanupEcharts = useCallback(() => {
    if (echartsInstanceRef.current) {
      echartsInstanceRef.current.dispose();
      echartsInstanceRef.current = null;
    }
  }, []);

  useEffect(() => cleanupVega, [cleanupVega]);
  useEffect(() => cleanupEcharts, [cleanupEcharts]);

  useEffect(() => {
    if (preferredRenderer !== 'vega-lite') {
      return;
    }
    const container = chartContainerRef.current;
    if (!container) {
      return;
    }

    let cancelled = false;
    setRendererError(null);
    cleanupEcharts();

    const resolvedRange = colorRange.map((color) => resolveColorValue(color));
    const sizeRangeArea = sizeRange.map((value) => value * value);

    const spec: VisualizationSpec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      width: resolvedDimensions.width,
      height: resolvedDimensions.height,
      projection: { type: projectionOverride ?? contextProjection?.type ?? 'mercator' },
      data: { values: data },
      mark: { type: 'circle', tooltip: true },
      encoding: {
        longitude: { field: longitudeField, type: 'quantitative' },
        latitude: { field: latitudeField, type: 'quantitative' },
        size: sizeField
          ? { field: sizeField, type: 'quantitative', scale: { type: sizeScaleType === 'sqrt' ? 'sqrt' : sizeScaleType, range: sizeRangeArea } }
          : undefined,
        color: colorField
          ? {
              field: colorField,
              type: colorType === 'categorical' ? 'nominal' : 'quantitative',
              scale: { range: resolvedRange },
            }
          : { value: resolveColorValue(DEFAULT_POINT_COLOR) },
        tooltip: [
          { field: longitudeField, title: 'Longitude' },
          { field: latitudeField, title: 'Latitude' },
          ...(sizeField ? [{ field: sizeField, title: sizeField }] : []),
          ...(colorField ? [{ field: colorField, title: colorField }] : []),
        ],
      },
    };

    const embedOptions: EmbedOptions = { actions: false, renderer: 'svg' };

    let detach: (() => void) | undefined;

    void (async () => {
      try {
        const embed = await loadVegaEmbed();
        if (cancelled) {
          return;
        }
        const result = await embed(container, spec, embedOptions);
        if (cancelled) {
          result.view?.finalize();
          return;
        }
        vegaHandleRef.current = result;
        detach = () => {
          result.view?.finalize();
        };
      } catch (error) {
        if (!cancelled) {
          setRendererError(error instanceof Error ? error.message : 'Renderer error');
        }
      }
    })();

    return () => {
      cancelled = true;
      detach?.();
      cleanupVega();
    };
  }, [
    cleanupEcharts,
    cleanupVega,
    colorField,
    colorRange,
    colorType,
    contextProjection?.type,
    data,
    latitudeField,
    longitudeField,
    preferredRenderer,
    projectionOverride,
    resolvedDimensions.height,
    resolvedDimensions.width,
    sizeField,
    sizeRange,
    sizeScaleType,
  ]);

  useEffect(() => {
    if (preferredRenderer !== 'echarts') {
      return;
    }

    const container = chartContainerRef.current;
    if (!container) {
      return;
    }

    let cancelled = false;
    setRendererError(null);
    cleanupVega();

    const resolvedRange = colorRange.map((color) => resolveColorValue(color));
    const symbolSize = (value: unknown): number => {
      const numeric = typeof value === 'number' ? value : Number(value);
      const radius = sizeField ? getSizeForValue(sizeScale, Number.isFinite(numeric) ? numeric : null) : sizeScale.range[0];
      return radius * 2;
    };

    const seriesData = data.map((datum, index) => ({
      name: String(datum[colorField ?? longitudeField] ?? `point-${index}`),
      value: [datum[longitudeField], datum[latitudeField], sizeField ? datum[sizeField] : undefined],
      raw: datum,
    }));

    let detach: (() => void) | undefined;

    void (async () => {
      try {
        const echarts = await import('echarts');
        if (cancelled) {
          return;
        }
        if (geoData) {
          echarts.registerMap('bubble-map', geoData as never);
        }
        const instance = echarts.init(container);
        echartsInstanceRef.current = instance;

        instance.setOption({
          aria: { enabled: true, description: a11y.description },
          tooltip: { trigger: 'item' },
          geo: {
            map: geoData ? 'bubble-map' : undefined,
            roam: false,
          },
          visualMap:
            colorField && colorType === 'continuous'
              ? {
                  type: 'continuous',
                  min: continuousColorDomain[0],
                  max: continuousColorDomain[1],
                  inRange: { color: resolvedRange },
                }
              : undefined,
          series: [
            {
              type: 'scatter',
              coordinateSystem: 'geo',
              data: seriesData,
              symbolSize,
              encode: {
                lng: 0,
                lat: 1,
              },
              itemStyle: {
                color:
                  colorField && colorType === 'categorical'
                    ? undefined
                    : resolvedRange[resolvedRange.length - 1] ?? resolveColorValue(DEFAULT_POINT_COLOR),
              },
            },
          ],
        });

        const clickHandler = (params: { data?: { raw?: DataRecord } }): void => {
          const datum = params.data?.raw;
          if (datum) {
            onPointClick?.(datum);
          }
        };

        instance.on('click', clickHandler as unknown as (event: unknown) => void);
        detach = () => {
          instance.off('click', clickHandler as unknown as (event: unknown) => void);
          instance.dispose();
        };
      } catch (error) {
        if (!cancelled) {
          setRendererError(error instanceof Error ? error.message : 'Renderer error');
        }
      }
    })();

    return () => {
      cancelled = true;
      detach?.();
      cleanupEcharts();
    };
  }, [
    a11y.description,
    cleanupEcharts,
    cleanupVega,
    colorField,
    colorRange,
    colorType,
    continuousColorDomain,
    data,
    geoData,
    latitudeField,
    longitudeField,
    onPointClick,
    preferredRenderer,
    sizeField,
    sizeScale,
  ]);

  const ariaDescription = a11y.description ?? spec?.a11y?.description ?? 'Bubble map';

  if (preferredRenderer !== 'svg') {
    return (
      <div
        ref={chartContainerRef}
        role="img"
        aria-label={ariaDescription}
        style={{ width: resolvedDimensions.width, height: resolvedDimensions.height }}
      >
        {rendererError ? (
          <p role="alert" className="text-[--sys-status-danger-fg]">
            {rendererError}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <svg
      width={resolvedDimensions.width}
      height={resolvedDimensions.height}
      aria-labelledby={`${titleId} ${descId}`}
      aria-label={ariaDescription}
      style={{ display: 'block' }}
    >
      <title id={titleId}>{ariaDescription}</title>
      <desc id={descId}>
        {a11y.narrative?.summary}
        {a11y.narrative?.keyFindings?.length
          ? ` Key findings: ${a11y.narrative.keyFindings.join('; ')}`
          : ''}
      </desc>
      {basemapPaths.length > 0 ? (
        <g aria-hidden="true" className="opacity-60">
          {basemapPaths.map((path) => (
            <path
              key={path.id}
              d={path.d ?? undefined}
              fill="none"
              stroke={resolveColorValue(DEFAULT_BASEMAP_STROKE)}
              strokeWidth={1.25}
            />
          ))}
        </g>
      ) : null}
      <g role="group" aria-label="Bubble map clusters">
        {clustersForRender.map((clusterItem) => (
          <BubbleMapCluster
            key={clusterItem.id}
            id={clusterItem.id}
            x={clusterItem.x}
            y={clusterItem.y}
            radius={clusterItem.radius}
            count={clusterItem.count}
            points={clusterItem.points}
            fill={resolvedClusterFill}
            stroke={resolvedClusterStroke}
            ariaLabel={`Cluster of ${clusterItem.count} points`}
            onClick={(points) => {
              onClusterClick?.(points.map((point) => point.datum));
            }}
          />
        ))}
      </g>
      <g role="group" aria-label="Bubble map points">
        {unclusteredPoints.map((point) => (
          <BubbleMapPoint
            key={point.id}
            id={point.id}
            x={point.x}
            y={point.y}
            radius={point.radius}
            fill={point.color}
            datum={point.datum}
            isHovered={hoveredId === point.id}
            isFocused={focusedId === point.id}
            ariaLabel={`Point at ${point.latitude.toFixed(2)}, ${point.longitude.toFixed(
              2
            )}${sizeField ? ` with ${sizeField}: ${String(point.datum[sizeField])}` : ''}${
              colorField ? ` and ${colorField}: ${String(point.datum[colorField])}` : ''
            }`}
            onClick={(datum) => {
              setFocusedId(point.id);
              onPointClick?.(datum);
            }}
            onHover={(datum) => {
              setHoveredId(point.id);
              onPointHover?.(datum);
            }}
            onHoverEnd={() => setHoveredId(null)}
          />
        ))}
      </g>
      <style>{`
        #${titleId} + desc + g [data-testid="bubble-point"]:focus-visible {
          outline: none;
        }
      `}</style>
    </svg>
  );
}
