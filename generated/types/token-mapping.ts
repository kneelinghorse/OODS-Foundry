// Auto-generated from token-mapping.schema.json. Do not edit manually.

/**
 * Defines the structure for mapping enumerated status values to semantic UI tokens.
 */
export interface SemanticTokenMapping {
  /**
   * Descriptive metadata about the mapping manifest.
   */
  metadata: {
    /**
     * Human-readable description of the object and field this mapping applies to (e.g., 'Status mapping for saas/Subscription.status').
     */
    description: string;
    /**
     * Semantic version of this mapping file.
     */
    version: string;
    /**
     * Team or individual responsible for maintaining this mapping.
     */
    owner?: string;
  };
  /**
   * Dictionary mapping each enum value to its semantic token set.
   */
  mappings: {
    [k: string]: TokenMapping;
  };
}
/**
 * Defines the default treatment and any context-specific overrides for a status value.
 *
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^[a-z0-9_]+$".
 */
export interface TokenMapping {
  /**
   * Human-readable explanation of the status.
   */
  description: string;
  default: TokenPayload;
  /**
   * Optional map of context-specific overrides (e.g., 'badge', 'banner').
   */
  contexts?: {
    [k: string]: TokenOverride;
  };
}
/**
 * Default token payload to apply in most contexts.
 */
export interface TokenPayload {
  /**
   * Token for text/icon color (e.g., 'color.text.positive').
   */
  foregroundColor: string;
  /**
   * Token for background/fill color (e.g., 'color.background.positive.subtle').
   */
  backgroundColor: string;
  /**
   * Token for border color (e.g., 'color.border.positive').
   */
  borderColor: string;
  /**
   * Icon identifier conveying the status (e.g., 'icon.status.success').
   */
  iconName: string;
}
/**
 * Tokens that override one or more visual attributes in a specific context.
 *
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^[a-zA-Z0-9_]+$".
 */
export interface TokenOverride {
  /**
   * Token for text/icon color (e.g., 'color.text.positive').
   */
  foregroundColor?: string;
  /**
   * Token for background/fill color (e.g., 'color.background.positive.subtle').
   */
  backgroundColor?: string;
  /**
   * Token for border color (e.g., 'color.border.positive').
   */
  borderColor?: string;
  /**
   * Icon identifier conveying the status (e.g., 'icon.status.success').
   */
  iconName?: string;
}
