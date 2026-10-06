import { componentContracts } from './contracts.js';
import { PORTED_COMPONENT_IDS, type ComponentContract, type PortedComponentId } from './types.js';

/** @deprecated Historical compatibility view; canonical definitions live in componentContracts. */
export const portedComponentContracts = Object.fromEntries(
  PORTED_COMPONENT_IDS.map((id) => [id, componentContracts[id]]),
) as Readonly<Record<PortedComponentId, ComponentContract>>;
