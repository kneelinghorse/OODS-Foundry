// `vega-typings` (vega's TypeScript layer) omits `textMetrics`, even though the
// vega runtime re-exports it from vega-scenegraph. Augment the module with the
// narrow slice the emitter uses to pin deterministic text measurement (seam d).
import 'vega';
declare module 'vega' {
  export const textMetrics: {
    /** When false, force the arithmetic width estimator (never the native canvas). */
    canvas(use: boolean): void;
  };
}
