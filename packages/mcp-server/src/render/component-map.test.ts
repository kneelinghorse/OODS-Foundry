import { describe, expect, it } from 'vitest';
import { Window } from 'happy-dom';
import { relativeTimestampEmptyScenario } from '@oods/component-contracts';
import type { UiElement } from '../schemas/generated.js';
import { hasMappedRenderer, renderMappedComponent } from './component-map.js';

function makeNode(component: string, props: Record<string, unknown> = {}, extras: Partial<UiElement> = {}): UiElement {
  return {
    id: extras.id ?? `${component.toLowerCase()}-node`,
    component,
    props,
    children: extras.children,
    layout: extras.layout,
    meta: extras.meta,
    route: extras.route,
    style: extras.style,
    bindings: extras.bindings,
  };
}

describe('component map coverage', () => {
  it('covers required components', () => {
    for (const component of [
      'Button',
      'Card',
      'CardHeader',
      'AddressCollectionPanel',
      'ClassificationPanel',
      'CommunicationDetailPanel',
      'MembershipPanel',
      'PreferencePanel',
      'AddressEditor',
      'ClassificationEditor',
      'PreferenceEditor',
      'RoleAssignmentForm',
      'CancellationForm',
      'TagInput',
      'TagManager',
      'GeoFieldMappingForm',
      'ColorStatePicker',
      'TemplatePicker',
      'AuditTimeline',
      'AddressValidationTimeline',
      'MembershipAuditTimeline',
      'MessageEventTimeline',
      'PreferenceTimeline',
      'StatusTimeline',
      'AuditEvent',
      'ArchiveEvent',
      'CancellationEvent',
      'StateTransitionEvent',
      'RelativeTimestamp',
      'ArchiveSummary',
      'CancellationSummary',
      'OwnershipMeta',
      'OwnershipSummary',
      'PriceCardMeta',
      'PriceSummary',
      'TagPills',
      'TagSummary',
      'StatusSelector',
      'ColorSwatch',
      'StatusColorLegend',
      'GeocodablePreview',
      'VizAreaControls',
      'VizAreaPreview',
      'VizMarkControls',
      'VizMarkPreview',
      'VizLineControls',
      'VizLinePreview',
      'VizPointControls',
      'VizPointPreview',
      'VizScatterControls',
      'VizScatterPreview',
      'VizHeatmapControls',
      'VizHeatmapPreview',
      'VizOpacityControls',
      'VizOpacitySummary',
      'VizShapeControls',
      'VizShapeLegend',
      'VizColorControls',
      'VizColorLegendConfig',
      'VizEncodingBadge',
      'VizAxisControls',
      'VizAxisSummary',
      'VizSizeControls',
      'VizSizeSummary',
      'VizScaleControls',
      'VizScaleSummary',
      'VizRoleBadge',
      'DetailHeader',
      'FormLabelGroup',
      'InlineLabel',
      'LabelCell',
      'StatusBadge',
      'CancellationBadge',
      'ArchivePill',
      'ColorizedBadge',
      'PreferenceSummaryBadge',
      'ClassificationBadge',
      'OwnerBadge',
      'MessageStatusBadge',
      'GeoResolutionBadge',
      'AddressSummaryBadge',
      'PriceBadge',
      'RoleBadgeList',
      'Stack',
      'Text',
      'Input',
      'Checkbox',
      'DatePicker',
      'Select',
      'Textarea',
      'Badge',
      'Banner',
      'Table',
      'Tabs',
    ]) {
      expect(hasMappedRenderer(component)).toBe(true);
    }
  });

  it('renders Button with semantic HTML and prop serialization', () => {
    const html = renderMappedComponent(
      makeNode('Button', { type: 'submit', disabled: true, label: 'Save', variant: 'primary', count: 2 })
    );

    expect(html.startsWith('<button')).toBe(true);
    expect(html).toContain('type="submit"');
    expect(html).toContain(' disabled');
    expect(html).toContain('data-oods-component="Button"');
    expect(html).not.toContain('data-prop-variant="primary"');
    expect(html).not.toContain('data-prop-count="2"');
    expect(html).toContain('>Save</button>');
  });

  it('renders Card as article', () => {
    const html = renderMappedComponent(makeNode('Card', { elevation: 'md' }), '<p>Content</p>');

    expect(html.startsWith('<article')).toBe(true);
    expect(html).toContain('data-oods-component="Card"');
    expect(html).not.toContain('data-prop-elevation="md"');
    expect(html).toContain('<p>Content</p>');
  });

  it('honors the canonical Card container element', () => {
    const html = renderMappedComponent(makeNode('Card', { as: 'aside' }), 'Supporting content');

    expect(html.startsWith('<aside')).toBe(true);
    expect(html).toContain('>Supporting content</aside>');
    expect(html).not.toContain('data-prop-as');
  });

  it('renders Stack as div and preserves child HTML', () => {
    const html = renderMappedComponent(makeNode('Stack', { gapToken: 'spacing.md' }), '<span>Row</span>');

    expect(html.startsWith('<div')).toBe(true);
    expect(html).toContain('data-layout="stack"');
    expect(html).not.toContain('data-prop-gap-token="spacing.md"');
    expect(html).toContain('<span>Row</span>');
  });

  it('renders Text with tag override', () => {
    const html = renderMappedComponent(makeNode('Text', { as: 'h3', text: 'Heading', tone: 'positive' }));

    expect(html.startsWith('<h3')).toBe(true);
    expect(html).toContain('data-oods-component="Text"');
    expect(html).not.toContain('data-prop-tone="positive"');
    expect(html).toContain('>Heading</h3>');
  });

  // s223-m02 (#2527 ruling 13c): HTML writes Text as React and Vue do, a span.oods-text, so a detail's text value sits
  // inline under its label like a money value instead of as a paragraph with its own margins; `as` still names the element.
  it('renders Text as the span.oods-text React and Vue write, keeping as and an authored class', () => {
    const plain = renderMappedComponent(makeNode('Text', { text: 'Northwind Traders' }));
    expect(plain).toBe('<span id="text-node" class="oods-text" data-oods-component="Text" data-oods-node-id="text-node">Northwind Traders</span>');
    const strong = renderMappedComponent(makeNode('Text', { as: 'strong', content: 'Name', className: 'row-label' }));
    expect(strong).toBe('<strong id="text-node" class="oods-text row-label" data-oods-component="Text" data-oods-node-id="text-node">Name</strong>');
  });

  it('renders Text label as an accessible description without overriding explicit ARIA', () => {
    const derived = renderMappedComponent(makeNode('Text', {
      content: 'Active',
      label: 'Current lifecycle status',
    }));
    const explicit = renderMappedComponent(makeNode('Text', {
      content: 'Active',
      label: 'Current lifecycle status',
      'aria-description': 'Explicit status description',
    }));

    expect(derived).toContain('aria-description="Current lifecycle status"');
    expect(derived).not.toContain('data-prop-label');
    expect(explicit).toContain('aria-description="Explicit status description"');
  });

  it('renders Input as semantic input element', () => {
    const html = renderMappedComponent(
      makeNode('Input', { type: 'email', placeholder: 'name@site.tld', required: true, mask: 'email' })
    );

    expect(html).toContain('<input');
    expect(html).toContain('type="email"');
    expect(html).toContain('placeholder="name@site.tld"');
    expect(html).toContain(' required');
    expect(html).not.toContain('data-prop-mask="email"');
  });

  it('associates canonical Input label, help, and validation content', () => {
    const html = renderMappedComponent(makeNode('Input', {
      id: 'email-input',
      label: 'Email address',
      help: 'Use a work address.',
      validation: { state: 'error', message: 'Email is required.' },
    }));

    expect(html).toContain('<label class="oods-field-label" for="email-input">Email address</label>');
    expect(html).toContain('<input id="email-input"');
    expect(html).toContain('aria-describedby="email-input-help email-input-validation"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('<small class="oods-field-help" id="email-input-help">Use a work address.</small>');
    expect(html).toContain('>Email is required.</p>');
    expect(html).not.toContain('data-prop-label');
  });

  it('renders Checkbox as semantic checkbox input', () => {
    const html = renderMappedComponent(
      makeNode('Checkbox', { name: 'tos', checked: true, required: true })
    );

    expect(html).toContain('<input');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain(' checked');
    expect(html).toContain(' required');
  });

  it('renders DatePicker as date input', () => {
    const html = renderMappedComponent(
      makeNode('DatePicker', { name: 'startDate', min: '2026-01-01', value: '2026-03-06' })
    );

    expect(html).toContain('<input');
    expect(html).toContain('type="date"');
    expect(html).toContain('name="startDate"');
    expect(html).toContain('value="2026-03-06"');
  });

  it('renders Select placeholder as a disabled empty-value option', () => {
    const html = renderMappedComponent(makeNode('Select', {
      placeholder: 'Choose a status',
      options: [{ value: 'active', label: 'Active' }],
    }));

    expect(html).toContain('<option value="" disabled selected>Choose a status</option>');
    expect(html).not.toContain('data-prop-placeholder');
  });

  it('renders Select with option list and selected value', () => {
    const html = renderMappedComponent(
      makeNode('Select', {
        name: 'status',
        value: 'active',
        options: [
          { value: 'draft', label: 'Draft' },
          { value: 'active', label: 'Active' },
        ],
      })
    );

    expect(html).toContain('<select');
    expect(html).toContain('name="status"');
    expect(html).toContain('<option value="draft">Draft</option>');
    expect(html).toContain('<option value="active" selected>Active</option>');
  });

  it('renders Textarea with inner text content', () => {
    const html = renderMappedComponent(
      makeNode('Textarea', { name: 'notes', rows: 6, value: 'Longer form copy.' })
    );

    expect(html).toContain('<textarea');
    expect(html).toContain('name="notes"');
    expect(html).toContain('rows="6"');
    expect(html).toContain('>Longer form copy.</textarea>');
  });

  // s223-m01 (#2527 rulings 6-7): what is not content is not drawn, and ownership reads as one phrase, as in React and Vue.
  it('renders nothing for an event card with no events, and the events when there are', () => {
    for (const component of ['ArchiveEvent', 'CancellationEvent', 'StateTransitionEvent']) {
      expect(renderMappedComponent(makeNode(component, { title: 'Cancellation' }))).toBe('');
    }
    const cancelled = renderMappedComponent(makeNode('CancellationEvent', { title: 'Cancellation', timestamp: '2026-09-01T12:00:00Z', reason: 'Customer request' }));
    expect(cancelled).toContain('Cancellation requested');
    expect(cancelled).not.toContain('No events recorded.');
  });

  it('hides a default-only chip when its recipe asks, and still shows the recorded state', () => {
    expect(renderMappedComponent(makeNode('ArchivePill', { isArchived: false, hideWhenFalse: true }))).toBe('');
    expect(renderMappedComponent(makeNode('CancellationBadge', { cancelAtPeriodEnd: false, hideWhenFalse: true }))).toBe('');
    expect(renderMappedComponent(makeNode('ArchivePill', { isArchived: true, hideWhenFalse: true }))).toContain('Archived');
    expect(renderMappedComponent(makeNode('CancellationBadge', { cancelAtPeriodEnd: true, hideWhenFalse: true }))).toContain('Cancellation scheduled');
    expect(renderMappedComponent(makeNode('ArchivePill', { isArchived: false }))).toContain('Not archived');
  });

  it('hides a detail summary that would only state its default when its recipe asks, as React and Vue do', () => {
    // s224-m01 (#2542 ruling 6): the 0.4.1 Subscription detail read "Cancel at period end: No · Code: Not recorded" and
    // "Archived: No". An empty code is not a value, so that card hides too; a recorded or scheduled state keeps its card.
    const summary = (component: string, props: Record<string, unknown>) => renderMappedComponent(makeNode(component, props));
    expect(summary('ArchiveSummary', { isArchived: false, archivedAt: null, reason: '', hideWhenDefault: true })).toBe('');
    expect(summary('CancellationSummary', { cancelAtPeriodEnd: false, code: '', hideWhenDefault: true, cancelAtPeriodEndField: 'cancel_at_period_end', codeField: 'cancellation_reason_code' })).toBe('');
    expect(summary('ArchiveSummary', { isArchived: true, hideWhenDefault: true })).toContain('<dd>Yes</dd>');
    expect(summary('ArchiveSummary', { isArchived: false, reason: 'Retention policy', hideWhenDefault: true })).toContain('<dd>Retention policy</dd>');
    expect(summary('CancellationSummary', { cancelAtPeriodEnd: true, hideWhenDefault: true })).toContain('<dd>Yes</dd>');
    expect(summary('CancellationSummary', { cancelAtPeriodEnd: false, requestedAt: '2026-09-21T16:40:00Z', hideWhenDefault: true })).toContain('Requested at');
    // An unknown flag is not the default, and a summary not asked to hide still states the field.
    expect(summary('CancellationSummary', { hideWhenDefault: true, cancelAtPeriodEndField: 'cancel_at_period_end' })).toContain('data-oods-component="CancellationSummary"');
    expect(summary('ArchiveSummary', { isArchived: false })).toContain('<dd>No</dd>');
  });

  it('writes ownership as one phrase when the owner label is bound', () => {
    const named = renderMappedComponent(makeNode('OwnershipMeta', { ownerLabel: 'Pricing and packaging', ownerType: 'team' }));
    expect(named).toContain('>Owned by Pricing and packaging · team</span>');
    expect(named).not.toContain('Owner Type');
    expect(renderMappedComponent(makeNode('OwnershipMeta', { ownerLabel: 'Owner unavailable', ownerType: 'team' }))).toContain('>Team-owned</span>');
    expect(renderMappedComponent(makeNode('OwnershipMeta', { ownerType: 'team' }))).toContain('Owner Type:');
  });

  it('renders Badge as span', () => {
    const html = renderMappedComponent(makeNode('Badge', { label: 'New', tone: 'info' }));

    expect(html.startsWith('<span')).toBe(true);
    expect(html).toContain('data-oods-component="Badge"');
    expect(html).not.toContain('data-prop-tone="info"');
    expect(html).toContain('>New</span>');
  });

  it.each([
    {
      component: 'StatusBadge',
      props: { status: 'active', variant: 'subtle', label: 'Active' },
      expectedVariant: 'subtle',
      expectedStatus: 'active',
    },
    {
      component: 'CancellationBadge',
      props: { cancelAtPeriodEnd: true },
      expectedVariant: 'cancellation',
      expectedStatus: 'true',
    },
    {
      component: 'ArchivePill',
      props: { isArchived: true, label: 'Archived' },
      expectedVariant: 'archive',
      expectedStatus: 'true',
    },
    {
      component: 'ColorizedBadge',
      props: { state: 'warning', color: 'amber' },
      expectedVariant: 'colorized',
      expectedStatus: 'warning',
      expectedColor: 'amber',
    },
    {
      component: 'PreferenceSummaryBadge',
      props: { namespace: 'billing', version: 3 },
      expectedVariant: 'preference',
      expectedStatus: '3',
    },
    {
      component: 'ClassificationBadge',
      props: { category: 'enterprise', mode: 'strict' },
      expectedVariant: 'classification',
      expectedStatus: 'strict',
    },
    {
      component: 'OwnerBadge',
      props: { owner: 'Operations', status: 'assigned' },
      expectedVariant: 'owner',
      expectedStatus: 'assigned',
    },
    {
      component: 'MessageStatusBadge',
      props: { delivery: 'delivered' },
      expectedVariant: 'message',
      expectedStatus: 'delivered',
    },
    {
      component: 'GeoResolutionBadge',
      props: { resolution: 'rooftop' },
      expectedVariant: 'geo',
      expectedStatus: 'rooftop',
      expectedColor: 'rooftop',
    },
    {
      component: 'AddressSummaryBadge',
      props: { role: 'billing' },
      expectedVariant: 'address',
      expectedStatus: 'billing',
    },
    {
      component: 'PriceBadge',
      props: { amountCents: 2599, currency: 'usd' },
      expectedVariant: 'price',
    },
  ])(
    'renders $component as a span badge and maps status/variant/color props to data attributes',
    ({ component, props, expectedVariant, expectedStatus, expectedColor }) => {
      const html = renderMappedComponent(makeNode(component, props));

      expect(html.startsWith('<span')).toBe(true);
      expect(html).toContain(`data-oods-component="${component}"`);
      expect(html).toContain(`data-badge-variant="${expectedVariant}"`);
      if (expectedStatus) expect(html).toContain(`data-badge-status="${expectedStatus}"`);
      if (expectedColor) expect(html).toContain(`data-badge-color="${expectedColor}"`);
    }
  );

  it('renders RoleBadgeList as nested span badges', () => {
    const html = renderMappedComponent(makeNode('RoleBadgeList', { roles: ['admin', 'auditor'], tone: 'compact' }));

    expect(html.startsWith('<span')).toBe(true);
    expect(html).toContain('data-oods-component="RoleBadgeList"');
    expect(html).toContain('data-badge-variant="compact"');
    expect((html.match(/data-role-badge="true"/g) || []).length).toBe(2);
    expect(html).toContain('admin');
    expect(html).toContain('auditor');
  });

  it('renders Banner as section with default status role', () => {
    const html = renderMappedComponent(makeNode('Banner', { message: 'Sync complete', intent: 'success' }));

    expect(html.startsWith('<section')).toBe(true);
    expect(html).toContain('role="status"');
    expect(html).not.toContain('data-prop-intent="success"');
    // s222-m02 (#2502 ruling 11): the React and Vue Banner markup: the content column holds the body.
    expect(html).toContain('class="oods-banner"');
    expect(html).toContain('<div class="oods-banner__content"><p class="oods-banner__body">Sync complete</p></div></section>');
  });

  it('renders CardHeader as semantic header with title and supporting copy', () => {
    const html = renderMappedComponent(
      makeNode('CardHeader', { title: 'Account Summary', supporting: 'Last updated 2m ago', level: 4 })
    );

    expect(html.startsWith('<header')).toBe(true);
    expect(html).toContain('<h4>Account Summary</h4>');
    expect(html).toContain('data-oods-supporting="true"');
    expect(html).toContain('Last updated 2m ago');
  });

  it('renders CardHeader children when provided', () => {
    const html = renderMappedComponent(makeNode('CardHeader', { title: 'Ignored' }), '<h5>Slot Title</h5>');

    expect(html.startsWith('<header')).toBe(true);
    expect(html).toContain('<h5>Slot Title</h5>');
    expect(html).not.toContain('<h2>Ignored</h2>');
  });

  it('renders DetailHeader with semantic heading, subtitle, and metadata', () => {
    const html = renderMappedComponent(
      makeNode('DetailHeader', {
        title: 'Invoice #1042',
        subtitle: 'Billing profile',
        metadata: 'Updated 2026-02-26',
        level: 1,
      })
    );

    expect(html.startsWith('<header')).toBe(true);
    expect(html).toContain('<h1>Invoice #1042</h1>');
    expect(html).toContain('data-oods-subtitle="true"');
    expect(html).toContain('Billing profile');
    expect(html).toContain('data-oods-metadata="true"');
    expect(html).toContain('Updated 2026-02-26');
  });

  it('renders DetailHeader children when provided', () => {
    const html = renderMappedComponent(makeNode('DetailHeader', { title: 'Ignored' }), '<h2>Slot Detail Header</h2>');

    expect(html.startsWith('<header')).toBe(true);
    expect(html).toContain('<h2>Slot Detail Header</h2>');
    expect(html).not.toContain('<h2>Ignored</h2>');
  });

  it('renders FormLabelGroup as semantic label with for/hint content', () => {
    const html = renderMappedComponent(
      makeNode('FormLabelGroup', { label: 'Email', htmlFor: 'email-input', placeholder: 'name@example.com' })
    );

    expect(html.startsWith('<label')).toBe(true);
    expect(html).toContain('for="email-input"');
    expect(html).toContain('data-oods-form-label="true"');
    expect(html).toContain('Email');
    expect(html).toContain('data-oods-form-hint="true"');
    expect(html).toContain('name@example.com');
  });

  it('renders FormLabelGroup children after label text', () => {
    const html = renderMappedComponent(
      makeNode('FormLabelGroup', { label: 'Role', inputId: 'role-select' }),
      '<span>Admin</span>'
    );

    expect(html.startsWith('<label')).toBe(true);
    expect(html).toContain('for="role-select"');
    expect(html).toContain('<span data-oods-form-label="true">Role</span><span>Admin</span>');
  });

  it('renders InlineLabel as span and applies maxLength truncation', () => {
    const html = renderMappedComponent(makeNode('InlineLabel', { label: 'Customer Success Specialist', maxLength: 12 }));

    expect(html.startsWith('<span')).toBe(true);
    expect(html).toContain('data-oods-component="InlineLabel"');
    expect(html).toContain('Customer Su...');
  });

  it('renders InlineLabel children when provided', () => {
    const html = renderMappedComponent(makeNode('InlineLabel', { label: 'Ignored' }), '<strong>Slot Label</strong>');

    expect(html.startsWith('<span')).toBe(true);
    expect(html).toContain('<strong>Slot Label</strong>');
    expect(html).not.toContain('Ignored');
  });

  it('renders LabelCell with primary and supporting text', () => {
    const html = renderMappedComponent(
      makeNode('LabelCell', {
        label: 'Extremely Long Customer Label',
        description: 'Description requiring truncation',
        truncate: true,
        maxLength: 10,
      })
    );

    expect(html.startsWith('<span')).toBe(true);
    expect(html).toContain('data-oods-label-cell-primary="true"');
    expect(html).toContain('Extremely...');
    expect(html).toContain('data-oods-label-cell-description="true"');
    expect(html).toContain('Descripti...');
  });

  it('renders LabelCell children when provided', () => {
    const html = renderMappedComponent(makeNode('LabelCell', { label: 'Ignored' }), '<em>Slot Cell</em>');

    expect(html.startsWith('<span')).toBe(true);
    expect(html).toContain('<em>Slot Cell</em>');
    expect(html).not.toContain('Ignored');
  });

  it.each([
    {
      component: 'AddressCollectionPanel',
      props: { title: 'Addresses', field: 'addresses', roleField: 'address_roles', summary: '2 addresses' },
      panelType: 'address',
      expectedTitle: 'Addresses',
      expectedDataProp: 'data-prop-field="addresses"',
      expectedSummary: '2 addresses',
    },
    {
      component: 'ClassificationPanel',
      props: { title: 'Classification', categoriesField: 'categories', modeParameter: 'strict' },
      panelType: 'classification',
      expectedTitle: 'Classification',
      expectedDataProp: 'data-prop-categories-field="categories"',
    },
    {
      component: 'CommunicationDetailPanel',
      props: { label: 'Communication', channelsField: 'channel_catalog' },
      panelType: 'communication',
      expectedTitle: 'Communication',
      expectedDataProp: 'data-prop-channels-field="channel_catalog"',
    },
    {
      component: 'MembershipPanel',
      props: { heading: 'Membership', membershipsField: 'membership_records' },
      panelType: 'membership',
      expectedTitle: 'Membership',
      expectedDataProp: 'data-prop-memberships-field="membership_records"',
    },
    {
      component: 'PreferencePanel',
      props: { name: 'Preferences', preferencesField: 'preference_document' },
      panelType: 'preference',
      expectedTitle: 'Preferences',
      expectedDataProp: 'data-prop-preferences-field="preference_document"',
    },
  ])('renders $component as semantic section panel', ({ component, props, panelType, expectedTitle, expectedDataProp, expectedSummary }) => {
    const html = renderMappedComponent(makeNode(component, props));

    expect(html.startsWith('<section')).toBe(true);
    expect(html).toContain(`data-oods-component="${component}"`);
    expect(html).toContain(`data-panel-type="${panelType}"`);
    expect(html).toContain('<header data-panel-header="true">');
    expect(html).toContain(`<h2>${expectedTitle}</h2>`);
    expect(html).toContain('<div data-panel-content="true">');
    expect(html).not.toContain(expectedDataProp);
    if (expectedSummary) {
      expect(html).toContain('data-panel-summary="true"');
      expect(html).toContain(expectedSummary);
    }
  });

  it('renders panel children inside the panel content slot', () => {
    const html = renderMappedComponent(
      makeNode('CommunicationDetailPanel', { title: 'Communication' }),
      '<article data-testid="child-thread">thread</article>'
    );

    expect(html).toContain('<div data-panel-content="true"><article data-testid="child-thread">thread</article></div>');
  });

  it.each([
    {
      component: 'AddressEditor',
      props: { title: 'Address', street: '123 Main', city: 'Seattle' },
      expectedTag: 'form',
      formType: 'address-editor',
      expectedControls: ['name="street"', 'name="city"', 'data-form-control="input"'],
    },
    {
      component: 'ClassificationEditor',
      props: { title: 'Classification', category: 'enterprise', modes: ['strict', 'flexible'], mode: 'strict' },
      expectedTag: 'form',
      formType: 'classification-editor',
      expectedControls: ['name="mode"', 'data-form-control="select"'],
    },
    {
      component: 'PreferenceEditor',
      props: { title: 'Preferences', namespaces: ['billing'], namespace: 'billing', document: '{"enabled":true}' },
      expectedTag: 'form',
      formType: 'preference-editor',
      expectedControls: ['name="namespace"', 'data-form-control="textarea"'],
    },
    {
      component: 'RoleAssignmentForm',
      props: { title: 'Roles', roles: ['admin', 'viewer'], role: 'admin' },
      expectedTag: 'form',
      formType: 'role-assignment',
      expectedControls: ['name="role"', 'name="assignee"'],
    },
    {
      component: 'CancellationForm',
      props: { title: 'Cancel', allowedReasons: ['budget', 'duplicate'], reasonCode: 'budget' },
      expectedTag: 'form',
      formType: 'cancellation',
      expectedControls: ['name="reasonCode"', 'name="reason"'],
    },
    {
      component: 'TagInput',
      props: { label: 'Tags', tags: ['core', 'urgent'] },
      expectedTag: 'fieldset',
      formType: 'tag-input',
      expectedControls: ['data-tag-list="true"', 'data-tag-item="true"', 'name="tag"'],
    },
    {
      component: 'TagManager',
      props: { title: 'Manage Tags', tags: ['alpha'] },
      expectedTag: 'form',
      formType: 'tag-manager',
      expectedControls: ['data-tag-list="true"', 'name="newTag"'],
    },
    {
      component: 'GeoFieldMappingForm',
      props: { title: 'Geo Mapping', latitudeField: 'lat', longitudeField: 'lon', identifierField: 'city', autoDetect: true },
      expectedTag: 'form',
      formType: 'geo-mapping',
      expectedControls: ['name="latitudeField"', 'name="longitudeField"', 'type="checkbox"'],
    },
    {
      component: 'ColorStatePicker',
      props: { title: 'Color', colorStates: ['default', 'warning'], value: 'warning' },
      expectedTag: 'fieldset',
      formType: 'color-state-picker',
      expectedControls: ['name="colorState"', 'data-form-control="select"'],
    },
    {
      component: 'TemplatePicker',
      props: { title: 'Template', templates: ['welcome'], channels: ['email'], value: 'welcome', channel: 'email' },
      expectedTag: 'fieldset',
      formType: 'template-picker',
      expectedControls: ['name="template"', 'name="channel"'],
    },
  ])('renders $component as semantic form/editor container', ({ component, props, expectedTag, formType, expectedControls }) => {
    const html = renderMappedComponent(makeNode(component, props));

    expect(html.startsWith(`<${expectedTag}`)).toBe(true);
    expect(html).toContain(`data-oods-component="${component}"`);
    expect(html).toContain(`data-form-type="${formType}"`);
    expect(html).toContain('data-form-content="true"');
    for (const control of expectedControls) {
      expect(html).toContain(control);
    }
  });

  it('renders form/editor children inside the form content slot', () => {
    const html = renderMappedComponent(
      makeNode('TagManager', { title: 'Tag Manager' }),
      '<p data-testid="custom-form-body">Custom editor body</p>'
    );

    expect(html).toContain('<div data-form-content="true"><p data-testid="custom-form-body">Custom editor body</p></div>');
  });

  it.each([
    {
      component: 'AuditTimeline',
      props: { title: 'Audit', events: [{ label: 'Created', timestamp: '2026-02-26T00:00:00Z' }] },
      timelineType: 'audit',
      expectedLabel: 'Created',
    },
    {
      component: 'AddressValidationTimeline',
      props: { title: 'Address Validation', validations: [{ label: 'Validated', timestamp: '2026-02-26T00:01:00Z' }] },
      timelineType: 'address-validation',
      expectedLabel: 'Validated',
    },
    {
      component: 'MembershipAuditTimeline',
      props: { title: 'Membership', memberships: [{ label: 'Role Granted', timestamp: '2026-02-26T00:02:00Z' }] },
      timelineType: 'membership',
      expectedLabel: 'Role Granted',
    },
    {
      component: 'MessageEventTimeline',
      props: { title: 'Messages', messages: [{ label: 'Message Sent', timestamp: '2026-02-26T00:03:00Z' }] },
      timelineType: 'message',
      expectedLabel: 'Message Sent',
    },
    {
      component: 'PreferenceTimeline',
      props: { title: 'Preferences', changes: [{ label: 'Preference Updated', timestamp: '2026-02-26T00:04:00Z' }] },
      timelineType: 'preference',
      expectedLabel: 'Preference Updated',
    },
    {
      component: 'StatusTimeline',
      props: { title: 'Status', stateHistory: [{ label: 'active', timestamp: '2026-02-26T00:05:00Z' }] },
      timelineType: 'status',
      expectedLabel: 'active',
    },
  ])('renders $component as timeline log with ordered event stream', ({ component, props, timelineType, expectedLabel }) => {
    const html = renderMappedComponent(makeNode(component, props));

    expect(html.startsWith('<div')).toBe(true);
    expect(html).toContain(`data-oods-component="${component}"`);
    expect(html).toContain(`data-timeline-type="${timelineType}"`);
    expect(html).toContain('role="log"');
    expect(html).toContain('<ol data-timeline-events="true">');
    expect(html).toContain(expectedLabel);
  });

  it('renders timeline children in ordered event slot', () => {
    const html = renderMappedComponent(
      makeNode('AuditTimeline', { title: 'Audit' }),
      '<li><article data-testid="timeline-child">Custom Event</article></li>'
    );

    expect(html).toContain('<ol data-timeline-events="true"><li><article data-testid="timeline-child">Custom Event</article></li></ol>');
  });

  it.each([
    {
      component: 'AuditEvent',
      props: { label: 'Record Created', timestamp: '2026-02-26T00:00:00Z', detail: 'Created by system' },
      eventType: 'audit',
    },
    {
      component: 'ArchiveEvent',
      props: { title: 'Record Archived', archivedAt: '2026-02-26T01:00:00Z', reason: 'policy' },
      eventType: 'archive',
    },
    {
      component: 'CancellationEvent',
      props: { label: 'Cancellation Requested', timestamp: '2026-02-26T02:00:00Z', reason: 'budget' },
      eventType: 'cancellation',
    },
    {
      component: 'StateTransitionEvent',
      props: { title: 'State transitions', history: [{ at: '2026-02-26T03:00:00Z', from: 'pending', to: 'active' }] },
      eventType: 'state-transition',
    },
  ])('renders $component as semantic timeline article event', ({ component, props, eventType }) => {
    const html = renderMappedComponent(makeNode(component, props));

    expect(html.startsWith('<article')).toBe(true);
    expect(html).toContain(`data-oods-component="${component}"`);
    if (component === 'AuditEvent') {
      expect(html).toContain(`data-event-type="${eventType}"`);
      expect(html).toContain('data-event-label="true"');
    } else {
      expect(html).toContain('class="oods-trait-recipe"');
      expect(html).toContain('<ol>');
    }
    expect(html).toContain('<time');
    expect(html).toContain('datetime="2026-02-26T');
  });

  it('renders RelativeTimestamp as semantic time element with datetime', () => {
    const html = renderMappedComponent(
      makeNode('RelativeTimestamp', { datetime: '2026-02-26T03:00:00Z', relative: '2 minutes ago' })
    );

    expect(html.startsWith('<time')).toBe(true);
    expect(html).toContain('data-oods-component="RelativeTimestamp"');
    expect(html).toContain('datetime="2026-02-26T03:00:00Z"');
    expect(html).toContain('>2 minutes ago</time>');
  });

  // s222-m03 (#2502 ruling 16): the HTML preview used to render an empty element where React said "Unknown time".
  it('renders the shared empty RelativeTimestamp scenario as "Unknown time" without a datetime', () => {
    const html = renderMappedComponent(makeNode('RelativeTimestamp', { ...relativeTimestampEmptyScenario.props }));

    expect(html).toContain('>Unknown time</time>');
    expect(html).not.toMatch(/\sdatetime=/i);
  });

  it('renders cancellation booleans as named values rather than a literal boolean', () => {
    const html = renderMappedComponent(makeNode('CancellationSummary', {
      label: 'Cancellation schedule',
      cancelAtPeriodEnd: true,
    }));

    expect(html).toContain('Cancellation schedule');
    expect(html).toContain('<dt>Cancel at period end</dt><dd>Yes</dd>');
    expect(html).not.toContain('<dd>true</dd>');
  });

  it.each([
    {
      component: 'ArchiveSummary',
      props: { title: 'Archive', isArchived: true, archivedAt: '2026-02-26T01:00:00Z', reason: 'policy' },
      summaryType: 'archive',
    },
    {
      component: 'CancellationSummary',
      props: { title: 'Cancellation', cancelAtPeriodEnd: true, requestedAt: '2026-02-26T02:00:00Z', reason: 'budget' },
      summaryType: 'cancellation',
    },
    {
      component: 'OwnershipSummary',
      props: { title: 'Ownership', ownerId: 'usr_123', ownerType: 'team', role: 'admin' },
      summaryType: 'ownership',
    },
    {
      component: 'PriceSummary',
      props: { title: 'Pricing', amount: '29.00', currency: 'USD', model: 'tiered', interval: 'monthly' },
      summaryType: 'price',
    },
    {
      component: 'TagSummary',
      props: { title: 'Tags', tagCount: 4, tags: 'core, urgent' },
      summaryType: 'tags',
    },
    {
      component: 'GeocodablePreview',
      props: { title: 'Geo Preview', resolution: 'rooftop', requiresLookup: false, detectedFields: 'lat,lon' },
      summaryType: 'geocodable',
    },
  ])('renders $component as summary section with definition list', ({ component, props, summaryType }) => {
    const html = renderMappedComponent(makeNode(component, props));

    expect(html.startsWith('<section')).toBe(true);
    expect(html).toContain(`data-oods-component="${component}"`);
    expect(html).toContain(`data-summary-type="${summaryType}"`);
    expect(html).toContain('<dl>');
    expect(html).toContain('<dt>');
    expect(html).toContain('<dd>');
  });

  it.each([
    {
      component: 'OwnershipMeta',
      props: { title: 'Ownership Meta', ownerType: 'team', role: 'admin' },
      metaType: 'ownership',
    },
    {
      component: 'PriceCardMeta',
      props: { title: 'Price Meta', model: 'tiered', interval: 'monthly' },
      metaType: 'price',
    },
  ])('renders $component as compact meta inline display', ({ component, props, metaType }) => {
    const html = renderMappedComponent(makeNode(component, props));

    expect(html.startsWith('<div')).toBe(true);
    expect(html).toContain(`data-oods-component="${component}"`);
    expect(html).toContain(`data-meta-type="${metaType}"`);
    expect(html).toContain('data-meta-item="true"');
  });

  it('renders TagPills with overflow indicator', () => {
    const html = renderMappedComponent(
      makeNode('TagPills', { tags: ['alpha', 'beta', 'gamma', 'delta'], maxVisible: 3, overflowLabel: '+{{ tag_count }}' })
    );

    expect(html.startsWith('<div')).toBe(true);
    expect(html).toContain('data-summary-type="tag-pills"');
    expect((html.match(/data-tag-pill="true"/g) || []).length).toBe(3);
    expect(html).toContain('data-tag-overflow="true"');
    expect(html).toContain('+4');
  });

  it('renders StatusSelector with select-like control', () => {
    const html = renderMappedComponent(
      makeNode('StatusSelector', { label: 'Status', states: ['draft', 'active'], value: 'active' })
    );

    expect(html.startsWith('<div')).toBe(true);
    expect(html).toContain('data-summary-type="status-selector"');
    expect(html).toContain('data-form-control="select"');
    expect(html).toContain('name="status"');
  });

  it('renders ColorSwatch as compact swatch span', () => {
    const html = renderMappedComponent(makeNode('ColorSwatch', { color: 'emerald', label: 'Emerald' }));

    expect(html.startsWith('<span')).toBe(true);
    expect(html).toContain('data-summary-type="color-swatch"');
    expect(html).toContain('data-swatch-color="emerald"');
    expect(html).toContain('Emerald');
  });

  it('renders StatusColorLegend as semantic definition list', () => {
    const html = renderMappedComponent(
      makeNode('StatusColorLegend', {
        legend: [
          { label: 'Active', color: 'green' },
          { label: 'Paused', color: 'amber' },
        ],
      })
    );

    expect(html.startsWith('<section')).toBe(true);
    expect(html).toContain('data-summary-type="status-color-legend"');
    expect(html).toContain('data-legend-item="true"');
    expect(html).toContain('<dl>');
  });

  it.each([
    {
      component: 'VizAreaControls',
      props: { title: 'Area Controls', curve: 'linear', opacity: '0.6' },
      formType: 'viz-area-controls',
      expectedControls: ['name="curve"', 'name="opacity"'],
    },
    {
      component: 'VizMarkControls',
      props: { title: 'Mark Controls', orientation: 'vertical', stacking: 'stack' },
      formType: 'viz-mark-controls',
      expectedControls: ['name="orientation"', 'name="stacking"'],
    },
    {
      component: 'VizLineControls',
      props: { title: 'Line Controls', curve: 'monotone', markers: 'auto' },
      formType: 'viz-line-controls',
      expectedControls: ['name="curve"', 'name="markers"'],
    },
    {
      component: 'VizPointControls',
      props: { title: 'Point Controls', shape: 'circle', size: '16' },
      formType: 'viz-point-controls',
      expectedControls: ['name="shape"', 'name="size"'],
    },
    {
      component: 'VizScatterControls',
      props: { title: 'Scatter Controls', shape: 'circle', size: '12' },
      formType: 'viz-scatter-controls',
      expectedControls: ['name="shape"', 'name="size"'],
    },
    {
      component: 'VizHeatmapControls',
      props: { title: 'Heatmap Controls', scheme: 'viridis', cellPadding: '2' },
      formType: 'viz-heatmap-controls',
      expectedControls: ['name="scheme"', 'name="cellPadding"'],
    },
    {
      component: 'VizOpacityControls',
      props: { title: 'Opacity Controls', min: '0.1', max: '1.0' },
      formType: 'viz-opacity-controls',
      expectedControls: ['name="minOpacity"', 'name="maxOpacity"'],
    },
    {
      component: 'VizShapeControls',
      props: { title: 'Shape Controls', shapeSet: 'default' },
      formType: 'viz-shape-controls',
      expectedControls: ['name="shapeSet"'],
    },
    {
      component: 'VizColorControls',
      props: { title: 'Color Controls', scheme: 'viridis', channel: 'fill' },
      formType: 'viz-color-controls',
      expectedControls: ['name="scheme"', 'name="channel"'],
    },
    {
      component: 'VizAxisControls',
      props: { title: 'Axis Controls', xField: 'date', yField: 'revenue' },
      formType: 'viz-axis-controls',
      expectedControls: ['name="xField"', 'name="yField"'],
    },
    {
      component: 'VizSizeControls',
      props: { title: 'Size Controls', strategy: 'range', min: '8', max: '42' },
      formType: 'viz-size-controls',
      expectedControls: ['name="strategy"', 'name="minSize"'],
    },
    {
      component: 'VizScaleControls',
      props: { title: 'Scale Controls', type: 'linear', domainMin: '0', domainMax: '100' },
      formType: 'viz-scale-controls',
      expectedControls: ['name="scaleType"', 'name="domainMin"'],
    },
  ])('renders $component as viz controls form structure', ({ component, props, formType, expectedControls }) => {
    const html = renderMappedComponent(makeNode(component, props));

    expect(html.startsWith('<fieldset')).toBe(true);
    expect(html).toContain(`data-oods-component="${component}"`);
    expect(html).toContain(`data-form-type="${formType}"`);
    for (const control of expectedControls) {
      expect(html).toContain(control);
    }
  });

  it.each([
    { component: 'VizAreaPreview', previewType: 'area' },
    { component: 'VizMarkPreview', previewType: 'mark' },
    { component: 'VizLinePreview', previewType: 'line' },
    { component: 'VizPointPreview', previewType: 'point' },
    { component: 'VizScatterPreview', previewType: 'scatter' },
    { component: 'VizHeatmapPreview', previewType: 'heatmap' },
  ])('renders $component as preview placeholder container', ({ component, previewType }) => {
    const html = renderMappedComponent(makeNode(component, { width: 800, height: 400 }));

    expect(html.startsWith('<div')).toBe(true);
    expect(html).toContain(`data-oods-component="${component}"`);
    expect(html).toContain(`data-viz-preview-type="${previewType}"`);
    expect(html).toContain('data-viz-preview-placeholder="true"');
  });

  it.each([
    { component: 'VizAreaPreview', label: 'Payment amounts' },
    { component: 'VizMarkPreview', label: 'Mark chart' },
    { component: 'VizLinePreview', label: 'Line chart' },
    { component: 'VizPointPreview', label: 'Point chart' },
    { component: 'VizScatterPreview', label: 'Scatter chart' },
    { component: 'VizHeatmapPreview', label: 'Heatmap chart' },
  ])('embeds passive SVG for $component with its own accessible default', ({ component, label }) => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 10L10 0"/></svg>';
    const html = renderMappedComponent(makeNode(component, { svg }));
    expect(html).toContain(svg);
    expect(html).toContain(`aria-label="${label}"`);
    expect(html).toContain('data-viz-rendered="true"');
    expect(html).not.toContain('data-viz-preview-placeholder');
    const described = renderMappedComponent(makeNode(component, { svg, title: 'Recorded counts', description: 'Measured example series.' }));
    expect(described).toContain('aria-label="Recorded counts"');
    expect(described).toContain('data-viz-description="true">Measured example series.');
  });

  it.each([
    {
      component: 'VizColorLegendConfig',
      props: { title: 'Legend', field: 'segment', scheme: 'viridis', redundancy: 'shape' },
      summaryType: 'viz-color-legend',
    },
    {
      component: 'VizAxisSummary',
      props: { title: 'Axis Summary', axis: 'x', scale: 'linear', zero: true },
      summaryType: 'viz-axis-summary',
    },
    {
      component: 'VizSizeSummary',
      props: { title: 'Size Summary', field: 'revenue', strategy: 'range', min: 8, max: 42 },
      summaryType: 'viz-size-summary',
    },
    {
      component: 'VizScaleSummary',
      props: { title: 'Scale Summary', type: 'linear', domainMin: 0, domainMax: 100, mode: 'fit' },
      summaryType: 'viz-scale-summary',
    },
  ])('renders $component as viz summary/legend section', ({ component, props, summaryType }) => {
    const html = renderMappedComponent(makeNode(component, props));

    expect(html.startsWith('<section')).toBe(true);
    expect(html).toContain(`data-oods-component="${component}"`);
    expect(html).toContain(`data-summary-type="${summaryType}"`);
    expect(html).toContain('<dl>');
  });

  it.each([
    {
      component: 'VizEncodingBadge',
      props: { axis: 'x', field: 'revenue' },
      expectedVariant: 'viz-encoding',
    },
    {
      component: 'VizRoleBadge',
      props: { role: 'mark' },
      expectedVariant: 'viz-role',
    },
  ])('renders $component as viz badge', ({ component, props, expectedVariant }) => {
    const html = renderMappedComponent(makeNode(component, props));

    expect(html.startsWith('<span')).toBe(true);
    expect(html).toContain(`data-oods-component="${component}"`);
    expect(html).toContain(`data-badge-variant="${expectedVariant}"`);
  });

  it('renders Table with semantic header/body sections', () => {
    const html = renderMappedComponent(
      makeNode('Table', {
        columns: [{ key: 'name', label: 'Name' }, { key: 'value', label: 'Value' }],
        rows: [{ name: 'Latency', value: '120ms' }],
      })
    );

    // s222-m02 (#2502 ruling 11): the React and Vue Table markup: the bordered container around a named table and parts.
    expect(html.startsWith('<div class="oods-table__container" data-density="comfortable"><table')).toBe(true);
    expect(html).toContain('<thead class="oods-table__header">');
    expect(html).toContain('<th scope="col" class="oods-table__header-cell">Name</th>');
    expect(html).toContain('<tbody class="oods-table__body">');
    expect(html).toContain('<td class="oods-table__cell">Latency</td>');
    expect(html).toContain('<td class="oods-table__cell">120ms</td>');
  });

  // s223-m02 (#2527 ruling 10): the markup React and Vue write, and no script: the native radios carry the keyboard.
  it('renders SegmentedControl as a radiogroup named by its label, one native radio per option, with no script', () => {
    const options = [{ value: 'monthly', label: 'Monthly' }, { value: 'quarterly', label: 'Quarterly' }, { value: 'yearly', label: 'Yearly', disabled: true }];
    const html = renderMappedComponent(makeNode('SegmentedControl', { id: 'billing-period', label: 'Billing period', value: 'quarterly', options }));
    expect(html).not.toContain('<script');
    const { document } = new Window();
    document.body.innerHTML = html;
    const root = document.querySelector('[data-oods-component="SegmentedControl"]')!;
    expect(root.className).toBe('oods-field oods-segmented-control');
    expect(root.getAttribute('data-size')).toBe('md');
    const group = root.querySelector('[role="radiogroup"]')!;
    expect(group.id).toBe('billing-period');
    expect(group.className).toBe('oods-segmented-control__track');
    expect(document.getElementById(group.getAttribute('aria-labelledby')!)?.textContent).toBe('Billing period');
    const radios = [...group.querySelectorAll('label.oods-segmented-control__option > input.oods-segmented-control__input')] as unknown as HTMLInputElement[];
    expect(radios.map((radio) => [radio.type, radio.name, radio.value, radio.checked, radio.disabled, radio.parentElement?.textContent])).toEqual([
      ['radio', 'billing-period', 'monthly', false, false, 'Monthly'],
      ['radio', 'billing-period', 'quarterly', true, false, 'Quarterly'],
      ['radio', 'billing-period', 'yearly', false, true, 'Yearly'],
    ]);
    // defaultValue checks an option when value is absent; name, size and disabled reach every radio.
    const other = renderMappedComponent(makeNode('SegmentedControl', { id: 'period', label: 'Period', name: 'cycle', size: 'lg', defaultValue: 'monthly', disabled: true, options }));
    document.body.innerHTML = other;
    const inputs = [...document.querySelectorAll('input')] as unknown as HTMLInputElement[];
    expect(inputs.map((radio) => [radio.name, radio.checked, radio.disabled])).toEqual([['cycle', true, true], ['cycle', false, true], ['cycle', false, true]]);
    expect(document.querySelector('[data-oods-component="SegmentedControl"]')?.getAttribute('data-size')).toBe('lg');
    expect(renderMappedComponent(makeNode('SegmentedControl', { label: 'Period', size: 'huge', options }))).toContain('data-size="md"');
  });

  it('renders Tabs with tablist and tabpanels', () => {
    const html = renderMappedComponent(
      makeNode('Tabs', {
        tabs: [
          { id: 'overview', label: 'Overview', content: 'Overview panel', active: true },
          { id: 'details', label: 'Details', content: 'Details panel', active: false },
        ],
      })
    );

    expect(html.startsWith('<section')).toBe(true);
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('aria-selected="false"');
    expect(html).toContain('role="tabpanel"');
    expect(html).toContain('Overview panel');
    expect(html).toContain('Details panel');
  });

  it('runs Tabs pointer and keyboard selection while skipping disabled items', () => {
    const html = renderMappedComponent(
      makeNode('Tabs', {
        items: [
          { id: 'overview', label: 'Overview', panel: 'Overview panel' },
          { id: 'locked', label: 'Locked', panel: 'Locked panel', disabled: true },
          { id: 'history', label: 'History', panel: 'History panel' },
        ],
        ariaLabel: 'Account sections',
      }),
    );

    const window = new Window({ settings: { disableJavaScriptEvaluation: false } });
    window.document.write(html);
    const tabs = [...window.document.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    const panels = [...window.document.querySelectorAll<HTMLElement>('[role="tabpanel"]')];

    expect(window.document.querySelector('script')?.dataset.oodsRuntime).toBe('tabs');
    expect(tabs[1]?.disabled).toBe(true);

    tabs[0]?.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual(['false', 'false', 'true']);
    expect(tabs.map((tab) => tab.tabIndex)).toEqual([-1, -1, 0]);
    expect(panels.map((panel) => panel.hidden)).toEqual([true, true, false]);
    expect(window.document.activeElement).toBe(tabs[2]);

    tabs[2]?.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(window.document.activeElement).toBe(tabs[0]);
    tabs[2]?.click();
    expect(tabs[2]?.getAttribute('aria-selected')).toBe('true');

    window.close();
  });

  it('renders fallback div for unknown components with component label', () => {
    const html = renderMappedComponent(makeNode('NotInRegistry', { danger: 'yes' }), '<em>Fallback child</em>');

    expect(html.startsWith('<div')).toBe(true);
    expect(html).toContain('data-oods-fallback="true"');
    expect(html).toContain('Unknown component: NotInRegistry');
    expect(html).toContain('<em>Fallback child</em>');
  });
});

// s207-m02: a raw boolean is still the machine state, but the reader sees its domain meaning.
describe('cancellation badge wording', () => {
  it.each([false, true])('preserves %s while explaining the scheduled-cancellation flag', flag => {
    const html = renderMappedComponent(makeNode('CancellationBadge', { cancelAtPeriodEnd: flag }))!;
    expect(html).toContain(`data-badge-status="${flag}"`);
    expect(html).toContain(flag ? '>Cancellation scheduled</span>' : '>No cancellation scheduled</span>');
    expect(renderMappedComponent(makeNode('CancellationBadge', { value: flag, label: 'Authored' }))).toContain('>Authored</span>');
  });
});

// s220-m01: a Transaction card read "Model: one_time"; the card's pricing terms read as PriceSummary's do.
describe('price card terms', () => {
  it('reads pricing codes in words, keeping an authored title', () => {
    const html = renderMappedComponent(makeNode('PriceCardMeta', { model: 'one_time', interval: 'monthly' }))!;
    expect(html).toContain('<strong>Model:</strong> One Time');
    expect(html).toContain('<strong>Interval:</strong> Monthly');
    expect(html).not.toContain('one_time');
  });
});

// s220-m01 (#2461): Subscription and Transaction cards read a bare "false" archive pill since 0.3.0.
describe('archive pill wording', () => {
  it.each([false, true])('preserves %s while saying whether the record is archived', flag => {
    const html = renderMappedComponent(makeNode('ArchivePill', { isArchived: flag }))!;
    expect(html).toContain(`data-badge-status="${flag}"`);
    expect(html).toContain(flag ? '>Archived</span>' : '>Not archived</span>');
    expect(html).not.toContain(`>${flag}</span>`);
    expect(renderMappedComponent(makeNode('ArchivePill', { value: flag, label: 'Authored' }))).toContain('>Authored</span>');
  });
});
