import type { UiElement, UiSchema } from '../schemas/generated.js';
import { PATTERN_GROUP_DROPPED_DIRECTIVES } from './binding-utils.js';

function executeNode(node: UiElement): UiElement {
  const children = node.children?.map(executeNode);
  const props = node.props && typeof node.props === 'object'
    ? { ...node.props }
    : undefined;

  const isPatternGroup = node.component === 'Stack'
    && typeof props?.patternComponent === 'string'
    && Array.isArray(props.fields)
    && props.fields.length > 0
    && props.fields.every((field) => typeof field === 'string' && field.length > 0);

  if (!isPatternGroup) {
    return {
      ...node,
      ...(props ? { props } : {}),
      ...(children ? { children } : {}),
    };
  }

  // Only StatusTimeline lowers into a component of its own. Every other pattern group — DateRange on
  // the first object with both a start and an end date, and the six the composer can emit beside it —
  // has already presented its fields as children, so the Stack stays a layout container and its
  // directives are consumed here. Leaving them on would emit `<Stack patternComponent=… fields=…>`,
  // which no Stack accepts: the generated React artifact fails strict typecheck, which is the gate the
  // runtime sweep runs and nothing earlier does.
  if (props!.patternComponent !== 'StatusTimeline') {
    const consumed = { ...props } as Record<string, unknown>;
    delete consumed.patternComponent;
    delete consumed.fields;
    return {
      ...node,
      ...(Object.keys(consumed).length > 0 ? { props: consumed } : { props: undefined }),
      ...(children ? { children } : {}),
    };
  }

  const requestedFields = props.fields as string[];
  delete props.patternComponent;
  delete props.fields;
  // Trait directives the composer wrote onto the pattern-group Stack are
  // consumed unbound there; lowering must not resurrect them on the pattern
  // component, whose contract never governed them. historyField and
  // showReason stay because the StatusTimeline contract governs them.
  for (const directive of PATTERN_GROUP_DROPPED_DIRECTIVES) delete props[directive];

  const unusedChildren = [...(children ?? [])];
  const fieldChildren = requestedFields.map((field, index) => {
    const matchingIndex = unusedChildren.findIndex((child) => child.props?.field === field);
    if (matchingIndex >= 0) return unusedChildren.splice(matchingIndex, 1)[0]!;
    return {
      id: `${node.id}-field-${index + 1}`,
      component: 'Text',
      props: { field },
    } satisfies UiElement;
  });

  return {
    ...node,
    component: 'StatusTimeline',
    ...(Object.keys(props).length > 0 ? { props } : { props: undefined }),
    children: [...fieldChildren, ...unusedChildren],
  };
}

/**
 * Lower the bounded Stack composition directive into the named pattern before
 * component collection and target emission. Validation owns the directive
 * vocabulary; this pass owns its observable execution.
 */
export function executeCompositionDirectives(schema: UiSchema): UiSchema {
  return {
    ...schema,
    screens: schema.screens.map(executeNode) as UiSchema['screens'],
  };
}
