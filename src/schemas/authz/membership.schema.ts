import { z } from 'zod';

import TimeService from '@/services/time/index.js';

/**
 * Membership is the canonical integration point described in R21.2 Part 2.2 and
 * TABLE 4. Each record binds a member to an organization + role triple, enabling
 * tenant-aware RBAC. The UNIQUE(member, organization_id, role_id) constraint is
 * documented here even though enforcement occurs at the persistence layer.
 *
 * s244-m01 (#2829): the member is a user (user_id) or any other actor (actor_id with
 * actor_kind, such as an agent), exactly one of the two. A membership written before
 * names a user and validates as it always has.
 */
const UuidSchema = z
  .string()
  .uuid('Membership identifiers must be valid UUID strings.');

const TimestampSchema = z
  .string()
  .datetime({ offset: true, message: 'Timestamps must be ISO 8601 strings with timezone offsets.' });

export const ActorKindSchema = z.enum(['person', 'agent', 'system']);
export type ActorKind = z.infer<typeof ActorKindSchema>;

export const MembershipSchema = z
  .object({
    id: UuidSchema,
    user_id: UuidSchema.optional(),
    actor_id: UuidSchema.optional(),
    actor_kind: ActorKindSchema.optional(),
    organization_id: UuidSchema,
    role_id: UuidSchema,
    created_at: TimestampSchema,
    updated_at: TimestampSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    if ((value.user_id === undefined) === (value.actor_id === undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A membership names its member with exactly one of user_id or actor_id.',
        path: [value.user_id === undefined ? 'user_id' : 'actor_id'],
      });
    }
    if (value.actor_id !== undefined && value.actor_kind === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'actor_kind (person, agent or system) is required with actor_id.',
        path: ['actor_kind'],
      });
    }
    if (value.actor_id === undefined && value.actor_kind !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'actor_kind says what an actor_id is; a user membership has none.',
        path: ['actor_kind'],
      });
    }
    if (value.updated_at < value.created_at) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'updated_at must be greater than or equal to created_at.',
        path: ['updated_at'],
      });
    }
  });

type MembershipFields = Omit<z.infer<typeof MembershipSchema>, 'user_id' | 'actor_id' | 'actor_kind'>;
/** A user's membership, or an actor's: the schema refuses both, neither, and an actor_id without its kind. */
export type MembershipMember =
  | { user_id: string; actor_id?: never; actor_kind?: never }
  | { actor_id: string; actor_kind: ActorKind; user_id?: never };
export type MembershipDocument = MembershipFields & MembershipMember;
export type MembershipInput = Omit<MembershipFields, 'id' | 'created_at' | 'updated_at'> &
  Partial<Pick<MembershipFields, 'id' | 'created_at' | 'updated_at'>> &
  MembershipMember;

/** Validate a membership and type it as the user's or the actor's it is. */
export function parseMembership(value: unknown): MembershipDocument {
  return MembershipSchema.parse(value) as MembershipDocument;
}

/** The member's id: the user's, or the actor's. Memberships are unique per member, organization and role. */
export function membershipMemberId(membership: MembershipMember): string {
  return membership.user_id ?? membership.actor_id;
}

export interface NormalizeMembershipOptions {
  readonly clock?: () => string;
  readonly generateId?: () => string;
}

export function normalizeMembership(
  input: MembershipInput,
  options: NormalizeMembershipOptions = {}
): MembershipDocument {
  const now = options.clock?.() ?? TimeService.toIsoString(TimeService.nowSystem());
  const member: Record<string, unknown> = input;
  const payload = {
    id: input.id ?? options.generateId?.(),
    // A user's membership carries user_id, as it always has; an actor's carries actor_id and actor_kind.
    ...(member.user_id !== undefined ? { user_id: member.user_id } : {}),
    ...(member.actor_id !== undefined ? { actor_id: member.actor_id } : {}),
    ...(member.actor_kind !== undefined ? { actor_kind: member.actor_kind } : {}),
    organization_id: input.organization_id,
    role_id: input.role_id,
    created_at: input.created_at ?? now,
    updated_at: input.updated_at ?? now,
  };

  if (!payload.id) {
    throw new Error('Membership identifier is required. Provide id or a generateId helper.');
  }

  return parseMembership(payload);
}
