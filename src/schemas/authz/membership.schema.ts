import { z } from 'zod';

import TimeService from '@/services/time/index.js';

/**
 * Membership is the canonical integration point described in R21.2 Part 2.2 and
 * TABLE 4. Each record binds a user to an organization + role triple, enabling
 * tenant-aware RBAC. The UNIQUE(user_id, organization_id, role_id) constraint is
 * documented here even though enforcement occurs at the persistence layer.
 */
const UuidSchema = z
  .string()
  .uuid('Membership identifiers must be valid UUID strings.');

const TimestampSchema = z
  .string()
  .datetime({ offset: true, message: 'Timestamps must be ISO 8601 strings with timezone offsets.' });

export const MembershipSchema = z
  .object({
    id: UuidSchema,
    user_id: UuidSchema,
    organization_id: UuidSchema,
    role_id: UuidSchema,
    created_at: TimestampSchema,
    updated_at: TimestampSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.updated_at < value.created_at) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'updated_at must be greater than or equal to created_at.',
        path: ['updated_at'],
      });
    }
  });

export type MembershipDocument = z.infer<typeof MembershipSchema>;
export type MembershipInput = Omit<MembershipDocument, 'id' | 'created_at' | 'updated_at'> &
  Partial<Pick<MembershipDocument, 'id' | 'created_at' | 'updated_at'>>;

export interface NormalizeMembershipOptions {
  readonly clock?: () => string;
  readonly generateId?: () => string;
}

export function normalizeMembership(
  input: MembershipInput,
  options: NormalizeMembershipOptions = {}
): MembershipDocument {
  const now = options.clock?.() ?? TimeService.toIsoString(TimeService.nowSystem());
  const payload: MembershipInput = {
    id: input.id ?? options.generateId?.(),
    user_id: input.user_id,
    organization_id: input.organization_id,
    role_id: input.role_id,
    created_at: input.created_at ?? now,
    updated_at: input.updated_at ?? now,
  };

  if (!payload.id) {
    throw new Error('Membership identifier is required. Provide id or a generateId helper.');
  }

  return MembershipSchema.parse(payload);
}
