/**
 * s223-m02 (#2527 rulings 12 and 13a): a field whose semantics ask for a control (ui_hints.component) is edited by it, and
 * codegen binds it: a Switch as Checkbox binds (the record's boolean), a SegmentedControl and a Combobox as Select binds
 * (an enum's value, with its options). The form reads the record's value, writes it back on each change, and a generated
 * workflow saves it. The composer's defaults do not move: a field that asks for nothing, or for a control that cannot
 * edit it, keeps its Checkbox, Select or Input.
 *
 * Until the structured-data registry and the capability ledger list SegmentedControl and Combobox (the lead's refresh),
 * design.compose reports them as unregistered (OODS-V006) and code.generate refuses them (OODS-V119, OODS-N015). Those
 * checks are not this mission's: the placement is asserted on the composed schema, allowing only those two registry
 * errors, and their code is written by the emitters directly, as code.generate calls them.
 *
 * The same round trips in a browser are test/product-reality/switch-dialog-address.s223.spec.ts.
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { Window } from 'happy-dom';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { clearObjectCache } from '../../src/objects/object-loader.js';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { emit as emitReact } from '../../src/codegen/react-emitter.js';
import { emit as emitVue } from '../../src/codegen/vue-emitter.js';
import { emit as emitHtml } from '../../src/codegen/html-emitter.js';
import { typecheckWorkflow } from '../product-reality/workflow-typecheck.js';
import type { UiElement, UiSchema } from '../../src/schemas/generated.js';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const fixture = (name: string) => fs.readFileSync(path.join(root, 'packages/mcp-server/test/fixtures/team-definitions', name), 'utf8');
const ALERT_RULE = fixture('AlertRule.object.yaml');
const NOTIFICATION_ROUTE = fixture('NotificationRoute.object.yaml');
/** NotificationRoute with its two asks taken out: the composer's own Selects, which the asks replace. */
const ROUTE_WITHOUT_ASKS = NOTIFICATION_ROUTE.replace('    ui_hints:\n      component: SegmentedControl\n', '').replace('    ui_hints:\n      component: Combobox\n', '');
const options = { typescript: true, styling: 'tokens' as const };
type Artifact = { framework: string; files: Array<{ path: string; contents: string }> };

const nodes = (elements: readonly UiElement[]): UiElement[] => elements.flatMap(node => [node, ...nodes(node.children ?? [])]);
const editors = (schema: UiSchema, field: string) => nodes(schema.screens).filter(node => node.props?.field === field && ['Input', 'Select', 'Checkbox', 'Switch', 'SegmentedControl', 'Combobox'].includes(node.component));

let home: string;
const team = (...documents: Array<[string, string]>) => {
  fs.rmSync(path.join(home, 'objects'), { recursive: true, force: true });
  fs.mkdirSync(path.join(home, 'objects'), { recursive: true });
  for (const [name, yaml] of documents) fs.writeFileSync(path.join(home, 'objects', `${name}.object.yaml`), yaml);
  clearObjectCache();
};
const composed = async (object: string, context: string, registered = true) => {
  const result = await compose({ object, context, options: { transient: true } } as never) as { status: string; schema: UiSchema; errors?: Array<{ code: string; message: string }> };
  if (registered) expect(result.status, JSON.stringify(result.errors)).toBe('ok');
  // Until the registry refresh lists them, the only problems the two new components may raise are the registry's own.
  else for (const error of result.errors ?? []) expect(error.code === 'OODS-V006' && /'(SegmentedControl|Combobox)'/.test(error.message), JSON.stringify(error)).toBe(true);
  return result.schema;
};

beforeAll(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-s223-controls-'));
  process.env.OODS_OBJECTS_DIR = path.join(home, 'objects');
  process.env.MCP_SCHEMA_STORE_ROOT = home;
  team(['AlertRule', ALERT_RULE], ['NotificationRoute', NOTIFICATION_ROUTE]);
});
afterAll(() => {
  delete process.env.OODS_OBJECTS_DIR;
  delete process.env.MCP_SCHEMA_STORE_ROOT;
  clearObjectCache();
  fs.rmSync(home, { recursive: true, force: true });
});

describe('a field is edited by the control its semantics ask for (s223-m02)', () => {
  it('composes a Switch for the boolean that asks, bound as the field\'s writer, beside an enum\'s default Select', async () => {
    const schema = await composed('AlertRule', 'form');
    expect(editors(schema, 'enabled').map(node => ({ component: node.component, label: node.props?.label, bindings: node.bindings })))
      .toEqual([{ component: 'Switch', label: 'Enabled', bindings: { onChange: 'handleChange_enabled' } }]);
    expect(editors(schema, 'severity').map(node => node.component)).toEqual(['Select']);
  });

  it('composes a SegmentedControl and a Combobox for the enums that ask, with their options and writers', async () => {
    const schema = await composed('NotificationRoute', 'form', false);
    const [severity, channel] = [editors(schema, 'severity'), editors(schema, 'channel')];
    expect(severity.map(node => ({ component: node.component, bindings: node.bindings }))).toEqual([{ component: 'SegmentedControl', bindings: { onChange: 'handleChange_severity' } }]);
    expect(channel.map(node => ({ component: node.component, bindings: node.bindings }))).toEqual([{ component: 'Combobox', bindings: { onChange: 'handleChange_channel' } }]);
    expect(severity[0]!.props?.options).toEqual([{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }]);
    expect((channel[0]!.props?.options as unknown[]).length).toBe(6);
    // Each carries only what its contract has: a Combobox shows the field's description as help, a SegmentedControl has none.
    expect(channel[0]!.props?.help).toBe('Where the route\'s alerts are sent.');
    expect(severity[0]!.props?.help).toBeUndefined();
  });

  it('keeps the composer\'s defaults when a field asks for nothing, or for a control that cannot edit it', async () => {
    const product = await composed('Product', 'form');
    expect(editors(product, 'requires_subscription').map(node => node.component)).toEqual(['Checkbox']);
    // A display hint places no control; a Switch cannot edit an enum, a SegmentedControl holds at most five options, and
    // a Combobox needs an enum's options to pick from.
    team(
      ['AlertRule', ALERT_RULE.replace('      component: Switch\n', '      component: BooleanBadge\n')
        .replace('\nsemantics:\n', '\nsemantics:\n  severity:\n    semantic_type: monitoring.alert.severity\n    ui_hints:\n      component: Switch\n')],
      ['NotificationRoute', ROUTE_WITHOUT_ASKS
        .replace('    semantic_type: monitoring.route.channel\n', '    semantic_type: monitoring.route.channel\n    ui_hints:\n      component: SegmentedControl\n')
        .replace('    semantic_type: monitoring.route.name\n', '    semantic_type: monitoring.route.name\n    ui_hints:\n      component: Combobox\n')],
    );
    try {
      const alert = await composed('AlertRule', 'form');
      expect(editors(alert, 'enabled').map(node => node.component)).toEqual(['Checkbox']);
      expect(editors(alert, 'severity').map(node => node.component)).toEqual(['Select']);
      const route = await composed('NotificationRoute', 'form');
      expect(editors(route, 'channel').map(node => node.component)).toEqual(['Select']);
      expect(editors(route, 'name').map(node => node.component)).toEqual(['Input']);
    } finally { team(['AlertRule', ALERT_RULE], ['NotificationRoute', NOTIFICATION_ROUTE]); }
  });
});

describe('codegen binds each control to the record\'s value (s223-m02)', () => {
  it('binds the Switch to the record\'s boolean in React and Vue, and carries its value in HTML', async () => {
    const schema = await composed('AlertRule', 'form');
    const react = await generate({ schema, framework: 'react', profile: 'build' } as never) as { status: string; code: string; errors?: unknown };
    expect(react.status, JSON.stringify(react.errors)).toBe('ok');
    // The form starts from the record's value and keeps each toggle: React's Switch reports the checked value it turns
    // to through onCheckedChange, the boolean Checkbox's handler reads from its change event.
    expect(react.code).toContain('React.useState<boolean>(enabled ?? false)');
    expect(react.code).toContain('const handleChange_enabled = (checked: boolean) => { setHandleChange_enabledState(checked); };');
    expect(react.code).toMatch(/<Switch [^>]*label="Enabled" checked=\{handleChange_enabledState\} onCheckedChange=\{handleChange_enabled\} \/>/);
    expect(react.code).not.toMatch(/<Switch [^>]*onChange=/);
    const vue = await generate({ schema, framework: 'vue', profile: 'build' } as never) as { status: string; code: string; errors?: unknown };
    expect(vue.status, JSON.stringify(vue.errors)).toBe('ok');
    expect(vue.code).toContain('const handleChange_enabledState = ref<boolean>(enabled.value ?? false);');
    expect(vue.code).toMatch(/<Switch [^>]*:modelValue="handleChange_enabledState" @update:modelValue="setHandleChange_enabledState" @change="handleChange_enabled" \/>/);
    const html = await generate({ schema, framework: 'html', profile: 'build' } as never) as { status: string; code: string; errors?: unknown };
    expect(html.status, JSON.stringify(html.errors)).toBe('ok');
    // The shown record is enabled: the switch reads on, its form value is "true", and its runtime follows it.
    const control = html.code.match(/<div class="oods-field oods-switch"[^>]*>.*?<\/div><script data-oods-runtime="switch">/s)?.[0] ?? '';
    expect(control).toContain('role="switch" class="oods-switch__control" aria-checked="true"');
    expect(control).toContain('<input type="hidden" name="enabled" value="true">');
  });

  it('binds the SegmentedControl and the Combobox to the record\'s enum values as Select binds', async () => {
    const schema = await composed('NotificationRoute', 'form', false);
    const react = emitReact(schema, options);
    expect(react.status, JSON.stringify(react.errors)).toBe('ok');
    // SegmentedControl's onChange is its radios' change event, read like Select's; a Combobox's input holds the filter
    // text, so its pick arrives through onValueChange as the value itself.
    expect(react.code).toContain('React.useState<string>(String(severity ?? \'\'))');
    expect(react.code).toContain('const handleChange_severity = (event: React.ChangeEvent<HTMLInputElement>) => { setHandleChange_severityState(event.currentTarget.value); };');
    expect(react.code).toMatch(/<SegmentedControl [^>]*options=\{\[\{"value":"low","label":"Low"\},[^>]*value=\{handleChange_severityState\} onChange=\{handleChange_severity\} \/>/);
    expect(react.code).toContain('const handleChange_channel = (value: string) => { setHandleChange_channelState(value); };');
    expect(react.code).toMatch(/<Combobox [^>]*value=\{handleChange_channelState\} onValueChange=\{handleChange_channel\} \/>/);
    expect(react.code).not.toMatch(/<Combobox [^>]*onChange=/);
    const vue = emitVue(schema, options);
    expect(vue.status, JSON.stringify(vue.errors)).toBe('ok');
    expect(vue.code).toMatch(/<SegmentedControl [^>]*:modelValue="handleChange_severityState" @update:modelValue="setHandleChange_severityState" @change="handleChange_severity" \/>/);
    expect(vue.code).toMatch(/<Combobox [^>]*:modelValue="handleChange_channelState" @update:modelValue="setHandleChange_channelState" @change="handleChange_channel" \/>/);
    const html = emitHtml(schema, { ...options, sampleModel: { name: 'Checkout on-call', severity: 'high', channel: 'pagerduty' } } as never);
    expect(html.status).toBe('ok');
    // The record's values are the checked radio and the chosen option, and both carry the field's form name.
    expect(html.code).toMatch(/<input type="radio" class="oods-segmented-control__input" name="severity" value="high" checked>/);
    expect(html.code).toMatch(/role="combobox"[^>]* value="Pagerduty"/);
    expect(html.code).toContain('<input type="hidden" name="channel" value="pagerduty">');
  });
});

describe('a generated workflow saves each control\'s value (s223-m02)', () => {
  const artifacts = new Map<string, Artifact>();
  beforeAll(async () => {
    const alert = await composed('AlertRule', 'workflow');
    for (const framework of ['react', 'vue']) {
      const result = await generate({ schema: alert, framework, profile: 'build' } as never) as { status: string; artifact?: Artifact; errors?: unknown };
      expect(result.status, JSON.stringify(result.errors)).toBe('ok');
      artifacts.set(`AlertRule:${framework}`, result.artifact!);
    }
    // NotificationRoute's workflow with the composer's Selects, and the two asks applied to its form as the composer
    // applies them (the form test above): what the workflow composes once the registry lists the two controls.
    team(['AlertRule', ALERT_RULE], ['NotificationRoute', ROUTE_WITHOUT_ASKS]);
    const route = await composed('NotificationRoute', 'workflow');
    team(['AlertRule', ALERT_RULE], ['NotificationRoute', NOTIFICATION_ROUTE]);
    const form = route.screens.find(screen => screen.id === 'form-screen')!;
    for (const node of nodes([form])) {
      // As the composer places them: a SegmentedControl takes no help (its contract has none).
      if (node.component === 'Select' && node.props?.field === 'severity') { node.component = 'SegmentedControl'; delete node.props.help; }
      if (node.component === 'Select' && node.props?.field === 'channel') node.component = 'Combobox';
    }
    expect(nodes([form]).filter(node => ['SegmentedControl', 'Combobox'].includes(node.component))).toHaveLength(2);
    for (const [framework, emit] of [['react', emitReact], ['vue', emitVue]] as const) {
      const result = emit(route, options) as { status: string; files?: Artifact['files']; errors?: unknown };
      expect(result.status, JSON.stringify(result.errors)).toBe('ok');
      artifacts.set(`NotificationRoute:${framework}`, { framework, files: result.files! });
    }
  }, 120_000);

  it.each(['AlertRule:react', 'AlertRule:vue', 'NotificationRoute:react', 'NotificationRoute:vue'])('%s compiles strictly against the controls\' published props and events', key => {
    // A Switch and a Combobox have no onChange prop in React (their props omit it): a binding written there would not compile.
    const result = typecheckWorkflow(artifacts.get(key)! as never);
    expect(result.status, result.stdout + result.stderr).toBe(0);
  }, 90_000);

  /** The app's store and workflow modules, run in a DOM: the form's markup is what each control renders. */
  async function runWorkflow(key: string, prepare: (seed: any[]) => void, body: (context: { app: any; seed: any[]; window: Window; document: any }) => Promise<void>) {
    const artifact = artifacts.get(key)!;
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'oods-s223-controls-app-'));
    const window = new Window();
    const globals = ['Element', 'HTMLButtonElement', 'HTMLInputElement', 'HTMLSelectElement', 'HTMLTextAreaElement', 'KeyboardEvent', 'document'] as const;
    const saved = Object.fromEntries(globals.map(name => [name, (globalThis as Record<string, unknown>)[name]]));
    try {
      fs.writeFileSync(path.join(directory, 'package.json'), '{"type":"commonjs"}\n');
      for (const file of artifact.files.filter(file => /^src\/(store|sample-data|application|actions)\.ts$/.test(file.path))) {
        fs.writeFileSync(path.join(directory, path.basename(file.path, '.ts') + '.js'), ts.transpileModule(file.contents, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText);
      }
      fs.mkdirSync(path.join(directory, 'node_modules/@oods'), { recursive: true });
      fs.symlinkSync(path.join(root, 'packages/component-contracts'), path.join(directory, 'node_modules/@oods/component-contracts'), 'junction');
      for (const name of globals) (globalThis as Record<string, unknown>)[name] = window[name];
      const req = createRequire(path.join(directory, 'entry.cjs'));
      const { createWorkflow } = req('./application.js');
      const seed = structuredClone(req('./sample-data.js').sampleData);
      prepare(seed);
      const app = createWorkflow({ seed, latency: 0 });
      await body({ app, seed, window, document: window.document });
      app.dispose();
    } finally {
      for (const name of globals) (globalThis as Record<string, unknown>)[name] = saved[name];
      await window.happyDOM.close();
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
  const save = async (app: any) => { app.actions.handleSubmit(); await new Promise(resolve => setTimeout(resolve, 30)); expect(app.snapshot().screen).toBe('detail'); };

  it('saves the value a Switch turns to, read from its click before it repaints', () => runWorkflow('AlertRule:react', seed => { seed[0].enabled = true; }, async ({ app, seed, window, document }) => {
    const switchId = artifacts.get('AlertRule:react')!.files.find(file => file.path === 'src/screens/Form.tsx')!.contents.match(/<Switch id="([^"]+)"/)![1];
    await app.navigate('form', seed[0].alert_rule_id);
    expect(app.snapshot().draft.enabled).toBe(true);
    document.body.innerHTML = `<section><div class="oods-field oods-switch"><div class="oods-switch__row"><button id="${switchId}" type="button" role="switch" aria-checked="true"><span class="oods-switch__thumb"></span></button><label for="${switchId}">Enabled</label></div></div><button type="submit">Save</button></section>`;
    document.querySelector('section').addEventListener('click', (event: Event) => app.choose(event), true);
    const click = (element: Element) => element.dispatchEvent(new window.MouseEvent('click', { bubbles: true }) as unknown as Event);
    click(document.querySelector('button[type="submit"]'));
    expect(app.snapshot().draft.enabled).toBe(true);
    click(document.querySelector('.oods-switch__thumb'));
    expect(app.snapshot().draft.enabled).toBe(false);
    await save(app);
    expect(app.snapshot().draft.enabled).toBe(false);
    await app.navigate('form');
    expect(app.snapshot().draft.enabled).toBe(false);
  }));

  it('saves a SegmentedControl\'s checked radio and a Combobox\'s pick, never the text typed to filter it', () => runWorkflow('NotificationRoute:react', seed => { seed[0].severity = 'low'; seed[0].channel = 'email'; }, async ({ app, seed, window, document }) => {
    const form = artifacts.get('NotificationRoute:react')!.files.find(file => file.path === 'src/screens/Form.tsx')!.contents;
    const [segmentedId, comboboxId] = [form.match(/<SegmentedControl id="([^"]+)"/)![1], form.match(/<Combobox id="([^"]+)"/)![1]];
    await app.navigate('form', seed[0].notification_route_id);
    expect([app.snapshot().draft.severity, app.snapshot().draft.channel]).toEqual(['low', 'email']);
    document.body.innerHTML = `<section>`
      + `<div class="oods-field oods-segmented-control"><div id="${segmentedId}" role="radiogroup">${['low', 'medium', 'high'].map(value => `<label><input type="radio" name="${segmentedId}" value="${value}"${value === 'low' ? ' checked' : ''}></label>`).join('')}</div></div>`
      + `<div class="oods-field oods-combobox" data-oods-component="Combobox"><input id="${comboboxId}" type="text" role="combobox" aria-expanded="true" value="pag"><ul role="listbox">${['email', 'slack', 'pagerduty'].map((value, index) => `<li id="${comboboxId}-option-${index}" role="option" data-value="${value}">${value}</li>`).join('')}</ul></div></section>`;
    const section = document.querySelector('section');
    for (const type of ['input', 'change']) section.addEventListener(type, (event: Event) => app.edit(event), true);
    for (const type of ['click', 'keydown']) section.addEventListener(type, (event: Event) => app.choose(event), true);
    // A radio's change is a native edit.
    const high = document.querySelector('input[value="high"]');
    high.checked = true;
    high.dispatchEvent(new window.Event('change', { bubbles: true }) as unknown as Event);
    expect(app.snapshot().draft.severity).toBe('high');
    // Typing in the combobox filters its list; the record keeps its value.
    const input = document.getElementById(comboboxId);
    input.dispatchEvent(new window.Event('input', { bubbles: true }) as unknown as Event);
    expect(app.snapshot().draft.channel).toBe('email');
    // Enter on the active option picks it, as does a click on an option.
    input.setAttribute('aria-activedescendant', `${comboboxId}-option-2`);
    input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }) as unknown as Event);
    expect(app.snapshot().draft.channel).toBe('pagerduty');
    document.getElementById(`${comboboxId}-option-1`).dispatchEvent(new window.MouseEvent('click', { bubbles: true }) as unknown as Event);
    expect(app.snapshot().draft.channel).toBe('slack');
    // Escape with the list closed clears the choice.
    input.setAttribute('aria-expanded', 'false');
    input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }) as unknown as Event);
    expect(app.snapshot().draft.channel).toBe('');
    document.getElementById(`${comboboxId}-option-2`).dispatchEvent(new window.MouseEvent('click', { bubbles: true }) as unknown as Event);
    await save(app);
    expect([app.snapshot().draft.severity, app.snapshot().draft.channel]).toEqual(['high', 'pagerduty']);
    await app.navigate('form');
    expect([app.snapshot().draft.severity, app.snapshot().draft.channel]).toEqual(['high', 'pagerduty']);
  }));
});
