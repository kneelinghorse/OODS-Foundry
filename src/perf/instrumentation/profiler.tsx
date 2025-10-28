import React, { Profiler, ProfilerOnRenderCallback } from 'react';

/**
 * Performance profiler wrapper for React components.
 * Captures React render timing data via the Profiler API and makes it available
 * to the Playwright harness through a shared window global.
 */

export interface ProfilerMetrics {
  id: string;
  phase: 'mount' | 'update' | 'nested-update';
  actualDuration: number;
  baseDuration: number;
  startTime: number;
  commitTime: number;
}

declare global {
  interface Window {
    __PERF_PROFILER_METRICS__?: ProfilerMetrics[];
  }
}

/**
 * Initialize profiler metrics storage on the window object.
 */
export function initProfilerMetrics(): void {
  if (typeof window !== 'undefined') {
    window.__PERF_PROFILER_METRICS__ = [];
  }
}

/**
 * Retrieve all collected profiler metrics.
 */
export function getProfilerMetrics(): ProfilerMetrics[] {
  if (typeof window === 'undefined') return [];
  return window.__PERF_PROFILER_METRICS__ ?? [];
}

/**
 * Reset profiler metrics.
 */
export function clearProfilerMetrics(): void {
  if (typeof window !== 'undefined') {
    window.__PERF_PROFILER_METRICS__ = [];
  }
}

/**
 * Generate a profiler callback that stores metrics in the shared window registry.
 */
export function createProfilerCallback(id: string): ProfilerOnRenderCallback {
  return (
    _id,
    phase,
    actualDuration,
    baseDuration,
    startTime,
    commitTime,
  ) => {
    const metrics: ProfilerMetrics = {
      id,
      phase,
      actualDuration,
      baseDuration,
      startTime,
      commitTime,
    };

    if (typeof window !== 'undefined') {
      if (!window.__PERF_PROFILER_METRICS__) {
        window.__PERF_PROFILER_METRICS__ = [];
      }
      window.__PERF_PROFILER_METRICS__.push(metrics);
    }
  };
}

interface PerfProfilerProps {
  id: string;
  children: React.ReactNode;
}

/**
 * React component wrapper that registers render metrics for its children.
 */
export function PerfProfiler({ id, children }: PerfProfilerProps) {
  const onRender = createProfilerCallback(id);

  return (
    <Profiler id={id} onRender={onRender}>
      {children}
    </Profiler>
  );
}
