import type { UiElement, UiSchema } from '../schemas/generated.js';
import type { CodegenOptions, CodegenResult, Emitter, GeneratedArtifactAction } from './types.js';
import { GENERATED_APP_NODE_FLOOR, GENERATED_DEPENDENCY_CATALOG, generatedActionContractDigest, generatedActionSourceDigest, generatedActionTypeSignature } from './artifact-envelope.js';
import { fieldLabel, fieldHelp } from '../compose/label-generator.js';
import { enumOptionLabel, isInternalField, isUnavailableField } from '../compose/internal-fields.js';
import { cancellationMode } from '../objects/cancellation-mode.js';
import { workflowDataFiles } from './workflow-data-emitter.js';
import { displayFieldExpression } from './binding-utils.js';
import { recordTitleField } from '../compose/record-label.js';

const CONTEXTS = ['list', 'detail', 'form', 'timeline'] as const;
const nameOf = (context: string) => context[0]!.toUpperCase() + context.slice(1);

/** Reuse the regular emitters, then supply their domain actions from a generated app. */
export function emitWorkflow(schema: UiSchema, options: CodegenOptions, framework: 'react' | 'vue', emitScreen: Emitter): CodegenResult {
  const failure = (message: string): CodegenResult => ({ status: 'error', framework, code: '', fileExtension: '', imports: [], warnings: [], errors: [{ code: 'OODS-N016', message }] });
  if (!options.typescript) return failure('Workflow applications require options.typescript=true for their typed store and action contract.');
  if (!schema.objectSchema || !schema.workflow) return failure('Workflow applications require an object schema and workflow contract.');
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(schema.workflow.object)) return failure('Workflow object must use a canonical alphanumeric registry name.');
  if (schema.workflow.screens.map((screen) => screen.context).join(',') !== CONTEXTS.join(',')) return failure('Workflow requires list, detail, form and timeline screens in order.');
  const theme = options.theme ?? 'light';
  const brand = options.brand ?? 'A';
  // s206-m01: the scope the host mounted the app in wins; the generated scope is only the default. The workflow app used
  // to set its generated theme on mount, over the preview page's, so every dark and high-contrast workflow cell had
  // rendered light (and axe reported the light current-screen tab under forced colours).
  const mountTheme = `{ const host = document.body.dataset.theme ? document.body.dataset : document.documentElement.dataset; const theme = host.theme ?? ${JSON.stringify(theme)}; const brand = host.brand ?? ${JSON.stringify(brand)}; for (const element of [document.documentElement, document.body]) { element.dataset.theme = theme; element.dataset.brand = brand; } }\n`;
  const files: NonNullable<CodegenResult['files']> = [];
  const actionMap = new Map<string, GeneratedArtifactAction>();
  const imports = new Set<string>(['@oods/component-contracts']);
  const warnings: CodegenResult['warnings'] = [];
  const fieldByNodeId: Record<string, string> = {};
  const formFields = new Set<string>();
  const collectionEditors = new Map<string, UiElement>();
  let archiveOverlay: UiElement | undefined;
  let cancellationForm: UiElement | undefined;
  const visit = (node: UiElement, context: string) => {
    // These recipes still contain parameter directives. The assembled app owns
    // their resolved lifecycle values; ordinary single-screen output is unchanged.
    const states = schema.workflow!.data.lifecycleStates;
    if (node.component === 'StatusSelector' && node.props?.optionsParameter === 'states' && node.props.options === undefined && !schema.objectSchema![String(node.props.field)]?.enum?.length) node.props.options = states;
    if (node.collectionControl === 'filter' && schema.objectSchema!.status && Array.isArray(node.props?.options) && node.props.options.length === 1 && states.length) node.props.options = [{ value: '', label: 'All states' }, ...states.map(value => ({ value, label: enumOptionLabel(value) }))];
    // The app's header names the record; a screen's own level-one record title becomes level two inside it.
    if (node.component === 'DetailHeader' && node.props?.headingLevel === 1) node.props = { ...node.props, headingLevel: 2 };
    if (context === 'list' && node.component === 'ArchivedRowOverlay') archiveOverlay = node;
    if (context === 'form' && node.component === 'CancellationForm') cancellationForm = node;
    const field = node.props?.field
      ?? (node.component === 'BillingAmountInput' ? node.props?.amountField : undefined)
      ?? (node.component === 'BillingIntervalSelector' ? node.props?.intervalField : undefined);
    if (typeof field === 'string') {
      fieldByNodeId[node.id] = field;
      if (context === 'form') {
        formFields.add(field);
        if (schema.objectSchema![field]?.type.endsWith('[]')) collectionEditors.set(field, node);
      }
    }
    node.children?.forEach((child) => visit(child, context));
  };
  for (const declaration of schema.workflow.screens) {
    const source = schema.screens.find((node) => node.id === declaration.id);
    if (!source) return failure(`Workflow screen '${declaration.id}' is missing.`);
    const screen = structuredClone(source);
    visit(screen, declaration.context);
    const { workflow: _workflow, ...single } = schema;
    // s213-m06: a team brand's stylesheet is imported once, by the App, not by each screen.
    const result = emitScreen({ ...single, screens: [screen] }, { ...options, workflowCollections: true, brandStylesheet: undefined, objectName: schema.workflow.object });
    if (result.status !== 'ok') return result;
    result.imports.forEach((entry) => imports.add(entry));
    warnings.push(...result.warnings);
    for (const action of result.actions ?? []) {
      const previous = actionMap.get(action.name);
      if (previous && JSON.stringify(previous.parameters) !== JSON.stringify(action.parameters)) return failure(`Workflow action '${action.name}' has incompatible screen signatures.`);
      if (previous) previous.sources.push(...action.sources);
      else actionMap.set(action.name, structuredClone(action));
    }
    // One application-level declaration carries the union of screen provenance.
    // Executable forwarding/local handler markers remain in every screen file.
    // s221-m01: the screen emitters label the archiving action Archive (screenActionLabel); this output relabel matched
    // only a lowercase </button> and had not applied since the bar became the design system's Button.
    let code = result.code.replace(/^[ \t]*\/\* @oods-domain-(?:action|source) [^\n]+\*\/\n/gm, '');
    if (/collectionAddress\(|collectionSummary\(/.test(code)) {
      const helpers = "import { collectionAddress, collectionSummary } from '../store';\n";
      code = framework === 'react' ? helpers + code : code.replace('<script setup lang="ts">', '<script setup lang="ts">\n' + helpers);
    }
    files.push({ path: `src/screens/${nameOf(declaration.context)}${result.fileExtension}`, contents: code });
  }
  const actions = [...actionMap.values()].sort((a, b) => a.name.localeCompare(b.name));
  const implementations: Record<string, string> = {
    handleRowClick: '(id) => { void navigate("detail", id); }',
    handleEdit: '() => { void navigate("form"); }',
    handleSubmit: '() => { void change(() => store.update(state.draft), "detail"); }',
    handleCancel: '() => { publish({ cancelOpen: true }); }',
    handleViewTimeline: '() => { void navigate("timeline"); }',
    handleDelete: '() => { void change(() => store.archive(state.id), "list"); }',
    handleChange: '() => { publish({ notice: "Changes are ready to save." }); }',
    handleSort: '(column) => { if (column in fieldTypes) { query = { ...query, sort: column as keyof DomainRecord, descending: !query.descending }; refreshList(); } }',
    handleFilter: '(criteria) => { query = { ...query, search: String(criteria.search ?? ""), status: String(criteria.status ?? ""), archived: Boolean(criteria.archived ?? query.archived), page: 1 }; refreshList(); }',
    handlePageChange: '(page) => { query = { ...query, page }; refreshList(); }',
  };
  for (const action of actions) {
    if (implementations[action.name]) continue;
    const field = action.name.startsWith('handleChange_') ? action.name.slice('handleChange_'.length) : '';
    const editor = collectionEditors.get(field);
    if (!editor || action.parameters.length !== 1 || action.parameters[0]!.type !== 'Record<string, unknown>') return failure(`Workflow has no domain implementation for '${action.name}'.`);
    const parameter = action.parameters[0]!.name;
    const defaultRoleField = typeof editor.props?.defaultRoleField === 'string' ? editor.props.defaultRoleField : '';
    const fallbackRole = editor.props?.role ?? schema.workflow.data.defaultAddressRole ?? schema.workflow.data.addressRoles?.[0] ?? 'primary';
    const addressable = schema.objectSchema[field]!.type === 'AddressableEntry[]';
    implementations[action.name] = `(${parameter}) => {
      const entries = state.draft[${JSON.stringify(field)}] ?? [];
      const requestedRole = String(value(${JSON.stringify(defaultRoleField)}) || ${JSON.stringify(fallbackRole)});
      const index = ${addressable ? 'collectionAddressIndex(entries, requestedRole)' : "entries.findIndex(entry => !!entry && typeof entry === 'object' && 'role' in entry && entry.role === requestedRole)"};
      const previous = index < 0 ? {} : entries[index] as Record<string, unknown>;
      const role = String(previous.role ?? requestedRole);
      const entry = { ...previous, role, ${addressable ? `address: { ...((previous.address ?? {}) as Record<string, unknown>), countryCode: ((previous.address ?? {}) as Record<string, unknown>).countryCode ?? 'US', addressLines: [String(${parameter}.street ?? '')], locality: String(${parameter}.city ?? ''), administrativeArea: String(${parameter}.region ?? ''), postalCode: String(${parameter}.postalCode ?? '') }, isDefault: true, updatedAt: (options.now ?? (() => new Date().toISOString()))()` : `...${parameter}`} };
      const next = [...entries]; if (index < 0) next.push(entry); else next[index] = entry;
      publish({ draft: { ...state.draft, [${JSON.stringify(field)}]: next }, notice: 'Unsaved changes' });
    }`;
  }
  files.push({ path: 'src/actions.ts', contents: `export interface WorkflowActions {\n${actions.map((action) => [
    `  /* @oods-domain-action ${action.name} ${generatedActionContractDigest(action)} */`,
    ...action.sources.map((source) => `  /* @oods-domain-source ${generatedActionSourceDigest(action.name, source)} */`),
    `  ${generatedActionTypeSignature(action)};`,
  ].join('\n')).join('\n')}\n}\n` });
  files.push(...workflowDataFiles(schema));
  const titleField = recordTitleField(schema.workflow.object, schema.objectSchema!, schema.workflow.data.idField);
  const supplemental = Object.entries(schema.objectSchema).filter(([name, field]) => name !== schema.workflow!.data.idField && !formFields.has(name) && !isInternalField(name, schema.objectSchema!) && !isUnavailableField(name, schema.objectSchema!) && field.required && field.type === 'string' && !field.enum);
  files.push({ path: 'src/application.ts', contents: `import { parseBillingAmount } from '@oods/component-contracts';
import { ${Object.values(schema.objectSchema).some(field => field.type === 'AddressableEntry[]') ? 'collectionAddressIndex, ' : ''}createStore, idField, titleField, sortField, fieldTypes, screenProps, history, collectionEvents, type DomainRecord, type ListQuery, type StoreOptions } from './store';
import { sampleData } from './sample-data';
import type { WorkflowActions } from './actions';
export { idField, titleField, screenProps, history, collectionEvents };
export type Screen = 'list' | 'detail' | 'form' | 'timeline';
export type UIState = 'loading' | 'empty' | 'error' | 'success';
export const routes = ${JSON.stringify(Object.fromEntries(schema.workflow.screens.map((screen) => [screen.context, screen.route])))};
export const cancellable = ${JSON.stringify(schema.workflow.data.traits.some((trait) => trait.split('/').pop() === 'Cancellable'))};
export const deferredCancellation = ${JSON.stringify(cancellationMode(schema.workflow.data.lifecycleStates) === 'deferred')};
export const objectLabel = ${JSON.stringify(schema.workflow.object.toLowerCase())};
export const statuses = ${JSON.stringify(schema.workflow.data.lifecycleStates)};
export const archivePresentation = ${JSON.stringify({ archivedField: archiveOverlay?.props?.archivedField ?? 'is_archived', showBadge: archiveOverlay?.props?.showBadge ?? true, separateTab: archiveOverlay?.props?.separateTab ?? true, tabLabel: archiveOverlay?.props?.tabLabel ?? 'Archived' })};
export const supplementalFields: Array<{ name: string; label: string; help: string }> = ${JSON.stringify(supplemental.map(([name, field]) => ({ name, label: fieldLabel(name), help: fieldHelp(name, field.description) ?? '' })))};
export const cancellationFormProps = ${JSON.stringify({ allowedReasons: schema.workflow.data.cancellationReasonCodes, reasonHelp: cancellationForm?.props?.reasonHelp, codeHelp: cancellationForm?.props?.codeHelp })};
const fieldByNodeId: Record<string, string> = ${JSON.stringify(fieldByNodeId)};
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
${actions.map((action) => `    ${action.name}: ${implementations[action.name]},`).join('\n')}
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
${collectionEditors.size ? "    // Collection editors dispatch whole domain values; their native inputs are not scalar record fields.\n    if (type?.endsWith('[]')) return;" : ''}
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
` });
  const hasCollectionEditor = collectionEditors.size > 0;
  const titleExpression = `formatRecordLabel(${displayFieldExpression(titleField, schema.objectSchema, name => `state.draft[${JSON.stringify(name)}]`)})`;
  const app = framework === 'react' ? reactApp(schema.workflow.object, titleExpression, hasCollectionEditor, options.brandStylesheet) : vueApp(schema.workflow.object, titleExpression, hasCollectionEditor, options.brandStylesheet);
  const extension = framework === 'react' ? '.tsx' : '.vue';
  files.push({ path: `src/App${extension}`, contents: app });
  if (framework === 'react') {
    imports.add('react-dom/client');
    imports.add('react-dom/server');
    files.push({ path: 'src/ssr.tsx', contents: "import React from 'react';\nimport { renderToString } from 'react-dom/server';\nimport App from './App';\nimport type { StoreOptions } from './store';\nexport function renderApp(options: StoreOptions = {}) { return renderToString(<App {...options} />); }\n" });
    files.push({ path: 'src/main.tsx', contents: mountTheme + "import React from 'react';\nimport { createRoot, hydrateRoot } from 'react-dom/client';\nimport App from './App';\nconst query = new URLSearchParams(window.location.search);\nconst root = document.getElementById('app')!;\nconst app = <App empty={query.get('mode') === 'empty'} fail={query.get('mode') === 'error'} latency={Number(query.get('latency') ?? 180)} />;\nif (root.hasChildNodes()) hydrateRoot(root, app); else createRoot(root).render(app);\n" });
  } else {
    imports.add('@vitejs/plugin-vue');
    imports.add('@vue/server-renderer');
    files.push({ path: 'src/ssr.ts', contents: "import { createSSRApp } from 'vue';\nimport { renderToString } from '@vue/server-renderer';\nimport App from './App.vue';\nimport type { StoreOptions } from './store';\nexport function renderApp(options: StoreOptions = {}) { return renderToString(createSSRApp(App, { ...options })); }\n" });
    files.push({ path: 'src/main.ts', contents: mountTheme + "import { createApp, createSSRApp } from 'vue';\nimport App from './App.vue';\nconst query = new URLSearchParams(window.location.search);\nconst root = document.getElementById('app')!;\n(root.hasChildNodes() ? createSSRApp : createApp)(App, { empty: query.get('mode') === 'empty', fail: query.get('mode') === 'error', latency: Number(query.get('latency') ?? 180) }).mount('#app');\n" });
    files.push({ path: 'vite.config.mjs', contents: "import vue from '@vitejs/plugin-vue';\nexport default { plugins: [vue()] };\n" });
  }
  files.push({ path: 'index.html', contents: `<!doctype html>\n<html lang="en"${theme === 'dark' ? ' class="dark"' : ''} data-theme="${theme}" data-brand="${brand}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${schema.workflow.object} workspace</title></head><body data-theme="${theme}" data-brand="${brand}"><div id="app"></div><script type="module" src="/src/main.${framework === 'react' ? 'tsx' : 'ts'}"></script></body></html>\n` });
  files.push({ path: 'src/app.css', contents: APP_CSS });
  files.push({ path: 'tsconfig.json', contents: JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', strict: true, jsx: 'react-jsx', esModuleInterop: true, skipLibCheck: false, noEmit: true, lib: ['ES2022', 'DOM', 'DOM.Iterable'] }, include: ['src'] }, null, 2) + '\n' });
  // s222-m03 (F5b, #2502 ruling 16): the manifest lists every package the app imports, at the catalog's exact versions,
  // as screenApp builds its own, so it holds the artifact's whole dependency list. The hand-written list left out
  // @oods/component-contracts: npm hoisted it out of components-react, and pnpm's strict layout failed the build.
  const dependencies: Record<string, string> = {};
  for (const specifier of [...imports].sort()) {
    const name = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0]!;
    const known = GENERATED_DEPENDENCY_CATALOG[name as keyof typeof GENERATED_DEPENDENCY_CATALOG];
    if (known) dependencies[name] = known.version;
  }
  files.push({ path: 'package.json', contents: JSON.stringify({ name: `${schema.workflow.object.toLowerCase()}-workflow-${framework}`, version: '1.0.0', private: true, type: 'module', engines: { node: GENERATED_APP_NODE_FLOOR }, scripts: { dev: 'vite --host 127.0.0.1', build: `${framework === 'vue' ? 'vue-tsc' : 'tsc'} --noEmit && vite build`, typecheck: `${framework === 'vue' ? 'vue-tsc' : 'tsc'} --noEmit` }, dependencies, devDependencies: { '@types/node': '20.19.21', typescript: '5.9.3', vite: '6.4.3', ...(framework === 'react' ? { '@types/react': '19.2.2', '@types/react-dom': '19.2.1' } : { 'vue-tsc': '3.3.11' }) } }, null, 2) + '\n' });
  files.push({ path: 'README.md', contents: '# Generated workflow\n\nRun `npm install`, then `npm run build` and `npm run dev`. The screens receive data and actions from src/App; src/application.ts and src/store.ts supply a local sample workflow. Connect your own data, navigation and action handlers for your application.\n\nA new generation is a complete new app and merges nothing into your app. Keep your changes in your own files, and see GENERATED-APPS.md in @oods/foundry.\n' });
  return { status: 'ok', framework, code: app, fileExtension: extension, files, imports: [...imports], actions, warnings };
}

function reactApp(object: string, titleExpression: string, hasCollectionEditor: boolean, brandStylesheet?: string): string {
  return `import React from 'react';
import { CancellationForm } from '@oods/components-react';
import { formatRecordLabel } from '@oods/component-contracts';
${CONTEXTS.map((context) => `import { GeneratedUI as ${nameOf(context)} } from './screens/${nameOf(context)}';`).join('\n')}
import { createWorkflow, screenProps, collectionEvents, routes, supplementalFields, cancellable, deferredCancellation, objectLabel, cancellationFormProps, type Screen } from './application';
import type { StoreOptions } from './store';
import './app.css';${brandStylesheet ? `\nimport './${brandStylesheet}';` : ''}
export default function App(options: StoreOptions) {
  const [app] = React.useState(() => createWorkflow(options));
  const [state, setState] = React.useState(app.snapshot);
  React.useEffect(() => { const unsubscribe = app.subscribe(setState); void app.navigate('list'); return () => { unsubscribe(); app.dispose(); }; }, [app]);
  const props = { ...screenProps(state.draft), rows: state.records.map(screenProps), events: collectionEvents(state.draft), collectionQuery: state, actions: app.actions, uiState: state.uiState };
  return <main className="workflow-app" data-oods-workflow="${object}" data-screen={state.screen} data-selected-id={state.id} data-route={routes[state.screen]} data-ui-state={state.uiState}>
    <header className="workflow-heading"><div><p className="workflow-eyebrow">${object.toUpperCase()} WORKSPACE</p><h1>{state.screen === 'list' ? '${object}s' : String(${titleExpression})}</h1></div><span className="workflow-mode">Local workspace</span></header>
    <nav aria-label="Workflow screens">{(['list', 'detail', 'form', 'timeline'] as Screen[]).map((screen) => <button type="button" key={screen} aria-current={state.screen === screen ? 'page' : undefined} onClick={() => { void app.navigate(screen); }}>{screen === 'form' ? 'Edit' : screen[0].toUpperCase() + screen.slice(1)}</button>)}</nav>
    {state.error && <p role="alert">{state.error}</p>}
    {state.uiState === 'error' && <button type="button" onClick={() => { void app.retry(); }}>Try again</button>}
    <section aria-label="${object} screen" className="workflow-content" onChangeCapture={(event) => app.edit(event.nativeEvent)} onClickCapture={(event) => app.choose(event.nativeEvent)} onKeyDownCapture={(event) => app.choose(event.nativeEvent)}>
      {state.uiState === 'success' && state.screen === 'form' && supplementalFields.map((field) => <div className="workflow-field" key={field.name}><label htmlFor={field.name}>{field.label}</label><input id={field.name} name={field.name} aria-describedby={field.name + "-help"} defaultValue={String((state.draft as Record<string, unknown>)[field.name])} /><small id={field.name + "-help"} className="oods-field-help">{field.help}</small></div>)}
      {state.uiState === 'success' && state.screen === 'detail' && cancellable && state.cancelOpen && <section className="workflow-cancel" aria-label={'Cancel ' + objectLabel}>
        <CancellationForm {...cancellationFormProps} reason={String((state.draft as Record<string, unknown>).cancellation_reason ?? '')} reasonCode={String((state.draft as Record<string, unknown>).cancellation_reason_code ?? '')} />
        {deferredCancellation && <label className="workflow-checkbox"><input name="cancel_at_period_end" type="checkbox" defaultChecked={Boolean((state.draft as Record<string, unknown>).cancel_at_period_end)} />Cancel at period end</label>}
        <button type="button" onClick={() => { void app.confirmCancellation(); }}>Confirm cancellation</button><button type="button" onClick={() => app.dismissCancellation()}>Keep {objectLabel}</button>
      </section>}
      ${CONTEXTS.map((context) => context === 'form' ? `{state.screen === 'form' && <${hasCollectionEditor ? 'div data-oods-submit-host="true" onClick={(event) => { if ((event.target as HTMLElement).closest("button[type=submit]") && !event.currentTarget.querySelector(":invalid")) app.actions.handleSubmit(); }}' : 'form'} onSubmit={(event) => { event.preventDefault(); app.actions.handleSubmit(); }}><Form {...props} key={state.revision + ':' + state.uiState} /></${hasCollectionEditor ? 'div' : 'form'}>}` : `{state.screen === '${context}' && <${nameOf(context)} {...props} key={${context === 'list' ? "'list'" : "state.revision + ':' + state.uiState"}} />}`).join('\n      ')}
      {state.uiState === 'success' && state.screen === 'detail' && Boolean((state.draft as Record<string, unknown>).is_archived) && <button onClick={() => { void app.restore(); }}>Restore record</button>}
    </section>
    <p className="workflow-notice" role="status">{state.notice}</p>
  </main>;
}
`;
}

function vueApp(object: string, titleExpression: string, hasCollectionEditor: boolean, brandStylesheet?: string): string {
  return `<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef } from 'vue';
import { CancellationForm } from '@oods/components-vue';
import { formatRecordLabel } from '@oods/component-contracts';
${CONTEXTS.map((context) => `import ${nameOf(context)} from './screens/${nameOf(context)}.vue';`).join('\n')}
import { createWorkflow, screenProps, collectionEvents, routes, supplementalFields, cancellable, deferredCancellation, objectLabel, cancellationFormProps, type Screen } from './application';
import type { StoreOptions } from './store';
import './app.css';${brandStylesheet ? `\nimport './${brandStylesheet}';` : ''}
const options = defineProps<StoreOptions>();
const app = createWorkflow(options);
const state = shallowRef(app.snapshot());
const screens: Screen[] = ['list', 'detail', 'form', 'timeline'];
const unsubscribe = app.subscribe((next) => { state.value = next; });
onMounted(() => { void app.navigate('list'); });
onUnmounted(() => { unsubscribe(); app.dispose(); });
const props = computed(() => ({ ...screenProps(state.value.draft), rows: state.value.records.map(screenProps), events: collectionEvents(state.value.draft), collectionQuery: state.value, actions: app.actions, uiState: state.value.uiState }));
const view = computed(() => ({ list: List, detail: Detail, form: Form, timeline: Timeline })[state.value.screen]);
const values = computed(() => state.value.draft as Record<string, unknown>);
</script>
<template>
  <main class="workflow-app" data-oods-workflow="${object}" :data-screen="state.screen" :data-selected-id="state.id" :data-route="routes[state.screen]" :data-ui-state="state.uiState">
    <header class="workflow-heading"><div><p class="workflow-eyebrow">${object.toUpperCase()} WORKSPACE</p><h1>{{ state.screen === 'list' ? '${object}s' : ${titleExpression} }}</h1></div><span class="workflow-mode">Local workspace</span></header>
    <nav aria-label="Workflow screens"><button v-for="screen in screens" :key="screen" type="button" :aria-current="state.screen === screen ? 'page' : undefined" @click="app.navigate(screen)">{{ screen === 'form' ? 'Edit' : screen[0].toUpperCase() + screen.slice(1) }}</button></nav>
    <p v-if="state.error" role="alert">{{ state.error }}</p><button v-if="state.uiState === 'error'" type="button" @click="app.retry()">Try again</button>
    <section aria-label="${object} screen" class="workflow-content" @input.capture="app.edit" @change="app.edit" @click.capture="app.choose" @keydown.capture="app.choose">
      <template v-if="state.uiState === 'success' && state.screen === 'form'"><div v-for="field in supplementalFields" :key="field.name" class="workflow-field"><label :for="field.name">{{ field.label }}</label><input :id="field.name" :name="field.name" :aria-describedby="field.name + '-help'" :value="values[field.name]" /><small :id="field.name + '-help'" class="oods-field-help">{{ field.help }}</small></div></template>
      <section v-if="state.uiState === 'success' && state.screen === 'detail' && cancellable && state.cancelOpen" class="workflow-cancel" :aria-label="'Cancel ' + objectLabel">
        <CancellationForm v-bind="cancellationFormProps" :reason="String(values.cancellation_reason ?? '')" :reason-code="String(values.cancellation_reason_code ?? '')" />
        <label v-if="deferredCancellation" class="workflow-checkbox"><input name="cancel_at_period_end" type="checkbox" :checked="Boolean(values.cancel_at_period_end)" />Cancel at period end</label>
        <button type="button" @click="app.confirmCancellation()">Confirm cancellation</button><button type="button" @click="app.dismissCancellation()">Keep {{ objectLabel }}</button>
      </section>
      <${hasCollectionEditor ? 'div data-oods-submit-host="true" @click="(event: MouseEvent) => { if ((event.target as HTMLElement).closest(\'button[type=submit]\') && !(event.currentTarget as HTMLElement).querySelector(\':invalid\')) app.actions.handleSubmit(); }"' : 'form'} v-if="state.screen === 'form'" @submit.prevent="app.actions.handleSubmit"><Form :key="state.revision + ':' + state.uiState" v-bind="props" /></${hasCollectionEditor ? 'div' : 'form'}><component v-else :is="view" :key="state.screen === 'list' ? 'list' : state.revision + ':' + state.uiState" v-bind="props" />
      <button v-if="state.uiState === 'success' && state.screen === 'detail' && values.is_archived" @click="app.restore()">Restore record</button>
    </section><p class="workflow-notice" role="status">{{ state.notice }}</p>
  </main>
</template>
`;
}

const APP_CSS = `:root[data-theme="light"] { color-scheme: light; }
:root[data-theme="dark"] { color-scheme: dark; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--sys-surface-canvas); color: var(--sys-text-primary); font-family: var(--sys-text-scale-body-md-font-family); font-size: var(--sys-text-scale-body-md-font-size); line-height: var(--sys-text-scale-body-md-line-height); }
.workflow-app { max-width: 68.75rem; margin: auto; padding: var(--cmp-spacing-stack-xl) var(--sys-space-inset-default); }
.workflow-heading, .workflow-pagination { display: flex; align-items: center; justify-content: space-between; gap: var(--cmp-spacing-inline-md); }
.workflow-eyebrow { margin: 0; color: var(--sys-text-secondary); font-family: var(--sys-text-scale-caption-font-family); font-size: var(--sys-text-scale-caption-font-size); font-weight: var(--sys-text-scale-caption-font-weight); line-height: var(--sys-text-scale-caption-line-height); letter-spacing: var(--sys-text-scale-caption-letter-spacing); text-transform: var(--sys-text-scale-caption-text-case); }
.workflow-heading h1 { margin: var(--cmp-spacing-stack-xs) 0 var(--cmp-spacing-stack-lg); font-family: var(--sys-text-scale-heading-xl-font-family); font-size: var(--sys-text-scale-heading-xl-font-size); font-weight: var(--sys-text-scale-heading-xl-font-weight); line-height: var(--sys-text-scale-heading-xl-line-height); letter-spacing: var(--sys-text-scale-heading-xl-letter-spacing); }
.workflow-mode { color: var(--sys-text-secondary); font-size: var(--sys-text-scale-caption-font-size); }
.workflow-app > nav { display: flex; gap: var(--sys-control-gap-tight); padding-bottom: var(--cmp-spacing-stack-lg); flex-wrap: wrap; }
.workflow-app button { cursor: pointer; font: inherit; border: 1px solid var(--sys-border-strong); padding: var(--cmp-button-padding-block-sm) var(--cmp-button-padding-inline-sm); background: var(--sys-surface-raised); border-radius: var(--cmp-button-radius); color: inherit; }
.workflow-app button:disabled { opacity: .5; cursor: default; }
.workflow-app button[aria-current="page"] { background: var(--sys-surface-interactive-primary-default); color: var(--sys-text-on-interactive); border-color: var(--sys-surface-interactive-primary-default); }
.workflow-app :focus-visible { outline: var(--cmp-focus-width) solid var(--cmp-focus-outer); outline-offset: var(--cmp-focus-offset); }
@media (forced-colors: active) {
  .workflow-app button[aria-current="page"] { background: Highlight; color: HighlightText; border-color: Highlight; outline-color: CanvasText; forced-color-adjust: none; }
}
.workflow-app label { font-family: var(--sys-text-scale-label-md-font-family); font-size: var(--sys-text-scale-label-md-font-size); font-weight: var(--sys-text-scale-label-md-font-weight); line-height: var(--sys-text-scale-label-md-line-height); }
.workflow-app input:not([type="checkbox"]), .workflow-app select { font: inherit; max-width: 100%; border: 1px solid var(--sys-border-strong); border-radius: var(--cmp-input-radius); padding: var(--cmp-input-padding-block) var(--cmp-input-padding-inline); color: inherit; background: var(--sys-surface-raised); }
.workflow-content { padding: var(--sys-space-inset-default); border: 1px solid var(--sys-border-subtle); border-radius: var(--cmp-card-radius); background: var(--sys-surface-raised); box-shadow: var(--cmp-card-shadow-offset-x) var(--cmp-card-shadow-offset-y) var(--cmp-card-shadow-blur) var(--cmp-card-shadow-spread) var(--cmp-card-shadow-color); min-width: 0; overflow-wrap: anywhere; }
.workflow-app label:has(input[type="checkbox"]) { display: flex; flex-direction: row; align-items: center; }
.workflow-field { margin-bottom: var(--cmp-spacing-stack-lg); }
.workflow-content [data-layout="inline"] { flex-wrap: wrap; gap: var(--cmp-spacing-inline-sm); }
.workflow-content [data-layout="inline"] > [data-oods-component="SearchInput"], .workflow-content [data-layout="inline"] > [data-oods-component="Select"] { flex: 1 1 180px; min-width: 0; }
.workflow-content [data-oods-component="PriceBadge"] { white-space: nowrap; }
.workflow-content textarea { font: inherit; border: 1px solid var(--sys-border-strong); border-radius: var(--cmp-input-radius); padding: var(--cmp-input-padding-block) var(--cmp-input-padding-inline); color: inherit; background: var(--sys-surface-raised); }
.workflow-content [data-oods-component="Stack"], .workflow-content [data-oods-component="Tabs"] { min-width: 0; }
.workflow-content .oods-tab, .workflow-content .oods-tab-list [aria-haspopup="menu"] { flex-shrink: 0; white-space: nowrap; }
.workflow-content .oods-tab-list { overflow: visible; }
.workflow-content .oods-tabs__overflow, .workflow-content .oods-tabs-overflow { position: relative; flex-shrink: 0; }
.workflow-content .oods-tab-list [role="menu"] { position: absolute; inset: 100% 0 auto auto; z-index: 2; min-width: max-content; }

.workflow-cancel { display: flex; gap: var(--cmp-spacing-inline-md); flex-wrap: wrap; border: 1px solid var(--sys-border-subtle); padding: var(--cmp-spacing-inset-default); margin: 0 0 var(--sys-space-inset-default); border-radius: var(--cmp-input-radius); }
.workflow-notice { min-height: var(--sys-space-stack-default); color: var(--sys-text-secondary); font-size: var(--sys-text-scale-body-sm-font-size); }
[data-oods-screen-actions] { display: flex; flex-wrap: wrap; gap: var(--cmp-spacing-stack-xs); margin-top: var(--sys-space-inset-default); }
@media (max-width: 600px) { .workflow-content [data-layout="sidebar"] { grid-template-columns: minmax(0, 1fr) !important; } .workflow-app { padding: var(--sys-space-inset-default) var(--cmp-spacing-inset-default); } .workflow-content { padding: var(--cmp-spacing-inset-default); } .workflow-heading h1 { font-size: var(--sys-text-scale-heading-lg-font-size); } .workflow-mode { display: none; } }
`;
