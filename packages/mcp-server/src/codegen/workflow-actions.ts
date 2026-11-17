/**
 * s249-m03 (Interfaces 6 to 8): a generated app's declared actions, such as a grant's Revoke, Pause and Resume
 * (Stateful's `actions`, objects/state-actions.ts). The store writes each as one change (workflow-data-emitter.ts); this
 * module gives the app its handlers, the words of each result, and the confirmation an action that asks first opens.
 *
 * - An action that asks first (`confirm`, a grant's Revoke) opens one screen of facts: what ends with it, what is under
 *   way, what it does not recall, what it leaves running and who is ending it, with an optional note. A saved move on
 *   the form that makes the same action opens the same confirmation, so nothing inside the record is ended unannounced;
 *   there it offers no other action instead, which would leave the form's other edits unsaved.
 * - Any other action (Pause, Resume) is written at once. Its result, a status message that stays until the person moves
 *   on, says how to undo it where another action does (Pause names Resume).
 * - For a grant (an object composing Mandate), Resume shows its rule: it gives the grant again, so it is for someone who
 *   may give grants for the party. The rule is shown, not checked.
 *
 * The confirmation's buttons are the design system's Buttons, which the app's own plain button style leaves alone (s250-m04,
 * next step 1885: its stylesheet exempts .oods-button, as it exempts a team's mapped adapters), so Revoke reads as the
 * danger action in every theme.
 *
 * OODS Foundry models and renders these: a generated app changes its own records when a person asks, and stops nothing
 * outside them.
 */
import { loadObject } from '../objects/object-loader.js';
import { declaredActions, declaredOrder, declaredStates, endsRecord, stateActionHandler, type StateAction } from '../objects/state-actions.js';
import { enumOptionLabel } from '../compose/internal-fields.js';

export interface WorkflowStateActions {
  actions: StateAction[];
  /** The action that asks first (a grant's Revoke), if one is declared, and whether it ends the record. */
  confirm?: StateAction;
  confirmEnds: boolean;
  /** Offered beside the confirmation where it can be taken instead ("Not sure? Pause it instead."). */
  alternative?: StateAction;
  /** The object as a person reads it ("grant"). */
  noun: string;
  mandate: boolean;
  /** Each action's result, with `{name}` for the record's name. */
  results: Record<string, string>;
  /** A rule shown beside an action that is offered (Resume's), with `{party}` for the party's name. */
  rules: Record<string, string>;
}

// s249-m05 (the fresh read): what Revoke changes and what it does not, said without implying it stops anything.
const NOT_RECALLED = 'Revoking changes this app\'s records and nothing else. Credentials issued under the grant may still work, and payments already sent are not recalled.';
const NOT_ENDED = 'Asked for and not yet answered, so it does not end with this one. Answer it on its own page.';

/** The object's declared actions and their words, or undefined when it declares none. */
export function workflowStateActions(objectName: string, traits: readonly string[]): WorkflowStateActions | undefined {
  let definition: ReturnType<typeof loadObject>;
  try { definition = loadObject(objectName); } catch { return undefined; }
  const order = declaredOrder(definition);
  const actions = order ? declaredActions(definition) : [];
  if (!actions.length) return undefined;
  const label = (state: string) => enumOptionLabel(state).toLowerCase();
  // Two actions that move a record back and forth (Pause and Resume): the one that moves it back to the state the lifecycle
  // lists first lifts the other. Resume returns a paused grant to active, which Grant's states list before paused.
  const rank = (state: string) => declaredStates(definition).indexOf(state);
  const mutual = (one: StateAction, other: StateAction) => one !== other && other.from.includes(one.to) && one.from.includes(other.to);
  const lifter = (action: StateAction) => actions.find(other => mutual(action, other) && rank(other.to) < rank(action.to));
  const lifts = (action: StateAction) => actions.some(other => mutual(action, other) && rank(action.to) < rank(other.to));
  const mandate = traits.some(trait => trait.split('/').pop() === 'Mandate');
  const noun = objectName.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  const results = Object.fromEntries(actions.map(action => {
    const undo = !endsRecord(action, order) ? lifter(action) : undefined;
    if (undo) return [action.id, `{name} is ${label(action.to)}. Choose ${undo.verb} on this page to ${undo.verb.toLowerCase()} it.`];
    if (lifts(action)) return [action.id, `{name} is ${label(action.to)} again.`];
    return [action.id, `{name} is ${label(action.to)}.`];
  }));
  const rules = mandate ? Object.fromEntries(actions.filter(action => lifts(action) && !endsRecord(action, order)).map(action => [action.id,
    `Only someone who may give ${noun}s for {party} should ${action.verb.toLowerCase()} this ${noun}; this app does not check.`])) : {};
  const confirm = actions.find(action => action.confirm);
  const alternative = confirm ? actions.find(action => !action.confirm && !endsRecord(action, order) && lifter(action) !== undefined) : undefined;
  return { actions, ...(confirm ? { confirm } : {}), confirmEnds: confirm ? endsRecord(confirm, order) : false, ...(alternative ? { alternative } : {}), noun, mandate, results, rules };
}

/** The handlers the app's screens call: one that asks first opens its confirmation, the others are written at once. */
export function stateActionImplementations(declared: WorkflowStateActions): Record<string, string> {
  return Object.fromEntries(declared.actions.map(action => [stateActionHandler(action), action.confirm
    ? `() => { openAction(${JSON.stringify(action.id)}, 'button'); }`
    : `() => { void act(${JSON.stringify(action.id)}, () => store.transition(state.id, ${JSON.stringify(action.id)})); }`]));
}

/** application.ts: the exports the App reads. */
export function applicationActionExports(declared: WorkflowStateActions): string {
  return `
/** s249-m03: each declared action's result, a status message that stays until the person moves on; {name} is the record's. */
export const actionResults: Record<string, string> = ${JSON.stringify(declared.results)};
/** A rule shown beside an action that is offered; {party} is the party's name. Shown, not checked. */
export const actionRules: Record<string, string> = ${JSON.stringify(declared.rules)};
/** The confirmation an action that asks first opens: its words, fixed here and replaceable by a product. */
export const confirmation = ${JSON.stringify({
    ...(declared.confirm ? { action: declared.confirm.id, verb: declared.confirm.verb, button: `${declared.confirm.verb} ${declared.noun}`, keep: 'Keep it', reasonField: declared.confirm.reasonField ?? null } : {}),
    who: declared.confirmEnds ? 'Who is ending it' : 'Who is acting',
    untold: declared.confirmEnds ? 'This app was not told who is ending it.' : 'This app was not told who is acting.',
    note: 'Note for the record (optional)',
    notEnded: NOT_ENDED,
    ...(declared.mandate ? { notRecalled: NOT_RECALLED } : {}),
    ...(declared.alternative ? { alternative: { action: declared.alternative.id, handler: stateActionHandler(declared.alternative), from: declared.alternative.from, lead: 'Not sure?', button: `${declared.alternative.verb} it instead` } } : {}),
  })};
`;
}

/** createWorkflow: opening a confirmation, writing an action with its result, and what the open confirmation lists. */
export function workflowActionFunctions(): string {
  return `
  // s249-m03 (Interface 6): an action that asks first opens its confirmation, from its button or from a saved move on the
  // form; any other is written at once. The result is a status message that stays until the person moves on.
  function openAction(id: string, via: 'button' | 'form') { publish({ actionOpen: id, actionVia: via, notice: '' }); }
  async function act(id: string, operation: () => DomainRecord) {
    const shown = store.preview(state.id, id);
    publish({ uiState: 'loading', error: '', actionOpen: '' });
    try {
      await store.ready();
      operation();
      const ended = shown.endsWith.length ? ' ' + (shown.endsWith.length === 1 ? shown.endsWith[0] : shown.endsWith.slice(0, -1).join(', ') + ' and ' + shown.endsWith[shown.endsWith.length - 1]) + ' ended with it.' : '';
      publish({ notice: (actionResults[id] ?? '{name} is changed.').replace('{name}', shown.name) + ended });
      await navigate('detail');
    } catch (error) { publish({ uiState: 'error', error: error instanceof Error ? error.message : String(error) }); }
  }`;
}

/** createWorkflow's returned API: the confirmation's facts, confirming it and keeping the record. */
export function workflowActionApi(): string {
  return `
    /** What the open confirmation lists, worked out from the records here; undefined when none is open. */
    actionPreview() { return state.actionOpen ? store.preview(state.id, state.actionOpen) : undefined; },
    /** Writes the open confirmation's action with its note: from the form, the saved draft through update; else transition. */
    confirmAction(note: string) { const id = state.actionOpen; if (!id) return Promise.resolve(); return act(id, () => state.actionVia === 'form' ? store.update(state.draft, note) : store.transition(state.id, id, note)); },
    /** Keeps the record as it is, closing the confirmation (its Keep button, or Escape). */
    dismissAction() { publish({ actionOpen: '' }); },
    /** The rule an offered action shows (Resume's), for the shown record, if any. */
    actionRule() { const record = state.draft as Record<string, unknown>; const action = stateActions.find((entry) => actionRules[entry.id] && entry.from.includes(String(record.status))); return action ? actionRules[action.id]!.replace('{party}', String(record.granted_for_name ?? record.granted_for_id ?? '')) : ''; },`;
}

const CONFIRM_PARTS = (framework: 'react' | 'vue') => {
  const list = (key: string, item: string, heading: string) => framework === 'react'
    ? `{preview.${key}.length > 0 && <div className="workflow-confirm-part"><h3>${heading}</h3><ul>{preview.${key}.map((entry, index) => <li key={index}>${item}</li>)}</ul></div>}`
    : `<div v-if="preview.${key}.length" class="workflow-confirm-part"><h3>${heading}</h3><ul><li v-for="(entry, index) in preview.${key}" :key="index">${item}</li></ul></div>`;
  const value = (expression: string) => framework === 'react' ? `{${expression}}` : `{{ ${expression} }}`;
  return [
    list('endsWith', value('entry'), 'Ends with it'),
    list('notEnded', `${value('entry')}: ${value('confirmation.notEnded')}`, 'Not ended with it'),
    list('underWay', `${value('entry.title')}: ${value('entry.state')}`, 'Still under way, not changed by this'),
  ];
};

/** The React App's confirmation, drawn in place of the screen while it is open (the screen stays mounted, hidden). */
export function reactConfirmation(declared: WorkflowStateActions): string {
  if (!declared.confirm) return '';
  const [ends, notEnded, underWay] = CONFIRM_PARTS('react');
  const running = `{preview.leftRunning.length > 0 && <div className="workflow-confirm-part"><h3>Other ${declared.noun}s still held for this party</h3><ul>{preview.leftRunning.map((entry, index) => <li key={index}>{entry.title}: {entry.state}</li>)}</ul></div>}`;
  return `{state.uiState === 'success' && preview && <section className="workflow-confirm" aria-labelledby="workflow-confirm-heading" onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); app.dismissAction(); } }}>
        <h2 id="workflow-confirm-heading" ref={confirmHeading} tabIndex={-1}>{confirmation.verb} {preview.name}?</h2>
        <div className="workflow-confirm-parts">
          ${ends}
          ${notEnded}
          ${underWay}
          ${declared.mandate ? '<div className="workflow-confirm-part"><h3>Not recalled</h3><p>{confirmation.notRecalled}</p></div>' : ''}
          ${running}
          <div className="workflow-confirm-part"><h3>{confirmation.who}</h3><p>{preview.actor ? preview.actor.name : confirmation.untold}</p></div>
        </div>
        <div className="workflow-field"><label htmlFor="workflow-confirm-note">{confirmation.note}</label><textarea id="workflow-confirm-note" name="workflow-confirm-note" ref={confirmNote} defaultValue={state.actionVia === 'form' && confirmation.reasonField ? String((state.draft as Record<string, unknown>)[confirmation.reasonField] ?? '') : ''} /></div>
        ${declared.alternative ? `{state.actionVia === 'button' && confirmation.alternative.from.includes(String((state.draft as Record<string, unknown>).status)) && <p className="workflow-confirm-alternative">{confirmation.alternative.lead} <Button intent="secondary" onClick={() => app.actions.${stateActionHandler(declared.alternative)}()}>{confirmation.alternative.button}</Button></p>}` : ''}
        <div className="workflow-confirm-buttons"><Button intent="danger" onClick={() => { void app.confirmAction(confirmNote.current?.value ?? ''); }}>{confirmation.button}</Button><Button intent="secondary" onClick={() => app.dismissAction()}>{confirmation.keep}</Button></div>
      </section>}`;
}

/** The Vue App's confirmation, drawn in place of the screen while it is open (the screen stays mounted, hidden). */
export function vueConfirmation(declared: WorkflowStateActions): string {
  if (!declared.confirm) return '';
  const [ends, notEnded, underWay] = CONFIRM_PARTS('vue');
  return `<section v-if="state.uiState === 'success' && preview" class="workflow-confirm" aria-labelledby="workflow-confirm-heading" @keydown.esc.prevent="app.dismissAction()">
        <h2 id="workflow-confirm-heading" ref="confirmHeading" tabindex="-1">{{ confirmation.verb }} {{ preview.name }}?</h2>
        <div class="workflow-confirm-parts">
          ${ends}
          ${notEnded}
          ${underWay}
          ${declared.mandate ? '<div class="workflow-confirm-part"><h3>Not recalled</h3><p>{{ confirmation.notRecalled }}</p></div>' : ''}
          <div v-if="preview.leftRunning.length" class="workflow-confirm-part"><h3>Other ${declared.noun}s still held for this party</h3><ul><li v-for="(entry, index) in preview.leftRunning" :key="index">{{ entry.title }}: {{ entry.state }}</li></ul></div>
          <div class="workflow-confirm-part"><h3>{{ confirmation.who }}</h3><p>{{ preview.actor ? preview.actor.name : confirmation.untold }}</p></div>
        </div>
        <div class="workflow-field"><label for="workflow-confirm-note">{{ confirmation.note }}</label><textarea id="workflow-confirm-note" ref="confirmNote" name="workflow-confirm-note" :value="state.actionVia === 'form' && confirmation.reasonField ? String(values[confirmation.reasonField] ?? '') : ''"></textarea></div>
        ${declared.alternative ? `<p v-if="state.actionVia === 'button' && confirmation.alternative.from.includes(String(values.status))" class="workflow-confirm-alternative">{{ confirmation.alternative.lead }} <Button intent="secondary" @activate="app.actions.${stateActionHandler(declared.alternative)}()">{{ confirmation.alternative.button }}</Button></p>` : ''}
        <div class="workflow-confirm-buttons"><Button intent="danger" @activate="app.confirmAction(confirmNote?.value ?? '')">{{ confirmation.button }}</Button><Button intent="secondary" @activate="app.dismissAction()">{{ confirmation.keep }}</Button></div>
      </section>`;
}

/** The styles of the confirmation and of a shown rule; only an app with declared actions carries them. */
export const CONFIRM_CSS = `
.workflow-confirm { display: grid; gap: var(--cmp-spacing-stack-lg); border: 1px solid var(--sys-border-strong); padding: var(--cmp-spacing-inset-default); margin: 0 0 var(--sys-space-inset-default); border-radius: var(--cmp-input-radius); }
.workflow-confirm h2 { margin: 0; font-family: var(--sys-text-scale-heading-md-font-family); font-size: var(--sys-text-scale-heading-md-font-size); font-weight: var(--sys-text-scale-heading-md-font-weight); line-height: var(--sys-text-scale-heading-md-line-height); }
.workflow-confirm h3 { margin: 0 0 var(--cmp-spacing-stack-xs); font-family: var(--sys-text-scale-label-md-font-family); font-size: var(--sys-text-scale-label-md-font-size); font-weight: var(--sys-text-scale-label-md-font-weight); line-height: var(--sys-text-scale-label-md-line-height); }
.workflow-confirm-parts { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr)); gap: var(--cmp-spacing-stack-lg) var(--cmp-spacing-inline-md); }
.workflow-confirm-part ul, .workflow-confirm-part p { margin: 0; }
.workflow-confirm-part ul { padding-inline-start: var(--cmp-spacing-inline-md); }
.workflow-confirm .workflow-field { margin-bottom: 0; }
.workflow-confirm textarea { display: block; width: 100%; margin-top: var(--cmp-spacing-stack-xs); }
.workflow-confirm-alternative { margin: 0; }
.workflow-confirm-buttons { display: flex; flex-wrap: wrap; gap: var(--cmp-spacing-inline-md); }
.workflow-rule { margin: 0 0 var(--sys-space-inset-default); color: var(--sys-text-secondary); }
`;
