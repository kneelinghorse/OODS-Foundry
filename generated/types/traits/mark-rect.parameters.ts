// Auto-generated from traits/mark-rect.parameters.schema.json. Do not edit manually.

/**
 * Read-only chart rendered by public viz.render during code generation. Payment events retain the Subscription projection. Record-array charts bind a declared object array and use authored sampleRows to seed generated sample records, with no separate generated chart series. Edge-array charts bind a declared neighborhood array: sorted distinct node ids, row-ordered directed links, optional bidirectional reverse links deduplicated by ordered pair, without numeric values or groups. Static SVG assets are keyed by seed record identity; consumers can replace the typed svg prop. One distinct chart declaration is supported per generated object; repeated identical projections share the same asset.
 */
export type MarkRectChartDeclaration = {
  chartType: 'heatmap';
  source: 'record-array';
  /**
   * Declared objectSchema array field containing the chart rows.
   */
  dataField: string;
  /**
   * Channel -> field bindings. Required, with at least x and y, when chartType is supplied (explicit mode).
   */
  encodings: {
    x: MarkRectChartEncodingBinding;
    y: MarkRectChartEncodingBinding;
    color?: MarkRectChartColorEncodingBinding;
    size?: MarkRectChartEncodingBinding;
    shape?: MarkRectChartEncodingBinding;
    detail?: MarkRectChartEncodingBinding;
  };
  /**
   * Authored sample rows, including explicitly labelled synthetic examples, copied into the declared array field of generated sample records. These exact records supply public viz.render; no separate synthetic chart series is invented.
   *
   * @minItems 1
   */
  sampleRows: [
    {
      [k: string]: unknown;
    },
    ...{
      [k: string]: unknown;
    }[]
  ];
  /**
   * Money (s223-m01), declared with currencyField: the y encoding's field holds amounts in minor units. Generation divides each row's value by minorUnits, as the payment-events source does, and formats the y axis in the record's currency ("$,f": $12,000 for USD, £12,000 for GBP).
   */
  minorUnits?: number;
  /**
   * Money (s223-m01), declared with minorUnits: the charted record's field holding its ISO 4217 currency code (Invoice's currency). Its symbol prints on the y axis and the code in the chart's accessible description.
   */
  currencyField?: string;
  brand?: string;
};
/**
 * An encoding binding: either a bare field-name string, or an object with the field plus optional aggregate/scale/timeUnit/sort/title.
 */
export type MarkRectChartEncodingBinding =
  | string
  | {
      field: string;
      aggregate?: 'sum' | 'count' | 'average' | 'median' | 'min' | 'max' | 'distinct';
      scale?: 'linear' | 'temporal' | 'log' | 'sqrt' | 'band' | 'point' | 'diverging';
      /**
       * Force the Vega-Lite/ECharts field type, overriding the engine's data-aware inference (sprint-125 m02 manual escape hatch). Wins over the m01 profile-derived type.
       */
      type?: 'quantitative' | 'temporal' | 'ordinal' | 'nominal';
      timeUnit?: 'year' | 'quarter' | 'month' | 'week' | 'day' | 'hour' | 'minute' | 'second';
      sort?:
        | ('none' | 'ascending' | 'descending')
        | {
            field: string;
            order: 'ascending' | 'descending';
          };
      title?: string;
      /**
       * Label format of this channel's axis (x, y) or legend: a d3-format specifier such as "$,f" or ",.0f" (d3-time-format for a temporal field). "$" prints the currency symbol: the currency's, else $. Without a precision, labels take the precision of the tick step, so neighbouring ticks never print the same text. Carried in the normalized spec, so artifact.certify replays it.
       */
      format?: string;
      /**
       * ISO 4217 code of the amounts this channel encodes, for example EUR. The labels print its en-US symbol where the format has "$" (EUR €, GBP £); without a format they read "$,f" ($12,000). One currency per chart. A record-array declaration's money (minorUnits and currencyField) sets it from each record.
       */
      currency?: string;
      /**
       * Declared charts only: a field of the charted record whose text titles this axis, so each record's chart names its own unit (Usage's y axis reads the record's unit_label, "API calls"). Generation resolves it into title before viz.render; a record without that text takes title, and a chart with neither fails.
       */
      titleField?: string;
    };
/**
 * A color-channel encoding binding: like encodingBinding, plus an optional explicit `range` (hex colors) that overrides the baked OODS categorical palette on a nominal/ordinal color scale (sprint-147 F5). `range` is only valid on the color channel.
 */
export type MarkRectChartColorEncodingBinding =
  | string
  | {
      field: string;
      aggregate?: 'sum' | 'count' | 'average' | 'median' | 'min' | 'max' | 'distinct';
      scale?: 'linear' | 'temporal' | 'log' | 'sqrt' | 'band' | 'point' | 'diverging';
      /**
       * Force the Vega-Lite/ECharts field type, overriding the engine's data-aware inference (sprint-125 m02 manual escape hatch). Wins over the m01 profile-derived type.
       */
      type?: 'quantitative' | 'temporal' | 'ordinal' | 'nominal';
      timeUnit?: 'year' | 'quarter' | 'month' | 'week' | 'day' | 'hour' | 'minute' | 'second';
      sort?:
        | ('none' | 'ascending' | 'descending')
        | {
            field: string;
            order: 'ascending' | 'descending';
          };
      title?: string;
      /**
       * Explicit hex colors for a nominal/ordinal color scale (sprint-147 F5). Overrides the baked OODS categorical palette so an agent can supply its own scale (e.g. a 2-color presence scale). Applied in array order to the distinct series; a shorter range recycles (Vega domain[i]->range[i] mod len). Cartesian color only.
       *
       * @minItems 2
       */
      range?: [string, string, ...string[]];
    };

export interface MarkRectTraitParameters {
  /**
   * JSON-encoded Cartesian viz.render input fragment; data rows are supplied by the consumer.
   */
  renderIntent?: string;
  /**
   * Static SVG returned by viz.render for the authored sample.
   */
  previewSvg?: string;
  chart?: MarkRectChartDeclaration;
  /**
   * Title of the read-only chart projection.
   */
  title?: string;
  /**
   * Accessible description of the read-only chart projection.
   */
  description?: string;
}
