import type { TraitDefinition } from '../../src/core/trait-definition.ts';

const EncodingShapeTrait = {
  "trait": {
    "name": "EncodingShape",
    "version": "0.1.0",
    "description": "Categorical shape encoding",
    "category": "viz.encoding",
    "tags": [
      "viz",
      "authoring"
    ]
  },
  "parameters": [
    {
      "name": "renderIntent",
      "type": "string",
      "required": false,
      "default": "{}",
      "description": "JSON-encoded Cartesian viz.render input fragment; data rows are supplied by the consumer."
    }
  ],
  "schema": {},
  "semantics": {},
  "view_extensions": {
    "form": [
      {
        "component": "VizShapeControls",
        "position": "top",
        "props": {
          "intentParameter": "renderIntent"
        }
      },
      {
        "component": "VizShapeLegend",
        "position": "top",
        "props": {
          "intentParameter": "renderIntent"
        }
      }
    ]
  },
  "tokens": {},
  "metadata": {
    "regionsUsed": [
      "form"
    ]
  }
} as const satisfies TraitDefinition;

export default EncodingShapeTrait;
