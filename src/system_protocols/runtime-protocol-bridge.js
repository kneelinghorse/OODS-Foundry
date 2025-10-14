/**
 * Runtime Protocol Bridge — v1.0.0
 * 
 * Connects static protocol manifests to runtime React components,
 * enabling semantic and contextual awareness during execution.
 * 
 * Key Features:
 * - Hydrates static protocol manifests into runtime-queryable objects
 * - Integrates with React Context API for context-aware rendering
 * - Provides hooks for accessing protocol metadata in components
 * - Validates component usage against protocol contracts at runtime
 * - Enables semantic relationship discovery during development
 */

import { createSemanticProtocol } from './Semantic Protocol — v3.2.0.js';
import { createUIProtocol } from './ui_component_protocol_v_1_1_1.js';

// ————————————————————————————————————————————————————————————————
// 1. Protocol Registry — Central store for all protocol manifests
// ————————————————————————————————————————————————————————————————

class ProtocolRegistry {
  constructor() {
    this._protocols = new Map();
    this._componentMap = new Map(); // componentName -> protocol URN
  }

  /**
   * Register a protocol manifest with the registry
   */
  register(protocol) {
    const urn = protocol.manifest().urn;
    this._protocols.set(urn, protocol);
    
    // Index by component name for easy lookup
    const componentName = protocol.manifest()?.component?.name 
                       || protocol.manifest()?.metadata?.name;
    if (componentName) {
      this._componentMap.set(componentName, urn);
    }
    
    return urn;
  }

  /**
   * Get protocol by URN or component name
   */
  get(identifier) {
    // Try direct URN lookup first
    if (this._protocols.has(identifier)) {
      return this._protocols.get(identifier);
    }
    
    // Try component name lookup
    const urn = this._componentMap.get(identifier);
    return urn ? this._protocols.get(urn) : null;
  }

  /**
   * Find protocols matching criteria
   */
  query(predicate) {
    return Array.from(this._protocols.values())
      .filter(protocol => predicate(protocol.manifest()));
  }

  /**
   * Get all protocols for catalog analysis
   */
  all() {
    return Array.from(this._protocols.values());
  }

  /**
   * Discover semantic relationships across all registered protocols
   */
  discoverRelationships(threshold = 0.85) {
    const semanticProtocols = this.query(m => m.semantics?.features?.vector);
    if (semanticProtocols.length === 0) return [];
    
    const { createSemanticCatalog } = require('./Semantic Protocol — v3.2.0.js');
    const catalog = createSemanticCatalog(semanticProtocols);
    return catalog.discoverRelationships(threshold);
  }
}

// Global singleton registry
const registry = new ProtocolRegistry();

// ————————————————————————————————————————————————————————————————
// 2. Context Protocol — Enhanced ViewContext with protocol awareness
// ————————————————————————————————————————————————————————————————

import React, { createContext, useContext, useMemo } from 'react';

const ViewContextProtocol = createContext({
  view: 'detail', // Current view context (list, detail, form, timeline)
  domain: null,   // Business domain (subscription, user, billing)
  flow: null,     // User flow (checkout, onboarding, settings)
  step: null,     // Current step in flow
  criticality: 0.5, // Context criticality (affects component behavior)
});

export const ProtocolViewProvider = ({ 
  value, 
  domain, 
  flow, 
  step, 
  criticality,
  children 
}) => {
  const contextValue = useMemo(() => ({
    view: value || 'detail',
    domain,
    flow,
    step,
    criticality: criticality ?? 0.5,
  }), [value, domain, flow, step, criticality]);

  return (
    <ViewContextProtocol.Provider value={contextValue}>
      {children}
    </ViewContextProtocol.Provider>
  );
};

export const useProtocolContext = () => useContext(ViewContextProtocol);

// ————————————————————————————————————————————————————————————————
// 3. Protocol-Aware Component Hook
// ————————————————————————————————————————————————————————————————

/**
 * Hook that provides protocol metadata and context to a component
 * 
 * @param {string} componentName - Name of the component
 * @returns {object} Protocol metadata and context utilities
 */
export const useProtocol = (componentName) => {
  const context = useProtocolContext();
  const protocol = registry.get(componentName);
  
  // Development-only warnings
  if (process.env.NODE_ENV !== 'production') {
    if (!protocol) {
      console.warn(`[Protocol Warning] No protocol found for component: ${componentName}`);
    }
  }

  return useMemo(() => {
    const manifest = protocol?.manifest();
    
    return {
      // Core protocol metadata
      urn: manifest?.urn,
      intent: manifest?.element?.intent,
      criticality: manifest?.element?.criticality,
      
      // Context information
      context: {
        ...context,
        // Check if current context is supported by component
        isSupported: manifest?.context?.supported_contexts?.includes(context.view) ?? true,
      },
      
      // Semantic information
      semantics: {
        purpose: manifest?.semantics?.purpose,
        confidence: manifest?.semantics?.precision?.confidence,
      },
      
      // Governance
      governance: {
        owner: manifest?.governance?.owner,
        piiHandling: manifest?.governance?.piiHandling,
        businessImpact: manifest?.governance?.businessImpact,
      },
      
      // Protocol bindings
      bindings: manifest?.context?.protocolBindings || {},
      
      // Validation utilities
      validate: () => protocol?.validate(),
      
      // Context-aware styling helper
      getContextClasses: (baseClasses, contextOverrides = {}) => {
        const classes = [baseClasses];
        const currentContext = context.view;
        
        if (contextOverrides[currentContext]) {
          classes.push(contextOverrides[currentContext]);
        }
        
        return classes.filter(Boolean).join(' ');
      },
      
      // Criticality-aware behavior
      shouldShowLoadingState: () => {
        // High criticality components should show loading states
        return (manifest?.element?.criticality ?? 0) > 0.7;
      },
      
      shouldShowErrorBoundary: () => {
        // Critical components should have error boundaries
        return (manifest?.element?.criticality ?? 0) > 0.8;
      },
    };
  }, [protocol, context, componentName]);
};

// ————————————————————————————————————————————————————————————————
// 4. Protocol-Enhanced Component Wrapper
// ————————————————————————————————————————————————————————————————

/**
 * Higher-order component that wraps components with protocol awareness
 * 
 * Usage:
 *   const EnhancedButton = withProtocol('PrimaryButton', Button);
 */
export const withProtocol = (componentName, Component) => {
  const WithProtocol = React.forwardRef((props, ref) => {
    const protocol = useProtocol(componentName);
    const context = useProtocolContext();
    
    // Add protocol metadata as data attributes for debugging/testing
    const protocolAttrs = process.env.NODE_ENV !== 'production' ? {
      'data-protocol-urn': protocol.urn,
      'data-protocol-intent': protocol.intent,
      'data-protocol-criticality': protocol.criticality,
    } : {};

    return (
      <Component
        ref={ref}
        {...props}
        {...protocolAttrs}
        data-context={context.view}
        protocol={protocol}
      />
    );
  });

  WithProtocol.displayName = `withProtocol(${componentName})`;
  return WithProtocol;
};

// ————————————————————————————————————————————————————————————————
// 5. Runtime Validation Utilities
// ————————————————————————————————————————————————————————————————

/**
 * Development-time component usage validator
 * Runs in development mode to catch protocol violations
 */
export const validateComponentUsage = (componentName, props, context) => {
  if (process.env.NODE_ENV === 'production') return;
  
  const protocol = registry.get(componentName);
  if (!protocol) return;
  
  const manifest = protocol.manifest();
  const issues = [];
  
  // Check required props
  const requiredProps = manifest?.data?.props?.filter(p => p.required) || [];
  for (const prop of requiredProps) {
    if (!(prop.name in props)) {
      issues.push({
        severity: 'error',
        message: `Missing required prop: ${prop.name}`,
        path: `props.${prop.name}`,
      });
    }
  }
  
  // Check context support
  if (manifest?.context?.supported_contexts) {
    if (!manifest.context.supported_contexts.includes(context.view)) {
      issues.push({
        severity: 'warning',
        message: `Component ${componentName} may not support context: ${context.view}`,
        path: 'context.view',
      });
    }
  }
  
  // Check accessibility requirements
  const a11yContract = manifest?.a11y?.contract;
  if (a11yContract?.label_prop) {
    if (!props[a11yContract.label_prop]) {
      issues.push({
        severity: 'error',
        message: `Missing required accessibility prop: ${a11yContract.label_prop}`,
        path: `props.${a11yContract.label_prop}`,
      });
    }
  }
  
  // Log issues
  if (issues.length > 0) {
    console.group(`[Protocol Validation] ${componentName}`);
    issues.forEach(issue => {
      if (issue.severity === 'error') {
        console.error(`❌ ${issue.message}`, { path: issue.path });
      } else {
        console.warn(`⚠️  ${issue.message}`, { path: issue.path });
      }
    });
    console.groupEnd();
  }
  
  return issues;
};

// ————————————————————————————————————————————————————————————————
// 6. Semantic Relationship Discovery Hook
// ————————————————————————————————————————————————————————————————

/**
 * Hook for discovering related components based on semantic similarity
 * Useful for showing recommendations, related patterns, etc.
 */
export const useRelatedComponents = (componentName, threshold = 0.85) => {
  return useMemo(() => {
    const protocol = registry.get(componentName);
    if (!protocol) return [];
    
    const relationships = registry.discoverRelationships(threshold);
    const urn = protocol.manifest().urn;
    
    // Find relationships involving this component
    return relationships
      .filter(rel => rel.from === urn || rel.to === urn)
      .map(rel => ({
        componentUrn: rel.from === urn ? rel.to : rel.from,
        similarity: rel.similarity,
        relationship: rel.from === urn ? 'suggests' : 'suggested-by',
      }));
  }, [componentName, threshold]);
};

// ————————————————————————————————————————————————————————————————
// 7. Export Registry for External Use
// ————————————————————————————————————————————————————————————————

export const ProtocolRuntime = {
  registry,
  register: (protocol) => registry.register(protocol),
  get: (identifier) => registry.get(identifier),
  query: (predicate) => registry.query(predicate),
  discoverRelationships: (threshold) => registry.discoverRelationships(threshold),
};

export default ProtocolRuntime;
