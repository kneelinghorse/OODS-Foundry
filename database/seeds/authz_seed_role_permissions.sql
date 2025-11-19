-- Sprint 28 · Mission B28.2 — Seed RBAC role->permission relationships
-- Admin receives every permission. Editor excludes destructive operations.

WITH role_ids AS (
  SELECT id, name FROM authz.roles WHERE name IN ('Admin', 'Editor', 'Viewer')
),
permission_ids AS (
  SELECT id, name FROM authz.permissions
),
admin_map AS (
  SELECT 'Admin'::text AS role_name, name AS permission_name FROM authz.permissions
),
editor_map AS (
  SELECT * FROM (VALUES
    ('user:create'), ('user:read'), ('user:update'),
    ('document:create'), ('document:read'), ('document:update'),
    ('org:view'), ('org:update')
  ) AS editor_permissions(permission_name)
),
viewer_map AS (
  SELECT * FROM (VALUES
    ('user:read'),
    ('document:read'),
    ('org:view')
  ) AS viewer_permissions(permission_name)
),
target_map AS (
  SELECT 'Admin' AS role_name, permission_name FROM admin_map
  UNION ALL
  SELECT 'Editor', permission_name FROM editor_map
  UNION ALL
  SELECT 'Viewer', permission_name FROM viewer_map
)
INSERT INTO authz.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM target_map tm
JOIN role_ids r ON r.name = tm.role_name
JOIN permission_ids p ON p.name = tm.permission_name
ON CONFLICT DO NOTHING;
