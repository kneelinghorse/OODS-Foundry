-- Migration: Add dual-time columns to billing and compliance tables
-- Version: 1.0.0
-- Date: 2025-10-25
-- Sprint: 17
-- Mission: B17.6 - Temporal Hygiene

-- ============================================================================
-- SUBSCRIPTIONS
-- ============================================================================

-- Add dual-time columns to subscriptions table
ALTER TABLE IF EXISTS subscriptions
  ADD COLUMN IF NOT EXISTS business_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS system_time TIMESTAMPTZ;

-- Set default values for existing rows
UPDATE subscriptions
SET 
  business_time = COALESCE(business_time, created_at),
  system_time = COALESCE(system_time, created_at)
WHERE business_time IS NULL OR system_time IS NULL;

-- Make columns NOT NULL after backfill
ALTER TABLE IF EXISTS subscriptions
  ALTER COLUMN business_time SET NOT NULL,
  ALTER COLUMN system_time SET NOT NULL;

-- Add index for business time queries
CREATE INDEX IF NOT EXISTS idx_subscriptions_business_time 
  ON subscriptions(business_time);

COMMENT ON COLUMN subscriptions.business_time IS 
  'Meaningful moment from tenant perspective (renewals, SLAs). Timezone-aware.';
COMMENT ON COLUMN subscriptions.system_time IS 
  'Immutable system recording time (UTC). Used for audit and ordering.';


-- ============================================================================
-- INVOICES
-- ============================================================================

ALTER TABLE IF EXISTS invoices
  ADD COLUMN IF NOT EXISTS business_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS system_time TIMESTAMPTZ;

-- Backfill: business_time = due_date if available, else created_at
UPDATE invoices
SET 
  business_time = COALESCE(business_time, due_date, created_at),
  system_time = COALESCE(system_time, created_at)
WHERE business_time IS NULL OR system_time IS NULL;

ALTER TABLE IF EXISTS invoices
  ALTER COLUMN business_time SET NOT NULL,
  ALTER COLUMN system_time SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_business_time 
  ON invoices(business_time);

COMMENT ON COLUMN invoices.business_time IS 
  'Invoice due date in tenant timezone. Used for aging reports.';
COMMENT ON COLUMN invoices.system_time IS 
  'System record time (UTC). Immutable for audit.';


-- ============================================================================
-- AUDIT LOG
-- ============================================================================

ALTER TABLE IF EXISTS audit_log
  ADD COLUMN IF NOT EXISTS business_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS system_time TIMESTAMPTZ;

-- Audit log: system_time is primary; business_time derived from tenant context
UPDATE audit_log
SET 
  business_time = COALESCE(business_time, timestamp),
  system_time = COALESCE(system_time, timestamp)
WHERE business_time IS NULL OR system_time IS NULL;

ALTER TABLE IF EXISTS audit_log
  ALTER COLUMN business_time SET NOT NULL,
  ALTER COLUMN system_time SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_log_system_time 
  ON audit_log(system_time);

CREATE INDEX IF NOT EXISTS idx_audit_log_business_time 
  ON audit_log(business_time);

COMMENT ON COLUMN audit_log.business_time IS 
  'Event time in user/tenant timezone. For user-facing displays.';
COMMENT ON COLUMN audit_log.system_time IS 
  'Immutable system recording timestamp (UTC). Hash chain source.';


-- ============================================================================
-- USAGE SUMMARIES
-- ============================================================================

-- Create usage_summaries table if not exists (from B17.5)
CREATE TABLE IF NOT EXISTS usage_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  meter_unit VARCHAR(50) NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  total_quantity NUMERIC(18, 6) NOT NULL DEFAULT 0,
  aggregation_method VARCHAR(20) NOT NULL DEFAULT 'sum',
  business_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  system_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add dual-time columns if table already exists without them
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'usage_summaries' AND column_name = 'business_time'
  ) THEN
    ALTER TABLE usage_summaries ADD COLUMN business_time TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'usage_summaries' AND column_name = 'system_time'
  ) THEN
    ALTER TABLE usage_summaries ADD COLUMN system_time TIMESTAMPTZ;
  END IF;
END $$;

-- Backfill existing usage summaries
UPDATE usage_summaries
SET 
  business_time = COALESCE(business_time, period_end),
  system_time = COALESCE(system_time, created_at)
WHERE business_time IS NULL OR system_time IS NULL;

ALTER TABLE usage_summaries
  ALTER COLUMN business_time SET NOT NULL,
  ALTER COLUMN system_time SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_usage_summaries_business_time 
  ON usage_summaries(business_time);

CREATE INDEX IF NOT EXISTS idx_usage_summaries_period 
  ON usage_summaries(period_start, period_end);

COMMENT ON COLUMN usage_summaries.business_time IS 
  'End of billing period in tenant timezone. Used for invoicing.';
COMMENT ON COLUMN usage_summaries.system_time IS 
  'System aggregation completion time (UTC).';


-- ============================================================================
-- BILLING ACCOUNTS
-- ============================================================================

ALTER TABLE IF EXISTS billing_accounts
  ADD COLUMN IF NOT EXISTS business_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS system_time TIMESTAMPTZ;

UPDATE billing_accounts
SET 
  business_time = COALESCE(business_time, created_at),
  system_time = COALESCE(system_time, created_at)
WHERE business_time IS NULL OR system_time IS NULL;

ALTER TABLE IF EXISTS billing_accounts
  ALTER COLUMN business_time SET NOT NULL,
  ALTER COLUMN system_time SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_billing_accounts_business_time 
  ON billing_accounts(business_time);

COMMENT ON COLUMN billing_accounts.business_time IS 
  'Account creation time in tenant timezone.';
COMMENT ON COLUMN billing_accounts.system_time IS 
  'System record creation (UTC).';


-- ============================================================================
-- VALIDATION
-- ============================================================================

-- Verify no NULL values remain
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count
  FROM (
    SELECT id FROM subscriptions WHERE business_time IS NULL OR system_time IS NULL
    UNION ALL
    SELECT id FROM invoices WHERE business_time IS NULL OR system_time IS NULL
    UNION ALL
    SELECT id FROM audit_log WHERE business_time IS NULL OR system_time IS NULL
    UNION ALL
    SELECT id FROM usage_summaries WHERE business_time IS NULL OR system_time IS NULL
  ) AS null_checks;

  IF null_count > 0 THEN
    RAISE EXCEPTION 'Migration incomplete: % rows have NULL dual-time columns', null_count;
  END IF;

  RAISE NOTICE 'Dual-time migration completed successfully. All tables validated.';
END $$;

