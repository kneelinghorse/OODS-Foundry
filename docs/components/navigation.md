# Navigation Components

Navigation components help users move through information hierarchies and switch between related content.

## Tabs

The Tabs component organizes related content into separate, switchable views within a single container.

### Features

- **Responsive overflow handling** - Automatically collapses excess tabs into a "More" dropdown menu when they exceed the container width
- **Size variants** - Three density levels (sm, md, lg) to match different contexts
- **Keyboard navigation** - Full support for arrow keys, Home, End keys with roving tabindex pattern
- **Label truncation** - Long labels truncate with ellipsis and show full text via native tooltip on hover
- **High-contrast mode** - Active tab indicator uses borders that respect forced-colors system settings
- **Manual activation model** - Arrow keys move focus, Enter/Space activates (ARIA best practice)

### Usage

```tsx
import { Tabs } from '@oods/components';

const items = [
  { id: 'overview', label: 'Overview', panel: <OverviewPanel /> },
  { id: 'details', label: 'Details', panel: <DetailsPanel /> },
  { id: 'settings', label: 'Settings', panel: <SettingsPanel /> },
];

<Tabs
  items={items}
  defaultSelectedId="overview"
  size="md"
  overflowLabel="More"
  onChange={(id) => console.log('Selected:', id)}
  aria-label="Main navigation"
/>;
```

### API

#### TabsProps

| Prop                  | Type                       | Default | Description                                     |
| --------------------- | -------------------------- | ------- | ----------------------------------------------- |
| `items`               | `TabItem[]`                | -       | Array of tab items (required)                   |
| `selectedId`          | `string`                   | -       | Controlled selected tab ID                      |
| `defaultSelectedId`   | `string`                   | -       | Uncontrolled default selected tab ID            |
| `size`                | `'sm' \| 'md' \| 'lg'`     | `'md'`  | Size variant for density control                |
| `overflowLabel`       | `string`                   | `'More'`| Label for overflow menu button                  |
| `onChange`            | `(id: string) => void`     | -       | Callback when selection changes                 |
| `aria-label`          | `string`                   | -       | Accessible label for tablist                    |
| `className`           | `string`                   | -       | Additional CSS class                            |

#### TabItem

| Property     | Type        | Description                          |
| ------------ | ----------- | ------------------------------------ |
| `id`         | `string`    | Unique identifier (required)         |
| `label`      | `ReactNode` | Tab label content (required)         |
| `panel`      | `ReactNode` | Panel content (required)             |
| `isDisabled` | `boolean`   | Whether tab is disabled (optional)   |

### Accessibility

The Tabs component follows WAI-ARIA Authoring Practices for tab panels:

- **Roles**: Uses `role="tablist"`, `role="tab"`, and `role="tabpanel"`
- **Keyboard support**:
  - `ArrowRight` / `ArrowLeft` - Navigate between tabs (with wrapping)
  - `Home` - Jump to first tab
  - `End` - Jump to last tab
  - `Enter` / `Space` - Activate focused tab (manual activation model)
  - Disabled tabs are skipped during navigation
- **Roving tabindex**: Selected tab has `tabindex="0"`, others have `tabindex="-1"`
- **ARIA attributes**:
  - `aria-selected` indicates active tab
  - `aria-controls` links tab to its panel
  - `aria-labelledby` links panel back to its tab
  - `aria-label` or `aria-labelledby` on tablist
  - `hidden` attribute on inactive panels
- **High-contrast mode**: Active indicator uses borders that respect `forced-colors` media query

### Responsive Behavior

**Overflow Strategy**: When tabs exceed container width, excess tabs collapse into a dropdown overflow menu:

- The selected tab always remains visible
- Overflow menu is keyboard and screen reader accessible
- Uses Popover component for accessible menu implementation

**Label Truncation**: Long labels (>200px) truncate with ellipsis and show full text via native HTML `title` tooltip.

### Theming

Tabs use semantic design tokens for consistent theming:

| Token                          | Usage                              |
| ------------------------------ | ---------------------------------- |
| `--color-text-primary`         | Default tab text                   |
| `--color-text-interactive`     | Selected tab text                  |
| `--color-text-disabled`        | Disabled tab text                  |
| `--color-background-hover`     | Tab hover background               |
| `--color-border-interactive`   | Active tab indicator border        |
| `--color-border-subtle`        | Tablist bottom border              |
| `--font-label-{sm,md,lg}`      | Tab label typography               |
| `--space-inset-squish-{sm,md,lg}` | Tab padding by size             |

### Size Variants

- **Small** (`sm`) - Compact density for sidebars or tight spaces
- **Medium** (`md`) - Default, balanced for most use cases
- **Large** (`lg`) - Spacious for touch devices or prominent navigation

### Examples

#### Controlled Tabs

```tsx
const [selectedTab, setSelectedTab] = useState('overview');

<Tabs
  items={items}
  selectedId={selectedTab}
  onChange={setSelectedTab}
/>;
```

#### With Disabled Tab

```tsx
const items = [
  { id: '1', label: 'Active', panel: <Panel1 /> },
  { id: '2', label: 'Disabled', panel: <Panel2 />, isDisabled: true },
  { id: '3', label: 'Active', panel: <Panel3 /> },
];

<Tabs items={items} defaultSelectedId="1" />;
```

#### Small Size for Sidebar

```tsx
<Tabs items={items} size="sm" aria-label="Sidebar navigation" />
```

### Best Practices

✅ **Do**:

- Use concise, scannable tab labels (1-2 words when possible)
- Provide an `aria-label` for the tablist when the context isn't obvious
- Use the overflow menu pattern for 6+ tabs or dynamic tab counts
- Keep related content together in the same tab group
- Use medium size by default, reserve large for touch-primary interfaces

❌ **Don't**:

- Don't use tabs for sequential workflows (use Stepper instead)
- Don't nest tab components
- Don't use extremely long labels (consider restructuring your navigation)
- Don't disable the only available tab
- Don't put critical actions only in hidden tabs

### Related Components

- **Stepper** - For multi-step, wizard-like workflows
- **Pagination** - For navigating paginated datasets
- **Breadcrumbs** - For hierarchical site navigation

### Shared Navigation Utilities

The Tabs component uses shared accessibility utilities from `components/navigation/a11y.ts`:

- `handleHorizontalArrowKeys` - Arrow key navigation handler
- `getRovingTabIndex` - Roving tabindex helper
- `getNextEnabledIndex` - Skip disabled items during navigation
- `getFirstEnabledIndex` / `getLastEnabledIndex` - Boundary navigation

These utilities are reusable by Pagination and Breadcrumbs components.

### Hooks

- `useTabs` &mdash; Manages manual activation state, roving focus, and ARIA wiring for any tablist surface.
- `useOverflowMenu` &mdash; Calculates responsive visibility with overflow promotion so Pagination/Breadcrumbs can share the pattern.

---

## Pagination

_(To be implemented in B18.3)_

## Breadcrumbs

_(To be implemented in B18.4)_
