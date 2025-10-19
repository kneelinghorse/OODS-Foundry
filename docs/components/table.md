# Table (Table · TableRow · TableCell)

Table primitives provide dense operational views with keyboard focus, row selection, and status-aware cells that reuse the shared status registry. The wrapper preserves semantic `<table>` markup while layering token-driven styling and high-contrast overrides.

## Components

- **Table** – Wraps a `<table>` inside a scroll container, exposing `density` and allowing native table attributes. Container tokens (`--table-*`) drive borders, row hover, and selection highlights.
- **TableHeader / TableBody / TableCaption** – Semantic helpers that attach class hooks for consistent typography and spacing.
- **TableRow** – Adds optional `selectable`, `selected`, and `onActivate` wiring. Selectable rows receive `tabIndex`, `aria-selected`, and keyboard activation via Enter/Space.
- **TableCell / TableHeaderCell** – Support `numeric` alignment and status styling with `status`, `statusDomain`, `tone`, and `statusEmphasis` props. Status cells pull tone tokens from `getStatusPresentation`/`getToneTokenSet`, emitting CSS variables for backgrounds and text.

## Usage

```tsx
import {
  Table,
  TableHeader,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
} from '@/components/base';

<Table density="compact">
  <TableHeader>
    <TableRow>
      <TableHeaderCell>Subscription</TableHeaderCell>
      <TableHeaderCell>Status</TableHeaderCell>
      <TableHeaderCell numeric>MRR</TableHeaderCell>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow selectable selected onActivate={() => openDetails('SUB-1024')}>
      <TableCell>SUB-1024</TableCell>
      <TableCell status="active" statusDomain="subscription" />
      <TableCell numeric>$1,200</TableCell>
    </TableRow>
  </TableBody>
</Table>;
```

## Accessibility & Diagnostics

- Row activation honours pointer and keyboard input; `onActivate` fires after bubbling `onClick`/`onKeyDown`, while `tabIndex` defaults to `0` for selectable rows. Focus rings and selection bars are token driven (`--table-focus-*`, `--table-row-selected-*`), with forced-colors overrides falling back to `Highlight`.
- Status cells expose `data-status-*` attributes plus CSS variables (`--table-cell-status-*`) so Chromatic + VRT snapshots capture tone variations without literal colours.
- Storybook under **Data/Table** covers default layouts, selectable rows, and a compact matrix highlighting surface vs. text emphasis. The same stories feed Chromatic coverage, while Playwright continues to validate focus order via the shared form example.
