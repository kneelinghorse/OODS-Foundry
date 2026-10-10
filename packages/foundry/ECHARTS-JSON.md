# ECharts after JSON transport

From 0.11.1, a formatted Cartesian `echartsSpec` carries `__oodsFormat` data on its axis labels and tooltip. It records the d3 format, currency and explicit number locale. Numeric values remain numeric, so the axis scale and bar positions stay correct.

Before giving a returned option to ECharts, restore these formats:

```js
import { restoreEChartsFormats } from '@oods/foundry/echarts.js';

chart.setOption(restoreEChartsFormats(result.echartsSpec));
```

The helper is a standalone browser module in the npm package. It does not import ECharts or Node and does not evaluate code from the response. A browser without a bundler can import the same file from `https://cdn.jsdelivr.net/npm/@oods/foundry@0.11.1/echarts.js`.

For example, `encodings.y: {field: "amount", currency: "EUR", format: "$,.2f"}` displays −1,234.5 as **−€1,234.50** in both the value axis and tooltip after transport. Currency formatting retains OODS Foundry's existing en-US separators and currency symbol convention. The descriptor carries that locale explicitly, so a client's local defaults cannot change it. Temporal formats use UTC. Unformatted charts need no special handling.

Direct ECharts consumers must call this helper: native ECharts ignores the descriptor, and JSON cannot carry a JavaScript callback. The in-process adapter retains its existing callbacks. Geo clients still register `echartsSpec.__registration` as documented; this helper does not register maps.
