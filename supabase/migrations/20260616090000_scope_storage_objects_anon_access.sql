-- ============================================================
-- SCOPE storage.objects anon SELECT to floor-plans bucket only
--
-- The previous migration (20260616080000) issued a blanket
-- GRANT SELECT ON storage.objects TO anon, which allows the
-- anon role to query ALL buckets via the REST API.
--
-- This migration:
--   1. Revokes the blanket grant.
--   2. Adds a scoped RLS policy on storage.objects so that
--      anon can SELECT only rows where bucket_id = 'floor-plans'.
--   3. Keeps the authenticated role's blanket grant intact
--      (internal app users still need full storage access).
--
-- NOTE: storage.objects already has RLS enabled by default in
-- Supabase-managed projects. We use DROP IF EXISTS + CREATE to
-- remain idempotent.
-- ============================================================

-- ============================================================
-- 1. REVOKE the blanket SELECT grant from anon
-- ============================================================
REVOKE SELECT ON storage.objects FROM anon;

-- ============================================================
-- 2. ADD a scoped RLS policy — anon may only SELECT rows
--    whose bucket_id is 'floor-plans'
-- ============================================================
DROP POLICY IF EXISTS "anon_select_floor_plans_only" ON storage.objects;

CREATE POLICY "anon_select_floor_plans_only"
ON storage.objects
FOR SELECT
TO anon
USING (bucket_id = 'floor-plans');

-- ============================================================
-- 3. The public_properties view subquery runs as the calling
--    role (anon) via PostgREST. With the RLS policy above,
--    the subquery can read floor-plans objects but cannot
--    list or query property_photos or any other bucket.
--
--    No changes to the view itself are required.
-- ============================================================
