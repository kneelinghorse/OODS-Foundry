# Statusables (Badge · Banner · Toast)

Statusable components resolve canonical status enums into semantic token palettes for badges, banners, and toasts. All statusables consume the shared manifest at `tokens/maps/saas-billing.status-map.json`, ensuring tone, wording, and iconography stay aligned with enum sources.

## Components

- **Badge** – Compact chip-style indicator that maps statuses to subtle or solid emphases. `status` + `domain` resolve directly through the registry; `tone` can be provided for ad-hoc labels. CSS variables (`--statusable-badge-*`) surface the resolved token trio for VR snapshots and brand overlays.
- **Banner** – Announcement surface for inline feedback. Positive/neutral tones render with `role="status"`; destructive tones escalate to `role="alert"`. Optional `onDismiss` wiring emits focus-safe close buttons.
- **Toast** – Polite live-region notification with focus hand-off, Escape dismissal, and optional auto-dismiss timers. Reduced-motion users see static transitions via CSS media queries.

## Usage

```tsx
import { Badge, Banner, Toast } from '@/components/base';
import type { StatusTone } from '@/modifiers/withStatusBadge.modifier';

<Badge status="trialing" domain="subscription" emphasis="subtle" />;
<Badge tone="critical">Risk</Badge>;

<Banner
  status="delinquent"
  domain="subscription"
  title="Payment overdue"
  description="Service is limited until billing is resolved."
  onDismiss={() => acknowledge()}
/>;

<Toast
  open={open}
  onOpenChange={setOpen}
  status="active"
  title="Changes saved"
  autoDismissAfter={4000}
/>;
```

## Accessibility & Behavior

- Central registry normalises status labels, descriptions, and icon hints; components expose `data-tone`, `data-status`, and CSS variables for diagnostics.
- Banners and toasts are live regions. Toasts always announce with `aria-live="polite"` and restore focus to the previously active element after dismissal.
- High-contrast guardrails rely on forced-colors overrides in `src/styles/statusables.css`. Focus rings respect the tokenised focus width and colour cascade.
- Storybook stories under **Statusables/** render a snapshot grid (statuses × emphasis) to anchor Chromatic coverage and Playwright toast interactions.
