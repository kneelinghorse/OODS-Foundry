import intakeJson from '../registry/component-intake.v1.json';
import reconciliationJson from '../registry/component-reconciliation.proposed.v2.json';
import capabilitiesJson from '../registry/component-capability-ledger.v1.json';

export * from './types.js';
export * from './contracts.js';
export * from './billing.js';
export * from './scenarios.js';
export * from './ported-contracts.js';
export * from './ported-scenarios.js';
export * from './foundation-v1.js';
export * from './result-state.js';
export * from './status-icons.js';
export * from './status-registry.js';

export const componentIntake = intakeJson;
export const componentReconciliationProposal = reconciliationJson;
export const componentCapabilityBaseline = capabilitiesJson;

export function deriveStartingComponentCount(): number {
  return new Set(componentIntake.rows.map((row) => row.id)).size;
}

export function validateComponentIntakeDocument(input: unknown): string[] {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return ['intake must be an object'];
  const document = input as { componentCount?: unknown; controllingObligationDenominator?: unknown; rows?: unknown };
  const errors: string[] = [];
  if (Object.prototype.hasOwnProperty.call(document, 'componentCount')) {
    errors.push('intake must not contain an independent componentCount');
  }
  if (!Array.isArray(document.rows)) return [...errors, 'intake rows must be an array'];
  const ids = document.rows.map((row) => (
    row && typeof row === 'object' && !Array.isArray(row) && typeof (row as { id?: unknown }).id === 'string'
      ? (row as { id: string }).id
      : ''
  ));
  if (ids.some((id) => id.length === 0)) errors.push('every intake row must have a non-empty id');
  // s222-m02 (#2502 ruling 11): Switch and Dialog join the 110, so the intake holds 112. s223-m02 (#2527 rulings 10-12):
  // SegmentedControl and Combobox join them: 114.
  if (ids.length !== 114) errors.push(`intake must contain exactly 114 rows; received ${ids.length}`);
  const uniqueCount = new Set(ids).size;
  if (uniqueCount !== ids.length) errors.push('intake IDs must be unique');
  const sorted = [...ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  if (JSON.stringify(ids) !== JSON.stringify(sorted)) errors.push('intake IDs must use deterministic code-point order');
  if (document.controllingObligationDenominator !== uniqueCount) {
    errors.push('controllingObligationDenominator must be derived from unique intake membership');
  }
  return errors;
}

export function getBaselineCapability(componentId: string) {
  return componentCapabilityBaseline.rows.find((row) => row.id === componentId);
}

export * from './billing-views.js';

export * from './date-time.js';

export * from './static-svg.js';

export * from './behaviors.js';

export * from './disputed.js';

export * from './trait-recipes.js';

export * from './governed.js';

export * from './viz-controls.js';

export * from './substitution-report.js';
