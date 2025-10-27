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

The Pagination component divides large datasets into discrete pages, providing controls for navigation.

### Features

- **Headless hook** - `usePagination` hook separates logic from UI and returns structured previous/next/ellipsis items
- **Smart truncation** - Replaces middle page numbers with ellipsis (...) to prevent overflow
- **Configurable density** - `siblingCount` and `boundaryCount` props control how many pages are visible
- **Responsive design** - Mobile collapse pattern reduces button padding and gap on narrow viewports
- **Keyboard accessible** - All buttons in tab order with clear focus indicators
- **High-contrast mode** - Selected page uses system colors (Highlight, ButtonText) for visibility
- **Boundary management** - Previous/Next buttons automatically disable at page boundaries

### Usage

```tsx
import { Pagination } from '@oods/components';

const [page, setPage] = useState(1);

<Pagination
  page={page}
  count={50}
  onChange={setPage}
  siblingCount={1}
  boundaryCount={1}
  aria-label="Pagination"
/>;
```

### Headless Hook

For custom pagination UIs, use the `usePagination` hook directly:

```tsx
import { usePagination } from '@oods/components';

const { items, goToPage, nextPage, previousPage } = usePagination({
  page: 5,
  count: 50,
  siblingCount: 1,
  boundaryCount: 1,
  onChange: (newPage) => console.log('Page changed:', newPage),
});

// items: [
//   { type: 'previous', page: 4, selected: false, disabled: false },
//   { type: 'page', page: 1, selected: false, disabled: false },
//   { type: 'ellipsis', selected: false, disabled: true, index: 0 },
//   { type: 'page', page: 4, selected: false, disabled: false },
//   { type: 'page', page: 5, selected: true, disabled: false },
//   { type: 'page', page: 6, selected: false, disabled: false },
//   { type: 'ellipsis', selected: false, disabled: true, index: 1 },
//   { type: 'page', page: 50, selected: false, disabled: false },
//   { type: 'next', page: 6, selected: false, disabled: false },
// ]
```

### API

#### PaginationProps

| Prop             | Type                   | Default        | Description                                     |
| ---------------- | ---------------------- | -------------- | ----------------------------------------------- |
| `page`           | `number`               | -              | Current page number (1-based, required)         |
| `count`          | `number`               | -              | Total number of pages (required)                |
| `onChange`       | `(page: number) => void` | -            | Callback when page changes (required)           |
| `siblingCount`   | `number`               | `1`            | Pages shown on each side of current page        |
| `boundaryCount`  | `number`               | `1`            | Pages shown at start and end                    |
| `showFirstLast`  | `boolean`              | `false`        | Show first/last navigation buttons              |
| `aria-label`     | `string`               | `'Pagination'` | Accessible label for navigation                 |
| `className`      | `string`               | -              | Additional CSS class                            |

#### UsePaginationOptions

| Property         | Type                     | Description                                   |
| ---------------- | ------------------------ | --------------------------------------------- |
| `page`           | `number`                 | Current page number (1-based)                 |
| `count`          | `number`                 | Total number of pages                         |
| `siblingCount`   | `number` (optional)      | Pages shown on each side of current (default: 1) |
| `boundaryCount`  | `number` (optional)      | Pages shown at start and end (default: 1)     |
| `onChange`       | `(page: number) => void` | Callback when page changes                    |

#### usePagination Return Value

| Property       | Type                   | Description                                |
| -------------- | ---------------------- | ------------------------------------------ |
| `items`        | `PaginationItem[]`     | Array of pagination items to render        |
| `goToPage`     | `(page: number) => void` | Navigate to specific page (clamped)      |
| `nextPage`     | `() => void`           | Navigate to next page                      |
| `previousPage` | `() => void`           | Navigate to previous page                  |

### Accessibility

The Pagination component follows WCAG 2.1 AA guidelines:

- **Landmark**: Uses `<nav>` with `aria-label="Pagination"`
- **Current page**: Marked with `aria-current="page"` for screen readers
- **Disabled states**: Previous/Next buttons disabled at boundaries with `disabled` attribute
- **Keyboard support**: All buttons keyboard navigable with Tab, activated with Enter/Space
- **Focus indicators**: Clear 2px outline on focus-visible
- **High-contrast mode**: Selected page uses system Highlight color, buttons use ButtonText borders

### Truncation Patterns

The truncation algorithm adapts to different scenarios:

#### No Truncation (≤7 pages)
```
[1] [2] [3] [4] [5]
```

#### Single Ellipsis (near start or end)
```
[1] [2] [3] [...] [10]
[1] [...] [8] [9] [10]
```

#### Double Ellipsis (in middle)
```
[1] [...] [24] [25] [26] [...] [50]
```

The `siblingCount` and `boundaryCount` props control this behavior:
- **siblingCount**: Number of pages around current page (default: 1)
- **boundaryCount**: Number of pages at first/last positions (default: 1)

### Responsive Behavior

On mobile viewports (≤480px):
- Button padding reduces from 0.75rem to 0.5rem inline
- Gap between items reduces from 0.25rem to 0.125rem
- Minimum button width reduces from 2.5rem to 2rem

### Theming

Pagination uses semantic design tokens for consistent theming:

| Token                             | Usage                              |
| --------------------------------- | ---------------------------------- |
| `--cmp-text-body`                 | Default button text                |
| `--cmp-text-disabled`             | Disabled button text               |
| `--cmp-text-on_action`            | Selected page text                 |
| `--cmp-surface-action_hover`      | Button hover background            |
| `--cmp-surface-action`            | Selected page background           |
| `--cmp-border-default`            | Button borders                     |
| `--cmp-border-strong`             | Button hover border                |
| `--font-size-body-md`             | Button font size                   |
| `--font-weight-medium`            | Button font weight                 |
| `--spacing-inline-xs`             | Gap between items                  |
| `--spacing-squish-block-sm`       | Button padding (vertical)          |
| `--spacing-squish-inline-sm`      | Button padding (horizontal)        |
| `--border-radius-md`              | Button border radius               |

### Examples

#### Basic Pagination

```tsx
const [page, setPage] = useState(1);

<Pagination page={page} count={10} onChange={setPage} />
```

#### With Data Table

```tsx
const [page, setPage] = useState(1);
const itemsPerPage = 20;
const totalItems = 247;
const totalPages = Math.ceil(totalItems / itemsPerPage);

const startIndex = (page - 1) * itemsPerPage + 1;
const endIndex = Math.min(page * itemsPerPage, totalItems);

<div>
  <p>Showing {startIndex}–{endIndex} of {totalItems} items</p>
  <DataTable data={currentPageData} />
  <Pagination page={page} count={totalPages} onChange={setPage} />
</div>
```

#### Custom Density

```tsx
// Show more pages (less truncation)
<Pagination
  page={page}
  count={100}
  onChange={setPage}
  siblingCount={2}      // Show 2 pages on each side of current
  boundaryCount={2}     // Show 2 pages at start and end
/>

// Result: [1] [2] [...] [8] [9] [10] [11] [12] [...] [99] [100]
```

#### With First/Last Buttons

```tsx
<Pagination
  page={page}
  count={50}
  onChange={setPage}
  showFirstLast
/>
```

### Best Practices

✅ **Do**:

- Display total item count context (e.g., "Showing 1–20 of 100 items")
- Use default siblingCount/boundaryCount for most cases (balanced truncation)
- Place pagination at the bottom of data tables or content lists
- Maintain pagination state in URL query parameters for bookmarkable pages
- Use the headless `usePagination` hook for custom pagination UIs

❌ **Don't**:

- Don't hide the current page behind an ellipsis
- Don't use pagination for infinite scroll experiences (different pattern)
- Don't show pagination for ≤1 page (no navigation needed)
- Don't use extremely high siblingCount values (defeats truncation purpose)
- Don't forget to handle loading states when fetching paginated data

### Related Components

- **Tabs** - For switching between related content sections
- **Breadcrumbs** - For hierarchical site navigation
- **Table** - Often paired with pagination for large datasets

### Integration Patterns

#### Server-Side Pagination

```tsx
const [page, setPage] = useState(1);
const { data, isLoading } = useFetch(`/api/items?page=${page}&limit=20`);

<Pagination
  page={page}
  count={data?.totalPages ?? 0}
  onChange={setPage}
/>
```

#### Client-Side Pagination

```tsx
const [page, setPage] = useState(1);
const itemsPerPage = 20;
const paginatedData = useMemo(() => {
  const start = (page - 1) * itemsPerPage;
  return allData.slice(start, start + itemsPerPage);
}, [page, allData, itemsPerPage]);

<Pagination
  page={page}
  count={Math.ceil(allData.length / itemsPerPage)}
  onChange={setPage}
/>
```

## Breadcrumbs

_(To be implemented in B18.4)_
