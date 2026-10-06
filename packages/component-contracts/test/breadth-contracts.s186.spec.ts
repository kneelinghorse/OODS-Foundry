import { describe, expect, it } from 'vitest';

import {
  COMPONENT_CONTRACT_VERSION,
  NUCLEUS_COMPONENT_IDS,
  PORTED_COMPONENT_IDS,
  componentContracts,
  sharedScenarios,
} from '../src/index.js';

// Sprint 186 wave 2, mission 1: the three components that block test-tagged-schema.
// Props are the HTML renderer's consumed keys plus what the saved schema puts on
// the node; every directive the renderer does not read is named as consumed-unbound.
const PANEL_PROPS = ['title', 'label', 'heading', 'name', 'subtitle', 'description', 'metadata', 'summary', 'text', 'body', 'emptyMessage'] as const;
const TIMELINE_TITLE_PROPS = ['title', 'label', 'heading', 'name'] as const;
const FORM_SHELL_PROPS = ['title', 'label', 'heading', 'name', 'description', 'subtitle', 'hint'] as const;

const WAVE_2_CONTRACTS = {
  ClassificationPanel: {
    props: PANEL_PROPS,
    renderer: 'renderClassificationPanel',
    scenario: 'classification-panel-title-and-summary',
    unboundDirectives: ['categoriesField', 'tagsField', 'metadataField', 'modeParameter'],
    loweredDirectives: [],
  },
  FilterPanel: {
    props: ['filters', 'activeFilters', 'mode', 'collapsible'],
    renderer: 'renderFilterPanel',
    scenario: 'filter-panel-batch-mode',
    unboundDirectives: ['modeParameter', 'collapsibleParameter'],
    loweredDirectives: ['activeField'],
  },
  PriceSummary: {
    props: [
      'title', 'label', 'heading', 'name', 'amount', 'amountCents', 'unitAmountCents', 'minorUnits', 'currency', 'currencyCode',
      'model', 'pricingModel', 'interval', 'billingInterval', 'summary', 'text', 'description',
    ],
    renderer: 'renderPriceSummary',
    scenario: 'price-summary-terms',
    unboundDirectives: ['taxBehaviorField'],
    loweredDirectives: ['amountField', 'currencyField', 'modelField', 'intervalField'],
  },
  // m02: user-detail-showcase
  AddressCollectionPanel: {
    props: PANEL_PROPS,
    renderer: 'renderAddressCollectionPanel',
    scenario: 'address-collection-panel-title-and-summary',
    unboundDirectives: ['roleField', 'defaultRoleField', 'roleParameter'],
    loweredDirectives: [],
  },
  MembershipPanel: {
    props: PANEL_PROPS,
    renderer: 'renderMembershipPanel',
    scenario: 'membership-panel-title-and-summary',
    unboundDirectives: ['membershipsField', 'hierarchyField', 'roleField', 'permissionField'],
    loweredDirectives: [],
  },
  PreferencePanel: {
    props: PANEL_PROPS,
    renderer: 'renderPreferencePanel',
    scenario: 'preference-panel-title-and-summary',
    unboundDirectives: ['preferencesField', 'metadataField', 'namespaceField'],
    loweredDirectives: [],
  },
  TagManager: {
    props: ['title', 'label', 'heading', 'name', 'description', 'subtitle', 'hint', 'tags', 'value'],
    renderer: 'renderTagManager',
    scenario: 'tag-manager-list-and-add-control',
    unboundDirectives: ['allowCustomParameter', 'allowListParameter', 'maxTagsParameter', 'moderationParameter', 'synonymParameter'],
    loweredDirectives: [],
  },
  // m03: user-list-showcase
  AddressSummaryBadge: {
    props: ['label', 'text', 'role', 'value', 'status', 'state', 'variant', 'tone', 'emphasis'],
    renderer: 'renderAddressSummaryBadge',
    scenario: 'address-summary-badge-role',
    unboundDirectives: [],
    loweredDirectives: [],
  },
  MessageStatusBadge: {
    props: ['label', 'text', 'status', 'delivery', 'value', 'state', 'variant', 'tone', 'emphasis'],
    renderer: 'renderMessageStatusBadge',
    scenario: 'message-status-badge-delivery',
    unboundDirectives: ['statusesField'],
    loweredDirectives: [],
  },
  PreferenceSummaryBadge: {
    props: ['label', 'text', 'namespace', 'value', 'status', 'state', 'version', 'variant', 'tone', 'emphasis'],
    renderer: 'renderPreferenceSummaryBadge',
    scenario: 'preference-summary-badge-namespace-and-version',
    unboundDirectives: ['namespacesField'],
    loweredDirectives: ['versionField'],
  },
  RoleBadgeList: {
    props: ['roles', 'badges', 'roleLabels', 'value', 'variant', 'tone', 'label', 'text'],
    renderer: 'renderRoleBadgeList',
    scenario: 'role-badge-list-items',
    unboundDirectives: ['fallbackRoleParameter'],
    loweredDirectives: ['rolesField'],
  },
  TagPills: {
    props: ['tags', 'value', 'maxVisible', 'overflowLabel'],
    renderer: 'renderTagPills',
    scenario: 'tag-pills-overflow-template',
    unboundDirectives: ['label'],
    loweredDirectives: [],
  },
  // m04: user-timeline-showcase
  AddressValidationTimeline: {
    props: [...TIMELINE_TITLE_PROPS, 'events', 'validations', 'history'],
    renderer: 'renderAddressValidationTimeline',
    scenario: 'address-validation-timeline-events',
    unboundDirectives: [],
    loweredDirectives: [],
  },
  AuditEvent: {
    props: ['label', 'title', 'event', 'status', 'state', 'reason', 'text', 'timestamp', 'datetime', 'time', 'at', 'createdAt', 'updatedAt', 'detail', 'description', 'message', 'from', 'to', 'code'],
    renderer: 'renderAuditEvent',
    scenario: 'audit-event-type-and-timestamp',
    unboundDirectives: ['timezoneParameter'],
    loweredDirectives: ['typeField', 'timestampField'],
  },
  MembershipAuditTimeline: {
    props: [...TIMELINE_TITLE_PROPS, 'events', 'memberships', 'history'],
    renderer: 'renderMembershipAuditTimeline',
    scenario: 'membership-audit-timeline-empty',
    unboundDirectives: [],
    loweredDirectives: [],
  },
  MessageEventTimeline: {
    props: [...TIMELINE_TITLE_PROPS, 'events', 'messages', 'statuses'],
    renderer: 'renderMessageEventTimeline',
    scenario: 'message-event-timeline-statuses',
    unboundDirectives: [],
    loweredDirectives: ['messagesField', 'statusesField'],
  },
  PreferenceTimeline: {
    props: [...TIMELINE_TITLE_PROPS, 'events', 'changes', 'history'],
    renderer: 'renderPreferenceTimeline',
    scenario: 'preference-timeline-changes',
    unboundDirectives: ['metadataField'],
    loweredDirectives: [],
  },
  // m05: user-form-showcase
  AddressEditor: {
    props: [...FORM_SHELL_PROPS, 'street', 'line1', 'addressLine1', 'city', 'region', 'state', 'postalCode', 'zip'],
    renderer: 'renderAddressEditor',
    scenario: 'address-editor-fields-and-change',
    unboundDirectives: ['defaultRoleField', 'roleParameter', 'allowDynamicParameter'],
    loweredDirectives: [],
  },
  PreferenceEditor: {
    props: [...FORM_SHELL_PROPS, 'namespaces', 'namespace', 'document', 'json', 'value'],
    renderer: 'renderPreferenceEditor',
    scenario: 'preference-editor-namespace-and-document',
    unboundDirectives: ['documentField', 'registryNamespaceParameter'],
    loweredDirectives: ['namespacesField'],
  },
  RoleAssignmentForm: {
    props: [...FORM_SHELL_PROPS, 'roles', 'availableRoles', 'role', 'defaultRoleId', 'assignee', 'member'],
    renderer: 'renderRoleAssignmentForm',
    scenario: 'role-assignment-form-roles',
    unboundDirectives: ['membershipField', 'defaultRoleParameter'],
    loweredDirectives: ['availableRolesField'],
  },
  StatusSelector: {
    props: ['help', 'label', 'title', 'options', 'states', 'value', 'status'],
    renderer: 'renderStatusSelector',
    scenario: 'status-selector-controlled',
    unboundDirectives: ['allowedTransitionsField', 'optionsParameter', 'initialParameter', 'requireReasonParameter'],
    loweredDirectives: [],
  },
  TagInput: {
    props: [...FORM_SHELL_PROPS, 'tags', 'value', 'placeholder'],
    renderer: 'renderTagInput',
    scenario: 'tag-input-typed-text',
    unboundDirectives: ['maxTagsParameter', 'allowCustomParameter', 'allowListParameter', 'minLengthParameter', 'maxLengthParameter', 'synonymParameter'],
    loweredDirectives: [],
  },
  TemplatePicker: {
    props: [...FORM_SHELL_PROPS, 'templates', 'options', 'templateId', 'value', 'channels', 'channel'],
    renderer: 'renderTemplatePicker',
    scenario: 'template-picker-selects',
    unboundDirectives: [],
    loweredDirectives: ['templatesField', 'channelsField'],
  },
} as const;

describe('Sprint 186 m01 component breadth contracts', () => {
  it('registers every wave-2 component ported so far in the nucleus with one shared scenario each', () => {
    expect(NUCLEUS_COMPONENT_IDS).toEqual([...NUCLEUS_COMPONENT_IDS].sort());
    expect(Object.keys(componentContracts)).toEqual(NUCLEUS_COMPONENT_IDS);
    expect(sharedScenarios.map(({ oodsComponentId }) => oodsComponentId)).toEqual(NUCLEUS_COMPONENT_IDS);
    for (const id of Object.keys(WAVE_2_CONTRACTS)) {
      expect(NUCLEUS_COMPONENT_IDS).toContain(id);
      expect(PORTED_COMPONENT_IDS).not.toContain(id);
    }
  });

  for (const [id, expected] of Object.entries(WAVE_2_CONTRACTS)) {
    it(`${id} governs its measured props, mirrors ${expected.renderer}, and names every directive it consumes`, () => {
      const contract = componentContracts[id as keyof typeof WAVE_2_CONTRACTS];
      expect(contract.id).toBe(id);
      expect(contract.version).toBe(COMPONENT_CONTRACT_VERSION);
      expect([...contract.props].sort()).toEqual([...expected.props].sort());
      expect(new Set(contract.props).size).toBe(contract.props.length);
      expect(contract.props).not.toContain('field');
      expect(contract.slots).toEqual(['default']);
      // Wave-2 displays declare no events; the m05 form controls declare the change their scenario exercises.
      const declaredEvents = { AddressEditor: ['change'], StatusSelector: ['change', 'update'], TagInput: ['change', 'update'] } as Record<string, string[]>;
      expect(contract.events).toEqual(declaredEvents[id] ?? []);
      expect(contract.compatibility).toContain(expected.renderer);
      for (const directive of [...expected.unboundDirectives, ...expected.loweredDirectives]) {
        expect(contract.props, `${directive} must not leak as a public prop`).not.toContain(directive);
        expect(contract.compatibility, `${directive} is disclosed`).toContain(directive);
      }
      expect(contract.tokenRoles.length).toBeGreaterThan(0);
      expect(contract.accessibility.length).toBeGreaterThan(0);
    });

    it(`${id} has a named render scenario using only its governed interface`, () => {
      const contract = componentContracts[id as keyof typeof WAVE_2_CONTRACTS];
      const scenarios = sharedScenarios.filter(({ oodsComponentId }) => oodsComponentId === id);
      expect(scenarios).toHaveLength(1);
      const scenario = scenarios[0]!;
      expect(scenario.id).toBe(expected.scenario);
      for (const prop of Object.keys(scenario.props)) expect(contract.props).toContain(prop);
      expect(Object.keys(scenario.props).length).toBeGreaterThan(0);
      expect(scenario.renderExpectation.name).toBe(contract.events.length > 0 ? contract.events[0] : 'render');
      expect(scenario.assertions.length).toBeGreaterThan(0);
    });
  }

  it('states that the filter controls stay unwired and that prices use declared currency and minor units', () => {
    expect(componentContracts.FilterPanel.compatibility).toContain('unwired');
    expect(componentContracts.FilterPanel.compatibility).toContain('declares no events');
    expect(componentContracts.FilterPanel.accessibility.join(' ')).toContain('polite live region');
    expect(componentContracts.PriceSummary.accessibility.join(' ')).toContain('currency and declared minor units (100 by default)');
    expect(componentContracts.ClassificationPanel.compatibility).toContain('object-typed field');
    expect(componentContracts.PreferencePanel.compatibility).toContain('object-typed preference_metadata field');
    expect(componentContracts.AddressCollectionPanel.compatibility).toContain('generic field');
    expect(componentContracts.TagManager.compatibility).toContain('unwired');
    expect(componentContracts.TagManager.compatibility).toContain('declares no events');
    expect(componentContracts.AddressSummaryBadge.compatibility).toContain('never an ARIA role');
    expect(componentContracts.TagPills.compatibility).toContain('total tag count');
    for (const id of ['AddressSummaryBadge', 'MessageStatusBadge', 'PreferenceSummaryBadge'] as const) {
      expect(componentContracts[id].states).toEqual(componentContracts.Badge.states);
      expect(componentContracts[id].compatibility).toContain('renderBadgePrimitive');
      expect(componentContracts[id].accessibility.join(' ')).toContain('Badge inline noninteractive status label semantics');
    }
    // The composer writes trait directives onto pattern-group Stacks; Stack discloses each disposition.
    for (const directive of ['channelsField', 'templatesField', 'policiesField', 'conversationsField', 'labelField', 'showActor', 'historyField', 'showReason']) {
      expect(componentContracts.Stack.props).not.toContain(directive);
      expect(componentContracts.Stack.compatibility).toContain(directive);
    }
    expect(componentContracts.Stack.compatibility).toContain('travel with the lowering');
    for (const id of ['AddressValidationTimeline', 'MembershipAuditTimeline', 'MessageEventTimeline', 'PreferenceTimeline'] as const) {
      expect(componentContracts[id].compatibility).toContain('renderTimelineContainer');
      expect(componentContracts[id].compatibility).toContain('role=log');
      expect(componentContracts[id].accessibility.join(' ')).toContain('No events');
    }
    expect(componentContracts.AuditEvent.compatibility).toContain('a lone reason is both label and detail');
    // m05: the form family mirrors renderFormContainer; the two saved-binding controls are controlled by local state.
    for (const id of ['AddressEditor', 'PreferenceEditor', 'RoleAssignmentForm', 'TagInput', 'TemplatePicker'] as const) {
      expect(componentContracts[id].compatibility).toContain('renderFormContainer');
      expect(componentContracts[id].tokenRoles).toEqual(componentContracts.TagManager.tokenRoles);
    }
    for (const id of ['PreferenceEditor', 'RoleAssignmentForm'] as const) expect(componentContracts[id].compatibility).toContain('no-op');
    expect(componentContracts.TemplatePicker.compatibility).toContain('unwired');
    expect(componentContracts.AddressEditor.compatibility).toContain('domain action');
    expect(componentContracts.StatusSelector.compatibility).toContain('the select is controlled');
    // The selector has no validation message row, so its roles are Select's input roles without field.message.
    expect(componentContracts.Select.tokenRoles).toEqual(expect.arrayContaining([...componentContracts.StatusSelector.tokenRoles]));
    expect(componentContracts.StatusSelector.tokenRoles).not.toContain('field.message');
    expect(componentContracts.TagInput.compatibility).toContain('the input is controlled');
    expect(componentContracts.TagInput.compatibility).toContain('value is the typed text');
    const filterScenario = sharedScenarios.find(({ oodsComponentId }) => oodsComponentId === 'FilterPanel')!;
    expect(filterScenario.props.mode).toBe('batch');
    expect(filterScenario.assertions).toContain('controls are declared unwired');
  });
});
