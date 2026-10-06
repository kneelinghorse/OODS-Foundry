import { sharedScenarios } from './scenarios.js';
import { PORTED_COMPONENT_IDS, type SharedScenario } from './types.js';

/** @deprecated Historical compatibility view; canonical scenarios live in sharedScenarios. */
export const portedScenarios: readonly SharedScenario[] = sharedScenarios.filter(
  ({ oodsComponentId }) => PORTED_COMPONENT_IDS.some((id) => id === oodsComponentId),
);
