CI errors build on choropleth commit:


13s
Run pnpm run test:coverage

> @oods/trait-engine@0.1.0 pretest:coverage /home/runner/work/OODS-Foundry/OODS-Foundry
> pnpm run build && pnpm run build:packages


> @oods/trait-engine@0.1.0 build /home/runner/work/OODS-Foundry/OODS-Foundry
> tsc

Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(10,49): error TS2307: Cannot find module 'geojson' or its corresponding type declarations.
Error: src/components/viz/spatial/ChoroplethMap.tsx(8,30): error TS2307: Cannot find module 'geojson' or its corresponding type declarations.
Error: src/components/viz/spatial/ChoroplethMapRegion.tsx(8,30): error TS2307: Cannot find module 'geojson' or its corresponding type declarations.
Error: src/components/viz/spatial/ChoroplethMapRegion.tsx(9,36): error TS2307: Cannot find module 'd3-geo' or its corresponding type declarations.
Error: src/components/viz/spatial/ChoroplethMapRegion.tsx(10,25): error TS2307: Cannot find module 'd3-geo' or its corresponding type declarations.
Error: src/components/viz/spatial/SpatialContainer.stories.tsx(8,49): error TS2307: Cannot find module 'geojson' or its corresponding type declarations.
Error: src/components/viz/spatial/SpatialContainer.tsx(18,49): error TS2307: Cannot find module 'geojson' or its corresponding type declarations.
Error: src/components/viz/spatial/SpatialContext.tsx(9,30): error TS2307: Cannot find module 'geojson' or its corresponding type declarations.
Error: src/components/viz/spatial/utils/choropleth-utils.ts(7,30): error TS2307: Cannot find module 'geojson' or its corresponding type declarations.
Error: src/components/viz/spatial/utils/color-scale-utils.ts(8,26): error TS2307: Cannot find module 'd3-scale' or its corresponding type declarations.
Error: src/components/viz/spatial/utils/projection-utils.ts(7,24): error TS2307: Cannot find module 'd3-geo' or its corresponding type declarations.
Error: src/components/viz/spatial/utils/projection-utils.ts(8,36): error TS2307: Cannot find module 'd3-geo' or its corresponding type declarations.
Error: src/components/viz/spatial/utils/projection-utils.ts(9,50): error TS2307: Cannot find module 'geojson' or its corresponding type declarations.
Error: src/viz/adapters/spatial/geo-format-parser.ts(7,124): error TS2307: Cannot find module 'geojson' or its corresponding type declarations.
Error: src/viz/adapters/spatial/geo-format-parser.ts(8,115): error TS2307: Cannot find module 'topojson-specification' or its corresponding type declarations.
Error: src/viz/adapters/spatial/geo-format-parser.ts(89,37): error TS2307: Cannot find module 'topojson-client' or its corresponding type declarations.
Error: src/viz/hooks/useSpatialProjection.ts(8,27): error TS2307: Cannot find module 'd3-geo' or its corresponding type declarations.
Error: src/viz/hooks/useSpatialProjection.ts(9,50): error TS2307: Cannot find module 'geojson' or its corresponding type declarations.
Error: src/viz/hooks/useSpatialSpec.ts(9,30): error TS2307: Cannot find module 'geojson' or its corresponding type declarations.
 ELIFECYCLE  Command failed with exit code 2.
 ELIFECYCLE  Command failed with exit code 2.
Error: Process completed with exit code 2.
Run pnpm run test:coverage

> @oods/trait-engine@0.1.0 pretest:coverage /home/runner/work/OODS-Foundry/OODS-Foundry
> pnpm run build && pnpm run build:packages


> @oods/trait-engine@0.1.0 build /home/runner/work/OODS-Foundry/OODS-Foundry
> tsc

Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(10,49): error TS2307: Cannot find module 'geojson' or its corresponding type declarations.
Error: src/components/viz/spatial/ChoroplethMap.tsx(8,30): error TS2307: Cannot find module 'geojson' or its corresponding type declarations.
Error: src/components/viz/spatial/ChoroplethMapRegion.tsx(8,30): error TS2307: Cannot find module 'geojson' or its corresponding type declarations.
Error: src/components/viz/spatial/ChoroplethMapRegion.tsx(9,36): error TS2307: Cannot find module 'd3-geo' or its corresponding type declarations.
Error: src/components/viz/spatial/ChoroplethMapRegion.tsx(10,25): error TS2307: Cannot find module 'd3-geo' or its corresponding type declarations.
Error: src/components/viz/spatial/SpatialContainer.stories.tsx(8,49): error TS2307: Cannot find module 'geojson' or its corresponding type declarations.
Error: src/components/viz/spatial/SpatialContainer.tsx(18,49): error TS2307: Cannot find module 'geojson' or its corresponding type declarations.
Error: src/components/viz/spatial/SpatialContext.tsx(9,30): error TS2307: Cannot find module 'geojson' or its corresponding type declarations.
Error: src/components/viz/spatial/utils/choropleth-utils.ts(7,30): error TS2307: Cannot find module 'geojson' or its corresponding type declarations.
Error: src/components/viz/spatial/utils/color-scale-utils.ts(8,26): error TS2307: Cannot find module 'd3-scale' or its corresponding type declarations.
Error: src/components/viz/spatial/utils/projection-utils.ts(7,24): error TS2307: Cannot find module 'd3-geo' or its corresponding type declarations.
Error: src/components/viz/spatial/utils/projection-utils.ts(8,36): error TS2307: Cannot find module 'd3-geo' or its corresponding type declarations.
Error: src/components/viz/spatial/utils/projection-utils.ts(9,50): error TS2307: Cannot find module 'geojson' or its corresponding type declarations.
Error: src/viz/adapters/spatial/geo-format-parser.ts(7,124): error TS2307: Cannot find module 'geojson' or its corresponding type declarations.
Error: src/viz/adapters/spatial/geo-format-parser.ts(8,115): error TS2307: Cannot find module 'topojson-specification' or its corresponding type declarations.
Error: src/viz/adapters/spatial/geo-format-parser.ts(89,37): error TS2307: Cannot find module 'topojson-client' or its corresponding type declarations.
Error: src/viz/hooks/useSpatialProjection.ts(8,27): error TS2307: Cannot find module 'd3-geo' or its corresponding type declarations.
Error: src/viz/hooks/useSpatialProjection.ts(9,50): error TS2307: Cannot find module 'geojson' or its corresponding type declarations.
Error: src/viz/hooks/useSpatialSpec.ts(9,30): error TS2307: Cannot find module 'geojson' or its corresponding type declarations.
 ELIFECYCLE  Command failed with exit code 2.
 ELIFECYCLE  Command failed with exit code 2.
Error: Process completed with exit code 2.








final polish commit errors
build errors:
  Run pnpm run test:coverage
  pnpm run test:coverage
  shell: /usr/bin/bash -e {0}
  env:
    NODE_VERSION: 20
    PNPM_HOME: /home/runner/setup-pnpm/node_modules/.bin

> @oods/trait-engine@0.1.0 pretest:coverage /home/runner/work/OODS-Foundry/OODS-Foundry
> pnpm run build && pnpm run build:packages


> @oods/trait-engine@0.1.0 build /home/runner/work/OODS-Foundry/OODS-Foundry
> tsc

Error: examples/dashboards/spatial-dashboard.tsx(2,40): error TS2307: Cannot find module 'geojson' or its corresponding type declarations.
Error: examples/dashboards/spatial-dashboard.tsx(3,25): error TS2307: Cannot find module 'topojson-client' or its corresponding type declarations.
Error: examples/dashboards/spatial-dashboard.tsx(7,27): error TS2307: Cannot find module '../../src/components/viz/spatial/BubbleMap.js' or its corresponding type declarations.
Error: examples/dashboards/spatial-dashboard.tsx(8,29): error TS2307: Cannot find module '../../src/components/viz/spatial/MapControls.js' or its corresponding type declarations.
Error: examples/dashboards/spatial-dashboard.tsx(9,27): error TS2307: Cannot find module '../../src/components/viz/spatial/MapLegend.js' or its corresponding type declarations.
Error: examples/dashboards/spatial-dashboard.tsx(12,37): error TS2307: Cannot find module '../../src/components/viz/spatial/utils/size-scale-utils.js' or its corresponding type declarations.
Error: examples/dashboards/spatial-dashboard.tsx(14,67): error TS2307: Cannot find module '../../src/viz/contexts/dashboard-spatial-context.js' or its corresponding type declarations.
Error: examples/dashboards/spatial-dashboard.tsx(19,8): error TS2307: Cannot find module '../../src/viz/interactions/spatial-filter-actions.js' or its corresponding type declarations.
Error: examples/dashboards/spatial-dashboard.tsx(24,26): error TS2307: Cannot find module '../../src/components/viz/spatial/fixtures/us-states-10m.json' or its corresponding type declarations.
Error: examples/dashboards/spatial-dashboard.tsx(240,44): error TS7006: Parameter 'entry' implicitly has an 'any' type.
Error: examples/dashboards/spatial-dashboard.tsx(245,40): error TS2345: Argument of type 'Set<unknown>' is not assignable to parameter of type 'ReadonlySet<string>'.
  Types of property 'forEach' are incompatible.
    Type '(callbackfn: (value: unknown, value2: unknown, set: Set<unknown>) => void, thisArg?: any) => void' is not assignable to type '(callbackfn: (value: string, value2: string, set: ReadonlySet<string>) => void, thisArg?: any) => void'.
      Types of parameters 'callbackfn' and 'callbackfn' are incompatible.
        Types of parameters 'value' and 'value' are incompatible.
          Type 'unknown' is not assignable to type 'string'.
Error: examples/dashboards/spatial-dashboard.tsx(249,38): error TS2345: Argument of type 'Set<unknown>' is not assignable to parameter of type 'ReadonlySet<string>'.
Error: examples/dashboards/spatial-dashboard.tsx(286,9): error TS6133: 'joinedByFeature' is declared but its value is never read.
Error: examples/dashboards/spatial-dashboard.tsx(288,41): error TS7006: Parameter 'feature' implicitly has an 'any' type.
Error: examples/dashboards/spatial-dashboard.tsx(299,25): error TS2352: Conversion of type 'StateMetric' to type 'Record<string, unknown>' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
  Index signature for type 'string' is missing in type 'StateMetric'.
Error: examples/dashboards/spatial-dashboard.tsx(358,24): error TS7006: Parameter 'v' implicitly has an 'any' type.
Error: examples/dashboards/spatial-dashboard.tsx(407,30): error TS7006: Parameter 'datum' implicitly has an 'any' type.
Error: examples/dashboards/spatial-dashboard.tsx(418,24): error TS7006: Parameter 'v' implicitly has an 'any' type.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(9,40): error TS2307: Cannot find module 'geojson' or its corresponding type declarations.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(10,25): error TS2307: Cannot find module 'topojson-client' or its corresponding type declarations.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(11,31): error TS2307: Cannot find module 'topojson-specification' or its corresponding type declarations.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(12,48): error TS2307: Cannot find module './BubbleMap.js' or its corresponding type declarations.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(13,27): error TS2307: Cannot find module './MapLegend.js' or its corresponding type declarations.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(16,37): error TS2307: Cannot find module './utils/size-scale-utils.js' or its corresponding type declarations.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(20,30): error TS2307: Cannot find module './fixtures/us-states-10m.json' or its corresponding type declarations.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(21,36): error TS2307: Cannot find module './fixtures/world-countries-110m.json' or its corresponding type declarations.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(56,7): error TS6133: 'worldCountriesGeoData' is declared but its value is never read.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(162,9): error TS2322: Type '{ type: "spatial"; data: { values: BubbleMapProps; }; projection: { type: ProjectionType; fitToData: true; }; layers: { type: "symbol"; encoding: { size: { field: any; range: BubbleMapProps; } | undefined; color: { ...; } | undefined; }; }[]; a11y: BubbleMapProps; }' is not assignable to type 'SpatialSpec'.
  Types of property 'layers' are incompatible.
    Type '{ type: "symbol"; encoding: { size: { field: any; range: BubbleMapProps; } | undefined; color: { field: any; range: BubbleMapProps; } | undefined; }; }[]' is not assignable to type 'SpatialLayer[]'.
      Type '{ type: "symbol"; encoding: { size: { field: any; range: BubbleMapProps; } | undefined; color: { field: any; range: BubbleMapProps; } | undefined; }; }' is not assignable to type 'SpatialLayer'.
        Type '{ type: "symbol"; encoding: { size: { field: any; range: BubbleMapProps; } | undefined; color: { field: any; range: BubbleMapProps; } | undefined; }; }' is not assignable to type 'SymbolLayer'.
          Types of property 'encoding' are incompatible.
            Type '{ size: { field: any; range: BubbleMapProps; } | undefined; color: { field: any; range: BubbleMapProps; } | undefined; }' is missing the following properties from type '{ longitude: PositionEncoding; latitude: PositionEncoding; size?: SizeEncoding | undefined; color?: ColorEncoding | undefined; shape?: ShapeEncoding | undefined; opacity?: OpacityEncoding | undefined; }': longitude, latitude
Error: src/components/viz/spatial/BubbleMap.stories.tsx(219,44): error TS7006: Parameter 'datum' implicitly has an 'any' type.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(220,42): error TS7006: Parameter 'datum' implicitly has an 'any' type.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(345,6): error TS2740: Type '{ title: string; }' is missing the following properties from type 'BubbleStoryArgs': specProjection, clusterEnabled, clusterRadius, clusterMinPoints, and 3 more.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(378,6): error TS2740: Type '{ title: string; }' is missing the following properties from type 'BubbleStoryArgs': specProjection, clusterEnabled, clusterRadius, clusterMinPoints, and 3 more.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(411,6): error TS2740: Type '{ title: string; }' is missing the following properties from type 'BubbleStoryArgs': specProjection, clusterEnabled, clusterRadius, clusterMinPoints, and 3 more.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(444,6): error TS2740: Type '{ title: string; }' is missing the following properties from type 'BubbleStoryArgs': specProjection, clusterEnabled, clusterRadius, clusterMinPoints, and 3 more.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(476,22): error TS2740: Type '{ title: string; }' is missing the following properties from type 'BubbleStoryArgs': specProjection, clusterEnabled, clusterRadius, clusterMinPoints, and 3 more.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(508,6): error TS2740: Type '{ title: string; }' is missing the following properties from type 'BubbleStoryArgs': specProjection, clusterEnabled, clusterRadius, clusterMinPoints, and 3 more.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(10,50): error TS2307: Cannot find module 'geojson' or its corresponding type declarations.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(11,25): error TS2307: Cannot find module 'topojson-client' or its corresponding type declarations.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(12,31): error TS2307: Cannot find module 'topojson-specification' or its corresponding type declarations.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(14,48): error TS2307: Cannot find module './MapLegend.js' or its corresponding type declarations.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(23,30): error TS2307: Cannot find module './fixtures/us-states-10m.json' or its corresponding type declarations.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(24,36): error TS2307: Cannot find module './fixtures/world-countries-110m.json' or its corresponding type declarations.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(243,48): error TS2322: Type '{}' is not assignable to type 'ReactNode'.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(259,13): error TS2322: Type '{}' is not assignable to type 'ReactNode'.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(294,5): error TS2353: Object literal may only specify known properties, and 'showLegend' does not exist in type 'Partial<ArgTypes<ChoroplethMapProps>>'.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(311,5): error TS2353: Object literal may only specify known properties, and 'geoData' does not exist in type 'Partial<ChoroplethMapProps>'.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(327,6): error TS2739: Type '{ title: string; data: DataRecord[]; valueField: string; geoJoinKey: string; dataJoinKey?: string | undefined; colorScale?: ColorScaleType | undefined; colorRange?: string[] | undefined; ... 6 more ...; preferredRenderer?: "svg" | ... 2 more ... | undefined; }' is missing the following properties from type 'ChoroplethStoryArgs': geoData, showLegend, enableTooltip, enableSelection
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(334,5): error TS2353: Object literal may only specify known properties, and 'geoData' does not exist in type 'Partial<ChoroplethMapProps>'.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(353,6): error TS2739: Type '{ title: string; data: DataRecord[]; valueField: string; geoJoinKey: string; dataJoinKey?: string | undefined; colorScale?: ColorScaleType | undefined; colorRange?: string[] | undefined; ... 6 more ...; preferredRenderer?: "svg" | ... 2 more ... | undefined; }' is missing the following properties from type 'ChoroplethStoryArgs': geoData, showLegend, enableTooltip, enableSelection
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(360,5): error TS2353: Object literal may only specify known properties, and 'geoData' does not exist in type 'Partial<ChoroplethMapProps>'.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(380,6): error TS2739: Type '{ title: string; data: DataRecord[]; valueField: string; geoJoinKey: string; dataJoinKey?: string | undefined; colorScale?: ColorScaleType | undefined; colorRange?: string[] | undefined; ... 6 more ...; preferredRenderer?: "svg" | ... 2 more ... | undefined; }' is missing the following properties from type 'ChoroplethStoryArgs': geoData, showLegend, enableTooltip, enableSelection
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(390,5): error TS2353: Object literal may only specify known properties, and 'geoData' does not exist in type 'Partial<ChoroplethMapProps>'.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(409,6): error TS2739: Type '{ title: string; data: DataRecord[]; valueField: string; geoJoinKey: string; dataJoinKey?: string | undefined; colorScale?: ColorScaleType | undefined; colorRange?: string[] | undefined; ... 6 more ...; preferredRenderer?: "svg" | ... 2 more ... | undefined; }' is missing the following properties from type 'ChoroplethStoryArgs': geoData, showLegend, enableTooltip, enableSelection
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(416,5): error TS2353: Object literal may only specify known properties, and 'geoData' does not exist in type 'Partial<ChoroplethMapProps>'.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(435,6): error TS2739: Type '{ title: string; data: DataRecord[]; valueField: string; geoJoinKey: string; dataJoinKey?: string | undefined; colorScale?: ColorScaleType | undefined; colorRange?: string[] | undefined; ... 6 more ...; preferredRenderer?: "svg" | ... 2 more ... | undefined; }' is missing the following properties from type 'ChoroplethStoryArgs': geoData, showLegend, enableTooltip, enableSelection
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(442,5): error TS2353: Object literal may only specify known properties, and 'geoData' does not exist in type 'Partial<ChoroplethMapProps>'.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(460,22): error TS2739: Type '{ title: string; data: DataRecord[]; valueField: string; geoJoinKey: string; dataJoinKey?: string | undefined; colorScale?: ColorScaleType | undefined; colorRange?: string[] | undefined; ... 6 more ...; preferredRenderer?: "svg" | ... 2 more ... | undefined; }' is missing the following properties from type 'ChoroplethStoryArgs': geoData, showLegend, enableTooltip, enableSelection
Error: src/components/viz/spatial/ChoroplethMap.tsx(8,30): error TS2307: Cannot find module 'geojson' or its corresponding type declarations.
Error: src/components/viz/spatial/ChoroplethMapRegion.tsx(8,30): error TS2307: Cannot find module 'geojson' or its corresponding type declarations.
Error: src/components/viz/spatial/ChoroplethMapRegion.tsx(9,36): error TS2307: Cannot find module 'd3-geo' or its corresponding type declarations.
Error: src/components/viz/spatial/ChoroplethMapRegion.tsx(10,25): error TS2307: Cannot find module 'd3-geo' or its corresponding type declarations.
Error: src/components/viz/spatial/SpatialContainer.stories.tsx(8,49): error TS2307: Cannot find module 'geojson' or its corresponding type declarations.
Error: src/components/viz/spatial/SpatialContainer.tsx(18,49): error TS2307: Cannot find module 'geojson' or its corresponding type declarations.
Error: src/components/viz/spatial/SpatialContext.tsx(9,30): error TS2307: Cannot find module 'geojson' or its corresponding type declarations.
Error: src/components/viz/spatial/utils/choropleth-utils.ts(7,30): error TS2307: Cannot find module 'geojson' or its corresponding type declarations.
Error: src/components/viz/spatial/utils/color-scale-utils.ts(8,26): error TS2307: Cannot find module 'd3-scale' or its corresponding type declarations.
Error: src/components/viz/spatial/utils/projection-utils.ts(7,24): error TS2307: Cannot find module 'd3-geo' or its corresponding type declarations.
Error: src/components/viz/spatial/utils/projection-utils.ts(8,36): error TS2307: Cannot find module 'd3-geo' or its corresponding type declarations.
Error: src/components/viz/spatial/utils/projection-utils.ts(9,50): error TS2307: Cannot find module 'geojson' or its corresponding type declarations.
Error: src/viz/adapters/spatial/geo-format-parser.ts(7,124): error TS2307: Cannot find module 'geojson' or its corresponding type declarations.
Error: src/viz/adapters/spatial/geo-format-parser.ts(8,115): error TS2307: Cannot find module 'topojson-specification' or its corresponding type declarations.
Error: src/viz/adapters/spatial/geo-format-parser.ts(89,37): error TS2307: Cannot find module 'topojson-client' or its corresponding type declarations.
Error: src/viz/hooks/useSpatialProjection.ts(8,27): error TS2307: Cannot find module 'd3-geo' or its corresponding type declarations.
Error: src/viz/hooks/useSpatialProjection.ts(9,50): error TS2307: Cannot find module 'geojson' or its corresponding type declarations.
Error: src/viz/hooks/useSpatialSpec.ts(9,30): error TS2307: Cannot find module 'geojson' or its corresponding type declarations.
 ELIFECYCLE  Command failed with exit code 2.
 ELIFECYCLE  Command failed with exit code 2.
14s
Run pnpm run test:coverage
  pnpm run test:coverage
  shell: /usr/bin/bash -e {0}
  env:
    NODE_VERSION: 20
    PNPM_HOME: /home/runner/setup-pnpm/node_modules/.bin

> @oods/trait-engine@0.1.0 pretest:coverage /home/runner/work/OODS-Foundry/OODS-Foundry
> pnpm run build && pnpm run build:packages


> @oods/trait-engine@0.1.0 build /home/runner/work/OODS-Foundry/OODS-Foundry
> tsc

Error: examples/dashboards/spatial-dashboard.tsx(2,40): error TS2307: Cannot find module 'geojson' or its corresponding type declarations.
Error: examples/dashboards/spatial-dashboard.tsx(3,25): error TS2307: Cannot find module 'topojson-client' or its corresponding type declarations.
Error: examples/dashboards/spatial-dashboard.tsx(7,27): error TS2307: Cannot find module '../../src/components/viz/spatial/BubbleMap.js' or its corresponding type declarations.
Error: examples/dashboards/spatial-dashboard.tsx(8,29): error TS2307: Cannot find module '../../src/components/viz/spatial/MapControls.js' or its corresponding type declarations.
Error: examples/dashboards/spatial-dashboard.tsx(9,27): error TS2307: Cannot find module '../../src/components/viz/spatial/MapLegend.js' or its corresponding type declarations.
Error: examples/dashboards/spatial-dashboard.tsx(12,37): error TS2307: Cannot find module '../../src/components/viz/spatial/utils/size-scale-utils.js' or its corresponding type declarations.
Error: examples/dashboards/spatial-dashboard.tsx(14,67): error TS2307: Cannot find module '../../src/viz/contexts/dashboard-spatial-context.js' or its corresponding type declarations.
Error: examples/dashboards/spatial-dashboard.tsx(19,8): error TS2307: Cannot find module '../../src/viz/interactions/spatial-filter-actions.js' or its corresponding type declarations.
Error: examples/dashboards/spatial-dashboard.tsx(24,26): error TS2307: Cannot find module '../../src/components/viz/spatial/fixtures/us-states-10m.json' or its corresponding type declarations.
Error: examples/dashboards/spatial-dashboard.tsx(240,44): error TS7006: Parameter 'entry' implicitly has an 'any' type.
Error: examples/dashboards/spatial-dashboard.tsx(245,40): error TS2345: Argument of type 'Set<unknown>' is not assignable to parameter of type 'ReadonlySet<string>'.
  Types of property 'forEach' are incompatible.
    Type '(callbackfn: (value: unknown, value2: unknown, set: Set<unknown>) => void, thisArg?: any) => void' is not assignable to type '(callbackfn: (value: string, value2: string, set: ReadonlySet<string>) => void, thisArg?: any) => void'.
      Types of parameters 'callbackfn' and 'callbackfn' are incompatible.
        Types of parameters 'value' and 'value' are incompatible.
          Type 'unknown' is not assignable to type 'string'.
Error: examples/dashboards/spatial-dashboard.tsx(249,38): error TS2345: Argument of type 'Set<unknown>' is not assignable to parameter of type 'ReadonlySet<string>'.
Error: examples/dashboards/spatial-dashboard.tsx(286,9): error TS6133: 'joinedByFeature' is declared but its value is never read.
Error: examples/dashboards/spatial-dashboard.tsx(288,41): error TS7006: Parameter 'feature' implicitly has an 'any' type.
Error: examples/dashboards/spatial-dashboard.tsx(299,25): error TS2352: Conversion of type 'StateMetric' to type 'Record<string, unknown>' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
  Index signature for type 'string' is missing in type 'StateMetric'.
Error: examples/dashboards/spatial-dashboard.tsx(358,24): error TS7006: Parameter 'v' implicitly has an 'any' type.
Error: examples/dashboards/spatial-dashboard.tsx(407,30): error TS7006: Parameter 'datum' implicitly has an 'any' type.
Error: examples/dashboards/spatial-dashboard.tsx(418,24): error TS7006: Parameter 'v' implicitly has an 'any' type.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(9,40): error TS2307: Cannot find module 'geojson' or its corresponding type declarations.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(10,25): error TS2307: Cannot find module 'topojson-client' or its corresponding type declarations.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(11,31): error TS2307: Cannot find module 'topojson-specification' or its corresponding type declarations.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(12,48): error TS2307: Cannot find module './BubbleMap.js' or its corresponding type declarations.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(13,27): error TS2307: Cannot find module './MapLegend.js' or its corresponding type declarations.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(16,37): error TS2307: Cannot find module './utils/size-scale-utils.js' or its corresponding type declarations.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(20,30): error TS2307: Cannot find module './fixtures/us-states-10m.json' or its corresponding type declarations.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(21,36): error TS2307: Cannot find module './fixtures/world-countries-110m.json' or its corresponding type declarations.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(56,7): error TS6133: 'worldCountriesGeoData' is declared but its value is never read.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(162,9): error TS2322: Type '{ type: "spatial"; data: { values: BubbleMapProps; }; projection: { type: ProjectionType; fitToData: true; }; layers: { type: "symbol"; encoding: { size: { field: any; range: BubbleMapProps; } | undefined; color: { ...; } | undefined; }; }[]; a11y: BubbleMapProps; }' is not assignable to type 'SpatialSpec'.
  Types of property 'layers' are incompatible.
    Type '{ type: "symbol"; encoding: { size: { field: any; range: BubbleMapProps; } | undefined; color: { field: any; range: BubbleMapProps; } | undefined; }; }[]' is not assignable to type 'SpatialLayer[]'.
      Type '{ type: "symbol"; encoding: { size: { field: any; range: BubbleMapProps; } | undefined; color: { field: any; range: BubbleMapProps; } | undefined; }; }' is not assignable to type 'SpatialLayer'.
        Type '{ type: "symbol"; encoding: { size: { field: any; range: BubbleMapProps; } | undefined; color: { field: any; range: BubbleMapProps; } | undefined; }; }' is not assignable to type 'SymbolLayer'.
          Types of property 'encoding' are incompatible.
            Type '{ size: { field: any; range: BubbleMapProps; } | undefined; color: { field: any; range: BubbleMapProps; } | undefined; }' is missing the following properties from type '{ longitude: PositionEncoding; latitude: PositionEncoding; size?: SizeEncoding | undefined; color?: ColorEncoding | undefined; shape?: ShapeEncoding | undefined; opacity?: OpacityEncoding | undefined; }': longitude, latitude
Error: src/components/viz/spatial/BubbleMap.stories.tsx(219,44): error TS7006: Parameter 'datum' implicitly has an 'any' type.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(220,42): error TS7006: Parameter 'datum' implicitly has an 'any' type.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(345,6): error TS2740: Type '{ title: string; }' is missing the following properties from type 'BubbleStoryArgs': specProjection, clusterEnabled, clusterRadius, clusterMinPoints, and 3 more.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(378,6): error TS2740: Type '{ title: string; }' is missing the following properties from type 'BubbleStoryArgs': specProjection, clusterEnabled, clusterRadius, clusterMinPoints, and 3 more.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(411,6): error TS2740: Type '{ title: string; }' is missing the following properties from type 'BubbleStoryArgs': specProjection, clusterEnabled, clusterRadius, clusterMinPoints, and 3 more.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(444,6): error TS2740: Type '{ title: string; }' is missing the following properties from type 'BubbleStoryArgs': specProjection, clusterEnabled, clusterRadius, clusterMinPoints, and 3 more.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(476,22): error TS2740: Type '{ title: string; }' is missing the following properties from type 'BubbleStoryArgs': specProjection, clusterEnabled, clusterRadius, clusterMinPoints, and 3 more.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(508,6): error TS2740: Type '{ title: string; }' is missing the following properties from type 'BubbleStoryArgs': specProjection, clusterEnabled, clusterRadius, clusterMinPoints, and 3 more.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(10,50): error TS2307: Cannot find module 'geojson' or its corresponding type declarations.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(11,25): error TS2307: Cannot find module 'topojson-client' or its corresponding type declarations.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(12,31): error TS2307: Cannot find module 'topojson-specification' or its corresponding type declarations.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(14,48): error TS2307: Cannot find module './MapLegend.js' or its corresponding type declarations.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(23,30): error TS2307: Cannot find module './fixtures/us-states-10m.json' or its corresponding type declarations.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(24,36): error TS2307: Cannot find module './fixtures/world-countries-110m.json' or its corresponding type declarations.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(243,48): error TS2322: Type '{}' is not assignable to type 'ReactNode'.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(259,13): error TS2322: Type '{}' is not assignable to type 'ReactNode'.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(294,5): error TS2353: Object literal may only specify known properties, and 'showLegend' does not exist in type 'Partial<ArgTypes<ChoroplethMapProps>>'.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(311,5): error TS2353: Object literal may only specify known properties, and 'geoData' does not exist in type 'Partial<ChoroplethMapProps>'.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(327,6): error TS2739: Type '{ title: string; data: DataRecord[]; valueField: string; geoJoinKey: string; dataJoinKey?: string | undefined; colorScale?: ColorScaleType | undefined; colorRange?: string[] | undefined; ... 6 more ...; preferredRenderer?: "svg" | ... 2 more ... | undefined; }' is missing the following properties from type 'ChoroplethStoryArgs': geoData, showLegend, enableTooltip, enableSelection
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(334,5): error TS2353: Object literal may only specify known properties, and 'geoData' does not exist in type 'Partial<ChoroplethMapProps>'.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(353,6): error TS2739: Type '{ title: string; data: DataRecord[]; valueField: string; geoJoinKey: string; dataJoinKey?: string | undefined; colorScale?: ColorScaleType | undefined; colorRange?: string[] | undefined; ... 6 more ...; preferredRenderer?: "svg" | ... 2 more ... | undefined; }' is missing the following properties from type 'ChoroplethStoryArgs': geoData, showLegend, enableTooltip, enableSelection
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(360,5): error TS2353: Object literal may only specify known properties, and 'geoData' does not exist in type 'Partial<ChoroplethMapProps>'.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(380,6): error TS2739: Type '{ title: string; data: DataRecord[]; valueField: string; geoJoinKey: string; dataJoinKey?: string | undefined; colorScale?: ColorScaleType | undefined; colorRange?: string[] | undefined; ... 6 more ...; preferredRenderer?: "svg" | ... 2 more ... | undefined; }' is missing the following properties from type 'ChoroplethStoryArgs': geoData, showLegend, enableTooltip, enableSelection
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(390,5): error TS2353: Object literal may only specify known properties, and 'geoData' does not exist in type 'Partial<ChoroplethMapProps>'.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(409,6): error TS2739: Type '{ title: string; data: DataRecord[]; valueField: string; geoJoinKey: string; dataJoinKey?: string | undefined; colorScale?: ColorScaleType | undefined; colorRange?: string[] | undefined; ... 6 more ...; preferredRenderer?: "svg" | ... 2 more ... | undefined; }' is missing the following properties from type 'ChoroplethStoryArgs': geoData, showLegend, enableTooltip, enableSelection
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(416,5): error TS2353: Object literal may only specify known properties, and 'geoData' does not exist in type 'Partial<ChoroplethMapProps>'.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(435,6): error TS2739: Type '{ title: string; data: DataRecord[]; valueField: string; geoJoinKey: string; dataJoinKey?: string | undefined; colorScale?: ColorScaleType | undefined; colorRange?: string[] | undefined; ... 6 more ...; preferredRenderer?: "svg" | ... 2 more ... | undefined; }' is missing the following properties from type 'ChoroplethStoryArgs': geoData, showLegend, enableTooltip, enableSelection
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(442,5): error TS2353: Object literal may only specify known properties, and 'geoData' does not exist in type 'Partial<ChoroplethMapProps>'.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(460,22): error TS2739: Type '{ title: string; data: DataRecord[]; valueField: string; geoJoinKey: string; dataJoinKey?: string | undefined; colorScale?: ColorScaleType | undefined; colorRange?: string[] | undefined; ... 6 more ...; preferredRenderer?: "svg" | ... 2 more ... | undefined; }' is missing the following properties from type 'ChoroplethStoryArgs': geoData, showLegend, enableTooltip, enableSelection
Error: src/components/viz/spatial/ChoroplethMap.tsx(8,30): error TS2307: Cannot find module 'geojson' or its corresponding type declarations.
Error: src/components/viz/spatial/ChoroplethMapRegion.tsx(8,30): error TS2307: Cannot find module 'geojson' or its corresponding type declarations.
Error: src/components/viz/spatial/ChoroplethMapRegion.tsx(9,36): error TS2307: Cannot find module 'd3-geo' or its corresponding type declarations.
Error: src/components/viz/spatial/ChoroplethMapRegion.tsx(10,25): error TS2307: Cannot find module 'd3-geo' or its corresponding type declarations.
Error: src/components/viz/spatial/SpatialContainer.stories.tsx(8,49): error TS2307: Cannot find module 'geojson' or its corresponding type declarations.
Error: src/components/viz/spatial/SpatialContainer.tsx(18,49): error TS2307: Cannot find module 'geojson' or its corresponding type declarations.
Error: src/components/viz/spatial/SpatialContext.tsx(9,30): error TS2307: Cannot find module 'geojson' or its corresponding type declarations.
Error: src/components/viz/spatial/utils/choropleth-utils.ts(7,30): error TS2307: Cannot find module 'geojson' or its corresponding type declarations.
Error: src/components/viz/spatial/utils/color-scale-utils.ts(8,26): error TS2307: Cannot find module 'd3-scale' or its corresponding type declarations.
Error: src/components/viz/spatial/utils/projection-utils.ts(7,24): error TS2307: Cannot find module 'd3-geo' or its corresponding type declarations.
Error: src/components/viz/spatial/utils/projection-utils.ts(8,36): error TS2307: Cannot find module 'd3-geo' or its corresponding type declarations.
Error: src/components/viz/spatial/utils/projection-utils.ts(9,50): error TS2307: Cannot find module 'geojson' or its corresponding type declarations.
Error: src/viz/adapters/spatial/geo-format-parser.ts(7,124): error TS2307: Cannot find module 'geojson' or its corresponding type declarations.
Error: src/viz/adapters/spatial/geo-format-parser.ts(8,115): error TS2307: Cannot find module 'topojson-specification' or its corresponding type declarations.
Error: src/viz/adapters/spatial/geo-format-parser.ts(89,37): error TS2307: Cannot find module 'topojson-client' or its corresponding type declarations.
Error: src/viz/hooks/useSpatialProjection.ts(8,27): error TS2307: Cannot find module 'd3-geo' or its corresponding type declarations.
Error: src/viz/hooks/useSpatialProjection.ts(9,50): error TS2307: Cannot find module 'geojson' or its corresponding type declarations.
Error: src/viz/hooks/useSpatialSpec.ts(9,30): error TS2307: Cannot find module 'geojson' or its corresponding type declarations.
 ELIFECYCLE  Command failed with exit code 2.
 ELIFECYCLE  Command failed with exit code 2.
Error: Process completed with exit code 2.
0s


final massive commit, 
build errors:


10s
14s
Run pnpm run build

> @oods/trait-engine@0.1.0 build /home/runner/work/OODS-Foundry/OODS-Foundry
> tsc

Error: examples/dashboards/spatial-dashboard.tsx(161,46): error TS2352: Conversion of type 'Feature<Point, GeoJsonProperties>' to type 'FeatureCollection<Geometry, GeoJsonProperties>' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
Error: examples/dashboards/spatial-dashboard.tsx(286,9): error TS6133: 'joinedByFeature' is declared but its value is never read.
Error: examples/dashboards/spatial-dashboard.tsx(299,25): error TS2352: Conversion of type 'StateMetric' to type 'Record<string, unknown>' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
  Index signature for type 'string' is missing in type 'StateMetric'.
Error: src/components/viz/spatial/AccessibleMapFallback.stories.tsx(73,24): error TS2503: Cannot find namespace 'JSX'.
Error: src/components/viz/spatial/AccessibleMapFallback.stories.tsx(110,5): error TS2353: Object literal may only specify known properties, and 'showTable' does not exist in type 'Partial<ArgTypes<AccessibleMapFallbackProps>>'.
Error: src/components/viz/spatial/AccessibleMapFallback.stories.tsx(123,5): error TS2353: Object literal may only specify known properties, and 'showTable' does not exist in type 'Partial<AccessibleMapFallbackProps>'.
Error: src/components/viz/spatial/AccessibleMapFallback.stories.tsx(129,22): error TS2739: Type '{ data?: DataRecord[] | undefined; features?: Feature<Geometry, GeoJsonProperties>[] | undefined; joinedData?: Map<string, DataRecord> | undefined; table?: { ...; } | undefined; narrative?: { ...; } | undefined; alwaysVisible?: boolean | undefined; triggerLabel?: string | undefined; }' is missing the following properties from type 'FallbackStoryArgs': showTable, showNarrative, sortColumn, sortOrder
Error: src/components/viz/spatial/AccessibleMapFallback.stories.tsx(134,5): error TS2353: Object literal may only specify known properties, and 'showTable' does not exist in type 'Partial<AccessibleMapFallbackProps>'.
Error: src/components/viz/spatial/AccessibleMapFallback.stories.tsx(140,22): error TS2739: Type '{ data?: DataRecord[] | undefined; features?: Feature<Geometry, GeoJsonProperties>[] | undefined; joinedData?: Map<string, DataRecord> | undefined; table?: { ...; } | undefined; narrative?: { ...; } | undefined; alwaysVisible?: boolean | undefined; triggerLabel?: string | undefined; }' is missing the following properties from type 'FallbackStoryArgs': showTable, showNarrative, sortColumn, sortOrder
Error: src/components/viz/spatial/AccessibleMapFallback.stories.tsx(145,5): error TS2353: Object literal may only specify known properties, and 'showTable' does not exist in type 'Partial<AccessibleMapFallbackProps>'.
Error: src/components/viz/spatial/AccessibleMapFallback.stories.tsx(151,22): error TS2739: Type '{ data?: DataRecord[] | undefined; features?: Feature<Geometry, GeoJsonProperties>[] | undefined; joinedData?: Map<string, DataRecord> | undefined; table?: { ...; } | undefined; narrative?: { ...; } | undefined; alwaysVisible?: boolean | undefined; triggerLabel?: string | undefined; }' is missing the following properties from type 'FallbackStoryArgs': showTable, showNarrative, sortColumn, sortOrder
Error: src/components/viz/spatial/AccessibleMapFallback.stories.tsx(156,5): error TS2353: Object literal may only specify known properties, and 'showTable' does not exist in type 'Partial<AccessibleMapFallbackProps>'.
Error: src/components/viz/spatial/AccessibleMapFallback.stories.tsx(163,22): error TS2739: Type '{ data?: DataRecord[] | undefined; features?: Feature<Geometry, GeoJsonProperties>[] | undefined; joinedData?: Map<string, DataRecord> | undefined; table?: { ...; } | undefined; narrative?: { ...; } | undefined; alwaysVisible?: boolean | undefined; triggerLabel?: string | undefined; }' is missing the following properties from type 'FallbackStoryArgs': showTable, showNarrative, sortColumn, sortOrder
Error: src/components/viz/spatial/BubbleMap.stories.tsx(51,25): error TS2352: Conversion of type 'Feature<Point, GeoJsonProperties>' to type 'FeatureCollection<Geometry, GeoJsonProperties>' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
  Property 'features' is missing in type 'Feature<Point, GeoJsonProperties>' but required in type 'FeatureCollection<Geometry, GeoJsonProperties>'.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(53,3): error TS2769: No overload matches this call.
  The last overload gave the following error.
    Argument of type 'unknown' is not assignable to parameter of type 'string | GeometryObject<GeoJsonProperties>'.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(56,7): error TS6133: 'worldCountriesGeoData' is declared but its value is never read.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(56,31): error TS2352: Conversion of type 'Feature<Point, GeoJsonProperties>' to type 'FeatureCollection<Geometry, GeoJsonProperties>' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(58,3): error TS2769: No overload matches this call.
  The last overload gave the following error.
    Argument of type 'unknown' is not assignable to parameter of type 'string | GeometryObject<GeoJsonProperties>'.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(162,9): error TS2322: Type '{ type: "spatial"; data: { values: DataRecord[]; }; projection: { type: ProjectionType; fitToData: true; }; layers: { type: "symbol"; encoding: { size: { field: string; range: [...] | undefined; } | undefined; color: { ...; } | undefined; }; }[]; a11y: SpatialA11yConfig; }' is not assignable to type 'SpatialSpec'.
  Types of property 'layers' are incompatible.
    Type '{ type: "symbol"; encoding: { size: { field: string; range: [number, number] | undefined; } | undefined; color: { field: string; range: string[] | undefined; } | undefined; }; }[]' is not assignable to type 'SpatialLayer[]'.
      Type '{ type: "symbol"; encoding: { size: { field: string; range: [number, number] | undefined; } | undefined; color: { field: string; range: string[] | undefined; } | undefined; }; }' is not assignable to type 'SpatialLayer'.
        Type '{ type: "symbol"; encoding: { size: { field: string; range: [number, number] | undefined; } | undefined; color: { field: string; range: string[] | undefined; } | undefined; }; }' is not assignable to type 'SymbolLayer'.
          Types of property 'encoding' are incompatible.
            Type '{ size: { field: string; range: [number, number] | undefined; } | undefined; color: { field: string; range: string[] | undefined; } | undefined; }' is missing the following properties from type '{ longitude: PositionEncoding; latitude: PositionEncoding; size?: SizeEncoding | undefined; color?: ColorEncoding | undefined; shape?: ShapeEncoding | undefined; opacity?: OpacityEncoding | undefined; }': longitude, latitude
Error: src/components/viz/spatial/BubbleMap.stories.tsx(197,9): error TS2322: Type 'SpatialA11yConfig' is not assignable to type '{ description: string; ariaLabel?: string | undefined; tableFallback?: { enabled: boolean; caption: string; columns?: string[] | undefined; } | undefined; narrative?: { summary: string; keyFindings: string[]; } | undefined; }'.
  Types of property 'tableFallback' are incompatible.
    Type 'TableFallbackConfig | undefined' is not assignable to type '{ enabled: boolean; caption: string; columns?: string[] | undefined; } | undefined'.
      Type 'TableFallbackConfig' is not assignable to type '{ enabled: boolean; caption: string; columns?: string[] | undefined; }'.
        Types of property 'enabled' are incompatible.
          Type 'boolean | undefined' is not assignable to type 'boolean'.
            Type 'undefined' is not assignable to type 'boolean'.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(294,5): error TS2561: Object literal may only specify known properties, but 'specProjection' does not exist in type 'Partial<ArgTypes<BubbleMapProps>>'. Did you mean to write 'projection'?
Error: src/components/viz/spatial/BubbleMap.stories.tsx(320,5): error TS2561: Object literal may only specify known properties, but 'specProjection' does not exist in type 'Partial<BubbleMapProps>'. Did you mean to write 'projection'?
Error: src/components/viz/spatial/BubbleMap.stories.tsx(345,6): error TS2740: Type '{ title: string; spec: NormalizedVizSpecV01; geoData?: FeatureCollection<Geometry, GeoJsonProperties> | undefined; ... 15 more ...; preferredRenderer?: "svg" | ... 2 more ... | undefined; }' is missing the following properties from type 'BubbleStoryArgs': specProjection, clusterEnabled, clusterRadius, clusterMinPoints, and 3 more.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(353,5): error TS2561: Object literal may only specify known properties, but 'specProjection' does not exist in type 'Partial<BubbleMapProps>'. Did you mean to write 'projection'?
Error: src/components/viz/spatial/BubbleMap.stories.tsx(378,6): error TS2740: Type '{ title: string; spec: NormalizedVizSpecV01; geoData?: FeatureCollection<Geometry, GeoJsonProperties> | undefined; ... 15 more ...; preferredRenderer?: "svg" | ... 2 more ... | undefined; }' is missing the following properties from type 'BubbleStoryArgs': specProjection, clusterEnabled, clusterRadius, clusterMinPoints, and 3 more.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(386,5): error TS2561: Object literal may only specify known properties, but 'specProjection' does not exist in type 'Partial<BubbleMapProps>'. Did you mean to write 'projection'?
Error: src/components/viz/spatial/BubbleMap.stories.tsx(411,6): error TS2740: Type '{ title: string; spec: NormalizedVizSpecV01; geoData?: FeatureCollection<Geometry, GeoJsonProperties> | undefined; ... 15 more ...; preferredRenderer?: "svg" | ... 2 more ... | undefined; }' is missing the following properties from type 'BubbleStoryArgs': specProjection, clusterEnabled, clusterRadius, clusterMinPoints, and 3 more.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(419,5): error TS2561: Object literal may only specify known properties, but 'specProjection' does not exist in type 'Partial<BubbleMapProps>'. Did you mean to write 'projection'?
Error: src/components/viz/spatial/BubbleMap.stories.tsx(444,6): error TS2740: Type '{ title: string; spec: NormalizedVizSpecV01; geoData?: FeatureCollection<Geometry, GeoJsonProperties> | undefined; ... 15 more ...; preferredRenderer?: "svg" | ... 2 more ... | undefined; }' is missing the following properties from type 'BubbleStoryArgs': specProjection, clusterEnabled, clusterRadius, clusterMinPoints, and 3 more.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(452,5): error TS2561: Object literal may only specify known properties, but 'specProjection' does not exist in type 'Partial<BubbleMapProps>'. Did you mean to write 'projection'?
Error: src/components/viz/spatial/BubbleMap.stories.tsx(476,22): error TS2740: Type '{ title: string; spec: NormalizedVizSpecV01; geoData?: FeatureCollection<Geometry, GeoJsonProperties> | undefined; ... 15 more ...; preferredRenderer?: "svg" | ... 2 more ... | undefined; }' is missing the following properties from type 'BubbleStoryArgs': specProjection, clusterEnabled, clusterRadius, clusterMinPoints, and 3 more.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(483,5): error TS2561: Object literal may only specify known properties, but 'specProjection' does not exist in type 'Partial<BubbleMapProps>'. Did you mean to write 'projection'?
Error: src/components/viz/spatial/BubbleMap.stories.tsx(508,6): error TS2740: Type '{ title: string; spec: NormalizedVizSpecV01; geoData?: FeatureCollection<Geometry, GeoJsonProperties> | undefined; ... 15 more ...; preferredRenderer?: "svg" | ... 2 more ... | undefined; }' is missing the following properties from type 'BubbleStoryArgs': specProjection, clusterEnabled, clusterRadius, clusterMinPoints, and 3 more.
Error: src/components/viz/spatial/BubbleMap.tsx(260,56): error TS2339: Property 'copy' does not exist on type 'GeoProjection'.
Error: src/components/viz/spatial/BubbleMap.tsx(261,30): error TS2339: Property 'copy' does not exist on type 'GeoProjection'.
Error: src/components/viz/spatial/BubbleMap.tsx(296,38): error TS2345: Argument of type 'number[]' is not assignable to parameter of type '[number, number]'.
  Target requires 2 element(s) but source may have fewer.
Error: src/components/viz/spatial/BubbleMap.tsx(298,35): error TS2345: Argument of type 'number[]' is not assignable to parameter of type '[number, number]'.
Error: src/components/viz/spatial/BubbleMap.tsx(301,36): error TS2345: Argument of type 'number[]' is not assignable to parameter of type '[number, number]'.
Error: src/components/viz/spatial/BubbleMap.tsx(687,30): error TS2345: Argument of type '(params: {    data?: {        raw?: DataRecord;    };}) => void' is not assignable to parameter of type 'WithThisType<(params: ECElementEvent) => boolean | void, EChartsType>'.
  Types of parameters 'params' and 'params' are incompatible.
    Type 'ECElementEvent' is not assignable to type '{ data?: { raw?: DataRecord | undefined; } | undefined; }'.
      Types of property 'data' are incompatible.
        Type 'OptionDataItem' is not assignable to type '{ raw?: DataRecord | undefined; } | undefined'.
          Type 'null' is not assignable to type '{ raw?: DataRecord | undefined; } | undefined'.
Error: src/components/viz/spatial/BubbleMapPoint.tsx(8,33): error TS2307: Cannot find module '../../viz/adapters/spatial/geo-data-joiner.js' or its corresponding type declarations.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(53,25): error TS2352: Conversion of type 'Feature<Point, GeoJsonProperties>' to type 'FeatureCollection<Geometry, GeoJsonProperties>' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(55,3): error TS2769: No overload matches this call.
  The last overload gave the following error.
    Argument of type 'unknown' is not assignable to parameter of type 'string | GeometryObject<GeoJsonProperties>'.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(58,31): error TS2352: Conversion of type 'Feature<Point, GeoJsonProperties>' to type 'FeatureCollection<Geometry, GeoJsonProperties>' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(60,3): error TS2769: No overload matches this call.
  The last overload gave the following error.
    Argument of type 'unknown' is not assignable to parameter of type 'string | GeometryObject<GeoJsonProperties>'.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(243,48): error TS2322: Type '{}' is not assignable to type 'ReactNode'.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(259,13): error TS2322: Type '{}' is not assignable to type 'ReactNode'.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(294,5): error TS2353: Object literal may only specify known properties, and 'showLegend' does not exist in type 'Partial<ArgTypes<ChoroplethMapProps>>'.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(311,5): error TS2353: Object literal may only specify known properties, and 'geoData' does not exist in type 'Partial<ChoroplethMapProps>'.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(327,6): error TS2739: Type '{ title: string; data: DataRecord[]; valueField: string; geoJoinKey: string; dataJoinKey?: string | undefined; colorScale?: ColorScaleType | undefined; colorRange?: string[] | undefined; ... 6 more ...; preferredRenderer?: "svg" | ... 2 more ... | undefined; }' is missing the following properties from type 'ChoroplethStoryArgs': geoData, showLegend, enableTooltip, enableSelection
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(334,5): error TS2353: Object literal may only specify known properties, and 'geoData' does not exist in type 'Partial<ChoroplethMapProps>'.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(353,6): error TS2739: Type '{ title: string; data: DataRecord[]; valueField: string; geoJoinKey: string; dataJoinKey?: string | undefined; colorScale?: ColorScaleType | undefined; colorRange?: string[] | undefined; ... 6 more ...; preferredRenderer?: "svg" | ... 2 more ... | undefined; }' is missing the following properties from type 'ChoroplethStoryArgs': geoData, showLegend, enableTooltip, enableSelection
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(360,5): error TS2353: Object literal may only specify known properties, and 'geoData' does not exist in type 'Partial<ChoroplethMapProps>'.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(380,6): error TS2739: Type '{ title: string; data: DataRecord[]; valueField: string; geoJoinKey: string; dataJoinKey?: string | undefined; colorScale?: ColorScaleType | undefined; colorRange?: string[] | undefined; ... 6 more ...; preferredRenderer?: "svg" | ... 2 more ... | undefined; }' is missing the following properties from type 'ChoroplethStoryArgs': geoData, showLegend, enableTooltip, enableSelection
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(390,5): error TS2353: Object literal may only specify known properties, and 'geoData' does not exist in type 'Partial<ChoroplethMapProps>'.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(409,6): error TS2739: Type '{ title: string; data: DataRecord[]; valueField: string; geoJoinKey: string; dataJoinKey?: string | undefined; colorScale?: ColorScaleType | undefined; colorRange?: string[] | undefined; ... 6 more ...; preferredRenderer?: "svg" | ... 2 more ... | undefined; }' is missing the following properties from type 'ChoroplethStoryArgs': geoData, showLegend, enableTooltip, enableSelection
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(416,5): error TS2353: Object literal may only specify known properties, and 'geoData' does not exist in type 'Partial<ChoroplethMapProps>'.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(435,6): error TS2739: Type '{ title: string; data: DataRecord[]; valueField: string; geoJoinKey: string; dataJoinKey?: string | undefined; colorScale?: ColorScaleType | undefined; colorRange?: string[] | undefined; ... 6 more ...; preferredRenderer?: "svg" | ... 2 more ... | undefined; }' is missing the following properties from type 'ChoroplethStoryArgs': geoData, showLegend, enableTooltip, enableSelection
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(442,5): error TS2353: Object literal may only specify known properties, and 'geoData' does not exist in type 'Partial<ChoroplethMapProps>'.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(460,22): error TS2739: Type '{ title: string; data: DataRecord[]; valueField: string; geoJoinKey: string; dataJoinKey?: string | undefined; colorScale?: ColorScaleType | undefined; colorRange?: string[] | undefined; ... 6 more ...; preferredRenderer?: "svg" | ... 2 more ... | undefined; }' is missing the following properties from type 'ChoroplethStoryArgs': geoData, showLegend, enableTooltip, enableSelection
Error: src/components/viz/spatial/ChoroplethMap.tsx(641,43): error TS2339: Property 'name' does not exist on type '{ __featureKey?: string | undefined; }'.
Error: src/components/viz/spatial/ChoroplethMap.tsx(656,43): error TS2339: Property 'name' does not exist on type '{ __featureKey?: string | undefined; }'.
Error: src/components/viz/spatial/ChoroplethMap.tsx(674,30): error TS2345: Argument of type '(params: {    name?: string;    data?: {        __featureKey?: string;    };}) => void' is not assignable to parameter of type 'WithThisType<(params: ECElementEvent) => boolean | void, EChartsType>'.
  Types of parameters 'params' and 'params' are incompatible.
    Type 'ECElementEvent' is not assignable to type '{ name?: string | undefined; data?: { __featureKey?: string | undefined; } | undefined; }'.
      Types of property 'data' are incompatible.
        Type 'OptionDataItem' is not assignable to type '{ __featureKey?: string | undefined; } | undefined'.
          Type 'null' is not assignable to type '{ __featureKey?: string | undefined; } | undefined'.
Error: src/components/viz/spatial/ChoroplethMap.tsx(675,34): error TS2345: Argument of type '(params: {    name?: string;    data?: {        __featureKey?: string;    };}) => void' is not assignable to parameter of type 'WithThisType<(params: ECElementEvent) => boolean | void, EChartsType>'.
  Types of parameters 'params' and 'params' are incompatible.
    Type 'ECElementEvent' is not assignable to type '{ name?: string | undefined; data?: { __featureKey?: string | undefined; } | undefined; }'.
      Types of property 'data' are incompatible.
        Type 'OptionDataItem' is not assignable to type '{ __featureKey?: string | undefined; } | undefined'.
          Type 'null' is not assignable to type '{ __featureKey?: string | undefined; } | undefined'.
Error: src/components/viz/spatial/ChoroplethMap.tsx(728,56): error TS2339: Property 'copy' does not exist on type 'GeoProjection'.
Error: src/components/viz/spatial/ChoroplethMap.tsx(729,30): error TS2339: Property 'copy' does not exist on type 'GeoProjection'.
Error: src/components/viz/spatial/MapControls.stories.tsx(25,96): error TS2503: Cannot find namespace 'JSX'.
Error: src/components/viz/spatial/MapControls.stories.tsx(94,5): error TS2353: Object literal may only specify known properties, and 'showZoom' does not exist in type 'Partial<ArgTypes<MapControlsProps>>'.
Error: src/components/viz/spatial/MapControls.stories.tsx(105,5): error TS2353: Object literal may only specify known properties, and 'showZoom' does not exist in type 'Partial<MapControlsProps>'.
Error: src/components/viz/spatial/MapControls.stories.tsx(110,22): error TS2739: Type '{ onZoomIn?: (() => void) | undefined; onZoomOut?: (() => void) | undefined; onZoomReset?: (() => void) | undefined; zoomLevel?: number | undefined; minZoom?: number | undefined; maxZoom?: number | undefined; layers?: { ...; }[] | undefined; onLayerToggle?: ((layerId: string, visible: boolean) => void) | undefined; ...' is missing the following properties from type 'ControlsStoryArgs': showZoom, showReset, showLayerToggles
Error: src/components/viz/spatial/MapControls.stories.tsx(115,5): error TS2353: Object literal may only specify known properties, and 'showZoom' does not exist in type 'Partial<MapControlsProps>'.
Error: src/components/viz/spatial/MapControls.stories.tsx(120,22): error TS2739: Type '{ onZoomIn?: (() => void) | undefined; onZoomOut?: (() => void) | undefined; onZoomReset?: (() => void) | undefined; zoomLevel?: number | undefined; minZoom?: number | undefined; maxZoom?: number | undefined; layers?: { ...; }[] | undefined; onLayerToggle?: ((layerId: string, visible: boolean) => void) | undefined; ...' is missing the following properties from type 'ControlsStoryArgs': showZoom, showReset, showLayerToggles
Error: src/components/viz/spatial/MapControls.stories.tsx(125,5): error TS2353: Object literal may only specify known properties, and 'showZoom' does not exist in type 'Partial<MapControlsProps>'.
Error: src/components/viz/spatial/MapControls.stories.tsx(130,22): error TS2739: Type '{ onZoomIn?: (() => void) | undefined; onZoomOut?: (() => void) | undefined; onZoomReset?: (() => void) | undefined; zoomLevel?: number | undefined; minZoom?: number | undefined; maxZoom?: number | undefined; layers?: { ...; }[] | undefined; onLayerToggle?: ((layerId: string, visible: boolean) => void) | undefined; ...' is missing the following properties from type 'ControlsStoryArgs': showZoom, showReset, showLayerToggles
Error: src/components/viz/spatial/MapControls.stories.tsx(135,5): error TS2353: Object literal may only specify known properties, and 'showZoom' does not exist in type 'Partial<MapControlsProps>'.
Error: src/components/viz/spatial/MapControls.stories.tsx(145,8): error TS2739: Type '{ onZoomIn?: (() => void) | undefined; onZoomOut?: (() => void) | undefined; onZoomReset?: (() => void) | undefined; zoomLevel?: number | undefined; minZoom?: number | undefined; maxZoom?: number | undefined; layers?: { ...; }[] | undefined; onLayerToggle?: ((layerId: string, visible: boolean) => void) | undefined; ...' is missing the following properties from type 'ControlsStoryArgs': showZoom, showReset, showLayerToggles
Error: src/components/viz/spatial/MapControls.tsx(61,24): error TS2339: Property 'id' does not exist on type 'SpatialLayer'.
  Property 'id' does not exist on type 'RegionFillLayer'.
Error: src/components/viz/spatial/MapControls.tsx(61,48): error TS2339: Property 'id' does not exist on type 'SpatialLayer'.
  Property 'id' does not exist on type 'RegionFillLayer'.
Error: src/components/viz/spatial/MapLegend.stories.tsx(36,72): error TS2503: Cannot find namespace 'JSX'.
Error: src/components/viz/spatial/MapLegend.stories.tsx(62,9): error TS2322: Type '{ type: string; scale: ColorScale; label: string; format: (v: number) => string; } | { type: string; scale: ColorScale; label: string; format?: undefined; } | undefined' is not assignable to type '{ type: "categorical" | "continuous"; scale: ColorScale; label?: string | undefined; format?: ((value: number) => string) | undefined; } | undefined'.
  Type '{ type: string; scale: ColorScale; label: string; format: (v: number) => string; }' is not assignable to type '{ type: "categorical" | "continuous"; scale: ColorScale; label?: string | undefined; format?: ((value: number) => string) | undefined; }'.
    Types of property 'type' are incompatible.
      Type 'string' is not assignable to type '"categorical" | "continuous"'.
Error: src/components/viz/spatial/MapLegend.stories.tsx(85,5): error TS2353: Object literal may only specify known properties, and 'legendType' does not exist in type 'Partial<ArgTypes<MapLegendProps>>'.
Error: src/components/viz/spatial/MapLegend.stories.tsx(95,5): error TS2353: Object literal may only specify known properties, and 'legendType' does not exist in type 'Partial<MapLegendProps>'.
Error: src/components/viz/spatial/MapLegend.stories.tsx(99,22): error TS2739: Type '{ colorScale?: { type: "categorical" | "continuous"; scale: ColorScale; label?: string | undefined; format?: ((value: number) => string) | undefined; } | undefined; sizeScale?: { ...; } | undefined; position?: Position | undefined; orientation?: "horizontal" | ... 1 more ... | undefined; className?: string | undefin...' is missing the following properties from type 'LegendStoryArgs': legendType, title
Error: src/components/viz/spatial/MapLegend.stories.tsx(104,5): error TS2353: Object literal may only specify known properties, and 'legendType' does not exist in type 'Partial<MapLegendProps>'.
Error: src/components/viz/spatial/MapLegend.stories.tsx(108,22): error TS2739: Type '{ colorScale?: { type: "categorical" | "continuous"; scale: ColorScale; label?: string | undefined; format?: ((value: number) => string) | undefined; } | undefined; sizeScale?: { ...; } | undefined; position?: Position | undefined; orientation?: "horizontal" | ... 1 more ... | undefined; className?: string | undefin...' is missing the following properties from type 'LegendStoryArgs': legendType, title
Error: src/components/viz/spatial/MapLegend.stories.tsx(113,5): error TS2353: Object literal may only specify known properties, and 'legendType' does not exist in type 'Partial<MapLegendProps>'.
Error: src/components/viz/spatial/MapLegend.stories.tsx(117,22): error TS2739: Type '{ colorScale?: { type: "categorical" | "continuous"; scale: ColorScale; label?: string | undefined; format?: ((value: number) => string) | undefined; } | undefined; sizeScale?: { ...; } | undefined; position?: Position | undefined; orientation?: "horizontal" | ... 1 more ... | undefined; className?: string | undefin...' is missing the following properties from type 'LegendStoryArgs': legendType, title
Error: src/components/viz/spatial/MapLegend.stories.tsx(122,5): error TS2353: Object literal may only specify known properties, and 'legendType' does not exist in type 'Partial<MapLegendProps>'.
Error: src/components/viz/spatial/MapLegend.stories.tsx(126,22): error TS2739: Type '{ colorScale?: { type: "categorical" | "continuous"; scale: ColorScale; label?: string | undefined; format?: ((value: number) => string) | undefined; } | undefined; sizeScale?: { ...; } | undefined; position?: Position | undefined; orientation?: "horizontal" | ... 1 more ... | undefined; className?: string | undefin...' is missing the following properties from type 'LegendStoryArgs': legendType, title
Error: src/components/viz/spatial/SpatialContainer.stories.tsx(43,25): error TS2352: Conversion of type 'Feature<Point, GeoJsonProperties>' to type 'FeatureCollection<Geometry, GeoJsonProperties>' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
Error: src/components/viz/spatial/SpatialContainer.stories.tsx(45,3): error TS2769: No overload matches this call.
  The last overload gave the following error.
    Argument of type 'unknown' is not assignable to parameter of type 'string | GeometryObject<GeoJsonProperties>'.
Error: src/components/viz/spatial/SpatialContainer.stories.tsx(49,31): error TS2352: Conversion of type 'Feature<Point, GeoJsonProperties>' to type 'FeatureCollection<Geometry, GeoJsonProperties>' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
Error: src/components/viz/spatial/SpatialContainer.stories.tsx(51,3): error TS2769: No overload matches this call.
  The last overload gave the following error.
    Argument of type 'unknown' is not assignable to parameter of type 'string | GeometryObject<GeoJsonProperties>'.
Error: src/components/viz/spatial/SpatialContainer.tsx(245,38): error TS2345: Argument of type 'RefObject<HTMLDivElement | null>' is not assignable to parameter of type 'RefObject<HTMLElement>'.
  Type 'HTMLDivElement | null' is not assignable to type 'HTMLElement'.
    Type 'null' is not assignable to type 'HTMLElement'.
Error: src/viz/adapters/spatial/echarts-bubble-adapter.ts(157,29): error TS2538: Type 'undefined' cannot be used as an index type.
Error: src/viz/adapters/spatial/echarts-bubble-adapter.ts(199,9): error TS2322: Type '{ type: "scatter"; coordinateSystem: string; geoIndex: number; name: string; data: { name: string; value: (number | null)[]; raw: DataRecord; itemStyle: { color: string; } | undefined; }[]; symbolSize: (value: unknown) => number; encode: { ...; }; tooltip: { ...; }; }' is not assignable to type 'ScatterSeriesOption$1'.
  Type '{ type: "scatter"; coordinateSystem: string; geoIndex: number; name: string; data: { name: string; value: (number | null)[]; raw: DataRecord; itemStyle: { color: string; } | undefined; }[]; symbolSize: (value: unknown) => number; encode: { ...; }; tooltip: { ...; }; }' is not assignable to type 'SeriesInjectedOption'.
    Types of property 'tooltip' are incompatible.
      Type '{ formatter: (params: { readonly data?: Record<string, unknown> | undefined; readonly name?: string | undefined; }) => string; }' is not assignable to type 'SeriesTooltipOption'.
        Type '{ formatter: (params: { readonly data?: Record<string, unknown> | undefined; readonly name?: string | undefined; }) => string; }' is not assignable to type 'CommonTooltipOption<CallbackDataParams>'.
          Types of property 'formatter' are incompatible.
            Type '(params: { readonly data?: Record<string, unknown> | undefined; readonly name?: string | undefined; }) => string' is not assignable to type 'string | TooltipFormatterCallback<CallbackDataParams> | undefined'.
              Type '(params: { readonly data?: Record<string, unknown> | undefined; readonly name?: string | undefined; }) => string' is not assignable to type 'TooltipFormatterCallback<CallbackDataParams>'.
                Types of parameters 'params' and 'params' are incompatible.
                  Type 'CallbackDataParams' is not assignable to type '{ readonly data?: Record<string, unknown> | undefined; readonly name?: string | undefined; }'.
                    Types of property 'data' are incompatible.
                      Type 'OptionDataItem' is not assignable to type 'Record<string, unknown> | undefined'.
                        Type 'null' is not assignable to type 'Record<string, unknown> | undefined'.
Error: src/viz/adapters/spatial/echarts-bubble-adapter.ts(255,9): error TS2322: Type '{ geo: GeoComponentOption; visualMap: VisualMapComponentOption | undefined; series: ScatterSeriesOption[]; tooltip: { ...; }; aria: { ...; }; title: { ...; } | undefined; usermeta: { ...; }; }' is not assignable to type 'EChartsOption'.
  Types of property 'tooltip' are incompatible.
    Type '{ trigger: "item"; formatter: (params: { readonly data?: Record<string, unknown> | undefined; readonly name?: string | undefined; }) => string; }' is not assignable to type 'TooltipOption | TooltipOption[] | undefined'.
      Type '{ trigger: "item"; formatter: (params: { readonly data?: Record<string, unknown> | undefined; readonly name?: string | undefined; }) => string; }' is not assignable to type 'TooltipOption'.
        Types of property 'formatter' are incompatible.
          Type '(params: { readonly data?: Record<string, unknown> | undefined; readonly name?: string | undefined; }) => string' is not assignable to type 'string | TooltipFormatterCallback<TopLevelFormatterParams> | undefined'.
            Type '(params: { readonly data?: Record<string, unknown> | undefined; readonly name?: string | undefined; }) => string' is not assignable to type 'TooltipFormatterCallback<TopLevelFormatterParams>'.
              Types of parameters 'params' and 'params' are incompatible.
                Type 'TopLevelFormatterParams' is not assignable to type '{ readonly data?: Record<string, unknown> | undefined; readonly name?: string | undefined; }'.
                  Type 'CallbackDataParams' is not assignable to type '{ readonly data?: Record<string, unknown> | undefined; readonly name?: string | undefined; }'.
Error: src/viz/adapters/spatial/echarts-choropleth-adapter.ts(131,9): error TS2322: Type '{ type: "map"; map: string; geoIndex: number; name: string; data: { name: string; value: number | null; rawProperties: Record<string, unknown> | undefined; }[]; emphasis: { focus: string; }; }' is not assignable to type 'MapSeriesOption$1'.
  Type '{ type: "map"; map: string; geoIndex: number; name: string; data: { name: string; value: number | null; rawProperties: Record<string, unknown> | undefined; }[]; emphasis: { focus: string; }; }' is not assignable to type 'MapSeriesOption'.
    Types of property 'data' are incompatible.
      Type '{ name: string; value: number | null; rawProperties: Record<string, unknown> | undefined; }[]' is not assignable to type '(OptionDataValueNumeric | OptionDataValueNumeric[] | MapDataItemOption)[]'.
        Type '{ name: string; value: number | null; rawProperties: Record<string, unknown> | undefined; }' is not assignable to type 'OptionDataValueNumeric | OptionDataValueNumeric[] | MapDataItemOption'.
          Type '{ name: string; value: number | null; rawProperties: Record<string, unknown> | undefined; }' is not assignable to type 'MapDataItemOption'.
            Types of property 'value' are incompatible.
              Type 'number | null' is not assignable to type 'OptionDataValueNumeric | OptionDataValueNumeric[] | undefined'.
                Type 'null' is not assignable to type 'OptionDataValueNumeric | OptionDataValueNumeric[] | undefined'.
Error: src/viz/adapters/spatial/echarts-choropleth-adapter.ts(169,9): error TS2322: Type '{ geo: GeoComponentOption; visualMap: VisualMapComponentOption; series: MapSeriesOption[]; tooltip: { trigger: "item"; formatter: (params: { ...; }) => string; }; aria: { ...; }; title: { ...; } | undefined; usermeta: { ...; }; }' is not assignable to type 'EChartsOption'.
  Types of property 'tooltip' are incompatible.
    Type '{ trigger: "item"; formatter: (params: { readonly data?: Record<string, unknown> | undefined; readonly name?: string | undefined; }) => string; }' is not assignable to type 'TooltipOption | TooltipOption[] | undefined'.
      Type '{ trigger: "item"; formatter: (params: { readonly data?: Record<string, unknown> | undefined; readonly name?: string | undefined; }) => string; }' is not assignable to type 'TooltipOption'.
        Types of property 'formatter' are incompatible.
          Type '(params: { readonly data?: Record<string, unknown> | undefined; readonly name?: string | undefined; }) => string' is not assignable to type 'string | TooltipFormatterCallback<TopLevelFormatterParams> | undefined'.
Error: src/viz/adapters/spatial/index.ts(14,1): error TS2308: Module './vega-lite-choropleth-adapter.js' has already exported a member named 'VegaLiteLayer'. Consider explicitly re-exporting to resolve the ambiguity.
Error: src/viz/adapters/spatial/vega-lite-bubble-adapter.ts(8,54): error TS2339: Property 'layer' does not exist on type 'TopLevelSpec'.
Error: src/viz/adapters/spatial/vega-lite-choropleth-adapter.ts(7,54): error TS2339: Property 'layer' does not exist on type 'TopLevelSpec'.
Error: src/viz/adapters/spatial/vega-lite-projection-map.ts(1,33): error TS2307: Cannot find module 'vega-lite/build/src/projection' or its corresponding type declarations.
Error: src/viz/adapters/spatial/vega-lite-scale-map.ts(1,28): error TS2307: Cannot find module 'vega-lite/build/src/scale' or its corresponding type declarations.
Error: src/viz/adapters/spatial/vega-lite-spatial-adapter.ts(118,3): error TS2344: Type '"title" | "description" | "width" | "height" | "padding" | "$schema" | "usermeta" | "projection"' does not satisfy the constraint '"title" | "name" | "description" | "data" | "background" | "padding" | "autosize" | "transform" | "$schema" | "config" | "params" | "usermeta" | "resolve" | "datasets"'.
  Type '"width"' is not assignable to type '"title" | "name" | "description" | "data" | "background" | "padding" | "autosize" | "transform" | "$schema" | "config" | "params" | "usermeta" | "resolve" | "datasets"'.
Error: src/viz/adapters/spatial/vega-lite-spatial-adapter.ts(180,9): error TS2322: Type '{ layer: any[]; title?: Text | TitleParams<ExprRef | SignalRef> | undefined; description?: string | undefined; width: unknown; height: unknown; padding?: ExprRef | SignalRef | Padding | undefined; $schema?: string | undefined; usermeta?: Dict<...> | undefined; projection: unknown; }' is not assignable to type 'TopLevelSpec'.
  Type '{ layer: any[]; title?: Text | TitleParams<ExprRef | SignalRef> | undefined; description?: string | undefined; width: unknown; height: unknown; padding?: ExprRef | SignalRef | Padding | undefined; $schema?: string | undefined; usermeta?: Dict<...> | undefined; projection: unknown; }' is not assignable to type 'TopLevel<LayerSpec<Field>>'.
    Type '{ layer: any[]; title?: Text | TitleParams<ExprRef | SignalRef> | undefined; description?: string | undefined; width: unknown; height: unknown; padding?: ExprRef | SignalRef | Padding | undefined; $schema?: string | undefined; usermeta?: Dict<...> | undefined; projection: unknown; }' is not assignable to type 'LayerSpec<Field>'.
      Types of property 'projection' are incompatible.
        Type 'unknown' is not assignable to type 'Projection<ExprRef> | undefined'.
Error: src/viz/patterns/spatial-detection.ts(202,6): error TS6196: '_KeepSpatialSpec' is declared but never used.
 ELIFECYCLE  Command failed with exit code 2.
Error: Process completed with exit code 2.
14s
Run pnpm run build

> @oods/trait-engine@0.1.0 build /home/runner/work/OODS-Foundry/OODS-Foundry
> tsc

Error: examples/dashboards/spatial-dashboard.tsx(161,46): error TS2352: Conversion of type 'Feature<Point, GeoJsonProperties>' to type 'FeatureCollection<Geometry, GeoJsonProperties>' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
Error: examples/dashboards/spatial-dashboard.tsx(286,9): error TS6133: 'joinedByFeature' is declared but its value is never read.
Error: examples/dashboards/spatial-dashboard.tsx(299,25): error TS2352: Conversion of type 'StateMetric' to type 'Record<string, unknown>' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
  Index signature for type 'string' is missing in type 'StateMetric'.
Error: src/components/viz/spatial/AccessibleMapFallback.stories.tsx(73,24): error TS2503: Cannot find namespace 'JSX'.
Error: src/components/viz/spatial/AccessibleMapFallback.stories.tsx(110,5): error TS2353: Object literal may only specify known properties, and 'showTable' does not exist in type 'Partial<ArgTypes<AccessibleMapFallbackProps>>'.
Error: src/components/viz/spatial/AccessibleMapFallback.stories.tsx(123,5): error TS2353: Object literal may only specify known properties, and 'showTable' does not exist in type 'Partial<AccessibleMapFallbackProps>'.
Error: src/components/viz/spatial/AccessibleMapFallback.stories.tsx(129,22): error TS2739: Type '{ data?: DataRecord[] | undefined; features?: Feature<Geometry, GeoJsonProperties>[] | undefined; joinedData?: Map<string, DataRecord> | undefined; table?: { ...; } | undefined; narrative?: { ...; } | undefined; alwaysVisible?: boolean | undefined; triggerLabel?: string | undefined; }' is missing the following properties from type 'FallbackStoryArgs': showTable, showNarrative, sortColumn, sortOrder
Error: src/components/viz/spatial/AccessibleMapFallback.stories.tsx(134,5): error TS2353: Object literal may only specify known properties, and 'showTable' does not exist in type 'Partial<AccessibleMapFallbackProps>'.
Error: src/components/viz/spatial/AccessibleMapFallback.stories.tsx(140,22): error TS2739: Type '{ data?: DataRecord[] | undefined; features?: Feature<Geometry, GeoJsonProperties>[] | undefined; joinedData?: Map<string, DataRecord> | undefined; table?: { ...; } | undefined; narrative?: { ...; } | undefined; alwaysVisible?: boolean | undefined; triggerLabel?: string | undefined; }' is missing the following properties from type 'FallbackStoryArgs': showTable, showNarrative, sortColumn, sortOrder
Error: src/components/viz/spatial/AccessibleMapFallback.stories.tsx(145,5): error TS2353: Object literal may only specify known properties, and 'showTable' does not exist in type 'Partial<AccessibleMapFallbackProps>'.
Error: src/components/viz/spatial/AccessibleMapFallback.stories.tsx(151,22): error TS2739: Type '{ data?: DataRecord[] | undefined; features?: Feature<Geometry, GeoJsonProperties>[] | undefined; joinedData?: Map<string, DataRecord> | undefined; table?: { ...; } | undefined; narrative?: { ...; } | undefined; alwaysVisible?: boolean | undefined; triggerLabel?: string | undefined; }' is missing the following properties from type 'FallbackStoryArgs': showTable, showNarrative, sortColumn, sortOrder
Error: src/components/viz/spatial/AccessibleMapFallback.stories.tsx(156,5): error TS2353: Object literal may only specify known properties, and 'showTable' does not exist in type 'Partial<AccessibleMapFallbackProps>'.
Error: src/components/viz/spatial/AccessibleMapFallback.stories.tsx(163,22): error TS2739: Type '{ data?: DataRecord[] | undefined; features?: Feature<Geometry, GeoJsonProperties>[] | undefined; joinedData?: Map<string, DataRecord> | undefined; table?: { ...; } | undefined; narrative?: { ...; } | undefined; alwaysVisible?: boolean | undefined; triggerLabel?: string | undefined; }' is missing the following properties from type 'FallbackStoryArgs': showTable, showNarrative, sortColumn, sortOrder
Error: src/components/viz/spatial/BubbleMap.stories.tsx(51,25): error TS2352: Conversion of type 'Feature<Point, GeoJsonProperties>' to type 'FeatureCollection<Geometry, GeoJsonProperties>' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
  Property 'features' is missing in type 'Feature<Point, GeoJsonProperties>' but required in type 'FeatureCollection<Geometry, GeoJsonProperties>'.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(53,3): error TS2769: No overload matches this call.
  The last overload gave the following error.
    Argument of type 'unknown' is not assignable to parameter of type 'string | GeometryObject<GeoJsonProperties>'.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(56,7): error TS6133: 'worldCountriesGeoData' is declared but its value is never read.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(56,31): error TS2352: Conversion of type 'Feature<Point, GeoJsonProperties>' to type 'FeatureCollection<Geometry, GeoJsonProperties>' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(58,3): error TS2769: No overload matches this call.
  The last overload gave the following error.
    Argument of type 'unknown' is not assignable to parameter of type 'string | GeometryObject<GeoJsonProperties>'.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(162,9): error TS2322: Type '{ type: "spatial"; data: { values: DataRecord[]; }; projection: { type: ProjectionType; fitToData: true; }; layers: { type: "symbol"; encoding: { size: { field: string; range: [...] | undefined; } | undefined; color: { ...; } | undefined; }; }[]; a11y: SpatialA11yConfig; }' is not assignable to type 'SpatialSpec'.
  Types of property 'layers' are incompatible.
    Type '{ type: "symbol"; encoding: { size: { field: string; range: [number, number] | undefined; } | undefined; color: { field: string; range: string[] | undefined; } | undefined; }; }[]' is not assignable to type 'SpatialLayer[]'.
      Type '{ type: "symbol"; encoding: { size: { field: string; range: [number, number] | undefined; } | undefined; color: { field: string; range: string[] | undefined; } | undefined; }; }' is not assignable to type 'SpatialLayer'.
        Type '{ type: "symbol"; encoding: { size: { field: string; range: [number, number] | undefined; } | undefined; color: { field: string; range: string[] | undefined; } | undefined; }; }' is not assignable to type 'SymbolLayer'.
          Types of property 'encoding' are incompatible.
            Type '{ size: { field: string; range: [number, number] | undefined; } | undefined; color: { field: string; range: string[] | undefined; } | undefined; }' is missing the following properties from type '{ longitude: PositionEncoding; latitude: PositionEncoding; size?: SizeEncoding | undefined; color?: ColorEncoding | undefined; shape?: ShapeEncoding | undefined; opacity?: OpacityEncoding | undefined; }': longitude, latitude
Error: src/components/viz/spatial/BubbleMap.stories.tsx(197,9): error TS2322: Type 'SpatialA11yConfig' is not assignable to type '{ description: string; ariaLabel?: string | undefined; tableFallback?: { enabled: boolean; caption: string; columns?: string[] | undefined; } | undefined; narrative?: { summary: string; keyFindings: string[]; } | undefined; }'.
  Types of property 'tableFallback' are incompatible.
    Type 'TableFallbackConfig | undefined' is not assignable to type '{ enabled: boolean; caption: string; columns?: string[] | undefined; } | undefined'.
      Type 'TableFallbackConfig' is not assignable to type '{ enabled: boolean; caption: string; columns?: string[] | undefined; }'.
        Types of property 'enabled' are incompatible.
          Type 'boolean | undefined' is not assignable to type 'boolean'.
            Type 'undefined' is not assignable to type 'boolean'.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(294,5): error TS2561: Object literal may only specify known properties, but 'specProjection' does not exist in type 'Partial<ArgTypes<BubbleMapProps>>'. Did you mean to write 'projection'?
Error: src/components/viz/spatial/BubbleMap.stories.tsx(320,5): error TS2561: Object literal may only specify known properties, but 'specProjection' does not exist in type 'Partial<BubbleMapProps>'. Did you mean to write 'projection'?
Error: src/components/viz/spatial/BubbleMap.stories.tsx(345,6): error TS2740: Type '{ title: string; spec: NormalizedVizSpecV01; geoData?: FeatureCollection<Geometry, GeoJsonProperties> | undefined; ... 15 more ...; preferredRenderer?: "svg" | ... 2 more ... | undefined; }' is missing the following properties from type 'BubbleStoryArgs': specProjection, clusterEnabled, clusterRadius, clusterMinPoints, and 3 more.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(353,5): error TS2561: Object literal may only specify known properties, but 'specProjection' does not exist in type 'Partial<BubbleMapProps>'. Did you mean to write 'projection'?
Error: src/components/viz/spatial/BubbleMap.stories.tsx(378,6): error TS2740: Type '{ title: string; spec: NormalizedVizSpecV01; geoData?: FeatureCollection<Geometry, GeoJsonProperties> | undefined; ... 15 more ...; preferredRenderer?: "svg" | ... 2 more ... | undefined; }' is missing the following properties from type 'BubbleStoryArgs': specProjection, clusterEnabled, clusterRadius, clusterMinPoints, and 3 more.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(386,5): error TS2561: Object literal may only specify known properties, but 'specProjection' does not exist in type 'Partial<BubbleMapProps>'. Did you mean to write 'projection'?
Error: src/components/viz/spatial/BubbleMap.stories.tsx(411,6): error TS2740: Type '{ title: string; spec: NormalizedVizSpecV01; geoData?: FeatureCollection<Geometry, GeoJsonProperties> | undefined; ... 15 more ...; preferredRenderer?: "svg" | ... 2 more ... | undefined; }' is missing the following properties from type 'BubbleStoryArgs': specProjection, clusterEnabled, clusterRadius, clusterMinPoints, and 3 more.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(419,5): error TS2561: Object literal may only specify known properties, but 'specProjection' does not exist in type 'Partial<BubbleMapProps>'. Did you mean to write 'projection'?
Error: src/components/viz/spatial/BubbleMap.stories.tsx(444,6): error TS2740: Type '{ title: string; spec: NormalizedVizSpecV01; geoData?: FeatureCollection<Geometry, GeoJsonProperties> | undefined; ... 15 more ...; preferredRenderer?: "svg" | ... 2 more ... | undefined; }' is missing the following properties from type 'BubbleStoryArgs': specProjection, clusterEnabled, clusterRadius, clusterMinPoints, and 3 more.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(452,5): error TS2561: Object literal may only specify known properties, but 'specProjection' does not exist in type 'Partial<BubbleMapProps>'. Did you mean to write 'projection'?
Error: src/components/viz/spatial/BubbleMap.stories.tsx(476,22): error TS2740: Type '{ title: string; spec: NormalizedVizSpecV01; geoData?: FeatureCollection<Geometry, GeoJsonProperties> | undefined; ... 15 more ...; preferredRenderer?: "svg" | ... 2 more ... | undefined; }' is missing the following properties from type 'BubbleStoryArgs': specProjection, clusterEnabled, clusterRadius, clusterMinPoints, and 3 more.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(483,5): error TS2561: Object literal may only specify known properties, but 'specProjection' does not exist in type 'Partial<BubbleMapProps>'. Did you mean to write 'projection'?
Error: src/components/viz/spatial/BubbleMap.stories.tsx(508,6): error TS2740: Type '{ title: string; spec: NormalizedVizSpecV01; geoData?: FeatureCollection<Geometry, GeoJsonProperties> | undefined; ... 15 more ...; preferredRenderer?: "svg" | ... 2 more ... | undefined; }' is missing the following properties from type 'BubbleStoryArgs': specProjection, clusterEnabled, clusterRadius, clusterMinPoints, and 3 more.
Error: src/components/viz/spatial/BubbleMap.tsx(260,56): error TS2339: Property 'copy' does not exist on type 'GeoProjection'.
Error: src/components/viz/spatial/BubbleMap.tsx(261,30): error TS2339: Property 'copy' does not exist on type 'GeoProjection'.
Error: src/components/viz/spatial/BubbleMap.tsx(296,38): error TS2345: Argument of type 'number[]' is not assignable to parameter of type '[number, number]'.
  Target requires 2 element(s) but source may have fewer.
Error: src/components/viz/spatial/BubbleMap.tsx(298,35): error TS2345: Argument of type 'number[]' is not assignable to parameter of type '[number, number]'.
Error: src/components/viz/spatial/BubbleMap.tsx(301,36): error TS2345: Argument of type 'number[]' is not assignable to parameter of type '[number, number]'.
Error: src/components/viz/spatial/BubbleMap.tsx(687,30): error TS2345: Argument of type '(params: {    data?: {        raw?: DataRecord;    };}) => void' is not assignable to parameter of type 'WithThisType<(params: ECElementEvent) => boolean | void, EChartsType>'.
  Types of parameters 'params' and 'params' are incompatible.
    Type 'ECElementEvent' is not assignable to type '{ data?: { raw?: DataRecord | undefined; } | undefined; }'.
      Types of property 'data' are incompatible.
        Type 'OptionDataItem' is not assignable to type '{ raw?: DataRecord | undefined; } | undefined'.
          Type 'null' is not assignable to type '{ raw?: DataRecord | undefined; } | undefined'.
Error: src/components/viz/spatial/BubbleMapPoint.tsx(8,33): error TS2307: Cannot find module '../../viz/adapters/spatial/geo-data-joiner.js' or its corresponding type declarations.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(53,25): error TS2352: Conversion of type 'Feature<Point, GeoJsonProperties>' to type 'FeatureCollection<Geometry, GeoJsonProperties>' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(55,3): error TS2769: No overload matches this call.
  The last overload gave the following error.
    Argument of type 'unknown' is not assignable to parameter of type 'string | GeometryObject<GeoJsonProperties>'.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(58,31): error TS2352: Conversion of type 'Feature<Point, GeoJsonProperties>' to type 'FeatureCollection<Geometry, GeoJsonProperties>' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(60,3): error TS2769: No overload matches this call.
  The last overload gave the following error.
    Argument of type 'unknown' is not assignable to parameter of type 'string | GeometryObject<GeoJsonProperties>'.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(243,48): error TS2322: Type '{}' is not assignable to type 'ReactNode'.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(259,13): error TS2322: Type '{}' is not assignable to type 'ReactNode'.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(294,5): error TS2353: Object literal may only specify known properties, and 'showLegend' does not exist in type 'Partial<ArgTypes<ChoroplethMapProps>>'.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(311,5): error TS2353: Object literal may only specify known properties, and 'geoData' does not exist in type 'Partial<ChoroplethMapProps>'.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(327,6): error TS2739: Type '{ title: string; data: DataRecord[]; valueField: string; geoJoinKey: string; dataJoinKey?: string | undefined; colorScale?: ColorScaleType | undefined; colorRange?: string[] | undefined; ... 6 more ...; preferredRenderer?: "svg" | ... 2 more ... | undefined; }' is missing the following properties from type 'ChoroplethStoryArgs': geoData, showLegend, enableTooltip, enableSelection
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(334,5): error TS2353: Object literal may only specify known properties, and 'geoData' does not exist in type 'Partial<ChoroplethMapProps>'.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(353,6): error TS2739: Type '{ title: string; data: DataRecord[]; valueField: string; geoJoinKey: string; dataJoinKey?: string | undefined; colorScale?: ColorScaleType | undefined; colorRange?: string[] | undefined; ... 6 more ...; preferredRenderer?: "svg" | ... 2 more ... | undefined; }' is missing the following properties from type 'ChoroplethStoryArgs': geoData, showLegend, enableTooltip, enableSelection
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(360,5): error TS2353: Object literal may only specify known properties, and 'geoData' does not exist in type 'Partial<ChoroplethMapProps>'.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(380,6): error TS2739: Type '{ title: string; data: DataRecord[]; valueField: string; geoJoinKey: string; dataJoinKey?: string | undefined; colorScale?: ColorScaleType | undefined; colorRange?: string[] | undefined; ... 6 more ...; preferredRenderer?: "svg" | ... 2 more ... | undefined; }' is missing the following properties from type 'ChoroplethStoryArgs': geoData, showLegend, enableTooltip, enableSelection
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(390,5): error TS2353: Object literal may only specify known properties, and 'geoData' does not exist in type 'Partial<ChoroplethMapProps>'.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(409,6): error TS2739: Type '{ title: string; data: DataRecord[]; valueField: string; geoJoinKey: string; dataJoinKey?: string | undefined; colorScale?: ColorScaleType | undefined; colorRange?: string[] | undefined; ... 6 more ...; preferredRenderer?: "svg" | ... 2 more ... | undefined; }' is missing the following properties from type 'ChoroplethStoryArgs': geoData, showLegend, enableTooltip, enableSelection
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(416,5): error TS2353: Object literal may only specify known properties, and 'geoData' does not exist in type 'Partial<ChoroplethMapProps>'.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(435,6): error TS2739: Type '{ title: string; data: DataRecord[]; valueField: string; geoJoinKey: string; dataJoinKey?: string | undefined; colorScale?: ColorScaleType | undefined; colorRange?: string[] | undefined; ... 6 more ...; preferredRenderer?: "svg" | ... 2 more ... | undefined; }' is missing the following properties from type 'ChoroplethStoryArgs': geoData, showLegend, enableTooltip, enableSelection
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(442,5): error TS2353: Object literal may only specify known properties, and 'geoData' does not exist in type 'Partial<ChoroplethMapProps>'.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(460,22): error TS2739: Type '{ title: string; data: DataRecord[]; valueField: string; geoJoinKey: string; dataJoinKey?: string | undefined; colorScale?: ColorScaleType | undefined; colorRange?: string[] | undefined; ... 6 more ...; preferredRenderer?: "svg" | ... 2 more ... | undefined; }' is missing the following properties from type 'ChoroplethStoryArgs': geoData, showLegend, enableTooltip, enableSelection
Error: src/components/viz/spatial/ChoroplethMap.tsx(641,43): error TS2339: Property 'name' does not exist on type '{ __featureKey?: string | undefined; }'.
Error: src/components/viz/spatial/ChoroplethMap.tsx(656,43): error TS2339: Property 'name' does not exist on type '{ __featureKey?: string | undefined; }'.
Error: src/components/viz/spatial/ChoroplethMap.tsx(674,30): error TS2345: Argument of type '(params: {    name?: string;    data?: {        __featureKey?: string;    };}) => void' is not assignable to parameter of type 'WithThisType<(params: ECElementEvent) => boolean | void, EChartsType>'.
  Types of parameters 'params' and 'params' are incompatible.
    Type 'ECElementEvent' is not assignable to type '{ name?: string | undefined; data?: { __featureKey?: string | undefined; } | undefined; }'.
      Types of property 'data' are incompatible.
        Type 'OptionDataItem' is not assignable to type '{ __featureKey?: string | undefined; } | undefined'.
          Type 'null' is not assignable to type '{ __featureKey?: string | undefined; } | undefined'.
Error: src/components/viz/spatial/ChoroplethMap.tsx(675,34): error TS2345: Argument of type '(params: {    name?: string;    data?: {        __featureKey?: string;    };}) => void' is not assignable to parameter of type 'WithThisType<(params: ECElementEvent) => boolean | void, EChartsType>'.
  Types of parameters 'params' and 'params' are incompatible.
    Type 'ECElementEvent' is not assignable to type '{ name?: string | undefined; data?: { __featureKey?: string | undefined; } | undefined; }'.
      Types of property 'data' are incompatible.
        Type 'OptionDataItem' is not assignable to type '{ __featureKey?: string | undefined; } | undefined'.
          Type 'null' is not assignable to type '{ __featureKey?: string | undefined; } | undefined'.
Error: src/components/viz/spatial/ChoroplethMap.tsx(728,56): error TS2339: Property 'copy' does not exist on type 'GeoProjection'.
Error: src/components/viz/spatial/ChoroplethMap.tsx(729,30): error TS2339: Property 'copy' does not exist on type 'GeoProjection'.
Error: src/components/viz/spatial/MapControls.stories.tsx(25,96): error TS2503: Cannot find namespace 'JSX'.
Error: src/components/viz/spatial/MapControls.stories.tsx(94,5): error TS2353: Object literal may only specify known properties, and 'showZoom' does not exist in type 'Partial<ArgTypes<MapControlsProps>>'.
Error: src/components/viz/spatial/MapControls.stories.tsx(105,5): error TS2353: Object literal may only specify known properties, and 'showZoom' does not exist in type 'Partial<MapControlsProps>'.
Error: src/components/viz/spatial/MapControls.stories.tsx(110,22): error TS2739: Type '{ onZoomIn?: (() => void) | undefined; onZoomOut?: (() => void) | undefined; onZoomReset?: (() => void) | undefined; zoomLevel?: number | undefined; minZoom?: number | undefined; maxZoom?: number | undefined; layers?: { ...; }[] | undefined; onLayerToggle?: ((layerId: string, visible: boolean) => void) | undefined; ...' is missing the following properties from type 'ControlsStoryArgs': showZoom, showReset, showLayerToggles
Error: src/components/viz/spatial/MapControls.stories.tsx(115,5): error TS2353: Object literal may only specify known properties, and 'showZoom' does not exist in type 'Partial<MapControlsProps>'.
Error: src/components/viz/spatial/MapControls.stories.tsx(120,22): error TS2739: Type '{ onZoomIn?: (() => void) | undefined; onZoomOut?: (() => void) | undefined; onZoomReset?: (() => void) | undefined; zoomLevel?: number | undefined; minZoom?: number | undefined; maxZoom?: number | undefined; layers?: { ...; }[] | undefined; onLayerToggle?: ((layerId: string, visible: boolean) => void) | undefined; ...' is missing the following properties from type 'ControlsStoryArgs': showZoom, showReset, showLayerToggles
Error: src/components/viz/spatial/MapControls.stories.tsx(125,5): error TS2353: Object literal may only specify known properties, and 'showZoom' does not exist in type 'Partial<MapControlsProps>'.
Error: src/components/viz/spatial/MapControls.stories.tsx(130,22): error TS2739: Type '{ onZoomIn?: (() => void) | undefined; onZoomOut?: (() => void) | undefined; onZoomReset?: (() => void) | undefined; zoomLevel?: number | undefined; minZoom?: number | undefined; maxZoom?: number | undefined; layers?: { ...; }[] | undefined; onLayerToggle?: ((layerId: string, visible: boolean) => void) | undefined; ...' is missing the following properties from type 'ControlsStoryArgs': showZoom, showReset, showLayerToggles
Error: src/components/viz/spatial/MapControls.stories.tsx(135,5): error TS2353: Object literal may only specify known properties, and 'showZoom' does not exist in type 'Partial<MapControlsProps>'.
Error: src/components/viz/spatial/MapControls.stories.tsx(145,8): error TS2739: Type '{ onZoomIn?: (() => void) | undefined; onZoomOut?: (() => void) | undefined; onZoomReset?: (() => void) | undefined; zoomLevel?: number | undefined; minZoom?: number | undefined; maxZoom?: number | undefined; layers?: { ...; }[] | undefined; onLayerToggle?: ((layerId: string, visible: boolean) => void) | undefined; ...' is missing the following properties from type 'ControlsStoryArgs': showZoom, showReset, showLayerToggles
Error: src/components/viz/spatial/MapControls.tsx(61,24): error TS2339: Property 'id' does not exist on type 'SpatialLayer'.
  Property 'id' does not exist on type 'RegionFillLayer'.
Error: src/components/viz/spatial/MapControls.tsx(61,48): error TS2339: Property 'id' does not exist on type 'SpatialLayer'.
  Property 'id' does not exist on type 'RegionFillLayer'.
Error: src/components/viz/spatial/MapLegend.stories.tsx(36,72): error TS2503: Cannot find namespace 'JSX'.
Error: src/components/viz/spatial/MapLegend.stories.tsx(62,9): error TS2322: Type '{ type: string; scale: ColorScale; label: string; format: (v: number) => string; } | { type: string; scale: ColorScale; label: string; format?: undefined; } | undefined' is not assignable to type '{ type: "categorical" | "continuous"; scale: ColorScale; label?: string | undefined; format?: ((value: number) => string) | undefined; } | undefined'.
  Type '{ type: string; scale: ColorScale; label: string; format: (v: number) => string; }' is not assignable to type '{ type: "categorical" | "continuous"; scale: ColorScale; label?: string | undefined; format?: ((value: number) => string) | undefined; }'.
    Types of property 'type' are incompatible.
      Type 'string' is not assignable to type '"categorical" | "continuous"'.
Error: src/components/viz/spatial/MapLegend.stories.tsx(85,5): error TS2353: Object literal may only specify known properties, and 'legendType' does not exist in type 'Partial<ArgTypes<MapLegendProps>>'.
Error: src/components/viz/spatial/MapLegend.stories.tsx(95,5): error TS2353: Object literal may only specify known properties, and 'legendType' does not exist in type 'Partial<MapLegendProps>'.
Error: src/components/viz/spatial/MapLegend.stories.tsx(99,22): error TS2739: Type '{ colorScale?: { type: "categorical" | "continuous"; scale: ColorScale; label?: string | undefined; format?: ((value: number) => string) | undefined; } | undefined; sizeScale?: { ...; } | undefined; position?: Position | undefined; orientation?: "horizontal" | ... 1 more ... | undefined; className?: string | undefin...' is missing the following properties from type 'LegendStoryArgs': legendType, title
Error: src/components/viz/spatial/MapLegend.stories.tsx(104,5): error TS2353: Object literal may only specify known properties, and 'legendType' does not exist in type 'Partial<MapLegendProps>'.
Error: src/components/viz/spatial/MapLegend.stories.tsx(108,22): error TS2739: Type '{ colorScale?: { type: "categorical" | "continuous"; scale: ColorScale; label?: string | undefined; format?: ((value: number) => string) | undefined; } | undefined; sizeScale?: { ...; } | undefined; position?: Position | undefined; orientation?: "horizontal" | ... 1 more ... | undefined; className?: string | undefin...' is missing the following properties from type 'LegendStoryArgs': legendType, title
Error: src/components/viz/spatial/MapLegend.stories.tsx(113,5): error TS2353: Object literal may only specify known properties, and 'legendType' does not exist in type 'Partial<MapLegendProps>'.
Error: src/components/viz/spatial/MapLegend.stories.tsx(117,22): error TS2739: Type '{ colorScale?: { type: "categorical" | "continuous"; scale: ColorScale; label?: string | undefined; format?: ((value: number) => string) | undefined; } | undefined; sizeScale?: { ...; } | undefined; position?: Position | undefined; orientation?: "horizontal" | ... 1 more ... | undefined; className?: string | undefin...' is missing the following properties from type 'LegendStoryArgs': legendType, title
Error: src/components/viz/spatial/MapLegend.stories.tsx(122,5): error TS2353: Object literal may only specify known properties, and 'legendType' does not exist in type 'Partial<MapLegendProps>'.
Error: src/components/viz/spatial/MapLegend.stories.tsx(126,22): error TS2739: Type '{ colorScale?: { type: "categorical" | "continuous"; scale: ColorScale; label?: string | undefined; format?: ((value: number) => string) | undefined; } | undefined; sizeScale?: { ...; } | undefined; position?: Position | undefined; orientation?: "horizontal" | ... 1 more ... | undefined; className?: string | undefin...' is missing the following properties from type 'LegendStoryArgs': legendType, title
Error: src/components/viz/spatial/SpatialContainer.stories.tsx(43,25): error TS2352: Conversion of type 'Feature<Point, GeoJsonProperties>' to type 'FeatureCollection<Geometry, GeoJsonProperties>' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
Error: src/components/viz/spatial/SpatialContainer.stories.tsx(45,3): error TS2769: No overload matches this call.
  The last overload gave the following error.
    Argument of type 'unknown' is not assignable to parameter of type 'string | GeometryObject<GeoJsonProperties>'.
Error: src/components/viz/spatial/SpatialContainer.stories.tsx(49,31): error TS2352: Conversion of type 'Feature<Point, GeoJsonProperties>' to type 'FeatureCollection<Geometry, GeoJsonProperties>' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
Error: src/components/viz/spatial/SpatialContainer.stories.tsx(51,3): error TS2769: No overload matches this call.
  The last overload gave the following error.
    Argument of type 'unknown' is not assignable to parameter of type 'string | GeometryObject<GeoJsonProperties>'.
Error: src/components/viz/spatial/SpatialContainer.tsx(245,38): error TS2345: Argument of type 'RefObject<HTMLDivElement | null>' is not assignable to parameter of type 'RefObject<HTMLElement>'.
  Type 'HTMLDivElement | null' is not assignable to type 'HTMLElement'.
    Type 'null' is not assignable to type 'HTMLElement'.
Error: src/viz/adapters/spatial/echarts-bubble-adapter.ts(157,29): error TS2538: Type 'undefined' cannot be used as an index type.
Error: src/viz/adapters/spatial/echarts-bubble-adapter.ts(199,9): error TS2322: Type '{ type: "scatter"; coordinateSystem: string; geoIndex: number; name: string; data: { name: string; value: (number | null)[]; raw: DataRecord; itemStyle: { color: string; } | undefined; }[]; symbolSize: (value: unknown) => number; encode: { ...; }; tooltip: { ...; }; }' is not assignable to type 'ScatterSeriesOption$1'.
  Type '{ type: "scatter"; coordinateSystem: string; geoIndex: number; name: string; data: { name: string; value: (number | null)[]; raw: DataRecord; itemStyle: { color: string; } | undefined; }[]; symbolSize: (value: unknown) => number; encode: { ...; }; tooltip: { ...; }; }' is not assignable to type 'SeriesInjectedOption'.
    Types of property 'tooltip' are incompatible.
      Type '{ formatter: (params: { readonly data?: Record<string, unknown> | undefined; readonly name?: string | undefined; }) => string; }' is not assignable to type 'SeriesTooltipOption'.
        Type '{ formatter: (params: { readonly data?: Record<string, unknown> | undefined; readonly name?: string | undefined; }) => string; }' is not assignable to type 'CommonTooltipOption<CallbackDataParams>'.
          Types of property 'formatter' are incompatible.
            Type '(params: { readonly data?: Record<string, unknown> | undefined; readonly name?: string | undefined; }) => string' is not assignable to type 'string | TooltipFormatterCallback<CallbackDataParams> | undefined'.
              Type '(params: { readonly data?: Record<string, unknown> | undefined; readonly name?: string | undefined; }) => string' is not assignable to type 'TooltipFormatterCallback<CallbackDataParams>'.
                Types of parameters 'params' and 'params' are incompatible.
                  Type 'CallbackDataParams' is not assignable to type '{ readonly data?: Record<string, unknown> | undefined; readonly name?: string | undefined; }'.
                    Types of property 'data' are incompatible.
                      Type 'OptionDataItem' is not assignable to type 'Record<string, unknown> | undefined'.
                        Type 'null' is not assignable to type 'Record<string, unknown> | undefined'.
Error: src/viz/adapters/spatial/echarts-bubble-adapter.ts(255,9): error TS2322: Type '{ geo: GeoComponentOption; visualMap: VisualMapComponentOption | undefined; series: ScatterSeriesOption[]; tooltip: { ...; }; aria: { ...; }; title: { ...; } | undefined; usermeta: { ...; }; }' is not assignable to type 'EChartsOption'.
  Types of property 'tooltip' are incompatible.
    Type '{ trigger: "item"; formatter: (params: { readonly data?: Record<string, unknown> | undefined; readonly name?: string | undefined; }) => string; }' is not assignable to type 'TooltipOption | TooltipOption[] | undefined'.
      Type '{ trigger: "item"; formatter: (params: { readonly data?: Record<string, unknown> | undefined; readonly name?: string | undefined; }) => string; }' is not assignable to type 'TooltipOption'.
        Types of property 'formatter' are incompatible.
          Type '(params: { readonly data?: Record<string, unknown> | undefined; readonly name?: string | undefined; }) => string' is not assignable to type 'string | TooltipFormatterCallback<TopLevelFormatterParams> | undefined'.
            Type '(params: { readonly data?: Record<string, unknown> | undefined; readonly name?: string | undefined; }) => string' is not assignable to type 'TooltipFormatterCallback<TopLevelFormatterParams>'.
              Types of parameters 'params' and 'params' are incompatible.
                Type 'TopLevelFormatterParams' is not assignable to type '{ readonly data?: Record<string, unknown> | undefined; readonly name?: string | undefined; }'.
                  Type 'CallbackDataParams' is not assignable to type '{ readonly data?: Record<string, unknown> | undefined; readonly name?: string | undefined; }'.
Error: src/viz/adapters/spatial/echarts-choropleth-adapter.ts(131,9): error TS2322: Type '{ type: "map"; map: string; geoIndex: number; name: string; data: { name: string; value: number | null; rawProperties: Record<string, unknown> | undefined; }[]; emphasis: { focus: string; }; }' is not assignable to type 'MapSeriesOption$1'.
  Type '{ type: "map"; map: string; geoIndex: number; name: string; data: { name: string; value: number | null; rawProperties: Record<string, unknown> | undefined; }[]; emphasis: { focus: string; }; }' is not assignable to type 'MapSeriesOption'.
    Types of property 'data' are incompatible.
      Type '{ name: string; value: number | null; rawProperties: Record<string, unknown> | undefined; }[]' is not assignable to type '(OptionDataValueNumeric | OptionDataValueNumeric[] | MapDataItemOption)[]'.
        Type '{ name: string; value: number | null; rawProperties: Record<string, unknown> | undefined; }' is not assignable to type 'OptionDataValueNumeric | OptionDataValueNumeric[] | MapDataItemOption'.
          Type '{ name: string; value: number | null; rawProperties: Record<string, unknown> | undefined; }' is not assignable to type 'MapDataItemOption'.
            Types of property 'value' are incompatible.
              Type 'number | null' is not assignable to type 'OptionDataValueNumeric | OptionDataValueNumeric[] | undefined'.
                Type 'null' is not assignable to type 'OptionDataValueNumeric | OptionDataValueNumeric[] | undefined'.
Error: src/viz/adapters/spatial/echarts-choropleth-adapter.ts(169,9): error TS2322: Type '{ geo: GeoComponentOption; visualMap: VisualMapComponentOption; series: MapSeriesOption[]; tooltip: { trigger: "item"; formatter: (params: { ...; }) => string; }; aria: { ...; }; title: { ...; } | undefined; usermeta: { ...; }; }' is not assignable to type 'EChartsOption'.
  Types of property 'tooltip' are incompatible.
    Type '{ trigger: "item"; formatter: (params: { readonly data?: Record<string, unknown> | undefined; readonly name?: string | undefined; }) => string; }' is not assignable to type 'TooltipOption | TooltipOption[] | undefined'.
      Type '{ trigger: "item"; formatter: (params: { readonly data?: Record<string, unknown> | undefined; readonly name?: string | undefined; }) => string; }' is not assignable to type 'TooltipOption'.
        Types of property 'formatter' are incompatible.
          Type '(params: { readonly data?: Record<string, unknown> | undefined; readonly name?: string | undefined; }) => string' is not assignable to type 'string | TooltipFormatterCallback<TopLevelFormatterParams> | undefined'.
Error: src/viz/adapters/spatial/index.ts(14,1): error TS2308: Module './vega-lite-choropleth-adapter.js' has already exported a member named 'VegaLiteLayer'. Consider explicitly re-exporting to resolve the ambiguity.
Error: src/viz/adapters/spatial/vega-lite-bubble-adapter.ts(8,54): error TS2339: Property 'layer' does not exist on type 'TopLevelSpec'.
Error: src/viz/adapters/spatial/vega-lite-choropleth-adapter.ts(7,54): error TS2339: Property 'layer' does not exist on type 'TopLevelSpec'.
Error: src/viz/adapters/spatial/vega-lite-projection-map.ts(1,33): error TS2307: Cannot find module 'vega-lite/build/src/projection' or its corresponding type declarations.
Error: src/viz/adapters/spatial/vega-lite-scale-map.ts(1,28): error TS2307: Cannot find module 'vega-lite/build/src/scale' or its corresponding type declarations.
Error: src/viz/adapters/spatial/vega-lite-spatial-adapter.ts(118,3): error TS2344: Type '"title" | "description" | "width" | "height" | "padding" | "$schema" | "usermeta" | "projection"' does not satisfy the constraint '"title" | "name" | "description" | "data" | "background" | "padding" | "autosize" | "transform" | "$schema" | "config" | "params" | "usermeta" | "resolve" | "datasets"'.
  Type '"width"' is not assignable to type '"title" | "name" | "description" | "data" | "background" | "padding" | "autosize" | "transform" | "$schema" | "config" | "params" | "usermeta" | "resolve" | "datasets"'.
Error: src/viz/adapters/spatial/vega-lite-spatial-adapter.ts(180,9): error TS2322: Type '{ layer: any[]; title?: Text | TitleParams<ExprRef | SignalRef> | undefined; description?: string | undefined; width: unknown; height: unknown; padding?: ExprRef | SignalRef | Padding | undefined; $schema?: string | undefined; usermeta?: Dict<...> | undefined; projection: unknown; }' is not assignable to type 'TopLevelSpec'.
  Type '{ layer: any[]; title?: Text | TitleParams<ExprRef | SignalRef> | undefined; description?: string | undefined; width: unknown; height: unknown; padding?: ExprRef | SignalRef | Padding | undefined; $schema?: string | undefined; usermeta?: Dict<...> | undefined; projection: unknown; }' is not assignable to type 'TopLevel<LayerSpec<Field>>'.
    Type '{ layer: any[]; title?: Text | TitleParams<ExprRef | SignalRef> | undefined; description?: string | undefined; width: unknown; height: unknown; padding?: ExprRef | SignalRef | Padding | undefined; $schema?: string | undefined; usermeta?: Dict<...> | undefined; projection: unknown; }' is not assignable to type 'LayerSpec<Field>'.
      Types of property 'projection' are incompatible.
        Type 'unknown' is not assignable to type 'Projection<ExprRef> | undefined'.
Error: src/viz/patterns/spatial-detection.ts(202,6): error TS6196: '_KeepSpatialSpec' is declared but never used.
 ELIFECYCLE  Command failed with exit code 2.
Error: Process completed with exit code 2.
Run pnpm run build

> @oods/trait-engine@0.1.0 build /home/runner/work/OODS-Foundry/OODS-Foundry
> tsc

Error: examples/dashboards/spatial-dashboard.tsx(161,46): error TS2352: Conversion of type 'Feature<Point, GeoJsonProperties>' to type 'FeatureCollection<Geometry, GeoJsonProperties>' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
Error: examples/dashboards/spatial-dashboard.tsx(286,9): error TS6133: 'joinedByFeature' is declared but its value is never read.
Error: examples/dashboards/spatial-dashboard.tsx(299,25): error TS2352: Conversion of type 'StateMetric' to type 'Record<string, unknown>' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
  Index signature for type 'string' is missing in type 'StateMetric'.
Error: src/components/viz/spatial/AccessibleMapFallback.stories.tsx(73,24): error TS2503: Cannot find namespace 'JSX'.
Error: src/components/viz/spatial/AccessibleMapFallback.stories.tsx(110,5): error TS2353: Object literal may only specify known properties, and 'showTable' does not exist in type 'Partial<ArgTypes<AccessibleMapFallbackProps>>'.
Error: src/components/viz/spatial/AccessibleMapFallback.stories.tsx(123,5): error TS2353: Object literal may only specify known properties, and 'showTable' does not exist in type 'Partial<AccessibleMapFallbackProps>'.
Error: src/components/viz/spatial/AccessibleMapFallback.stories.tsx(129,22): error TS2739: Type '{ data?: DataRecord[] | undefined; features?: Feature<Geometry, GeoJsonProperties>[] | undefined; joinedData?: Map<string, DataRecord> | undefined; table?: { ...; } | undefined; narrative?: { ...; } | undefined; alwaysVisible?: boolean | undefined; triggerLabel?: string | undefined; }' is missing the following properties from type 'FallbackStoryArgs': showTable, showNarrative, sortColumn, sortOrder
Error: src/components/viz/spatial/AccessibleMapFallback.stories.tsx(134,5): error TS2353: Object literal may only specify known properties, and 'showTable' does not exist in type 'Partial<AccessibleMapFallbackProps>'.
Error: src/components/viz/spatial/AccessibleMapFallback.stories.tsx(140,22): error TS2739: Type '{ data?: DataRecord[] | undefined; features?: Feature<Geometry, GeoJsonProperties>[] | undefined; joinedData?: Map<string, DataRecord> | undefined; table?: { ...; } | undefined; narrative?: { ...; } | undefined; alwaysVisible?: boolean | undefined; triggerLabel?: string | undefined; }' is missing the following properties from type 'FallbackStoryArgs': showTable, showNarrative, sortColumn, sortOrder
Error: src/components/viz/spatial/AccessibleMapFallback.stories.tsx(145,5): error TS2353: Object literal may only specify known properties, and 'showTable' does not exist in type 'Partial<AccessibleMapFallbackProps>'.
Error: src/components/viz/spatial/AccessibleMapFallback.stories.tsx(151,22): error TS2739: Type '{ data?: DataRecord[] | undefined; features?: Feature<Geometry, GeoJsonProperties>[] | undefined; joinedData?: Map<string, DataRecord> | undefined; table?: { ...; } | undefined; narrative?: { ...; } | undefined; alwaysVisible?: boolean | undefined; triggerLabel?: string | undefined; }' is missing the following properties from type 'FallbackStoryArgs': showTable, showNarrative, sortColumn, sortOrder
Error: src/components/viz/spatial/AccessibleMapFallback.stories.tsx(156,5): error TS2353: Object literal may only specify known properties, and 'showTable' does not exist in type 'Partial<AccessibleMapFallbackProps>'.
Error: src/components/viz/spatial/AccessibleMapFallback.stories.tsx(163,22): error TS2739: Type '{ data?: DataRecord[] | undefined; features?: Feature<Geometry, GeoJsonProperties>[] | undefined; joinedData?: Map<string, DataRecord> | undefined; table?: { ...; } | undefined; narrative?: { ...; } | undefined; alwaysVisible?: boolean | undefined; triggerLabel?: string | undefined; }' is missing the following properties from type 'FallbackStoryArgs': showTable, showNarrative, sortColumn, sortOrder
Error: src/components/viz/spatial/BubbleMap.stories.tsx(51,25): error TS2352: Conversion of type 'Feature<Point, GeoJsonProperties>' to type 'FeatureCollection<Geometry, GeoJsonProperties>' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
  Property 'features' is missing in type 'Feature<Point, GeoJsonProperties>' but required in type 'FeatureCollection<Geometry, GeoJsonProperties>'.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(53,3): error TS2769: No overload matches this call.
  The last overload gave the following error.
    Argument of type 'unknown' is not assignable to parameter of type 'string | GeometryObject<GeoJsonProperties>'.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(56,7): error TS6133: 'worldCountriesGeoData' is declared but its value is never read.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(56,31): error TS2352: Conversion of type 'Feature<Point, GeoJsonProperties>' to type 'FeatureCollection<Geometry, GeoJsonProperties>' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(58,3): error TS2769: No overload matches this call.
  The last overload gave the following error.
    Argument of type 'unknown' is not assignable to parameter of type 'string | GeometryObject<GeoJsonProperties>'.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(162,9): error TS2322: Type '{ type: "spatial"; data: { values: DataRecord[]; }; projection: { type: ProjectionType; fitToData: true; }; layers: { type: "symbol"; encoding: { size: { field: string; range: [...] | undefined; } | undefined; color: { ...; } | undefined; }; }[]; a11y: SpatialA11yConfig; }' is not assignable to type 'SpatialSpec'.
  Types of property 'layers' are incompatible.
    Type '{ type: "symbol"; encoding: { size: { field: string; range: [number, number] | undefined; } | undefined; color: { field: string; range: string[] | undefined; } | undefined; }; }[]' is not assignable to type 'SpatialLayer[]'.
      Type '{ type: "symbol"; encoding: { size: { field: string; range: [number, number] | undefined; } | undefined; color: { field: string; range: string[] | undefined; } | undefined; }; }' is not assignable to type 'SpatialLayer'.
        Type '{ type: "symbol"; encoding: { size: { field: string; range: [number, number] | undefined; } | undefined; color: { field: string; range: string[] | undefined; } | undefined; }; }' is not assignable to type 'SymbolLayer'.
          Types of property 'encoding' are incompatible.
            Type '{ size: { field: string; range: [number, number] | undefined; } | undefined; color: { field: string; range: string[] | undefined; } | undefined; }' is missing the following properties from type '{ longitude: PositionEncoding; latitude: PositionEncoding; size?: SizeEncoding | undefined; color?: ColorEncoding | undefined; shape?: ShapeEncoding | undefined; opacity?: OpacityEncoding | undefined; }': longitude, latitude
Error: src/components/viz/spatial/BubbleMap.stories.tsx(197,9): error TS2322: Type 'SpatialA11yConfig' is not assignable to type '{ description: string; ariaLabel?: string | undefined; tableFallback?: { enabled: boolean; caption: string; columns?: string[] | undefined; } | undefined; narrative?: { summary: string; keyFindings: string[]; } | undefined; }'.
  Types of property 'tableFallback' are incompatible.
    Type 'TableFallbackConfig | undefined' is not assignable to type '{ enabled: boolean; caption: string; columns?: string[] | undefined; } | undefined'.
      Type 'TableFallbackConfig' is not assignable to type '{ enabled: boolean; caption: string; columns?: string[] | undefined; }'.
        Types of property 'enabled' are incompatible.
          Type 'boolean | undefined' is not assignable to type 'boolean'.
            Type 'undefined' is not assignable to type 'boolean'.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(294,5): error TS2561: Object literal may only specify known properties, but 'specProjection' does not exist in type 'Partial<ArgTypes<BubbleMapProps>>'. Did you mean to write 'projection'?
Error: src/components/viz/spatial/BubbleMap.stories.tsx(320,5): error TS2561: Object literal may only specify known properties, but 'specProjection' does not exist in type 'Partial<BubbleMapProps>'. Did you mean to write 'projection'?
Error: src/components/viz/spatial/BubbleMap.stories.tsx(345,6): error TS2740: Type '{ title: string; spec: NormalizedVizSpecV01; geoData?: FeatureCollection<Geometry, GeoJsonProperties> | undefined; ... 15 more ...; preferredRenderer?: "svg" | ... 2 more ... | undefined; }' is missing the following properties from type 'BubbleStoryArgs': specProjection, clusterEnabled, clusterRadius, clusterMinPoints, and 3 more.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(353,5): error TS2561: Object literal may only specify known properties, but 'specProjection' does not exist in type 'Partial<BubbleMapProps>'. Did you mean to write 'projection'?
Error: src/components/viz/spatial/BubbleMap.stories.tsx(378,6): error TS2740: Type '{ title: string; spec: NormalizedVizSpecV01; geoData?: FeatureCollection<Geometry, GeoJsonProperties> | undefined; ... 15 more ...; preferredRenderer?: "svg" | ... 2 more ... | undefined; }' is missing the following properties from type 'BubbleStoryArgs': specProjection, clusterEnabled, clusterRadius, clusterMinPoints, and 3 more.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(386,5): error TS2561: Object literal may only specify known properties, but 'specProjection' does not exist in type 'Partial<BubbleMapProps>'. Did you mean to write 'projection'?
Error: src/components/viz/spatial/BubbleMap.stories.tsx(411,6): error TS2740: Type '{ title: string; spec: NormalizedVizSpecV01; geoData?: FeatureCollection<Geometry, GeoJsonProperties> | undefined; ... 15 more ...; preferredRenderer?: "svg" | ... 2 more ... | undefined; }' is missing the following properties from type 'BubbleStoryArgs': specProjection, clusterEnabled, clusterRadius, clusterMinPoints, and 3 more.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(419,5): error TS2561: Object literal may only specify known properties, but 'specProjection' does not exist in type 'Partial<BubbleMapProps>'. Did you mean to write 'projection'?
Error: src/components/viz/spatial/BubbleMap.stories.tsx(444,6): error TS2740: Type '{ title: string; spec: NormalizedVizSpecV01; geoData?: FeatureCollection<Geometry, GeoJsonProperties> | undefined; ... 15 more ...; preferredRenderer?: "svg" | ... 2 more ... | undefined; }' is missing the following properties from type 'BubbleStoryArgs': specProjection, clusterEnabled, clusterRadius, clusterMinPoints, and 3 more.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(452,5): error TS2561: Object literal may only specify known properties, but 'specProjection' does not exist in type 'Partial<BubbleMapProps>'. Did you mean to write 'projection'?
Error: src/components/viz/spatial/BubbleMap.stories.tsx(476,22): error TS2740: Type '{ title: string; spec: NormalizedVizSpecV01; geoData?: FeatureCollection<Geometry, GeoJsonProperties> | undefined; ... 15 more ...; preferredRenderer?: "svg" | ... 2 more ... | undefined; }' is missing the following properties from type 'BubbleStoryArgs': specProjection, clusterEnabled, clusterRadius, clusterMinPoints, and 3 more.
Error: src/components/viz/spatial/BubbleMap.stories.tsx(483,5): error TS2561: Object literal may only specify known properties, but 'specProjection' does not exist in type 'Partial<BubbleMapProps>'. Did you mean to write 'projection'?
Error: src/components/viz/spatial/BubbleMap.stories.tsx(508,6): error TS2740: Type '{ title: string; spec: NormalizedVizSpecV01; geoData?: FeatureCollection<Geometry, GeoJsonProperties> | undefined; ... 15 more ...; preferredRenderer?: "svg" | ... 2 more ... | undefined; }' is missing the following properties from type 'BubbleStoryArgs': specProjection, clusterEnabled, clusterRadius, clusterMinPoints, and 3 more.
Error: src/components/viz/spatial/BubbleMap.tsx(260,56): error TS2339: Property 'copy' does not exist on type 'GeoProjection'.
Error: src/components/viz/spatial/BubbleMap.tsx(261,30): error TS2339: Property 'copy' does not exist on type 'GeoProjection'.
Error: src/components/viz/spatial/BubbleMap.tsx(296,38): error TS2345: Argument of type 'number[]' is not assignable to parameter of type '[number, number]'.
  Target requires 2 element(s) but source may have fewer.
Error: src/components/viz/spatial/BubbleMap.tsx(298,35): error TS2345: Argument of type 'number[]' is not assignable to parameter of type '[number, number]'.
Error: src/components/viz/spatial/BubbleMap.tsx(301,36): error TS2345: Argument of type 'number[]' is not assignable to parameter of type '[number, number]'.
Error: src/components/viz/spatial/BubbleMap.tsx(687,30): error TS2345: Argument of type '(params: {    data?: {        raw?: DataRecord;    };}) => void' is not assignable to parameter of type 'WithThisType<(params: ECElementEvent) => boolean | void, EChartsType>'.
  Types of parameters 'params' and 'params' are incompatible.
    Type 'ECElementEvent' is not assignable to type '{ data?: { raw?: DataRecord | undefined; } | undefined; }'.
      Types of property 'data' are incompatible.
        Type 'OptionDataItem' is not assignable to type '{ raw?: DataRecord | undefined; } | undefined'.
          Type 'null' is not assignable to type '{ raw?: DataRecord | undefined; } | undefined'.
Error: src/components/viz/spatial/BubbleMapPoint.tsx(8,33): error TS2307: Cannot find module '../../viz/adapters/spatial/geo-data-joiner.js' or its corresponding type declarations.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(53,25): error TS2352: Conversion of type 'Feature<Point, GeoJsonProperties>' to type 'FeatureCollection<Geometry, GeoJsonProperties>' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(55,3): error TS2769: No overload matches this call.
  The last overload gave the following error.
    Argument of type 'unknown' is not assignable to parameter of type 'string | GeometryObject<GeoJsonProperties>'.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(58,31): error TS2352: Conversion of type 'Feature<Point, GeoJsonProperties>' to type 'FeatureCollection<Geometry, GeoJsonProperties>' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(60,3): error TS2769: No overload matches this call.
  The last overload gave the following error.
    Argument of type 'unknown' is not assignable to parameter of type 'string | GeometryObject<GeoJsonProperties>'.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(243,48): error TS2322: Type '{}' is not assignable to type 'ReactNode'.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(259,13): error TS2322: Type '{}' is not assignable to type 'ReactNode'.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(294,5): error TS2353: Object literal may only specify known properties, and 'showLegend' does not exist in type 'Partial<ArgTypes<ChoroplethMapProps>>'.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(311,5): error TS2353: Object literal may only specify known properties, and 'geoData' does not exist in type 'Partial<ChoroplethMapProps>'.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(327,6): error TS2739: Type '{ title: string; data: DataRecord[]; valueField: string; geoJoinKey: string; dataJoinKey?: string | undefined; colorScale?: ColorScaleType | undefined; colorRange?: string[] | undefined; ... 6 more ...; preferredRenderer?: "svg" | ... 2 more ... | undefined; }' is missing the following properties from type 'ChoroplethStoryArgs': geoData, showLegend, enableTooltip, enableSelection
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(334,5): error TS2353: Object literal may only specify known properties, and 'geoData' does not exist in type 'Partial<ChoroplethMapProps>'.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(353,6): error TS2739: Type '{ title: string; data: DataRecord[]; valueField: string; geoJoinKey: string; dataJoinKey?: string | undefined; colorScale?: ColorScaleType | undefined; colorRange?: string[] | undefined; ... 6 more ...; preferredRenderer?: "svg" | ... 2 more ... | undefined; }' is missing the following properties from type 'ChoroplethStoryArgs': geoData, showLegend, enableTooltip, enableSelection
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(360,5): error TS2353: Object literal may only specify known properties, and 'geoData' does not exist in type 'Partial<ChoroplethMapProps>'.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(380,6): error TS2739: Type '{ title: string; data: DataRecord[]; valueField: string; geoJoinKey: string; dataJoinKey?: string | undefined; colorScale?: ColorScaleType | undefined; colorRange?: string[] | undefined; ... 6 more ...; preferredRenderer?: "svg" | ... 2 more ... | undefined; }' is missing the following properties from type 'ChoroplethStoryArgs': geoData, showLegend, enableTooltip, enableSelection
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(390,5): error TS2353: Object literal may only specify known properties, and 'geoData' does not exist in type 'Partial<ChoroplethMapProps>'.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(409,6): error TS2739: Type '{ title: string; data: DataRecord[]; valueField: string; geoJoinKey: string; dataJoinKey?: string | undefined; colorScale?: ColorScaleType | undefined; colorRange?: string[] | undefined; ... 6 more ...; preferredRenderer?: "svg" | ... 2 more ... | undefined; }' is missing the following properties from type 'ChoroplethStoryArgs': geoData, showLegend, enableTooltip, enableSelection
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(416,5): error TS2353: Object literal may only specify known properties, and 'geoData' does not exist in type 'Partial<ChoroplethMapProps>'.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(435,6): error TS2739: Type '{ title: string; data: DataRecord[]; valueField: string; geoJoinKey: string; dataJoinKey?: string | undefined; colorScale?: ColorScaleType | undefined; colorRange?: string[] | undefined; ... 6 more ...; preferredRenderer?: "svg" | ... 2 more ... | undefined; }' is missing the following properties from type 'ChoroplethStoryArgs': geoData, showLegend, enableTooltip, enableSelection
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(442,5): error TS2353: Object literal may only specify known properties, and 'geoData' does not exist in type 'Partial<ChoroplethMapProps>'.
Error: src/components/viz/spatial/ChoroplethMap.stories.tsx(460,22): error TS2739: Type '{ title: string; data: DataRecord[]; valueField: string; geoJoinKey: string; dataJoinKey?: string | undefined; colorScale?: ColorScaleType | undefined; colorRange?: string[] | undefined; ... 6 more ...; preferredRenderer?: "svg" | ... 2 more ... | undefined; }' is missing the following properties from type 'ChoroplethStoryArgs': geoData, showLegend, enableTooltip, enableSelection
Error: src/components/viz/spatial/ChoroplethMap.tsx(641,43): error TS2339: Property 'name' does not exist on type '{ __featureKey?: string | undefined; }'.
Error: src/components/viz/spatial/ChoroplethMap.tsx(656,43): error TS2339: Property 'name' does not exist on type '{ __featureKey?: string | undefined; }'.
Error: src/components/viz/spatial/ChoroplethMap.tsx(674,30): error TS2345: Argument of type '(params: {    name?: string;    data?: {        __featureKey?: string;    };}) => void' is not assignable to parameter of type 'WithThisType<(params: ECElementEvent) => boolean | void, EChartsType>'.
  Types of parameters 'params' and 'params' are incompatible.
    Type 'ECElementEvent' is not assignable to type '{ name?: string | undefined; data?: { __featureKey?: string | undefined; } | undefined; }'.
      Types of property 'data' are incompatible.
        Type 'OptionDataItem' is not assignable to type '{ __featureKey?: string | undefined; } | undefined'.
          Type 'null' is not assignable to type '{ __featureKey?: string | undefined; } | undefined'.
Error: src/components/viz/spatial/ChoroplethMap.tsx(675,34): error TS2345: Argument of type '(params: {    name?: string;    data?: {        __featureKey?: string;    };}) => void' is not assignable to parameter of type 'WithThisType<(params: ECElementEvent) => boolean | void, EChartsType>'.
  Types of parameters 'params' and 'params' are incompatible.
    Type 'ECElementEvent' is not assignable to type '{ name?: string | undefined; data?: { __featureKey?: string | undefined; } | undefined; }'.
      Types of property 'data' are incompatible.
        Type 'OptionDataItem' is not assignable to type '{ __featureKey?: string | undefined; } | undefined'.
          Type 'null' is not assignable to type '{ __featureKey?: string | undefined; } | undefined'.
Error: src/components/viz/spatial/ChoroplethMap.tsx(728,56): error TS2339: Property 'copy' does not exist on type 'GeoProjection'.
Error: src/components/viz/spatial/ChoroplethMap.tsx(729,30): error TS2339: Property 'copy' does not exist on type 'GeoProjection'.
Error: src/components/viz/spatial/MapControls.stories.tsx(25,96): error TS2503: Cannot find namespace 'JSX'.
Error: src/components/viz/spatial/MapControls.stories.tsx(94,5): error TS2353: Object literal may only specify known properties, and 'showZoom' does not exist in type 'Partial<ArgTypes<MapControlsProps>>'.
Error: src/components/viz/spatial/MapControls.stories.tsx(105,5): error TS2353: Object literal may only specify known properties, and 'showZoom' does not exist in type 'Partial<MapControlsProps>'.
Error: src/components/viz/spatial/MapControls.stories.tsx(110,22): error TS2739: Type '{ onZoomIn?: (() => void) | undefined; onZoomOut?: (() => void) | undefined; onZoomReset?: (() => void) | undefined; zoomLevel?: number | undefined; minZoom?: number | undefined; maxZoom?: number | undefined; layers?: { ...; }[] | undefined; onLayerToggle?: ((layerId: string, visible: boolean) => void) | undefined; ...' is missing the following properties from type 'ControlsStoryArgs': showZoom, showReset, showLayerToggles
Error: src/components/viz/spatial/MapControls.stories.tsx(115,5): error TS2353: Object literal may only specify known properties, and 'showZoom' does not exist in type 'Partial<MapControlsProps>'.
Error: src/components/viz/spatial/MapControls.stories.tsx(120,22): error TS2739: Type '{ onZoomIn?: (() => void) | undefined; onZoomOut?: (() => void) | undefined; onZoomReset?: (() => void) | undefined; zoomLevel?: number | undefined; minZoom?: number | undefined; maxZoom?: number | undefined; layers?: { ...; }[] | undefined; onLayerToggle?: ((layerId: string, visible: boolean) => void) | undefined; ...' is missing the following properties from type 'ControlsStoryArgs': showZoom, showReset, showLayerToggles
Error: src/components/viz/spatial/MapControls.stories.tsx(125,5): error TS2353: Object literal may only specify known properties, and 'showZoom' does not exist in type 'Partial<MapControlsProps>'.
Error: src/components/viz/spatial/MapControls.stories.tsx(130,22): error TS2739: Type '{ onZoomIn?: (() => void) | undefined; onZoomOut?: (() => void) | undefined; onZoomReset?: (() => void) | undefined; zoomLevel?: number | undefined; minZoom?: number | undefined; maxZoom?: number | undefined; layers?: { ...; }[] | undefined; onLayerToggle?: ((layerId: string, visible: boolean) => void) | undefined; ...' is missing the following properties from type 'ControlsStoryArgs': showZoom, showReset, showLayerToggles
Error: src/components/viz/spatial/MapControls.stories.tsx(135,5): error TS2353: Object literal may only specify known properties, and 'showZoom' does not exist in type 'Partial<MapControlsProps>'.
Error: src/components/viz/spatial/MapControls.stories.tsx(145,8): error TS2739: Type '{ onZoomIn?: (() => void) | undefined; onZoomOut?: (() => void) | undefined; onZoomReset?: (() => void) | undefined; zoomLevel?: number | undefined; minZoom?: number | undefined; maxZoom?: number | undefined; layers?: { ...; }[] | undefined; onLayerToggle?: ((layerId: string, visible: boolean) => void) | undefined; ...' is missing the following properties from type 'ControlsStoryArgs': showZoom, showReset, showLayerToggles
Error: src/components/viz/spatial/MapControls.tsx(61,24): error TS2339: Property 'id' does not exist on type 'SpatialLayer'.
  Property 'id' does not exist on type 'RegionFillLayer'.
Error: src/components/viz/spatial/MapControls.tsx(61,48): error TS2339: Property 'id' does not exist on type 'SpatialLayer'.
  Property 'id' does not exist on type 'RegionFillLayer'.
Error: src/components/viz/spatial/MapLegend.stories.tsx(36,72): error TS2503: Cannot find namespace 'JSX'.
Error: src/components/viz/spatial/MapLegend.stories.tsx(62,9): error TS2322: Type '{ type: string; scale: ColorScale; label: string; format: (v: number) => string; } | { type: string; scale: ColorScale; label: string; format?: undefined; } | undefined' is not assignable to type '{ type: "categorical" | "continuous"; scale: ColorScale; label?: string | undefined; format?: ((value: number) => string) | undefined; } | undefined'.
  Type '{ type: string; scale: ColorScale; label: string; format: (v: number) => string; }' is not assignable to type '{ type: "categorical" | "continuous"; scale: ColorScale; label?: string | undefined; format?: ((value: number) => string) | undefined; }'.
    Types of property 'type' are incompatible.
      Type 'string' is not assignable to type '"categorical" | "continuous"'.
Error: src/components/viz/spatial/MapLegend.stories.tsx(85,5): error TS2353: Object literal may only specify known properties, and 'legendType' does not exist in type 'Partial<ArgTypes<MapLegendProps>>'.
Error: src/components/viz/spatial/MapLegend.stories.tsx(95,5): error TS2353: Object literal may only specify known properties, and 'legendType' does not exist in type 'Partial<MapLegendProps>'.
Error: src/components/viz/spatial/MapLegend.stories.tsx(99,22): error TS2739: Type '{ colorScale?: { type: "categorical" | "continuous"; scale: ColorScale; label?: string | undefined; format?: ((value: number) => string) | undefined; } | undefined; sizeScale?: { ...; } | undefined; position?: Position | undefined; orientation?: "horizontal" | ... 1 more ... | undefined; className?: string | undefin...' is missing the following properties from type 'LegendStoryArgs': legendType, title
Error: src/components/viz/spatial/MapLegend.stories.tsx(104,5): error TS2353: Object literal may only specify known properties, and 'legendType' does not exist in type 'Partial<MapLegendProps>'.
Error: src/components/viz/spatial/MapLegend.stories.tsx(108,22): error TS2739: Type '{ colorScale?: { type: "categorical" | "continuous"; scale: ColorScale; label?: string | undefined; format?: ((value: number) => string) | undefined; } | undefined; sizeScale?: { ...; } | undefined; position?: Position | undefined; orientation?: "horizontal" | ... 1 more ... | undefined; className?: string | undefin...' is missing the following properties from type 'LegendStoryArgs': legendType, title
Error: src/components/viz/spatial/MapLegend.stories.tsx(113,5): error TS2353: Object literal may only specify known properties, and 'legendType' does not exist in type 'Partial<MapLegendProps>'.
Error: src/components/viz/spatial/MapLegend.stories.tsx(117,22): error TS2739: Type '{ colorScale?: { type: "categorical" | "continuous"; scale: ColorScale; label?: string | undefined; format?: ((value: number) => string) | undefined; } | undefined; sizeScale?: { ...; } | undefined; position?: Position | undefined; orientation?: "horizontal" | ... 1 more ... | undefined; className?: string | undefin...' is missing the following properties from type 'LegendStoryArgs': legendType, title
Error: src/components/viz/spatial/MapLegend.stories.tsx(122,5): error TS2353: Object literal may only specify known properties, and 'legendType' does not exist in type 'Partial<MapLegendProps>'.
Error: src/components/viz/spatial/MapLegend.stories.tsx(126,22): error TS2739: Type '{ colorScale?: { type: "categorical" | "continuous"; scale: ColorScale; label?: string | undefined; format?: ((value: number) => string) | undefined; } | undefined; sizeScale?: { ...; } | undefined; position?: Position | undefined; orientation?: "horizontal" | ... 1 more ... | undefined; className?: string | undefin...' is missing the following properties from type 'LegendStoryArgs': legendType, title
Error: src/components/viz/spatial/SpatialContainer.stories.tsx(43,25): error TS2352: Conversion of type 'Feature<Point, GeoJsonProperties>' to type 'FeatureCollection<Geometry, GeoJsonProperties>' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
Error: src/components/viz/spatial/SpatialContainer.stories.tsx(45,3): error TS2769: No overload matches this call.
  The last overload gave the following error.
    Argument of type 'unknown' is not assignable to parameter of type 'string | GeometryObject<GeoJsonProperties>'.
Error: src/components/viz/spatial/SpatialContainer.stories.tsx(49,31): error TS2352: Conversion of type 'Feature<Point, GeoJsonProperties>' to type 'FeatureCollection<Geometry, GeoJsonProperties>' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
Error: src/components/viz/spatial/SpatialContainer.stories.tsx(51,3): error TS2769: No overload matches this call.
  The last overload gave the following error.
    Argument of type 'unknown' is not assignable to parameter of type 'string | GeometryObject<GeoJsonProperties>'.
Error: src/components/viz/spatial/SpatialContainer.tsx(245,38): error TS2345: Argument of type 'RefObject<HTMLDivElement | null>' is not assignable to parameter of type 'RefObject<HTMLElement>'.
  Type 'HTMLDivElement | null' is not assignable to type 'HTMLElement'.
    Type 'null' is not assignable to type 'HTMLElement'.
Error: src/viz/adapters/spatial/echarts-bubble-adapter.ts(157,29): error TS2538: Type 'undefined' cannot be used as an index type.
Error: src/viz/adapters/spatial/echarts-bubble-adapter.ts(199,9): error TS2322: Type '{ type: "scatter"; coordinateSystem: string; geoIndex: number; name: string; data: { name: string; value: (number | null)[]; raw: DataRecord; itemStyle: { color: string; } | undefined; }[]; symbolSize: (value: unknown) => number; encode: { ...; }; tooltip: { ...; }; }' is not assignable to type 'ScatterSeriesOption$1'.
  Type '{ type: "scatter"; coordinateSystem: string; geoIndex: number; name: string; data: { name: string; value: (number | null)[]; raw: DataRecord; itemStyle: { color: string; } | undefined; }[]; symbolSize: (value: unknown) => number; encode: { ...; }; tooltip: { ...; }; }' is not assignable to type 'SeriesInjectedOption'.
    Types of property 'tooltip' are incompatible.
      Type '{ formatter: (params: { readonly data?: Record<string, unknown> | undefined; readonly name?: string | undefined; }) => string; }' is not assignable to type 'SeriesTooltipOption'.
        Type '{ formatter: (params: { readonly data?: Record<string, unknown> | undefined; readonly name?: string | undefined; }) => string; }' is not assignable to type 'CommonTooltipOption<CallbackDataParams>'.
          Types of property 'formatter' are incompatible.
            Type '(params: { readonly data?: Record<string, unknown> | undefined; readonly name?: string | undefined; }) => string' is not assignable to type 'string | TooltipFormatterCallback<CallbackDataParams> | undefined'.
              Type '(params: { readonly data?: Record<string, unknown> | undefined; readonly name?: string | undefined; }) => string' is not assignable to type 'TooltipFormatterCallback<CallbackDataParams>'.
                Types of parameters 'params' and 'params' are incompatible.
                  Type 'CallbackDataParams' is not assignable to type '{ readonly data?: Record<string, unknown> | undefined; readonly name?: string | undefined; }'.
                    Types of property 'data' are incompatible.
                      Type 'OptionDataItem' is not assignable to type 'Record<string, unknown> | undefined'.
                        Type 'null' is not assignable to type 'Record<string, unknown> | undefined'.
Error: src/viz/adapters/spatial/echarts-bubble-adapter.ts(255,9): error TS2322: Type '{ geo: GeoComponentOption; visualMap: VisualMapComponentOption | undefined; series: ScatterSeriesOption[]; tooltip: { ...; }; aria: { ...; }; title: { ...; } | undefined; usermeta: { ...; }; }' is not assignable to type 'EChartsOption'.
  Types of property 'tooltip' are incompatible.
    Type '{ trigger: "item"; formatter: (params: { readonly data?: Record<string, unknown> | undefined; readonly name?: string | undefined; }) => string; }' is not assignable to type 'TooltipOption | TooltipOption[] | undefined'.
      Type '{ trigger: "item"; formatter: (params: { readonly data?: Record<string, unknown> | undefined; readonly name?: string | undefined; }) => string; }' is not assignable to type 'TooltipOption'.
        Types of property 'formatter' are incompatible.
          Type '(params: { readonly data?: Record<string, unknown> | undefined; readonly name?: string | undefined; }) => string' is not assignable to type 'string | TooltipFormatterCallback<TopLevelFormatterParams> | undefined'.
            Type '(params: { readonly data?: Record<string, unknown> | undefined; readonly name?: string | undefined; }) => string' is not assignable to type 'TooltipFormatterCallback<TopLevelFormatterParams>'.
              Types of parameters 'params' and 'params' are incompatible.
                Type 'TopLevelFormatterParams' is not assignable to type '{ readonly data?: Record<string, unknown> | undefined; readonly name?: string | undefined; }'.
                  Type 'CallbackDataParams' is not assignable to type '{ readonly data?: Record<string, unknown> | undefined; readonly name?: string | undefined; }'.
Error: src/viz/adapters/spatial/echarts-choropleth-adapter.ts(131,9): error TS2322: Type '{ type: "map"; map: string; geoIndex: number; name: string; data: { name: string; value: number | null; rawProperties: Record<string, unknown> | undefined; }[]; emphasis: { focus: string; }; }' is not assignable to type 'MapSeriesOption$1'.
  Type '{ type: "map"; map: string; geoIndex: number; name: string; data: { name: string; value: number | null; rawProperties: Record<string, unknown> | undefined; }[]; emphasis: { focus: string; }; }' is not assignable to type 'MapSeriesOption'.
    Types of property 'data' are incompatible.
      Type '{ name: string; value: number | null; rawProperties: Record<string, unknown> | undefined; }[]' is not assignable to type '(OptionDataValueNumeric | OptionDataValueNumeric[] | MapDataItemOption)[]'.
        Type '{ name: string; value: number | null; rawProperties: Record<string, unknown> | undefined; }' is not assignable to type 'OptionDataValueNumeric | OptionDataValueNumeric[] | MapDataItemOption'.
          Type '{ name: string; value: number | null; rawProperties: Record<string, unknown> | undefined; }' is not assignable to type 'MapDataItemOption'.
            Types of property 'value' are incompatible.
              Type 'number | null' is not assignable to type 'OptionDataValueNumeric | OptionDataValueNumeric[] | undefined'.
                Type 'null' is not assignable to type 'OptionDataValueNumeric | OptionDataValueNumeric[] | undefined'.
Error: src/viz/adapters/spatial/echarts-choropleth-adapter.ts(169,9): error TS2322: Type '{ geo: GeoComponentOption; visualMap: VisualMapComponentOption; series: MapSeriesOption[]; tooltip: { trigger: "item"; formatter: (params: { ...; }) => string; }; aria: { ...; }; title: { ...; } | undefined; usermeta: { ...; }; }' is not assignable to type 'EChartsOption'.
  Types of property 'tooltip' are incompatible.
    Type '{ trigger: "item"; formatter: (params: { readonly data?: Record<string, unknown> | undefined; readonly name?: string | undefined; }) => string; }' is not assignable to type 'TooltipOption | TooltipOption[] | undefined'.
      Type '{ trigger: "item"; formatter: (params: { readonly data?: Record<string, unknown> | undefined; readonly name?: string | undefined; }) => string; }' is not assignable to type 'TooltipOption'.
        Types of property 'formatter' are incompatible.
          Type '(params: { readonly data?: Record<string, unknown> | undefined; readonly name?: string | undefined; }) => string' is not assignable to type 'string | TooltipFormatterCallback<TopLevelFormatterParams> | undefined'.
Error: src/viz/adapters/spatial/index.ts(14,1): error TS2308: Module './vega-lite-choropleth-adapter.js' has already exported a member named 'VegaLiteLayer'. Consider explicitly re-exporting to resolve the ambiguity.
Error: src/viz/adapters/spatial/vega-lite-bubble-adapter.ts(8,54): error TS2339: Property 'layer' does not exist on type 'TopLevelSpec'.
Error: src/viz/adapters/spatial/vega-lite-choropleth-adapter.ts(7,54): error TS2339: Property 'layer' does not exist on type 'TopLevelSpec'.
Error: src/viz/adapters/spatial/vega-lite-projection-map.ts(1,33): error TS2307: Cannot find module 'vega-lite/build/src/projection' or its corresponding type declarations.
Error: src/viz/adapters/spatial/vega-lite-scale-map.ts(1,28): error TS2307: Cannot find module 'vega-lite/build/src/scale' or its corresponding type declarations.
Error: src/viz/adapters/spatial/vega-lite-spatial-adapter.ts(118,3): error TS2344: Type '"title" | "description" | "width" | "height" | "padding" | "$schema" | "usermeta" | "projection"' does not satisfy the constraint '"title" | "name" | "description" | "data" | "background" | "padding" | "autosize" | "transform" | "$schema" | "config" | "params" | "usermeta" | "resolve" | "datasets"'.
  Type '"width"' is not assignable to type '"title" | "name" | "description" | "data" | "background" | "padding" | "autosize" | "transform" | "$schema" | "config" | "params" | "usermeta" | "resolve" | "datasets"'.
Error: src/viz/adapters/spatial/vega-lite-spatial-adapter.ts(180,9): error TS2322: Type '{ layer: any[]; title?: Text | TitleParams<ExprRef | SignalRef> | undefined; description?: string | undefined; width: unknown; height: unknown; padding?: ExprRef | SignalRef | Padding | undefined; $schema?: string | undefined; usermeta?: Dict<...> | undefined; projection: unknown; }' is not assignable to type 'TopLevelSpec'.
  Type '{ layer: any[]; title?: Text | TitleParams<ExprRef | SignalRef> | undefined; description?: string | undefined; width: unknown; height: unknown; padding?: ExprRef | SignalRef | Padding | undefined; $schema?: string | undefined; usermeta?: Dict<...> | undefined; projection: unknown; }' is not assignable to type 'TopLevel<LayerSpec<Field>>'.
    Type '{ layer: any[]; title?: Text | TitleParams<ExprRef | SignalRef> | undefined; description?: string | undefined; width: unknown; height: unknown; padding?: ExprRef | SignalRef | Padding | undefined; $schema?: string | undefined; usermeta?: Dict<...> | undefined; projection: unknown; }' is not assignable to type 'LayerSpec<Field>'.
      Types of property 'projection' are incompatible.
        Type 'unknown' is not assignable to type 'Projection<ExprRef> | undefined'.
Error: src/viz/patterns/spatial-detection.ts(202,6): error TS6196: '_KeepSpatialSpec' is declared but never used.
 ELIFECYCLE  Command failed with exit code 2.
Error: Process completed with exit code 2.
