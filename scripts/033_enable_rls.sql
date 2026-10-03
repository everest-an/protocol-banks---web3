-- Enable real row-level security for the application database.
--
-- The app connects as `prisma_migration`, a restricted superuser that bypasses
-- every policy. Enforcement therefore works by *role switching*: for each
-- user-context request the scoped Prisma layer (lib/rls/scoped-prisma.ts) runs
--
--     SET LOCAL ROLE prisma_application;
--     SELECT set_config('app.wallet', <caller>, true);
--
-- inside a transaction, then the policies below match each table's owner column
-- against `current_setting('app.wallet', true)`. `prisma_application` is the
-- platform-provided non-superuser role (pre-granted DML on every table).
--
-- Comparison is case-insensitive because stored addresses are checksummed while
-- the context wallet is lower-cased.
--
-- Applying policies is safe while RLS_MODE is not `enforce`: the superuser
-- connection bypasses them, so behaviour is unchanged until code runs through
-- the scoped path.
--
-- NOTE (phase 1): this file currently carries the verified seed policy. The
-- remaining user-scoped tables follow the same shape and are added per table
-- group; see the inventory in the RLS rollout notes.

-- vendors — verified end to end: owner sees own rows, stranger sees none.
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_vendors ON vendors;
CREATE POLICY rls_vendors ON vendors
  USING (lower(owner_address) = lower(current_setting('app.wallet', true)));
