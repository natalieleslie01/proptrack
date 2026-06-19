-- ============================================================
-- FIX public_properties VIEW — Authoritative listing_type
--
-- ROOT CAUSE ANALYSIS
-- ===================
-- The properties table has TWO listing-type-related columns:
--
--   1. status  (public.property_status ENUM)
--      Definition: 'for-sale' | 'for-rent' | 'for-sale-and-rent' |
--                  'self-occupy' | 'leased'
--      Source: Initial schema (20260426061323). This is the live,
--      UI-managed field that agents update.
--      Problem: On import, mapIRemStatus() uses list_type to derive
--      status. If list_type was 'sale' but the numeric status code
--      was 0/3 and list_type was absent or misread, status defaulted
--      to 'for-rent'. These rows were never corrected after import.
--      Result: status = 'for-rent' on rows where asking_price is
--      populated and asking_rent is NULL — a contradiction.
--
--   2. list_type  (TEXT, free-text)
--      Definition: Raw CSV import label, e.g. 'sale', 'rent',
--                  'rent & sale'. Written once at import time and
--                  NEVER updated thereafter.
--      Source: 20260507090000_irem_property_columns.sql
--      This is NOT authoritative for live status, but it does
--      preserve the original intent at import time.
--
-- SINGLE SOURCE OF TRUTH
-- ======================
-- Neither column alone is reliable:
--   • status is wrong on rows where import defaulted to 'for-rent'
--   • list_type is stale and never updated
--
-- The ONLY self-consistent signal is the price data itself:
--   • asking_price IS NOT NULL AND asking_rent IS NULL  → for-sale
--   • asking_rent  IS NOT NULL AND asking_price IS NULL → for-rent
--   • Both populated                                    → for-sale-and-rent
--   • Both NULL                                         → fall back to status
--
-- This cross-check is what the user requested: "a property with
-- sale_price populated and rental_price NULL should be 'for sale'".
-- The derived expression enforces exactly that invariant.
--
-- CHANGES IN THIS MIGRATION
-- =========================
-- 1. listing_type is now a CASE expression derived from price data,
--    with status as the fallback when prices are ambiguous.
--    This guarantees listing_type always agrees with the price columns.
-- 2. list_type_legacy is REMOVED from the view entirely.
--    It was labelled non-authoritative and is now causing confusion.
-- 3. All other columns are preserved unchanged.
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
  -- Derived from price data to guarantee consistency:
  --   asking_price set, asking_rent NULL  → 'for-sale'
  --   asking_rent  set, asking_price NULL → 'for-rent'
  --   both set                            → 'for-sale-and-rent'
  --   both NULL (no price data)           → fall back to status enum
  --
  -- After the WHERE clause filters out 'self-occupy' and 'leased',
  -- the only values that can appear here are:
  --   'for-sale' | 'for-rent' | 'for-sale-and-rent'
  CASE
    WHEN p.asking_price IS NOT NULL AND p.asking_rent IS NULL
      THEN 'for-sale'
    WHEN p.asking_rent IS NOT NULL AND p.asking_price IS NULL
      THEN 'for-rent'
    WHEN p.asking_price IS NOT NULL AND p.asking_rent IS NOT NULL
      THEN 'for-sale-and-rent'
    ELSE p.status::TEXT   -- fallback: no price data, trust the enum
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
  -- floor-plans storage bucket whose object name starts with
  -- "<property_ref>/".  Returns NULL when no floor plan exists.
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

  -- Photos: aggregated array of public URLs from property_photos,
  -- ordered by display_order ascending (advertising photos first)
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
  -- Must have a publish date set and that date must not be in the future.
  p.publish_dt IS NOT NULL
  AND p.publish_dt <= CURRENT_DATE

  -- Exclude statuses that should never appear publicly.
  AND p.status NOT IN (
    'self-occupy'::public.property_status,
    'leased'::public.property_status
  )

  -- Exclude contact-restricted records.
  AND (
    p.contact_status IS NULL
    OR p.contact_status NOT IN (
      'no-contact'::public.contact_status,
      'unknown'::public.contact_status
    )
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
