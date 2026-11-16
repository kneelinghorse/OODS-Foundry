import { parseBillingAmount } from '@oods/component-contracts';
import { createStore, idField, titleField, sortField, fieldTypes, screenProps, history, collectionEvents, type DomainRecord, type ListQuery, type StoreOptions } from './store';
import { sampleData } from './sample-data';
import type { WorkflowActions } from './actions';
export { idField, titleField, screenProps, history, collectionEvents };
export type Screen = 'list' | 'detail' | 'form' | 'timeline';
export type UIState = 'loading' | 'empty' | 'error' | 'success';
export const routes = {"list":"/","detail":"/:id","form":"/:id/edit","timeline":"/:id/timeline"};
export const cancellable = true;
export const deferredCancellation = false;
export const objectLabel = "transaction";
export const statuses = ["pending","authorized","settled","failed","refunded","cancelled"];
export const archivePresentation = {"archivedField":"is_archived","showBadge":true,"separateTab":true,"tabLabel":"Archived"};
export const supplementalFields: Array<{ name: string; label: string; help: string }> = [];
export const cancellationFormProps = {"allowedReasons":["customer_request","suspected_fraud","duplicate_charge","payment_method_error"],"reasonHelp":"Free-form detail describing why cancellation occurred.","codeHelp":"Choose the reason for cancellation."};
const fieldByNodeId: Record<string, string> = {"list-list-toolbar-4-sort":"payment_reference","list-list-items-5-row":"transaction_id","list-list-items-5-title":"payment_reference","list-list-items-5-summary":"description","list-ve-items-11":"updated_at","detail-ve-header-26":"status","detail-detail-tabs-9-user_id-value":"user_id","detail-detail-tabs-9-organization_id-value":"organization_id","detail-detail-tabs-9-occurred_at-value":"occurred_at","detail-detail-tabs-9-payment_method-value":"payment_method","detail-slot-tab-2-8-value":"channel","detail-detail-tabs-9-description-value":"description","detail-detail-tabs-9-risk_score-value":"risk_score","detail-slot-tab-1-6-value":"approval_summary","detail-detail-tabs-9-created_at-value":"created_at","detail-pg-status-timeline-31-value":"updated_at","detail-detail-tabs-9-last_event-value":"last_event","detail-detail-tabs-9-last_event_at-value":"last_event_at","form-ve-title-26":"status","form-slot-field-1-5":"created_at","form-slot-field-2-7":"currency","form-slot-field-3-13":"tax_behavior","form-slot-field-4-15":"description","form-slot-field-5-17":"last_event","form-slot-field-6-19":"unit_amount_cents","form-slot-field-7-21":"pricing_model","form-slot-field-8-23":"transaction_id","form-slot-field-9-25":"user_id","form-form-fields-8-required-is_archived":"is_archived","form-form-fields-8-required-occurred_at":"occurred_at","form-form-fields-8-required-payment_method":"payment_method","form-form-fields-8-required-channel":"channel","timeline-timeline-header-1-title":"payment_reference"};
export interface AppState { screen: Screen; uiState: UIState; id: string; draft: DomainRecord; records: DomainRecord[]; total: number; page: number; pageSize: number; search: string; status: string; descending: boolean; archived: boolean; error: string; notice: string; revision: number; cancelOpen: boolean }
export function createWorkflow(options: StoreOptions = {}) {
  const store = createStore(options);
  let query: ListQuery = {};
  let request = 0;
  const first = store.list().records[0] ?? sampleData[0]!;
  let state: AppState = { screen: 'list', uiState: 'loading', id: String(first[idField]), draft: structuredClone(first), records: [], total: 0, page: 1, pageSize: 10, search: '', status: '', descending: false, archived: false, error: '', notice: '', revision: 0, cancelOpen: false };
  const listeners = new Set<(state: AppState) => void>();
  const publish = (patch: Partial<AppState>) => { state = { ...state, ...patch }; listeners.forEach((listener) => listener(state)); };
  const value = (field: string) => (state.draft as Record<string, unknown>)[field];
  async function navigate(screen: Screen, id = state.id) {
    const ticket = ++request;
    publish({ screen, id, cancelOpen: false, uiState: 'loading', error: '', revision: state.revision + 1 });
    try {
      await store.ready();
      if (ticket !== request) return;
      const list = store.list(query);
      const selected = screen === 'list' ? list.records[0] : store.list({ archived: query.archived, pageSize: 10000 }).records.find((record) => String(record[idField]) === id);
      const draft = selected ?? sampleData[0]!;
      publish({ records: list.records, total: list.total, page: list.page, pageSize: list.pageSize, search: query.search ?? '', status: query.status ?? '', descending: query.descending ?? false, archived: query.archived ?? false, draft: structuredClone(draft), id: selected ? String(selected[idField]) : id, uiState: selected ? 'success' : 'empty' });
    } catch (error) { if (ticket === request) publish({ uiState: 'error', error: error instanceof Error ? error.message : String(error) }); }
  }
  function refreshList() {
    const list = store.list(query);
    const selected = list.records[0];
    publish({ records: list.records, total: list.total, page: list.page, pageSize: list.pageSize, search: query.search ?? '', status: query.status ?? '', descending: query.descending ?? false, archived: query.archived ?? false, uiState: selected ? 'success' : 'empty' });
  }
  async function change(operation: () => DomainRecord, destination: Screen) {
    publish({ uiState: 'loading', error: '' });
    try { await store.ready(); operation(); publish({ notice: 'Changes saved in this session.' }); await navigate(destination); }
    catch (error) { publish({ uiState: 'error', error: error instanceof Error ? error.message : String(error) }); }
  }
  const actions: WorkflowActions = {
    handleCancel: () => { publish({ cancelOpen: true }); },
    handleDelete: () => { void change(() => store.archive(state.id), "list"); },
    handleEdit: () => { void navigate("form"); },
    handleFilter: (criteria) => { query = { ...query, search: String(criteria.search ?? ""), status: String(criteria.status ?? ""), archived: Boolean(criteria.archived ?? query.archived), page: 1 }; refreshList(); },
    handlePageChange: (page) => { query = { ...query, page }; refreshList(); },
    handleRowClick: (id) => { void navigate("detail", id); },
    handleSort: (column) => { if (column in fieldTypes) { query = { ...query, sort: column as keyof DomainRecord, descending: !query.descending }; refreshList(); } },
    handleSubmit: () => { void change(() => store.update(state.draft), "detail"); },
    handleViewTimeline: () => { void navigate("timeline"); },
  };
  function edit(event: Event) {
    if (state.screen !== 'form' && state.screen !== 'detail') return;
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) return;
    // s223-m02: a combobox's text is the filter the person types, not the field's value; choose() takes its pick.
    if (target.getAttribute('role') === 'combobox') return;
    // A native select commits on change. Publishing during input can redraw its
    // old controlled value before change reads the keyboard selection in Vue.
    if (target instanceof HTMLSelectElement && event.type === 'input') return;
    let field = target.name;
    if (target.closest('[data-oods-component="CancellationForm"]')) field = ({ reason: 'cancellation_reason', reasonCode: 'cancellation_reason_code' } as Record<string, string>)[field] ?? field;
    let element: HTMLElement | null = target;
    while (!Object.hasOwn(fieldTypes, field) && element) { field = fieldByNodeId[element.id] ?? ''; element = element.parentElement; }
    if (!Object.hasOwn(fieldTypes, field)) return;
    const type = fieldTypes[field];

    if (target instanceof HTMLInputElement && target.dataset.billingMinorUnits !== undefined) {
      const result = parseBillingAmount(target.value, Number(target.dataset.billingMinorUnits));
      if (result.valid) publish({ draft: { ...state.draft, [field]: result.value }, notice: 'Unsaved changes' });
      return;
    }
    const value = target instanceof HTMLInputElement && target.type === 'checkbox' ? target.checked
      : type === 'number' || type === 'integer' ? Number(target.value) : target instanceof HTMLInputElement && target.type === 'datetime-local' && target.value ? new Date(target.value + 'Z').toISOString() : target.value;
    publish({ draft: { ...state.draft, [field]: value }, notice: 'Unsaved changes' });
  }
  // s223-m02 (#2527 rulings 12 and 13a): a Switch and a Combobox are not native inputs, so no change event carries their
  // value; their clicks and keys do, read before the control repaints. A click on a switch (or its label, or Space or
  // Enter) carries the value it turns to. A combobox's pick (a click on an option, or Enter on the active one) carries
  // the option's value, and Escape with its list closed clears it.
  function choose(event: Event) {
    if ((state.screen !== 'form' && state.screen !== 'detail') || !(event.target instanceof Element)) return;
    const target = event.target;
    const combobox = target.closest('[data-oods-component="Combobox"]')?.querySelector('input[role="combobox"]');
    let control: Element | null | undefined;
    let next: unknown;
    if (event.type === 'click') {
      control = target.closest('button[role="switch"]');
      const option = target.closest('[role="option"][data-value]:not([aria-disabled="true"])');
      if (control) next = control.getAttribute('aria-checked') !== 'true';
      else if (option && combobox) { control = combobox; next = option.getAttribute('data-value'); }
    } else if (event instanceof KeyboardEvent && target === combobox) {
      control = combobox;
      const active = event.key === 'Enter' ? combobox.getAttribute('aria-activedescendant') : null;
      const option = active ? document.getElementById(active) : null;
      if (option && option.getAttribute('aria-disabled') !== 'true') next = option.getAttribute('data-value');
      else if (event.key === 'Escape' && combobox.getAttribute('aria-expanded') !== 'true') next = '';
    }
    if (!control || next === undefined || next === null) return;
    let field = '';
    let element: Element | null = control;
    while (!Object.hasOwn(fieldTypes, field) && element) { field = fieldByNodeId[element.id] ?? ''; element = element.parentElement; }
    if (!Object.hasOwn(fieldTypes, field)) return;
    publish({ draft: { ...state.draft, [field]: next }, notice: 'Unsaved changes' });
  }
  return {
    snapshot: () => state,
    subscribe(listener: (state: AppState) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    navigate, actions, edit, choose,
    confirmCancellation() { return change(() => store.cancel(state.id, String(value("cancellation_reason") ?? ""), String(value("cancellation_reason_code") ?? ""), Boolean(value("cancel_at_period_end"))), 'detail'); },
    dismissCancellation() { publish({ cancelOpen: false }); },
    filter(search: string, status = query.status ?? '') { query = { ...query, search, status, page: 1 }; return refreshList(); },
    sort(descending: boolean) { query = { ...query, sort: sortField, descending }; return refreshList(); },
    page(page: number) { query = { ...query, page }; return refreshList(); },
    archived(archived: boolean) { query = { ...query, archived, page: 1 }; return refreshList(); },
    restore() { return change(() => store.restore(state.id), 'list'); },
    retry() { store.setFailure(false); return navigate(state.screen); },
    dispose() { request++; listeners.clear(); },
  };
}
