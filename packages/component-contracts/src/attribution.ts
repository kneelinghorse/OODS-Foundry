import { enumOptionLabel } from './status-registry.js';

/**
 * s244-m01 (#2829): every recorded change can name three parties, and every place history is printed says who in one
 * phrase built here.
 *
 * A history entry (Stateful's state_history, Auditable's audit_log) may carry these optional fields beside its
 * actor_id, following Relationship's source_id/source_name pattern:
 *   actor_name, actor_id          who acted
 *   actor_kind                    person, agent or system (the Actor trait's kinds)
 *   on_behalf_of_name, _id        who it acted for
 *   approved_by_name, _id         who approved it, when someone did
 *
 * Only a `*_name` field names a party: `actor` and `actor_id` are ids, and an entry that names no one renders exactly as
 * it did before, its "Actor: <id>" line included.
 *
 * s245-m01: a change someone approved can also point at its approval and name its level of yes:
 *   approval_id                   the Approval record the yes is kept in: a pointer kept in the record's data, never printed
 *   approval_level                the level of yes, printed in the words a level is shown in on every screen
 * "Billing Agent for Tidewater Co-op · approved by Ruth Adeyemi (level: Approval)". An entry without a level prints exactly
 * what it printed before.
 *
 * s247-m01: a change made as part of a task can also point at its task and name it:
 *   task_id                       the Task record the change was made under: a pointer kept in the record's data, never printed
 *   task_name                     the task, as shown, printed after who acted and who approved
 * "Billing Agent for Tidewater Co-op · approved by Ruth Adeyemi (level: Approval) · task: Get INV-2026-0155 paid". An entry
 * without a task name prints exactly what it printed before.
 *
 * s248-m01: a change made under a grant, the standing yes an actor acts under for a person or organization, can also point
 * at its grant and name it:
 *   grant_id                      the Grant record the change was made under: a pointer kept in the record's data, never printed
 *   grant_name                    the grant, as shown, printed after any approval and before the task
 * "Billing Agent for Tidewater Co-op · grant: Resend returned transfers": a change a standing yes allowed names the grant and
 * no approver, because no one approved it. An entry without a grant name prints exactly what it printed before.
 */
export interface HistoryAttribution {
  /**
   * "Billing Agent for Tidewater Co-op · approved by Ruth Adeyemi"; "Ruth Adeyemi" alone for a person acting for herself;
   * "… · approved by Ruth Adeyemi (level: Approval)" when the entry names its level of yes; "… · grant: Resend returned
   * transfers" when it names the grant it was made under; "… · task: Get INV-2026-0155 paid" when it names its task.
   */
  text: string;
  /** True when the entry names who acted, so its actor id is not printed beside the name. */
  namesActor: boolean;
}

const named = (row: Record<string, unknown>, key: string): string | undefined => {
  const value = row[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
};

// Decision authors “Sign-off” for sign_off. History also accepts an already displayed level.
const levelWords = (level: string): string => {
  const label = enumOptionLabel(level);
  return label === 'Sign off' ? 'Sign-off' : label;
};

/** The phrase for an entry's named parties, its level of yes, its grant and its task, or undefined when it names none of them. */
export function historyAttribution(entry: unknown): HistoryAttribution | undefined {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return undefined;
  const row = entry as Record<string, unknown>;
  const actor = named(row, 'actor_name');
  const principal = named(row, 'on_behalf_of_name');
  const approver = named(row, 'approved_by_name');
  const level = named(row, 'approval_level');
  const grant = named(row, 'grant_name');
  const task = named(row, 'task_name');
  // A person acting for themselves, or an agent acting as itself, is named once.
  const forWhom = principal && principal !== actor ? principal : undefined;
  const who = actor ? (forWhom ? `${actor} for ${forWhom}` : actor) : forWhom ? `For ${forWhom}` : undefined;
  const approved = approver || level ? `${who ? 'approved' : 'Approved'}${approver ? ` by ${approver}` : ''}` : undefined;
  const approval = approved && level ? `${approved} (level: ${levelWords(level)})` : approved;
  // The grant follows any approval: the authority the actor acted under. A line with a grant and no approver names only the
  // grant, never "approved by": a standing yes is not an approval of this change.
  const authority = grant ? `${who || approval ? 'grant' : 'Grant'}: ${grant}` : undefined;
  // The task is named last, after who acted, who approved and under what grant: the line reads who did it, on whose yes,
  // as part of what.
  const work = task ? `${who || approval || authority ? 'task' : 'Task'}: ${task}` : undefined;
  const text = [who, approval, authority, work].filter(Boolean).join(' · ');
  return text ? { text, namesActor: actor !== undefined } : undefined;
}
