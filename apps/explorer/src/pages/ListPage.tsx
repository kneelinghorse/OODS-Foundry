import '../styles/index.css';
import { StatusChip } from '../components/StatusChip';

type SubscriptionRow = {
  id: string;
  account: string;
  plan: string;
  mrr: string;
  renewal: string;
  status: string;
  owner: string;
};

const SUBSCRIPTIONS: SubscriptionRow[] = [
  {
    id: 'sub-001',
    account: 'Acme Analytics',
    plan: 'Scale • Annual',
    mrr: '$2,840',
    renewal: 'Renews Aug 01',
    status: 'active',
    owner: 'Leslie Alexander'
  },
  {
    id: 'sub-002',
    account: 'Northwind Finance',
    plan: 'Plus • Quarterly',
    mrr: '$1,240',
    renewal: 'Past due • 7 days',
    status: 'past_due',
    owner: 'Devon Lane'
  },
  {
    id: 'sub-003',
    account: 'Lumen Retail',
    plan: 'Starter • Monthly',
    mrr: '$320',
    renewal: 'Ends Jun 30',
    status: 'trialing',
    owner: 'Brooklyn Simmons'
  },
  {
    id: 'sub-004',
    account: 'Evergreen Foods',
    plan: 'Scale • Annual',
    mrr: '$4,125',
    renewal: 'Paused by finance',
    status: 'paused',
    owner: 'Courtney Henry'
  },
  {
    id: 'sub-005',
    account: 'Signal Supply Co.',
    plan: 'Plus • Monthly',
    mrr: '$980',
    renewal: 'Cancels Jul 14',
    status: 'pending_cancellation',
    owner: 'Bessie Cooper'
  },
  {
    id: 'sub-006',
    account: 'Brightside Media',
    plan: 'Starter • Monthly',
    mrr: '$210',
    renewal: 'Starts Jul 01',
    status: 'future',
    owner: 'Jenny Wilson'
  },
  {
    id: 'sub-007',
    account: 'Atlas Manufacturing',
    plan: 'Legacy • Annual',
    mrr: '$0',
    renewal: 'Ended May 04',
    status: 'canceled',
    owner: 'Wade Warren'
  }
];

const ListPage = () => (
  <div className="explorer-view context-list list-view" data-context="list" data-testid="list-page">
    <header className="view-header" data-region="header">
      <div className="view-header__text">
        <p className="view-eyebrow">Subscriptions</p>
        <h1 className="view-title">Customer Health Overview</h1>
        <p className="view-caption">
          Status chips below are backed by protocol tokens—flip to detail view to see typography and density shift via
          context classes.
        </p>
      </div>

      <dl className="view-metrics" data-region="meta">
        <div>
          <dt>Active ARR</dt>
          <dd>$6.2M</dd>
        </div>
        <div>
          <dt>At Risk</dt>
          <dd>12 accounts</dd>
        </div>
        <div>
          <dt>Trials</dt>
          <dd>34 running</dd>
        </div>
      </dl>
    </header>

    <section
      className="list-board detail:body:gap-4 list:body:gap-2"
      data-region="body"
      aria-label="Subscription list"
    >
      {SUBSCRIPTIONS.map((subscription) => (
        <article key={subscription.id} className="list-card" data-item="true">
          <div className="list-card__heading">
            <div className="list-card__identity">
              <span className="list-card__name">{subscription.account}</span>
              <span className="list-card__plan">{subscription.plan}</span>
            </div>
            <StatusChip status={subscription.status} domain="subscription" context="list" />
          </div>

          <dl className="list-card__meta">
            <div>
              <dt>MRR</dt>
              <dd>{subscription.mrr}</dd>
            </div>
            <div>
              <dt>Renewal</dt>
              <dd>{subscription.renewal}</dd>
            </div>
            <div>
              <dt>CS Owner</dt>
              <dd>{subscription.owner}</dd>
            </div>
          </dl>
        </article>
      ))}
    </section>
  </div>
);

export default ListPage;
