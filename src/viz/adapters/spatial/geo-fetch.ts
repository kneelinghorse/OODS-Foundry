/**
 * Geo Fetch Utility
 *
 * Handles remote fetching of geo data with caching support.
 */

import type { ParsedGeoData } from './geo-format-parser.js';
import { parseGeoSource } from './geo-format-parser.js';
import TimeService from '@/services/time/index.js';

interface CacheEntry {
  data: ParsedGeoData;
  timestamp: number;
  url: string;
}

interface FetchOptions {
  timeout?: number;
  cache?: boolean;
  forceRefresh?: boolean;
}

const DEFAULT_TIMEOUT = 30000; // 30 seconds
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

class GeoDataCache {
  private cache = new Map<string, CacheEntry>();

  get(url: string): ParsedGeoData | null {
    const entry = this.cache.get(url);
    if (!entry) {
      return null;
    }

    const age = TimeService.nowSystem().toMillis() - entry.timestamp;
    if (age > CACHE_TTL) {
      this.cache.delete(url);
      return null;
    }

    return entry.data;
  }

  set(url: string, data: ParsedGeoData): void {
    this.cache.set(url, {
      data,
      timestamp: TimeService.nowSystem().toMillis(),
      url,
    });
  }

  clear(): void {
    this.cache.clear();
  }

  has(url: string): boolean {
    return this.cache.has(url) && this.get(url) !== null;
  }
}

const globalCache = new GeoDataCache();

/**
 * Fetches geo data from a URL with optional caching.
 */
export async function fetchGeoSource(
  url: string,
  options: FetchOptions = {}
): Promise<ParsedGeoData> {
  const { timeout = DEFAULT_TIMEOUT, cache = true, forceRefresh = false } = options;

  // Check cache first (unless force refresh)
  if (cache && !forceRefresh) {
    const cached = globalCache.get(url);
    if (cached) {
      return cached;
    }
  }

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json, application/geo+json, application/topo+json',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch geo data from URL: HTTP ${response.status} ${response.statusText}`
      );
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('json')) {
      // Warn but continue - some servers don't set content-type correctly
      console.warn(`Unexpected content-type for geo data: ${contentType}`);
    }

    const text = await response.text();
    const data = parseGeoSource(text);

    // Cache the result
    if (cache) {
      globalCache.set(url, data);
    }

    return data;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error(`Failed to fetch geo data from URL: timeout after ${timeout}ms`);
      }
      // Wrap network errors
      throw new Error(`Failed to fetch geo data from URL: ${error.message}`);
    }

    throw new Error(`Failed to fetch geo data from URL: ${String(error)}`);
  }
}

/**
 * Clears the geo data cache.
 */
export function clearGeoCache(): void {
  globalCache.clear();
}

/**
 * Checks if a URL is cached.
 */
export function isCached(url: string): boolean {
  return globalCache.has(url);
}
