# Storybook Taxonomy Adjustments

| Story file | Previous title | New title | Notes |
| --- | --- | --- | --- |
| `apps/explorer/src/stories/HighContrast.Guardrails-hc.stories.tsx` | `High Contrast/Proof Gallery` | `Brand/High Contrast/Proof Gallery` | Folded standalone High Contrast root under the canonical Brand bucket. |
| `stories/proofs/context-gallery.stories.tsx` | `Proofs/Contexts/Domain Context Gallery` | `Contexts/Domain Context Gallery` | Moved Proofs contexts into the canonical Contexts group. |
| `src/stories/foundations/Elements.smoke.stories.tsx` | `Foundations/Elements Smoke Test` | _(removed)_ | Redundant smoke harness removed so Foundations only surfaces production documentation/proofs. |

No other stories required retitling; Chromatic should only see these intended folder moves.
