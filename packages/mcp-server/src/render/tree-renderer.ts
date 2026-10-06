import type { UiElement, UiLayout, UiSchema, UiStyle } from '../schemas/generated.js';
import { renderMappedComponent } from './component-map.js';
import { escapeHtml } from './escape-html.js';
import { resolveSpacingLeaf } from './spacing-leaf.js';
import { executeCompositionDirectives } from '../codegen/composition-directives.js';
import { snakeToCamel } from '../codegen/binding-utils.js';

type CssDeclarations = Record<string, string>;
export interface FragmentResult {
  nodeId: string;
  component: string;
  html: string;
}
export interface FragmentRenderError {
  nodeId: string;
  component: string;
  message: string;
}
export interface FragmentRenderBatch {
  fragments: Map<string, FragmentResult>;
  errors: FragmentRenderError[];
}

const ALIGN_MAP: Record<NonNullable<UiLayout['align']>, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  'space-between': 'space-between',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeToken(token: string): string {
  return token.trim().replace(/[.\s_]+/g, '-');
}

function tokenVar(group: string, token: string): string {
  // sprint-125 m03: converge onto the canonical space prefix (the spacing group
  // emitted dead --sys-spacing-/--ref-spacing-; built tokens define only
  // --sys-space-*/--ref-space-*) and resolve a bare t-shirt size (sm/md/lg) to its
  // scale-<size> leaf. Other groups keep their own prefix + leaf untouched.
  const resolvedGroup = group === 'spacing' ? 'space' : group;
  const normalized = normalizeToken(group === 'spacing' ? resolveSpacingLeaf(token) : token);
  return `var(--sys-${resolvedGroup}-${normalized}, var(--ref-${resolvedGroup}-${normalized}))`;
}

function toCssString(declarations: CssDeclarations): string {
  return Object.entries(declarations)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([property, value]) => `${property}:${value}`)
    .join(';');
}

function mergeStyle(existing: unknown, computed: CssDeclarations): string | undefined {
  const computedStyle = toCssString(computed);
  if (!computedStyle) {
    return typeof existing === 'string' && existing.trim().length > 0 ? existing.trim() : undefined;
  }
  const existingStyle = typeof existing === 'string' && existing.trim().length > 0 ? existing.trim().replace(/;+\s*$/, '') : '';
  return existingStyle ? `${existingStyle};${computedStyle}` : computedStyle;
}

function resolveLayoutStyles(layout?: UiLayout): CssDeclarations {
  if (!layout?.type) return {};

  const declarations: CssDeclarations = {};
  switch (layout.type) {
    case 'stack':
      declarations.display = 'flex';
      declarations['flex-direction'] = 'column';
      break;
    case 'inline':
      declarations.display = 'flex';
      declarations['flex-direction'] = 'row';
      break;
    case 'grid':
      declarations.display = 'grid';
      declarations['grid-template-columns'] = 'repeat(auto-fit, minmax(0, 1fr))';
      break;
    case 'sidebar':
      declarations.display = 'grid';
      declarations['grid-template-columns'] = 'minmax(0, 1fr) minmax(16rem, 24rem)';
      declarations['align-items'] = 'start';
      break;
    case 'section':
      declarations.display = 'block';
      break;
  }

  if (layout.align) {
    const alignValue = ALIGN_MAP[layout.align];
    if (layout.type === 'stack' && layout.align !== 'space-between') {
      declarations['align-items'] = alignValue;
    } else if (layout.type === 'inline') {
      declarations['justify-content'] = alignValue;
    } else {
      declarations['justify-content'] = alignValue;
    }
  }

  if (layout.gapToken) {
    declarations.gap = tokenVar('spacing', layout.gapToken);
  }

  return declarations;
}

function resolveStyleTokens(style?: UiStyle): CssDeclarations {
  if (!style) return {};

  const declarations: CssDeclarations = {};
  if (style.spacingToken) declarations.padding = tokenVar('spacing', style.spacingToken);
  if (style.radiusToken) declarations['border-radius'] = tokenVar('radius', style.radiusToken);
  if (style.shadowToken) declarations['box-shadow'] = tokenVar('shadow', style.shadowToken);
  if (style.colorToken) declarations.color = tokenVar('color', style.colorToken);
  if (style.typographyToken) declarations.font = tokenVar('typography', style.typographyToken);
  return declarations;
}

function styleForNode(node: UiElement): CssDeclarations {
  return { ...resolveLayoutStyles(node.layout), ...resolveStyleTokens(node.style) };
}

function withComputedStyle(node: UiElement, declarations: CssDeclarations): UiElement {
  const nextProps = isRecord(node.props) ? { ...node.props } : {};
  const mergedStyle = mergeStyle(nextProps.style, declarations);
  if (mergedStyle) {
    nextProps.style = mergedStyle;
  }
  return {
    ...node,
    props: nextProps,
  };
}

function renderSidebarChildren(children: string[]): string {
  const [main = '', ...asideChildren] = children;
  const asideHtml = asideChildren.join('');
  // s213-m01: the sidebar column is layout, not a landmark (a nested <aside> was a complementary landmark inside <main>).
  return `<div data-sidebar-main="true">${main}</div><div data-sidebar-aside="true">${asideHtml}</div>`;
}

function renderNode(node: UiElement, insideStatusTimeline = false): string {
  if (
    insideStatusTimeline
    && node.component === 'Text'
    && typeof node.props?.field === 'string'
    && node.props.content === undefined
    && node.props.text === undefined
    && node.props.value === undefined
  ) {
    const fieldName = snakeToCamel(node.props.field);
    node = {
      ...node,
      props: {
        ...node.props,
        text: `[${fieldName}]`,
        'data-bind': fieldName,
      },
    };
  }
  const childNodes = Array.isArray(node.children) ? node.children : [];
  const renderedChildren = childNodes.map((child) => (
    renderNode(child, node.component === 'StatusTimeline')
  ));
  const childHtml = node.layout?.type === 'sidebar' ? renderSidebarChildren(renderedChildren) : renderedChildren.join('');
  const declarations = styleForNode(node);

  if (node.layout?.type === 'section') {
    const inner = renderMappedComponent(node, childHtml, renderedChildren);
    const sectionStyle = toCssString(declarations);
    const styleAttribute = sectionStyle ? ` style="${escapeHtml(sectionStyle)}"` : '';
    return `<section data-layout="section" data-layout-node-id="${escapeHtml(node.id)}"${styleAttribute}>${inner}</section>`;
  }

  const styledNode = withComputedStyle(node, declarations);
  return renderMappedComponent(styledNode, childHtml, renderedChildren);
}

function renderTokenOverrides(tokenOverrides?: Record<string, string>): string {
  if (!tokenOverrides || Object.keys(tokenOverrides).length === 0) return '';

  const declarations = Object.entries(tokenOverrides)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `  --token-${normalizeToken(key)}: ${value};`)
    .join('\n');

  return `<style data-token-overrides="true">\n:root {\n${declarations}\n}\n</style>`;
}

export function renderTree(schema: UiSchema): string {
  const expandedSchema = executeCompositionDirectives(schema);
  const tokenStyle = renderTokenOverrides(expandedSchema.tokenOverrides);
  const body = expandedSchema.screens.map((screen) => renderNode(screen)).join('');
  return tokenStyle ? `${tokenStyle}\n${body}` : body;
}

export function renderFragments(schema: UiSchema): Map<string, FragmentResult> {
  return renderFragmentsWithErrors(schema).fragments;
}

export function renderFragmentsWithErrors(schema: UiSchema): FragmentRenderBatch {
  const fragments = new Map<string, FragmentResult>();
  const errors: FragmentRenderError[] = [];
  const expandedSchema = executeCompositionDirectives(schema);

  for (const screen of expandedSchema.screens) {
    const topLevelChildren = Array.isArray(screen.children) ? screen.children : [];
    for (const node of topLevelChildren) {
      try {
        fragments.set(node.id, {
          nodeId: node.id,
          component: node.component,
          html: renderNode(node),
        });
      } catch (error: unknown) {
        errors.push({
          nodeId: node.id,
          component: node.component,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return { fragments, errors };
}

export function resolveStyleTokensToCssVars(style?: UiStyle): CssDeclarations {
  return resolveStyleTokens(style);
}
