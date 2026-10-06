import { componentContracts } from './contracts.js';
import { sharedScenarios } from './scenarios.js';
import type { GovernedComponentId } from './types.js';

export type ObligationStatus = 'met' | 'unmet' | 'not-checked';
export interface SubstitutionObligation { id: string; requirement: string; status: ObligationStatus; reason: string }
export interface SubstitutionContractReport {
  schemaVersion: '1'; framework: 'react' | 'vue'; mappingId: string; component: string;
  source: { package?: string; export: string; version?: string; shadcn?: { module: string; file: string; closureHash: string }; packageContentHash?: string };
  contractVersion: string; scenarioId: string | null;
  checkedAt?: string; browser?: string; adapterContentHash?: string; contractContentHash?: string;
  obligations: SubstitutionObligation[];
  summary: Record<ObligationStatus, number>;
}

/** The complete declared denominator remains visible even when no browser is available. */
export function substitutionContractReport(identity: Pick<SubstitutionContractReport, 'framework' | 'mappingId' | 'component' | 'source'>, reason: string): SubstitutionContractReport {
  const contract = componentContracts[identity.component as GovernedComponentId];
  const scenario = sharedScenarios.find(row => row.oodsComponentId === identity.component);
  const obligations: SubstitutionObligation[] = [];
  const add = (id: string, requirement: string) => obligations.push({ id, requirement, status: 'not-checked', reason });
  for (const [kind, values] of Object.entries({ prop: contract.props, slot: contract.slots, event: contract.events, state: contract.states, token: contract.tokenRoles, accessibility: contract.accessibility })) {
    for (const value of values) add(`${kind}:${value}`, value);
  }
  add('role', contract.role ?? 'none'); add('name', `${contract.name?.strategy ?? 'none'} on ${contract.name?.target ?? ':root'}`);
  for (const [key, value] of Object.entries(contract.keyboard ?? {})) add(`keyboard:${key}`, value);
  add('compatibility', contract.compatibility);
  add('scenario:props', 'Shared scenario props and slots mount without an exception');
  add('scenario:render', scenario?.renderExpectation.expected ?? 'No shared render scenario is declared');
  scenario?.assertions.forEach((value, index) => add(`scenario:assertion:${index}`, value));
  scenario?.event.forEach((value, index) => add(`scenario:event:${index}`, JSON.stringify(value)));
  return summarizeSubstitutionReport({ ...identity, schemaVersion: '1', contractVersion: contract.version, scenarioId: scenario?.id ?? null, obligations, summary: { met: 0, unmet: 0, 'not-checked': 0 } });
}

export function summarizeSubstitutionReport(report: SubstitutionContractReport): SubstitutionContractReport {
  const summary = { met: 0, unmet: 0, 'not-checked': 0 };
  for (const row of report.obligations) summary[row.status]++;
  return { ...report, summary };
}
