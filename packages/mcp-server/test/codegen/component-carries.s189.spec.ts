import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRequire } from 'node:module';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import { workflowDataFiles } from '../../src/codegen/workflow-data-emitter.js';
import { renderMappedComponent } from '../../src/render/component-map.js';
import * as ReactComponents from '../../../components-react/src/index.js';
import { typecheckWorkflow } from '../product-reality/workflow-typecheck.js';
const vueRequire = createRequire(new URL('../../../components-vue/package.json', import.meta.url));
const { h } = vueRequire('vue');
const { renderToString } = vueRequire('@vue/server-renderer');
const VueComponents = vueRequire('@oods/components-vue');
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

describe('component carries preserve the same meaning in every target', () => {
  it.each(['StatusTimeline', 'AuditTimeline'] as const)('%s has identical two-entry labels, dates, actors and reasons in all three targets', async component => {
    const props = { ...(component === 'StatusTimeline' ? { status: 'pending_cancellation', allowedTransitions: ['active', 'terminated'] } : {}), events: [
      { from: null, to: 'active', at: '2026-09-01T12:00:00Z', reason: 'Created', actorId: 'operator-1' },
      { from: 'active', to: 'pending_cancellation', at: '2026-09-08T12:00:00Z', reason: 'Budget', actorId: 'operator-2' },
    ] };
    const before = JSON.stringify(props);
    for (const options of [{}, { showActorId: false, showReason: false, maxVisible: 1 }]) {
      const values = { ...props, ...options };
      const html = text(renderMappedComponent({ id: 'history', component, props: values }, '')!);
      expect(text(renderToStaticMarkup(createElement(ReactComponents[component], values)))).toBe(html);
      expect(text(await renderToString(h(VueComponents[component], values)))).toBe(html);
      // Human-facing fallback labels change; the event's raw domain values must not.
      if (!Object.keys(options).length) { expect(html).toContain('Active → Pending Cancellation'); expect(html).not.toContain('active → pending_cancellation'); expect(html).toContain('Reason: Budget'); }
      expect(JSON.stringify(props)).toBe(before);
    }
  });
  it.each([1, 9])('uses the correct noun for %i records in both generated targets', async totalItems => {
    const props = { totalItems, pageSize: 10, page: 1 };
    const expected = `${totalItems} ${totalItems === 1 ? 'record' : 'records'}`;
    expect(text(renderToStaticMarkup(createElement(ReactComponents.PaginationBar, props)))).toContain(expected);
    expect(text(await renderToString(h(VueComponents.PaginationBar, props)))).toContain(expected);
  });
});

describe('ten seeded records retain declared values without fabricated periods', () => {
  it('keeps unique keys and declared lifecycle values without inferred payment or cancellation events', async () => {
    const { schema } = await compose({ object: 'Subscription', context: 'workflow' });
    const source = workflowDataFiles(schema).find(file => file.path === 'src/sample-data.ts')!.contents;
    const records = JSON.parse(source.slice(source.indexOf(' = ') + 3).replace(/;\s*$/, ''));
    // s222-m03 (#2502 ruling 14): one seeded record per authored sample (eight), each with its own authored key.
    expect(records).toHaveLength(8);
    expect(new Set(records.map((record: any) => record.subscription_id)).size).toBe(8);
    // s219-m01: Subscription authors coherent samples. Each seeded record carries exactly its own authored
    // payments, history and cancellation time, matched by its key (s222-m03: customers now share plans); nothing is
    // inferred beyond them.
    const examples = (field: string) => schema.objectSchema![field]!.examples!;
    for (const record of records) {
      expect(schema.objectSchema!.status!.enum).toContain(record.status);
      const authored = examples('subscription_id').indexOf(record.subscription_id);
      expect(authored).toBeGreaterThanOrEqual(0);
      expect(record.payment_history).toEqual(examples('payment_history')[authored]);
      expect(record.state_history).toEqual(examples('state_history')[authored]);
      expect(record.cancellation_requested_at ?? null).toEqual(examples('cancellation_requested_at')[authored]);
    }
  });
  it.each(['react', 'vue'] as const)('%s workflow accepts optional absent cancellation metadata', async framework => {
    const { schema } = await compose({ object: 'Subscription', context: 'workflow' });
    const generated = await generate({ schema, framework, profile: 'build' });
    expect(generated.status, JSON.stringify(generated.errors)).toBe('ok');
    const result = typecheckWorkflow(generated.artifact!);
    expect(result.status, result.stdout + result.stderr).toBe(0);
  }, 30_000);
});
