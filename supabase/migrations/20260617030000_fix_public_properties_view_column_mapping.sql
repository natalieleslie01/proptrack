-- ============================================================
-- FIX public_properties VIEW — Correct column mappings
--
-- Problems identified:
--
-- 1. listing_type vs listing_status contradiction
--    The view exposed:
--      p.list_type  AS listing_type   (free-text CSV import field, stale)
--      p.status     AS listing_status (typed enum, authoritative live field)
--    This produced contradictory rows, e.g. listing_type='sale' but
--    listing_status='for-rent', because list_type is a legacy import
--    label that is never updated after import.
--
--    Fix:
--    • Rename the authoritative enum column to `listing_type` so the
--      public website has ONE unambiguous field for Buy vs Rent.
--      Values: 'for-sale' | 'for-rent' | 'for-sale-and-rent'
--    • Keep the legacy import field exposed as `list_type_legacy` for
--      reference / debugging, but clearly labelled as non-authoritative.
--    • Remove the old `listing_status` alias (it was just status::TEXT
--      under a confusing name).
--
-- 2. building_type NULL on every row
--    The view mapped:  p.block AS building_type
--    p.block is a physical block identifier (e.g. "Block A") and is
--    NULL on most rows.  The "Low Rise / Mid Rise / High Rise" values
--    the user sees in the underlying table are stored in p.floor_type
--    (CSV column: floor_type).
--
--    Fix: map  p.floor_type AS building_type
--    The old floor_type alias is removed (it was a duplicate of the
--    same column under a different name).
--
-- Authoritative enum for listing_type (public.property_status):
--   'for-sale' | 'for-rent' | 'for-sale-and-rent' | 'self-occupy' | 'leased'
-- The WHERE clause already excludes 'self-occupy' and 'leased', so the
-- public website will only ever see: 'for-sale', 'for-rent', 'for-sale-and-rent'
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

  -- building_type: maps to floor_type (Low Rise / Mid Rise / High Rise etc.)
  -- Previously this was mapped to p.block which is NULL on most rows.
  p.floor_type                                AS building_type,

  -- Listing Classification
  -- listing_type is the AUTHORITATIVE field for Buy vs Rent.
  -- Use this to decide whether to show a property under "Buy" or "Rent".
  -- Possible values after WHERE filtering: 'for-sale' | 'for-rent' | 'for-sale-and-rent'
  p.status::TEXT                              AS listing_type,

  -- list_type_legacy: the original free-text import label (e.g. 'sale', 'rent').
  -- This field is NOT updated after import and may contradict listing_type.
  -- Exposed for debugging/reference only — do NOT use for Buy/Rent logic.
  p.list_type                                 AS list_type_legacy,

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
  -- Must have a publish date set (the column the UI actually writes to)
  -- and that date must not be in the future.
  p.publish_dt IS NOT NULL
  AND p.publish_dt <= CURRENT_DATE

  -- Exclude statuses that should never appear publicly.
  -- Exact enum values for public.property_status:
  --   'for-sale' | 'for-rent' | 'for-sale-and-rent' | 'self-occupy' | 'leased'
  AND p.status NOT IN (
    'self-occupy'::public.property_status,
    'leased'::public.property_status
  )

  -- Exclude contact-restricted records.
  -- Exact enum values for public.contact_status:
  --   'active' | 'no-contact' | 'unknown'
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
