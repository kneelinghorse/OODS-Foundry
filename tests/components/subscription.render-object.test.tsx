import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Fragment, createElement } from 'react';
import type { ReactNode } from 'react';
import { RenderObject } from '../../src/components/RenderObject.js';
import { buildRenderContext } from '../../src/context/buildRenderContext.js';
import { composeExtensions } from '../../src/compositor/composeExtensions.js';
import { resolveTraitExtensions } from '../../src/traits/adapter.js';
import { REGION_ORDER } from '../../src/types/regions.js';
import { createSubscriptionObjectSpec } from '../../src/objects/subscription/object.js';
import type { SubscriptionRecord } from '../../src/objects/subscription/types.js';
import activeSubscription from '../../src/fixtures/subscription/active.json';
import pastDueSubscription from '../../src/fixtures/subscription/past_due.json';
import cancelSubscription from '../../src/fixtures/subscription/active_cancel_at_period_end.json';
import type { ContextKind } from '../../src/contexts/index.js';
import { collectContributionExtensions } from '../../src/engine/contributions/index.js';

const Active = activeSubscription as SubscriptionRecord;
const PastDue = pastDueSubscription as SubscriptionRecord;
const CancelAtPeriodEnd = cancelSubscription as SubscriptionRecord;

const SubscriptionObject = createSubscriptionObjectSpec();

function renderRegionContent(content: ReactNode): string {
  if (content === undefined || content === null || content === false) {
    return '';
  }

  return renderToStaticMarkup(createElement(Fragment, null, content));
}

function renderContextMarkup(
  data: SubscriptionRecord,
  view: ContextKind = 'detail'
): Record<string, string> {
  const context = buildRenderContext<SubscriptionRecord>({
    object: SubscriptionObject,
    data,
  });
  const baseExtensions = resolveTraitExtensions(SubscriptionObject, context);
  const contributionExtensions = collectContributionExtensions<SubscriptionRecord>({
    object: SubscriptionObject,
    context: view,
    renderContext: context,
  });
  const regions = composeExtensions(
    [...baseExtensions, ...contributionExtensions],
    context
  );

  return REGION_ORDER.reduce<Record<string, string>>((result, region) => {
    result[region] = renderRegionContent(regions[region]);
    return result;
  }, {});
}

describe('Subscription view integration', () => {
  it('renders across contexts without throwing', () => {
    const markup = renderToStaticMarkup(
      createElement(RenderObject, {
        object: SubscriptionObject,
        context: 'detail',
        data: Active,
      })
    );

    expect(markup).toContain('data-view-context="detail"');
  });

  it('renders expected status badges per fixture', () => {
    const activeMarkup = renderContextMarkup(Active);
    const pastDueMarkup = renderContextMarkup(PastDue);
    const cancelMarkup = renderContextMarkup(CancelAtPeriodEnd);

    expect(activeMarkup.pageHeader).toMatchSnapshot('pageHeader-active');
    expect(pastDueMarkup.pageHeader).toMatchSnapshot('pageHeader-past-due');
    expect(cancelMarkup.pageHeader).toMatchSnapshot('pageHeader-cancel-at-period-end');
  });

  it('shows update payment action only for past due subscriptions', () => {
    const activeMarkup = renderContextMarkup(Active);
    const pastDueMarkup = renderContextMarkup(PastDue);
    const cancelMarkup = renderContextMarkup(CancelAtPeriodEnd);

    expect(pastDueMarkup.viewToolbar).toContain('Update payment');
    expect(activeMarkup.viewToolbar).not.toContain('Update payment');
    expect(cancelMarkup.viewToolbar).not.toContain('Update payment');

    expect(pastDueMarkup.viewToolbar).toMatchSnapshot('viewToolbar-past-due-action');
  });

  it('renders cancellation banner only when scheduled at period end', () => {
    const activeMarkup = renderContextMarkup(Active);
    const cancelMarkup = renderContextMarkup(CancelAtPeriodEnd);

    expect(cancelMarkup.main).toContain('Cancellation scheduled at period end');
    expect(cancelMarkup.main).toMatchSnapshot('main-cancel-at-period-end');
    expect(activeMarkup.main).not.toContain('Cancellation scheduled at period end');
  });

  it('includes renewal summary and progress indicator', () => {
    const activeMarkup = renderContextMarkup(Active);

    expect(activeMarkup.main).toContain('Renews on');
    expect(activeMarkup.main).toContain('Billing');
    expect(activeMarkup.main).toMatchSnapshot('main-renewal-summary');
  });
});
