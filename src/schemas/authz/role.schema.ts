import { z } from 'zod';

/**
 * Constraints derived from R21.2 Part 4.2 TABLE 1 where roles are globally unique
 * entries with plain-text identifiers. Role names remain human readable but must
 * avoid whitespace to keep join tables compact and composable.
 */
export const ROLE_NAME_PATTERN = /^[A-Za-z0-9_]{2,64}$/;

const UuidSchema = z
  .string()
  .uuid('Role identifiers must be valid RFC 4122 UUID strings.');

export const RoleSchema = z
  .object({
    id: UuidSchema,
    name: z
      .string()
      .trim()
      .min(2, 'Role name must contain at least 2 characters.')
      .max(64, 'Role name must be 64 characters or fewer.')
      .regex(ROLE_NAME_PATTERN, 'Role name may only include alphanumeric characters or underscores.'),
    description: z
      .string()
      .trim()
      .max(512, 'Role description cannot exceed 512 characters.')
      .optional(),
  })
  .strict();

export type RoleDocument = z.infer<typeof RoleSchema>;
export type RoleInput = z.input<typeof RoleSchema>;

export function normalizeRole(input: RoleInput): RoleDocument {
  const payload: RoleInput = {
    ...input,
    name: typeof input.name === 'string' ? input.name.trim() : input.name,
    description:
      typeof input.description === 'string' && input.description.trim().length > 0
        ? input.description.trim()
        : undefined,
  };
  return RoleSchema.parse(payload);
}
