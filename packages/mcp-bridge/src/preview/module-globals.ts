/**
 * The globals an iife-compiled artifact and the preview app agree on (Sprint 202 m02): the runtime the app inlines
 * lives on `globalThis.__oodsRuntime[specifier]`; a compiled module registers its exports on
 * `__oodsModules.m_<artifact hash>`, so two versions side by side never collide. Browser-safe: no Node imports.
 */
export const RUNTIME_GLOBAL = '__oodsRuntime';
export const MODULES_GLOBAL = '__oodsModules';
/** The registry key of an iife module from its artifact hash (`sha256:` prefix dropped, sixteen hex characters). */
export const moduleKey = (artifactContentHash: string): string => `m_${artifactContentHash.replace(/^sha256:/, '').slice(0, 16)}`;
export const moduleGlobalName = (artifactContentHash: string): string => `${MODULES_GLOBAL}.${moduleKey(artifactContentHash)}`;
