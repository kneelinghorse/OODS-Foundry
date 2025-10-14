/**
 * ViewContextProvider
 * 
 * Protocol-aware context system for adaptive component rendering.
 * Integrates with Semantic Protocol to track context changes and
 * enable Layer 4 context-aware styling.
 * 
 * Protocol URN: urn:proto:context:view-context@1.0.0
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

// ========================================
// Context Definition
// ========================================

const ViewContext = createContext({
  context: 'detail',
  setContext: () => {},
  contextHistory: [],
  protocolMetadata: null,
});

// ========================================
// Valid Context Types
// Maps to protocol manifest contexts
// ========================================

export const VALID_CONTEXTS = {
  LIST: 'list',
  DETAIL: 'detail', 
  FORM: 'form',
  TIMELINE: 'timeline',
  GRID: 'grid',
  CARD: 'card',
};

/**
 * Context metadata for protocol integration
 * URN: urn:proto:context:view-context@1.0.0#metadata
 */
const CONTEXT_METADATA = {
  list: {
    purpose: 'Compact, scannable view for tables/grids',
    density: 'compact',
    interactivity: 'low',
    typical_components: ['StatusBadge', 'Avatar', 'Actions'],
    constraints: {
      max_text_size: 'text-sm',
      max_padding: 'p-2',
      truncate: true,
      show_full_details: false,
    },
    accessibility: {
      role_suggestions: ['row', 'cell', 'gridcell'],
      keyboard_nav: 'arrow-keys',
    },
  },
  
  detail: {
    purpose: 'Full information display with all details visible',
    density: 'default',
    interactivity: 'medium',
    typical_components: ['Card', 'Description', 'Metadata'],
    constraints: {
      min_text_size: 'text-base',
      show_full_details: true,
    },
    accessibility: {
      role_suggestions: ['article', 'main'],
      keyboard_nav: 'tab',
    },
  },
  
  form: {
    purpose: 'Editable input context with validation',
    density: 'comfortable',
    interactivity: 'high',
    typical_components: ['Input', 'Select', 'Checkbox'],
    constraints: {
      required_props: ['onChange', 'value', 'error'],
      required_aria: ['aria-invalid', 'aria-describedby'],
      show_labels: true,
      show_errors: true,
    },
    accessibility: {
      role_suggestions: ['form', 'group'],
      keyboard_nav: 'tab',
      required_focus_management: true,
    },
  },
  
  timeline: {
    purpose: 'Chronological event display',
    density: 'comfortable',
    interactivity: 'low',
    typical_components: ['TimelineItem', 'Badge', 'Timestamp'],
    constraints: {
      show_timestamps: true,
      vertical_spacing: 'space-y-4',
    },
    accessibility: {
      role_suggestions: ['list', 'feed'],
      keyboard_nav: 'arrow-keys',
    },
  },
  
  grid: {
    purpose: 'Multi-column card layout',
    density: 'default',
    interactivity: 'medium',
    typical_components: ['Card', 'Image', 'Actions'],
    constraints: {
      responsive_columns: true,
      aspect_ratio: '16/9',
    },
    accessibility: {
      role_suggestions: ['list', 'grid'],
      keyboard_nav: 'arrow-keys',
    },
  },
  
  card: {
    purpose: 'Standalone content container',
    density: 'comfortable',
    interactivity: 'medium',
    typical_components: ['Header', 'Body', 'Footer'],
    constraints: {
      has_border: true,
      has_shadow: true,
    },
    accessibility: {
      role_suggestions: ['article', 'region'],
      keyboard_nav: 'tab',
    },
  },
};

// ========================================
// Provider Component
// ========================================

export const ViewContextProvider = ({ 
  value = VALID_CONTEXTS.DETAIL, 
  children,
  enableProtocolTracking = true,
  onContextChange,
}) => {
  const [context, setContextState] = useState(value);
  const [contextHistory, setContextHistory] = useState([value]);
  const [protocolMetadata, setProtocolMetadata] = useState(null);
  
  // Validate context
  useEffect(() => {
    const isValid = Object.values(VALID_CONTEXTS).includes(value);
    if (!isValid) {
      console.warn(
        `[ViewContext] Invalid context "${value}". Must be one of: ${Object.values(VALID_CONTEXTS).join(', ')}`
      );
    }
  }, [value]);
  
  // Update protocol metadata when context changes
  useEffect(() => {
    if (enableProtocolTracking) {
      setProtocolMetadata({
        ...CONTEXT_METADATA[context],
        current_context: context,
        timestamp: new Date().toISOString(),
        urn: `urn:proto:context:view-context@1.0.0#${context}`,
      });
    }
  }, [context, enableProtocolTracking]);
  
  // Wrapped setState to track history
  const setContext = useCallback((newContext) => {
    if (Object.values(VALID_CONTEXTS).includes(newContext)) {
      setContextState(newContext);
      setContextHistory(prev => [...prev, newContext].slice(-10)); // Keep last 10
      
      if (onContextChange) {
        onContextChange({
          from: context,
          to: newContext,
          metadata: CONTEXT_METADATA[newContext],
        });
      }
    } else {
      console.error(`[ViewContext] Attempted to set invalid context: ${newContext}`);
    }
  }, [context, onContextChange]);
  
  const value_object = {
    context,
    setContext,
    contextHistory,
    protocolMetadata,
    isValid: (ctx) => Object.values(VALID_CONTEXTS).includes(ctx),
    getMetadata: (ctx) => CONTEXT_METADATA[ctx || context],
  };
  
  return (
    <ViewContext.Provider value={value_object}>
      {children}
    </ViewContext.Provider>
  );
};

// ========================================
// Hooks
// ========================================

/**
 * Hook to access current view context
 * Returns the current context string and metadata
 */
export const useViewContext = () => {
  const ctx = useContext(ViewContext);
  
  if (!ctx) {
    throw new Error('useViewContext must be used within ViewContextProvider');
  }
  
  return ctx.context;
};

/**
 * Hook to access full context state including setters
 */
export const useViewContextState = () => {
  const ctx = useContext(ViewContext);
  
  if (!ctx) {
    throw new Error('useViewContextState must be used within ViewContextProvider');
  }
  
  return ctx;
};

/**
 * Hook to get protocol metadata for current context
 */
export const useContextMetadata = () => {
  const ctx = useContext(ViewContext);
  
  if (!ctx) {
    throw new Error('useContextMetadata must be used within ViewContextProvider');
  }
  
  return ctx.protocolMetadata;
};

/**
 * Hook to conditionally render based on context
 * 
 * @example
 * const { is, oneOf } = useContextConditional();
 * 
 * if (is('list')) {
 *   return <CompactView />;
 * }
 * 
 * if (oneOf(['detail', 'card'])) {
 *   return <FullView />;
 * }
 */
export const useContextConditional = () => {
  const context = useViewContext();
  
  return {
    is: (ctx) => context === ctx,
    oneOf: (contexts) => contexts.includes(context),
    not: (ctx) => context !== ctx,
    context,
  };
};

// ========================================
// Higher-Order Component
// ========================================

/**
 * HOC to inject context as prop
 * Useful for class components or when you need context as a prop
 * 
 * @example
 * const MyComponent = withViewContext(({ viewContext, ...props }) => {
 *   return <div data-context={viewContext}>...</div>;
 * });
 */
export const withViewContext = (Component) => {
  return function WithViewContextComponent(props) {
    const context = useViewContext();
    return <Component {...props} viewContext={context} />;
  };
};

// ========================================
// Utility Functions
// ========================================

/**
 * Generate data-context attribute value
 * Used for Tailwind context variants
 */
export const getContextDataAttr = (context) => {
  return Object.values(VALID_CONTEXTS).includes(context) ? context : 'detail';
};

/**
 * Get recommended component props for a context
 * Based on protocol metadata constraints
 */
export const getRecommendedPropsForContext = (context, componentType) => {
  const metadata = CONTEXT_METADATA[context];
  if (!metadata) return {};
  
  const recommendations = {};
  
  // Apply density-based recommendations
  if (metadata.density === 'compact') {
    recommendations.size = 'sm';
    recommendations.truncate = true;
  } else if (metadata.density === 'comfortable') {
    recommendations.size = 'lg';
    recommendations.spacing = 'relaxed';
  }
  
  // Apply interactivity recommendations
  if (metadata.interactivity === 'high') {
    recommendations.showHoverState = true;
    recommendations.showFocusRing = true;
  }
  
  // Apply constraint-based recommendations
  if (metadata.constraints) {
    Object.assign(recommendations, metadata.constraints);
  }
  
  return recommendations;
};

/**
 * Validate component against context requirements
 * Used in development to warn about context mismatches
 */
export const validateComponentForContext = (componentName, context, props) => {
  const metadata = CONTEXT_METADATA[context];
  if (!metadata || process.env.NODE_ENV === 'production') return true;
  
  const warnings = [];
  
  // Check required props for form context
  if (context === 'form' && metadata.constraints.required_props) {
    metadata.constraints.required_props.forEach(requiredProp => {
      if (!(requiredProp in props)) {
        warnings.push(`${componentName} in form context should have "${requiredProp}" prop`);
      }
    });
  }
  
  // Check ARIA requirements for form context
  if (context === 'form' && metadata.constraints.required_aria) {
    // This would need actual DOM checking in a real implementation
    console.info(`[ViewContext] ${componentName} in form context should implement: ${metadata.constraints.required_aria.join(', ')}`);
  }
  
  if (warnings.length > 0) {
    console.warn(`[ViewContext] Context validation warnings for ${componentName}:`, warnings);
  }
  
  return warnings.length === 0;
};

// ========================================
// Exports
// ========================================

export default ViewContext;

/**
 * USAGE EXAMPLES
 * 
 * 1. Basic Provider:
 *    <ViewContextProvider value="list">
 *      <MyComponent />
 *    </ViewContextProvider>
 * 
 * 2. Using the hook in a component:
 *    const MyComponent = () => {
 *      const context = useViewContext();
 *      return <div data-context={context}>Content adapts to {context}</div>;
 *    };
 * 
 * 3. Conditional rendering:
 *    const { is, oneOf } = useContextConditional();
 *    if (is('list')) return <CompactView />;
 *    if (oneOf(['detail', 'card'])) return <FullView />;
 * 
 * 4. Dynamic context switching:
 *    const { context, setContext } = useViewContextState();
 *    <button onClick={() => setContext('list')}>Switch to list</button>
 * 
 * 5. Getting protocol metadata:
 *    const metadata = useContextMetadata();
 *    console.log(metadata.purpose); // "Compact, scannable view for tables/grids"
 */
