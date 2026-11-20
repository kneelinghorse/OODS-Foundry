/**
 * s249-m04 (next step 1869): `active` takes the info tone and a dot, not the success tone and its check: an active
 * record is live, not done. Its words stay "Active." A subscription's own table keeps its success tone and its words,
 * since a paid, provisioned subscription is the success that table describes. A related row reads the table its own
 * object's badge reads, so an active grant listed on another page is described as active, never as a paid subscription.
 */
import { describe, expect, it } from 'vitest';
import { getStatusPresentation } from '../src/status-registry.js';
import { relatedStateLabel, resolveRelatedListRows, type RelatedList, type RelatedObject } from '../src/related-lists.js';

describe('active reads as live, not done (1869)', () => {
  it('takes the info tone and the active dot in the lifecycle table, with its words unchanged', () => {
    const active = getStatusPresentation('lifecycle', 'active');
    expect({ tone: active.tone, icon: active.iconName, description: active.description, label: active.label })
      .toEqual({ tone: 'info', icon: 'icon.status.active', description: 'Active.', label: 'Active' });
  });

  it('keeps the success tone and words in a subscription\'s own table', () => {
    const active = getStatusPresentation('subscription', 'active');
    expect(active.tone).toBe('success');
    expect(active.description).toMatch(/^Subscription is paid/);
  });
});

describe('a related row reads its own object\'s status table', () => {
  const list: RelatedList = { id: 'held', label: 'Held for {name}', empty: 'Nothing is held for {name}.', sources: [{ from: ['Grant', 'Subscription'], via: 'holder_id' }] } as RelatedList;
  const subject: RelatedObject = { name: 'Person', key: 'id', titleField: 'name' };
  const objects: Record<string, RelatedObject> = {
    Grant: { name: 'Grant', key: 'id', titleField: 'name', records: [{ id: 'g1', name: 'Orders', status: 'active', holder_id: 'p1' }] },
    Subscription: { name: 'Subscription', key: 'id', titleField: 'name', statusDomain: 'subscription', records: [{ id: 's1', name: 'Team plan', status: 'paused', holder_id: 'p1' }] },
  };

  it('names the lifecycle table for an object that names none, and the object\'s own table where it names one', () => {
    const resolved = resolveRelatedListRows(list, subject, { id: 'p1', name: 'Dana' }, objects);
    const rows = Object.fromEntries(resolved.rows.map(row => [row.object, row]));
    expect(rows.Grant).toMatchObject({ state: 'active', stateDomain: 'lifecycle', stateLabel: getStatusPresentation('lifecycle', 'active').label });
    expect(rows.Subscription).toMatchObject({ state: 'paused', stateDomain: 'subscription', stateLabel: 'Paused' });
  });

  it('reads a state\'s words from the lifecycle table unless told another, in sentence case as a record\'s own list does', () => {
    expect(relatedStateLabel('active')).toBe('Active');
    expect(getStatusPresentation('lifecycle', 'OK').label).toBe('OK');
    expect(relatedStateLabel('needs_input')).toBe('Needs input');
    expect(getStatusPresentation('lifecycle', 'needs_input').label).toBe('Needs input');
    expect(relatedStateLabel('pending_cancellation', 'subscription')).toBe('Pending cancellation');
  });
});
