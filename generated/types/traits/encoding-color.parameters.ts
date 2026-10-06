// Auto-generated from traits/encoding-color.parameters.schema.json. Do not edit manually.

export interface EncodingColorTraitParameters {
  /**
   * Palette categories this encoding may leverage.
   *
   * @minItems 1
   */
  supportedSchemes: ['categorical' | 'sequential' | 'diverging', ...('categorical' | 'sequential' | 'diverging')[]];
  /**
   * Palette category used when unspecified.
   */
  defaultScheme: 'categorical' | 'sequential' | 'diverging';
  /**
   * Non-color fallback used to satisfy equivalence rules.
   */
  redundancyMechanism: 'texture' | 'shape' | 'label';
  /**
   * Minimum contrast ratio enforced between adjacent categories.
   */
  minContrast?: number;
  /**
   * Graphical channel color touches (fill vs stroke).
   */
  channel?: 'fill' | 'stroke';
  /**
   * JSON-encoded Cartesian viz.render input fragment for the governed authoring recipes. Data rows remain a consumer operand.
   */
  renderIntent?: string;
}
