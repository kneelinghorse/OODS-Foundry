/**
 * s244-m01 (#2829): an agent is an actor, not a user, and it can hold a role. Authable's membership names its member
 * with exactly one of user_id or actor_id (with actor_kind). Platforms that made their agents users did so because a
 * role could point only at a user; here a role can point at any actor, and every membership written before (a user's)
 * still validates in the registry, the generated type's source schema and the legacy schema.
 */
import { describe, expect, it } from 'vitest';

import registryDocument from '~/data/authz-schemas/registry.json';
import { MembershipSchema, membershipMemberId, normalizeMembership } from '@/schemas/authz/membership.schema.ts';
import { schemaRegistry } from '@/traits/authz/schema-registry.ts';
import { AuthableTrait } from '@/traits/authz/authz-trait.ts';
import { AUTHZ_SAMPLE_DATASET } from '@/data/authz/sample-entitlements.ts';

const ids = {
  membership: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  user: '123e4567-e89b-12d3-a456-426614174000',
  agent: '6a1e2b3c-4d5e-4f60-8a7b-9c0d1e2f3a01',
  organization: '789e0123-e45b-47c8-b901-234567890abc',
  role: '550e8400-e29b-41d4-a716-446655440000',
};
const at = { created_at: '2026-11-07T00:00:00Z', updated_at: '2026-11-07T00:00:00Z' };
const userMembership = { id: ids.membership, user_id: ids.user, organization_id: ids.organization, role_id: ids.role, ...at };
const agentMembership = { id: ids.membership, actor_id: ids.agent, actor_kind: 'agent', organization_id: ids.organization, role_id: ids.role, ...at };

const registryValid = (value: unknown) => schemaRegistry.validateSchema(value, 'membership').success;
const legacyValid = (value: unknown) => MembershipSchema.safeParse(value).success;

describe('a membership for any actor', () => {
  it("validates an agent's membership in the registry and the legacy schema", () => {
    expect(registryValid(agentMembership)).toBe(true);
    expect(legacyValid(agentMembership)).toBe(true);
    for (const kind of ['person', 'agent', 'system']) expect(registryValid({ ...agentMembership, actor_kind: kind }), kind).toBe(true);
  });

  it('still validates every membership that validated before: the registry example, the sample dataset and a plain user', () => {
    const example = (registryDocument.schemas.find((entry) => entry.id === 'membership') as { example: unknown }).example;
    for (const membership of [example, userMembership, ...AUTHZ_SAMPLE_DATASET.memberships]) {
      expect(registryValid(membership), JSON.stringify(membership)).toBe(true);
    }
    // The registry's example uses ids that are not RFC UUIDs, which zod 4's uuid() refused in 0.11.3 too; the legacy
    // schema is held to every membership it accepted before.
    for (const membership of [userMembership, ...AUTHZ_SAMPLE_DATASET.memberships]) {
      expect(legacyValid(membership), JSON.stringify(membership)).toBe(true);
    }
  });

  it('names its member with exactly one of user_id or actor_id, and an actor with its kind', () => {
    const refused = [
      { name: 'both', value: { ...userMembership, actor_id: ids.agent, actor_kind: 'agent' } },
      { name: 'neither', value: { id: ids.membership, organization_id: ids.organization, role_id: ids.role, ...at } },
      { name: 'an actor without its kind', value: { ...agentMembership, actor_kind: undefined } },
      { name: 'a user with an actor kind', value: { ...userMembership, actor_kind: 'person' } },
      { name: 'an unknown kind', value: { ...agentMembership, actor_kind: 'robot' } },
      { name: 'a non-uuid actor', value: { ...agentMembership, actor_id: 'billing-agent' } },
    ];
    for (const { name, value } of refused) {
      const clean = JSON.parse(JSON.stringify(value));
      expect(registryValid(clean), name).toBe(false);
      expect(legacyValid(clean), name).toBe(false);
    }
  });

  it('keys the UNIQUE triple by the member, so an agent holds a role beside a user without either replacing the other', () => {
    const trait = new AuthableTrait({ roleCatalog: [{ id: ids.role, name: 'Approver' }] }, { clock: () => at.created_at });
    const user = trait.assignMembership({ user_id: ids.user, organization_id: ids.organization, role_id: ids.role });
    const agent = trait.assignMembership({ actor_id: ids.agent, actor_kind: 'agent', organization_id: ids.organization, role_id: ids.role });
    expect(membershipMemberId(user)).toBe(ids.user);
    expect(membershipMemberId(agent)).toBe(ids.agent);
    expect(agent.actor_kind).toBe('agent');
    expect(trait.getMembershipsForUser(ids.user)).toHaveLength(1);
    // Assigning the same actor the same role again returns the one membership, as for a user.
    expect(trait.assignMembership({ actor_id: ids.agent, actor_kind: 'agent', organization_id: ids.organization, role_id: ids.role }).id).toBe(agent.id);
    expect(normalizeMembership({ ...agentMembership, actor_kind: 'agent' })).toMatchObject({ actor_id: ids.agent, actor_kind: 'agent' });
  });
});
