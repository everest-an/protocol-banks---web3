-- Migration 033: Make audit_logs immutable
-- Prevents modification or deletion of audit log records
-- Created: 2025-01-25

-- ============================================================
-- 1. Revoke UPDATE and DELETE from non-admin roles
-- ============================================================
REVOKE UPDATE, DELETE ON audit_logs FROM authenticated;
REVOKE UPDATE, DELETE ON audit_logs FROM anon;

-- ============================================================
-- 2. Create policies that deny UPDATE and DELETE
-- ============================================================
DROP POLICY IF EXISTS "audit_logs_no_delete" ON audit_logs;
CREATE POLICY "audit_logs_no_delete" ON audit_logs
  FOR DELETE
  USING (false);

DROP POLICY IF EXISTS "audit_logs_no_update" ON audit_logs;
CREATE POLICY "audit_logs_no_update" ON audit_logs
  FOR UPDATE
  USING (false);

-- ============================================================
-- 3. Add triggers as defense-in-depth
-- ============================================================
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable and cannot be modified or deleted';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_audit_delete ON audit_logs;
CREATE TRIGGER prevent_audit_delete
  BEFORE DELETE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_modification();

DROP TRIGGER IF EXISTS prevent_audit_update ON audit_logs;
CREATE TRIGGER prevent_audit_update
  BEFORE UPDATE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_modification();

-- ============================================================
-- 4. Verify
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE 'Migration 033: Audit logs are now immutable (no UPDATE/DELETE)';
END $$;
