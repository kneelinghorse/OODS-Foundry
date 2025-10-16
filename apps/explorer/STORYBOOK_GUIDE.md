# Storybook Authoring Guide

This guide provides a set of conventions for creating and organizing Storybook stories within this project. Following these guidelines will ensure consistency, maintainability, and a great developer experience.

## File Naming and Location

-   **Component Stories:** For a component located at `src/components/MyComponent.tsx`, its stories should be in `src/components/stories/MyComponent.stories.tsx`.
-   **Documentation Pages:** Standalone documentation pages should be located in `apps/explorer/src/stories/` under a relevant category, e.g., `apps/explorer/src/stories/Billing/Invoice.mdx`. Use `.mdx` for these files.

## Component Stories (`.stories.tsx`)

Component stories focus on showcasing a single component in its various states.

### Structure

A `.stories.tsx` file should have the following structure:

1.  **Imports:** Import React, `Meta` and `StoryObj` from Storybook, and the component you are documenting.
2.  **Meta:** A default export of a `Meta` object that defines the story's metadata (title, component, parameters).
3.  **Story Type:** A type alias for the story object.
4.  **Stories:** Exported stories as objects of the defined type.

### Example

```typescript
// src/components/stories/Button.stories.tsx

import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '../Button';

// Meta configuration
const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    backgroundColor: { control: 'color' },
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

// Stories
export const Primary: Story = {
  args: {
    primary: true,
    label: 'Button',
  },
};

export const Secondary: Story = {
  args: {
    label: 'Button',
  },
};
```

## Documentation Pages (`.mdx`)

MDX pages are used for creating rich, long-form documentation that can include stories, markdown, and other content. They are ideal for overviews, guidelines, and documenting complex scenarios.

### Structure

An `.mdx` file should use Storybook's blocks API directly.

1.  **Imports:** Import the necessary blocks from `@storybook/blocks` and any components to be showcased.
2.  **Meta:** Use the `<Meta>` block to define the page's title and parameters.
3.  **Content:** Use a combination of Markdown, `<Canvas>`, `<Story>`, and `<ArgsTable>` blocks to create the documentation.

### Example

Here is an example of a documentation page for the invoice detail view.

```mdx
// apps/explorer/src/stories/Billing/Invoice.Detail.mdx

import { Meta, Story, Canvas, Markdown } from '@storybook/blocks';
import { InvoiceDetailExample } from './components/BillingContexts';

<Meta title="Billing/Invoice.Detail" parameters={{
  layout: 'fullscreen',
  docs: {
    source: { state: 'hidden' }
  }
}} />

<Canvas>
  <Story name="Finance dossier">
    <InvoiceDetailExample />
  </Story>
</Canvas>

<Markdown>
{`### Details

- Tokens from the shared manifest drive chip tone and text; finance sees identical cues for each system.
- Balance and collection data hydrate from the canonical object produced by the SaaS billing traits.
- Notes field demonstrates how free text flows through without impacting layout purity.
`}
</Markdown>
```
