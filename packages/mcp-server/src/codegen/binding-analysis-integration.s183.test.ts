import { describe, expect, it } from 'vitest';

import type { UiSchema } from '../schemas/generated.js';
import { runPreEmit } from './pre-emit.js';
import { preflightCodegenSyntax } from './syntax-preflight.js';

describe('Sprint 183 binding-analysis integration', () => {
  it('surfaces the lossless analysis on the shared pre-emit context', () => {
    const schema: UiSchema = {
      version: '2026.03',
      screens: [{
        id: 'account-screen',
        component: 'Stack',
        bindings: { onEdit: 'editAccount' },
        children: [{
          id: 'display-name',
          component: 'Input',
          bindings: { onChange: 'changeDisplayName' },
        }],
      }],
    };

    const context = runPreEmit(schema);

    expect(context.bindingAnalysis.ok).toBe(true);
    expect(context.bindingAnalysis.occurrences).toEqual([
      expect.objectContaining({
        nodeId: 'account-screen',
        component: 'Stack',
        event: 'onEdit',
        handlerName: 'editAccount',
        kind: 'domain',
      }),
      expect.objectContaining({
        nodeId: 'display-name',
        component: 'Input',
        event: 'onChange',
        handlerName: 'changeDisplayName',
        kind: 'local',
        localSymbols: {
          state: 'changeDisplayNameState',
          setter: 'setChangeDisplayNameState',
        },
      }),
    ]);
    expect(context.bindingAnalysis.handlers.map((handler) => handler.handlerName)).toEqual([
      'changeDisplayName',
      'editAccount',
    ]);
  });

  it('returns every binding-analysis failure as deterministic OODS-V007 errors', () => {
    const makeSchema = (reverseBindings: boolean): UiSchema => ({
      version: '2026.03',
      screens: [
        {
          id: 'mutation-screen',
          component: 'Stack',
          bindings: reverseBindings
            ? { onEdit: 'sameAction', onDelete: 'sameAction' }
            : { onDelete: 'sameAction', onEdit: 'sameAction' },
          children: [
            { id: 'duplicate', component: 'Text' },
            { id: 'duplicate', component: 'Text' },
            {
              id: 'unknown-button',
              component: 'Button',
              bindings: { onClick: 'unknownAction' },
            },
            {
              id: 'email',
              component: 'Input',
              bindings: reverseBindings
                ? { onUpdate: 'updateEmail', onChange: 'changeEmail' }
                : { onChange: 'changeEmail', onUpdate: 'updateEmail' },
            },
          ],
        },
        {
          id: 'sort-screen',
          component: 'Stack',
          bindings: reverseBindings
            ? { onSort: 'mixedAction', onEdit: 'mixedAction' }
            : { onEdit: 'mixedAction', onSort: 'mixedAction' },
        },
      ],
    });

    const expected = [
      {
        code: 'OODS-V007',
        message: 'Node id "duplicate" occurs at both /screens/0/children/0 and /screens/0/children/1.',
        nodeId: 'duplicate',
      },
      {
        code: 'OODS-V007',
        message: 'Binding Button.onClick is not in the supported generation vocabulary.',
        nodeId: 'unknown-button',
        component: 'Button',
      },
      {
        code: 'OODS-V007',
        message: 'Node "email" declares multiple aliases for one local state transition.',
        nodeId: 'email',
        component: 'Input',
      },
      {
        code: 'OODS-V007',
        message: 'Handler "mixedAction" is reused with incompatible semantic signatures.',
        nodeId: 'sort-screen',
        component: 'Stack',
      },
      {
        code: 'OODS-V007',
        message: 'Handler "sameAction" is reused for different binding semantics.',
        nodeId: 'mutation-screen',
        component: 'Stack',
      },
    ];

    for (const framework of ['react', 'vue'] as const) {
      expect(preflightCodegenSyntax(makeSchema(false), framework, 'tokens')).toEqual(expected);
      expect(preflightCodegenSyntax(makeSchema(true), framework, 'tokens')).toEqual(expected);
    }
  });

  it('reserves the action protocol and every generated local state symbol', () => {
    const schema: UiSchema = {
      version: '2026.03',
      objectSchema: {
        GeneratedUIActions: { type: 'string', required: true },
        GeneratedUIProps: { type: 'string', required: true },
        actions: { type: 'string', required: true },
        changeDisplayNameState: { type: 'string', required: true },
        generated_props: { type: 'string', required: true },
        setChangeDisplayNameState: { type: 'string', required: true },
      },
      screens: [{
        id: 'account-screen',
        component: 'Stack',
        children: [{
          id: 'display-name',
          component: 'Input',
          bindings: { onChange: 'changeDisplayName' },
        }],
      }],
    };

    for (const framework of ['react', 'vue'] as const) {
      expect(preflightCodegenSyntax(schema, framework, 'tokens')).toEqual([
        {
          code: 'OODS-V007',
          message: `Object schema field "GeneratedUIActions" collides with generated identifier "GeneratedUIActions" for ${framework}.`,
        },
        {
          code: 'OODS-V007',
          message: `Object schema field "GeneratedUIProps" collides with generated identifier "GeneratedUIProps" for ${framework}.`,
        },
        {
          code: 'OODS-V007',
          message: `Object schema field "actions" collides with generated identifier "actions" for ${framework}.`,
        },
        {
          code: 'OODS-V007',
          message: `Object schema field "changeDisplayNameState" collides with generated identifier "changeDisplayNameState" for ${framework}.`,
        },
        {
          code: 'OODS-V007',
          message: `Object schema field "generated_props" collides with generated identifier "generatedProps" for ${framework}.`,
        },
        {
          code: 'OODS-V007',
          message: `Object schema field "setChangeDisplayNameState" collides with generated identifier "setChangeDisplayNameState" for ${framework}.`,
        },
      ]);
    }
  });

  it('rejects handlers that shadow action protocol or local state symbols', () => {
    const schema: UiSchema = {
      version: '2026.03',
      screens: [{
        id: 'account-screen',
        component: 'Stack',
        children: [
          {
            id: 'display-name',
            component: 'Input',
            bindings: { onChange: 'changeDisplayName' },
          },
          { id: 'save', component: 'Button', bindings: { onActivate: 'actions' } },
          { id: 'cancel', component: 'Button', bindings: { onActivate: 'GeneratedUIActions' } },
          { id: 'archive', component: 'Button', bindings: { onActivate: 'changeDisplayNameState' } },
          { id: 'delete', component: 'Button', bindings: { onActivate: 'setChangeDisplayNameState' } },
        ],
      }],
    };

    for (const framework of ['react', 'vue'] as const) {
      expect(preflightCodegenSyntax(schema, framework, 'inline')).toEqual([
        {
          code: 'OODS-V007',
          message: `Binding handler "actions" collides with a generated identifier for ${framework}.`,
          nodeId: 'save',
          component: 'Button',
        },
        {
          code: 'OODS-V007',
          message: `Binding handler "GeneratedUIActions" collides with a generated identifier for ${framework}.`,
          nodeId: 'cancel',
          component: 'Button',
        },
        {
          code: 'OODS-V007',
          message: `Binding handler "changeDisplayNameState" collides with a generated identifier for ${framework}.`,
          nodeId: 'archive',
          component: 'Button',
        },
        {
          code: 'OODS-V007',
          message: `Binding handler "setChangeDisplayNameState" collides with a generated identifier for ${framework}.`,
          nodeId: 'delete',
          component: 'Button',
        },
      ]);
    }
  });
});
