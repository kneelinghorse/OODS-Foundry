import type { Meta, StoryObj } from '@storybook/react';
import type { ReactNode } from 'react';
import '../../src/styles/globals.css';

import {
  PreferenceForm,
  PreferencePreview,
} from '../../src/components/preferences/index.js';
import { usePreferenceForm } from '../../src/hooks/usePreferenceForm.js';
import type { UsePreferenceFormOptions } from '../../src/hooks/usePreferenceForm.js';
import { ViewContextProvider, VALID_CONTEXTS } from '../../src/ViewContextProvider.jsx';
import type { PreferenceDocument } from '../../src/schemas/preferences/preference-document.js';
import type { PreferencePreviewSection } from '../../src/components/preferences/PreferencePreview.js';
import schemaV1 from '../../examples/preferences/schema-v1.json' with { type: 'json' };
import schemaV11 from '../../examples/preferences/schema-v1.1.json' with { type: 'json' };
import schemaV2 from '../../examples/preferences/schema-v2.json' with { type: 'json' };

const meta: Meta<typeof PreferenceForm> = {
  title: 'Components/Forms/PreferenceForm',
  component: PreferenceForm,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['vrt'],
};

export default meta;

type Story = StoryObj<typeof PreferenceForm>;

interface PlaygroundProps {
  readonly heading: string;
  readonly description: string;
  readonly formOptions?: UsePreferenceFormOptions;
  readonly density?: 'comfortable' | 'compact';
  readonly previewSections?: readonly PreferencePreviewSection[];
  readonly extras?: React.ReactNode;
}

const Playground = ({ heading, description, formOptions, density, previewSections, extras }: PlaygroundProps) => {
  const preferenceForm = usePreferenceForm(formOptions);
  const sections = previewSections ?? preferenceForm.previewSections;
  const validationCount = preferenceForm.validationIssues.length;

  return (
    <ViewContextProvider value={VALID_CONTEXTS.FORM}>
      <div className="min-h-screen bg-[--cmp-surface-canvas] p-8">
        <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
          <section>
            <header className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-[--sys-text-muted]">{heading}</p>
              <p className="text-sm text-[--sys-text-muted]">{description}</p>
            </header>
            <PreferenceForm density={density} {...preferenceForm.formProps} />
          </section>
          <aside className="space-y-4">
            <div className="flex items-center justify-between">
              <button
                type="button"
                className="rounded-full border border-[--cmp-border-strong] px-3 py-1 text-sm font-medium"
                onClick={preferenceForm.resetToDefaults}
              >
                Reset to defaults
              </button>
              <span className="text-xs text-[--sys-text-muted]">
                {validationCount ? `${validationCount} validation issues` : 'All fields valid'}
              </span>
            </div>
            <PreferencePreview document={preferenceForm.document} sections={sections} />
            {extras}
          </aside>
        </div>
      </div>
    </ViewContextProvider>
  );
};

export const DefaultExperience: Story = {
  render: () => (
    <Playground
      heading="Full preference surface"
      description="Latest schema (v2.0.0) rendered with JSON Schema defaults, live validation, and preview."
    />
  ),
};

export const ThemePreferences: Story = {
  render: () => (
    <Playground
      heading="Theme controls"
      description="Focus on mode, density, and high-contrast toggles."
      formOptions={{
        uiSchema: {
          preferences: {
            notifications: { 'ui:widget': 'hidden' },
            display: { 'ui:widget': 'hidden' },
            privacy: { 'ui:widget': 'hidden' },
          },
          metadata: { 'ui:widget': 'hidden' },
        },
      }}
    />
  ),
};

export const NotificationMatrix: Story = {
  render: () => (
    <Playground
      heading="Notification matrix"
      description="Channel × policy settings seeded from the enterprise example document."
      formOptions={{
        version: '2.0.0',
        initialDocument: schemaV2 as PreferenceDocument,
      }}
    />
  ),
};

export const ConditionalSms: Story = {
  render: () => (
    <Playground
      heading="Conditional SMS enforcement"
      description="Version 1.1.0 introduces SMS opt-in; selecting the SMS channel requires a phone number (if/then schema)."
      formOptions={{
        version: '1.1.0',
        initialDocument: schemaV11 as PreferenceDocument,
      }}
      extras={
        <div className="rounded-xl border border-[--cmp-border-strong] p-3 text-sm text-[--sys-text-muted]">
          Toggle the SMS channel to see real-time validation. The preview shows the resulting nested payload.
        </div>
      }
    />
  ),
};

export const NestedPreferences: Story = {
  render: () => (
    <Playground
      heading="Display & privacy"
      description="Demonstrates nested objects (locale, timezone, privacy region) sourced from historical documents."
      formOptions={{
        version: '1.0.0',
        initialDocument: schemaV1 as PreferenceDocument,
      }}
    />
  ),
};

export const CompactDensity: Story = {
  render: () => (
    <Playground
      heading="Compact density"
      description="Explicitly renders the form in compact mode for editorial sidebars."
      density="compact"
    />
  ),
};
