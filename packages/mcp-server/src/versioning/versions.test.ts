import { describe, it, expect } from 'vitest';
import {
  CURRENT_VERSION,
  VERSION_REGISTRY,
  CHANGELOG,
  resolveVersion,
  getChangelogSince,
} from './versions.js';

describe('DSL Version Registry', () => {
  it('CURRENT_VERSION is 1.0', () => {
    expect(CURRENT_VERSION).toBe('1.0');
  });

  it('VERSION_REGISTRY contains current version', () => {
    expect(VERSION_REGISTRY.has(CURRENT_VERSION)).toBe(true);
  });

  it('current version entry has all feature flags', () => {
    const entry = VERSION_REGISTRY.get('1.0');
    expect(entry).toBeDefined();
    expect(entry!.features).toEqual({
      composeViewExtensions: true,
      tailwindCva: true,
      fragmentMode: true,
      deprecationWarnings: true,
    });
  });

  it('current version has a release date', () => {
    const entry = VERSION_REGISTRY.get('1.0');
    expect(entry!.released).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('resolveVersion', () => {
  it('returns current version when no version specified', () => {
    const entry = resolveVersion();
    expect(entry).toBeDefined();
    expect(entry!.version).toBe(CURRENT_VERSION);
  });

  it('returns current version when "1.0" specified', () => {
    const entry = resolveVersion('1.0');
    expect(entry).toBeDefined();
    expect(entry!.version).toBe('1.0');
  });

  it('returns undefined for unknown version', () => {
    const entry = resolveVersion('99.99');
    expect(entry).toBeUndefined();
  });
});

describe('CHANGELOG', () => {
  it('has at least one entry', () => {
    expect(CHANGELOG.length).toBeGreaterThan(0);
  });

  it('first entry is version 1.0', () => {
    expect(CHANGELOG[0].version).toBe('1.0');
  });

  it('entries have required fields', () => {
    for (const entry of CHANGELOG) {
      expect(entry.version).toBeTruthy();
      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.changes.length).toBeGreaterThan(0);
      expect(typeof entry.breaking).toBe('boolean');
    }
  });
});

describe('getChangelogSince', () => {
  it('returns all entries when no version specified', () => {
    const entries = getChangelogSince();
    expect(entries.length).toBe(CHANGELOG.length);
  });

  it('returns entries since specified version', () => {
    const entries = getChangelogSince('1.0');
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0].version).toBe('1.0');
  });

  it('returns all entries for unknown version', () => {
    const entries = getChangelogSince('0.0');
    expect(entries.length).toBe(CHANGELOG.length);
  });
});
