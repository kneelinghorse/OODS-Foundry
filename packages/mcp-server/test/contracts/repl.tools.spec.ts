import { describe, expect, it } from 'vitest';
import { getAjv } from '../../src/lib/ajv.js';
import validateInputSchema from '../../src/schemas/repl.validate.input.json' assert { type: 'json' };
import validateOutputSchema from '../../src/schemas/repl.validate.output.json' assert { type: 'json' };
import renderInputSchema from '../../src/schemas/repl.render.input.json' assert { type: 'json' };
import renderOutputSchema from '../../src/schemas/repl.render.output.json' assert { type: 'json' };
import { handle as validateHandle } from '../../src/tools/repl.validate.js';
import { handle as renderHandle } from '../../src/tools/repl.render.js';
import type { ReplValidateInput, UiSchema } from '../../src/schemas/generated.js';
import { createSchemaRef } from '../../src/tools/schema-ref.js';

const ajv = getAjv();
const validateValidateInput = ajv.compile<ReplValidateInput>(validateInputSchema);
const validateValidateOutput = ajv.compile(validateOutputSchema);
const validateRenderInput = ajv.compile(renderInputSchema);
const validateRenderOutput = ajv.compile(renderOutputSchema);

describe('Ajv schema registration', () => {
  it('preloads sibling schemas for repl.render/repl.validate refs', () => {
    for (const id of [
      'https://oods-foundry.com/schemas/repl.render.input.json',
      'https://oods-foundry.com/schemas/repl.validate.input.json',
      'https://oods-foundry.com/schemas/repl.patch.json',
      'https://oods-foundry.com/schemas/repl.ui.schema.json'
    ]) {
      expect(ajv.getSchema(id)).toBeTruthy();
    }
  });
});

const baseTree: UiSchema = {
  version: '2025.11',
  dsVersion: '2025-11-22',
  theme: 'default',
  screens: [
    {
      id: 'audit-screen',
      component: 'AuditTimeline',
      layout: { type: 'stack', gapToken: 'spacing.md' },
      meta: { label: 'Audit timeline' },
      children: [
        {
          id: 'archive-summary',
          component: 'ArchiveSummary',
          meta: { label: 'Archive summary' },
        },
      ],
    },
  ],
};

const basicComponentsTree: UiSchema = {
  version: '2026.02',
  dsVersion: '2026-02-24',
  theme: 'default',
  screens: [
    {
      id: 'basic-screen',
      component: 'Stack',
      children: [
        { id: 'basic-button', component: 'Button', props: { label: 'Save', type: 'submit' } },
        { id: 'basic-card', component: 'Card', props: { body: 'Card body' } },
        { id: 'basic-text', component: 'Text', props: { text: 'Body copy' } },
        { id: 'basic-input', component: 'Input', props: { name: 'email', type: 'email' } },
        {
          id: 'basic-select',
          component: 'Select',
          props: {
            name: 'status',
            value: 'active',
            options: [
              { value: 'draft', label: 'Draft' },
              { value: 'active', label: 'Active' },
            ],
          },
        },
        { id: 'basic-badge', component: 'Badge', props: { label: 'New' } },
        { id: 'basic-banner', component: 'Banner', props: { message: 'Ready' } },
        {
          id: 'basic-table',
          component: 'Table',
          props: {
            columns: [
              { key: 'name', label: 'Name' },
              { key: 'value', label: 'Value' },
            ],
            rows: [{ name: 'Latency', value: '120ms' }],
          },
        },
        {
          id: 'basic-tabs',
          component: 'Tabs',
          props: {
            tabs: [
              { id: 'overview', label: 'Overview', content: 'Overview panel', active: true },
              { id: 'details', label: 'Details', content: 'Details panel', active: false },
            ],
          },
        },
      ],
    },
  ],
};

const labelledComponentsTree: UiSchema = {
  version: '2026.02',
  dsVersion: '2026-02-24',
  theme: 'default',
  screens: [
    {
      id: 'labelled-screen',
      component: 'Stack',
      children: [
        {
          id: 'card-header-node',
          component: 'CardHeader',
          props: { title: 'Account', supporting: 'Updated recently', level: 3 },
        },
        {
          id: 'detail-header-node',
          component: 'DetailHeader',
          props: { title: 'Subscription', subtitle: 'Professional plan', metadata: 'Seat count: 12', level: 2 },
        },
        {
          id: 'form-label-group-node',
          component: 'FormLabelGroup',
          props: { label: 'Email', placeholder: 'name@example.com', htmlFor: 'email-input' },
        },
        {
          id: 'inline-label-node',
          component: 'InlineLabel',
          props: { label: 'Customer Success Specialist', maxLength: 14 },
        },
        {
          id: 'label-cell-node',
          component: 'LabelCell',
          props: { label: 'Premium Account', description: 'North America Territory', truncate: true, maxLength: 16 },
        },
      ],
    },
  ],
};

const badgeComponentsTree: UiSchema = {
  version: '2026.02',
  dsVersion: '2026-02-24',
  theme: 'default',
  screens: [
    {
      id: 'badge-screen',
      component: 'Stack',
      children: [
        { id: 'status-badge-node', component: 'StatusBadge', props: { status: 'active', variant: 'subtle' } },
        { id: 'cancellation-badge-node', component: 'CancellationBadge', props: { cancelAtPeriodEnd: true } },
        { id: 'archive-pill-node', component: 'ArchivePill', props: { isArchived: true } },
        { id: 'colorized-badge-node', component: 'ColorizedBadge', props: { state: 'warning', color: 'amber' } },
        { id: 'pref-badge-node', component: 'PreferenceSummaryBadge', props: { namespace: 'billing', version: 3 } },
        { id: 'classification-badge-node', component: 'ClassificationBadge', props: { category: 'enterprise', mode: 'strict' } },
        { id: 'owner-badge-node', component: 'OwnerBadge', props: { owner: 'Operations', status: 'assigned' } },
        { id: 'message-badge-node', component: 'MessageStatusBadge', props: { delivery: 'delivered' } },
        { id: 'geo-badge-node', component: 'GeoResolutionBadge', props: { resolution: 'rooftop' } },
        { id: 'address-badge-node', component: 'AddressSummaryBadge', props: { role: 'billing' } },
        { id: 'price-badge-node', component: 'PriceBadge', props: { amountCents: 2599, currency: 'usd' } },
        { id: 'role-badge-node', component: 'RoleBadgeList', props: { roles: ['admin', 'auditor'], tone: 'compact' } },
      ],
    },
  ],
};

const panelComponentsTree: UiSchema = {
  version: '2026.02',
  dsVersion: '2026-02-24',
  theme: 'default',
  screens: [
    {
      id: 'panel-screen',
      component: 'Stack',
      children: [
        {
          id: 'address-panel-node',
          component: 'AddressCollectionPanel',
          props: { title: 'Addresses', field: 'addresses', roleField: 'address_roles' },
          children: [{ id: 'address-panel-child', component: 'Text', props: { text: '2 addresses' } }],
        },
        {
          id: 'classification-panel-node',
          component: 'ClassificationPanel',
          props: { title: 'Classification', categoriesField: 'categories', modeParameter: 'strict' },
        },
        {
          id: 'communication-panel-node',
          component: 'CommunicationDetailPanel',
          props: { label: 'Communication', channelsField: 'channel_catalog' },
          children: [{ id: 'communication-panel-child', component: 'Text', props: { text: '3 channels' } }],
        },
        {
          id: 'membership-panel-node',
          component: 'MembershipPanel',
          props: { heading: 'Membership', membershipsField: 'membership_records' },
        },
        {
          id: 'preference-panel-node',
          component: 'PreferencePanel',
          props: { name: 'Preferences', preferencesField: 'preference_document' },
        },
      ],
    },
  ],
};

const formEditorComponentsTree: UiSchema = {
  version: '2026.02',
  dsVersion: '2026-02-24',
  theme: 'default',
  screens: [
    {
      id: 'form-editor-screen',
      component: 'Stack',
      children: [
        { id: 'address-editor-node', component: 'AddressEditor', props: { title: 'Address', street: '123 Main', city: 'Seattle' } },
        {
          id: 'classification-editor-node',
          component: 'ClassificationEditor',
          props: { title: 'Classification', category: 'enterprise', modes: ['strict', 'flexible'], mode: 'strict' },
        },
        {
          id: 'preference-editor-node',
          component: 'PreferenceEditor',
          props: { title: 'Preferences', namespaces: ['billing'], namespace: 'billing', document: '{"enabled":true}' },
        },
        {
          id: 'role-assignment-node',
          component: 'RoleAssignmentForm',
          props: { title: 'Roles', roles: ['admin', 'viewer'], role: 'admin' },
        },
        {
          id: 'cancellation-form-node',
          component: 'CancellationForm',
          props: { title: 'Cancel', allowedReasons: ['budget', 'duplicate'], reasonCode: 'budget' },
        },
        { id: 'tag-input-node', component: 'TagInput', props: { label: 'Tags', tags: ['core', 'urgent'] } },
        { id: 'tag-manager-node', component: 'TagManager', props: { title: 'Manage Tags', tags: ['alpha'] } },
        {
          id: 'geo-mapping-node',
          component: 'GeoFieldMappingForm',
          props: { title: 'Geo Mapping', latitudeField: 'lat', longitudeField: 'lon', identifierField: 'city', autoDetect: true },
        },
        {
          id: 'color-state-picker-node',
          component: 'ColorStatePicker',
          props: { title: 'Color', colorStates: ['default', 'warning'], value: 'warning' },
        },
        {
          id: 'template-picker-node',
          component: 'TemplatePicker',
          props: { title: 'Template', templates: ['welcome'], channels: ['email'], value: 'welcome', channel: 'email' },
        },
      ],
    },
  ],
};

const timelineComponentsTree: UiSchema = {
  version: '2026.02',
  dsVersion: '2026-02-24',
  theme: 'default',
  screens: [
    {
      id: 'timeline-screen',
      component: 'Stack',
      children: [
        {
          id: 'audit-timeline-node',
          component: 'AuditTimeline',
          props: { title: 'Audit', events: [{ label: 'Created', timestamp: '2026-02-26T00:00:00Z' }] },
        },
        {
          id: 'address-validation-timeline-node',
          component: 'AddressValidationTimeline',
          props: { title: 'Address Validation', validations: [{ label: 'Validated', timestamp: '2026-02-26T00:01:00Z' }] },
        },
        {
          id: 'membership-timeline-node',
          component: 'MembershipAuditTimeline',
          props: { title: 'Membership', memberships: [{ label: 'Role Granted', timestamp: '2026-02-26T00:02:00Z' }] },
        },
        {
          id: 'message-timeline-node',
          component: 'MessageEventTimeline',
          props: { title: 'Messages', messages: [{ label: 'Message Sent', timestamp: '2026-02-26T00:03:00Z' }] },
        },
        {
          id: 'preference-timeline-node',
          component: 'PreferenceTimeline',
          props: { title: 'Preferences', changes: [{ label: 'Preference Updated', timestamp: '2026-02-26T00:04:00Z' }] },
        },
        {
          id: 'status-timeline-node',
          component: 'StatusTimeline',
          props: { title: 'Status', stateHistory: [{ label: 'active', timestamp: '2026-02-26T00:05:00Z' }] },
        },
        {
          id: 'audit-event-node',
          component: 'AuditEvent',
          props: { label: 'Record Created', timestamp: '2026-02-26T00:00:00Z', detail: 'Created by system' },
        },
        {
          id: 'archive-event-node',
          component: 'ArchiveEvent',
          // s223-m01 (#2527 ruling 7): an event card with no events renders nothing, so each event carries the data its
          // contract reads (archivedAt; a history), as a placed recipe binds it.
          props: { label: 'Record Archived', timestamp: '2026-02-26T01:00:00Z', archivedAt: '2026-02-26T01:00:00Z', reason: 'policy' },
        },
        {
          id: 'cancellation-event-node',
          component: 'CancellationEvent',
          props: { label: 'Cancellation Requested', timestamp: '2026-02-26T02:00:00Z', reason: 'budget' },
        },
        {
          id: 'state-transition-event-node',
          component: 'StateTransitionEvent',
          props: { label: 'State changed to active', timestamp: '2026-02-26T03:00:00Z', from: 'pending', to: 'active', history: [{ from_state: 'pending', to_state: 'active', transitioned_at: '2026-02-26T03:00:00Z' }] },
        },
        {
          id: 'relative-timestamp-node',
          component: 'RelativeTimestamp',
          props: { datetime: '2026-02-26T03:00:00Z', relative: '2 minutes ago' },
        },
      ],
    },
  ],
};

const summaryComponentsTree: UiSchema = {
  version: '2026.02',
  dsVersion: '2026-02-24',
  theme: 'default',
  screens: [
    {
      id: 'summary-screen',
      component: 'Stack',
      children: [
        {
          id: 'archive-summary-node',
          component: 'ArchiveSummary',
          props: { title: 'Archive', isArchived: true, archivedAt: '2026-02-26T01:00:00Z', reason: 'policy' },
        },
        {
          id: 'cancellation-summary-node',
          component: 'CancellationSummary',
          props: { title: 'Cancellation', cancelAtPeriodEnd: true, requestedAt: '2026-02-26T02:00:00Z', reason: 'budget' },
        },
        { id: 'ownership-meta-node', component: 'OwnershipMeta', props: { title: 'Ownership Meta', ownerType: 'team', role: 'admin' } },
        { id: 'ownership-summary-node', component: 'OwnershipSummary', props: { title: 'Ownership', ownerId: 'usr_123', ownerType: 'team', role: 'admin' } },
        { id: 'price-card-meta-node', component: 'PriceCardMeta', props: { title: 'Price Meta', model: 'tiered', interval: 'monthly' } },
        { id: 'price-summary-node', component: 'PriceSummary', props: { title: 'Pricing', amount: '29.00', currency: 'USD', model: 'tiered', interval: 'monthly' } },
        { id: 'tag-pills-node', component: 'TagPills', props: { tags: ['alpha', 'beta', 'gamma', 'delta'], maxVisible: 3, overflowLabel: '+{{ tag_count }}' } },
        { id: 'tag-summary-node', component: 'TagSummary', props: { title: 'Tags', tagCount: 4, tags: 'core, urgent' } },
        { id: 'status-selector-node', component: 'StatusSelector', props: { label: 'Status', states: ['draft', 'active'], value: 'active' } },
        { id: 'color-swatch-node', component: 'ColorSwatch', props: { color: 'emerald', label: 'Emerald' } },
        {
          id: 'status-color-legend-node',
          component: 'StatusColorLegend',
          props: { legend: [{ label: 'Active', color: 'green' }, { label: 'Paused', color: 'amber' }] },
        },
        {
          id: 'geocodable-preview-node',
          component: 'GeocodablePreview',
          props: { title: 'Geo Preview', resolution: 'rooftop', requiresLookup: false, detectedFields: 'lat,lon' },
        },
      ],
    },
  ],
};

const vizComponentsTree: UiSchema = {
  version: '2026.02',
  dsVersion: '2026-02-24',
  theme: 'default',
  screens: [
    {
      id: 'viz-screen',
      component: 'Stack',
      children: [
        { id: 'viz-area-controls-node', component: 'VizAreaControls', props: { title: 'Area Controls', curve: 'linear', opacity: '0.6' } },
        { id: 'viz-area-preview-node', component: 'VizAreaPreview', props: { width: 800, height: 400 } },
        { id: 'viz-mark-controls-node', component: 'VizMarkControls', props: { title: 'Mark Controls', orientation: 'vertical', stacking: 'stack' } },
        { id: 'viz-mark-preview-node', component: 'VizMarkPreview', props: { width: 800, height: 400 } },
        { id: 'viz-line-controls-node', component: 'VizLineControls', props: { title: 'Line Controls', curve: 'monotone', markers: 'auto' } },
        { id: 'viz-line-preview-node', component: 'VizLinePreview', props: { width: 800, height: 400 } },
        { id: 'viz-point-controls-node', component: 'VizPointControls', props: { title: 'Point Controls', shape: 'circle', size: '16' } },
        { id: 'viz-point-preview-node', component: 'VizPointPreview', props: { width: 800, height: 400 } },
        { id: 'viz-color-controls-node', component: 'VizColorControls', props: { title: 'Color Controls', scheme: 'viridis', channel: 'fill' } },
        { id: 'viz-color-legend-config-node', component: 'VizColorLegendConfig', props: { title: 'Legend', field: 'segment', scheme: 'viridis', redundancy: 'shape' } },
        { id: 'viz-encoding-badge-node', component: 'VizEncodingBadge', props: { axis: 'x', field: 'revenue' } },
        { id: 'viz-axis-controls-node', component: 'VizAxisControls', props: { title: 'Axis Controls', xField: 'date', yField: 'revenue' } },
        { id: 'viz-axis-summary-node', component: 'VizAxisSummary', props: { title: 'Axis Summary', axis: 'x', scale: 'linear', zero: true } },
        { id: 'viz-size-controls-node', component: 'VizSizeControls', props: { title: 'Size Controls', strategy: 'range', min: '8', max: '42' } },
        { id: 'viz-size-summary-node', component: 'VizSizeSummary', props: { title: 'Size Summary', field: 'revenue', strategy: 'range', min: 8, max: 42 } },
        { id: 'viz-scale-controls-node', component: 'VizScaleControls', props: { title: 'Scale Controls', type: 'linear', domainMin: '0', domainMax: '100' } },
        { id: 'viz-scale-summary-node', component: 'VizScaleSummary', props: { title: 'Scale Summary', type: 'linear', domainMin: 0, domainMax: 100, mode: 'fit' } },
        { id: 'viz-role-badge-node', component: 'VizRoleBadge', props: { role: 'mark' } },
      ],
    },
  ],
};

describe('Agentic REPL schemas', () => {
  it('accepts validate input payloads for full tree', () => {
    const payload: ReplValidateInput = { mode: 'full', schema: baseTree };
    expect(validateValidateInput(payload)).toBe(true);
    expect(validateValidateInput.errors).toBeNull();
  });

  it('accepts render input payloads for node patch application', () => {
    const payload = {
      mode: 'patch',
      baseTree,
      patch: [{ nodeId: 'archive-summary', path: 'component', value: 'ArchiveEvent' }],
    };
    expect(validateRenderInput(payload)).toBe(true);
    expect(validateRenderInput.errors).toBeNull();
  });

  it('rejects render input payloads missing schema or schemaRef in full mode', () => {
    const payload = { mode: 'full' };
    expect(validateRenderInput(payload)).toBe(false);
  });

  it('rejects render input payloads missing baseTree in patch mode', () => {
    const payload = {
      mode: 'patch',
      patch: [{ nodeId: 'archive-summary', path: 'component', value: 'ArchiveEvent' }],
    };
    expect(validateRenderInput(payload)).toBe(false);
  });

  it('rejects render input payloads missing patch in patch mode', () => {
    const payload = {
      mode: 'patch',
      baseTree,
    };
    expect(validateRenderInput(payload)).toBe(false);
  });
});

describe('Agentic REPL validate handler', () => {
  it('returns ok for valid DSL trees', async () => {
    const result = await validateHandle({ mode: 'full', schema: baseTree });

    expect(result.status).toBe('ok');
    expect(result.errors).toHaveLength(0);
    expect(result.meta?.screenCount).toBe(1);
    expect(validateValidateOutput(result)).toBe(true);
  });

  it('reports missing patch with path + example hint', async () => {
    const result = await validateHandle({ mode: 'patch', baseTree });

    expect(result.status).toBe('invalid');
    const missing = result.errors.find((err) => err.code === 'OODS-V011');
    expect(missing?.path).toBe('/patch');
    expect(missing?.hint).toContain('Valid patch examples');
  });

  it('flags JSON Patch objects that are not wrapped in an array', async () => {
    const result = await validateHandle({
      mode: 'patch',
      baseTree,
      patch: { op: 'replace', path: '/screens/0/component', value: 'Card' } as any,
    });

    expect(result.status).toBe('invalid');
    const format = result.errors.find((err) => err.code === 'OODS-V115');
    expect(format?.path).toBe('/patch');
    expect(format?.hint).toContain('JSON Patch array');
  });

  it('returns path-level errors for malformed patch entries', async () => {
    const result = await validateHandle({
      mode: 'patch',
      baseTree,
      patch: [{ op: 'replace' }] as any,
    });

    expect(result.status).toBe('invalid');
    const entry = result.errors.find((err) => err.code === 'OODS-V107');
    expect(entry?.path).toBe('/patch/0');
    expect(entry?.hint).toContain('nodeId');
  });

  it('uses schemaRef as implicit baseTree in patch mode', async () => {
    const schemaRef = createSchemaRef(baseTree, 'compose').ref;

    const result = await validateHandle({
      mode: 'patch',
      schemaRef,
      patch: [{ op: 'replace', path: '/screens/0/component', value: 'Card' }],
    });

    expect(result.status).toBe('ok');
    expect(result.appliedPatch).toBe(true);
    expect(result.normalizedTree?.screens?.[0]?.component).toBe('Card');
  });

  it('reports schemaRef errors without emitting MISSING_BASE_TREE', async () => {
    const result = await validateHandle({
      mode: 'patch',
      schemaRef: 'compose-missing-ref',
      patch: [{ op: 'replace', path: '/screens/0/component', value: 'Card' }],
    });

    expect(result.status).toBe('invalid');
    expect(result.errors.some((err) => err.code === 'OODS-N003')).toBe(true);
    expect(result.errors.some((err) => err.code === 'OODS-V010')).toBe(false);
    expect(result.appliedPatch).toBe(false);
  });

  it('sets appliedPatch=false when patch application fails', async () => {
    const result = await validateHandle({
      mode: 'patch',
      baseTree,
      patch: [{ op: 'replace', path: '/screens/9/component', value: 'Card' }],
    });

    expect(result.status).toBe('invalid');
    expect(result.errors.some((err) => err.code === 'OODS-V104')).toBe(true);
    expect(result.appliedPatch).toBe(false);
  });

  it('returns structured errors for unknown components', async () => {
    const invalidTree = structuredClone(baseTree);
    invalidTree.screens[0].children![0].component = 'UnknownComponent';

    const result = await validateHandle({ mode: 'full', schema: invalidTree });
    expect(result.status).toBe('invalid');
    expect(result.errors.some((err) => err.code === 'OODS-V006')).toBe(true);
    expect(validateValidateOutput(result)).toBe(true);
  });

  it('accepts all basic renderer-backed components from the registry', async () => {
    const result = await validateHandle({ mode: 'full', schema: basicComponentsTree });

    expect(result.status).toBe('ok');
    expect(result.errors).toHaveLength(0);
    expect(result.meta?.missingComponents).toBeUndefined();
    expect(validateValidateOutput(result)).toBe(true);
  });

  it('accepts all content and label components from the registry', async () => {
    const result = await validateHandle({ mode: 'full', schema: labelledComponentsTree });

    expect(result.status).toBe('ok');
    expect(result.errors).toHaveLength(0);
    expect(result.meta?.missingComponents).toBeUndefined();
    expect(validateValidateOutput(result)).toBe(true);
  });

  it('accepts status and badge components from the registry', async () => {
    const result = await validateHandle({ mode: 'full', schema: badgeComponentsTree });

    expect(result.status).toBe('ok');
    expect(result.errors).toHaveLength(0);
    expect(result.meta?.missingComponents).toBeUndefined();
    expect(validateValidateOutput(result)).toBe(true);
  });

  it('accepts panel and detail section components from the registry', async () => {
    const result = await validateHandle({ mode: 'full', schema: panelComponentsTree });

    expect(result.status).toBe('ok');
    expect(result.errors).toHaveLength(0);
    expect(result.meta?.missingComponents).toBeUndefined();
    expect(validateValidateOutput(result)).toBe(true);
  });

  it('accepts form and editor components from the registry', async () => {
    const result = await validateHandle({ mode: 'full', schema: formEditorComponentsTree });

    expect(result.status).toBe('ok');
    expect(result.errors).toHaveLength(0);
    expect(result.meta?.missingComponents).toBeUndefined();
    expect(validateValidateOutput(result)).toBe(true);
  });

  it('accepts timeline and event components from the registry', async () => {
    const result = await validateHandle({ mode: 'full', schema: timelineComponentsTree });

    expect(result.status).toBe('ok');
    expect(result.errors).toHaveLength(0);
    expect(result.meta?.missingComponents).toBeUndefined();
    expect(validateValidateOutput(result)).toBe(true);
  });

  it('accepts summary and metadata components from the registry', async () => {
    const result = await validateHandle({ mode: 'full', schema: summaryComponentsTree });

    expect(result.status).toBe('ok');
    expect(result.errors).toHaveLength(0);
    expect(result.meta?.missingComponents).toBeUndefined();
    expect(validateValidateOutput(result)).toBe(true);
  });

  it('accepts visualization components from the registry', async () => {
    const result = await validateHandle({ mode: 'full', schema: vizComponentsTree });

    expect(result.status).toBe('ok');
    expect(result.errors).toHaveLength(0);
    expect(result.meta?.missingComponents).toBeUndefined();
    expect(validateValidateOutput(result)).toBe(true);
  });

  it('defaults mode to full when schemaRef provided without mode', async () => {
    const schemaRef = createSchemaRef(baseTree, 'compose').ref;

    const result = await validateHandle({ schemaRef } as any);

    expect(result.status).toBe('ok');
    expect(result.meta?.screenCount).toBe(1);
  });

  it('defaults mode to full when schema provided without mode', async () => {
    const result = await validateHandle({ schema: baseTree } as any);

    expect(result.status).toBe('ok');
  });
});

describe('Agentic REPL render handler', () => {
  it('applies node patches and returns preview metadata', async () => {
    const result = await renderHandle({
      mode: 'patch',
      baseTree,
      patch: [{ nodeId: 'archive-summary', path: 'component', value: 'ArchiveEvent' }],
    });

    expect(result.status).toBe('ok');
    expect(result.renderedTree?.screens[0].children?.[0].component).toBe('ArchiveEvent');
    expect(result.appliedPatch).toBe(true);
    expect(result.preview?.screens).toContain('audit-screen');
    expect(validateRenderOutput(result)).toBe(true);
  });

  it('reports missing base tree when patching without context', async () => {
    const result = await renderHandle({
      mode: 'patch',
      patch: [{ nodeId: 'missing', path: 'component', value: 'ArchiveSummary' }],
    });

    expect(result.status).toBe('error');
    expect(result.errors.some((err) => err.code === 'OODS-V010')).toBe(true);
    expect(validateRenderOutput(result)).toBe(true);
  });

  it('returns standalone html when apply=true and render is valid', async () => {
    const result = await renderHandle({
      mode: 'full',
      schema: baseTree,
      apply: true,
    });

    expect(result.status).toBe('ok');
    expect(result.html).toContain('<!DOCTYPE html>');
    expect(result.html).toContain('<html');
    expect(result.html).toContain('<main id="oods-preview-root">');
    expect(validateRenderOutput(result)).toBe(true);
  });

  it('keeps dry-run output backward-compatible (no html field)', async () => {
    const result = await renderHandle({
      mode: 'full',
      schema: baseTree,
      apply: false,
    });

    expect(result.status).toBe('ok');
    expect(result.html).toBeUndefined();
    expect(validateRenderOutput(result)).toBe(true);
  });

  it('omits html when apply=true but validation fails', async () => {
    const invalidTree = structuredClone(baseTree);
    invalidTree.screens[0].children![0].component = 'UnknownComponent';

    const result = await renderHandle({
      mode: 'full',
      schema: invalidTree,
      apply: true,
    });

    expect(result.status).toBe('error');
    expect(result.html).toBeUndefined();
    expect(validateRenderOutput(result)).toBe(true);
  });

  it('renders all basic renderer-backed components without fallback when apply=true', async () => {
    const result = await renderHandle({
      mode: 'full',
      schema: basicComponentsTree,
      apply: true,
    });

    expect(result.status).toBe('ok');
    expect(result.html).toContain('<!DOCTYPE html>');
    expect(result.html).toContain('data-oods-component="Button"');
    expect(result.html).toContain('data-oods-component="Card"');
    expect(result.html).toContain('data-oods-component="Stack"');
    expect(result.html).toContain('data-oods-component="Text"');
    expect(result.html).toContain('data-oods-component="Input"');
    expect(result.html).toContain('data-oods-component="Select"');
    expect(result.html).toContain('data-oods-component="Badge"');
    expect(result.html).toContain('data-oods-component="Banner"');
    expect(result.html).toContain('data-oods-component="Table"');
    expect(result.html).toContain('data-oods-component="Tabs"');
    expect(result.html).not.toContain('data-oods-fallback="true"');
    expect(validateRenderOutput(result)).toBe(true);
  });

  it('renders content and label components without fallback when apply=true', async () => {
    const result = await renderHandle({
      mode: 'full',
      schema: labelledComponentsTree,
      apply: true,
    });

    expect(result.status).toBe('ok');
    expect(result.html).toContain('data-oods-component="CardHeader"');
    expect(result.html).toContain('data-oods-component="DetailHeader"');
    expect(result.html).toContain('data-oods-component="FormLabelGroup"');
    expect(result.html).toContain('data-oods-component="InlineLabel"');
    expect(result.html).toContain('data-oods-component="LabelCell"');
    expect(result.html).toContain('<header');
    expect(result.html).toContain('<label');
    expect(result.html).not.toContain('data-oods-fallback="true"');
    expect(validateRenderOutput(result)).toBe(true);
  });

  it('renders status and badge components without fallback when apply=true', async () => {
    const result = await renderHandle({
      mode: 'full',
      schema: badgeComponentsTree,
      apply: true,
    });

    expect(result.status).toBe('ok');
    expect(result.html).toContain('data-oods-component="StatusBadge"');
    expect(result.html).toContain('data-oods-component="CancellationBadge"');
    expect(result.html).toContain('data-oods-component="ArchivePill"');
    expect(result.html).toContain('data-oods-component="ColorizedBadge"');
    expect(result.html).toContain('data-oods-component="PreferenceSummaryBadge"');
    expect(result.html).toContain('data-oods-component="ClassificationBadge"');
    expect(result.html).toContain('data-oods-component="OwnerBadge"');
    expect(result.html).toContain('data-oods-component="MessageStatusBadge"');
    expect(result.html).toContain('data-oods-component="GeoResolutionBadge"');
    expect(result.html).toContain('data-oods-component="AddressSummaryBadge"');
    expect(result.html).toContain('data-oods-component="PriceBadge"');
    expect(result.html).toContain('data-oods-component="RoleBadgeList"');
    expect(result.html).not.toContain('data-oods-fallback="true"');
    expect(validateRenderOutput(result)).toBe(true);
  });

  it('renders panel and detail section components without fallback when apply=true', async () => {
    const result = await renderHandle({
      mode: 'full',
      schema: panelComponentsTree,
      apply: true,
    });

    expect(result.status).toBe('ok');
    expect(result.html).toContain('data-oods-component="AddressCollectionPanel"');
    expect(result.html).toContain('data-oods-component="ClassificationPanel"');
    expect(result.html).toContain('data-oods-component="CommunicationDetailPanel"');
    expect(result.html).toContain('data-oods-component="MembershipPanel"');
    expect(result.html).toContain('data-oods-component="PreferencePanel"');
    expect(result.html).toContain('data-panel-content="true"');
    expect(result.html).toContain('<section');
    expect(result.html).not.toContain('data-oods-fallback="true"');
    expect(validateRenderOutput(result)).toBe(true);
  });

  it('renders form and editor components without fallback when apply=true', async () => {
    const result = await renderHandle({
      mode: 'full',
      schema: formEditorComponentsTree,
      apply: true,
    });

    expect(result.status).toBe('ok');
    expect(result.html).toContain('data-oods-component="AddressEditor"');
    expect(result.html).toContain('data-oods-component="ClassificationEditor"');
    expect(result.html).toContain('data-oods-component="PreferenceEditor"');
    expect(result.html).toContain('data-oods-component="RoleAssignmentForm"');
    expect(result.html).toContain('data-oods-component="CancellationForm"');
    expect(result.html).toContain('data-oods-component="TagInput"');
    expect(result.html).toContain('data-oods-component="TagManager"');
    expect(result.html).toContain('data-oods-component="GeoFieldMappingForm"');
    expect(result.html).toContain('data-oods-component="ColorStatePicker"');
    expect(result.html).toContain('data-oods-component="TemplatePicker"');
    expect(result.html).toContain('data-form-content="true"');
    expect(result.html).not.toContain('data-oods-fallback="true"');
    expect(validateRenderOutput(result)).toBe(true);
  });

  it('renders timeline and event components without fallback when apply=true', async () => {
    const result = await renderHandle({
      mode: 'full',
      schema: timelineComponentsTree,
      apply: true,
    });

    expect(result.status).toBe('ok');
    expect(result.html).toContain('data-oods-component="AuditTimeline"');
    expect(result.html).toContain('data-oods-component="AddressValidationTimeline"');
    expect(result.html).toContain('data-oods-component="MembershipAuditTimeline"');
    expect(result.html).toContain('data-oods-component="MessageEventTimeline"');
    expect(result.html).toContain('data-oods-component="PreferenceTimeline"');
    expect(result.html).toContain('data-oods-component="StatusTimeline"');
    expect(result.html).toContain('data-oods-component="AuditEvent"');
    expect(result.html).toContain('data-oods-component="ArchiveEvent"');
    expect(result.html).toContain('data-oods-component="CancellationEvent"');
    expect(result.html).toContain('data-oods-component="StateTransitionEvent"');
    expect(result.html).toContain('data-oods-component="RelativeTimestamp"');
    expect(result.html).toContain('role="log"');
    expect(result.html).toContain('<time');
    expect(result.html).not.toContain('data-oods-fallback="true"');
    expect(validateRenderOutput(result)).toBe(true);
  });

  it('renders summary and metadata components without fallback when apply=true', async () => {
    const result = await renderHandle({
      mode: 'full',
      schema: summaryComponentsTree,
      apply: true,
    });

    expect(result.status).toBe('ok');
    expect(result.html).toContain('data-oods-component="ArchiveSummary"');
    expect(result.html).toContain('data-oods-component="CancellationSummary"');
    expect(result.html).toContain('data-oods-component="OwnershipMeta"');
    expect(result.html).toContain('data-oods-component="OwnershipSummary"');
    expect(result.html).toContain('data-oods-component="PriceCardMeta"');
    expect(result.html).toContain('data-oods-component="PriceSummary"');
    expect(result.html).toContain('data-oods-component="TagPills"');
    expect(result.html).toContain('data-oods-component="TagSummary"');
    expect(result.html).toContain('data-oods-component="StatusSelector"');
    expect(result.html).toContain('data-oods-component="ColorSwatch"');
    expect(result.html).toContain('data-oods-component="StatusColorLegend"');
    expect(result.html).toContain('data-oods-component="GeocodablePreview"');
    expect(result.html).toContain('data-summary-type=');
    expect(result.html).not.toContain('data-oods-fallback="true"');
    expect(validateRenderOutput(result)).toBe(true);
  });

  it('renders visualization components without fallback when apply=true', async () => {
    const result = await renderHandle({
      mode: 'full',
      schema: vizComponentsTree,
      apply: true,
    });

    expect(result.status).toBe('ok');
    expect(result.html).toContain('data-oods-component="VizAreaControls"');
    expect(result.html).toContain('data-oods-component="VizAreaPreview"');
    expect(result.html).toContain('data-oods-component="VizMarkControls"');
    expect(result.html).toContain('data-oods-component="VizMarkPreview"');
    expect(result.html).toContain('data-oods-component="VizLineControls"');
    expect(result.html).toContain('data-oods-component="VizLinePreview"');
    expect(result.html).toContain('data-oods-component="VizPointControls"');
    expect(result.html).toContain('data-oods-component="VizPointPreview"');
    expect(result.html).toContain('data-oods-component="VizColorControls"');
    expect(result.html).toContain('data-oods-component="VizColorLegendConfig"');
    expect(result.html).toContain('data-oods-component="VizEncodingBadge"');
    expect(result.html).toContain('data-oods-component="VizAxisControls"');
    expect(result.html).toContain('data-oods-component="VizAxisSummary"');
    expect(result.html).toContain('data-oods-component="VizSizeControls"');
    expect(result.html).toContain('data-oods-component="VizSizeSummary"');
    expect(result.html).toContain('data-oods-component="VizScaleControls"');
    expect(result.html).toContain('data-oods-component="VizScaleSummary"');
    expect(result.html).toContain('data-oods-component="VizRoleBadge"');
    expect(result.html).toContain('data-viz-preview-type=');
    expect(result.html).not.toContain('data-oods-fallback="true"');
    expect(validateRenderOutput(result)).toBe(true);
  });

  it('defaults mode to full when schemaRef provided without mode', async () => {
    const schemaRef = createSchemaRef(baseTree, 'compose').ref;

    const result = await renderHandle({ schemaRef, apply: true } as any);

    expect(result.status).toBe('ok');
    expect(result.html).toContain('<!DOCTYPE html>');
  });

  it('defaults mode to full when schema provided without mode', async () => {
    const result = await renderHandle({ schema: baseTree, apply: true } as any);

    expect(result.status).toBe('ok');
    expect(result.html).toContain('<!DOCTYPE html>');
  });
});
