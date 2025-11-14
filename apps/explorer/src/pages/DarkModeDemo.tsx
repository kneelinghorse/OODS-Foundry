import type { ReactNode } from 'react';
import '../styles/index.css';
import { StatusChip } from '../components/StatusChip';

type DemoButtonProps = {
  children: ReactNode;
  variant?: 'primary' | 'quiet';
  size?: 'md' | 'sm';
  icon?: string;
};

type BannerTone = 'info' | 'success' | 'warning' | 'critical' | 'accent' | 'neutral';

type DemoBannerProps = {
  tone: BannerTone;
  title: string;
  description: string;
  action?: ReactNode;
  icon?: string;
};

const ACTION_BUTTONS: Array<{ id: string; label: string; variant?: DemoButtonProps['variant']; icon?: string }> = [
  { id: 'upgrade-plan', label: 'Upgrade Plan', icon: '↗︎' },
  { id: 'view-timeline', label: 'View Timeline', icon: '⟳' },
  { id: 'pause-account', label: 'Pause Account', variant: 'quiet' }
];

const STATUS_PREVIEWS: Array<{ id: string; domain: 'subscription' | 'invoice'; status: string; label: string }> = [
  { id: 'subscription-active', domain: 'subscription', status: 'active', label: 'Active subscription' },
  { id: 'subscription-paused', domain: 'subscription', status: 'paused', label: 'Paused subscription' },
  { id: 'invoice-processing', domain: 'invoice', status: 'processing', label: 'Processing invoice' },
  { id: 'invoice-past-due', domain: 'invoice', status: 'past_due', label: 'Past-due invoice' }
];

const BANNER_GLYPHS: Record<BannerTone, string> = {
  info: 'ℹ︎',
  success: '✔︎',
  warning: '⚠︎',
  critical: '⨯',
  accent: '★',
  neutral: '•'
};

const BANNER_PREVIEWS: Array<DemoBannerProps> = [
  {
    tone: 'info',
    title: 'Nightly maintenance window',
    description: 'API responses will pause from 22:00–23:00 UTC while we roll out schema updates.',
    action: <DemoButton size="sm" variant="quiet">View schedule</DemoButton>
  },
  {
    tone: 'success',
    title: 'Invoice INV-20410 captured',
    description: 'Payment succeeded automatically. The customer receipt has been delivered.',
    action: (
      <DemoButton size="sm" icon="↗︎">
        Open details
      </DemoButton>
    )
  },
  {
    tone: 'critical',
    title: 'Security review required',
    description: 'SAML certificate expires in 3 days. Rotate the signing key to prevent login failures.',
    action: (
      <DemoButton size="sm" variant="primary">
        Start rotation
      </DemoButton>
    )
  }
];

function DemoButton({ children, variant = 'primary', size = 'md', icon }: DemoButtonProps) {
  return (
    <button type="button" className="demo-button" data-variant={variant} data-size={size}>
      <span>{children}</span>
      {icon ? (
        <span aria-hidden className="demo-button__glyph">
          {icon}
        </span>
      ) : null}
    </button>
  );
}

function DemoBanner({ tone, title, description, action, icon }: DemoBannerProps) {
  const glyph = icon ?? BANNER_GLYPHS[tone];
  return (
    <article className="demo-banner" data-banner-tone={tone} data-has-action={action ? 'true' : 'false'}>
      <span className="demo-banner__icon" aria-hidden>
        {glyph}
      </span>
      <div className="demo-banner__content">
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      {action ? <div className="demo-banner__actions">{action}</div> : null}
    </article>
  );
}

const DarkModeDemo = () => {
  return (
    <div className="explorer-view context-dark" data-context="dark" data-testid="dark-mode-demo">
      <header className="view-header" data-region="header">
        <div className="view-header__text">
          <p className="view-eyebrow">Dark Theme</p>
          <h1 className="view-title">Nightfall Token Coverage</h1>
          <p className="view-caption">
            Dark mode reuses the Theme layer without branching component logic. Toggle <code>html[data-theme]</code> to{' '}
            <code>dark</code> and the same slots feed surfaces, text, state tokens, and elevation.
          </p>
        </div>

        <dl className="view-metrics" data-region="meta">
          <div>
            <dt>AA Pairs</dt>
            <dd>12 validated</dd>
          </div>
          <div>
            <dt>Status Ramps</dt>
            <dd>5 tones</dd>
          </div>
          <div>
            <dt>Elevation</dt>
            <dd>Outline + glow</dd>
          </div>
        </dl>
      </header>

      <section className="dark-demo__grid" data-region="body" aria-label="Dark theme specimens">
        <article className="dark-demo__panel" aria-label="Primary actions">
          <header>
            <h2>Action Tokens</h2>
            <p>Buttons read the same <code>--cmp-surface-action*</code> slots; the theme remaps them to dark OKLCH values.</p>
          </header>
          <div className="dark-demo__actions">
            {ACTION_BUTTONS.map(({ id, label, variant, icon }) => (
              <DemoButton key={id} variant={variant} icon={icon}>
                {label}
              </DemoButton>
            ))}
          </div>
        </article>

        <article className="dark-demo__panel" aria-label="Status chips">
          <header>
            <h2>Status Chips</h2>
            <p>Status chips stay pure: tone data attributes flip to dark status tokens without new component code.</p>
          </header>
          <div className="dark-demo__status-grid">
            {STATUS_PREVIEWS.map((preview) => (
              <div key={preview.id} className="dark-demo__status">
                <span>{preview.label}</span>
                <StatusChip status={preview.status} domain={preview.domain} context="detail" />
              </div>
            ))}
          </div>
        </article>

        <article className="dark-demo__panel" aria-label="Banners and elevation">
          <header>
            <h2>Elevation &amp; Banners</h2>
            <p>
              Dark elevation leans on outline-first shadows. Status banners reuse <code>--sys-status-*</code> tokens for colour and
              contrast.
            </p>
          </header>
          <div className="dark-demo__banner-stack">
            {BANNER_PREVIEWS.map((banner, index) => (
              <DemoBanner key={`${banner.tone}-${index}`} {...banner} />
            ))}
          </div>
        </article>
      </section>
    </div>
  );
};

export default DarkModeDemo;
