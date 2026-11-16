import { recordCollectionEvents, type CollectionEvent } from '@oods/component-contracts';
import { sampleData } from './sample-data';


export type DomainRecord = {
  "instruction": string;
  "requested_by_id"?: string;
  "requested_by_name"?: string;
  "requested_by_kind"?: 'person' | 'agent' | 'system';
  "requested_for_id"?: string;
  "requested_for_name"?: string;
  "asked_of_id"?: string;
  "asked_of_name"?: string;
  "asked_of_kind"?: 'person' | 'agent';
  "subject_type"?: string;
  "subject_id"?: string;
  "subject_name"?: string;
  "due_at"?: string;
  "waiting_on_type"?: string;
  "waiting_on_id"?: string;
  "waiting_on_name"?: string;
  "parent_id"?: string;
  "parent_name"?: string;
  "origin_id"?: string;
  "origin_name"?: string;
  "result"?: string;
  "tries"?: number;
  "last_try"?: string;
  "status": 'not_started' | 'working' | 'needs_input' | 'waiting' | 'paused' | 'outcome_unknown' | 'finished' | 'failed' | 'declined' | 'cancelled' | 'handed_over';
  "state_history"?: unknown[];
  "allowed_transitions"?: string[];
  "created_at": string;
  "updated_at"?: string;
  "last_event": 'created' | 'started' | 'asked_for_input' | 'paused' | 'ended' | 'updated';
  "last_event_at"?: string;
  "owner_id": string;
  "owner_type": 'user' | 'team';
  "ownership_role"?: string;
  "ownership_transferred_at"?: string;
  "cancel_at_period_end"?: boolean;
  "cancellation_reason"?: string;
  "cancellation_reason_code"?: 'no_longer_needed' | 'asked_in_error' | 'done_another_way';
  "cancellation_requested_at"?: string;
  "task_id": string;
  "name": string;
  "owner_name"?: string;
};

export const idField = "task_id" as const;
export const titleField = "name" as const;
export const sortField = "name" as const;
export const fieldLabels: Record<string, string> = {"instruction":"Instruction","requested_by_id":"Requested by id","requested_by_name":"Requested by name","requested_by_kind":"Requested by kind","requested_for_id":"Requested for id","requested_for_name":"Requested for name","asked_of_id":"Asked of id","asked_of_name":"Asked of name","asked_of_kind":"Asked of kind","subject_type":"Subject type","subject_id":"Subject id","subject_name":"Subject name","due_at":"Due at","waiting_on_type":"Waiting on type","waiting_on_id":"Waiting on id","waiting_on_name":"Waiting on name","parent_id":"Parent id","parent_name":"Parent name","origin_id":"Origin id","origin_name":"Origin name","result":"Result","tries":"Tries","last_try":"Last try","status":"Status","state_history":"State history","allowed_transitions":"Allowed transitions","created_at":"Created at","updated_at":"Updated at","last_event":"Last event","last_event_at":"Last event at","owner_id":"Owner id","owner_type":"Owner type","ownership_role":"Ownership role","ownership_transferred_at":"Ownership transferred at","cancel_at_period_end":"Cancel at period end","cancellation_reason":"Cancellation reason","cancellation_reason_code":"Cancellation reason code","cancellation_requested_at":"Cancellation requested at","task_id":"Task id","name":"Name","owner_name":"Owner name"};
export const fieldTypes: Record<string, string> = {"instruction":"string","requested_by_id":"string","requested_by_name":"string","requested_by_kind":"string","requested_for_id":"string","requested_for_name":"string","asked_of_id":"string","asked_of_name":"string","asked_of_kind":"string","subject_type":"string","subject_id":"string","subject_name":"string","due_at":"datetime","waiting_on_type":"string","waiting_on_id":"string","waiting_on_name":"string","parent_id":"string","parent_name":"string","origin_id":"string","origin_name":"string","result":"string","tries":"integer","last_try":"string","status":"string","state_history":"StateTransition[]","allowed_transitions":"string[]","created_at":"datetime","updated_at":"datetime","last_event":"string","last_event_at":"datetime","owner_id":"string","owner_type":"string","ownership_role":"string","ownership_transferred_at":"datetime","cancel_at_period_end":"boolean","cancellation_reason":"string","cancellation_reason_code":"string","cancellation_requested_at":"datetime","task_id":"uuid","name":"string","owner_name":"string"};
export const traits: readonly string[] = ["Assignment","Stateful","Timestampable","Ownerable","Cancellable"];
export interface StoreOptions { empty?: boolean; fail?: boolean; latency?: number; now?: () => string; seed?: DomainRecord[] }
export interface ListQuery { search?: string; status?: string; archived?: boolean; sort?: keyof DomainRecord; descending?: boolean; page?: number; pageSize?: number }
export interface HistoryEntry { title?: string; from: string | null; to: string; at: string; reason: string; code?: string; atPeriodEnd?: boolean }
export function screenProps(record: DomainRecord) {
  return {
  instruction: record["instruction"],
  requestedById: record["requested_by_id"],
  requestedByName: record["requested_by_name"],
  requestedByKind: record["requested_by_kind"],
  requestedForId: record["requested_for_id"],
  requestedForName: record["requested_for_name"],
  askedOfId: record["asked_of_id"],
  askedOfName: record["asked_of_name"],
  askedOfKind: record["asked_of_kind"],
  subjectType: record["subject_type"],
  subjectId: record["subject_id"],
  subjectName: record["subject_name"],
  dueAt: record["due_at"],
  waitingOnType: record["waiting_on_type"],
  waitingOnId: record["waiting_on_id"],
  waitingOnName: record["waiting_on_name"],
  parentId: record["parent_id"],
  parentName: record["parent_name"],
  originId: record["origin_id"],
  originName: record["origin_name"],
  result: record["result"],
  tries: record["tries"],
  lastTry: record["last_try"],
  status: record["status"],
  stateHistory: record["state_history"],
  allowedTransitions: record["allowed_transitions"],
  createdAt: record["created_at"],
  updatedAt: record["updated_at"],
  lastEvent: record["last_event"],
  lastEventAt: record["last_event_at"],
  ownerId: record["owner_id"],
  ownerType: record["owner_type"],
  ownershipRole: record["ownership_role"],
  ownershipTransferredAt: record["ownership_transferred_at"],
  cancelAtPeriodEnd: record["cancel_at_period_end"],
  cancellationReason: record["cancellation_reason"],
  cancellationReasonCode: record["cancellation_reason_code"],
  cancellationRequestedAt: record["cancellation_requested_at"],
  taskId: record["task_id"],
  name: record["name"],
  ownerName: record["owner_name"],

  };
}
export function history(record: DomainRecord): HistoryEntry[] {
  const value = (record as Record<string, unknown>).state_history;
  return Array.isArray(value) ? value.filter((entry): entry is HistoryEntry => !!entry && typeof entry === 'object' && typeof entry.to === 'string' && typeof entry.at === 'string') : [];
}
export function collectionEvents(record: DomainRecord): CollectionEvent[] {
  return recordCollectionEvents(record, {"historyField":"state_history","payments":[],"minorUnits":100});
}
export function createStore(options: StoreOptions = {}) {
  let records = structuredClone(options.seed ?? (options.empty ? [] : sampleData));
  let fail = options.fail ?? false;
  const now = options.now ?? (() => new Date().toISOString());
  const requireTrait = (trait: string) => { if (!traits.includes(trait)) throw new Error('Object does not support ' + trait); };
  const get = (id: string) => {
    const record = records.find((entry) => String(entry[idField]) === id);
    if (!record) throw new Error('Record not found: ' + id);
    return structuredClone(record);
  };
  const save = (record: DomainRecord) => {
    const index = records.findIndex((entry) => entry[idField] === record[idField]);
    if (index < 0) throw new Error('Cannot save a missing record');
    records[index] = structuredClone(record);
    return get(String(record[idField]));
  };
  // A saved edit is history: the record's state history gains an entry naming the changed fields.
  const update = (record: DomainRecord) => {
    const previous = records.find((entry) => entry[idField] === record[idField]);
    if (!previous) throw new Error('Cannot save a missing record');
    const values = record as Record<string, unknown>;
    const before = previous as Record<string, unknown>;
    const changed = Object.keys(values).filter((name) => Object.hasOwn(fieldTypes, name) && name !== 'state_history' && name !== "updated_at" && JSON.stringify(values[name]) !== JSON.stringify(before[name]));
    if (changed.length === 0) return save(record);
    const at = now();
    const next = structuredClone(record);
    const target = next as Record<string, unknown>;
    if (Object.hasOwn(fieldTypes, "updated_at")) target["updated_at"] = at;
    if (Object.hasOwn(fieldTypes, 'state_history')) {
      const status = String(target.status ?? before.status ?? '');
      const moved = changed.includes("status");
      const entry: HistoryEntry = { title: moved ? String(status).split(/[_-]/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ') : 'Updated', from: moved ? String(before.status ?? '') : null, to: status, at, reason: 'Edited ' + changed.map((name) => fieldLabels[name] ?? name).join(', ') };
      target.state_history = [...history(next), entry];
    }
    const events: readonly string[] = ["created","started","asked_for_input","paused","ended","updated"];
    const updateEvent = events.find((event) => /updat|edit|profile|chang/.test(event));
    if (updateEvent && Object.hasOwn(fieldTypes, 'last_event')) { target.last_event = updateEvent; if (Object.hasOwn(fieldTypes, 'last_event_at')) target.last_event_at = at; }
    return save(next);
  };
  const setArchived = (id: string, archived: boolean) => {
    requireTrait('Archivable');
    const record = get(id);
    Object.assign(record, { is_archived: archived, archived_at: archived ? now() : null });
    return save(record);
  };
  return {
    get, save, update,
    async ready() {
      await new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, options.latency ?? 180)));
      if (fail) throw new Error('Simulated data service failure');
    },
    setFailure(value: boolean) { fail = value; },
    list(query: ListQuery = {}) {
      const search = (query.search ?? '').trim().toLowerCase();
      const filtered = records.filter((record) => {
        const values = record as Record<string, unknown>;
        return Boolean(values.is_archived) === (query.archived ?? false)
          && (!query.status || values.status === query.status)
          && (!search || Object.values(record).some((value) => String(value).toLowerCase().includes(search)));
      });
      const sort = query.sort ?? sortField;
      filtered.sort((a, b) => {
        const left = a[sort]; const right = b[sort];
        const order = typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right));
        return (query.descending ? -1 : 1) * order;
      });
      const pageSize = Math.max(1, Math.floor(query.pageSize ?? 10));
      const page = Math.max(1, Math.floor(query.page ?? 1));
      return { total: filtered.length, page, pageSize, records: structuredClone(filtered.slice((page - 1) * pageSize, page * pageSize)) };
    },
    cancel(id: string, reason: string, code: string, atPeriodEnd: boolean) {
      requireTrait('Cancellable');
      const record = get(id);
      const values = record as Record<string, unknown>;
      // s213-m01: the lifecycle decides (cancellationMode); a record never moves to a state its object does not declare.
      const mode = "immediate" as 'deferred' | 'immediate' | 'none';
      if (mode === 'none') throw new Error('This record has no cancelled state to move to');
      const immediate = mode === 'immediate';
      const target = immediate ? 'cancelled' : 'pending_cancellation';
      // The object's declared order decides the states a record may be cancelled from.
      if (values.is_archived || !(["not_started","working","needs_input","waiting","paused","outcome_unknown"] as readonly string[]).includes(String(values.status))) throw new Error('This record cannot be cancelled in its current state');
      if (!reason.trim()) throw new Error('Enter a cancellation reason');
      if (!code || (["no_longer_needed","asked_in_error","done_another_way"].length > 0 && !(["no_longer_needed","asked_in_error","done_another_way"] as readonly string[]).includes(code))) throw new Error('Choose an allowed cancellation reason code');
      const at = now();
      const deferred = target === 'pending_cancellation' && atPeriodEnd;
      const entry: HistoryEntry = { title: target === 'cancelled' ? 'Cancelled' : 'Pending Cancellation', from: String(values.status), to: target, at, reason: reason.trim(), code, atPeriodEnd: deferred };
      Object.assign(record, { ["status"]: target, cancellation_reason: reason.trim(), cancellation_reason_code: code, cancellation_requested_at: at, state_history: [...history(record), entry], ["updated_at"]: at });
      return save(record);
    },
    archive(id: string) { return setArchived(id, true); },
    restore(id: string) { return setArchived(id, false); },
  };
}
