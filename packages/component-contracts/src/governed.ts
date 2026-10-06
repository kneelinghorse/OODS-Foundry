/**
 * What "governed component" means wherever Forge says it (s213-m02, #2349). A component is governed when its row in the
 * component capability ledger records all five of these states. It says nothing about whether a generated app places
 * the component: that is the runtime sweep's to say.
 */
export const GOVERNED_SURFACES = Object.freeze({
  contract: 'versioned-v1',
  react: 'implemented-evidence-complete',
  vue: 'implemented-evidence-complete',
  accessibility: 'verified',
  theme: 'verified',
} as const);

/** The same definition in one sentence, for the documents that use the word. */
export const GOVERNED_DEFINITION = 'a versioned contract, React and Vue implementations with complete readiness evidence, and verified accessibility and theme evidence';

export type GovernedLedgerRow = { id: string; surfaces: Record<string, { state: string } | undefined> };

export function isGovernedComponent(row: GovernedLedgerRow): boolean {
  return Object.entries(GOVERNED_SURFACES).every(([surface, state]) => row.surfaces[surface]?.state === state);
}
