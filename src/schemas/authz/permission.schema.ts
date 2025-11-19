import { z } from 'zod';

/**
 * Permission identifiers follow the canonical `resource:action` shape captured in
 * R21.2 Part 4.2 TABLE 2. Lowercase resource/action tokens simplify analytics
 * joins and match existing CLI ergonomics.
 */
export const PERMISSION_NAME_PATTERN = /^[a-z][a-z0-9._-]*:[a-z][a-z0-9._-]*$/;

const UuidSchema = z
  .string()
  .uuid('Permission identifiers must be valid RFC 4122 UUID strings.');

const ResourceTypePattern = /^[a-z0-9._-]+$/;

export const PermissionSchema = z
  .object({
    id: UuidSchema,
    name: z
      .string()
      .trim()
      .regex(PERMISSION_NAME_PATTERN, 'Permission name must follow resource:action format.')
      .min(5)
      .max(128),
    description: z
      .string()
      .trim()
      .max(512, 'Permission description cannot exceed 512 characters.')
      .optional(),
    resource_type: z
      .string()
      .trim()
      .regex(ResourceTypePattern, 'resource_type may only include lowercase alphanumeric characters plus ._-')
      .min(2)
      .max(64)
      .optional(),
  })
  .strict();

export type PermissionDocument = z.infer<typeof PermissionSchema>;
export type PermissionInput = z.input<typeof PermissionSchema>;

export function normalizePermission(input: PermissionInput): PermissionDocument {
  const payload: PermissionInput = {
    ...input,
    name: typeof input.name === 'string' ? input.name.trim() : input.name,
    description:
      typeof input.description === 'string' && input.description.trim().length > 0
        ? input.description.trim()
        : undefined,
    resource_type:
      typeof input.resource_type === 'string' && input.resource_type.trim().length > 0
        ? input.resource_type.trim()
        : undefined,
  };
  return PermissionSchema.parse(payload);
}
