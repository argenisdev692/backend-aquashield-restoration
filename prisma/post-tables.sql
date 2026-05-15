-- ============================================================
--  post-tables.sql — POST-`db push` SQL
--
--  Run AFTER `npx prisma db push` (which creates the tables):
--    npx prisma db execute --file prisma/post-tables.sql --schema prisma/schema
--
--  Idempotent: safe to run multiple times.
--
--  Contents:
--    1. BEFORE UPDATE triggers on every table with `updated_at` (writes NOW()).
--    2. Partial indexes Prisma cannot express natively.
-- ============================================================

-- ------------------------------------------------------------
--  Auto-`updated_at` triggers
-- ------------------------------------------------------------

DROP TRIGGER IF EXISTS set_updated_at_users            ON users;
DROP TRIGGER IF EXISTS set_updated_at_roles            ON roles;
DROP TRIGGER IF EXISTS set_updated_at_permissions      ON permissions;
DROP TRIGGER IF EXISTS set_updated_at_company_data     ON company_data;
DROP TRIGGER IF EXISTS set_updated_at_appointments     ON appointments;
DROP TRIGGER IF EXISTS set_updated_at_contact_supports ON contact_supports;
DROP TRIGGER IF EXISTS set_updated_at_auth_sessions    ON auth_sessions;

CREATE TRIGGER set_updated_at_users
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_roles
  BEFORE UPDATE ON roles
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_permissions
  BEFORE UPDATE ON permissions
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_company_data
  BEFORE UPDATE ON company_data
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_appointments
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_contact_supports
  BEFORE UPDATE ON contact_supports
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_auth_sessions
  BEFORE UPDATE ON auth_sessions
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ------------------------------------------------------------
--  Partial indexes (Prisma cannot express WHERE on @@index)
-- ------------------------------------------------------------

DROP INDEX IF EXISTS idx_otp_codes_type_expires;
CREATE INDEX idx_otp_codes_type_expires
  ON otp_codes (type, expires_at)
  WHERE used_at IS NULL;

DROP INDEX IF EXISTS idx_auth_sessions_revoked_at;
CREATE INDEX idx_auth_sessions_revoked_at
  ON auth_sessions (revoked_at)
  WHERE revoked_at IS NULL;
