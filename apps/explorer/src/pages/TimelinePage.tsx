import '../styles/index.css';
import { StatusChip } from '../components/StatusChip';

type TimelineTone = 'success' | 'warning' | 'info' | 'neutral' | 'critical';

type TimelineEvent = {
  id: string;
  tone: TimelineTone;
  time: string;
  displayTime: string;
  title: string;
  description: string;
  status: { domain: 'subscription' | 'invoice'; value: string } | null;
  meta: { label: string; value: string }[];
};

const TIMELINE_EVENTS: TimelineEvent[] = [
  {
    id: 'payment-settled',
    tone: 'success',
    time: '2025-07-11T14:26:00Z',
    displayTime: '2:26 PM',
    title: 'Payment settled • Invoice INV-2046',
    description: 'ACH settlement posted; receipt emailed to billing@acmeanalytics.com.',
    status: { domain: 'invoice', value: 'paid' },
    meta: [
      { label: 'Actor', value: 'Finance automation' },
      { label: 'Amount', value: '$2,840.00' }
    ]
  },
  {
    id: 'usage-spike',
    tone: 'info',
    time: '2025-07-10T08:05:00Z',
    displayTime: '8:05 AM',
    title: 'Usage spike detected',
    description:
      'API throughput exceeded baseline by 42% over the last 24 hours. Quota notifications sent to account team.',
    status: { domain: 'subscription', value: 'active' },
    meta: [
      { label: 'Actor', value: 'Usage monitor' },
      { label: 'Threshold', value: '> 120 req/s for 3 hrs' }
    ]
  },
  {
    id: 'renewal-briefing',
    tone: 'neutral',
    time: '2025-07-09T16:20:00Z',
    displayTime: '4:20 PM',
    title: 'Renewal briefing scheduled',
    description: 'Customer success scheduled a renewal preparation briefing with finance and solutions engineering.',
    status: null,
    meta: [
      { label: 'Actor', value: 'Leslie Alexander' },
      { label: 'Meeting', value: 'Jul 18 • 45 minutes' }
    ]
  },
  {
    id: 'dunning-warning',
    tone: 'warning',
    time: '2025-07-07T11:45:00Z',
    displayTime: '11:45 AM',
    title: 'Past-due warning triggered',
    description:
      'Primary card declined twice. Dunning workflow escalated and finance notified to follow up with customer billing.',
    status: { domain: 'invoice', value: 'past_due' },
    meta: [
      { label: 'Actor', value: 'Billing automation' },
      { label: 'Attempts', value: '2 retries' }
    ]
  },
  {
    id: 'pilot-success',
    tone: 'success',
    time: '2025-07-04T09:15:00Z',
    displayTime: '9:15 AM',
    title: 'Pilot expansion approved',
    description: 'Legal approved the premium analytics add-on pilot; rollout staged for August 01 activation.',
    status: { domain: 'subscription', value: 'future' },
    meta: [
      { label: 'Actor', value: 'Legal • Eleanor Pena' },
      { label: 'Effective', value: 'Aug 01, 2025' }
    ]
  }
];

const TimelinePage = () => (
  <div className="explorer-view context-timeline timeline-view" data-context="timeline" data-testid="timeline-page">
    <nav className="timeline-breadcrumbs" data-region="breadcrumbs" aria-label="Timeline trail">
      <ol>
        <li>
          <a href="#accounts">Accounts</a>
        </li>
        <li>
          <a href="#acme">Acme Analytics</a>
        </li>
        <li aria-current="page">
          <span>Activity timeline</span>
        </li>
      </ol>
    </nav>

    <header className="timeline-header" data-region="header">
      <div>
        <p className="view-eyebrow">Lifecycle • SaaS</p>
        <h1 className="view-title">Customer activity timeline</h1>
        <p className="view-caption">
          Timeline context compacts the vertical rhythm while time badges + markers stay legible. No conditional logic—
          classes + data attributes drive surfaces and typography.
        </p>
      </div>

      <dl className="timeline-header__meta" data-region="meta">
        <div>
          <dt>Events (30d)</dt>
          <dd>18</dd>
        </div>
        <div>
          <dt>Escalations</dt>
          <dd>2 open</dd>
        </div>
        <div>
          <dt>Upcoming renewals</dt>
          <dd>1 contract</dd>
        </div>
      </dl>
    </header>

    <div className="timeline-toolbar" data-region="actions" role="toolbar" aria-label="Timeline filters">
      <div className="timeline-toolbar__filters" role="group" aria-label="Event types">
        <button type="button" className="timeline-toolbar__chip timeline-toolbar__chip--active">
          All
        </button>
        <button type="button" className="timeline-toolbar__chip">Billing</button>
        <button type="button" className="timeline-toolbar__chip">Usage</button>
        <button type="button" className="timeline-toolbar__chip">Success</button>
      </div>
      <div className="timeline-toolbar__range">
        <span>Range: <strong>Last 30 days</strong></span>
      </div>
    </div>

    <main className="timeline-main" data-region="body">
      <ol className="timeline-stream" data-region="timeline">
        {TIMELINE_EVENTS.map((event) => (
          <li key={event.id} className="timeline-item" data-tone={event.tone}>
            <div className="timeline-item__marker" aria-hidden>
              <span className="timeline-item__dot" />
            </div>

            <article className="timeline-item__card">
              <header className="timeline-item__header">
                <time className="timeline-item__time" dateTime={event.time}>
                  {event.displayTime}
                </time>
                {event.status ? (
                  <StatusChip status={event.status.value} domain={event.status.domain} context="timeline" />
                ) : null}
              </header>

              <h3 className="timeline-item__title">{event.title}</h3>
              <p className="timeline-item__description">{event.description}</p>

              <dl className="timeline-item__meta">
                {event.meta.map((entry) => (
                  <div key={`${event.id}-${entry.label.toLowerCase().replace(/\s+/g, '-')}`}>
                    <dt>{entry.label}</dt>
                    <dd>{entry.value}</dd>
                  </div>
                ))}
              </dl>
            </article>
          </li>
        ))}
      </ol>
    </main>

    <aside className="timeline-sidebar" data-region="sidebar" aria-label="Timeline analytics">
      <section className="timeline-sidebar__section">
        <h2>Event composition</h2>
        <ul>
          <li>
            <span>Billing</span>
            <strong>8</strong>
          </li>
          <li>
            <span>Usage</span>
            <strong>4</strong>
          </li>
          <li>
            <span>Success</span>
            <strong>6</strong>
          </li>
        </ul>
      </section>
      <section className="timeline-sidebar__section">
        <h2>Highlights</h2>
        <p>
          Timeline defaults keep badges compact (<code>timeline:timeline:gap-2</code>) and align metadata with the same
          rhythm as stream items—no bespoke component overrides required.
        </p>
      </section>
    </aside>
  </div>
);

export default TimelinePage;
