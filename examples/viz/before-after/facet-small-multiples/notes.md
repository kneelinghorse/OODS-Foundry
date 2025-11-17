# Facet vs Concat Notes

- **Before**: `LayoutConcat` repeated the same grouped-bar chart three times. Payload size tripled and keyboard focus order was unclear.
- **After**: `LayoutFacet` keeps a single spec, shares scales, and adds the RDV.4 contract plus hover/focus parity.
- **Guardrail evidence**: `pnpm vrt:layouts` shrank the screenshot set from 6 to 2 variants.
