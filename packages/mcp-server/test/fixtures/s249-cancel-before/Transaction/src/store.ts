import { recordCollectionEvents, type CollectionEvent } from '@oods/component-contracts';
import { sampleData } from './sample-data';


export type DomainRecord = {
  "status": 'pending' | 'authorized' | 'settled' | 'failed' | 'refunded' | 'cancelled';
  "state_history"?: unknown[];
  "allowed_transitions"?: string[];
  "created_at": string;
  "updated_at"?: string;
  "last_event": 'initiated' | 'authorized' | 'settled' | 'refunded' | 'failed';
  "last_event_at"?: string;
  "unit_amount_cents": number;
  "currency": 'USD' | 'EUR' | 'GBP' | 'JPY' | 'AUD';
  "pricing_model": 'one_time' | 'usage_based';
  "billing_interval"?: 'one_time';
  "tax_behavior": 'exclusive' | 'inclusive';
  "cancel_at_period_end"?: boolean;
  "cancellation_reason"?: string;
  "cancellation_reason_code"?: 'customer_request' | 'suspected_fraud' | 'duplicate_charge' | 'payment_method_error';
  "cancellation_requested_at"?: string;
  "is_archived": boolean;
  "archived_at"?: string | null;
  "restored_at"?: string | null;
  "archive_reason"?: string;
  "archived_by"?: string;
  "archive_metadata"?: Record<string, unknown>;
  "restoration_metadata"?: Record<string, unknown>;
  "approval_state"?: 'not_required' | 'waiting' | 'approved' | 'allowed_in_advance' | 'declined' | 'out_of_date';
  "approval_summary"?: string;
  "transaction_id": string;
  "user_id": string;
  "user_name"?: string;
  "organization_id"?: string;
  "organization_name"?: string;
  "occurred_at": string;
  "payment_method": 'card' | 'bank_transfer' | 'digital_wallet' | 'invoice';
  "channel": 'online' | 'in_app' | 'point_of_sale' | 'partner';
  "payment_reference"?: string;
  "description"?: string;
  "risk_score"?: number;
};

export const idField = "transaction_id" as const;
export const titleField = "payment_reference" as const;
export const sortField = "payment_reference" as const;
export const fieldLabels: Record<string, string> = {"status":"Status","state_history":"State history","allowed_transitions":"Allowed transitions","created_at":"Created at","updated_at":"Updated at","last_event":"Last event","last_event_at":"Last event at","unit_amount_cents":"Unit amount cents","currency":"Currency","pricing_model":"Pricing model","billing_interval":"Billing interval","tax_behavior":"Tax behavior","cancel_at_period_end":"Cancel at period end","cancellation_reason":"Cancellation reason","cancellation_reason_code":"Cancellation reason code","cancellation_requested_at":"Cancellation requested at","is_archived":"Is archived","archived_at":"Archived at","restored_at":"Restored at","archive_reason":"Archive reason","archived_by":"Archived by","archive_metadata":"Archive metadata","restoration_metadata":"Restoration metadata","approval_state":"Approval state","approval_summary":"Approval summary","transaction_id":"Transaction id","user_id":"User id","user_name":"User name","organization_id":"Organization id","organization_name":"Organization name","occurred_at":"Occurred at","payment_method":"Payment method","channel":"Channel","payment_reference":"Payment reference","description":"Description","risk_score":"Risk score"};
export const fieldTypes: Record<string, string> = {"status":"string","state_history":"StateTransition[]","allowed_transitions":"string[]","created_at":"datetime","updated_at":"datetime","last_event":"string","last_event_at":"datetime","unit_amount_cents":"number","currency":"string","pricing_model":"string","billing_interval":"string","tax_behavior":"string","cancel_at_period_end":"boolean","cancellation_reason":"string","cancellation_reason_code":"string","cancellation_requested_at":"datetime","is_archived":"boolean","archived_at":"datetime?","restored_at":"datetime?","archive_reason":"string","archived_by":"string","archive_metadata":"object","restoration_metadata":"object","approval_state":"string","approval_summary":"string","transaction_id":"uuid","user_id":"uuid","user_name":"string","organization_id":"uuid","organization_name":"string","occurred_at":"datetime","payment_method":"string","channel":"string","payment_reference":"string","description":"string","risk_score":"number"};
export const traits: readonly string[] = ["Stateful","Timestampable","Priceable","Cancellable","Archivable","Approvable"];
export interface StoreOptions { empty?: boolean; fail?: boolean; latency?: number; now?: () => string; seed?: DomainRecord[] }
export interface ListQuery { search?: string; status?: string; archived?: boolean; sort?: keyof DomainRecord; descending?: boolean; page?: number; pageSize?: number }
export interface HistoryEntry { title?: string; from: string | null; to: string; at: string; reason: string; code?: string; atPeriodEnd?: boolean }
export function screenProps(record: DomainRecord) {
  return {
  status: record["status"],
  stateHistory: record["state_history"],
  allowedTransitions: record["allowed_transitions"],
  createdAt: record["created_at"],
  updatedAt: record["updated_at"],
  lastEvent: record["last_event"],
  lastEventAt: record["last_event_at"],
  unitAmountCents: record["unit_amount_cents"],
  currency: record["currency"],
  pricingModel: record["pricing_model"],
  billingInterval: record["billing_interval"],
  taxBehavior: record["tax_behavior"],
  cancelAtPeriodEnd: record["cancel_at_period_end"],
  cancellationReason: record["cancellation_reason"],
  cancellationReasonCode: record["cancellation_reason_code"],
  cancellationRequestedAt: record["cancellation_requested_at"],
  isArchived: record["is_archived"],
  archivedAt: record["archived_at"],
  restoredAt: record["restored_at"],
  archiveReason: record["archive_reason"],
  archivedBy: record["archived_by"],
  archiveMetadata: record["archive_metadata"],
  restorationMetadata: record["restoration_metadata"],
  approvalState: record["approval_state"],
  approvalSummary: record["approval_summary"],
  transactionId: record["transaction_id"],
  userId: record["user_id"],
  userName: record["user_name"],
  organizationId: record["organization_id"],
  organizationName: record["organization_name"],
  occurredAt: record["occurred_at"],
  paymentMethod: record["payment_method"],
  channel: record["channel"],
  paymentReference: record["payment_reference"],
  description: record["description"],
  riskScore: record["risk_score"],

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
    const events: readonly string[] = ["initiated","authorized","settled","refunded","failed"];
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
        const left = sort === sortField ? (String(a["payment_reference"] ?? '').trim() ? a["payment_reference"] : a["transaction_id"]) : a[sort]; const right = sort === sortField ? (String(b["payment_reference"] ?? '').trim() ? b["payment_reference"] : b["transaction_id"]) : b[sort];
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
      if (values.is_archived || values.status === 'terminated' || values.status === 'pending_cancellation' || (immediate && ['completed', 'cancelled', 'final'].includes(String(values.status)))) throw new Error('This record cannot be cancelled in its current state');
      if (!reason.trim()) throw new Error('Enter a cancellation reason');
      if (!code || (["customer_request","suspected_fraud","duplicate_charge","payment_method_error"].length > 0 && !(["customer_request","suspected_fraud","duplicate_charge","payment_method_error"] as readonly string[]).includes(code))) throw new Error('Choose an allowed cancellation reason code');
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
