/**
 * User Timing API instrumentation utilities for the performance harness.
 */

export interface UserTimingMetric {
  name: string;
  duration: number;
  startTime: number;
  entryType: 'measure';
}

/**
 * Measure the execution time of an async function using performance marks.
 */
export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>,
): Promise<{ result: T; duration: number }> {
  const startMark = `${name}-start`;
  const endMark = `${name}-end`;

  performance.mark(startMark);
  const result = await fn();
  performance.mark(endMark);

  const measure = performance.measure(name, startMark, endMark);
  const duration = measure.duration;

  performance.clearMarks(startMark);
  performance.clearMarks(endMark);

  return { result, duration };
}

/**
 * Synchronous measurement helper.
 */
export function measureSync<T>(
  name: string,
  fn: () => T,
): { result: T; duration: number } {
  const startMark = `${name}-start`;
  const endMark = `${name}-end`;

  performance.mark(startMark);
  const result = fn();
  performance.mark(endMark);

  const measure = performance.measure(name, startMark, endMark);
  const duration = measure.duration;

  performance.clearMarks(startMark);
  performance.clearMarks(endMark);

  return { result, duration };
}

/**
 * Retrieve performance measures by name (or all measures when omitted).
 */
export function getMeasures(name?: string): PerformanceEntry[] {
  if (name) {
    return performance.getEntriesByName(name, 'measure');
  }
  return performance.getEntriesByType('measure');
}

/**
 * Clear all stored measures and marks.
 */
export function clearAllMeasures(): void {
  performance.clearMeasures();
  performance.clearMarks();
}

/**
 * Manually mark the start of a measurement window.
 */
export function markStart(name: string): void {
  performance.mark(`${name}-start`);
}

/**
 * Mark the end of a measurement window and return the measured duration.
 */
export function markEnd(name: string): number {
  const startMark = `${name}-start`;
  const endMark = `${name}-end`;

  performance.mark(endMark);
  const measure = performance.measure(name, startMark, endMark);

  return measure.duration;
}

/**
 * Extract user timing metrics for the harness.
 */
export function extractUserTimingMetrics(): UserTimingMetric[] {
  const measures = performance.getEntriesByType('measure');

  return measures.map((entry) => ({
    name: entry.name,
    duration: entry.duration,
    startTime: entry.startTime,
    entryType: 'measure',
  }));
}

declare global {
  interface Window {
    __PERF_USER_TIMING__: {
      measureAsync: typeof measureAsync;
      measureSync: typeof measureSync;
      markStart: typeof markStart;
      markEnd: typeof markEnd;
      extractMetrics: typeof extractUserTimingMetrics;
      clearAll: typeof clearAllMeasures;
    };
  }
}

if (typeof window !== 'undefined') {
  window.__PERF_USER_TIMING__ = {
    measureAsync,
    measureSync,
    markStart,
    markEnd,
    extractMetrics: extractUserTimingMetrics,
    clearAll: clearAllMeasures,
  };
}
