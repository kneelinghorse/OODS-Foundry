import { describe, expect, it } from 'vitest';

import type { UiElement } from '../schemas/generated.js';
import {
  SUPPORTED_BINDING_DEFINITIONS,
  analyzeBindings,
  localSetterSymbol,
  localStateSymbol,
} from './binding-utils.js';

function screen(overrides: Partial<UiElement> = {}): UiElement {
  return {
    id: 'screen',
    component: 'Stack',
    ...overrides,
  };
}

describe('Sprint 183 binding analysis', () => {
  it('keeps the cross-framework binding vocabulary finite and explicit', () => {
    expect(SUPPORTED_BINDING_DEFINITIONS.map((definition) => ({
      id: definition.id,
      kind: definition.kind,
      parameters: definition.signature.parameters,
    }))).toEqual([
      // s193-m05 exposes typed renderer fragments from 14 authoring controls/legends.
      {"id": "component:VizAreaControls.onChange", "kind": "domain", "parameters": [{"name": "intent", "type": "import('@oods/component-contracts').VizIntentFragment"}]},
      {"id": "component:VizAxisControls.onChange", "kind": "domain", "parameters": [{"name": "intent", "type": "import('@oods/component-contracts').VizIntentFragment"}]},
      {"id": "component:VizColorControls.onChange", "kind": "domain", "parameters": [{"name": "intent", "type": "import('@oods/component-contracts').VizIntentFragment"}]},
      {"id": "component:VizHeatmapControls.onChange", "kind": "domain", "parameters": [{"name": "intent", "type": "import('@oods/component-contracts').VizIntentFragment"}]},
      {"id": "component:VizLineControls.onChange", "kind": "domain", "parameters": [{"name": "intent", "type": "import('@oods/component-contracts').VizIntentFragment"}]},
      {"id": "component:VizMarkControls.onChange", "kind": "domain", "parameters": [{"name": "intent", "type": "import('@oods/component-contracts').VizIntentFragment"}]},
      {"id": "component:VizOpacityControls.onChange", "kind": "domain", "parameters": [{"name": "intent", "type": "import('@oods/component-contracts').VizIntentFragment"}]},
      {"id": "component:VizPointControls.onChange", "kind": "domain", "parameters": [{"name": "intent", "type": "import('@oods/component-contracts').VizIntentFragment"}]},
      {"id": "component:VizScaleControls.onChange", "kind": "domain", "parameters": [{"name": "intent", "type": "import('@oods/component-contracts').VizIntentFragment"}]},
      {"id": "component:VizScatterControls.onChange", "kind": "domain", "parameters": [{"name": "intent", "type": "import('@oods/component-contracts').VizIntentFragment"}]},
      {"id": "component:VizShapeControls.onChange", "kind": "domain", "parameters": [{"name": "intent", "type": "import('@oods/component-contracts').VizIntentFragment"}]},
      {"id": "component:VizSizeControls.onChange", "kind": "domain", "parameters": [{"name": "intent", "type": "import('@oods/component-contracts').VizIntentFragment"}]},
      {"id": "component:VizColorLegendConfig.onChange", "kind": "domain", "parameters": [{"name": "intent", "type": "import('@oods/component-contracts').VizIntentFragment"}]},
      {"id": "component:VizShapeLegend.onChange", "kind": "domain", "parameters": [{"name": "intent", "type": "import('@oods/component-contracts').VizIntentFragment"}]},
      // s193-m04 adds the declared color editor and structured geo mapping callback.
      { id: 'component:ColorStatePicker.onChange', kind: 'local', parameters: [{ name: 'value', type: 'string' }] },
      { id: 'component:GeoFieldMappingForm.onChange', kind: 'domain', parameters: [{ name: 'mapping', type: '{ latitude: string; longitude: string; identifier: string; autoDetect: boolean }' }] },
      // s192-m05 adds the native sort control's structured domain callback.
      { id: 'component:SortIndicator.onChange', kind: 'domain', parameters: [{ name: 'sort', type: "{ field: string; direction: 'asc' | 'desc'; active: boolean }" }] },
      { id: 'component:Banner.onDismiss', kind: 'local', parameters: [] },
      { id: 'component:Button.onActivate', kind: 'domain', parameters: [] },
      { id: 'component:Checkbox.onChange', kind: 'local', parameters: [{ name: 'checked', type: 'boolean' }] },
      { id: 'component:Checkbox.onUpdate', kind: 'local', parameters: [{ name: 'checked', type: 'boolean' }] },
      // s223-m02 (#2527 ruling 12): the two Select-like controls bind a field's value as Select does.
      { id: 'component:Combobox.onChange', kind: 'local', parameters: [{ name: 'value', type: 'string' }] },
      { id: 'component:Combobox.onUpdate', kind: 'local', parameters: [{ name: 'value', type: 'string' }] },
      { id: 'component:DatePicker.onChange', kind: 'local', parameters: [{ name: 'value', type: 'string' }] },
      { id: 'component:DatePicker.onInput', kind: 'local', parameters: [{ name: 'value', type: 'string' }] },
      { id: 'component:DatePicker.onUpdate', kind: 'local', parameters: [{ name: 'value', type: 'string' }] },
      { id: 'component:Input.onChange', kind: 'local', parameters: [{ name: 'value', type: 'string' }] },
      { id: 'component:Input.onInput', kind: 'local', parameters: [{ name: 'value', type: 'string' }] },
      { id: 'component:Input.onUpdate', kind: 'local', parameters: [{ name: 'value', type: 'string' }] },
      { id: 'component:SearchInput.onUpdate', kind: 'local', parameters: [{ name: 'value', type: 'string' }] },
      { id: 'component:SegmentedControl.onChange', kind: 'local', parameters: [{ name: 'value', type: 'string' }] },
      { id: 'component:SegmentedControl.onUpdate', kind: 'local', parameters: [{ name: 'value', type: 'string' }] },
      { id: 'component:Select.onChange', kind: 'local', parameters: [{ name: 'value', type: 'string' }] },
      { id: 'component:Select.onUpdate', kind: 'local', parameters: [{ name: 'value', type: 'string' }] },
      // s223-m02 (#2527 ruling 13a): a Switch binds the record's boolean as Checkbox does.
      { id: 'component:Switch.onChange', kind: 'local', parameters: [{ name: 'checked', type: 'boolean' }] },
      { id: 'component:Switch.onUpdate', kind: 'local', parameters: [{ name: 'checked', type: 'boolean' }] },
      { id: 'component:Table.onRowActivate', kind: 'domain', parameters: [{ name: 'rowId', type: 'string' }] },
      { id: 'component:Tabs.onChange', kind: 'local', parameters: [{ name: 'selectedId', type: 'string' }] },
      { id: 'component:Tabs.onUpdate', kind: 'local', parameters: [{ name: 'selectedId', type: 'string' }] },
      { id: 'component:Textarea.onChange', kind: 'local', parameters: [{ name: 'value', type: 'string' }] },
      { id: 'component:Textarea.onInput', kind: 'local', parameters: [{ name: 'value', type: 'string' }] },
      { id: 'component:Textarea.onUpdate', kind: 'local', parameters: [{ name: 'value', type: 'string' }] },
      { id: 'component:StatusSelector.onChange', kind: 'local', parameters: [{ name: 'value', type: 'string' }] },
      { id: 'component:TagInput.onChange', kind: 'local', parameters: [{ name: 'value', type: 'string' }] },
      { id: 'component:BillingAmountInput.onChange', kind: 'domain', parameters: [{ name: 'amount', type: 'number | undefined' }] },
      { id: 'component:BillingIntervalSelector.onChange', kind: 'domain', parameters: [{ name: 'value', type: 'string' }] },
      { id: 'component:AddressEditor.onChange', kind: 'domain', parameters: [{ name: 'address', type: 'Record<string, unknown>' }] },
      { id: 'screen:onCancel', kind: 'domain', parameters: [] },
      { id: 'screen:onViewTimeline', kind: 'domain', parameters: [] },
      { id: 'screen:onChange', kind: 'domain', parameters: [] },
      { id: 'screen:onDelete', kind: 'domain', parameters: [] },
      { id: 'screen:onEdit', kind: 'domain', parameters: [] },
      { id: 'screen:onFilter', kind: 'domain', parameters: [{ name: 'criteria', type: 'Record<string, unknown>' }] },
      { id: 'screen:onPageChange', kind: 'domain', parameters: [{ name: 'page', type: 'number' }] },
      { id: 'screen:onRowClick', kind: 'domain', parameters: [{ name: 'rowId', type: 'string' }] },
      { id: 'screen:onSort', kind: 'domain', parameters: [{ name: 'column', type: 'string' }] },
      { id: 'screen:onSubmit', kind: 'domain', parameters: [] },
    ]);
  });

  it('retains deterministic occurrence evidence independent of binding insertion order', () => {
    const makeTree = (reverseBindings: boolean): UiElement[] => [screen({
      bindings: reverseBindings
        ? { onSubmit: 'submitAccount', onEdit: 'editAccount' }
        : { onEdit: 'editAccount', onSubmit: 'submitAccount' },
      children: [
        {
          id: 'email',
          component: 'Input',
          bindings: { onChange: 'handleEmailChange' },
        },
        {
          id: 'notice',
          component: 'Banner',
          bindings: { onDismiss: 'handleDismiss' },
        },
        {
          id: 'save',
          component: 'Button',
          bindings: { onActivate: 'activateSave' },
        },
      ],
    })];

    const first = analyzeBindings(makeTree(false));
    const second = analyzeBindings(makeTree(true));

    expect(second).toEqual(first);
    expect(first.ok).toBe(true);
    expect(first.occurrences).toEqual([
      expect.objectContaining({
        nodeId: 'screen', component: 'Stack', event: 'onEdit', handlerName: 'editAccount',
        kind: 'domain', path: '/screens/0', scope: 'screen', signature: { parameters: [] },
      }),
      expect.objectContaining({
        nodeId: 'screen', component: 'Stack', event: 'onSubmit', handlerName: 'submitAccount',
        kind: 'domain', path: '/screens/0', scope: 'screen', signature: { parameters: [] },
      }),
      expect.objectContaining({
        nodeId: 'email', component: 'Input', event: 'onChange', handlerName: 'handleEmailChange',
        kind: 'local', path: '/screens/0/children/0', scope: 'component',
        signature: { parameters: [{ name: 'value', type: 'string' }] },
        localSymbols: { state: 'handleEmailChangeState', setter: 'setHandleEmailChangeState' },
      }),
      expect.objectContaining({
        nodeId: 'notice', component: 'Banner', event: 'onDismiss', handlerName: 'handleDismiss',
        kind: 'local', path: '/screens/0/children/1', scope: 'component', signature: { parameters: [] },
      }),
      expect.objectContaining({
        nodeId: 'save', component: 'Button', event: 'onActivate', handlerName: 'activateSave',
        kind: 'domain', path: '/screens/0/children/2', scope: 'component', signature: { parameters: [] },
      }),
    ]);
    expect(first.issues).toEqual([]);
  });

  it('gives component semantics precedence over screen-root semantics', () => {
    const result = analyzeBindings([
      screen({ id: 'field-screen', component: 'Input', bindings: { onChange: 'changeField' } }),
      screen({ id: 'form-screen', bindings: { onChange: 'changeForm' } }),
    ]);

    expect(result.ok).toBe(true);
    expect(result.occurrences).toEqual([
      expect.objectContaining({ handlerName: 'changeField', kind: 'local', scope: 'component' }),
      expect.objectContaining({ handlerName: 'changeForm', kind: 'domain', scope: 'screen' }),
    ]);
  });

  it('rejects unknown aliases and wrong-component bindings without losing their locations', () => {
    const result = analyzeBindings([screen({
      children: [
        { id: 'nested-layout', component: 'Stack', bindings: { onEdit: 'nestedEdit' } },
        { id: 'button', component: 'Button', bindings: { onClick: 'clickButton' } },
        { id: 'field', component: 'Input', bindings: { onUpdateModelValue: 'updateField' } },
      ],
    })]);

    expect(result.ok).toBe(false);
    expect(result.handlers).toEqual([]);
    expect(result.occurrences).toEqual([
      expect.objectContaining({
        nodeId: 'nested-layout', component: 'Stack', event: 'onEdit', handlerName: 'nestedEdit',
        kind: 'unknown', signature: null, path: '/screens/0/children/0',
      }),
      expect.objectContaining({
        nodeId: 'button', component: 'Button', event: 'onClick', handlerName: 'clickButton',
        kind: 'unknown', signature: null, path: '/screens/0/children/1',
      }),
      expect.objectContaining({
        nodeId: 'field', component: 'Input', event: 'onUpdateModelValue', handlerName: 'updateField',
        kind: 'unknown', signature: null, path: '/screens/0/children/2',
      }),
    ]);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      'UNKNOWN_BINDING',
      'UNKNOWN_BINDING',
      'UNKNOWN_BINDING',
    ]);
  });

  it('rejects multiple local aliases on one node and exposes every collision candidate', () => {
    const result = analyzeBindings([screen({
      children: [{
        id: 'email',
        component: 'Input',
        bindings: {
          onChange: 'handleEmailChange',
          onUpdate: 'handleEmailUpdate',
        },
      }],
    })]);

    expect(result.ok).toBe(false);
    expect(result.handlers).toEqual([]);
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'AMBIGUOUS_LOCAL_BINDING',
        nodeId: 'email',
        occurrences: [
          expect.objectContaining({
            handlerName: 'handleEmailChange',
            localSymbols: { state: 'handleEmailChangeState', setter: 'setHandleEmailChangeState' },
          }),
          expect.objectContaining({
            handlerName: 'handleEmailUpdate',
            localSymbols: { state: 'handleEmailUpdateState', setter: 'setHandleEmailUpdateState' },
          }),
        ],
      }),
    ]);
  });

  it('rejects same-signature semantic ambiguity and incompatible handler reuse', () => {
    const ambiguous = analyzeBindings([screen({
      bindings: { onEdit: 'mutateAccount', onDelete: 'mutateAccount' },
    })]);
    const ambiguousParameterMeaning = analyzeBindings([screen({
      bindings: { onSort: 'selectRowOrColumn' },
      children: [{
        id: 'table',
        component: 'Table',
        bindings: { onRowActivate: 'selectRowOrColumn' },
      }],
    })]);
    const incompatible = analyzeBindings([screen({
      bindings: { onEdit: 'mutateAccount', onSort: 'mutateAccount' },
    })]);

    expect(ambiguous.handlers).toEqual([]);
    expect(ambiguous.issues).toEqual([
      expect.objectContaining({ code: 'AMBIGUOUS_HANDLER', handlerName: 'mutateAccount' }),
    ]);
    expect(ambiguousParameterMeaning.handlers).toEqual([]);
    expect(ambiguousParameterMeaning.issues).toEqual([
      expect.objectContaining({ code: 'AMBIGUOUS_HANDLER', handlerName: 'selectRowOrColumn' }),
    ]);
    expect(incompatible.handlers).toEqual([]);
    expect(incompatible.issues).toEqual([
      expect.objectContaining({ code: 'INCOMPATIBLE_HANDLER', handlerName: 'mutateAccount' }),
    ]);
  });

  it('rejects one local handler reused by multiple state owners', () => {
    const result = analyzeBindings([screen({
      children: [
        { id: 'first-name', component: 'Input', bindings: { onChange: 'handleName' } },
        { id: 'last-name', component: 'Input', bindings: { onChange: 'handleName' } },
      ],
    })]);

    expect(result.ok).toBe(false);
    expect(result.handlers).toEqual([]);
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'AMBIGUOUS_HANDLER',
        handlerName: 'handleName',
        occurrences: [
          expect.objectContaining({ nodeId: 'first-name', path: '/screens/0/children/0' }),
          expect.objectContaining({ nodeId: 'last-name', path: '/screens/0/children/1' }),
        ],
      }),
    ]);
  });

  it('groups compatible repeated domain handlers and preserves each source', () => {
    const result = analyzeBindings([screen({
      children: [
        { id: 'primary', component: 'Button', bindings: { onActivate: 'saveAccount' } },
        { id: 'secondary', component: 'Button', bindings: { onActivate: 'saveAccount' } },
      ],
    })]);

    expect(result.ok).toBe(true);
    expect(result.handlers).toEqual([{
      handlerName: 'saveAccount',
      kind: 'domain',
      signature: { parameters: [] },
      localSymbols: null,
      occurrences: [
        expect.objectContaining({ nodeId: 'primary', component: 'Button', event: 'onActivate' }),
        expect.objectContaining({ nodeId: 'secondary', component: 'Button', event: 'onActivate' }),
      ],
    }]);
  });

  it('reports duplicate node ids even when neither node has bindings', () => {
    const result = analyzeBindings([screen({
      children: [
        { id: 'duplicate', component: 'Text' },
        { id: 'duplicate', component: 'Text' },
      ],
    })]);

    expect(result.ok).toBe(false);
    expect(result.occurrences).toEqual([]);
    expect(result.issues).toEqual([{
      code: 'DUPLICATE_NODE_ID',
      message: 'Node id "duplicate" occurs at both /screens/0/children/0 and /screens/0/children/1.',
      nodeId: 'duplicate',
      path: '/screens/0/children/1',
      firstPath: '/screens/0/children/0',
    }]);
  });

  it('derives stable local state and setter symbols from the handler identifier', () => {
    expect(localStateSymbol('handleEmailChange')).toBe('handleEmailChangeState');
    expect(localSetterSymbol('handleEmailChange')).toBe('setHandleEmailChangeState');
  });

  it('rejects two local handlers whose derived state and setter names collide', () => {
    const result = analyzeBindings([screen({
      children: [
        { id: 'email', component: 'Input', bindings: { onChange: 'updateEmail' } },
        { id: 'enabled', component: 'Checkbox', bindings: { onChange: 'setUpdateEmail' } },
      ],
    })]);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'LOCAL_SYMBOL_COLLISION',
        handlerName: 'updateEmail',
        nodeId: 'email',
        message: 'Local handlers "setUpdateEmail" and "updateEmail" generate the same identifier "setUpdateEmailState".',
      }),
    ]);
  });
});
