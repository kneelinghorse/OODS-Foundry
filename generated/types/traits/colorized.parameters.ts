// Auto-generated from traits/colorized.parameters.schema.json. Do not edit manually.

/**
 * Configuration contract for Colorized trait semantics.
 */
export interface ColorizedTraitParameters {
  /**
   * Semantic tone keys defining the palette of status colors. Maps to --cmp-status-{tone}-* tokens.
   *
   * @minItems 1
   * @maxItems 8
   */
  colorStates:
    | ['neutral' | 'info' | 'accent' | 'success' | 'warning' | 'critical']
    | [
        'neutral' | 'info' | 'accent' | 'success' | 'warning' | 'critical',
        'neutral' | 'info' | 'accent' | 'success' | 'warning' | 'critical'
      ]
    | [
        'neutral' | 'info' | 'accent' | 'success' | 'warning' | 'critical',
        'neutral' | 'info' | 'accent' | 'success' | 'warning' | 'critical',
        'neutral' | 'info' | 'accent' | 'success' | 'warning' | 'critical'
      ]
    | [
        'neutral' | 'info' | 'accent' | 'success' | 'warning' | 'critical',
        'neutral' | 'info' | 'accent' | 'success' | 'warning' | 'critical',
        'neutral' | 'info' | 'accent' | 'success' | 'warning' | 'critical',
        'neutral' | 'info' | 'accent' | 'success' | 'warning' | 'critical'
      ]
    | [
        'neutral' | 'info' | 'accent' | 'success' | 'warning' | 'critical',
        'neutral' | 'info' | 'accent' | 'success' | 'warning' | 'critical',
        'neutral' | 'info' | 'accent' | 'success' | 'warning' | 'critical',
        'neutral' | 'info' | 'accent' | 'success' | 'warning' | 'critical',
        'neutral' | 'info' | 'accent' | 'success' | 'warning' | 'critical'
      ]
    | [
        'neutral' | 'info' | 'accent' | 'success' | 'warning' | 'critical',
        'neutral' | 'info' | 'accent' | 'success' | 'warning' | 'critical',
        'neutral' | 'info' | 'accent' | 'success' | 'warning' | 'critical',
        'neutral' | 'info' | 'accent' | 'success' | 'warning' | 'critical',
        'neutral' | 'info' | 'accent' | 'success' | 'warning' | 'critical',
        'neutral' | 'info' | 'accent' | 'success' | 'warning' | 'critical'
      ]
    | [
        'neutral' | 'info' | 'accent' | 'success' | 'warning' | 'critical',
        'neutral' | 'info' | 'accent' | 'success' | 'warning' | 'critical',
        'neutral' | 'info' | 'accent' | 'success' | 'warning' | 'critical',
        'neutral' | 'info' | 'accent' | 'success' | 'warning' | 'critical',
        'neutral' | 'info' | 'accent' | 'success' | 'warning' | 'critical',
        'neutral' | 'info' | 'accent' | 'success' | 'warning' | 'critical',
        'neutral' | 'info' | 'accent' | 'success' | 'warning' | 'critical'
      ]
    | [
        'neutral' | 'info' | 'accent' | 'success' | 'warning' | 'critical',
        'neutral' | 'info' | 'accent' | 'success' | 'warning' | 'critical',
        'neutral' | 'info' | 'accent' | 'success' | 'warning' | 'critical',
        'neutral' | 'info' | 'accent' | 'success' | 'warning' | 'critical',
        'neutral' | 'info' | 'accent' | 'success' | 'warning' | 'critical',
        'neutral' | 'info' | 'accent' | 'success' | 'warning' | 'critical',
        'neutral' | 'info' | 'accent' | 'success' | 'warning' | 'critical',
        'neutral' | 'info' | 'accent' | 'success' | 'warning' | 'critical'
      ];
  /**
   * WCAG contrast compliance target for all color pairings.
   */
  contrastLevel?: 'AA' | 'AAA';
  /**
   * How color_state values resolve to tokens: semantic (system layer) or custom (object-specific).
   */
  colorMode?: 'semantic' | 'custom';
  /**
   * Tone applied when a status value cannot be resolved to a known color state.
   */
  fallbackTone?: 'neutral' | 'info';
}
