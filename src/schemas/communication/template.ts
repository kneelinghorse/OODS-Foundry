import { z, ZodIssueCode } from 'zod';

import {
  channelTypeSchema,
  extractTemplatePlaceholders,
  identifierSchema,
  localeSchema,
  metadataSchema,
} from './common.js';

const variableNameSchema = z
  .string()
  .regex(/^[a-z][a-z0-9._]*$/iu, 'Variables must use dot notation (example: user.name).');

export const templateSchema = z
  .object({
    id: identifierSchema,
    name: z.string().min(2).max(120),
    channel_type: channelTypeSchema,
    subject: z.string().min(1).max(240),
    body: z.string().min(1),
    variables: z.array(variableNameSchema).max(64).default([]),
    locale: localeSchema.default('en-US'),
    metadata: metadataSchema,
    description: z.string().max(512).optional(),
  })
  .superRefine((value, ctx) => {
    const placeholders = extractTemplatePlaceholders(value.body);
    const declared = new Set(value.variables);

    const missing = placeholders.filter((placeholder) => !declared.has(placeholder));
    if (missing.length > 0) {
      ctx.addIssue({
        code: ZodIssueCode.custom,
        message: `Template body references undeclared variables: ${missing.join(', ')}`,
        path: ['body'],
      });
    }

    const unused = value.variables.filter((variable) => !placeholders.includes(variable));
    if (unused.length > 0) {
      ctx.addIssue({
        code: ZodIssueCode.custom,
        message: `Declared variables missing from body: ${unused.join(', ')}`,
        path: ['variables'],
      });
    }

    const duplicates = value.variables.filter((variable, index, array) => array.indexOf(variable) !== index);
    if (duplicates.length > 0) {
      ctx.addIssue({
        code: ZodIssueCode.custom,
        message: `Duplicate variable declarations: ${[...new Set(duplicates)].join(', ')}`,
        path: ['variables'],
      });
    }
  });

export type Template = z.infer<typeof templateSchema>;

export function parseTemplate(data: unknown): Template {
  return templateSchema.parse(data);
}
