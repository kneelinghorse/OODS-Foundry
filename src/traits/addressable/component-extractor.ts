import { ADDRESS_MAX_LINES } from '@/schemas/address.js';

import {
  getTemplateByKey,
} from './format-templates.js';
import type {
  AddressFormatTemplate,
  AddressTemplateComponent,
  TemplateComponentToken,
  TemplateLine,
  TemplateToken,
} from './template-parser.js';

export interface ExtractComponentsOptions {
  readonly template?: AddressFormatTemplate;
  readonly templateKey?: string;
}

export type ExtractedComponents = Partial<Record<AddressTemplateComponent, string | string[]>>;

/**
 * Attempt to parse a formatted address string back into its constituent components.
 * The extraction is template-driven and best-effort – templates lacking literal
 * separators may not yield precise splits.
 */
export function extractComponents(
  formatted: string,
  options: ExtractComponentsOptions = {}
): ExtractedComponents {
  const template = resolveTemplate(options);
  const lines = formatted.split(/\r?\n/).map((line) => line.trim());
  const components: ExtractedComponents = {};

  let lineIndex = 0;
  for (let templateIndex = 0; templateIndex < template.lines.length && lineIndex < lines.length; templateIndex += 1) {
    const lineDef = template.lines[templateIndex];
    if (isMultilineLine(lineDef)) {
      const result = extractMultilineBlock(template, lines, templateIndex, lineIndex);
      if (result) {
        const token = lineDef.tokens[0];
        if (token && token.kind === 'component') {
          components[token.component] = result.values;
        }
        lineIndex = result.nextIndex;
      }
      continue;
    }

    const parsed = parseLine(lineDef, lines[lineIndex]);
    if (!parsed) {
      continue;
    }

    Object.entries(parsed.values).forEach(([component, value]) => {
      if (!value) {
        return;
      }
      if (Array.isArray(value)) {
        components[component as AddressTemplateComponent] = value;
        return;
      }
      components[component as AddressTemplateComponent] = value;
    });

    lineIndex += 1;
  }

  return components;
}

function resolveTemplate(options: ExtractComponentsOptions): AddressFormatTemplate {
  if (options.template) {
    return options.template;
  }
  if (options.templateKey) {
    return getTemplateByKey(options.templateKey);
  }
  throw new Error('extractComponents requires either template or templateKey.');
}

interface MultilineExtraction {
  readonly values: string[];
  readonly nextIndex: number;
}

function extractMultilineBlock(
  template: AddressFormatTemplate,
  lines: readonly string[],
  templateIndex: number,
  startIndex: number
): MultilineExtraction | null {
  if (startIndex >= lines.length) {
    return null;
  }

  const remainingLines = lines.length - startIndex;
  const remainingTemplate = template.lines.length - templateIndex - 1;
  const available = Math.max(1, remainingLines - remainingTemplate);
  const maxCollect = Math.min(ADDRESS_MAX_LINES, available, remainingLines);

  const values = lines.slice(startIndex, startIndex + maxCollect).map((line) => line.trim());
  if (values.length === 0) {
    return null;
  }

  return {
    values,
    nextIndex: startIndex + values.length,
  };
}

interface ParsedLine {
  readonly values: ExtractedComponents;
}

function parseLine(line: TemplateLine, actualLine: string | undefined): ParsedLine | null {
  if (!actualLine || line.tokens.length === 0) {
    return null;
  }

  const values: ExtractedComponents = {};
  let cursor = 0;
  const normalized = actualLine;

  for (let index = 0; index < line.tokens.length; index += 1) {
    const token = line.tokens[index]!;
    if (token.kind === 'literal') {
      if (!normalized.startsWith(token.value, cursor)) {
        return null;
      }
      cursor += token.value.length;
      continue;
    }

    const lookahead = line.tokens.slice(index + 1);
    const nextLiteral = findNextLiteral(lookahead);
    const nextComponent = findNextComponent(lookahead);
    const result = extractComponentValue(token, normalized, cursor, nextLiteral, nextComponent);
    if (!result) {
      return null;
    }
    cursor = result.cursor;
    recordExtractedValue(values, token.component, result.value);
  }

  return { values };
}

function findNextLiteral(tokens: readonly TemplateToken[]): string | null {
  for (const token of tokens) {
    if (token.kind === 'literal' && token.value.length > 0) {
      return token.value;
    }
  }
  return null;
}

function findNextComponent(tokens: readonly TemplateToken[]): TemplateComponentToken | null {
  for (const token of tokens) {
    if (token.kind === 'component') {
      return token;
    }
  }
  return null;
}

interface ExtractedValue {
  readonly value: string;
  readonly cursor: number;
}

function extractComponentValue(
  token: TemplateComponentToken,
  line: string,
  cursor: number,
  nextLiteral: string | null,
  nextComponent: TemplateComponentToken | null
): ExtractedValue | null {
  let currentCursor = cursor;
  const prefix = token.options.prefix ?? '';
  const suffix = token.options.suffix ?? '';

  if (prefix) {
    if (!line.startsWith(prefix, currentCursor)) {
      return null;
    }
    currentCursor += prefix.length;
  }

  if (suffix) {
    if (nextLiteral) {
      const literalIndex = line.indexOf(nextLiteral, currentCursor);
      if (literalIndex === -1) {
        return null;
      }
      const candidate = line.slice(currentCursor, literalIndex);
      const suffixIndex = candidate.lastIndexOf(suffix);
      if (suffixIndex === -1) {
        return null;
      }
      const value = candidate.slice(0, suffixIndex).trim();
      return {
        value,
        cursor: literalIndex,
      };
    }

    if (!line.endsWith(suffix)) {
      return null;
    }
    const candidate = line.slice(currentCursor, line.length - suffix.length).trim();
    return {
      value: candidate,
      cursor: line.length,
    };
  }

  if (nextLiteral) {
    const literalIndex = line.indexOf(nextLiteral, currentCursor);
    if (literalIndex === -1) {
      return null;
    }
    const value = line.slice(currentCursor, literalIndex).trim();
    return {
      value,
      cursor: literalIndex,
    };
  }

  if (nextComponent?.options.prefix) {
    const delimiterIndex = line.indexOf(nextComponent.options.prefix, currentCursor);
    if (delimiterIndex !== -1) {
      const value = line.slice(currentCursor, delimiterIndex).trim();
      return {
        value,
        cursor: delimiterIndex,
      };
    }
  }

  const value = line.slice(currentCursor).trim();
  return {
    value,
    cursor: line.length,
  };
}

function recordExtractedValue(
  values: ExtractedComponents,
  component: AddressTemplateComponent,
  value: string
): void {
  if (!value) {
    return;
  }

  const current = values[component];
  if (Array.isArray(current)) {
    values[component] = [...current, value];
    return;
  }

  if (current) {
    values[component] = [current, value];
    return;
  }

  values[component] = value;
}

function isMultilineLine(line: TemplateLine): boolean {
  if (line.tokens.length !== 1) {
    return false;
  }
  const token = line.tokens[0];
  if (!token || token.kind !== 'component') {
    return false;
  }
  return token.options.multiline ?? token.component === 'addressLines';
}
