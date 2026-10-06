import { describe, expect, it } from 'vitest';
import { handle as compose } from '../../src/tools/design.compose.js';
import { handle as generate } from '../../src/tools/code.generate.js';
import type { UiElement } from '../../src/schemas/generated.js';
import { typecheckWorkflow } from '../product-reality/workflow-typecheck.js';
import { validateGeneratedArtifact } from '../../src/codegen/artifact-envelope.js';
import { chronologicalEvents, formatDateTime } from '../../../component-contracts/src/date-time.js';

const walk = (nodes: UiElement[]): UiElement[] => nodes.flatMap(node => [node, ...walk(node.children ?? [])]);

describe('collection screens own the data presentation', () => {
  it('declares one row template and moves the billing and archive recipes into it', async () => {
    const result = await compose({ object: 'Subscription', context: 'list' });
    expect(result.validation?.status).toBe('ok');
    const nodes = walk(result.schema.screens);
    const collection = nodes.find(node => node.collection?.source === 'rows')!;
    expect(collection.collection).toEqual({ source: 'rows', keyField: 'subscription_id', labelField: 'plan_name' });
    const row = walk([collection]);
    for (const component of ['StatusBadge', 'RelativeTimestamp', 'BillingSummaryBadge', 'ArchivedRowOverlay']) {
      expect(row.filter(node => node.component === component), component).toHaveLength(1);
      expect(nodes.filter(node => node.component === component), `${component} cannot also be a toolbar summary`).toHaveLength(1);
    }
    expect(row.find(node => node.component === 'ArchivedRowOverlay')?.children?.[0]?.collectionControl).toBe('open');
    expect(nodes.find(node => node.collectionControl === 'filter')?.props?.label).toBe('Status');
    expect(nodes.filter(node => node.collectionControl === 'search')).toHaveLength(1);
    expect(nodes.filter(node => node.collectionControl === 'page')).toHaveLength(1);
    expect(result.schema.objectSchema).not.toHaveProperty('rows');
  });

  it('replaces fixed timeline slots with an event template and keeps the declared payment recipe', async () => {
    const result = await compose({ object: 'Subscription', context: 'timeline' });
    const nodes = walk(result.schema.screens);
    const collection = nodes.find(node => node.collection?.source === 'events')!;
    expect(collection.collection?.historyField).toBe('state_history');
    expect(nodes.filter(node => node.component === 'Card')).toHaveLength(1);
    expect(nodes.find(node => node.component === 'PaymentEventTimeline')?.collectionControl).toBe('payment-event');
    expect(nodes.find(node => node.id.endsWith('-title'))?.props?.field).toBe('plan_name');
    expect(nodes.filter(node => node.component === 'BillingSummaryBadge')).toHaveLength(1);
    expect(result.schema.objectSchema).not.toHaveProperty('events');
  });

  it('rejects a dangling record key instead of generating navigation with an undefined ID', async () => {
    const result = await compose({ object: 'Subscription', context: 'list' });
    walk(result.schema.screens).find(node => node.collection)!.collection!.keyField = 'missing_record_id';
    const generated = await generate({ schema: result.schema, framework: 'react', profile: 'build' });
    expect(generated.status).toBe('error');
    expect(generated.errors?.some(error => error.message.includes('missing_record_id'))).toBe(true);
  });

  it('rejects a mismatched control so its declared component cannot be silently discarded', async () => {
    const result = await compose({ object: 'Subscription', context: 'list' });
    walk(result.schema.screens).find(node => node.collectionControl === 'search')!.component = 'Text';
    const generated = await generate({ schema: result.schema, framework: 'vue', profile: 'build' });
    expect(generated.status).toBe('error');
    expect(generated.errors?.some(error => error.message.includes('requires SearchInput'))).toBe(true);
  });

  it.each(['react', 'vue'].flatMap(framework => ['list', 'timeline'].map(context => ({ framework, context }))) as Array<{ framework: 'react' | 'vue'; context: 'list' | 'timeline' }>)('$framework $context standalone props compile without a workflow or invented records', async ({ framework, context }) => {
    const composition = await compose({ object: 'Subscription', context });
    const result = await generate({ schema: composition.schema, framework, profile: 'build' });
    expect(result.status, JSON.stringify(result.errors)).toBe('ok');
    expect(validateGeneratedArtifact(result.artifact!)).toEqual([]);
    expect(result.code).toContain(context === 'list' ? 'rows?: Array<' : 'events?: CollectionEvent[]');
    expect(result.code).toContain(context === 'list' ? 'No records found.' : 'No events yet.');
    expect(result.code).not.toMatch(/>Filter<|>Open row<|>Sort<|No items|1 \/ 0/);
    const checked = typecheckWorkflow({ ...result.artifact!, files: [...result.artifact!.files, {
      path: 'tsconfig.json', contents: JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', strict: true, jsx: 'react-jsx', esModuleInterop: true, skipLibCheck: false, noEmit: true, lib: ['ES2022', 'DOM', 'DOM.Iterable'] }, include: ['src'] }),
    }] });
    expect(checked.status, checked.stdout + checked.stderr).toBe(0);
  }, 30_000);

  it.each(['react', 'vue'] as const)('%s App binds the composed collection instead of shipping a competing presentation', async framework => {
    const composition = await compose({ object: 'Subscription', context: 'workflow' });
    const result = await generate({ schema: composition.schema, framework, profile: 'build' });
    expect(result.status).toBe('ok');
    const app = result.artifact!.files.find(file => /src\/App\./.test(file.path))!.contents;
    expect(app).not.toMatch(/workflow-toolbar|workflow-records|workflow-history/);
    expect(app).toContain('records.map(screenProps)');
    expect(app).toContain('collectionEvents(');
    const application = result.artifact!.files.find(file => file.path === 'src/application.ts')!.contents;
    expect(application).toContain('void navigate("detail", id);');
    expect(result.artifact!.actions.map(action => action.name)).toContain('handlePageChange');
  });

  it.each(['react', 'vue'] as const)('%s JavaScript collection output has real runtime props and no TypeScript-only imports', async framework => {
    const composition = await compose({ object: 'Subscription', context: 'timeline' });
    const result = await generate({ schema: composition.schema, framework, profile: 'build', options: { typescript: false } });
    expect(result.status).toBe('ok');
    expect(result.code).not.toContain('type CollectionEvent');
    // s220-m01 (#2461): events passed by no consumer are the record's own; React defaults the prop, Vue reads timelineEvents().
    expect(result.code).toContain(framework === 'react' ? 'events = recordCollectionEvents({ state_history: stateHistory' : 'const timelineEvents = () => events ?? recordCollectionEvents(');
    const checked = typecheckWorkflow({ ...result.artifact!, files: [...result.artifact!.files, {
      path: 'tsconfig.json', contents: JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', allowJs: true, checkJs: false, jsx: 'react-jsx', esModuleInterop: true, skipLibCheck: false, noEmit: true }, include: ['src'] }),
    }] });
    expect(checked.status, checked.stdout + checked.stderr).toBe(0);
  }, 30_000);

  it('formats instants with an explicit UTC policy and allows callers to select their locale and zone', () => {
    expect(formatDateTime('2026-09-08T12:00:00.000Z')).toBe('Sep 8, 2026, 12:00 PM');
    expect(formatDateTime('2026-09-08T12:00:00.000Z', { timeZone: 'America/Chicago' })).toBe('Sep 8, 2026, 7:00 AM');
    expect(formatDateTime('invalid')).toBe('');
    expect(formatDateTime(null)).toBe('');
  });

  it('merges event sources chronologically, preserves ties and does not mutate the caller', () => {
    const events = [
      { id: 'later', title: 'Cancelled', at: '2026-09-08T12:00:00Z', description: '', kind: 'state' as const },
      { id: 'payment', title: 'Paid', at: '2026-09-01T12:00:00Z', description: '', kind: 'payment' as const },
      { id: 'same', title: 'Updated', at: '2026-09-08T12:00:00Z', description: '', kind: 'state' as const },
      { id: 'invalid', title: 'Invalid', at: 'invalid', description: '', kind: 'state' as const },
    ];
    expect(chronologicalEvents(events).map(event => event.id)).toEqual(['payment', 'later', 'same']);
    expect(events[0].id).toBe('later');
  });
});
