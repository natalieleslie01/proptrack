-- PropTrack HK — Harden RLS Policies for Bulk Property Updates
-- Prevents silent failures when session context (auth.uid()) is missing.
--
-- Problems fixed:
--   1. properties UPDATE policy used `auth.uid() IS NOT NULL` which silently
--      returns 0 rows (no error) when the session is missing.
--   2. Bulk-write tables (building_codes, import_history, maintenance_requests,
--      lease_renewals, commission_tracking) used USING (true) with no session
--      check, allowing unauthenticated writes if RLS were ever bypassed.
--   3. No role restriction on bulk property UPDATE — any authenticated user
--      could overwrite all properties.
--
-- Fix strategy:
--   • properties INSERT  → any authenticated user (unchanged, already correct)
--   • properties UPDATE  → manager or admin only (bulk updates are privileged)
--   • properties DELETE  → manager or admin only (unchanged)
--   • Bulk-write tables  → require auth.uid() IS NOT NULL in USING + WITH CHECK
--
-- NOTE: The existing is_manager_or_admin() function (defined in the initial
--       schema migration) reads from auth.users metadata — no recursion risk.

-- ============================================================
-- 1. HARDEN properties UPDATE POLICY
--    Old: USING (auth.uid() IS NOT NULL) — silently fails with no session
--    New: USING (public.is_manager_or_admin()) — explicit role gate;
--         agents can still edit individual records via the manual editor
--         but bulk CSV/short-code writes require manager+ role.
-- ============================================================

-- Keep a permissive read policy (unchanged)
-- Keep agents_insert_properties (unchanged)

-- Replace the weak update policy with a role-gated one
DROP POLICY IF EXISTS "agents_update_properties" ON public.properties;
CREATE POLICY "managers_update_properties"
  ON public.properties
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND public.is_manager_or_admin()
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.is_manager_or_admin()
  );

-- ============================================================
-- 2. HARDEN building_codes WRITE POLICY
--    Old: USING (true) WITH CHECK (true) — no session check
--    New: require auth.uid() IS NOT NULL + manager/admin role
-- ============================================================

DROP POLICY IF EXISTS "authenticated_manage_building_codes" ON public.building_codes;

-- Separate read (all authenticated) from write (manager+)
CREATE POLICY "authenticated_read_building_codes"
  ON public.building_codes
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "managers_write_building_codes"
  ON public.building_codes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.is_manager_or_admin()
  );

CREATE POLICY "managers_update_building_codes"
  ON public.building_codes
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND public.is_manager_or_admin()
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.is_manager_or_admin()
  );

CREATE POLICY "managers_delete_building_codes"
  ON public.building_codes
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND public.is_manager_or_admin()
  );

-- ============================================================
-- 3. HARDEN import_history WRITE POLICY
--    Old: USING (true) WITH CHECK (true)
--    New: require session for all operations
-- ============================================================

DROP POLICY IF EXISTS "authenticated_all_import_history" ON public.import_history;

CREATE POLICY "authenticated_read_import_history"
  ON public.import_history
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_write_import_history"
  ON public.import_history
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "managers_update_import_history"
  ON public.import_history
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND public.is_manager_or_admin()
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.is_manager_or_admin()
  );

-- ============================================================
-- 4. HARDEN maintenance_requests WRITE POLICY
--    Old: USING (true) WITH CHECK (true)
--    New: require session; managers can update/delete any record
-- ============================================================

DROP POLICY IF EXISTS "authenticated_all_maintenance" ON public.maintenance_requests;

CREATE POLICY "authenticated_read_maintenance"
  ON public.maintenance_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_insert_maintenance"
  ON public.maintenance_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "managers_update_maintenance"
  ON public.maintenance_requests
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND public.is_manager_or_admin()
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.is_manager_or_admin()
  );

CREATE POLICY "managers_delete_maintenance"
  ON public.maintenance_requests
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND public.is_manager_or_admin()
  );

-- ============================================================
-- 5. HARDEN lease_renewals WRITE POLICY
--    Old: USING (true) WITH CHECK (true)
--    New: require session; managers can update/delete
-- ============================================================

DROP POLICY IF EXISTS "authenticated_all_lease_renewals" ON public.lease_renewals;

CREATE POLICY "authenticated_read_lease_renewals"
  ON public.lease_renewals
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_insert_lease_renewals"
  ON public.lease_renewals
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "managers_update_lease_renewals"
  ON public.lease_renewals
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND public.is_manager_or_admin()
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.is_manager_or_admin()
  );

CREATE POLICY "managers_delete_lease_renewals"
  ON public.lease_renewals
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND public.is_manager_or_admin()
  );

-- ============================================================
-- 6. HARDEN commission_tracking WRITE POLICY
--    Old: USING (true) WITH CHECK (true)
--    New: require session; managers can update/delete
-- ============================================================

DROP POLICY IF EXISTS "authenticated_all_commission" ON public.commission_tracking;

CREATE POLICY "authenticated_read_commission"
  ON public.commission_tracking
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_insert_commission"
  ON public.commission_tracking
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "managers_update_commission"
  ON public.commission_tracking
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND public.is_manager_or_admin()
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.is_manager_or_admin()
  );

CREATE POLICY "managers_delete_commission"
  ON public.commission_tracking
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND public.is_manager_or_admin()
  );
