export {
  measureAsync,
  measureSync,
  markStart,
  markEnd,
  getMeasures,
  clearAllMeasures,
  extractUserTimingMetrics,
  type UserTimingMetric,
} from '@/perf/instrumentation/userTiming';
