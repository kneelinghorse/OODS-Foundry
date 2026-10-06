import { renderRecordBody } from '../render/record-renderer.js';
import { analyzeBindings } from './binding-utils.js';
import { artifactActionsFromBindings } from './action-protocol.js';
import { renderDocument } from '../render/document.js';
import type { UiSchema } from '../schemas/generated.js';
import type { CodegenOptions, CodegenResult } from './types.js';

export function emit(schema: UiSchema, options: CodegenOptions): CodegenResult {
  const warnings: CodegenResult['warnings'] = [];

  try {
    const screenHtml = renderRecordBody(schema, options);
    const scoped = options.theme !== undefined || options.brand !== undefined;
    const html = renderDocument({
      screenHtml,
      schema,
      title: options.documentTitle,
      ...(scoped ? {
        theme: options.theme,
        brand: options.brand ?? 'A',
        // renderDocument already emits the default component CSS exactly once.
        componentCss: `${options.documentCss ?? ''}\n:root { color-scheme: ${options.theme === 'hc' ? 'normal' : options.theme ?? (schema.theme === 'dark' ? 'dark' : 'light')}; }`,
      } : {}),
    });

    return {
      status: 'ok',
      framework: 'html',
      code: html,
      fileExtension: '.html',
      imports: [],
      actions: artifactActionsFromBindings(analyzeBindings(schema.screens)),
      warnings,
    };
  } catch (error) {
    return {
      status: 'error',
      framework: 'html',
      code: '',
      fileExtension: '.html',
      imports: [],
      warnings,
      errors: [
        {
          code: 'OODS-S006',
          message: `HTML rendering failed: ${(error as Error).message}`,
        },
      ],
    };
  }
}
