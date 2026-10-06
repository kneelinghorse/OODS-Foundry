/**
 * DSL Version Registry — maps version strings to feature flags and behavior toggles.
 *
 * Current version: 1.0
 * The server reports CURRENT_VERSION through health; request-level version selection is not supported.
 *
 * Adding a new version:
 *   1. Add entry to VERSION_REGISTRY with appropriate feature flags
 *   2. Update CURRENT_VERSION if this becomes the default
 *   3. Add changelog entry to CHANGELOG
 */

export type DslVersion = '1.0';

export interface VersionFeatures {
  /** Whether compose supports behavioral trait view extensions. */
  composeViewExtensions: boolean;
  /** Whether codegen supports Tailwind CVA output. */
  tailwindCva: boolean;
  /** Whether fragment mode is available in repl.render. */
  fragmentMode: boolean;
  /** Whether deprecated_since warnings are surfaced. */
  deprecationWarnings: boolean;
}

export interface VersionEntry {
  version: DslVersion;
  released: string;
  features: VersionFeatures;
}

export const CURRENT_VERSION: DslVersion = '1.0';

export const VERSION_REGISTRY: ReadonlyMap<DslVersion, VersionEntry> = new Map([
  [
    '1.0',
    {
      version: '1.0',
      released: '2026-03-05',
      features: {
        composeViewExtensions: true,
        tailwindCva: true,
        fragmentMode: true,
        deprecationWarnings: true,
      },
    },
  ],
]);

export interface ChangelogEntry {
  version: DslVersion;
  date: string;
  changes: string[];
  breaking: boolean;
}

export const CHANGELOG: ReadonlyArray<ChangelogEntry> = [
  {
    version: '1.0',
    date: '2026-03-05',
    changes: [
      'Initial DSL version. Health reports the current version.',
      'deprecated_since field supported in component catalog and trait definitions.',
      'Version registry and changelog infrastructure established.',
    ],
    breaking: false,
  },
];

/**
 * Resolve a version string to its feature set.
 * Returns undefined if the version is not recognized.
 */
export function resolveVersion(version?: string): VersionEntry | undefined {
  if (!version) return VERSION_REGISTRY.get(CURRENT_VERSION);
  return VERSION_REGISTRY.get(version as DslVersion);
}

/**
 * Get changelog entries since a given version (inclusive).
 */
export function getChangelogSince(sinceVersion?: string): ChangelogEntry[] {
  if (!sinceVersion) return [...CHANGELOG];
  const versions = [...VERSION_REGISTRY.keys()];
  const idx = versions.indexOf(sinceVersion as DslVersion);
  if (idx < 0) return [...CHANGELOG];
  return CHANGELOG.filter((entry) => {
    const entryIdx = versions.indexOf(entry.version);
    return entryIdx >= idx;
  });
}
