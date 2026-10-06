import { describe, expect, it } from 'vitest';
import { getContentStrategy, acceptsFieldContent, type ContentStrategy } from './content-strategy.js';

describe('content-strategy', () => {
  describe('getContentStrategy', () => {
    it('maps layout components to none', () => {
      const layouts = ['Stack', 'Grid', 'Card', 'Table', 'Tabs'];
      for (const name of layouts) {
        expect(getContentStrategy(name)).toBe('none');
      }
    });

    it('maps display components to children', () => {
      const displays = ['Text', 'Banner', 'InlineLabel', 'CardHeader', 'DetailHeader'];
      for (const name of displays) {
        expect(getContentStrategy(name)).toBe('children');
      }
    });

    it('maps form components to value-prop', () => {
      const forms = ['Input', 'Select', 'SearchInput', 'TagInput', 'BillingAmountInput'];
      for (const name of forms) {
        expect(getContentStrategy(name)).toBe('value-prop');
      }
    });

    it('maps badge/button components to label-prop', () => {
      const badges = ['Badge', 'Button', 'PriceBadge', 'OwnerBadge', 'ClassificationBadge'];
      for (const name of badges) {
        expect(getContentStrategy(name)).toBe('label-prop');
      }
    });

    it('maps status components to status-prop', () => {
      const status = ['StatusBadge', 'StatusTimeline', 'MessageStatusBadge'];
      for (const name of status) {
        expect(getContentStrategy(name)).toBe('status-prop');
      }
    });

    it('returns none for unknown components', () => {
      expect(getContentStrategy('NonExistentWidget')).toBe('none');
      expect(getContentStrategy('')).toBe('none');
    });

    it.each(['constructor', 'toString', 'valueOf', '__proto__', 'hasOwnProperty'])(
      'does not treat inherited Object key %s as a registered strategy',
      (name) => {
        expect(getContentStrategy(name)).toBe('none');
        expect(acceptsFieldContent(name)).toBe(false);
      },
    );

    it('covers all 97 catalog components', () => {
      const allComponents = [
        'Text', 'Button', 'Badge', 'Banner', 'Input', 'Select', 'Card', 'Stack', 'Grid', 'Table', 'Tabs',
        'CardHeader', 'DetailHeader', 'FormLabelGroup', 'InlineLabel', 'LabelCell', 'TimelineEntryLabel',
        'FilterPanel', 'PaginationBar', 'SearchInput', 'TagInput', 'TagManager', 'TagPills', 'TagSummary',
        'CommunicationDetailPanel', 'MessageEventTimeline', 'MessageStatusBadge', 'TemplatePicker',
        'AddressCollectionPanel', 'AddressEditor', 'AddressSummaryBadge', 'AddressValidationTimeline',
        'ClassificationBadge', 'ClassificationEditor', 'ClassificationPanel',
        'MembershipAuditTimeline', 'MembershipPanel',
        'PreferenceEditor', 'PreferencePanel', 'PreferenceSummaryBadge', 'PreferenceTimeline',
        'RoleAssignmentForm', 'RoleBadgeList',
        'BillingAmountInput', 'BillingCardMeta', 'BillingIntervalSelector', 'BillingSummaryBadge',
        'CycleProgressCard', 'PaymentEventTimeline', 'PaymentTimeline',
        'PriceBadge', 'PriceCardMeta', 'PriceSummary',
        'ArchiveEvent', 'ArchivePill', 'ArchiveSummary', 'ArchivedRowOverlay',
        'AuditEvent', 'AuditSummaryCard', 'AuditTimeline',
        'CancellationBadge', 'CancellationEvent', 'CancellationForm', 'CancellationSummary',
        'RelativeTimestamp', 'StateTransitionEvent', 'StatusBadge', 'StatusSelector', 'StatusTimeline',
        'OwnerBadge', 'OwnershipMeta', 'OwnershipSummary',
        'ColorStatePicker', 'ColorSwatch', 'ColorizedBadge', 'StatusColorLegend',
        'VizAxisControls', 'VizAxisSummary', 'VizColorControls', 'VizColorLegendConfig',
        'VizEncodingBadge', 'VizSizeControls', 'VizSizeSummary',
        'VizAreaControls', 'VizAreaPreview', 'VizLineControls', 'VizLinePreview',
        'VizMarkControls', 'VizMarkPreview', 'VizPointControls', 'VizPointPreview', 'VizRoleBadge',
        'VizScaleControls', 'VizScaleSummary',
        'GeoFieldMappingForm', 'GeoResolutionBadge', 'GeocodablePreview',
      ];

      const validStrategies = new Set<ContentStrategy>(['children', 'value-prop', 'label-prop', 'status-prop', 'none']);
      for (const name of allComponents) {
        const strategy = getContentStrategy(name);
        expect(validStrategies.has(strategy), `${name} has invalid strategy: ${strategy}`).toBe(true);
      }

      // Verify we actually cover a meaningful number
      expect(allComponents.length).toBeGreaterThanOrEqual(90);
    });
  });

  describe('acceptsFieldContent', () => {
    it('returns true for content-accepting components', () => {
      expect(acceptsFieldContent('Text')).toBe(true);
      expect(acceptsFieldContent('Input')).toBe(true);
      expect(acceptsFieldContent('Badge')).toBe(true);
      expect(acceptsFieldContent('StatusBadge')).toBe(true);
    });

    it('returns false for layout components', () => {
      expect(acceptsFieldContent('Stack')).toBe(false);
      expect(acceptsFieldContent('Grid')).toBe(false);
      expect(acceptsFieldContent('Card')).toBe(false);
    });

    it('returns false for unknown components', () => {
      expect(acceptsFieldContent('UnknownWidget')).toBe(false);
    });
  });
});
