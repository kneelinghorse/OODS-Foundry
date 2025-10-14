import type { ObjectSpec } from '../../types/render-context.js';
import { createStatefulTraitAdapter } from '../../traits/Stateful/view.js';
import { createTimestampableTraitAdapter } from '../../traits/Timestampable/view.js';
import { createTaggableTraitAdapter } from '../../traits/Taggable/view.js';
import type { UserRecord } from './types.js';

export interface CreateUserObjectOptions {
  readonly includeTaggable?: boolean;
  readonly id?: string;
  readonly name?: string;
  readonly version?: string;
}

export type UserObjectSpec = ObjectSpec<UserRecord>;

export function createUserObjectSpec(options: CreateUserObjectOptions = {}): UserObjectSpec {
  const {
    includeTaggable = true,
    id = 'object:User',
    name = 'User',
    version = '1.1.0',
  } = options;

  const traits = [
    createStatefulTraitAdapter<UserRecord>(),
    createTimestampableTraitAdapter<UserRecord>(),
  ];

  if (includeTaggable) {
    traits.push(createTaggableTraitAdapter<UserRecord>());
  }

  return {
    id,
    name,
    version,
    traits,
    metadata: {
      category: 'identity',
      status: 'stable',
    },
  };
}

export const UserObject = Object.freeze(createUserObjectSpec());
