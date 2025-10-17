export type {
  ArtifactDetail,
  BillingReviewKitInput,
  BillingSwitchFixturesInput,
  BrandApplyInput,
  BrandApplyOutput,
  GenericInput,
  GenericOutput,
  PlanDiff,
  PlanDiffChange,
  PlanDiffSummary,
  ReleaseTagInput,
  ReleaseTagOutput,
  ReleaseVerifyInput,
  ReleaseVerifyOutput,
  ToolPreview,
  TokensBuildInput,
} from '../schemas/generated.js';

import type {
  BrandApplyInput,
  BillingSwitchFixturesInput,
  GenericInput,
  ReleaseVerifyOutput,
  ReleaseTagOutput,
} from '../schemas/generated.js';

export type BaseInput = GenericInput;

export type BrandApplyStrategy = NonNullable<BrandApplyInput['strategy']>;

export type BillingProvider = BillingSwitchFixturesInput['provider'];

export type ReleaseVerifyResult = ReleaseVerifyOutput;

export type ReleaseTagResult = ReleaseTagOutput;
