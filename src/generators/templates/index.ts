/* c8 ignore file */
/**
 * Code Templates for Type Generation
 *
 * Provides reusable templates for generating TypeScript code.
 * Templates use template literals for clean, readable code generation.
 */

import TimeService from '../../services/time/index.js';

/**
 * Template for a file header with metadata
 */
export function fileHeaderTemplate(options: {
  traitName: string;
  version: string;
  description?: string;
  generatedDate?: string;
}): string {
  const { traitName, version, description, generatedDate } = options;
  const now = TimeService.nowSystem();
  const timestamp = generatedDate ?? TimeService.toIsoString(now);

  return `/**
 * Generated types for ${traitName} trait
 *
 * DO NOT EDIT - This file is auto-generated
 * Generated: ${timestamp}
 * Trait version: ${version}${description ? `\n * \n * ${description}` : ''}
 */
`;
}

/**
 * Template for a const array declaration
 */
export function constArrayTemplate(options: {
  constantName: string;
  values: readonly (string | number)[];
  comment?: string;
  export?: boolean;
}): string {
  const { constantName, values, comment, export: shouldExport = true } = options;

  const exportKeyword = shouldExport ? 'export ' : '';
  const formattedValues = values
    .map((v) => {
      if (typeof v === 'string') {
        return `  "${v}"`;
      }
      return `  ${v}`;
    })
    .join(',\n');

  let code = '';

  if (comment) {
    code += `/**\n * ${comment}\n */\n`;
  }

  code += `${exportKeyword}const ${constantName} = [\n${formattedValues}\n] as const;\n`;

  return code;
}

/**
 * Template for a union type derived from a const array
 */
export function unionTypeTemplate(options: {
  typeName: string;
  constantName: string;
  comment?: string;
  export?: boolean;
}): string {
  const { typeName, constantName, comment, export: shouldExport = true } = options;

  const exportKeyword = shouldExport ? 'export ' : '';

  let code = '\n';

  if (comment) {
    code += `/**\n * ${comment}\n */\n`;
  }

  code += `${exportKeyword}type ${typeName} = (typeof ${constantName})[number];\n`;

  return code;
}

/**
 * Template for a complete parameter type (const array + union type)
 */
export function parameterTypeTemplate(options: {
  constantName: string;
  typeName: string;
  values: readonly (string | number)[];
  description?: string;
  export?: boolean;
}): string {
  const { constantName, typeName, values, description, export: shouldExport = true } = options;

  const constArray = constArrayTemplate({
    constantName,
    values,
    comment: description ? `Allowed values for ${constantName}` : undefined,
    export: shouldExport,
  });

  const unionType = unionTypeTemplate({
    typeName,
    constantName,
    comment: description ? `Union type derived from ${constantName}` : undefined,
    export: shouldExport,
  });

  return constArray + unionType;
}

/**
 * Template for a namespace declaration
 */
export function namespaceTemplate(options: {
  namespaceName: string;
  content: string;
  comment?: string;
  export?: boolean;
}): string {
  const { namespaceName, content, comment, export: shouldExport = true } = options;

  const exportKeyword = shouldExport ? 'export ' : '';

  let code = '';

  if (comment) {
    code += `/**\n * ${comment}\n */\n`;
  }

  code += `${exportKeyword}namespace ${namespaceName} {\n`;

  // Indent the content
  const indentedContent = content
    .split('\n')
    .map((line) => (line ? `  ${line}` : line))
    .join('\n');

  code += indentedContent;
  code += '\n}\n';

  return code;
}

/**
 * Template for type imports
 */
export function importTemplate(options: {
  types: string[];
  from: string;
  typeOnly?: boolean;
}): string {
  const { types, from, typeOnly = true } = options;

  const typeKeyword = typeOnly ? 'type ' : '';
  const typeList = types.join(', ');

  return `import ${typeKeyword}{ ${typeList} } from '${from}';\n`;
}

/**
 * Template for a composed type file with multiple traits
 */
export function composedFileTemplate(options: {
  traitNames: string[];
  content: string;
  generatedDate?: string;
}): string {
  const { traitNames, content, generatedDate } = options;
  const now = TimeService.nowSystem();
  const timestamp = generatedDate ?? TimeService.toIsoString(now);

  const header = `/**
 * Composed types for traits: ${traitNames.join(' + ')}
 *
 * DO NOT EDIT - This file is auto-generated
 * Generated: ${timestamp}
 */

`;

  return header + content;
}

/**
 * Template for a warning comment about conflicts
 */
export function conflictWarningTemplate(conflicts: Map<string, string[]>): string {
  if (conflicts.size === 0) {
    return '';
  }

  let warning = '/**\n * WARNING: Parameter name conflicts detected:\n *\n';

  for (const [paramName, traitNames] of conflicts.entries()) {
    warning += ` * - ${paramName}: appears in [${traitNames.join(', ')}]\n`;
  }

  warning += ' *\n * These parameters have been namespaced to avoid collisions.\n */\n\n';

  return warning;
}

/**
 * Template for JSDoc comment blocks
 */
export function jsdocTemplate(options: {
  description?: string;
  tags?: Array<{ tag: string; value: string }>;
}): string {
  const { description, tags = [] } = options;

  let code = '/**\n';

  if (description) {
    code += ` * ${description}\n`;

    if (tags.length > 0) {
      code += ' *\n';
    }
  }

  for (const { tag, value } of tags) {
    code += ` * @${tag} ${value}\n`;
  }

  code += ' */\n';

  return code;
}
