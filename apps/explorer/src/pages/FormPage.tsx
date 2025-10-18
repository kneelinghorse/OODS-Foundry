import '../styles/index.css';
import { StatusChip } from '../components/StatusChip';
import { ensureDomainInContext, pickStatusByIndex, selectStatuses } from '../config/statusMap';

ensureDomainInContext('form', 'subscription');
ensureDomainInContext('form', 'invoice');

const [FORM_DRAFT_STATUS, FORM_PROCESSING_STATUS] = selectStatuses('form', 'invoice', [0, 3]);
const [FORM_ACTIVE_STATUS] = selectStatuses('form', 'subscription', [2]);

const REVIEW_STATES = [
  { id: 'validation', label: 'Validation pending', status: pickStatusByIndex('invoice', 3), domain: 'invoice' as const },
  { id: 'approver', label: 'Needs legal sign-off', status: pickStatusByIndex('invoice', 0), domain: 'invoice' as const },
  { id: 'pilot', label: 'Trial expansion enabled', status: pickStatusByIndex('subscription', 1), domain: 'subscription' as const }
] as const;

const FormPage = () => (
  <div className="explorer-view context-form form-view" data-context="form" data-testid="form-page">
    <nav className="form-breadcrumbs" data-region="breadcrumbs" aria-label="Create subscription path">
      <ol>
        <li>
          <a href="#subscriptions">Subscriptions</a>
        </li>
        <li>
          <a href="#accounts">Acme Analytics</a>
        </li>
        <li aria-current="page">
          <span>Create subscription</span>
        </li>
      </ol>
    </nav>

    <header className="form-header" data-region="header">
      <div className="form-header__text">
        <p className="view-eyebrow">Subscription • SaaS</p>
        <h1 className="view-title">Create expansion contract</h1>
        <p className="view-caption">
          Form context applies spacing + typography through class bindings—the inputs below stay pure components while
          context tokens drive density, validation states, and CTA prominence.
        </p>
      </div>

      <dl className="form-header__meta" data-region="meta">
        <div>
          <dt>Annual contract value</dt>
          <dd>$48,200</dd>
        </div>
        <div>
          <dt>Expansion target</dt>
          <dd>+34%</dd>
        </div>
        <div>
          <dt>Renewal date</dt>
          <dd>Sep 01, 2025</dd>
        </div>
      </dl>
    </header>

    <div className="form-toolbar" data-region="actions" role="toolbar" aria-label="Form progress">
      <div className="form-toolbar__steps" role="group" aria-label="Checklist">
        <StatusChip status={FORM_DRAFT_STATUS} domain="invoice" context="form" />
        <StatusChip status={FORM_PROCESSING_STATUS} domain="invoice" context="form" />
        <StatusChip status={FORM_ACTIVE_STATUS} domain="subscription" context="form" />
      </div>
      <div className="form-toolbar__summary">
        <span className="form-toolbar__summary-step">Step 2 of 3</span>
        <span>Line items locked after submission.</span>
      </div>
    </div>

    <main className="form-main" data-region="body">
      <form className="form-shell" noValidate>
        <section className="form-section" aria-labelledby="section-account">
          <header className="form-section__header">
            <h2 id="section-account">Account details</h2>
            <p>Customer identity and commercial summary—validation ensures verified contacts and compliant pricing.</p>
          </header>

          <div className="form-grid">
            <div className="form-field" data-state="valid">
              <label className="form-field__label" htmlFor="account-name">
                Customer name
              </label>
              <input
                id="account-name"
                name="accountName"
                className="form-field__control"
                type="text"
                defaultValue="Acme Analytics"
              />
              <p className="form-field__hint">Fetched from CRM • editable before submission.</p>
            </div>

            <div className="form-field" data-state="error">
              <label className="form-field__label" htmlFor="account-email">
                Billing contact email
              </label>
              <input
                id="account-email"
                name="accountEmail"
                className="form-field__control"
                type="email"
                defaultValue="billing@acme"
                aria-invalid="true"
                aria-describedby="account-email-error"
              />
              <p className="form-field__message" id="account-email-error" role="alert">
                Use a verified domain (example: <strong>@acmeanalytics.com</strong>).
              </p>
            </div>

            <div className="form-field" data-state="info">
              <label className="form-field__label" htmlFor="account-owner">
                Growth owner
              </label>
              <input
                id="account-owner"
                name="accountOwner"
                className="form-field__control"
                type="text"
                defaultValue="Leslie Alexander"
                aria-describedby="account-owner-info"
              />
              <p className="form-field__message" id="account-owner-info" role="note">
                Automatically routes to this owner for approvals.
              </p>
            </div>
          </div>
        </section>

        <section className="form-section" aria-labelledby="section-plan">
          <header className="form-section__header">
            <h2 id="section-plan">Plan & usage</h2>
            <p>Context spacing keeps sections distinct while related inputs stay grouped with compact field rhythm.</p>
          </header>

          <div className="form-grid">
            <div className="form-field" data-state="valid">
              <label className="form-field__label" htmlFor="plan">
                Plan selection
              </label>
              <select id="plan" name="plan" className="form-field__control" defaultValue="scale">
                <option value="starter">Starter • Monthly</option>
                <option value="plus">Plus • Quarterly</option>
                <option value="scale">Scale • Annual</option>
              </select>
              <p className="form-field__hint">Plan pricing pulls directly from the catalog manifest.</p>
            </div>

            <div className="form-field" data-state="warning">
              <label className="form-field__label" htmlFor="usage-cap">
                Usage commitment
              </label>
              <input
                id="usage-cap"
                name="usageCap"
                className="form-field__control"
                type="number"
                defaultValue={150}
                aria-invalid="true"
                aria-describedby="usage-cap-warning"
              />
              <p className="form-field__message" id="usage-cap-warning" role="alert">
                Commitment exceeds historical usage by 48%. Confirm with finance.
              </p>
            </div>

            <div className="form-field" data-state="valid">
              <label className="form-field__label" htmlFor="billing-cycle">
                Billing cadence
              </label>
              <select id="billing-cycle" name="billingCycle" className="form-field__control" defaultValue="annual">
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual</option>
              </select>
              <p className="form-field__hint">Changing cadence recalculates renewal reminders automatically.</p>
            </div>

            <div className="form-field" data-state="valid">
              <label className="form-field__label" htmlFor="pilot-notes">
                Pilot considerations
              </label>
              <textarea
                id="pilot-notes"
                name="pilotNotes"
                className="form-field__control form-field__control--textarea"
                rows={4}
                placeholder="Document migration blockers, security reviews, or SLAs that need tracking."
              />
            </div>
          </div>
        </section>

        <section className="form-section" aria-labelledby="section-approvals">
          <header className="form-section__header">
            <h2 id="section-approvals">Approvals & routing</h2>
            <p>Tokens drive callout colours below—no inline overrides, just context-aware surfaces + focus rings.</p>
          </header>

          <div className="form-grid form-grid--columns-2">
            <div className="form-field" data-state="valid">
              <label className="form-field__label" htmlFor="effective-date">
                Effective date
              </label>
              <input
                id="effective-date"
                name="effectiveDate"
                className="form-field__control"
                type="date"
                defaultValue="2025-08-01"
              />
            </div>

            <div className="form-field" data-state="valid">
              <label className="form-field__label" htmlFor="expiration-date">
                Renewal term
              </label>
              <input
                id="expiration-date"
                name="expirationDate"
                className="form-field__control"
                type="date"
                defaultValue="2026-09-01"
              />
            </div>

            <div className="form-field" data-state="info">
              <label className="form-field__label" htmlFor="approver">
                Final approver
              </label>
              <select
                id="approver"
                name="approver"
                className="form-field__control"
                defaultValue="legal"
                aria-describedby="approver-note"
              >
                <option value="finance">Finance — Devon Lane</option>
                <option value="sales">Sales — Ralph Edwards</option>
                <option value="legal">Legal — Eleanor Pena</option>
              </select>
              <p className="form-field__message" id="approver-note" role="note">
                Requires sign-off before submission routes to DocuSign.
              </p>
            </div>

            <div className="form-field form-field--inline" data-state="valid">
              <input id="send-summary" type="checkbox" className="form-checkbox" defaultChecked />
              <label className="form-field__label form-field__label--inline" htmlFor="send-summary">
                Email summary to stakeholders
              </label>
            </div>
          </div>
        </section>

        <div className="form-actions">
          <button type="button" className="form-actions__button form-actions__button--secondary">
            Save draft
          </button>
          <button type="submit" className="form-actions__button form-actions__button--primary">
            Submit for approval
          </button>
        </div>
      </form>
    </main>

    <aside className="form-sidebar" data-region="sidebar" aria-label="Validation summary">
      <section className="form-sidebar__section">
        <h2>Validation timeline</h2>
        <p>
          Context tokens expose surfaces per state—each status chip below inherits <code>context-form</code> bindings.
        </p>
        <ul className="form-sidebar__list">
          {REVIEW_STATES.map((entry) => (
            <li key={entry.id}>
              <StatusChip status={entry.status} domain={entry.domain} context="form" />
              <span>{entry.label}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="form-sidebar__section">
        <h2>Submission checklist</h2>
        <ul className="form-sidebar__list form-sidebar__list--bullets">
          <li>Two contacts added with verified domains</li>
          <li>Revenue policy acknowledges usage delta</li>
          <li>Export controls reviewed by legal (pending)</li>
        </ul>
      </section>
    </aside>
  </div>
);

export default FormPage;
