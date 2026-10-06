// Shared t-shirt spacing leaf-alias (sprint-125 m03).
//
// The built tokens expose the geometry scalars as --*-space-scale-{sm,md,lg}, so
// an authored gapToken / spacingToken of the bare t-shirt size 'sm' | 'md' | 'lg'
// must resolve to that 'scale-<size>' leaf — otherwise the emitter produces a
// dead var(--ref-space-md) that never resolves. Centralised here so the four
// spacing emitters (react-emitter, vue-emitter, tree-renderer, component-map)
// resolve identically and cannot drift (the s124-m03 react/vue divergence lesson).
//
// Any non-t-shirt token (e.g. 'inset-default', 'inline-sm', 'stack-compact')
// passes through unchanged. Spacing-group only — radius/shadow/colour 'md' keep
// their own --ref-<group>-md leaves and must NOT be aliased.
const SPACING_LEAF_ALIAS: Readonly<Record<string, string>> = {
  sm: 'scale-sm',
  md: 'scale-md',
  lg: 'scale-lg',
  // s206-m01: the composer's templates gap their stacks, rows and sections with 'cluster-default' (20 uses) and
  // 'cluster-tight' (13), a family the tokens never defined — so every one emitted var(--ref-space-cluster-*), which
  // resolved to nothing, and those gaps rendered as zero (a status timeline ran straight into the next card). They
  // take the scale's md (14px) and sm (8px) leaves, which read the same in a stack and in a row.
  'cluster-default': 'scale-md',
  'cluster-tight': 'scale-sm',
};

export function resolveSpacingLeaf(token: string): string {
  return SPACING_LEAF_ALIAS[token] ?? token;
}
