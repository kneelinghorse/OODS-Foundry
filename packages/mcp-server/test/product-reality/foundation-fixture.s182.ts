import type { UiSchema } from '../../src/schemas/generated.js';

export const FOUNDATION_V1_IDS = [
  'Badge',
  'Banner',
  'Button',
  'Card',
  'Checkbox',
  'DatePicker',
  'Grid',
  'Input',
  'Select',
  'Stack',
  'Table',
  'Tabs',
  'Text',
  'Textarea',
] as const;

/**
 * One visible, stateful fixture for every locked Sprint-182 nucleus family.
 * The fixture deliberately carries content and/or an interaction binding for
 * every component instead of relying on empty self-closing smoke nodes.
 */
export const FOUNDATION_V1_SHOWCASE_SCHEMA: UiSchema = {
  version: '2026.09',
  theme: 'foundation-v1-showcase',
  screens: [
    {
      id: 'foundation-v1-showcase',
      component: 'Stack',
      props: {
        direction: 'column',
        gap: 'lg',
      },
      children: [
        {
          id: 'showcase-title',
          component: 'Text',
          props: {
            content: 'Foundation v1 account operations',
            as: 'h1',
            size: 'lg',
            weight: 'semibold',
          },
        },
        {
          id: 'showcase-status',
          component: 'Badge',
          props: {
            content: 'Past due',
            tone: 'critical',
            emphasis: 'solid',
            icon: '!',
          },
        },
        {
          id: 'showcase-banner',
          component: 'Banner',
          props: {
            title: 'Payment failed',
            detail: 'Update the card to keep service active.',
            tone: 'critical',
            dismissLabel: 'Dismiss payment warning',
          },
          bindings: {
            onDismiss: 'handleDismiss',
          },
        },
        {
          id: 'showcase-action',
          component: 'Button',
          props: {
            content: 'Save changes',
            intent: 'primary',
            size: 'md',
          },
          bindings: {
            onActivate: 'handleActivate',
          },
        },
        {
          id: 'showcase-secondary-action',
          component: 'Button',
          props: {
            content: 'Cancel',
            intent: 'secondary',
            size: 'sm',
          },
          bindings: {
            onActivate: 'handleSecondaryActivate',
          },
        },
        {
          id: 'showcase-profile',
          component: 'Card',
          props: {
            elevated: true,
            as: 'section',
          },
          children: [
            {
              id: 'showcase-profile-copy',
              component: 'Text',
              props: {
                content: 'Canonical fields retain their labels, help, and validation state.',
                as: 'p',
              },
            },
          ],
        },
        {
          id: 'showcase-marketing',
          component: 'Checkbox',
          props: {
            id: 'marketing',
            label: 'Product updates',
            defaultChecked: true,
            required: true,
            help: 'Choose whether to subscribe.',
          },
          bindings: {
            onChange: 'handleMarketingChange',
          },
        },
        {
          id: 'showcase-renewal',
          component: 'DatePicker',
          props: {
            id: 'renewal',
            label: 'Renewal date',
            defaultValue: '2026-09-30',
            min: '2026-09-01',
            max: '2026-12-31',
            step: 1,
          },
          bindings: {
            onChange: 'handleRenewalChange',
          },
        },
        {
          id: 'showcase-grid',
          component: 'Grid',
          props: {
            minColumnWidth: '14rem',
            gap: 'md',
            align: 'stretch',
          },
          children: [
            {
              id: 'showcase-grid-primary',
              component: 'Text',
              props: { content: 'Account health', as: 'strong' },
            },
            {
              id: 'showcase-grid-secondary',
              component: 'Text',
              props: { content: 'Recent changes', as: 'span' },
            },
          ],
        },
        {
          id: 'showcase-email',
          component: 'Input',
          props: {
            id: 'email',
            label: 'Email',
            type: 'email',
            defaultValue: 'invalid',
            required: true,
            help: 'Use a work address.',
            validation: {
              state: 'error',
              message: 'Enter a valid email.',
            },
          },
          bindings: {
            onChange: 'handleEmailChange',
          },
        },
        {
          id: 'showcase-plan',
          component: 'Select',
          props: {
            id: 'plan',
            label: 'Plan',
            defaultValue: 'pro',
            options: [
              { value: 'basic', label: 'Basic' },
              { value: 'pro', label: 'Pro' },
              { value: 'enterprise', label: 'Enterprise' },
            ],
          },
          bindings: {
            onChange: 'handlePlanChange',
          },
        },
        {
          id: 'showcase-subscriptions',
          component: 'Table',
          props: {
            caption: 'Subscriptions',
            columns: [
              { key: 'name', label: 'Name' },
              { key: 'plan', label: 'Plan' },
              { key: 'status', label: 'Status' },
            ],
            rows: [
              { id: 'sub-1', name: 'Northwind', plan: 'Enterprise', status: 'Active' },
              { id: 'sub-2', name: 'Contoso', plan: 'Pro', status: 'Past due' },
            ],
            density: 'compact',
            selectable: true,
          },
          bindings: {
            onRowActivate: 'handleRowActivate',
          },
        },
        {
          id: 'showcase-tabs',
          component: 'Tabs',
          props: {
            ariaLabel: 'Account sections',
            defaultSelectedId: 'overview',
            size: 'md',
            overflowLabel: 'More sections',
            items: [
              { id: 'overview', label: 'Overview', panel: 'Account health and recent changes.' },
              { id: 'billing', label: 'Billing', panel: 'Invoices and payment methods.' },
              { id: 'security', label: 'Security', panel: 'Security settings.', disabled: true },
            ],
          },
          bindings: {
            onChange: 'handleTabChange',
          },
        },
        {
          id: 'showcase-notes',
          component: 'Textarea',
          props: {
            id: 'notes',
            label: 'Notes',
            defaultValue: 'Call before renewal.',
            rows: 4,
            help: 'Visible to account managers.',
          },
          bindings: {
            onChange: 'handleNotesChange',
          },
        },
      ],
    },
  ],
};

export function collectFixtureComponents(schema: UiSchema): string[] {
  const components = new Set<string>();
  const stack = [...schema.screens];
  while (stack.length > 0) {
    const node = stack.pop()!;
    components.add(node.component);
    if (node.children) stack.push(...node.children);
  }
  return [...components].sort();
}
