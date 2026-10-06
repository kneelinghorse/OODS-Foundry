// Auto-generated from traits/encoding-position-x.parameters.schema.json. Do not edit manually.

export interface EncodingPositionXTraitParameters {
  /**
   * Data categories that can map to the X axis.
   *
   * @minItems 1
   */
  fieldKinds: [
    'nominal' | 'ordinal' | 'quantitative' | 'temporal',
    ...('nominal' | 'ordinal' | 'quantitative' | 'temporal')[]
  ];
  /**
   * Default scale used when none is specified.
   */
  defaultScale: 'linear' | 'temporal';
  /**
   * Whether quantitative mappings force a zero baseline.
   */
  includeZero?: boolean;
  /**
   * Default title surfaced in axis + a11y description.
   */
  axisTitle?: string;
  /**
   * Default sort applied to discrete categories.
   */
  sorting?: 'none' | 'ascending' | 'descending';
  /**
   * JSON-encoded Cartesian viz.render input fragment for the governed authoring recipes. Data rows remain a consumer operand.
   */
  renderIntent?: string;
}
