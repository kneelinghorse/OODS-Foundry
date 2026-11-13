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
 */
export interface HistoryAttribution {
  /**
   * "Billing Agent for Tidewater Co-op · approved by Ruth Adeyemi"; "Ruth Adeyemi" alone for a person acting for herself;
   * "… · approved by Ruth Adeyemi (level: Approval)" when the entry names its level of yes; "… · task: Get INV-2026-0155
   * paid" when it names the task it was made under.
   */
  text: string;
  /** True when the entry names who acted, so its actor id is not printed beside the name. */
  namesActor: boolean;
}

const named = (row: Record<string, unknown>, key: string): string | undefined => {
  const value = row[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
};

/**
 * A level's name as every screen shows an enum's value (the composer's enumOptionLabel, held to this by a spec): words
 * split at case changes, underscores and hyphens, in sentence case. "sign_off" reads "Sign off".
 */
const levelWords = (level: string): string => {
  const words = level.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/[_\-\s]+/).filter(Boolean).join(' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** The phrase for an entry's named parties, its level of yes and its task, or undefined when it names none of them. */
export function historyAttribution(entry: unknown): HistoryAttribution | undefined {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return undefined;
  const row = entry as Record<string, unknown>;
  const actor = named(row, 'actor_name');
  const principal = named(row, 'on_behalf_of_name');
  const approver = named(row, 'approved_by_name');
  const level = named(row, 'approval_level');
  const task = named(row, 'task_name');
  // A person acting for themselves, or an agent acting as itself, is named once.
  const forWhom = principal && principal !== actor ? principal : undefined;
  const who = actor ? (forWhom ? `${actor} for ${forWhom}` : actor) : forWhom ? `For ${forWhom}` : undefined;
  const approved = approver || level ? `${who ? 'approved' : 'Approved'}${approver ? ` by ${approver}` : ''}` : undefined;
  const approval = approved && level ? `${approved} (level: ${levelWords(level)})` : approved;
  // The task is named last, after who acted and who approved: the line reads who did it, on whose yes, as part of what.
  const work = task ? `${who || approval ? 'task' : 'Task'}: ${task}` : undefined;
  const text = [who, approval, work].filter(Boolean).join(' · ');
  return text ? { text, namesActor: actor !== undefined } : undefined;
}
