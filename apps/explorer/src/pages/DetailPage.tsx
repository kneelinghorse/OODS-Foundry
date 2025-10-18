import '../styles/index.css';
import { StatusChip } from '../components/StatusChip';
import { ensureDomainInContext, pickStatusByIndex } from '../config/statusMap';

type InvoiceEntry = {
  id: string;
  status: string;
  total: string;
  due: string;
  note: string;
};

const INVOICE_HISTORY: InvoiceEntry[] = [
  {
    id: 'INV-2047',
    status: 'open',
    total: '$2,840.00',
    due: 'Aug 01, 2025',
    note: 'Auto-collection scheduled for Jul 28.'
  },
  {
    id: 'INV-2046',
    status: 'processing',
    total: '$2,840.00',
    due: 'Jul 01, 2025',
    note: 'ACH payment initiated by customer finance.'
  },
  {
    id: 'INV-2045',
    status: 'paid',
    total: '$2,840.00',
    due: 'Jun 01, 2025',
    note: 'Cleared via Stripe on Jun 02.'
  },
  {
    id: 'INV-2044',
    status: 'past_due',
    total: '$1,240.00',
    due: 'Apr 15, 2025',
    note: 'Auto-write off postponed pending customer request.'
  }
];

ensureDomainInContext('detail', 'subscription');
ensureDomainInContext('detail', 'invoice');

const CURRENT_SUBSCRIPTION_STATUS = pickStatusByIndex('subscription', 2);
const CURRENT_INVOICE_STATUS = pickStatusByIndex('invoice', 3);

const DetailPage = () => (
  <div className="explorer-view context-detail detail-view" data-context="detail" data-testid="detail-page">
    <header className="detail-header" data-region="header">
      <div>
        <p className="view-eyebrow">Customer • SaaS</p>
        <h1 className="view-title">Acme Analytics — Scale Plan</h1>
        <p className="view-caption">
          Context class flips typography/density versus list. Status chips reuse the same component and mapping—no
          conditional styling required.
        </p>
      </div>

      <div className="detail-header__badges">
        <StatusChip status={CURRENT_SUBSCRIPTION_STATUS} domain="subscription" context="detail" />
        <StatusChip status={CURRENT_INVOICE_STATUS} domain="invoice" context="detail" />
      </div>
    </header>

    <section className="detail-summary" data-region="meta">
      <article>
        <h2>Account Owner</h2>
        <p className="detail-summary__value">Leslie Alexander</p>
        <p className="detail-summary__hint">Assigned Feb 12, 2025 • Product tier Scale</p>
      </article>
      <article>
        <h2>Health Score</h2>
        <p className="detail-summary__value detail-summary__value--positive">92</p>
        <p className="detail-summary__hint">Churn risk &lt; 3% • Usage trending upward</p>
      </article>
      <article>
        <h2>ARR</h2>
        <p className="detail-summary__value">$34,080</p>
        <p className="detail-summary__hint">Annual contract • Net 30 payment terms</p>
      </article>
    </section>

    <main className="detail-body detail:body:gap-6 list:body:gap-3" data-region="body">
      <article className="detail-panel">
        <header>
          <h2>Account Notes</h2>
          <p>Prepared by Customer Success • Updated Jun 09, 2025</p>
        </header>
        <ul>
          <li>Migration from legacy analytics completed with zero downtime.</li>
          <li>Feature adoption workshop scheduled with data team Jul 18.</li>
          <li>Retention incentive approved—offer 10% expansion credit on renew.</li>
        </ul>
      </article>

      <article className="detail-panel">
        <header>
          <h2>Usage Snapshot</h2>
          <p>Target health threshold 25 sessions/day.</p>
        </header>
        <dl className="detail-grid">
          <div>
            <dt>Active Seats</dt>
            <dd>142 / 150</dd>
          </div>
          <div>
            <dt>Dashboards</dt>
            <dd>64 created</dd>
          </div>
          <div>
            <dt>Workflows</dt>
            <dd>28 automated</dd>
          </div>
          <div>
            <dt>Alerts</dt>
            <dd>4 configured</dd>
          </div>
        </dl>
      </article>
    </main>

    <aside className="detail-sidebar" data-region="sidebar" aria-label="Invoice history">
      <h2>Recent Invoices</h2>
      <ul>
        {INVOICE_HISTORY.map((invoice) => (
          <li key={invoice.id} className="invoice-row">
            <div className="invoice-row__meta">
              <span className="invoice-row__id">{invoice.id}</span>
              <span className="invoice-row__total">{invoice.total}</span>
            </div>
            <div className="invoice-row__status">
              <StatusChip status={invoice.status} domain="invoice" context="detail" />
              <span className="invoice-row__due">{invoice.due}</span>
            </div>
            <p className="invoice-row__note">{invoice.note}</p>
          </li>
        ))}
      </ul>
    </aside>
  </div>
);

export default DetailPage;
