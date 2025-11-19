import { z } from 'zod';

/**
 * Role hierarchy edges follow the adjacency-list model ratified in R21.2 Part 3.1.
 * Each record represents a parent→child inheritance relationship where parents
 * bubble permissions to children.
 */
const UuidSchema = z
  .string()
  .uuid('Role hierarchy references must be valid UUID strings.');

export const RoleHierarchySchema = z
  .object({
    parent_role_id: UuidSchema,
    child_role_id: UuidSchema,
    depth: z
      .number()
      .int()
      .min(1, 'depth must be a positive integer representing traversal cost.')
      .optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.parent_role_id === value.child_role_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'parent_role_id and child_role_id must be different to prevent self-reference.',
        path: ['child_role_id'],
      });
    }
  });

export type RoleHierarchyEdge = z.infer<typeof RoleHierarchySchema>;
export type RoleHierarchyInput = z.input<typeof RoleHierarchySchema>;

export function normalizeRoleHierarchyEdge(input: RoleHierarchyInput): RoleHierarchyEdge {
  return RoleHierarchySchema.parse(input);
}
