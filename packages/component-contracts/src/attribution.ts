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
 */
export interface HistoryAttribution {
  /** "Billing Agent for Tidewater Co-op · approved by Ruth Adeyemi"; "Ruth Adeyemi" alone for a person acting for herself. */
  text: string;
  /** True when the entry names who acted, so its actor id is not printed beside the name. */
  namesActor: boolean;
}

const named = (row: Record<string, unknown>, key: string): string | undefined => {
  const value = row[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
};

/** The phrase for an entry's named parties, or undefined when it names no one. */
export function historyAttribution(entry: unknown): HistoryAttribution | undefined {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return undefined;
  const row = entry as Record<string, unknown>;
  const actor = named(row, 'actor_name');
  const principal = named(row, 'on_behalf_of_name');
  const approver = named(row, 'approved_by_name');
  // A person acting for themselves, or an agent acting as itself, is named once.
  const forWhom = principal && principal !== actor ? principal : undefined;
  const who = actor ? (forWhom ? `${actor} for ${forWhom}` : actor) : forWhom ? `For ${forWhom}` : undefined;
  const approval = approver ? `${who ? 'approved' : 'Approved'} by ${approver}` : undefined;
  const text = [who, approval].filter(Boolean).join(' · ');
  return text ? { text, namesActor: actor !== undefined } : undefined;
}
