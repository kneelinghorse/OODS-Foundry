import { createHash, randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { chromium, type Browser, type Page } from 'playwright-core';
import { componentContracts, sharedScenarios, substitutionContractReport, summarizeSubstitutionReport, type SubstitutionContractReport, type SharedScenario } from '@oods/component-contracts';
import { inspectComponentPackages } from './component-packages.js';
import { compileArtifact } from './compile.js';
import type { PreviewArtifact } from './store.js';
import type { PreviewRuntime } from './runtime.js';
import { scriptJson } from './page.js';

type Identity = Pick<SubstitutionContractReport, 'framework' | 'mappingId' | 'component' | 'source'>;
type Request = { identity: Identity; artifact: PreviewArtifact; contractContentHash: string; localPath?: string; shadcn?: import('./shadcn.js').ShadcnClosure };
const reason = (error: unknown) => error instanceof Error ? error.message : String(error);

/** Each request runs in a fresh browser context. The host serves only a random, short-lived fixture URL. */
export function registerComponentContractChecks(server: FastifyInstance, runtime: PreviewRuntime, base: string): void {
  const reports = new Map<string, SubstitutionContractReport>();
  const sessions = new Map<string, { html: string; code: string }>();
  server.get<{ Params: { id: string; file: string } }>(`${base}/contract-session/:id/:file`, async (request, reply) => {
    const session = sessions.get(request.params.id);
    if (!session) return reply.code(404).send('Contract session expired');
    if (request.params.file === 'module.js') return reply.type('application/javascript').send(session.code);
    if (request.params.file === 'index.html') return reply.type('text/html').send(session.html);
    return reply.code(404).send('Unknown contract resource');
  });
  server.post<{ Body: Request }>(`${base}/component-contracts`, async (request, reply) => {
    const { identity, artifact, localPath, shadcn, contractContentHash } = request.body;
    const contract = Object.values(componentContracts).find(row => row.id === identity?.component);
    const scenario = sharedScenarios.find(row => row.oodsComponentId === identity?.component);
    if (!contract || !scenario || !['react', 'vue'].includes(identity?.framework)) return reply.code(400).send({ message: 'Unknown component contract or framework' });
    let report = substitutionContractReport(identity, 'No executable probe for this declared obligation; it is not inferred from mounting.');
    const expectedHash = `sha256:${createHash('sha256').update(JSON.stringify({ contract, scenario })).digest('hex')}`;
    if (expectedHash !== contractContentHash) return reply.code(409).send({ message: 'Server and preview host contract definitions differ; rebuild/restart them together.' });
    let browser: Browser | undefined;
    let cacheKey: string | undefined;
    const id = randomBytes(16).toString('hex');
    try {
      const packages = inspectComponentPackages([{ framework: identity.framework, specifier: identity.source.shadcn?.module ?? identity.source.package!, version: identity.source.shadcn?.closureHash ?? identity.source.version!, localPath, shadcn }]);
      cacheKey = `${artifact.contentHash}:${expectedHash}:${packages[0]!.contentHash}`;
      const cached = reports.get(cacheKey);
      if (cached) return structuredClone(cached);
      report.source = { ...identity.source, packageContentHash: packages[0]!.contentHash };
      report.adapterContentHash = artifact.contentHash; report.contractContentHash = contractContentHash;
      const compiled = await compileArtifact(artifact, { componentPackages: packages, runtimeImports: Object.keys(runtime.manifest.importMap) });
      const imports = { imports: Object.fromEntries(Object.entries(runtime.manifest.importMap).map(([name, file]) => [name, `${base}/runtime/${file}`])) };
      const mount = identity.framework === 'react'
        ? `import React from 'react'; import {createRoot} from 'react-dom/client'; import {GeneratedUI} from './module.js'; createRoot(document.getElementById('scenario')).render(React.createElement(GeneratedUI));`
        : `import {createApp} from 'vue'; import GeneratedUI from './module.js'; createApp(GeneratedUI).mount('#scenario');`;
      sessions.set(id, { code: compiled.code, html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><script type="importmap">${scriptJson(imports)}</script></head><body><button id="before">Before scenario</button><main id="scenario"></main><script type="module">${mount}</script></body></html>` });
      browser = process.env.OODS_PLAYWRIGHT_WS_ENDPOINT
        ? await chromium.connect(process.env.OODS_PLAYWRIGHT_WS_ENDPOINT, { exposeNetwork: '<loopback>', timeout: 10_000 })
        : await chromium.launch({ headless: true, ...(process.env.OODS_CONTRACT_BROWSER_EXECUTABLE ? { executablePath: process.env.OODS_CONTRACT_BROWSER_EXECUTABLE } : {}), timeout: 10_000 });
      const page = await browser.newPage(); page.setDefaultTimeout(1500);
      const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
      const port = (server.server.address() as { port: number }).port;
      await page.goto(`http://127.0.0.1:${port}${base}/contract-session/${id}/index.html`, { waitUntil: 'networkidle', timeout: 15_000 });
      report.checkedAt = new Date().toISOString(); report.browser = `Chromium ${browser.version()}`;
      report = await measure(page, report, scenario, errors);
    } catch (error) {
      const message = `Real-browser check unavailable: ${reason(error).slice(0, 900)}`;
      for (const row of report.obligations) if (row.status === 'not-checked') row.reason = message;
    } finally { sessions.delete(id); await browser?.close(); }
    report = summarizeSubstitutionReport(report);
    if (cacheKey && report.checkedAt) reports.set(cacheKey, structuredClone(report));
    return report;
  });
}

async function measure(page: Page, report: SubstitutionContractReport, scenario: SharedScenario, errors: string[]): Promise<SubstitutionContractReport> {
  const contract = Object.values(componentContracts).find(row => row.id === report.component)!;
  const set = (id: string, met: boolean, detail: string) => {
    const row = report.obligations.find(row => row.id === id);
    if (row) { row.status = !met || row.status === 'unmet' ? 'unmet' : 'met'; row.reason = row.reason.startsWith('No executable') ? detail : `${row.reason} ${detail}`; }
  };
  const root = page.locator('#scenario');
  const mounted = await root.locator(':scope > *').count() > 0 && errors.length === 0;
  set('scenario:props', mounted, mounted ? 'Shared scenario props and slots mounted through the generated adapter without browser errors.' : `No mounted component or browser errors: ${errors.join('; ')}`);
  if (!mounted) return report;
  const target = contract.name?.target === ':root' ? root : root.locator(contract.name?.target ?? ':scope');
  const exists = await target.count() > 0;
  if (contract.role !== 'none') {
    const semantic = root.getByRole(contract.role as Parameters<Page['getByRole']>[0]);
    set('role', exists && await semantic.count() > 0, `Observed ${await semantic.count()} elements with role ${contract.role}.`);
  } else set('role', await root.locator('button,input,select,textarea,a[href],[tabindex="0"]').count() === 0, 'The shared noninteractive scenario must expose no owned focusable control.');
  if (contract.name?.strategy !== 'none') {
    const name = exists ? await target.first().evaluate(element => {
      const labels = (element as HTMLInputElement).labels;
      return labels?.length ? Array.from(labels).map(label => { const copy = label.cloneNode(true) as HTMLElement; copy.querySelectorAll('[aria-hidden="true"]').forEach(node => node.remove()); return copy.textContent; }).join(' ').trim() : (element.getAttribute('aria-label') ?? element.textContent ?? '').trim();
    }) : '';
    set('name', name.length > 0, `Observed accessible label text: ${JSON.stringify(name)}.`);
  } else set('name', true, 'The shared contract explicitly declares no owned accessible-name requirement.');
  const reload = async () => { await page.reload({ waitUntil: 'networkidle' }); };
  for (const [index, trigger] of scenario.event.entries()) {
    let success = false, detail = '';
    try {
      await reload();
      const control = root.locator(trigger.target).first();
      if (!await control.count()) throw new Error(`Missing shared scenario target ${trigger.target}`);
      if (trigger.trigger === 'keyboard') {
        if (trigger.key === 'Tab') {
          await page.locator('#before').focus();
          for (let step = 0; step < 30; step++) { await page.keyboard.press('Tab'); if (await control.evaluate(element => element === document.activeElement)) break; }
        } else {
          await control.focus();
          // s223-m02 (#2527 ruling 11): keys a trigger needs first, such as ArrowDown before a combobox's Enter.
          for (const key of trigger.keys ?? []) await page.keyboard.press(key);
          if (trigger.key === 'x') await page.keyboard.press('End');
          await page.keyboard.press(trigger.key === ' ' ? 'Space' : trigger.key!);
        }
      } else if (trigger.action === 'select') await control.selectOption(trigger.value!);
      else await control.click();
      // Compound controls such as Radix Tabs schedule their focus/selection effects after the key event.
      // Wait for the actual declared effect, never infer success from dispatching the key.
      const eventName = report.component === 'Input' ? 'update' : contract.events[0];
      const effect = trigger.effect;
      if (effect.kind === 'selected-tab') await page.waitForFunction(({ target, value, eventName }) => {
        const tab = document.querySelector('#scenario')?.querySelector(target);
        const observed = ((globalThis as any).__oodsScenario.calls as Array<{ event: string; value?: unknown }>).filter(call => call.event === eventName);
        return tab?.getAttribute('aria-selected') === 'true' && tab === document.activeElement && observed.length === 1 && JSON.stringify(observed[0]?.value) === JSON.stringify(value);
      }, { target: effect.target!, value: effect.value, eventName }, { timeout: 1500 });
      const calls = await page.evaluate(() => (globalThis as any).__oodsScenario.calls as Array<{event:string;value?:unknown}>);
      const observed = calls.filter(call => call.event === eventName);
      if (effect.kind === 'focus') success = await control.evaluate(element => element === document.activeElement);
      else if (effect.kind === 'value') success = await control.inputValue() === effect.value;
      else if (effect.kind === 'selected-tab') success = await root.locator(effect.target!).getAttribute('aria-selected') === 'true' && await root.locator(effect.target!).evaluate(element => element === document.activeElement) && observed.length === 1 && JSON.stringify(observed[0]?.value) === JSON.stringify(effect.value);
      // s223-m02: the list is open, the named option is active, focus stayed on the control, and nothing was picked.
      else if (effect.kind === 'active-option') success = await control.getAttribute('aria-expanded') === 'true'
        && await control.evaluate(element => { const id = element.getAttribute('aria-activedescendant'); return (id ? document.getElementById(id)?.textContent : null) ?? null; }) === effect.value
        && await control.evaluate(element => element === document.activeElement) && observed.length === 0;
      else success = observed.length === 1 && (!('value' in effect) || JSON.stringify(observed[0]?.value) === JSON.stringify(effect.value));
      detail = `Real ${trigger.trigger} ${[...(trigger.keys ?? []), trigger.key ?? trigger.action].join(' then ')}; expected ${JSON.stringify(effect)}; events ${JSON.stringify(calls)}.`;
      if (effect.kind === 'event' && eventName) set(`event:${eventName}`, success, detail);
      if (effect.kind === 'focus') set('state:focus', success, detail);
    } catch (error) { detail = reason(error); }
    set(`scenario:event:${index}`, success, detail);
    if (trigger.key) set(`keyboard:${trigger.key}`, success, detail);
  }
  await reload();
  if (report.component === 'Button') {
    const button = root.locator('button');
    const named = await root.getByRole('button', { name: 'Save changes' }).count() === 1;
    set('slot:default', named, 'The shared default slot must name Save changes.');
    set('accessibility:Native button semantics', await button.count() === 1, 'The mounted shared scenario must contain one native button.');
    set('accessibility:Defaults to type=button', await button.count() === 1 && await button.getAttribute('type') === 'button', 'The default type attribute is read from the real DOM.');
    const activated = report.obligations.filter(row => row.id.startsWith('scenario:event:') && row.requirement.includes('"kind":"event"')).every(row => row.status === 'met');
    set('scenario:render', named && activated, 'The named button activates exactly once for each shared pointer/keyboard trigger.');
    const nativeButton = await button.count() === 1;
    scenario.assertions.forEach((assertion, index) => { if (/button semantics/i.test(assertion)) set(`scenario:assertion:${index}`, nativeButton, 'Native button inspected.'); else if (/name|label/i.test(assertion)) set(`scenario:assertion:${index}`, named, 'Save changes is the accessible button name.'); });
  } else if (report.component === 'Input') {
    const input = root.locator('input');
    if (await input.count()) {
      const data = await input.evaluate(element => { const input = element as HTMLInputElement; return { id: input.id, label: Array.from(input.labels ?? []).map(label => { const copy = label.cloneNode(true) as HTMLElement; copy.querySelectorAll('[aria-hidden="true"]').forEach(node => node.remove()); return copy.textContent; }).join(' '), type: input.type, value: input.value, required: input.required, invalid: input.getAttribute('aria-invalid'), description: (input.getAttribute('aria-describedby') ?? '').split(' ').map(id => document.getElementById(id)?.textContent ?? '').join(' ') }; });
      for (const name of ['id', 'label', 'type', 'value', 'required'] as const) set(`prop:${name}`, data[name] === scenario.props[name], `Native field ${name}: ${JSON.stringify(data[name])}.`);
      const help = data.description.includes(String(scenario.props.help)), validation = data.invalid === 'true' && data.description.includes('Enter a valid email');
      set('prop:help', help, `Associated description: ${data.description}`); set('prop:validation', validation, `aria-invalid=${data.invalid}; associated description: ${data.description}`);
      set('state:invalid', validation, 'Invalid state has aria-invalid and an associated error.');
      set('accessibility:Native input semantics', true, 'Native input is present.');
      set('accessibility:Label and help/error descriptions are programmatically associated', data.label === scenario.props.label && help && validation, 'Read actual labels and aria-describedby target text.');
      [data.label === scenario.props.label, validation, data.invalid === 'true'].forEach((met, index) => set(`scenario:assertion:${index}`, met, 'Measured the shared input label/error/invalid assertion in the real DOM.'));
      await input.fill('user@example.com'); await page.locator('#before').focus();
      const calls = await page.evaluate(() => (globalThis as any).__oodsScenario.calls as Array<{event:string;value?:unknown}>);
      for (const name of contract.events) set(`event:${name}`, calls.some(call => call.event === name && call.value === 'user@example.com'), `Input fill and blur events: ${JSON.stringify(calls)}.`);
      set('scenario:render', calls.some(call => call.event === 'update' && call.value === 'user@example.com'), 'Shared replacement value user@example.com must be emitted.');
    }
  } else if (report.component === 'StatusBadge') {
    const text = await root.innerText(); const readable = /past due/i.test(text) && !/past_due/.test(text);
    set('prop:status', readable, `Visible status: ${JSON.stringify(text)}.`);
    set('scenario:render', readable, 'The shared past_due scenario must expose human-readable Past due text.');
    for (const [index] of scenario.assertions.entries()) set(`scenario:assertion:${index}`, readable, 'Visible human-readable status carries meaning without relying on color.');
    for (const obligation of contract.accessibility) set(`accessibility:${obligation}`, readable, 'Visible human-readable status carries meaning without relying on color.');
  }
  if (contract.props.includes('disabled')) {
    await reload();
    await page.evaluate(props => (globalThis as any).__oodsScenario.setProps(props), { ...scenario.props, disabled: true });
    await page.waitForTimeout(50);
    const control = root.locator(contract.name?.target ?? 'button,input').first();
    const disabled = await control.count() > 0 && await control.isDisabled();
    set('prop:disabled', disabled, 'The rendered native control must expose disabled semantics.'); set('state:disabled', disabled, 'Disabled variant is mounted and its native disabled state is inspected.');
  }
  return report;
}
