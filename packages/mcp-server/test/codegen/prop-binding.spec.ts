import { describe, expect, it } from 'vitest';
import type { UiSchema, FieldSchemaEntry } from '../../src/schemas/generated.js';
import { emit as reactEmit } from '../../src/codegen/react-emitter.js';
import { emit as vueEmit } from '../../src/codegen/vue-emitter.js';
import { emit as htmlEmit } from '../../src/codegen/html-emitter.js';
import { resolveFieldProps } from '../../src/codegen/binding-utils.js';
import type { CodegenOptions } from '../../src/codegen/types.js';
import type { UiElement } from '../../src/schemas/generated.js';

const objectSchema: Record<string, FieldSchemaEntry> = {
  name: { type: 'string', required: true, description: 'Product name' },
  price: { type: 'number', required: true },
  sku: { type: 'string', required: false },
  status: { type: 'string', required: true, enum: ['active', 'inactive', 'draft'] },
};

const schema: UiSchema = {
  version: '2026.02',
  objectSchema,
  screens: [
    {
      id: 'detail-screen',
      component: 'Stack',
      layout: { type: 'stack' },
      children: [
        { id: 'name-text', component: 'Text', props: { field: 'name' } },
        { id: 'price-text', component: 'Text', props: { field: 'price' } },
        { id: 'status-badge', component: 'StatusBadge', props: { field: 'status' } },
        { id: 'sku-input', component: 'Input', props: { field: 'sku' } },
        { id: 'no-field', component: 'Button', props: { label: 'Save' } },
      ],
    },
  ],
};

const defaultOptions: CodegenOptions = {
  typescript: true,
  styling: 'tokens',
};

describe('codegen prop binding', () => {
  describe('Sprint 184 ported recipe bindings', () => {
    const portedSchema: UiSchema = {
      version: '2026.03',
      objectSchema: {
        allowed_transitions: { type: 'string[]', required: false },
        amount: { type: 'integer', required: true },
        billing_interval: { type: 'string', required: false },
        cancel_at_period_end: { type: 'boolean', required: true },
        cancellation_reason: { type: 'string', required: false },
        cancellation_reason_code: { type: 'string', required: false },
        cancellation_requested_at: { type: 'datetime', required: false },
        created_at: { type: 'datetime', required: true },
        currency: { type: 'string', required: true },
        state_history: { type: 'StateTransition[]', required: false },
        status: { type: 'string', required: true },
        updated_at: { type: 'datetime', required: false },
      },
      screens: [{
        id: 'detail',
        component: 'Stack',
        children: [
          {
            id: 'price',
            component: 'PriceBadge',
            props: {
              amountField: 'amount',
              currencyField: 'currency',
              intervalField: 'billing_interval',
              minorUnitsParameter: 'minorUnits',
            },
          },
          {
            id: 'currency',
            component: 'PriceBadge',
            props: { field: 'currency', label: 'ISO 4217 currency code.' },
          },
          {
            id: 'status',
            component: 'StatusTimeline',
            props: {
              field: 'status',
              historyField: 'state_history',
              statesParameter: 'states',
            },
          },
          {
            id: 'cancellation',
            component: 'CancellationSummary',
            props: {
              cancelAtPeriodEndField: 'cancel_at_period_end',
              requestedAtField: 'cancellation_requested_at',
              reasonField: 'cancellation_reason',
              codeField: 'cancellation_reason_code',
            },
          },
          {
            id: 'updated',
            component: 'RelativeTimestamp',
            props: {
              field: 'updated_at',
              fallbackField: 'created_at',
              timezoneParameter: 'timezone',
            },
          },
        ],
      }],
    };

    it.each([
      {
        framework: 'React',
        emit: reactEmit,
        rootImport: "import { CancellationSummary, PriceBadge, RelativeTimestamp, Stack, StatusTimeline } from '@oods/components-react';",
        styleImport: "import '@oods/component-styles/css';",
        expectedBindings: [
          'amountCents={amount}',
          'currency={currency}',
          'data-interval={billingInterval}',
          'label={currency}',
          'status={status}',
          'history={stateHistory}',
          'allowedTransitions={allowedTransitions}',
          'cancelAtPeriodEnd={cancelAtPeriodEnd}',
          'requestedAt={cancellationRequestedAt}',
          'reason={cancellationReason}',
          'code={cancellationReasonCode}',
          'datetime={updatedAt ?? createdAt}',
        ],
      },
      {
        framework: 'Vue',
        emit: vueEmit,
        rootImport: "import { CancellationSummary, PriceBadge, RelativeTimestamp, Stack, StatusTimeline } from '@oods/components-vue';",
        styleImport: "import '@oods/component-styles/css';",
        expectedBindings: [
          ':amountCents="amount"',
          ':currency="currency"',
          ':data-interval="billingInterval"',
          ':label="currency"',
          ':status="status"',
          ':history="stateHistory"',
          ':allowedTransitions="allowedTransitions"',
          ':cancelAtPeriodEnd="cancelAtPeriodEnd"',
          ':requestedAt="cancellationRequestedAt"',
          ':reason="cancellationReason"',
          ':code="cancellationReasonCode"',
          ':datetime="updatedAt ?? createdAt"',
        ],
      },
    ])('turns declarative field recipes into executable $framework props', ({
      emit,
      rootImport,
      styleImport,
      expectedBindings,
    }) => {
      const result = emit(portedSchema, defaultOptions);
      expect(result.status).toBe('ok');
      expect(result.code).toContain(rootImport);
      expect(result.code).not.toContain('/ported');
      expect(result.code).not.toContain('/css-ported');
      expect(result.code).toContain(styleImport);
      for (const binding of expectedBindings) expect(result.code, binding).toContain(binding);
      for (const directive of [
        'amountField',
        'currencyField',
        'intervalField',
        'minorUnitsParameter',
        'historyField',
        'statesParameter',
        'cancelAtPeriodEndField',
        'requestedAtField',
        'reasonField',
        'codeField',
        'fallbackField',
        'timezoneParameter',
      ]) {
        expect(result.code, directive).not.toContain(directive);
      }
    });
  });

  describe('React emitter', () => {
    it('injects field names as JSX children for children-strategy components', () => {
      const result = reactEmit(schema, defaultOptions);
      expect(result.status).toBe('ok');
      expect(result.code).toContain('{name}');
      expect(result.code).toContain('{price}');
    });

    it('injects field names as status prop for status-strategy components', () => {
      const result = reactEmit(schema, defaultOptions);
      expect(result.code).toContain('status={status}');
    });

    it('injects field names as value prop for value-strategy components', () => {
      const result = reactEmit(schema, defaultOptions);
      expect(result.code).toContain('value={sku}');
    });

    it('keeps self-closing for components without field binding', () => {
      const result = reactEmit(schema, defaultOptions);
      // Button label normalizes to content but no field binding → remains self-closing
      expect(result.code).toMatch(/<Button[^>]*\/>/);
    });
  });

  describe('Vue emitter', () => {
    it('injects field names as template interpolation for children-strategy', () => {
      const result = vueEmit(schema, defaultOptions);
      expect(result.status).toBe('ok');
      expect(result.code).toContain('{{ name }}');
      expect(result.code).toContain('{{ price }}');
    });

    it('injects field names as :status binding for status-strategy', () => {
      const result = vueEmit(schema, defaultOptions);
      expect(result.code).toContain(':status="status"');
    });

    it('injects field names as idiomatic v-model binding for value-strategy', () => {
      const result = vueEmit(schema, defaultOptions);
      expect(result.code).toContain('v-model="sku"');
    });
  });

  describe('HTML emitter', () => {
    it('renders field-bound sample values without placeholder markers', () => {
      const result = htmlEmit(schema, defaultOptions);
      expect(result.status).toBe('ok');
      expect(result.code).not.toContain('data-bind="name"');
      expect(result.code).not.toContain('[name]');
    });
  });

  describe('prop enrichment from objectSchema metadata', () => {
    const enrichedSchema: UiSchema = {
      version: '2026.03',
      objectSchema: {
        email: { type: 'email', required: true, description: 'User email address' },
        status: { type: 'string', required: true, enum: ['active', 'inactive', 'draft'] },
        amount: { type: 'number', required: false, description: 'Payment amount' },
        category: { type: 'string', required: true, enum: ['electronics', 'clothing', 'food'] },
        website: { type: 'url', required: false, description: 'Company website URL' },
      },
      screens: [
        {
          id: 'form-screen',
          component: 'Stack',
          layout: { type: 'stack' },
          children: [
            { id: 'email-input', component: 'Input', props: { field: 'email' } },
            { id: 'status-badge', component: 'StatusBadge', props: { field: 'status' } },
            { id: 'amount-input', component: 'Input', props: { field: 'amount' } },
            { id: 'category-select', component: 'Select', props: { field: 'category' } },
            { id: 'website-input', component: 'Input', props: { field: 'website' } },
            { id: 'label-with-existing', component: 'Badge', props: { field: 'status', label: 'Custom Label' } },
          ],
        },
      ],
    };

    describe('resolveFieldProps unit', () => {
      const os = enrichedSchema.objectSchema!;

      it('returns placeholder from description for value-prop components', () => {
        const node: UiElement = { id: 'e', component: 'Input', props: { field: 'email' } };
        const result = resolveFieldProps(node, os);
        expect(result).toBeTruthy();
        expect(result!.placeholder).toBe('User email address');
      });

      it('returns required for required value-prop fields', () => {
        const node: UiElement = { id: 'e', component: 'Input', props: { field: 'email' } };
        const result = resolveFieldProps(node, os);
        expect(result!.required).toBe(true);
      });

      it('does not return required for optional fields', () => {
        const node: UiElement = { id: 'a', component: 'Input', props: { field: 'amount' } };
        const result = resolveFieldProps(node, os);
        expect(result!.required).toBeUndefined();
      });

      it('returns input type from semantic field type', () => {
        const emailNode: UiElement = { id: 'e', component: 'Input', props: { field: 'email' } };
        expect(resolveFieldProps(emailNode, os)!.type).toBe('email');

        const urlNode: UiElement = { id: 'w', component: 'Input', props: { field: 'website' } };
        expect(resolveFieldProps(urlNode, os)!.type).toBe('url');

        const amountNode: UiElement = { id: 'a', component: 'Input', props: { field: 'amount' } };
        expect(resolveFieldProps(amountNode, os)!.type).toBe('number');
      });

      it.each([
        ['email?', 'email'], ['url?', 'url'], ['date?', 'date'],
        ['datetime?', 'datetime-local'], ['integer?', 'number'], ['number?', 'number'],
      ])('keeps the browser control for nullable %s without making the field required', (type, expected) => {
        const node: UiElement = { id: 'nullable', component: 'Input', props: { field: 'value' } };
        const result = resolveFieldProps(node, { value: { type, required: false } });
        expect(result!.type).toBe(expected);
        expect(result!.required).toBeUndefined();
      });

      it('returns humanized label for label-prop and status-prop components', () => {
        const node: UiElement = { id: 's', component: 'StatusBadge', props: { field: 'status' } };
        const result = resolveFieldProps(node, os);
        expect(result!.label).toBe('Status');
      });

      it('does not override existing label', () => {
        const node: UiElement = { id: 'b', component: 'Badge', props: { field: 'status', label: 'Custom' } };
        const result = resolveFieldProps(node, os);
        expect(result?.label).toBeUndefined();
      });

      it('returns enum options for Select components', () => {
        const node: UiElement = { id: 'c', component: 'Select', props: { field: 'category' } };
        const result = resolveFieldProps(node, os);
        expect(result!.options).toEqual([
          { label: 'Electronics', value: 'electronics' },
          { label: 'Clothing', value: 'clothing' },
          { label: 'Food', value: 'food' },
        ]);
      });

      it('returns null for components with no field binding', () => {
        const node: UiElement = { id: 'b', component: 'Button', props: { label: 'Save' } };
        expect(resolveFieldProps(node, os)).toBeNull();
      });

      it('returns null for layout components (strategy=none)', () => {
        const node: UiElement = { id: 's', component: 'Stack', props: { field: 'email' } };
        expect(resolveFieldProps(node, os)).toBeNull();
      });
    });

    describe('React emitter enrichment', () => {
      const result = reactEmit(enrichedSchema, defaultOptions);

      it('emits placeholder for form inputs', () => {
        expect(result.code).toContain('placeholder="User email address"');
      });

      it('emits required attribute for required form inputs', () => {
        expect(result.code).toContain('required');
      });

      it('emits input type from semantic field type', () => {
        expect(result.code).toContain('type="email"');
      });

      it('emits enum options for Select components', () => {
        expect(result.code).toContain('options=');
      });

      it('does not override existing labels', () => {
        expect(result.code).toContain('content="Custom Label"');
      });
    });

    describe('Vue emitter enrichment', () => {
      const result = vueEmit(enrichedSchema, defaultOptions);

      it('emits placeholder for form inputs', () => {
        expect(result.code).toContain('placeholder="User email address"');
      });

      it('emits required attribute for required form inputs', () => {
        expect(result.code).toMatch(/\brequired\b/);
      });

      it('emits input type from semantic field type', () => {
        expect(result.code).toContain('type="email"');
      });

      it('emits enum options for Select components', () => {
        expect(result.code).toContain(':options=');
      });

      it('does not override existing labels', () => {
        expect(result.code).toContain('content="Custom Label"');
      });
    });

    describe('HTML emitter enrichment', () => {
      const result = htmlEmit(enrichedSchema, defaultOptions);

      it('includes enriched prop data in HTML output', () => {
        expect(result.status).toBe('ok');
        expect(result.code).toContain('data-oods-component');
      });
    });
  });

  describe('no regression for schemas without objectSchema', () => {
    const plainSchema: UiSchema = {
      version: '2026.02',
      screens: [{
        id: 'screen',
        component: 'Stack',
        children: [
          { id: 'btn', component: 'Button', props: { label: 'Click' } },
          { id: 'txt', component: 'Text', props: { text: 'Hello' } },
        ],
      }],
    };

    it('React emitter works without objectSchema', () => {
      const result = reactEmit(plainSchema, defaultOptions);
      expect(result.status).toBe('ok');
      expect(result.code).toContain('Button');
      expect(result.code).not.toContain('{undefined}');
    });

    it('Vue emitter works without objectSchema', () => {
      const result = vueEmit(plainSchema, defaultOptions);
      expect(result.status).toBe('ok');
      expect(result.code).toContain('Button');
    });

    it('HTML emitter works without objectSchema', () => {
      const result = htmlEmit(plainSchema, defaultOptions);
      expect(result.status).toBe('ok');
      expect(result.code).toContain('<!DOCTYPE html>');
    });
  });
});
