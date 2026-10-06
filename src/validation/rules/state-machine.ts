import type { ComposedObject } from '../../core/composed-object.js';
import { ErrorCodes } from '../types.js';
import { collectStateMachineProviders } from '../zod-transformer.js';
import type { RuleIssue } from './types.js';
import type { StateMachine } from '../../core/trait-definition.js';

/**
 * Validate state machine ownership and structural integrity.
 */
export function validateStateMachineOwnership(composed: ComposedObject): RuleIssue[] {
  const issues: RuleIssue[] = [];
  const traits = Array.isArray(composed.traits) ? composed.traits : [];
  const providers = collectStateMachineProviders(traits);
  const providerNames = providers.map((provider) => provider.name);

  const allTraitNames = traits.map((t) => t.trait?.name).filter(Boolean) as string[];

  if (providers.length > 1) {
    const nonProviders = allTraitNames.filter((n) => !providerNames.includes(n));
    issues.push({
      code: ErrorCodes.STATE_OWNERSHIP_CONFLICT,
      message: `Multiple traits declare a state machine (${providerNames.join(', ')}); only one owner is permitted.`,
      hint: `Consolidate the state machine into a single trait or split behaviours that do not require state ownership.`,
      severity: 'error',
      path: ['traits'],
      related: providerNames,
      traitPath: providerNames,
      impactedTraits: nonProviders.length > 0 ? nonProviders : undefined,
    });
  }

  if (providers.length > 0 && !composed.stateMachine) {
    const owner = providers[0];
    issues.push({
      code: ErrorCodes.STATE_OWNERSHIP_CONFLICT,
      message: `Trait "${owner.name}" exposes a state machine but the composed object did not record ownership.`,
      hint: `Ensure the compositor captures the state machine definition when composing "${owner.name}".`,
      severity: 'error',
      path: ['stateMachine'],
      related: [owner.name],
      traitPath: [owner.name],
      impactedTraits: allTraitNames.filter((n) => n !== owner.name).length > 0
        ? allTraitNames.filter((n) => n !== owner.name)
        : undefined,
    });
  }

  if (composed.stateMachine && typeof composed.stateMachine === 'object') {
    const { ownerTrait, definition } = composed.stateMachine as {
      ownerTrait: string;
      definition: StateMachine;
    };
    if (!providerNames.includes(ownerTrait)) {
      issues.push({
        code: ErrorCodes.STATE_OWNERSHIP_CONFLICT,
        message: `Composed state machine owner "${ownerTrait}" does not match any trait providing a state machine.`,
        hint: `Set state machine ownership to one of: ${providerNames.join(', ')}.`,
        severity: 'error',
        path: ['stateMachine', 'ownerTrait'],
        related: [ownerTrait, ...providerNames],
        traitPath: [ownerTrait, ...providerNames],
      });
    }

    issues.push(...validateStateMachineDefinition(definition, ownerTrait));
  }

  return issues;
}

function validateStateMachineDefinition(
  definition: StateMachine,
  ownerTrait: string
): RuleIssue[] {
  const issues: RuleIssue[] = [];
  const stateSet = new Set(definition.states);

  if (!stateSet.has(definition.initial)) {
    issues.push({
      code: ErrorCodes.STATE_OWNERSHIP_CONFLICT,
      message: `State machine owned by "${ownerTrait}" declares initial state "${definition.initial}" which is not part of the state list.`,
      hint: `Add "${definition.initial}" to the states array or choose a valid initial state.`,
      severity: 'error',
      path: ['stateMachine', 'definition', 'initial'],
      related: [ownerTrait, definition.initial],
      traitPath: [ownerTrait],
    });
  }

  definition.transitions.forEach((transition, index) => {
    if (!stateSet.has(transition.from)) {
      issues.push({
        code: ErrorCodes.STATE_OWNERSHIP_CONFLICT,
        message: `Transition ${transition.from} → ${transition.to} references unknown source state "${transition.from}".`,
        hint: `Ensure "${transition.from}" is included in the "${ownerTrait}" state machine states list.`,
        severity: 'error',
        path: ['stateMachine', 'definition', 'transitions', index, 'from'],
        related: [ownerTrait, transition.from],
        traitPath: [ownerTrait],
      });
    }

    if (!stateSet.has(transition.to)) {
      issues.push({
        code: ErrorCodes.STATE_OWNERSHIP_CONFLICT,
        message: `Transition ${transition.from} → ${transition.to} references unknown target state "${transition.to}".`,
        hint: `Ensure "${transition.to}" is included in the "${ownerTrait}" state machine states list.`,
        severity: 'error',
        path: ['stateMachine', 'definition', 'transitions', index, 'to'],
        related: [ownerTrait, transition.to],
        traitPath: [ownerTrait],
      });
    }
  });

  return issues;
}
