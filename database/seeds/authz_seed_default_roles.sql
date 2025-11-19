-- Sprint 28 · Mission B28.2 — Default RBAC roles (Admin, Editor, Viewer)
-- Idempotent inserts to simplify bootstrap + automated tests.

INSERT INTO authz.roles (name, description)
VALUES
  ('Admin', 'Full-access tenant administrator (global per R21.2).'),
  ('Editor', 'Creates and updates entities for a tenant, no destructive actions.'),
  ('Viewer', 'Read-only consumer across resources with SoD-safe scope.')
ON CONFLICT (name) DO NOTHING;
