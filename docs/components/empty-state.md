# EmptyState Component

## Overview

The `EmptyState` component provides a consistent, accessible layout for moments when there is no data to display. It supports multiple scenarios including first-time use, no search results, task completion, and error states.

## Anatomy

An EmptyState consists of the following slots (all optional except headline):

1. **Illustration** (optional): Large visual element (SVG or image)
2. **Icon** (optional): Smaller icon shown if no illustration provided
3. **Headline** (required): Main title text, rendered as `<h2>`
4. **Body** (optional): Supporting description text
5. **Primary action** (optional): Main button/link rendered via `primaryAction`
6. **Secondary action** (optional): Supporting action rendered via `secondaryAction`
7. **Additional actions** (optional): Custom markup appended through the `actions` slot

## Usage

### Basic Example

```tsx
import { EmptyState } from '@oods/components';
import { Button } from '@oods/components';

<EmptyState
  headline="No items found"
  body="There are no items to display at this time."
  primaryAction={<Button>Create Item</Button>}
/>
```

### With Intent (Statusables Alignment)

The `intent` prop maps to Statusables tokens for consistent theming:

```tsx
<EmptyState
  headline="All caught up!"
  body="You've completed all tasks."
  intent="success"
  icon={<CheckIcon />}
/>
```

Available intents: `neutral` (default), `info`, `success`, `warning`

### With Illustration

```tsx
<EmptyState
  illustration={<MyCustomSVG />}
  headline="Welcome to your workspace"
  body="Get started by creating your first project."
  primaryAction={<Button>Create Project</Button>}
  secondaryAction={<Button variant="outline">Watch Tour</Button>}
/>
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `headline` | `ReactNode` | (required) | Main title content rendered with the configured `headlineLevel`. |
| `body` | `ReactNode` | `undefined` | Supporting descriptive copy under the headline. |
| `illustration` | `ReactNode` | `undefined` | Large hero illustration (SVG/image/Canvas). |
| `icon` | `ReactNode` | `undefined` | Compact glyph shown when no illustration is provided. |
| `primaryAction` | `ReactNode` | `undefined` | Primary call-to-action element, rendered first in the action stack. |
| `secondaryAction` | `ReactNode` | `undefined` | Secondary call-to-action rendered after the primary action. |
| `actions` | `ReactNode` | `undefined` | Additional custom action markup appended after the primary/secondary slots. |
| `intent` | `EmptyStateIntent` | `'neutral'` | Visual intent mapping to Statusables tone tokens. |
| `status` | `string` | `undefined` | Statusables key overriding tone/icon mapping when provided. |
| `domain` | `StatusDomain` | `'subscription'` | Statusables domain used when resolving `status`. |
| `headlineLevel` | `'h1' \| 'h2' \| 'h3' \| 'h4' \| 'h5' \| 'h6'` | `'h2'` | Heading level applied to the headline element. |
| `className` | `string` | `undefined` | Additional CSS classes for the root element. |
| `...rest` | `HTMLAttributes<HTMLDivElement>` | — | Standard div attributes (id, data-*, aria-*, etc.). |

## Design Tokens

`EmptyState` resolves semantic component tokens and exposes CSS custom properties so themes can override spacing, typography, and tone while staying within Statusables guardrails.

- **Container:** `--empty-state-padding`, `--empty-state-padding-mobile`, `--empty-state-max-width`, `--empty-state-gap`
- **Content spacing:** `--empty-state-content-gap`, `--empty-state-illustration-gap`
- **Typography:** `--empty-state-headline-font-size`, `--empty-state-headline-font-weight`, `--empty-state-headline-line-height`, `--empty-state-body-font-size`, `--empty-state-body-line-height`
- **Actions:** `--empty-state-actions-gap`
- **Statusables mapping:** `--empty-state-icon-background`, `--empty-state-icon-foreground`, `--empty-state-icon-border`

Default values trace back to semantic tokens (for example `--empty-state-padding → var(--cmp-spacing-inset-spacious, var(--sys-spacing-inset-xl))`). When `intent` or `status` is supplied, the icon variables resolve to `var(--cmp-status-{tone}-surface|text|border)`, ensuring tone alignment across components.

## Content Guidelines

### Headline

✅ **Do:**
- Keep it short and scannable (3-7 words)
- Start with a verb for action-oriented states ("Create your first...", "Start building...")
- Be specific about what's missing ("No active subscriptions")

❌ **Don't:**
- Use vague language ("Nothing here")
- Write long sentences
- End with punctuation (unless it's a question)

**Examples:**
- ✅ "No search results found"
- ✅ "Welcome to your dashboard"
- ❌ "There doesn't seem to be anything here at the moment."

### Body Text

✅ **Do:**
- Explain why the area is empty
- Provide context or next steps
- Keep it concise (1-2 sentences)
- Use sentence case with proper punctuation

❌ **Don't:**
- Repeat the headline verbatim
- Write multiple paragraphs
- Use technical jargon

**Examples:**
- ✅ "Try adjusting your filters or search terms to find what you're looking for."
- ✅ "Projects help you organize work and collaborate with your team."
- ❌ "The query returned zero results from the database."

### Call-to-Action (Actions)

✅ **Do:**
- Drive the main next step through the `primaryAction` slot
- Use action verbs ("Create", "Browse", "Learn More")
- Reserve `secondaryAction` for a single alternate or supporting path
- Move tertiary links into the `actions` slot (text links, help anchors)

❌ **Don't:**
- Stack more than two primary buttons
- Use ambiguous labels ("Click here", "OK")

## Usage Scenarios

### 1. First-Time Use (Onboarding)

Encourage users to try a feature they haven't used yet.

```tsx
<EmptyState
  icon={<FolderIcon />}
  headline="Welcome to your workspace"
  body="Get started by creating your first project."
  intent="neutral"
  primaryAction={<Button>Create Project</Button>}
  secondaryAction={<Button variant="ghost">Learn More</Button>}
/>
```

### 2. No Search Results

Help users refine their search or explore alternatives.

```tsx
<EmptyState
  icon={<SearchIcon />}
  headline="No results found"
  body="We couldn't find anything matching your search. Try different keywords or clear your filters."
  intent="info"
  primaryAction={<Button>Browse All</Button>}
  secondaryAction={<Button variant="outline">Clear Filters</Button>}
/>
```

### 3. Task Completion (Success)

Celebrate when users have finished all tasks.

```tsx
<EmptyState
  icon={<CheckIcon />}
  headline="All caught up!"
  body="You've completed all pending tasks. We'll notify you when new tasks arrive."
  intent="success"
/>
```

### 4. Error / No Access

Inform users when they lack permissions or encounter an error.

```tsx
<EmptyState
  icon={<LockIcon />}
  headline="Access denied"
  body="You don't have permission to view this content. Contact your administrator."
  intent="warning"
  primaryAction={<Button variant="outline">Contact Admin</Button>}
/>
```

### 5. Zero Data State

Simple case when a list/table has no items.

```tsx
<EmptyState
  headline="No items to display"
  body="Create your first item to get started."
  primaryAction={<Button>Create Item</Button>}
/>
```

## Accessibility

### Semantic Structure

- The headline renders as an `<h2>` element by default; adjust `headlineLevel` to maintain page hierarchy
- Place the EmptyState within a page section that has its own `<h1>`

### Decorative Images

- Illustrations and icons are marked `aria-hidden` since the text provides context
- If the icon conveys critical meaning, include descriptive text in the headline/body

### Keyboard Navigation

- Ensure action buttons are keyboard-accessible
- Test that focus moves logically through the component

### Screen Reader Testing

Verify the component announces correctly:
1. Headline as a level 2 heading
2. Body text as paragraph content
3. Action buttons with their labels

## High Contrast Mode

The component supports forced-colors mode:
- Icon backgrounds receive a visible border
- Text colors map to system colors (`CanvasText`)
- Focus indicators remain visible

Test with: Windows High Contrast Mode or browser DevTools forced-colors emulation.

## Responsive Behavior

### Desktop (> 640px)
- Centered layout with max-width of 36rem
- Actions display in a horizontal row

### Mobile (≤ 640px)
- Illustration scales down to 12rem
- Actions stack vertically, full-width
- Reduced padding for smaller screens

## Examples in Production

### No Active Subscriptions
```tsx
<EmptyState
  headline="No active subscriptions"
  body="Browse our plans to find one that fits your needs."
  primaryAction={<Button>View Plans</Button>}
/>
```

### Inbox Zero
```tsx
<EmptyState
  icon={<CheckIcon />}
  headline="Inbox empty"
  body="You're all caught up! No new messages."
  intent="success"
/>
```

### Onboarding Dashboard
```tsx
<EmptyState
  illustration={<OnboardingIllustration />}
  headline="Welcome to Analytics"
  body="Connect your data sources to start tracking metrics and insights."
  primaryAction={<Button>Connect Data</Button>}
  secondaryAction={<Button variant="ghost">Watch Tutorial</Button>}
/>
```

## Illustration Guidelines

### When to Use Illustrations

✅ **Use for:**
- Onboarding / first-time states
- Brand-reinforcing moments
- High-traffic empty states (dashboard, inbox)

❌ **Avoid for:**
- Transient states (search results)
- Error messages (use icons instead)
- High-density interfaces

### Illustration Best Practices

- Keep illustrations simple and on-brand
- Use SVG format for scalability
- Ensure sufficient color contrast
- Max width: 16rem (256px) on desktop
- Provide meaningful alt text if the illustration is informative

### Icon vs. Illustration

| Use Icon When...                  | Use Illustration When...           |
| --------------------------------- | ---------------------------------- |
| Space is limited                  | You want to reinforce brand        |
| State is transient (search)       | It's a first-time/onboarding state |
| Intent mapping is needed (status) | The page is high-traffic           |
| Message is simple                 | You want to delight the user       |

## Related Components

- **Banner**: For in-page notifications with status
- **Toast**: For transient feedback messages
- **Badge**: For compact status indicators

## Further Reading

- [Empty States in Design Systems](https://atlassian.design/components/empty-state/overview)
- [Salesforce Empty State Patterns](https://www.lightningdesignsystem.com/components/empty-state/)
- [WCAG 2.1 AA Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
