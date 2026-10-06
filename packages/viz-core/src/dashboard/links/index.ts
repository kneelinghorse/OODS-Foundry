// Cross-filter linking primitives (sprint-113). One-feature-per-barrel.

// Selection -> cross-filter resolver (m03): SelectionState + target panel ->
// active predicates + row filter (skip-self, AND-across-sources).
export * from './resolver.js';

// Generic linked-selection reducer (m04): SET/CLEAR/CLEAR_ALL over SelectionState.
export * from './reducer.js';

// Per-cluster selection binding factories (m04): chart pick -> generic Selection.
export * from './bindings.js';
