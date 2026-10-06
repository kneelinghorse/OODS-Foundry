import type { UiElement, UiLayout } from '../schemas/generated.js';
import { createVariants, inlineStyleToTailwind, type TailwindVariants } from './tailwind-mapper.js';
import { javascriptSingleQuotedString } from './emission-safety.js';

type NodeProps = Record<string, unknown>;

const VARIANT_PROP_KEYS = [
  'variant',
  'intent',
  'tone',
  'size',
  'appearance',
  'emphasis',
  'state',
] as const;

const INTERACTIVE_COMPONENTS = new Set<string>([
  'Button',
  'IconButton',
  'Link',
  'Input',
  'TextInput',
  'Textarea',
  'Select',
  'Switch',
  'Checkbox',
  'Radio',
]);

const INTENT_CLASS_MAP: Record<string, string> = {
  primary: 'bg-primary text-white hover:bg-primary-hover',
  secondary: 'bg-secondary text-white hover:bg-secondary-hover',
  success: 'bg-success text-white hover:bg-success-hover',
  warning: 'bg-warning text-white hover:bg-warning-hover',
  danger: 'bg-danger text-white hover:bg-danger-hover',
  destructive: 'bg-danger text-white hover:bg-danger-hover',
  info: 'bg-info text-white hover:bg-info-hover',
  neutral: 'bg-neutral text-white hover:bg-neutral-hover',
  ghost: 'bg-transparent text-primary hover:bg-surface-muted',
  outline: 'bg-transparent border border-current text-primary hover:bg-surface-muted',
  default: 'bg-primary text-white hover:bg-primary-hover',
};

const SIZE_CLASS_MAP: Record<string, string> = {
  xs: 'text-xs px-1.5 py-1',
  sm: 'text-sm px-2 py-1.5',
  md: 'text-sm px-3 py-2',
  default: 'text-sm px-3 py-2',
  lg: 'text-base px-4 py-2.5',
  xl: 'text-lg px-5 py-3',
};

const RESPONSIVE_SIZE_CLASS_MAP: Record<string, string> = {
  xs: 'text-xs px-1 py-0.5 sm:px-1.5 sm:py-1',
  sm: 'text-xs sm:text-sm px-1.5 py-1 sm:px-2 sm:py-1.5',
  md: 'text-sm md:text-base px-2 py-1.5 md:px-3 md:py-2',
  default: 'text-sm md:text-base px-2 py-1.5 md:px-3 md:py-2',
  lg: 'text-base lg:text-lg px-3 py-2 lg:px-4 lg:py-2.5',
  xl: 'text-lg lg:text-xl px-4 py-2.5 lg:px-5 lg:py-3',
};

const EMPHASIS_CLASS_MAP: Record<string, string> = {
  low: 'opacity-80',
  medium: 'opacity-90',
  high: 'opacity-100',
};

export type TailwindVariantDefinition = {
  variableName: string;
  definition: string;
  variantProps: string[];
};

function normalizeVariantValue(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

function toCamelCase(value: string): string {
  const cleaned = value
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean);

  if (cleaned.length === 0) return 'component';
  return cleaned
    .map((part, idx) => (
      idx === 0
        ? part.toLowerCase()
        : `${part[0].toUpperCase()}${part.slice(1).toLowerCase()}`
    ))
    .join('');
}

function variantVariableName(component: string): string {
  return `${toCamelCase(component)}Variants`;
}

function variantClassesForValue(prop: string, rawValue: string, responsive = false): string {
  const value = normalizeVariantValue(rawValue);

  if (prop === 'size') {
    if (responsive) return RESPONSIVE_SIZE_CLASS_MAP[value] ?? '';
    return SIZE_CLASS_MAP[value] ?? '';
  }

  if (prop === 'emphasis') {
    return EMPHASIS_CLASS_MAP[value] ?? '';
  }

  if (prop === 'state') {
    if (value === 'disabled') return 'opacity-50 cursor-not-allowed';
    if (value === 'active') return 'ring-2 ring-primary';
    if (value === 'focus') return 'ring-2 ring-primary ring-offset-2';
    return '';
  }

  if (prop === 'variant' || prop === 'intent' || prop === 'tone' || prop === 'appearance') {
    return INTENT_CLASS_MAP[value] ?? '';
  }

  return '';
}

function splitClasses(raw: string): string[] {
  return raw.trim().split(/\s+/).filter(Boolean);
}

export function joinUniqueClasses(...chunks: Array<string | null | undefined>): string {
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const chunk of chunks) {
    if (!chunk) continue;
    for (const cls of splitClasses(chunk)) {
      if (seen.has(cls)) continue;
      seen.add(cls);
      ordered.push(cls);
    }
  }

  return ordered.join(' ');
}

export function getNodeProps(node: UiElement): NodeProps | null {
  return node.props && typeof node.props === 'object'
    ? (node.props as NodeProps)
    : null;
}

export function extractUserClassName(props: NodeProps | null): string {
  if (!props) return '';
  if (typeof props.className === 'string') return props.className;
  if (typeof props.class === 'string') return props.class;
  return '';
}

function interactiveStateClasses(node: UiElement, props: NodeProps | null): string[] {
  // Domain-action metadata may live on structural nodes (for example a Stack
  // carrying onEdit/onDelete). A binding alone does not make that container a
  // focusable control, so interactive utilities follow the rendered component.
  const interactive = INTERACTIVE_COMPONENTS.has(node.component);
  if (!interactive) return [];

  const classes = [
    'focus:outline-none',
    'focus:ring-2',
    'focus:ring-offset-2',
    'disabled:opacity-50',
    'disabled:cursor-not-allowed',
  ];

  const rawIntent = (
    (typeof props?.intent === 'string' && props.intent)
    || (typeof props?.variant === 'string' && props.variant)
    || (typeof props?.tone === 'string' && props.tone)
  );

  if (typeof rawIntent === 'string' && rawIntent.trim()) {
    classes.push(`hover:bg-${normalizeVariantValue(rawIntent)}-hover`);
  } else {
    classes.push('hover:opacity-90');
  }

  return classes;
}

const INTERACTIVE_PREFIXES = ['hover:', 'focus:', 'disabled:', 'active:'];

function isInteractiveClass(cls: string): boolean {
  return INTERACTIVE_PREFIXES.some((prefix) => cls.startsWith(prefix));
}

function isInteractiveElement(node: UiElement): boolean {
  return INTERACTIVE_COMPONENTS.has(node.component);
}

export interface TailwindStaticClassOptions {
  includeUserClass?: boolean;
  includeInteractiveStates?: boolean;
  includeVariantFallback?: boolean;
}

export function buildTailwindStaticClasses(
  node: UiElement,
  styleObj: Record<string, string>,
  options: TailwindStaticClassOptions = {},
): string {
  const includeUserClass = options.includeUserClass ?? true;
  const includeInteractiveStates = options.includeInteractiveStates ?? true;
  const includeVariantFallback = options.includeVariantFallback ?? true;
  const props = getNodeProps(node);

  const classes: string[] = [];
  classes.push(inlineStyleToTailwind(styleObj));

  const interactive = isInteractiveElement(node);

  if (includeVariantFallback && props) {
    for (const key of VARIANT_PROP_KEYS) {
      const value = props[key];
      if (typeof value !== 'string' || !value.trim()) continue;
      let variantClasses = variantClassesForValue(key, value);
      if (variantClasses && !interactive) {
        variantClasses = splitClasses(variantClasses)
          .filter((cls) => !isInteractiveClass(cls))
          .join(' ');
      }
      if (variantClasses) classes.push(variantClasses);
    }
  }

  if (includeInteractiveStates) {
    classes.push(interactiveStateClasses(node, props).join(' '));
  }

  if (includeUserClass) {
    classes.push(extractUserClassName(props));
  }

  return joinUniqueClasses(...classes);
}

export function collectTailwindVariantDefinitions(
  screens: UiElement[],
): Map<string, TailwindVariantDefinition> {
  const valuesByComponent = new Map<string, Map<string, Set<string>>>();
  const stack = [...screens];

  while (stack.length > 0) {
    const node = stack.pop()!;
    const props = getNodeProps(node);
    if (props) {
      const componentVariants = valuesByComponent.get(node.component) ?? new Map<string, Set<string>>();
      valuesByComponent.set(node.component, componentVariants);

      for (const key of VARIANT_PROP_KEYS) {
        const value = props[key];
        if (typeof value !== 'string') continue;
        const normalized = value.trim();
        if (!normalized) continue;
        const optionSet = componentVariants.get(key) ?? new Set<string>();
        optionSet.add(normalized);
        componentVariants.set(key, optionSet);
      }
    }

    if (node.children) stack.push(...node.children);
  }

  const definitions = new Map<string, TailwindVariantDefinition>();
  const components = Array.from(valuesByComponent.keys()).sort((a, b) => a.localeCompare(b));

  for (const component of components) {
    const componentVariants = valuesByComponent.get(component)!;
    const variants: TailwindVariants = {};
    const variantProps: string[] = [];

    for (const key of VARIANT_PROP_KEYS) {
      const values = componentVariants.get(key);
      if (!values || values.size < 2) continue;

      const optionMap: Record<string, string> = {};
      let hasMappedClass = false;
      const sortedValues = Array.from(values).sort((a, b) => a.localeCompare(b));
      for (const value of sortedValues) {
        const classes = variantClassesForValue(key, value, /* responsive */ true);
        optionMap[value] = classes;
        if (classes) hasMappedClass = true;
      }

      if (!hasMappedClass) continue;
      variants[key] = optionMap;
      variantProps.push(key);
    }

    if (variantProps.length === 0) continue;

    definitions.set(component, {
      variableName: variantVariableName(component),
      definition: createVariants(component, variants, ''),
      variantProps,
    });
  }

  return definitions;
}

function serializeVariantArgs(props: NodeProps | null, variantProps: string[]): string | null {
  if (!props || variantProps.length === 0) return null;
  const args: string[] = [];

  for (const key of variantProps) {
    const value = props[key];
    if (typeof value !== 'string' || !value.trim()) continue;
    args.push(`${key}: ${javascriptSingleQuotedString(value)}`);
  }

  if (args.length === 0) return null;
  return `{ ${args.join(', ')} }`;
}

export function buildTailwindVariantExpression(
  node: UiElement,
  definition?: TailwindVariantDefinition,
): string | null {
  if (!definition) return null;
  const args = serializeVariantArgs(getNodeProps(node), definition.variantProps);
  if (!args) return null;
  return `${definition.variableName}(${args})`;
}

/**
 * Generate responsive Tailwind classes for a layout type.
 * Mobile-first: base classes for small screens, breakpoint prefixes for larger.
 */
export function responsiveLayoutClasses(layout?: UiLayout): string {
  if (!layout?.type) return '';

  switch (layout.type) {
    case 'grid':
      return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4';
    case 'sidebar':
      return 'grid-cols-1 md:grid-cols-[1fr_minmax(16rem,24rem)]';
    case 'inline':
      return 'flex-col sm:flex-row';
    default:
      return '';
  }
}
