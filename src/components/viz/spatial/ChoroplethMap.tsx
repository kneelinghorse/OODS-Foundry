/**
 * ChoroplethMap Component
 *
 * Primary spatial visualization component for regional comparisons with color encoding.
 */

import tokensBundle from '@oods/tokens';
import {
  useMemo,
  useState,
  useCallback,
  useEffect,
  useRef,
  useId,
  type JSX,
} from 'react';
import type { Feature, FeatureCollection } from 'geojson';
import type { EChartsType } from 'echarts';
import type { GeoProjection } from 'd3-geo';
import type { DataRecord } from '../../../viz/adapters/spatial/geo-data-joiner.js';
import type { ProjectionType, ColorScaleType } from '../../../types/viz/spatial.js';
import { useSpatialContext } from './SpatialContext.js';
import { ChoroplethMapRegion } from './ChoroplethMapRegion.js';
import { createProjection, fitProjectionToFeatures } from './utils/projection-utils.js';
import {
  createQuantizeScale,
  createQuantileScale,
  createThresholdScale,
  type ColorScale,
} from './utils/color-scale-utils.js';
import {
  calculateDomain,
  assignColors,
  extractValues,
  type ColorAssignment,
} from './utils/choropleth-utils.js';
import {
  loadVegaEmbed,
  type EmbedOptions,
  type EmbedResult,
  type VisualizationSpec,
} from '../../../viz/runtime/vega-embed-loader.js';

const CSS_VARIABLE_MAP: Record<string, string> =
  (tokensBundle?.cssVariables as Record<string, string>) ?? {};

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

  const clampChannel = (channel: number): number => Math.round(Math.min(255, Math.max(0, channel * 255)));

  const linearToSrgb = (value: number): number => {
    if (value <= 0.0) return 0;
    if (value >= 1.0) return 1;
    if (value <= 0.0031308) return 12.92 * value;
    return 1.055 * Math.pow(value, 1 / 2.4) - 0.055;
  };

  return `rgb(${clampChannel(linearToSrgb(rLinear))}, ${clampChannel(
    linearToSrgb(gLinear)
  )}, ${clampChannel(linearToSrgb(bLinear))})`;
}

function normalizeColorValue(value: string): string {
  const trimmed = value.trim();
  if (trimmed.toLowerCase().startsWith('oklch(')) {
    return convertOklchToRgb(trimmed) ?? trimmed;
  }
  return trimmed;
}

function resolveColorValue(color: string): string {
  const tokenName = parseCssVariable(color);
  if (!tokenName) {
    return normalizeColorValue(color);
  }

  const direct = CSS_VARIABLE_MAP[tokenName];
  const fallback =
    tokenName.startsWith('--oods-') || tokenName.startsWith('--viz')
      ? undefined
      : CSS_VARIABLE_MAP[`--oods-${tokenName.slice(2)}`];

  return normalizeColorValue(direct ?? fallback ?? color);
}

function normalizeJoinKey(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const normalized = String(value).trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function buildFeatureCollection(features: Feature[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features,
  };
}

function buildDataLookup(data: DataRecord[], dataKey: string): Map<string, DataRecord> {
  const map = new Map<string, DataRecord>();
  data.forEach((record) => {
    const key = normalizeJoinKey(record[dataKey]);
    if (key) {
      map.set(key, record);
    }
  });
  return map;
}

/**
 * Table fallback configuration for accessibility.
 */
export interface TableFallbackConfig {
  enabled: boolean;
  caption: string;
}

/**
 * Narrative configuration for accessibility.
 */
export interface NarrativeConfig {
  summary: string;
  keyFindings: string[];
}

/**
 * Accessibility configuration for choropleth map.
 */
export interface ChoroplethA11yConfig {
  description: string;
  tableFallback?: TableFallbackConfig;
  narrative?: NarrativeConfig;
}

/**
 * Props for ChoroplethMap component.
 */
export interface ChoroplethMapProps {
  data: DataRecord[];

  // Encoding
  valueField: string;
  geoJoinKey: string;
  dataJoinKey?: string; // defaults to geoJoinKey

  // Color scale
  colorScale?: ColorScaleType;
  colorRange?: string[];
  thresholds?: number[];

  // Projection (can override container)
  projection?: ProjectionType;
  fitToData?: boolean;

  // Interactions
  onRegionClick?: (feature: Feature, datum: DataRecord | null) => void;
  onRegionHover?: (feature: Feature, datum: DataRecord | null) => void;

  // Accessibility
  a11y: ChoroplethA11yConfig;

  // Renderer preference (SVG default; Vega-Lite and ECharts supported)
  preferredRenderer?: 'echarts' | 'vega-lite' | 'svg';
}

/**
 * Default color range using sequential blue scale.
 */
const DEFAULT_COLOR_RANGE = [
  'var(--oods-viz-scale-sequential-01)',
  'var(--oods-viz-scale-sequential-03)',
  'var(--oods-viz-scale-sequential-05)',
  'var(--oods-viz-scale-sequential-07)',
];

/**
 * Choropleth visualization component.
 *
 * Renders filled regions with color encoding based on data values.
 * Integrates with SpatialContainer for projection and geo data.
 */
export function ChoroplethMap({
  data,
  valueField,
  geoJoinKey,
  dataJoinKey: _dataJoinKey,
  colorScale: colorScaleType = 'quantize',
  colorRange = DEFAULT_COLOR_RANGE,
  thresholds,
  projection: projectionOverride,
  fitToData,
  onRegionClick,
  onRegionHover,
  a11y,
  preferredRenderer = 'svg',
}: ChoroplethMapProps): JSX.Element {
  const context = useSpatialContext();
  const { projection, projectionInstance, features, joinedData, dimensions } = context;
  const dataKey = _dataJoinKey ?? geoJoinKey;
  const mapId = useId();
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const vegaHandleRef = useRef<EmbedResult | null>(null);
  const echartsInstanceRef = useRef<EChartsType | null>(null);

  // Local state for interactions and renderer errors
  const [hoveredFeatureId, setHoveredFeatureId] = useState<string | null>(null);
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  const [rendererError, setRendererError] = useState<string | null>(null);

  // Calculate data domain
  const domain = useMemo(() => calculateDomain(data, valueField), [data, valueField]);
  const featureCollection = useMemo(() => buildFeatureCollection(features), [features]);

  const normalizedJoinedData = useMemo(() => {
    if (joinedData && joinedData.size > 0) {
      return joinedData;
    }
    return buildDataLookup(data, dataKey);
  }, [data, dataKey, joinedData]);

  const colorRangeResolved = useMemo(
    () => colorRange.map((color) => resolveColorValue(color)),
    [colorRange]
  );

  // Create color scale
  const colorScale = useMemo((): ColorScale => {
    if (colorScaleType === 'quantile') {
      const values = extractValues(data, valueField);
      return createQuantileScale(values, colorRangeResolved);
    }

    if (colorScaleType === 'threshold') {
      if (!thresholds || thresholds.length === 0) {
        throw new Error('Threshold scale requires thresholds array');
      }
      return createThresholdScale(thresholds, colorRangeResolved);
    }

    // Default: quantize
    return createQuantizeScale(domain, colorRangeResolved);
  }, [colorScaleType, domain, colorRangeResolved, thresholds, data, valueField]);

  // Assign colors to features
  const colorAssignments = useMemo(
    (): ColorAssignment[] =>
      assignColors(features, normalizedJoinedData, colorScale, valueField, geoJoinKey),
    [features, normalizedJoinedData, colorScale, valueField, geoJoinKey]
  );

  // Create lookup map for quick access
  const colorMap = useMemo(() => {
    const map = new Map<string | number | undefined, ColorAssignment>();
    colorAssignments.forEach((assignment) => {
      map.set(assignment.featureId, assignment);
    });
    return map;
  }, [colorAssignments]);

  const featureLookup = useMemo(() => {
    const map = new Map<string, Feature>();
    features.forEach((feature) => {
      const key = normalizeJoinKey(feature.properties?.[geoJoinKey] ?? feature.id);
      if (key) {
        map.set(key, feature);
      }
    });
    return map;
  }, [features, geoJoinKey]);

  const baseStroke = useMemo(
    () => resolveColorValue('var(--viz-map-region-stroke)'),
    []
  );

  const getDatumForFeature = useCallback(
    (feature: Feature): DataRecord | null => {
      const key = normalizeJoinKey(feature.properties?.[geoJoinKey] ?? feature.id);
      if (!key) {
        return null;
      }
      return normalizedJoinedData.get(key) ?? null;
    },
    [geoJoinKey, normalizedJoinedData]
  );

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

  // Handle region click
  const handleRegionClick = useCallback(
    (feature: Feature, datum: DataRecord | null) => {
      setSelectedFeatureId(String(feature.id ?? ''));
      if (onRegionClick) {
        onRegionClick(feature, datum);
      }
    },
    [onRegionClick]
  );

  // Handle region hover
  const handleRegionHover = useCallback(
    (feature: Feature, datum: DataRecord | null) => {
      setHoveredFeatureId(String(feature.id ?? ''));
      if (onRegionHover) {
        onRegionHover(feature, datum);
      }
    },
    [onRegionHover]
  );

  const handleRegionHoverEnd = useCallback(() => {
    setHoveredFeatureId(null);
  }, []);

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

    const colorScaleSpec: Record<string, unknown> = {
      type: colorScaleType === 'threshold' ? 'threshold' : colorScaleType,
      range: colorRangeResolved,
    };
    if (colorScaleType === 'threshold' && thresholds?.length) {
      colorScaleSpec.domain = thresholds;
    } else if (colorScaleType === 'quantize') {
      colorScaleSpec.domain = domain;
    }

    const spec: VisualizationSpec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      width: dimensions.width,
      height: dimensions.height,
      projection: { type: projection.type ?? 'mercator' },
      data: {
        values: featureCollection,
        format: { type: 'json', property: 'features' },
      },
      mark: 'geoshape',
      encoding: {
        color: {
          field: `properties.${valueField}`,
          type: 'quantitative',
          scale: colorScaleSpec,
          legend: { title: a11y.description },
        },
        tooltip: [
          { field: `properties.${geoJoinKey}`, title: 'Region' },
          { field: `properties.${valueField}`, title: valueField },
        ],
      },
    };

    const embedOptions: EmbedOptions = { actions: false, renderer: 'svg' };

    let detach: (() => void) | undefined;

    void (async () => {
      try {
        const embed = await loadVegaEmbed();
        const result = await embed(container, spec, embedOptions);
        if (cancelled) {
          result.view?.finalize();
          return;
        }
        vegaHandleRef.current = result;

        const view = result.view;
        if (view?.addEventListener) {
          const handleClick = (_event: unknown, item: unknown): void => {
            if (!item || typeof item !== 'object') {
              return;
            }
            const datum = (item as { datum?: Feature }).datum;
            if (!datum) return;
            const matchedFeature =
              featureLookup.get(normalizeJoinKey(datum.properties?.[geoJoinKey]) ?? '') ?? datum;
            const matchedDatum = getDatumForFeature(matchedFeature);
            handleRegionClick(matchedFeature, matchedDatum);
          };

          const handleHover = (_event: unknown, item: unknown): void => {
            if (!item || typeof item !== 'object') {
              return;
            }
            const datum = (item as { datum?: Feature }).datum;
            if (!datum) return;
            const matchedFeature =
              featureLookup.get(normalizeJoinKey(datum.properties?.[geoJoinKey]) ?? '') ?? datum;
            const matchedDatum = getDatumForFeature(matchedFeature);
            handleRegionHover(matchedFeature, matchedDatum);
          };

          const handleHoverEnd = (): void => {
            setHoveredFeatureId(null);
            if (onRegionHover) {
              onRegionHover(null as unknown as Feature, null);
            }
          };

          view.addEventListener('click', handleClick);
          view.addEventListener('mouseover', handleHover);
          view.addEventListener('mouseout', handleHoverEnd);

          detach = () => {
            view.removeEventListener('click', handleClick);
            view.removeEventListener('mouseover', handleHover);
            view.removeEventListener('mouseout', handleHoverEnd);
          };
        }
      } catch (error: unknown) {
        if (cancelled) {
          return;
        }
        setRendererError(error instanceof Error ? error.message : 'Unable to render map');
      }
    })();

    return () => {
      cancelled = true;
      if (detach) {
        detach();
      }
      cleanupVega();
    };
  }, [
    a11y.description,
    colorRangeResolved,
    colorScaleType,
    cleanupEcharts,
    cleanupVega,
    domain,
    featureCollection,
    featureLookup,
    getDatumForFeature,
    geoJoinKey,
    handleRegionClick,
    handleRegionHover,
    onRegionHover,
    preferredRenderer,
    projection.type,
    thresholds,
    valueField,
    dimensions.height,
    dimensions.width,
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

    const regionStroke = resolveColorValue('var(--viz-map-region-stroke)');
    const regionHoverStroke = resolveColorValue('var(--viz-map-region-hover-stroke)');
    const regionStrokeWidth = resolveColorValue('var(--viz-map-region-stroke-width)');

    const seriesData = features.map((feature, index) => {
      const key =
        normalizeJoinKey(feature.properties?.[geoJoinKey]) ??
        normalizeJoinKey(feature.id) ??
        `feature-${index}`;
      const datum = key ? normalizedJoinedData.get(key) ?? null : null;
      const value = typeof datum?.[valueField] === 'number' ? (datum[valueField] as number) : null;
      return {
        name: feature.properties?.[geoJoinKey] ?? feature.id ?? key ?? `feature-${index}`,
        value,
        __featureKey: key ?? `feature-${index}`,
      };
    });

    const buildVisualMap = (): Record<string, unknown> => {
      if (colorScaleType === 'threshold' && thresholds && thresholds.length > 0) {
        const pieces = thresholds.map((threshold, index) => ({
          min: index === 0 ? domain[0] : thresholds[index - 1],
          max: threshold,
          label: `${thresholds[index - 1] ?? domain[0]} - ${threshold}`,
          color: colorRangeResolved[index] ?? colorRangeResolved[colorRangeResolved.length - 1],
        }));
        pieces.push({
          min: thresholds[thresholds.length - 1],
          max: domain[1],
          label: `${thresholds[thresholds.length - 1]}+`,
          color: colorRangeResolved[colorRangeResolved.length - 1],
        });

        return {
          type: 'piecewise',
          pieces,
          orient: 'horizontal',
          left: 'center',
          bottom: 10,
        };
      }

      return {
        type: 'continuous',
        min: domain[0],
        max: domain[1],
        inRange: { color: colorRangeResolved },
        orient: 'horizontal',
        left: 'center',
        bottom: 10,
      };
    };

    let detach: (() => void) | undefined;

    void (async () => {
      try {
        const echarts = await import('echarts');
        if (cancelled) {
          return;
        }

        echarts.registerMap(mapId, featureCollection as never);
        const instance = echarts.init(container);
        echartsInstanceRef.current = instance;

        instance.setOption({
          tooltip: {
            trigger: 'item',
            formatter: '{b}: {c}',
          },
          aria: { enabled: true, description: a11y.description },
          geo: {
            map: mapId,
            roam: false,
            nameProperty: geoJoinKey,
            itemStyle: {
              borderColor: regionStroke,
              borderWidth: Number.parseFloat(regionStrokeWidth) || 1,
            },
            emphasis: {
              focus: 'self',
              itemStyle: {
                borderColor: regionHoverStroke,
                borderWidth: (Number.parseFloat(regionStrokeWidth) || 1) * 1.5,
              },
            },
          },
          visualMap: buildVisualMap(),
          series: [
            {
              type: 'map',
              map: mapId,
              nameProperty: geoJoinKey,
              data: seriesData,
              emphasis: { focus: 'self' },
            },
          ],
        });

        type MapEventParams = { name?: string; data?: { __featureKey?: string; name?: string } };

        const clickHandler = (params: MapEventParams): void => {
          const key =
            normalizeJoinKey(params.data?.__featureKey) ??
            normalizeJoinKey(params.name) ??
            normalizeJoinKey(params.data?.name);
          const feature =
            (key && featureLookup.get(key)) ||
            features.find((candidate) => normalizeJoinKey(candidate.id) === key);
          if (!feature) {
            return;
          }
          const datum = getDatumForFeature(feature);
          handleRegionClick(feature, datum);
        };

        const hoverHandler = (params: MapEventParams): void => {
          const key =
            normalizeJoinKey(params.data?.__featureKey) ??
            normalizeJoinKey(params.name) ??
            normalizeJoinKey(params.data?.name);
          const feature =
            (key && featureLookup.get(key)) ||
            features.find((candidate) => normalizeJoinKey(candidate.id) === key);
          if (!feature) {
            return;
          }
          const datum = getDatumForFeature(feature);
          handleRegionHover(feature, datum);
        };

        const hoverEndHandler = (): void => {
          setHoveredFeatureId(null);
          if (onRegionHover) {
            onRegionHover(null as unknown as Feature, null);
          }
        };

        instance.on('click', clickHandler as unknown as (event: unknown) => void);
        instance.on('mouseover', hoverHandler as unknown as (event: unknown) => void);
        instance.on('mouseout', hoverEndHandler as unknown as (event: unknown) => void);

        detach = () => {
          instance.off('click', clickHandler as unknown as (event: unknown) => void);
          instance.off('mouseover', hoverHandler as unknown as (event: unknown) => void);
          instance.off('mouseout', hoverEndHandler as unknown as (event: unknown) => void);
        };
      } catch (error: unknown) {
        if (cancelled) {
          return;
        }
        setRendererError(error instanceof Error ? error.message : 'Unable to render map');
      }
    })();

    return () => {
      cancelled = true;
      if (detach) {
        detach();
      }
      cleanupEcharts();
    };
  }, [
    a11y.description,
    cleanupEcharts,
    cleanupVega,
    colorRangeResolved,
    colorScaleType,
    dimensions.height,
    dimensions.width,
    domain,
    featureCollection,
    featureLookup,
    features,
    geoJoinKey,
    getDatumForFeature,
    handleRegionClick,
    handleRegionHover,
    mapId,
    normalizedJoinedData,
    onRegionHover,
    preferredRenderer,
    thresholds,
    valueField,
  ]);

  // Use fitted projection from context when available; allow component-level fit override
  const projectionObject = useMemo(() => {
    const shouldFit = fitToData ?? projection.fitToData ?? false;
    const projectionType = projectionOverride ?? projection.type ?? 'mercator';
    const projectionConfig = { ...projection, type: projectionType, fitToData: shouldFit };
    const projectionWithCopy = projectionInstance as unknown as { copy?: () => GeoProjection } | null;
    const copiedProjection = projectionWithCopy?.copy ? projectionWithCopy.copy() : null;
    const baseProjection =
      copiedProjection ?? projectionInstance ?? createProjection(projectionType, projectionConfig, dimensions);

    if (shouldFit) {
      return fitProjectionToFeatures(baseProjection, featureCollection, dimensions);
    }

    return baseProjection;
  }, [dimensions, featureCollection, fitToData, projection, projectionInstance]);

  // Render SVG choropleth
  if (preferredRenderer === 'svg') {
    return (
      <svg
        width={dimensions.width}
        height={dimensions.height}
        aria-label={a11y.description}
        style={{ display: 'block' }}
      >
        <title>{a11y.description}</title>
        {a11y.narrative && (
          <desc>
            {a11y.narrative.summary}
            {a11y.narrative.keyFindings && a11y.narrative.keyFindings.length > 0
              ? ` Key findings: ${a11y.narrative.keyFindings.join('; ')}`
              : ''}
          </desc>
        )}
        <g role="group" aria-label="Choropleth regions">
          {features.map((feature, index) => {
            const featureId = feature.id ?? `feature-${index}`;
            const assignment = colorMap.get(featureId);
            const fillColor = resolveColorValue(assignment?.color || colorRangeResolved[0]);
            const datum = getDatumForFeature(feature);

            return (
              <ChoroplethMapRegion
                key={String(featureId)}
                feature={feature}
                projection={projectionObject}
                fillColor={fillColor}
                stroke={baseStroke}
                datum={datum}
                isHovered={String(featureId) === hoveredFeatureId}
                isSelected={String(featureId) === selectedFeatureId}
                valueField={valueField}
                onClick={handleRegionClick}
                onHover={handleRegionHover}
                onHoverEnd={handleRegionHoverEnd}
              />
            );
          })}
        </g>
      </svg>
    );
  }

  return (
    <div
      ref={chartContainerRef}
      role="img"
      aria-label={a11y.description}
      style={{ width: dimensions.width, height: dimensions.height }}
    >
      {rendererError ? (
        <p role="alert" className="text-[--sys-status-danger-fg]">
          {rendererError}
        </p>
      ) : null}
    </div>
  );
}
