-- Migration: Polymorphic Account + Metadata Policy
-- 
-- Migrates legacy billing_accounts to polymorphic accounts schema
-- with PII extracted to contacts table.
--
-- Run: psql -f database/migrations/20251025_migrate_billing_accounts_to_polymorphic.sql

BEGIN;

-- ============================================================================
-- 1. Create new tables
-- ============================================================================

-- Accounts table (polymorphic: person, organization, workspace)
CREATE TABLE IF NOT EXISTS accounts (
  account_id VARCHAR(64) PRIMARY KEY,
  account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('person', 'organization', 'workspace')),
  display_name VARCHAR(255) NOT NULL,
  account_key VARCHAR(64) UNIQUE,
  
  -- Person-specific fields
  contact_id VARCHAR(64),
  locale VARCHAR(10),
  timezone VARCHAR(64),
  verified BOOLEAN DEFAULT FALSE,
  
  -- Organization-specific fields
  legal_name VARCHAR(255),
  tax_id VARCHAR(64),
  industry VARCHAR(100),
  employee_count_range VARCHAR(20),
  annual_revenue_range VARCHAR(50),
  billing_contact_id VARCHAR(64),
  account_owner_id VARCHAR(64),
  
  -- Workspace-specific fields
  parent_account_id VARCHAR(64),
  slug VARCHAR(100),
  visibility VARCHAR(20) CHECK (visibility IN ('private', 'team', 'organization')),
  owner_id VARCHAR(64),
  member_count INTEGER DEFAULT 0,
  
  -- Common fields
  health_score INTEGER CHECK (health_score >= 0 AND health_score <= 100),
  risk_segment VARCHAR(20) CHECK (risk_segment IN ('growth', 'stable', 'at_risk', 'churned')),
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  payment_method VARCHAR(20) CHECK (payment_method IN ('card', 'ach', 'wire', 'invoice')),
  tenant_id VARCHAR(64),
  
  -- Safe metadata (NO PII, validated JSON)
  metadata JSONB,
  
  -- Temporal fields
  business_time TIMESTAMPTZ NOT NULL,
  system_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT fk_contact FOREIGN KEY (contact_id) REFERENCES contacts(contact_id),
  CONSTRAINT fk_billing_contact FOREIGN KEY (billing_contact_id) REFERENCES contacts(contact_id),
  CONSTRAINT fk_parent_account FOREIGN KEY (parent_account_id) REFERENCES accounts(account_id)
);

CREATE INDEX idx_accounts_type ON accounts(account_type);
CREATE INDEX idx_accounts_tenant ON accounts(tenant_id);
CREATE INDEX idx_accounts_parent ON accounts(parent_account_id);


-- Contacts table (PII with retention policy)
CREATE TABLE IF NOT EXISTS contacts (
  contact_id VARCHAR(64) PRIMARY KEY,
  account_id VARCHAR(64),
  
  -- PII fields
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  address_street VARCHAR(255),
  address_city VARCHAR(100),
  address_state VARCHAR(100),
  address_postal_code VARCHAR(20),
  address_country VARCHAR(3),
  title VARCHAR(100),
  
  contact_type VARCHAR(20) NOT NULL CHECK (contact_type IN ('primary', 'billing', 'technical', 'legal')),
  
  -- Retention/erasure
  retention_policy_id VARCHAR(64) NOT NULL,
  erasure_requested_at TIMESTAMPTZ,
  erased_at TIMESTAMPTZ,
  
  -- Temporal fields
  business_time TIMESTAMPTZ NOT NULL,
  system_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT fk_contact_account FOREIGN KEY (account_id) REFERENCES accounts(account_id)
);

CREATE INDEX idx_contacts_account ON contacts(account_id);
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_erasure ON contacts(erasure_requested_at) WHERE erasure_requested_at IS NOT NULL;


-- Account memberships (User ↔ Account mapping via RBAC)
CREATE TABLE IF NOT EXISTS account_memberships (
  membership_id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  account_id VARCHAR(64) NOT NULL,
  account_type VARCHAR(20) NOT NULL,
  role_id VARCHAR(64) NOT NULL,
  state VARCHAR(20) NOT NULL CHECK (state IN ('invited', 'active', 'suspended', 'revoked')),
  
  joined_at TIMESTAMPTZ NOT NULL,
  invited_by VARCHAR(64),
  
  business_time TIMESTAMPTZ NOT NULL,
  system_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT fk_membership_account FOREIGN KEY (account_id) REFERENCES accounts(account_id),
  CONSTRAINT fk_membership_role FOREIGN KEY (role_id) REFERENCES roles(id),
  UNIQUE (user_id, account_id)
);

CREATE INDEX idx_memberships_user ON account_memberships(user_id);
CREATE INDEX idx_memberships_account ON account_memberships(account_id);
CREATE INDEX idx_memberships_state ON account_memberships(state);


-- ============================================================================
-- 2. Migrate legacy billing_accounts to new schema
-- ============================================================================

-- 2a. Extract contacts from billing_accounts
INSERT INTO contacts (
  contact_id,
  account_id,
  full_name,
  email,
  phone,
  title,
  contact_type,
  retention_policy_id,
  business_time,
  system_time
)
SELECT
  'contact_' || billing_accounts.account_id AS contact_id,
  'acc_org_' || billing_accounts.account_id AS account_id,
  COALESCE(billing_accounts.billing_contact->>'name', 'Unknown') AS full_name,
  COALESCE(billing_accounts.account_owner_email, billing_accounts.billing_contact->>'email', 'unknown@migration.local') AS email,
  NULL AS phone,
  billing_accounts.billing_contact->>'title' AS title,
  'billing' AS contact_type,
  'policy_gdpr_2y' AS retention_policy_id,
  billing_accounts.business_time AS business_time,
  billing_accounts.system_time AS system_time
FROM billing_accounts
WHERE billing_accounts.billing_contact IS NOT NULL
ON CONFLICT (contact_id) DO NOTHING;

-- 2b. Migrate billing_accounts as organizations (B2B default assumption)
INSERT INTO accounts (
  account_id,
  account_type,
  display_name,
  account_key,
  legal_name,
  billing_contact_id,
  account_owner_id,
  health_score,
  risk_segment,
  currency,
  payment_method,
  tenant_id,
  metadata,
  business_time,
  system_time
)
SELECT
  'acc_org_' || billing_accounts.account_id AS account_id,
  'organization' AS account_type,
  billing_accounts.account_name AS display_name,
  billing_accounts.account_key AS account_key,
  billing_accounts.account_name AS legal_name,
  'contact_' || billing_accounts.account_id AS billing_contact_id,
  NULL AS account_owner_id, -- Populate from user lookup if available
  billing_accounts.health_score AS health_score,
  billing_accounts.risk_segment AS risk_segment,
  billing_accounts.currency AS currency,
  billing_accounts.payment_method AS payment_method,
  billing_accounts.tenant_id AS tenant_id,
  -- Sanitize metadata: extract allowed keys only
  jsonb_strip_nulls(
    jsonb_build_object(
      'procurementNotes', billing_accounts.notes
    )
  ) AS metadata,
  billing_accounts.business_time AS business_time,
  billing_accounts.system_time AS system_time
FROM billing_accounts
ON CONFLICT (account_id) DO NOTHING;

-- 2c. Extract PII from legacy metadata (if any exists)
-- This is a manual review step; log records with potential PII
CREATE TEMP TABLE metadata_review AS
SELECT
  account_id,
  metadata,
  metadata::text ~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' AS has_email,
  metadata::text ~ '\d{3}[-.]?\d{3}[-.]?\d{4}' AS has_phone
FROM billing_accounts
WHERE metadata IS NOT NULL;

-- Export for manual review
COPY metadata_review TO '/tmp/billing_accounts_metadata_review.csv' CSV HEADER;


-- ============================================================================
-- 3. Update foreign keys in subscriptions/invoices
-- ============================================================================

-- Update subscriptions to reference new account_id format
ALTER TABLE subscriptions 
  ADD COLUMN new_account_id VARCHAR(64);

UPDATE subscriptions
SET new_account_id = 'acc_org_' || account_id;

-- After verification, swap columns:
-- ALTER TABLE subscriptions DROP COLUMN account_id;
-- ALTER TABLE subscriptions RENAME COLUMN new_account_id TO account_id;


-- ============================================================================
-- 4. Add validation constraints
-- ============================================================================

-- Ensure person accounts have contact_id
ALTER TABLE accounts
  ADD CONSTRAINT chk_person_contact 
  CHECK (
    (account_type != 'person') OR 
    (account_type = 'person' AND contact_id IS NOT NULL)
  );

-- Ensure organization accounts have legal_name
ALTER TABLE accounts
  ADD CONSTRAINT chk_org_legal_name
  CHECK (
    (account_type != 'organization') OR
    (account_type = 'organization' AND legal_name IS NOT NULL)
  );

-- Ensure workspace accounts have parent and slug
ALTER TABLE accounts
  ADD CONSTRAINT chk_workspace_parent_slug
  CHECK (
    (account_type != 'workspace') OR
    (account_type = 'workspace' AND parent_account_id IS NOT NULL AND slug IS NOT NULL)
  );


-- ============================================================================
-- 5. Grant permissions
-- ============================================================================

-- Grant to application role (adjust as needed)
GRANT SELECT, INSERT, UPDATE ON accounts TO app_role;
GRANT SELECT, INSERT, UPDATE ON contacts TO app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON account_memberships TO app_role;


COMMIT;

-- ============================================================================
-- Post-migration verification queries
-- ============================================================================

-- Count accounts by type
-- SELECT account_type, COUNT(*) FROM accounts GROUP BY account_type;

-- Find accounts with potential PII in metadata
-- SELECT account_id, metadata FROM accounts 
-- WHERE metadata::text ~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}';

-- Verify contact records
-- SELECT COUNT(*) FROM contacts WHERE contact_type = 'billing';

