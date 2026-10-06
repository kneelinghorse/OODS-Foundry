// s222-m02 (#2502 ruling 11): the status registry and its presentation live in @oods/component-contracts, shared with the
// HTML renderer; this module keeps the React package's names for it.
export {
  STATUS_DOMAINS,
  getBannerToneTokenSet,
  getStatusPresentation,
  getToneTokenSet,
  listStatuses,
} from '@oods/component-contracts';
export type { StatusDomain, StatusPresentation, StatusTokenSet, StatusTone } from '@oods/component-contracts';
