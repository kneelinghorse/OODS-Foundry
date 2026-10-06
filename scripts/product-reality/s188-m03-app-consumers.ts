import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from 'playwright';
import { handle as compose } from '../../packages/mcp-server/src/tools/design.compose.js';
import { fieldLabel } from '../../packages/mcp-server/src/compose/label-generator.js';
import { recordTitleField } from '../../packages/mcp-server/src/compose/record-label.js';
import { schemaNodes } from './s185-m04-consumer-contract.js';
import type { UiSchema } from '../../packages/mcp-server/src/schemas/generated.js';
import { isTraitRecipe } from '../../packages/mcp-server/src/compose/trait-recipes.js';
import { handle as generate } from '../../packages/mcp-server/src/tools/code.generate.js';
import { validateGeneratedArtifact } from '../../packages/mcp-server/src/codegen/artifact-envelope.js';
import { workflowSampleRecords } from '../../packages/mcp-server/src/codegen/workflow-data-emitter.js';
import { formatRecordLabel } from '../../packages/component-contracts/src/date-time.js';
import type { GeneratedArtifact } from '../../packages/mcp-server/src/codegen/types.js';
import { packFoundationPackages } from './s182-m04-consumer-harness.mjs';
import { ensureConsumerRollup } from './consumer-rollup.mjs';
import {
  GATE_NAMES, REPOSITORY_ROOT, commandResult, requireGreen, prepareManifest,
  isolatedNpmEnvironment, assertInstalledIsolation, resolveImports, withStaticServer, cssProof, launchProofBrowser,
  type PackedPackageRecord,
} from './s184-m06-live-consumers.js';

type Framework = 'react' | 'vue';
export type WorkflowCheckpoint = (name: string) => Promise<void>;
type Row = { name: string; status: 'passed' | 'failed' | 'unproven'; detail?: unknown; error?: string };
const contexts = ['list', 'detail', 'form', 'timeline'] as const;
const digest = (contents: string | Buffer) => `sha256:${createHash('sha256').update(contents).digest('hex')}`;
async function json(file: string, value: unknown) { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, JSON.stringify(value, null, 2) + '\n'); }
async function writeFiles(root: string, files: Record<string, string>) { for (const [name, contents] of Object.entries(files)) { await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true }); await fs.writeFile(path.join(root, name), contents); } }
async function observeCheckpoint(rows: Row[], name: string, action: () => Promise<unknown>, checkpoint?: WorkflowCheckpoint) {
  await observe(rows, name, async () => {
    const detail = await action();
    await checkpoint?.(name);
    return detail;
  });
}
async function observe(rows: Row[], name: string, action: () => Promise<unknown>) {
  try { const detail = await action(); rows.push({ name, status: 'passed', detail }); }
  catch (error) { rows.push({ name, status: 'failed', error: error instanceof Error ? error.message : String(error) }); throw error; }
}
const screen = (page: Page) => page.locator('[data-oods-workflow]');
async function ready(page: Page, name: string, state = 'success') { await page.locator(`[data-screen="${name}"][data-ui-state="${state}"]`).waitFor({ timeout: 8000 }); }
async function go(page: Page, context: string) {
  const label = context === 'form' ? 'Edit' : context[0]!.toUpperCase() + context.slice(1);
  await page.getByRole('navigation', { name: 'Workflow screens' }).getByRole('button', { name: label, exact: true }).click();
}

async function selectDetailTab(page: Page, name: string) {
  const tab = page.getByRole('tab', { name, exact: true });
  if (await tab.isVisible()) await tab.click();
  else {
    await page.getByRole('button', { name: 'More tabs', exact: true }).click();
    await page.getByRole('menuitem', { name, exact: true }).click();
  }
}

async function selectPaymentTab(page: Page) {
  if (await page.locator('[data-oods-component="PaymentTimeline"]').isVisible()) return;
  await selectDetailTab(page, 'Billing');
  await page.locator('[data-oods-component="PaymentTimeline"]').waitFor({ state: 'visible' });
}

// Record actual visible recipe roots after navigation, including React's lazy tab panels.
async function mountedRecipes(page: Page) {
  const roots = await page.locator('[data-oods-component]').evaluateAll((elements) => elements
    .filter((element) => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden')
    .map((element) => ({ nodeId: element.id, component: element.getAttribute('data-oods-component')!, present: true, passed: true })));
  return roots.filter((root) => isTraitRecipe(root.component));
}

/** Expected obligations come from declarations, never from whichever DOM survived. */
export function workflowEditProbe(schema: UiSchema) {
  const fields = schema.objectSchema!;
  // The record's title field as the workflow emitter names it (s205-m06: the harness had copied the emitter's list and
  // missed its text.label fallback, so Run's and CapturedArtifact's saved headings were expected to be ids). s206-m01:
  // the emitter's own function, so the two cannot drift again.
  const titleField = recordTitleField(schema.workflow!.object, fields, schema.workflow!.data.idField);
  const editable = schemaNodes(schema).filter(node => ['Input', 'Textarea'].includes(node.component) && node.bindings?.onChange)
    .map(node => String(node.props?.field)).filter(field => field !== schema.workflow!.data.idField && fields[field]?.type === 'string' && !fields[field]?.enum?.length);
  // The application also emits required string fields omitted by its form screen.
  const supplementalTitle = titleField !== schema.workflow!.data.idField && fields[titleField]!.required && fields[titleField]!.type === 'string' && !fields[titleField]!.enum?.length;
  const selectable = schemaNodes(schema).filter(node => node.component === 'Select' && node.bindings?.onChange)
    .map(node => String(node.props?.field)).filter(field => fields[field]?.enum && fields[field]!.enum!.length > 1);
  const field = editable.includes(titleField) || supplementalTitle ? titleField : editable.find(name => /(_name|_number|title|label)$/.test(name)) ?? editable[0] ?? selectable.find(name => name === 'currency') ?? selectable[0];
  assert(field, 'Workflow must declare a writable text field for persistence proof');
  const nodes = schemaNodes(schema);
  const timelineEmpty = !nodes.some(node => node.collection?.historyField || node.component === 'PaymentEventTimeline')
    && !['created_at', 'last_event_at', 'issued_at', 'period_start', 'ownership_transferred_at'].some(field => fields[field]);
  const states = schema.workflow!.data.lifecycleStates ?? [];
  const immediateCancellation = states.includes('cancelled') && !states.includes('pending_cancellation');
  const samples = workflowSampleRecords(schema);
  const live = samples.filter(record => !record.is_archived);
  const selected = live[2] ?? live[0]!;
  const selectedId = String(selected[schema.workflow!.data.idField]);
  const addressNode = nodes.find(node => node.component === 'AddressEditor');
  const addresses = selected[String(addressNode?.props?.field ?? 'addresses')] as Array<{ role?: string; address?: { addressLines?: string[]; locality?: string } }> | undefined;
  const address = addresses?.find(entry => entry.role === selected[String(addressNode?.props?.defaultRoleField)]) ?? addresses?.[0];
  const addressSeed = { street: (address?.address?.addressLines ?? []).join(', '), city: address?.address?.locality ?? '', count: addresses?.length ?? 0 };
  const paymentNode = nodes.find(node => node.component === 'PaymentEventTimeline');
  const paymentEventCount = [paymentNode?.props?.lastPaymentField, paymentNode?.props?.nextPaymentField].filter(field => typeof field === 'string' && Number.isFinite(Date.parse(String(selected[field] ?? '')))).length;

  const kind = selectable.includes(field) ? 'select' as const : 'text' as const;
  const saved = kind === 'select' ? String(fields[field]!.enum!.find(value => value !== selected[field])) : field === 'currency' ? 'EUR' : 'Team annual';
  const archivable = schema.workflow!.data.traits.some(name => name.split('/').pop() === 'Archivable');
  // The control's accessible name is the composed label (a Labelled object's `label` field is called Name since s201-m06), else the generated field label.
  const declaredLabel = nodes.find(node => ['Input', 'Textarea', 'Select'].includes(node.component) && node.bindings?.onChange && node.props?.field === field && typeof node.props?.label === 'string')?.props?.label as string | undefined;
  // s222-m03 (#2502 ruling 14): the last seeded record (an object with authored samples seeds one per sample, 5 to 10).
  const archived = samples.at(-1)!;
  const fallback = fields[titleField]?.displayFallbackField;
  const archivedName = String(archived[titleField] ?? '').trim() || !fallback ? archived[titleField] : archived[fallback];
  const seededHeading = formatRecordLabel(String(selected[titleField] ?? '').trim() || !fallback ? selected[titleField] : selected[fallback]);
  const inputFields = Object.entries(fields).map(([name, definition]) => {
    const node = nodes.find(node => ['Input', 'Textarea', 'Select', 'DatePicker'].includes(node.component) && node.props?.field === name);
    return { name, type: definition.type, required: definition.required === true, nodeId: node?.id, label: node?.props?.label ?? fieldLabel(name) };
  });
  return { addressSeed, paymentEventCount, inputFields, seededHeading, selectedId, activeIds: live.map(record => String(record[schema.workflow!.data.idField])), archivedIds: samples.filter(record => record.is_archived).map(record => String(record[schema.workflow!.data.idField])), field, label: declaredLabel ?? fieldLabel(field), titleField, kind, archivable, immediateCancellation, seeded: String(selected[field] ?? ''), saved, timelineEmpty, archivedLabel: `Archived: ${archivedName}` };
}

export function workflowInputField(probe: ReturnType<typeof workflowEditProbe> | undefined, input: { id: string; label?: string }) {
  // Labels may also name a nested widget's local input. Only a declared node or supplemental field ID binds it.
  return input.id ? probe?.inputFields.find(field => field.nodeId === input.id || (!field.nodeId && field.name === input.id)) : undefined;
}

export function expectedWorkflowFlow(schema: UiSchema): string[] {
  const nodes = schemaNodes(schema);
  const fields = schema.objectSchema ?? {};
  const billing = nodes.some(node => node.component === 'BillingAmountInput');
  const address = nodes.some(node => node.component === 'AddressEditor');
  const cancel = nodes.some(node => Object.values(node.bindings ?? {}).includes('handleCancel'));
  const edit = workflowEditProbe(schema);
  return ['ten-sample-records', 'detail-navigation', 'edit-seeded-values',
    ...(billing ? ['billing-edit-values'] : []), fields.plan_name ? 'save-plan-name' : edit.field === edit.titleField ? 'save-record-title' : 'save-record-field',
    ...(billing ? ['billing-save-persists'] : []), ...(address ? ['address-save-persists'] : []),
    ...(cancel ? ['cancel-detail', 'cancel-list-badge'] : []), 'timeline-navigation-and-history'];
}
export function assertWorkflowFlow(rows: Row[], expected: readonly string[]) {
  assert.deepEqual(rows.map(row => row.name), expected, 'Every declared flow obligation must execute in order');
  assert.ok(rows.every(row => row.status === 'passed'), JSON.stringify(rows));
}

export async function observeFlow(page: Page, url: string, requireBillingViews = false, object = 'Subscription', titleField = 'plan_name', editProbe?: ReturnType<typeof workflowEditProbe>, checkpoint?: WorkflowCheckpoint): Promise<Row[]> {
  const rows: Row[] = [];
  const observe = async (rows: Row[], name: string, action: () => Promise<unknown>) => {
    await observeCheckpoint(rows, name, action, checkpoint);
  };
  const selectedId = editProbe?.selectedId ?? `${object.toLowerCase()}-003`;
  // s222-m03 (#2502 ruling 14): the declared sample records, not a fixed ten (an object's samples set its record count).
  const total = editProbe ? editProbe.activeIds.length + editProbe.archivedIds.length : 10;
  const edit = editProbe ?? { field: titleField, label: fieldLabel(titleField), titleField, seeded: `${object} 03`, saved: 'Team annual' };
  const cancellationStatus = editProbe?.immediateCancellation ? /cancelled/i : /pending[ _]cancellation/i;
  const suppliedInputs: Array<{ id: string; value: string }> = [];
  const titleInput = () => page.getByRole(editProbe?.kind === 'select' ? 'combobox' : 'textbox', { name: edit.label, exact: true });
  try {
    await page.goto(`${url}/?latency=60`, { waitUntil: 'domcontentloaded' });
    await ready(page, 'list');
    await observe(rows, 'ten-sample-records', async () => {
      const active = await page.locator(':is([data-oods-collection="rows"], .workflow-records) [data-record-id]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-record-id')));
      if (editProbe) assert.deepEqual([...active].sort(), [...editProbe.activeIds].sort(), 'Active rows must be the declared sample records');
      const archiveTabs = page.getByRole('tablist', { name: 'Archive views' });
      const hasArchive = await archiveTabs.count() > 0;
      if (requireBillingViews) assert.equal(hasArchive, true, 'Declared archive views must be mounted');
      if (hasArchive) {
        assert.equal(await page.locator(':is([data-oods-collection="rows"], .workflow-records) [data-archived="true"]').count(), 0);
        await archiveTabs.getByRole('tab', { name: 'Active', exact: true }).focus();
        await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
      } else if (await page.getByRole('button', { name: 'Archived', exact: true }).count()) await page.getByRole('button', { name: 'Archived', exact: true }).click();
      else { assert.equal(active.length, total); return { active, archived: [], total, disposition: `${total === 10 ? 'ten' : total} active records; object has no Archivable trait` }; }
      await ready(page, 'list', editProbe?.archivedIds.length === 0 ? 'empty' : 'success');
      await checkpoint?.('archived');
      const archived = await page.locator(':is([data-oods-collection="rows"], .workflow-records) [data-record-id]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-record-id')));
      if (editProbe) assert.deepEqual([...archived].sort(), [...editProbe.archivedIds].sort(), 'Archived rows must be the declared sample records');
      else { assert.equal(active.length, 9); assert.equal(archived.length, 1); }
      assert.equal(new Set([...active, ...archived]).size, total);
      const mounts = await mountedRecipes(page);
      let archivePresentation: unknown;
      if (hasArchive && archived.length) {
        const overlay = page.locator(':is([data-oods-collection="rows"], .workflow-records) [data-archived="true"]');
        assert.equal(await overlay.count(), 1);
        assert.equal(await overlay.getAttribute('role'), 'group');
        assert.equal(await overlay.getAttribute('aria-hidden'), 'false');
        if (editProbe) assert.equal(await overlay.getAttribute('aria-label'), editProbe.archivedLabel);
        else assert.ok((await overlay.getAttribute('aria-label') ?? '').startsWith(`Archived: ${object}`));
        assert.equal(await overlay.locator('.oods-archive-badge').innerText(), 'Archived');
        const opacity = await overlay.evaluate((node) => getComputedStyle(node).opacity);
        assert.equal(opacity, '0.7'); // s192-m04 measured contrast correction (#1887)
        archivePresentation = { opacity, accessibleName: await overlay.getAttribute('aria-label'), tabLabel: await overlay.getAttribute('data-archive-tab'), keyboardNavigation: true };
        await archiveTabs.getByRole('tab', { name: 'Active', exact: true }).click();
      } else if (hasArchive) await archiveTabs.getByRole('tab', { name: 'Active', exact: true }).click();
      else await page.getByRole('button', { name: 'Show active', exact: true }).click();
      await ready(page, 'list');
      return { active, archived, archivePresentation, mounts, total, disposition: 'Active and Archived views match the declared sample records' };
    });
    await observe(rows, 'detail-navigation', async () => {
      await page.locator(`:is([data-oods-collection="rows"], .workflow-records) [data-record-id="${selectedId}"]`).click();
      await ready(page, 'detail');
      assert.equal(await screen(page).getAttribute('data-selected-id'), selectedId);
      if (editProbe) assert.equal(await page.locator('.workflow-heading h1').innerText(), editProbe.seededHeading);
      if (editProbe && !editProbe.archivable) assert.equal(await page.locator('[data-oods-action="handleDelete"]').count(), 0, 'An app without Archivable must not expose its archive action');
      if (requireBillingViews) await selectDetailTab(page, 'Billing');
      const cycle = page.locator('[data-oods-component="CycleProgressCard"]');
      const payments = page.locator('[data-oods-component="PaymentTimeline"]');
      const mounts = await mountedRecipes(page);
      let billingViews: unknown;
      if (requireBillingViews) assert.equal(await cycle.count(), 1);
      if (await cycle.count()) {
        assert.match(await cycle.innerText(), /\d+%.*remaining/i);
        assert.equal(await cycle.getByRole('progressbar').count(), 1);
        const cycleText = await cycle.innerText();
        await selectPaymentTab(page);
        await payments.waitFor({ state: 'visible' });
        assert.match(await payments.innerText(), /Payment method:/);
        assert.equal(await payments.locator('[data-payment-kind]').count(), 2);
        mounts.push(...await mountedRecipes(page));
        billingViews = { cycle: cycleText, payments: await payments.innerText() };
      }
      return { id: await screen(page).getAttribute('data-selected-id'), heading: await page.locator('.workflow-heading h1').innerText(), billingViews, mounts };
    });
    await observe(rows, 'edit-seeded-values', async () => {
      await page.locator('[data-oods-action="handleEdit"]').click(); await ready(page, 'form');
      const plan = await titleInput().inputValue();
      assert.equal(plan, edit.seeded);
      // Neutral previews intentionally leave unauthored required values blank. Supply explicit test inputs through
      // the real form, as a person must, before proving Save or the billing field's invalid-value refusal.
      for (const control of await page.locator('input,textarea,select').all()) {
        const input = await control.evaluate(node => { const element = node as HTMLInputElement; return { id: element.id, value: element.value, required: element.required, readOnly: element.readOnly, valid: element.checkValidity(), label: element.labels?.[0]?.textContent?.replace(/\*/g, '').replace(/\s+/g, ' ').trim(), type: element.type, min: element.min }; });
        const field = workflowInputField(editProbe, input);
        if ((!input.required && !field?.required) || input.readOnly || await control.isDisabled()) continue;
        if (input.valid && !(field?.required && !input.value)) continue;
        const type = field?.type ?? input.type;
        const value = input.type === 'datetime-local' ? '2026-09-15T12:00' : input.type === 'date' ? '2026-09-15' : field?.name === edit.field ? edit.saved : type === 'uuid' ? '00000000-0000-4000-8000-000000000099'
          : type === 'datetime' ? '2026-09-15T12:00:00Z' : type === 'date' ? '2026-09-15'
          : type === 'email' ? 'proof@example.test' : input.type === 'url' || field?.name.endsWith('_url') ? 'https://example.test/proof'
          : field?.name === 'currency' ? 'USD' : input.type === 'number' ? input.min || '1' : 'Proof input supplied by the workflow verifier';
        if (input.type === 'select-one') {
          const options = await control.locator('option:not([disabled])').evaluateAll(nodes => nodes.map(node => (node as HTMLOptionElement).value).filter(Boolean));
          assert(options.length, `Required select ${input.label} must offer a value`); await control.selectOption(options[0]!);
        } else await control.fill(value);
        assert.equal(await control.evaluate(node => (node as HTMLInputElement).checkValidity()), true, `The test input must satisfy ${input.label}`);
        suppliedInputs.push({ id: input.id, value: await control.inputValue() });
      }
      return { id: await screen(page).getAttribute('data-selected-id'), field: edit.field, plan, suppliedInputs };

    });
    const hasAddress = await page.locator('[data-oods-component="AddressEditor"]').count() > 0;
    const hasBilling = await page.locator('[data-oods-component="BillingAmountInput"]').count() > 0;
    if (hasBilling) await observe(rows, 'billing-edit-values', async () => {
      const amount = page.locator('[data-billing-minor-units]');
      const interval = page.getByRole('combobox', { name: 'Billing interval', exact: true });
      const options = await interval.locator('option:not([disabled])').evaluateAll((nodes) => nodes.map((node) => (node as HTMLOptionElement).value));
      assert.deepEqual(options, ['monthly', 'yearly']);
      await amount.fill('-1'); assert.equal(await amount.getAttribute('aria-invalid'), 'true');
      await page.getByRole('button', { name: 'Save', exact: true }).click(); await ready(page, 'form');
      // Learning #548: preserve this native keyboard proof and run it on pinned Linux Chromium.
      await amount.fill('19.99'); await interval.focus(); await interval.press('Home'); await interval.press('ArrowDown');
      assert.equal(await interval.inputValue(), 'yearly');
      return { options, amount: await amount.inputValue(), interval: await interval.inputValue(), invalidSaveStayedOnForm: true };
    });
    await observe(rows, titleField === 'plan_name' ? 'save-plan-name' : edit.field === titleField ? 'save-record-title' : 'save-record-field', async () => {
      if (editProbe?.kind === 'select') await titleInput().selectOption(edit.saved);
      else await titleInput().fill(edit.saved);
      const editedId = await titleInput().getAttribute('id');
      for (const input of suppliedInputs) if (input.id === editedId) input.value = edit.saved;
      await page.getByRole('button', { name: 'Save', exact: true }).click(); await ready(page, 'detail');
      assert.equal(await page.locator('.workflow-heading h1').innerText(), edit.field === titleField ? edit.saved : editProbe?.seededHeading ?? selectedId);
      assert.equal(await page.locator('.workflow-notice').innerText(), 'Changes saved in this session.');
      if (edit.field !== titleField) {
        await go(page, 'form'); await ready(page, 'form');
        assert.equal(await titleInput().inputValue(), edit.saved, 'Saved field must survive reloading the record from the store');
        await go(page, 'detail'); await ready(page, 'detail');
      }
      if (suppliedInputs.length) {
        await go(page, 'form'); await ready(page, 'form');
        for (const input of suppliedInputs) {
          // The store updates its own updated_at timestamp after an edit; it owns that value.
          if (input.id.includes('updated_at')) continue;
          assert.equal(await page.locator(`[id="${input.id}"]`).inputValue(), input.value, 'Required values entered through the form must survive Save');
        }
        await go(page, 'detail'); await ready(page, 'detail');
      }
      return { heading: await page.locator('.workflow-heading h1').innerText(), suppliedInputs };

    });
    if (hasBilling) await observe(rows, 'billing-save-persists', async () => {
      await page.locator('[data-oods-action="handleEdit"]').click(); await ready(page, 'form');
      const amount = await page.locator('[data-billing-minor-units]').inputValue();
      const interval = await page.getByRole('combobox', { name: 'Billing interval', exact: true }).inputValue();
      assert.equal(amount, '19.99'); assert.equal(interval, 'yearly');
      await go(page, 'detail'); await ready(page, 'detail');
      return { id: await screen(page).getAttribute('data-selected-id'), storedMinorUnits: 1999, majorUnitEditorValue: amount, interval };
    });
    if (hasAddress) await observe(rows, 'address-save-persists', async () => {
      await go(page, 'form'); await ready(page, 'form');
      const editor = page.locator('[data-oods-component="AddressEditor"]');
      assert.equal(await editor.getByRole('textbox', { name: 'Street', exact: true }).inputValue(), editProbe?.addressSeed.street ?? '102 Main Street');
      assert.equal(await editor.getByRole('textbox', { name: 'City', exact: true }).inputValue(), editProbe?.addressSeed.city ?? 'Springfield');
      await editor.getByRole('textbox', { name: 'Street', exact: true }).fill('42 Lake Road');
      await editor.getByRole('textbox', { name: 'City', exact: true }).fill('Madison');
      await checkpoint?.('address-edited');
      await page.getByRole('button', { name: 'Save', exact: true }).click(); await ready(page, 'detail');
      const panel = page.locator('[data-oods-component="AddressCollectionPanel"]');
      if (!await panel.isVisible()) {
        for (const tab of await page.getByRole('tab').all()) { await tab.click(); if (await panel.isVisible()) break; }
      }
      assert.equal(await panel.isVisible(), true);
      const text = await panel.innerText(); assert.match(text, /42 Lake Road, Madison/);
      if (editProbe?.addressSeed.street) assert(!text.includes(editProbe.addressSeed.street), 'Save must replace the address the editor displayed');
      assert.equal(text.split(';').length, Math.max(1, editProbe?.addressSeed.count ?? 1), 'Save must update the existing address or create exactly one first address');
      await go(page, 'form'); await ready(page, 'form');
      assert.equal(await editor.getByRole('textbox', { name: 'Street', exact: true }).inputValue(), '42 Lake Road');
      assert.equal(await editor.getByRole('textbox', { name: 'City', exact: true }).inputValue(), 'Madison');
      await go(page, 'detail'); await ready(page, 'detail');
      return { selectedId, seededStreet: editProbe?.addressSeed.street ?? '102 Main Street', savedStreet: '42 Lake Road', savedCity: 'Madison', detail: text };
    });
    const cancellable = await page.locator('[data-oods-action="handleCancel"]').count() > 0;
    if (cancellable) await observe(rows, 'cancel-detail', async () => {
      const onDemand = await page.locator('input[name="cancellation_reason"]').count() === 0;
      if (onDemand) {
        assert.equal(await page.locator('[data-oods-component="CancellationForm"]').count(), 0);
        assert.equal(await page.getByRole('textbox').count(), 0);
        assert.equal(await page.getByRole('checkbox').count(), 0);
        await page.locator('[data-oods-action="handleCancel"]').click();
        await page.locator('[data-oods-component="CancellationForm"] textarea[name="reason"]').fill('Budget changed for next year');
        const code = page.locator('[data-oods-component="CancellationForm"] [name="reasonCode"]');
        if (await code.evaluate(element => element.tagName) === 'SELECT') await code.selectOption('customer_request');
        else await code.fill('customer_request');
        const periodEnd = page.locator('input[name="cancel_at_period_end"]');
        if (editProbe?.immediateCancellation) assert.equal(await periodEnd.count(), 0, 'Immediate cancellation must not expose a billing-period control');
        else await periodEnd.check();
        await checkpoint?.('cancellation-form');
        await page.getByRole('button', { name: 'Confirm cancellation', exact: true }).click();
      } else {
        await page.locator('input[name="cancellation_reason"]').fill('Budget changed for next year');
        await page.locator('input[name="cancellation_reason_code"]').fill('customer_request');
        const periodEnd = page.locator('input[name="cancel_at_period_end"]');
        if (editProbe?.immediateCancellation) assert.equal(await periodEnd.count(), 0, 'Immediate cancellation must not expose a billing-period control');
        else await periodEnd.check();
        await page.locator('[data-oods-action="handleCancel"]').click();
      }
      await ready(page, 'detail');
      const text = await screen(page).innerText(); assert.match(text, cancellationStatus);
      assert.equal(await page.locator('.workflow-notice').innerText(), 'Changes saved in this session.');
      if (onDemand) assert.equal(await page.locator('[data-oods-component="CancellationForm"]').count(), 0);
      return { text, id: await screen(page).getAttribute('data-selected-id'), onDemand, readOnlyBeforeActivation: onDemand };
    });
    if (cancellable) await observe(rows, 'cancel-list-badge', async () => {
      await go(page, 'list'); await ready(page, 'list');
      const text = await page.locator(`:is([data-oods-collection="rows"], .workflow-records) [data-record-id="${selectedId}"] [data-oods-component="StatusBadge"]`).innerText();
      assert.match(text, cancellationStatus);
      return { text };
    });
    await observe(rows, 'timeline-navigation-and-history', async () => {
      await go(page, 'list'); await ready(page, 'list');
      await page.locator(`:is([data-oods-collection="rows"], .workflow-records) [data-record-id="${selectedId}"]`).click(); await ready(page, 'detail');
      const timelineAction = page.locator('[data-oods-action="handleViewTimeline"]');
      if (await timelineAction.count()) await timelineAction.click();
      else await go(page, 'timeline');
      await ready(page, 'timeline');
      if (editProbe?.timelineEmpty) {
        const collection = page.locator('[data-oods-collection="events"]');
        await collection.waitFor({ state: 'visible' });
        const text = await collection.innerText();
        assert.match(text, /No events yet/);
        return { text, id: await screen(page).getAttribute('data-selected-id'), disposition: 'The declared timeline collection has no lifecycle-history or payment-event source; its empty state is visible.' };
      }
      const text = await page.getByRole('list', { name: 'Lifecycle history' }).innerText();
      if (cancellable) { assert.match(text, cancellationStatus); assert.match(text, /Budget changed for next year/); }
      else assert.ok(text.trim().length > 0, 'Declared lifecycle history must contain the seeded event');
      const events = page.locator('[data-oods-component="PaymentEventTimeline"]');
      let paymentEvents: string | undefined;
      const composedEvents = await page.locator('[data-oods-collection="events"]').count() > 0;
      if (requireBillingViews) assert.equal(await events.count(), composedEvents ? editProbe?.paymentEventCount ?? 2 : 1);
      if (await events.count()) {
        await events.first().waitFor({ state: 'visible' });
        paymentEvents = (await events.allTextContents()).join('\n');
        if (composedEvents) {
          assert.match(paymentEvents, /Last payment/); assert.match(paymentEvents, /Next payment/);
          assert.doesNotMatch(text, /\d{4}-\d{2}-\d{2}T/);
        } else {
          assert.equal(await events.locator('[data-payment-kind]').count(), 2);
          assert.match(paymentEvents, /Payment events/);
        }
      }
      return { text, id: await screen(page).getAttribute('data-selected-id'), paymentEvents, mounts: await mountedRecipes(page) };
    });
  } catch { /* The exact failing row is retained; dependent flow rows are not claimed. */ }
  return rows;
}

async function observeStates(page: Page, url: string, framework: Framework) {
  const rows: Array<Record<string, unknown>> = [];
  // s206-m01: each screen's 650 ms loading branch is recorded in the page, from document start, the moment it appears.
  // Waiting for it from the harness and then reading its text in a second call raced it on a busy host: Media's list
  // banner was gone before its text was read, and Cluster's timeline banner had come and gone before the first poll
  // (both pass alone; both failed once under the four-worker sweep). The evidence is unchanged; only the race is gone.
  await page.addInitScript(() => {
    const self = window as unknown as { __oodsLoadingSeen?: Record<string, { marker: string | null; text: string }> };
    if (self.__oodsLoadingSeen) return;
    const seen: Record<string, { marker: string | null; text: string }> = {};
    self.__oodsLoadingSeen = seen;
    // No named function in a page callback: tsx's keepNames would wrap it in a helper the page does not have.
    new MutationObserver(() => {
      for (const element of Array.from(document.querySelectorAll<HTMLElement>('[data-screen] [data-oods-state="loading"]'))) {
        const screen = element.closest('[data-screen]')?.getAttribute('data-screen');
        if (screen && !seen[screen]) seen[screen] = { marker: element.getAttribute('data-oods-state'), text: element.innerText };
      }
    }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-oods-state'] });
  });
  for (const [mode, expected] of [['', 'success'], ['empty', 'empty'], ['error', 'error']] as const) {
    await page.goto(`${url}/?mode=${mode}&latency=650`, { waitUntil: 'domcontentloaded' });
    for (const context of contexts) {
      if (context !== 'list') await go(page, context);
      if (mode === '') {
        await page.waitForFunction(screen => Boolean((window as unknown as { __oodsLoadingSeen?: Record<string, unknown> }).__oodsLoadingSeen?.[screen]), context, { timeout: 5000 });
        const loading = await page.evaluate(screen => (window as unknown as { __oodsLoadingSeen: Record<string, { marker: string | null; text: string }> }).__oodsLoadingSeen[screen]!, context);
        rows.push({ framework, screen: context, state: 'loading', marker: loading.marker, text: loading.text });
      }
      await ready(page, context, expected);
      const branch = page.locator(`[data-screen="${context}"] [data-oods-state="${expected}"]`);
      assert.equal(await branch.count(), 1);
      rows.push({ framework, screen: context, state: expected, marker: await branch.getAttribute('data-oods-state'), text: await branch.innerText() });
    }
  }
  assert.equal(rows.length, 16);
  return rows;
}

/** Independently order the declared record titles; realistic names need not follow IDs. */
export function expectedCollectionOrder(schema: UiSchema, status?: string, descending = false, sortField?: string): string[] {
  const fields = schema.objectSchema!;
  // Initial and explicit sorting both follow the declared Sort field (s213-m01). Decision's heading keeps its ID,
  // but its list sorts by text; equal neutral text values must retain their sample order in both directions.
  const declaredSort = schemaNodes(schema).find(node => node.collectionControl === 'sort')?.props?.field;
  const title = sortField ?? (typeof declaredSort === 'string' && Object.hasOwn(fields, declaredSort) ? declaredSort
    : recordTitleField(schema.workflow!.object, fields, schema.workflow!.data.idField));
  const filter = schemaNodes(schema).find(node => node.collectionControl === 'filter');
  const statusField = String(filter?.props?.field ?? 'status');
  const display = (record: Record<string, unknown>) => {
    const fallback = fields[title]?.displayFallbackField;
    return String(record[title] ?? '').trim() || !fallback ? record[title] : record[fallback];
  };
  return workflowSampleRecords(schema).filter(record => !record.is_archived && (!status || record[statusField] === status))
    .sort((a, b) => (descending ? -1 : 1) * String(display(a)).localeCompare(String(display(b))))
    .map(record => String(record[schema.workflow!.data.idField]));
}

export type AppInspection = (input: {
  page: Page; url: string; output: string; framework: Framework; artifact: GeneratedArtifact;
  schema: UiSchema; object: string; requireBillingViews: boolean; titleField: string;
  requiredFlow: string[]; editProbe: ReturnType<typeof workflowEditProbe>;
}) => Promise<void>;

/** Query controls stay usable through empty results; a refresh must not steal typing focus. */
export async function observeCollectionControls(page: Page, url: string, object = 'Subscription', schema?: UiSchema, checkpoint?: WorkflowCheckpoint) {
  await page.goto(`${url}/?latency=60`, { waitUntil: 'domcontentloaded' });
  await ready(page, 'list');
  if (!await page.locator('[data-oods-collection="rows"]').count()) return [];
  const rows: Row[] = [];
  const records = page.locator('[data-oods-collection="rows"] [data-record-id]');
  const total = await records.count();
  const observe = async (rows: Row[], name: string, action: () => Promise<unknown>) => {
    await observeCheckpoint(rows, name, action, checkpoint);
  };
  const expectedOrder = schema ? expectedCollectionOrder(schema) : undefined;
  const filter = schema ? schemaNodes(schema).find(node => node.collectionControl === 'filter') : undefined;
  const filterField = String(filter?.props?.field ?? 'status');
  // A composed list may declare no filter control at all (Collection has no lifecycle field): then search,
  // sort and pagination are the controls under proof and the status filter is recorded as not declared.
  const filterDeclared = !schema || Boolean(filter);
  const statusControl = page.getByRole('combobox', { name: String(filter?.props?.label ?? 'Status'), exact: true });
  const options = filterDeclared ? await statusControl.locator('option').evaluateAll(nodes => nodes.map(node => (node as HTMLOptionElement).value)) : [];
  const selectedStatus = options.includes('active') ? 'active' : options.find(value => value !== '');
  if (schema && filterDeclared) {
    const declaredOptions = ((filter?.props?.options as Array<{ value: string }> | undefined) ?? []).map(option => option.value);
    const states = schema.workflow!.data.lifecycleStates;
    const observedStates = [...new Set(workflowSampleRecords(schema).filter(record => !record.is_archived).map(record => String(record[filterField] ?? '')).filter(Boolean))].sort();
    const expectedOptions = declaredOptions.length > 1 ? declaredOptions
      : schema.objectSchema!.status && states.length ? ['', ...states] : ['', ...observedStates];
    assert.deepEqual(options, expectedOptions, 'Filter choices must match the declared enum, workflow lifecycle states, or actual loaded records');
  } else if (!schema) assert.ok(selectedStatus, 'The declared status filter must offer an actual lifecycle state');
  const expectedIds = schema ? expectedCollectionOrder(schema, selectedStatus)
    : await records.evaluateAll((nodes, status) => nodes.filter(node => node.querySelector('[data-oods-component="StatusBadge"]')?.getAttribute('data-status') === status).map(node => node.getAttribute('data-record-id')), selectedStatus);
  const search = page.getByRole('searchbox', { name: 'Search', exact: true });
  await observe(rows, 'search-bound-record', async () => {
    const id = schema ? workflowEditProbe(schema).selectedId : `${object.toLowerCase()}-003`;
    await search.fill(id);
    assert.deepEqual(await records.evaluateAll(nodes => nodes.map(node => node.getAttribute('data-record-id'))), [id]);
    await checkpoint?.('search-result');
    await search.fill('');
    assert.equal(await records.count(), total);
    return { query: id, exactIds: [id], restoredCount: total };
  });
  await observe(rows, 'type-through-empty-results', async () => {
    await search.focus(); await search.pressSequentially('not-a-record');
    assert.equal(await search.inputValue(), 'not-a-record');
    assert.equal(await search.evaluate(element => document.activeElement === element), true);
    assert.equal(await records.count(), 0);
    await ready(page, 'list', 'empty');
    await checkpoint?.('search-empty');
    await page.getByRole('button', { name: 'Clear search', exact: true }).click();
    assert.equal(await search.inputValue(), ''); assert.equal(await records.count(), total);
    return { typed: 'not-a-record', retainedFocus: true, emptyCount: 0, restoredCount: total };
  });
  if (!filterDeclared) await observe(rows, 'filter-not-declared', async () => {
    assert.equal(await statusControl.count(), 0, 'A list composed without a filter control must not render one');
    assert.equal(await records.count(), total);
    return { reason: 'The composed list declares no filter control; the object has no lifecycle field. Search, sort and pagination are proven; filtering by a status is not claimed.' };
  });
  else if (selectedStatus) await observe(rows, 'filter-composed-rows', async () => {
    await statusControl.selectOption(selectedStatus);
    assert.equal(await records.count(), expectedIds.length);
    assert.deepEqual(await records.evaluateAll(nodes => nodes.map(node => node.getAttribute('data-record-id'))), expectedIds);
    await checkpoint?.('filtered-records');
    await statusControl.selectOption('');
    assert.equal(await records.count(), total);
    return { selectedStatus, selectedCount: expectedIds.length, expectedIds, restoredCount: total };
  });
  else await observe(rows, 'filter-has-no-values', async () => {
    assert.deepEqual(options, ['']);
    assert.equal(await records.count(), total);
    return { options, reason: 'Neither the public schema nor loaded records provide filter values; only All states is available. Filtering by a status is not proven.' };
  });
  await observe(rows, 'sort-composed-rows', async () => {
    await page.getByRole('combobox', { name: 'Sort', exact: true }).selectOption('desc');
    const actualDescending = await records.evaluateAll(nodes => nodes.map(node => node.getAttribute('data-record-id')));
    // s205-m06: the app negates its comparator, so records with EQUAL display values keep their record order in both
    // directions — the list is not simply reversed. Real Stage1 findings share titles (one rule failing on two pages);
    // seeded names never repeated, so the reversal assumption held until records were real.
    const declaredSort = schema ? schemaNodes(schema).find(node => node.collectionControl === 'sort')?.props?.field : undefined;
    if (expectedOrder) assert.deepEqual(actualDescending, schema ? expectedCollectionOrder(schema, undefined, true, typeof declaredSort === 'string' ? declaredSort : undefined) : [...expectedOrder].reverse(), 'Every row must follow the declared display-field sort');
    else assert.equal(actualDescending[0], `${object.toLowerCase()}-${String(total).padStart(3, '0')}`);
    await checkpoint?.('sorted-descending');
    await page.getByRole('combobox', { name: 'Sort', exact: true }).selectOption('asc');
    const actualAscending = await records.evaluateAll(nodes => nodes.map(node => node.getAttribute('data-record-id')));
    if (expectedOrder) assert.deepEqual(actualAscending, expectedOrder);
    else assert.equal(actualAscending[0], `${object.toLowerCase()}-001`);
    return { actualDescending, actualAscending };
  });
  await observe(rows, 'pagination-uses-real-boundaries', async () => {
    const pagination = page.getByRole('navigation', { name: 'Pagination', exact: true });
    assert.equal(await pagination.count(), 1);
    // One page says its count once: s210-m01 dropped the page controls ("Page 1 of 1", Previous, Next) and s211-m02 the
    // range that repeated the count. No sweep ran between Sprint 207 and s211-m03, which moved this observer.
    assert.equal((await pagination.innerText()).trim(), `${total} records`);
    assert.equal(await pagination.getByRole('button').count(), 0);
    return { total, page: 1, pages: 1, pageControls: 0 };
  });
  return rows;
}

export async function screenshots(page: Page, url: string, output: string, framework: Framework, artifactHash: string, requireBillingViews: boolean, object: string, titleField: string, requiredFlow: readonly string[], editProbe?: ReturnType<typeof workflowEditProbe>) {
  const rows: Array<Record<string, unknown>> = [];
  const selectedId = editProbe?.selectedId ?? `${object.toLowerCase()}-003`;
  const flow = await observeFlow(page, url, requireBillingViews, object, titleField, editProbe);
  assertWorkflowFlow(flow, requiredFlow);
  await go(page, 'list'); await ready(page, 'list');
  for (const width of [390, 820, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const context of contexts) {
      if (context === 'detail') await page.locator(`:is([data-oods-collection="rows"], .workflow-records) [data-record-id="${selectedId}"]`).click();
      else await go(page, context);
      await ready(page, context);
      const file = `screenshots/${framework}-${context}-${width}.png`;
      await fs.mkdir(path.join(output, 'screenshots'), { recursive: true });
      await page.screenshot({ path: path.join(output, file), fullPage: true, timeout: 120_000 });
      const layout = await page.evaluate(() => ({ viewport: window.innerWidth, documentWidth: document.documentElement.scrollWidth, overflowing: Array.from(document.querySelectorAll('main *')).filter((node) => node.getBoundingClientRect().right > window.innerWidth + 1).slice(0, 20).map((node) => ({ tag: node.tagName, component: node.getAttribute('data-oods-component'), width: node.getBoundingClientRect().width })) }));
      rows.push({ framework, screen: context, width, file, sha256: digest(await fs.readFile(path.join(output, file))), artifactHash, selectedId: await screen(page).getAttribute('data-selected-id'), layout });
      if (requireBillingViews && (context === 'list' || context === 'detail')) {
        const view = context === 'list' ? 'archived' : 'payments';
        if (context === 'list') {
          await page.getByRole('tablist', { name: 'Archive views' }).getByRole('tab', { name: 'Archived', exact: true }).click();
          await ready(page, 'list', editProbe?.archivedIds.length === 0 ? 'empty' : 'success');
        } else {
          await selectPaymentTab(page);
        }
        const extra = `screenshots/${framework}-${view}-${width}.png`;
        await page.screenshot({ path: path.join(output, extra), fullPage: true, timeout: 120_000 });
        rows.push({ framework, screen: view, width, file: extra, sha256: digest(await fs.readFile(path.join(output, extra))), artifactHash, selectedId: await screen(page).getAttribute('data-selected-id') });
        if (context === 'list') {
          await page.getByRole('tablist', { name: 'Archive views' }).getByRole('tab', { name: 'Active', exact: true }).click();
          await ready(page, 'list');
        }
      }
    }
  }
  return rows;
}

export async function runAppConsumers(output: string, mission = 's188-m03', object = 'Subscription', packedPackages?: PackedPackageRecord[], tools = { compose, generate }, sourceHead?: string, inspection?: AppInspection) {
  await fs.mkdir(output, { recursive: true });
  const composition = await tools.compose({ object, context: 'workflow' });
  assert.equal(composition.status, 'ok');
  await json(path.join(output, 'composition.json'), composition);
  const fields = composition.schema.objectSchema!;
  const titleField = recordTitleField(composition.schema.workflow!.object, fields, composition.schema.workflow!.data.idField);
  const requireBillingViews = JSON.stringify(composition.schema).includes('CycleProgressCard');
  const requireAddressViews = JSON.stringify(composition.schema).includes('AddressEditor');
  const requiredFlow = expectedWorkflowFlow(composition.schema);
  const editProbe = workflowEditProbe(composition.schema);
  const artifacts = new Map<Framework, GeneratedArtifact>();
  const generationErrors: unknown[] = [];
  for (const framework of ['react', 'vue'] as const) {
    const generated = await tools.generate({ schema: composition.schema, framework, profile: 'build' });
    await json(path.join(output, `${framework}-generation.json`), generated);
    if (generated.status !== 'ok') { generationErrors.push({ framework, errors: generated.errors }); continue; }
    assert.deepEqual(validateGeneratedArtifact(generated.artifact!), []);
    artifacts.set(framework, generated.artifact!);
  }
  assert.equal(generationErrors.length, 0, JSON.stringify(generationErrors));
  const tarballs = packedPackages ?? await packFoundationPackages(output) as PackedPackageRecord[];
  const browser = await launchProofBrowser();
  const cells: Array<Record<string, unknown>> = [];
  const allStates: Array<Record<string, unknown>> = [];
  const allScreenshots: Array<Record<string, unknown>> = [];
  const consumers = new Map<Framework, string>();
  try {
    for (const framework of ['react', 'vue'] as const) {
      const artifact = artifacts.get(framework)!;
      const cellRoot = path.join(output, framework);
      await fs.mkdir(path.join(cellRoot, 'logs'), { recursive: true });
      const consumer = await fs.mkdtemp(path.join(os.tmpdir(), `oods-s188-app-${framework}-`));
      consumers.set(framework, consumer);
      const sourceFiles = Object.fromEntries(artifact.files.map((file) => [file.path, file.contents]));
      const gates: Row[] = GATE_NAMES.map((name) => ({ name, status: 'unproven' }));
      const pass = (name: string, detail?: unknown) => Object.assign(gates.find((row) => row.name === name)!, { status: 'passed', detail });
      let activeGate: string = GATE_NAMES[0];
      const cell: Record<string, unknown> = { framework, artifactHash: artifact.contentHash, gates, consumerAuthoredComponents: 0, consumerAuthoredActions: 0, generation: 'current-in-run-public-output', consumerRoot: consumer };
      cells.push(cell);
      const command = async (name: string, args: string[]) => {
        const result = commandResult('npm', args, consumer, { environment, scrubNpmCredentials: true, isolateDependencies: true });
        await fs.writeFile(path.join(cellRoot, 'logs', `${name}.log`), JSON.stringify(result, null, 2) + '\n');
        requireGreen(result, `${framework} ${name}`);
        return { exitCode: result.exitCode, log: `${framework}/logs/${name}.log` };
      };
      const userConfig = path.join(consumer, 'empty-user.npmrc');
      const globalConfig = path.join(consumer, 'empty-global.npmrc');
      const environment = isolatedNpmEnvironment(consumer, userConfig, globalConfig);
      try {
        assert.equal(await fs.stat(path.join(consumer, 'node_modules')).then(() => true, () => false), false);
        await writeFiles(consumer, sourceFiles);
        // Keep Vite from discovering the canonical checkout's PostCSS plugins above this isolated consumer.
        assert(!Object.hasOwn(sourceFiles, 'postcss.config.cjs'), 'Do not replace an authored PostCSS configuration');
        const postcss = 'module.exports = { plugins: {} };\n';
        await fs.writeFile(path.join(consumer, 'postcss.config.cjs'), postcss);
        await json(path.join(cellRoot, 'verifier-config.json'), { purpose: 'Stop ancestor PostCSS configuration discovery', file: 'postcss.config.cjs', contents: postcss });
        await writeFiles(path.join(cellRoot, 'source'), sourceFiles);
        const prepared = await prepareManifest(framework, artifact, tarballs, consumer);
        const emittedManifest = JSON.parse(sourceFiles['package.json']!);
        const manifest = { ...emittedManifest, dependencies: { ...emittedManifest.dependencies, ...prepared.manifest.dependencies as object }, devDependencies: { ...prepared.manifest.devDependencies as object, ...emittedManifest.devDependencies } };
        await json(path.join(consumer, 'package.json'), manifest);
        await json(path.join(cellRoot, 'installed-manifest.json'), manifest);
        await Promise.all([fs.writeFile(userConfig, ''), fs.writeFile(globalConfig, ''), fs.writeFile(path.join(consumer, '.npmrc'), '')]);
        const installArgs = ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false', '--userconfig', userConfig];
        await command('install', installArgs);
        await json(path.join(cellRoot, 'logs', 'rollup.json'), await ensureConsumerRollup(consumer,
          extraArgs => command('install-optional-retry', [...installArgs, ...extraArgs])));
        const isolation = assertInstalledIsolation(consumer, framework, prepared.localTarballs, sourceFiles);
        const resolutions = resolveImports(consumer, sourceFiles);
        await json(path.join(cellRoot, 'isolation.json'), { isolation, resolutions, localTarballs: prepared.localTarballs });
        const sourceOwnership = [];
        for (const file of artifact.files.filter((file) => file.path !== 'package.json')) {
          const actual = await fs.readFile(path.join(consumer, file.path));
          assert.equal(digest(actual), file.contentHash);
          sourceOwnership.push({ path: file.path, expected: file.contentHash, actual: digest(actual) });
        }
        await json(path.join(cellRoot, 'source-ownership.json'), { generatedFilesUnchanged: true, consumerAuthoredComponents: 0, consumerAuthoredActions: 0, files: sourceOwnership });
        pass(activeGate, { isolation, resolutions });
        activeGate = 'strict-typecheck'; pass(activeGate, await command('typecheck', ['run', 'typecheck', '--', '--pretty', 'false']));
        activeGate = 'production-build'; pass(activeGate, await command('build', ['exec', '--', 'vite', 'build']));
        activeGate = 'server-render';
        await command('ssr-build', ['exec', '--', 'vite', 'build', '--ssr', `src/ssr.${framework === 'react' ? 'tsx' : 'ts'}`, '--outDir', 'dist-ssr']);
        const entry = (await fs.readdir(path.join(consumer, 'dist-ssr'))).find((name) => /\.[cm]?js$/.test(name))!;
        const runner = `import { renderApp } from './dist-ssr/${entry}';\nprocess.stdout.write(JSON.stringify({ html: await renderApp() }));\n`;
        await fs.writeFile(path.join(consumer, 'ssr-observer.mjs'), runner);
        const rendered = commandResult('node', ['ssr-observer.mjs'], consumer, { environment, scrubNpmCredentials: true, isolateDependencies: true });
        await json(path.join(cellRoot, 'logs/ssr-render.json'), rendered); requireGreen(rendered, 'SSR root');
        const { html } = JSON.parse(rendered.stdout) as { html: string };
        assert.match(html, /data-screen="list"/); assert.ok(html.includes(`${object}s`));
        await fs.writeFile(path.join(cellRoot, 'server-render.html'), html);
        pass(activeGate, { htmlHash: digest(html), generatedEntry: `src/ssr.${framework === 'react' ? 'tsx' : 'ts'}` });
        activeGate = 'shared-css-resolution'; pass(activeGate, await cssProof(path.join(consumer, 'dist'), true));
        await withStaticServer(path.join(consumer, 'dist'), async (url) => {
          const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
          // Allow remote-browser transport/rendering delays; application readiness assertions keep their own limits.
          page.setDefaultNavigationTimeout(120_000);
          const errors: string[] = [];
          page.on('pageerror', (error) => errors.push(error.message));
          page.on('console', (message) => { if (message.type() === 'error' || /hydrat/i.test(message.text())) errors.push(message.text()); });
          cell.browserErrors = errors;
          activeGate = 'mount';
          await page.goto(url, { waitUntil: 'domcontentloaded' }); await ready(page, 'list');
          assert.equal(await screen(page).count(), 1); assert.deepEqual(errors, []);
          const accessibilityTree = await page.locator('#app').ariaSnapshot();
          assert.ok(accessibilityTree.trim().length > 0, 'Mounted workflow must expose an accessibility tree');
          await fs.writeFile(path.join(cellRoot, 'accessibility-tree.txt'), accessibilityTree + '\n');
          cell.accessibilityTree = `${framework}/accessibility-tree.txt`;
          pass(activeGate, { screenCount: 1, errors: [...errors] });
          activeGate = 'hydration';
          const index = path.join(consumer, 'dist/index.html');
          const original = await fs.readFile(index, 'utf8');
          await fs.writeFile(index, original.replace('<div id="app"></div>', `<div id="app">${html}</div>`));
          await page.addInitScript(() => { const observer = new MutationObserver(() => { const node = document.querySelector('[data-oods-workflow]'); if (node && !(window as any).__ssrNode) (window as any).__ssrNode = node; }); observer.observe(document, { childList: true, subtree: true }); });
          await page.goto(url, { waitUntil: 'domcontentloaded' }); await ready(page, 'list');
          assert.equal(await page.evaluate(() => (window as any).__ssrNode === document.querySelector('[data-oods-workflow]')), true);
          assert.deepEqual(errors, []);
          pass(activeGate, { preservesSsrRoot: true, errors: [...errors] });
          await fs.writeFile(index, original);
          activeGate = 'interaction-evidence';
          const flow = await observeFlow(page, url, requireBillingViews, object, titleField, editProbe); cell.flow = flow;
          if (flow.some(row => row.status !== 'passed')) {
            await fs.writeFile(path.join(cellRoot, 'failure-accessibility-tree.txt'), await page.locator('#app').ariaSnapshot());
            await json(path.join(cellRoot, 'failure-fields.json'), await page.locator('input,textarea,select').evaluateAll(elements => elements.map(element => {
              const field = element as HTMLInputElement;
              return { id: field.id, name: field.name, value: field.value, required: field.required, valid: field.checkValidity() };
            })));
          }
          assert.equal(flow.some(row => row.name === 'address-save-persists' && row.status === 'passed'), requireAddressViews, 'Declared address editor must pass save and detail readback');
          await json(path.join(cellRoot, 'flow.json'), flow);
          assertWorkflowFlow(flow, requiredFlow);
          const states = await observeStates(page, url, framework); allStates.push(...states);
          await json(path.join(cellRoot, 'states.json'), states);
          const collectionControls = await observeCollectionControls(page, url, object, composition.schema);
          await json(path.join(cellRoot, 'collection-controls.json'), collectionControls);
          assert.ok(collectionControls.every(row => row.status === 'passed'), JSON.stringify(collectionControls));
          const images = await screenshots(page, url, output, framework, artifact.contentHash, requireBillingViews, object, titleField, requiredFlow, editProbe); allScreenshots.push(...images);
          await inspection?.({ page, url, output, framework, artifact, schema: composition.schema, object, requireBillingViews, titleField, requiredFlow, editProbe });
          assert.deepEqual(errors, []);
          pass(activeGate, { flowRows: flow.length, stateObservations: states.length, screenshots: images.length, errors });
          await page.close();
        });
      } catch (error) {
        Object.assign(gates.find((row) => row.name === activeGate)!, { status: 'failed', error: error instanceof Error ? error.message : String(error) });
        cell.error = error instanceof Error ? error.stack : String(error);
      }
      await json(path.join(cellRoot, 'receipt.json'), cell);
      process.stdout.write(`${framework}: ${gates.map((row) => `${row.name}=${row.status}`).join(', ')}\n`);
    }
    if (cells.every((cell) => (cell.gates as Row[]).every((gate) => gate.status === 'passed'))) {
      const consumer = consumers.get('react')!;
      const file = path.join(consumer, 'src/application.ts');
      const original = await fs.readFile(file, 'utf8');
      const needle = 'void navigate("detail", id);';
      assert.equal(original.split(needle).length - 1, 1);
      await fs.writeFile(file, original.replace(needle, ''));
      const mutated = await fs.readFile(file, 'utf8');
      const build = commandResult('npm', ['exec', '--', 'vite', 'build'], consumer, { scrubNpmCredentials: true, isolateDependencies: true });
      await json(path.join(output, 'bite-build.json'), build); requireGreen(build, 'navigation bite build');
      const page = await browser.newPage();
      page.setDefaultNavigationTimeout(120_000);
      const red = await withStaticServer(path.join(consumer, 'dist'), (url) => observeFlow(page, url, requireBillingViews, object, titleField, editProbe));
      assert.deepEqual(red.filter((row) => row.status === 'failed').map((row) => row.name), ['detail-navigation']);
      await fs.writeFile(file, original); assert.equal(digest(await fs.readFile(file)), digest(original));
      const restore = commandResult('npm', ['exec', '--', 'vite', 'build'], consumer, { scrubNpmCredentials: true, isolateDependencies: true }); requireGreen(restore, 'restore navigation');
      await json(path.join(output, 'bite-restore-build.json'), restore);
      const green = await withStaticServer(path.join(consumer, 'dist'), (url) => observeFlow(page, url, requireBillingViews, object, titleField, editProbe));
      assertWorkflowFlow(green, requiredFlow);
      const unaffected = await withStaticServer(path.join(consumers.get('vue')!, 'dist'), (url) => observeFlow(page, url, requireBillingViews, object, titleField, editProbe));
      assertWorkflowFlow(unaffected, requiredFlow);
      await json(path.join(output, 'navigation-bite.json'), { framework: 'react', source: 'src/application.ts', beforeHash: digest(original), afterHash: digest(mutated), restoredHash: digest(await fs.readFile(file)), red, restored: green, unaffectedFramework: 'vue', unaffected });
      await page.close();
    }
    const cellReports = await Promise.all(cells.map(async (cell) => ({ framework: cell.framework, report: `${cell.framework}/receipt.json`, sha256: digest(await fs.readFile(path.join(output, `${cell.framework}/receipt.json`))) })));
    const report = { mission, object, cellReports, sourceHead: sourceHead ?? commandResult('git', ['rev-parse', 'HEAD'], REPOSITORY_ROOT).stdout.trim(), builderSelfCertified: false, cells, stateObservations: allStates, screenshots: allScreenshots };
    await json(path.join(output, 'report.json'), report);
    return report;
  } finally {
    await browser.close();
    if (process.env.OODS_KEEP_WORKFLOW_CONSUMERS !== '1') for (const consumer of consumers.values()) await fs.rm(consumer, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = path.resolve(process.argv[2] ?? path.join(REPOSITORY_ROOT, 'artifacts/product-reality/sprint-188/m03/live'));
  runAppConsumers(output, process.argv[3], process.argv[4]).then((report) => { if (report.cells.some((cell) => (cell.gates as Row[]).some((gate) => gate.status !== 'passed'))) process.exitCode = 1; }).catch((error) => { process.stderr.write(String(error.stack ?? error) + '\n'); process.exitCode = 1; });
}
