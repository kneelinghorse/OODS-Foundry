import type { ObjectDefinition, ResolutionDetail } from './object-definition.js';

export type ManualCollisionResolution = {
  strategy: 'prefer_trait' | 'use_first' | 'use_last' | 'merge';
  traitName?: string;
};

export interface ConflictResolutionPlan {
  readonly fieldResolutions: Readonly<Record<string, ManualCollisionResolution>>;
  readonly objectFieldOverrides: ReadonlySet<string>;
}

export function buildConflictPlan(definition: ObjectDefinition): ConflictResolutionPlan {
  const fieldResolutions: Record<string, ManualCollisionResolution> = {};
  const objectOverrides = new Set<string>();

  const fieldDetails = definition.resolutions?.fields ?? {};
  for (const [fieldName, detail] of Object.entries(fieldDetails)) {
    const normalized = fieldName.trim();
    if (normalized.length === 0) {
      continue;
    }

    const mapped = mapResolutionDetail(detail);
    if (mapped) {
      fieldResolutions[normalized] = mapped.manual;
      if (mapped.objectOverride) {
        objectOverrides.add(normalized);
      }
    }
  }

  return {
    fieldResolutions,
    objectFieldOverrides: objectOverrides,
  };
}

function mapResolutionDetail(detail: ResolutionDetail): {
  manual: ManualCollisionResolution;
  objectOverride: boolean;
} | null {
  switch (detail.strategy) {
    case 'merge':
      return {
        manual: {
          strategy: 'merge',
        },
        objectOverride: false,
      };

    case 'use_trait':
      if (detail.trait && detail.trait.trim().length > 0) {
        return {
          manual: {
            strategy: 'prefer_trait',
            traitName: detail.trait,
          },
          objectOverride: false,
        };
      }
      return {
        manual: {
          strategy: 'use_last',
        },
        objectOverride: false,
      };

    case 'use_object':
    default:
      return {
        manual: {
          strategy: detail.trait ? 'prefer_trait' : 'use_last',
          traitName: detail.trait,
        },
        objectOverride: true,
      };
  }
}
