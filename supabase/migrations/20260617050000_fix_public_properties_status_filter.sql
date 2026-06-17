-- ============================================================
-- FIX public_properties VIEW — Authoritative status filter + price requirements
--
-- PROBLEM SUMMARY
-- ===============
-- The previous view (20260617040000) only excluded 'self-occupy' and 'leased'
-- from the property_status ENUM.  However:
--
--   1. The property_status ENUM has NO 'sold' value:
--        'for-sale' | 'for-rent' | 'for-sale-and-rent' | 'self-occupy' | 'leased'
--
--   2. "Sold" is stored in the free-text `list_type` column (e.g. list_type = 'Sold',
--      'sold', 'SOLD').  This column is written once at CSV import time and is never
--      updated.  A property can have status = 'for-sale' (ENUM) while list_type = 'Sold'
--      — meaning it was sold after import but the ENUM was never updated.
--
--   3. Properties with no relevant price populated (asking_price NULL for a for-sale
--      listing, or asking_rent NULL for a for-rent listing) are incomplete and must
--      not appear publicly.
--
-- CHANGES IN THIS MIGRATION
-- =========================
-- 1. AUDIT: Emit RAISE NOTICE for every distinct value in both status (ENUM) and
--    list_type (TEXT) so the full picture is visible in migration logs.
--
-- 2. STATUS FILTER (authoritative): Keep existing ENUM exclusions and add the
--    whitelist approach — only allow rows where status is one of the three
--    active/available values: 'for-sale', 'for-rent', 'for-sale-and-rent'.
--    This is future-proof: any new ENUM value added later is excluded by default.
--
-- 3. LIST_TYPE FILTER (belt-and-suspenders): Also exclude rows where the raw
--    list_type TEXT column contains any sold/leased/inactive indicator, regardless
--    of what the ENUM says.  Covers: 'sold', 'leased', 'self occupy', 'self-occupy',
--    'no contact', 'no-contact', 'unknown', 'inactive', 'withdrawn', 'off market'.
--    Case-insensitive match via LOWER().
--
-- 4. PRICE REQUIREMENT: Require that the relevant price field is populated:
--      • listing_type resolves to 'for-sale'          → asking_price IS NOT NULL
--      • listing_type resolves to 'for-rent'          → asking_rent IS NOT NULL
--      • listing_type resolves to 'for-sale-and-rent' → asking_price IS NOT NULL
--                                                        AND asking_rent IS NOT NULL
--    Rows that fail this check are incomplete and excluded from public display.
--
-- 5. VERIFICATION: After recreating the view, emit counts and a zero-sold check
--    via RAISE NOTICE.
-- ============================================================

-- ============================================================
-- STEP 1: AUDIT — emit all distinct status and list_type values
-- ============================================================
DO $$
DECLARE
  rec RECORD;
  status_list TEXT := '';
  list_type_list TEXT := '';
BEGIN
  -- Distinct property_status ENUM values actually in use
  FOR rec IN
    SELECT p.status::TEXT AS val, COUNT(*) AS cnt
    FROM public.properties p
    GROUP BY p.status
    ORDER BY cnt DESC
  LOOP
    status_list := status_list || rec.val || ' (' || rec.cnt || ')  ';
  END LOOP;
  RAISE NOTICE 'DISTINCT status values in properties table: %', status_list;

  -- Distinct list_type TEXT values actually in use (top 40 by frequency)
  FOR rec IN
    SELECT COALESCE(p.list_type, '(NULL)') AS val, COUNT(*) AS cnt
    FROM public.properties p
    GROUP BY p.list_type
    ORDER BY cnt DESC
    LIMIT 40
  LOOP
    list_type_list := list_type_list || rec.val || ' (' || rec.cnt || ')  ';
  END LOOP;
  RAISE NOTICE 'DISTINCT list_type values in properties table (top 40): %', list_type_list;
END $$;

-- ============================================================
-- STEP 2: DROP and RECREATE the view with corrected filters
-- ============================================================
DROP VIEW IF EXISTS public.public_properties;

CREATE VIEW public.public_properties AS
SELECT
  -- Identity / Location
  p.property_ref,
  p.building_name,
  p.village,
  p.phase,
  p.floor                                     AS floor_number,
  p.block                                     AS block,

  -- building_type: floor_type holds "Low Rise" / "Mid Rise" / "High Rise" etc.
  p.floor_type                                AS building_type,

  -- listing_type: SINGLE authoritative field for Buy vs Rent.
  --
  -- Derived from price data to guarantee consistency with asking_price/asking_rent.
  -- After the WHERE clause below, only rows with the relevant price populated reach
  -- this CASE, so the ELSE fallback (both prices NULL) should never fire in practice.
  CASE
    WHEN p.asking_price IS NOT NULL AND p.asking_rent IS NULL
      THEN 'for-sale'
    WHEN p.asking_rent IS NOT NULL AND p.asking_price IS NULL
      THEN 'for-rent'
    WHEN p.asking_price IS NOT NULL AND p.asking_rent IS NOT NULL
      THEN 'for-sale-and-rent'
    ELSE p.status::TEXT   -- fallback: trust the ENUM when prices are ambiguous
  END                                         AS listing_type,

  -- Pricing
  p.asking_price                              AS sale_price,
  p.asking_rent                               AS rental_price_per_month,

  -- Size
  p.saleable_area                             AS net_sqft,
  p.gross_area                                AS gross_sqft,
  p.outside_sc                                AS outdoor_sqft,

  -- Rooms
  p.bedrooms,
  p.bathrooms,

  -- Attributes
  p.direction_id                              AS direction,
  p.view_id                                   AS view,
  p.decor_id                                  AS decoration,
  p.furn_id                                   AS furnishing,

  -- Additional Features (boolean flags)
  p.balcony,
  p.combined,
  p.duplex,
  p.garden,
  p.openkitch                                 AS open_kitchen,
  p.pool,
  p.roof,
  p.terrace,

  -- Advertising Descriptions
  p.p_english                                 AS description_english,
  p.p_chinese                                 AS description_chinese,

  -- Media
  p.matterport_link,

  -- Floor Plan URL: constructed from the first matching file in the
  -- floor-plans storage bucket whose object name starts with "<property_ref>/".
  (
    SELECT
      public.get_supabase_storage_base_url()
      || '/storage/v1/object/public/floor-plans/'
      || so.name
    FROM storage.objects so
    WHERE so.bucket_id = 'floor-plans'
      AND so.name LIKE (p.property_ref || '/%')
    ORDER BY so.created_at ASC
    LIMIT 1
  )                                           AS floor_plan_url,

  -- Photos: aggregated array of public URLs from property_photos
  COALESCE(
    (
      SELECT ARRAY_AGG(ph.public_url ORDER BY ph.display_order ASC)
      FROM public.property_photos ph
      WHERE ph.property_ref = p.property_ref
    ),
    ARRAY[]::TEXT[]
  )                                           AS photo_urls,

  -- Publish Info
  p.publish_to_website                        AS publish_status_date,
  p.publish_dt                                AS publish_date,

  -- Timestamps
  p.updated_at                                AS last_updated

FROM public.properties p
WHERE
  -- ── PUBLISH GATE ──────────────────────────────────────────────────────────
  -- Must have a publish date set and that date must not be in the future.
  p.publish_dt IS NOT NULL
  AND p.publish_dt <= CURRENT_DATE

  -- ── STATUS WHITELIST (authoritative ENUM filter) ──────────────────────────
  -- Only include rows where status is one of the three active/available values.
  -- This is a WHITELIST (not a blacklist) so any future ENUM values added later
  -- are automatically excluded until explicitly allowed.
  AND p.status IN (
    'for-sale'::public.property_status,
    'for-rent'::public.property_status,
    'for-sale-and-rent'::public.property_status
  )

  -- ── LIST_TYPE BLACKLIST (belt-and-suspenders on the raw import field) ─────
  -- Exclude rows where the free-text list_type column contains any sold/leased/
  -- inactive indicator, even if the ENUM status was not updated after the sale.
  -- Case-insensitive match.  NULL list_type passes through (not excluded).
  AND (
    p.list_type IS NULL
    OR LOWER(TRIM(p.list_type)) NOT IN (
      'sold',
      'leased',
      'lease',
      'self occupy',
      'self-occupy',
      'selfoccupy',
      'no contact',
      'no-contact',
      'unknown',
      'inactive',
      'withdrawn',
      'off market',
      'off-market'
    )
  )

  -- ── CONTACT STATUS FILTER ─────────────────────────────────────────────────
  -- Exclude contact-restricted records.
  AND (
    p.contact_status IS NULL
    OR p.contact_status NOT IN (
      'no-contact'::public.contact_status,
      'unknown'::public.contact_status
    )
  )

  -- ── PRICE COMPLETENESS REQUIREMENT ───────────────────────────────────────
  -- Require that the relevant price field is populated.
  -- A for-sale listing with no asking_price is incomplete.
  -- A for-rent listing with no asking_rent is incomplete.
  -- Both must be populated for a for-sale-and-rent listing.
  -- Rows failing this check are excluded as not ready for public display.
  AND (
    CASE
      WHEN p.status = 'for-sale'::public.property_status
        THEN p.asking_price IS NOT NULL
      WHEN p.status = 'for-rent'::public.property_status
        THEN p.asking_rent IS NOT NULL
      WHEN p.status = 'for-sale-and-rent'::public.property_status
        THEN p.asking_price IS NOT NULL AND p.asking_rent IS NOT NULL
      ELSE FALSE   -- any other status: exclude (should not reach here due to whitelist above)
    END
  );

-- ============================================================
-- RE-GRANT SELECT ON THE VIEW
-- ============================================================
GRANT SELECT ON public.public_properties TO anon;
GRANT SELECT ON public.public_properties TO authenticated;

-- ============================================================
-- RE-GRANT SELECT ON property_photos TO anon
-- (required for the photo_urls subquery)
-- ============================================================
GRANT SELECT ON public.property_photos TO anon;

-- ============================================================
-- STEP 3: VERIFICATION — count rows and confirm zero non-active status
-- ============================================================
DO $$
DECLARE
  total_count         INTEGER;
  sold_count          INTEGER;
  leased_count        INTEGER;
  self_occupy_count   INTEGER;
  no_price_count      INTEGER;
BEGIN
  -- Total rows now in the view
  SELECT COUNT(*) INTO total_count FROM public.public_properties;
  RAISE NOTICE 'public_properties total row count after fix: %', total_count;

  -- Confirm zero rows with status = 'for-sale' but no sale_price
  SELECT COUNT(*) INTO no_price_count
  FROM public.public_properties
  WHERE listing_type = 'for-sale' AND sale_price IS NULL;
  RAISE NOTICE 'Rows with listing_type=for-sale and sale_price NULL (should be 0): %', no_price_count;

  -- Confirm zero rows with status = 'for-rent' but no rental_price
  SELECT COUNT(*) INTO no_price_count
  FROM public.public_properties
  WHERE listing_type = 'for-rent' AND rental_price_per_month IS NULL;
  RAISE NOTICE 'Rows with listing_type=for-rent and rental_price_per_month NULL (should be 0): %', no_price_count;

  -- Confirm zero rows where list_type indicates sold/leased slipped through
  SELECT COUNT(*) INTO sold_count
  FROM public.properties p
  WHERE p.publish_dt IS NOT NULL
    AND p.publish_dt <= CURRENT_DATE
    AND p.list_type IS NOT NULL
    AND LOWER(TRIM(p.list_type)) IN (
      'sold','leased','lease','self occupy','self-occupy','selfoccupy',
      'no contact','no-contact','unknown','inactive','withdrawn','off market','off-market'
    )
    AND p.property_ref IN (SELECT property_ref FROM public.public_properties);
  RAISE NOTICE 'Rows with non-active list_type still in view (should be 0): %', sold_count;

  -- Confirm zero rows where ENUM status is self-occupy or leased
  SELECT COUNT(*) INTO self_occupy_count
  FROM public.public_properties pp
  JOIN public.properties p ON p.property_ref = pp.property_ref
  WHERE p.status IN (
    'self-occupy'::public.property_status,
    'leased'::public.property_status
  );
  RAISE NOTICE 'Rows with status=self-occupy or leased in view (should be 0): %', self_occupy_count;

  RAISE NOTICE 'Verification complete. All checks should show 0 for the non-active counts above.';
END $$;
