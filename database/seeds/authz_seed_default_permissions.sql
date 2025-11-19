-- Sprint 28 · Mission B28.2 — Default RBAC permissions grouped by resource
-- Format enforces 'resource:action' naming (see migration 003 check constraint).

INSERT INTO authz.permissions (name, description, resource_type)
VALUES
  ('user:create', 'Create tenant-scoped users', 'user'),
  ('user:read', 'View tenant-scoped user profile data', 'user'),
  ('user:update', 'Update tenant-scoped user attributes', 'user'),
  ('user:delete', 'Remove tenant-scoped users', 'user'),
  ('document:create', 'Create documents owned by tenant', 'document'),
  ('document:read', 'Read documents owned by tenant', 'document'),
  ('document:update', 'Modify documents owned by tenant', 'document'),
  ('document:delete', 'Delete documents owned by tenant', 'document'),
  ('org:view', 'View organization level metadata', 'organization'),
  ('org:update', 'Update organization metadata/settings', 'organization'),
  ('org:configure', 'Manage advanced organization controls', 'organization'),
  ('org:invite', 'Invite members into organization', 'organization')
ON CONFLICT (name) DO NOTHING;
