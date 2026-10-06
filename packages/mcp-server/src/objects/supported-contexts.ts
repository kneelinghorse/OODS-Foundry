import type { ObjectDefinition } from './types.js';

/** The four screens a workflow app assembles; an object composes a workflow only when it composes all four. */
export const WORKFLOW_CONTEXTS = ['list', 'detail', 'form', 'timeline'] as const;

/** `metadata.supportedContexts` restricts what an object composes; an object without it composes every context. */
export function supportsContext(definition: ObjectDefinition, context: string): boolean {
  const supported = definition.metadata?.supportedContexts;
  if (!supported) return true;
  if (context === 'workflow') return WORKFLOW_CONTEXTS.every(screen => supported.includes(screen));
  return supported.includes(context);
}

/**
 * s206-m01: an object that composes no form is read-only in Forge — its records are shown, never edited (Stage1's
 * Run, Finding and CapturedArtifact). Its detail offers no Edit and no Delete, and it composes no workflow.
 */
export function isReadOnly(definition: ObjectDefinition): boolean {
  return !supportsContext(definition, 'form');
}

/** The refusal for a context the object does not compose: it names the context asked for and the ones it does. */
export function contextRefusal(definition: ObjectDefinition, context: string): { code: 'OODS-V003'; message: string; hint: string } {
  const object = definition.object.name;
  const supported = definition.metadata?.supportedContexts ?? [];
  const list = supported.length > 1 ? `${supported.slice(0, -1).join(', ')} and ${supported.at(-1)}` : supported.join('');
  const hint = supported.length === 1 && supported[0] === 'inline'
    ? 'Compose the embedded object in its supported context within its parent.'
    : isReadOnly(definition)
      ? `${object}'s records are read-only in OODS Foundry: they are shown, never edited, so it composes no form and no workflow.`
      : `Compose ${object} in one of the contexts it supports.`;
  return { code: 'OODS-V003', message: `Object '${object}' does not compose the '${context}' context; it composes only ${list}.`, hint };
}
