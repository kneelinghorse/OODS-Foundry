import type { TraitDefinition } from '../../src/core/trait-definition.ts';

const ScatterPlotTrait = {
  "trait": {
    "name": "ScatterPlot",
    "version": "0.1.0",
    "description": "Scatter authoring over the existing MarkPoint renderer",
    "category": "viz.pattern",
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
    },
    {
      "name": "previewSvg",
      "type": "string",
      "required": false,
      "description": "Static SVG returned by viz.render for the authored sample."
    }
  ],
  "schema": {},
  "semantics": {},
  "view_extensions": {
    "form": [
      {
        "component": "VizScatterControls",
        "position": "top",
        "props": {
          "intentParameter": "renderIntent"
        }
      }
    ],
    "detail": [
      {
        "component": "VizScatterPreview",
        "position": "top",
        "props": {
          "svgParameter": "previewSvg"
        }
      }
    ]
  },
  "tokens": {},
  "metadata": {
    "regionsUsed": [
      "form",
      "detail"
    ]
  }
} as const satisfies TraitDefinition;

export default ScatterPlotTrait;
