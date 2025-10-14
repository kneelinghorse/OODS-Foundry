import type { FC } from 'react';
import { RenderObject, type ContextKind } from '../../src/components/RenderObject.js';
import type { RenderObjectProps } from '../../src/components/RenderObject.js';
import { listContextKinds } from '../../src/contexts/index.js';
import { UserObject } from '../../src/objects/user/object.js';
import type { UserRecord } from '../../src/objects/user/types.js';
import { SubscriptionObject } from '../../src/objects/subscription/object.js';
import type { SubscriptionRecord } from '../../src/objects/subscription/types.js';
import userActiveFixture from '../../src/fixtures/user/active.json';
import subscriptionActiveFixture from '../../src/fixtures/subscription/active.json';
import subscriptionPastDueFixture from '../../src/fixtures/subscription/past_due.json';
import subscriptionCancelFixture from '../../src/fixtures/subscription/active_cancel_at_period_end.json';

const CONTEXTS: ContextKind[] = listContextKinds();

const userActive = userActiveFixture as UserRecord;

interface SubscriptionScenario {
  readonly title: string;
  readonly data: SubscriptionRecord;
}

const subscriptionScenarios: SubscriptionScenario[] = [
  {
    title: 'Active',
    data: subscriptionActiveFixture as SubscriptionRecord,
  },
  {
    title: 'Past Due',
    data: subscriptionPastDueFixture as SubscriptionRecord,
  },
  {
    title: 'Active · Cancel At Period End',
    data: subscriptionCancelFixture as SubscriptionRecord,
  },
];

type UserRenderProps = RenderObjectProps<UserRecord>;
type SubscriptionRenderProps = RenderObjectProps<SubscriptionRecord>;

const UserRenderObject = RenderObject as FC<UserRenderProps>;
const SubscriptionRenderObject = RenderObject as FC<SubscriptionRenderProps>;

export function Sprint03Demo() {
  return (
    <div
      className="sprint03-demo grid gap-8 p-6"
      style={{
        display: 'grid',
        gap: '2rem',
        padding: '1.5rem',
      }}
    >
      <header>
        <h1>Sprint 03 — Trait Composition Demo</h1>
        <p>
          User and Subscription objects rendered across every OODS context with debug reports
          enabled.
        </p>
      </header>

      <section aria-labelledby="user-contexts">
        <h2 id="user-contexts">User Object — Context Sweep</h2>
        <div
          className="grid gap-6"
          style={{
            display: 'grid',
            gap: '1.5rem',
          }}
        >
          {CONTEXTS.map((context) => (
            <article
              key={`user-${context}`}
              aria-label={`User context: ${context}`}
              style={{
                display: 'grid',
                gap: '1rem',
              }}
            >
              <h3 style={{ textTransform: 'capitalize' }}>{context}</h3>
              <UserRenderObject
                object={UserObject}
                context={context}
                data={userActive}
                debug
              />
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="subscription-contexts">
        <h2 id="subscription-contexts">Subscription — Detail States</h2>
        <div
          className="grid gap-6"
          style={{
            display: 'grid',
            gap: '1.5rem',
          }}
        >
          {subscriptionScenarios.map(({ title, data }) => (
            <article
              key={`subscription-${title}`}
              aria-label={`Subscription scenario: ${title}`}
              style={{
                display: 'grid',
                gap: '1rem',
              }}
            >
              <h3>{title}</h3>
              <SubscriptionRenderObject
                object={SubscriptionObject}
                context="detail"
                data={data}
                debug
              />
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export default Sprint03Demo;
