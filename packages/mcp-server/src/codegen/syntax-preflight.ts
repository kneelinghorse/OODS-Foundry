import type { UiElement, UiSchema } from '../schemas/generated.js';
import type { CodegenIssue } from './types.js';
import {
  analyzeBindings,
  snakeToCamel,
  type BindingAnalysis,
  type BindingAnalysisIssue,
} from './binding-utils.js';
import { normalizeSchemaForFramework } from './framework-normalization.js';
import { collectTailwindVariantDefinitions } from './tailwind-codegen-utils.js';
import { collectUiStateBranches } from './state-contract.js';

const IDENTIFIER_NAME = /^[$_\p{ID_Start}][$_\u200c\u200d\p{ID_Continue}]*$/u;
const DATA_OR_ARIA_ATTRIBUTE = /^(?:data|aria)-[a-zA-Z0-9_]+(?:-[a-zA-Z0-9_]+)*$/;
const RESERVED_BINDINGS = new Set([
  'arguments',
  'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger',
  'default', 'delete', 'do', 'else', 'enum', 'eval', 'export', 'extends',
  'false', 'finally', 'for', 'function', 'if', 'implements', 'import', 'in',
  'instanceof', 'interface', 'let', 'new', 'null', 'package', 'private',
  'protected', 'public', 'return', 'static', 'super', 'switch', 'this',
  'throw', 'true', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield',
]);
// Mirrors vue-emitter's FORM_INPUT_COMPONENTS (s223-m02: the two Select-like controls joined it).
const FORM_INPUT_COMPONENTS = new Set([
  'Checkbox', 'Combobox', 'DatePicker', 'Input', 'SegmentedControl', 'Select', 'Switch', 'TagInput', 'Textarea', 'Toggle',
]);
const LIST_CONTEXT_BINDINGS = new Set(['onRowClick', 'onSort', 'onFilter', 'onPageChange']);

type FrameworkTarget = 'react' | 'vue';
type StylingTarget = 'tokens' | 'tailwind' | 'inline';

function compareCodePoint(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isBindingIdentifier(value: string): boolean {
  return IDENTIFIER_NAME.test(value) && !RESERVED_BINDINGS.has(value);
}

function isSafePropKey(value: string): boolean {
  return IDENTIFIER_NAME.test(value) || DATA_OR_ARIA_ATTRIBUTE.test(value);
}

function isVueFormSchema(screens: readonly UiElement[]): boolean {
  if (screens.some((screen) => (
    Object.keys(screen.bindings ?? {}).some((key) => LIST_CONTEXT_BINDINGS.has(key))
  ))) {
    return false;
  }
  return nodesInDocumentOrder(screens).some((node) => FORM_INPUT_COMPONENTS.has(node.component));
}

function vueDerivedBindings(schema: UiSchema): string[] {
  const fields = Object.keys(schema.objectSchema ?? {});
  if (!isVueFormSchema(schema.screens)) return [];

  const derived: string[] = [];
  if (
    fields.some((field) => /^first.?name$/i.test(field))
    && fields.some((field) => /^last.?name$/i.test(field))
  ) {
    derived.push('fullName');
  }
  if (
    fields.some((field) => /^(?:street|address)$/i.test(field))
    && fields.some((field) => /^city$/i.test(field))
  ) {
    derived.push('fullAddress');
  }
  return derived;
}

function generatedBindings(
  schema: UiSchema,
  framework: FrameworkTarget,
  styling: StylingTarget,
  bindingAnalysis: BindingAnalysis,
): Set<string> {
  const emittedNodes = nodesInDocumentOrder(schema.screens);
  const names = new Set(emittedNodes.map((node) => node.component));
  names.add('actions');
  names.add('GeneratedUIActions');
  names.add('GeneratedUIProps');
  names.add('generatedProps');
  if (collectUiStateBranches(schema.screens).length > 0) {
    names.add('uiState');
    names.add('GeneratedUIState');
  }

  for (const occurrence of bindingAnalysis.occurrences) {
    if (occurrence.kind !== 'local') continue;
    names.add(occurrence.localSymbols.state);
    names.add(occurrence.localSymbols.setter);
  }

  if (framework === 'react') {
    names.add('React');
  } else {
    const hasFields = Object.keys(schema.objectSchema ?? {}).length > 0;
    const formMode = hasFields && isVueFormSchema(schema.screens);
    if (formMode) names.add('ref');
    else if (hasFields) names.add('defineProps');
    for (const derived of vueDerivedBindings(schema)) {
      names.add('computed');
      names.add(derived);
    }
  }

  if (styling === 'tailwind') {
    const variants = collectTailwindVariantDefinitions(schema.screens);
    if (variants.size > 0) names.add('cva');
    for (const definition of variants.values()) names.add(definition.variableName);
  }

  return names;
}

function nodesInDocumentOrder(screens: readonly UiElement[]): UiElement[] {
  const ordered: UiElement[] = [];
  const stack = [...screens].reverse();
  while (stack.length > 0) {
    const node = stack.pop()!;
    ordered.push(node);
    if (node.children) stack.push(...node.children.slice().reverse());
  }
  return ordered;
}

function issue(message: string, node?: UiElement): CodegenIssue {
  return {
    code: 'OODS-V007',
    message,
    ...(node ? { nodeId: node.id, component: node.component } : {}),
  };
}

function bindingIssue(issueValue: BindingAnalysisIssue): CodegenIssue {
  const firstOccurrence = issueValue.occurrences?.[0];
  const nodeId = issueValue.nodeId ?? firstOccurrence?.nodeId;
  const component = issueValue.component ?? firstOccurrence?.component;

  return {
    code: 'OODS-V007',
    message: issueValue.message,
    ...(nodeId !== undefined ? { nodeId } : {}),
    ...(component !== undefined ? { component } : {}),
  };
}

export function preflightCodegenSyntax(
  schema: UiSchema,
  framework: FrameworkTarget,
  styling: StylingTarget,
): CodegenIssue[] {
  const emittedSchema = normalizeSchemaForFramework(schema, framework);
  const bindingAnalysis = analyzeBindings(emittedSchema.screens);
  const issues: CodegenIssue[] = [];
  const fieldByIdentifier = new Map<string, string>();
  const generated = generatedBindings(emittedSchema, framework, styling, bindingAnalysis);

  issues.push(...bindingAnalysis.issues.map(bindingIssue));

  for (const field of Object.keys(emittedSchema.objectSchema ?? {}).sort(compareCodePoint)) {
    const identifier = snakeToCamel(field);
    if (!isBindingIdentifier(identifier)) {
      issues.push(issue(
        `Object schema field ${JSON.stringify(field)} does not normalize to a safe JavaScript identifier.`,
      ));
      continue;
    }

    if (generated.has(identifier)) {
      issues.push(issue(
        `Object schema field ${JSON.stringify(field)} collides with generated identifier ${JSON.stringify(identifier)} for ${framework}.`,
      ));
    }

    const priorField = fieldByIdentifier.get(identifier);
    if (priorField !== undefined) {
      issues.push(issue(
        `Object schema fields ${JSON.stringify(priorField)} and ${JSON.stringify(field)} normalize to the same JavaScript identifier ${JSON.stringify(identifier)}.`,
      ));
      continue;
    }
    fieldByIdentifier.set(identifier, field);
  }

  for (const node of nodesInDocumentOrder(emittedSchema.screens)) {
    const props = node.props && typeof node.props === 'object'
      ? node.props as Record<string, unknown>
      : {};
    for (const key of Object.keys(props).sort(compareCodePoint)) {
      if (!isSafePropKey(key)) {
        issues.push(issue(
          `Prop key ${JSON.stringify(key)} cannot be emitted safely as a framework attribute.`,
          node,
        ));
      } else if (
        key === 'data-oods-component'
        || (key === 'data-oods-state' && node.state !== undefined)
        || (key === 'data-layout' && node.layout?.type !== undefined)
      ) {
        issues.push(issue(
          `Prop key ${JSON.stringify(key)} collides with an emitter-owned attribute.`,
          node,
        ));
      }
    }

    for (const [bindingKey, handlerName] of Object.entries(node.bindings ?? {})
      .sort(([left], [right]) => compareCodePoint(left, right))) {
      if (!IDENTIFIER_NAME.test(bindingKey)) {
        issues.push(issue(
          `Binding key ${JSON.stringify(bindingKey)} cannot be emitted safely as a framework event.`,
          node,
        ));
      }
      if (framework === 'react' && Object.hasOwn(props, bindingKey)) {
        issues.push(issue(
          `Prop key ${JSON.stringify(bindingKey)} duplicates a binding attribute for react.`,
          node,
        ));
      }
      if (!isBindingIdentifier(handlerName)) {
        issues.push(issue(
          `Binding handler ${JSON.stringify(handlerName)} is not a safe JavaScript identifier.`,
          node,
        ));
      } else if (fieldByIdentifier.has(handlerName)) {
        issues.push(issue(
          `Binding handler ${JSON.stringify(handlerName)} collides with an object schema field identifier.`,
          node,
        ));
      } else if (generated.has(handlerName)) {
        issues.push(issue(
          `Binding handler ${JSON.stringify(handlerName)} collides with a generated identifier for ${framework}.`,
          node,
        ));
      }
    }
  }

  return issues;
}
