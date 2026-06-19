-- ============================================================
-- FIX public_properties VIEW — Correct publish filter
--
-- Problem:
--   The WHERE clause filtered on `publish_to_website IS NOT NULL`,
--   but publish_to_website is NULL on every row.  The column that
--   actually gets set when a property is published via the UI is
--   `publish_dt` (DATE type).
--
-- Fix:
--   Replace  `p.publish_to_website IS NOT NULL`
--   with     `p.publish_dt IS NOT NULL AND p.publish_dt <= CURRENT_DATE`
--
--   The second condition (`<= CURRENT_DATE`) prevents future-dated
--   publishes from appearing on the website before their intended
--   go-live date.
--
-- Enum audit (no changes required):
--   public.property_status  → 'for-sale' | 'for-rent' | 'for-sale-and-rent' | 'self-occupy' | 'leased'
--   public.contact_status   → 'active' | 'no-contact' | 'unknown'
--   The view's exclusion logic already uses the exact enum values;
--   no casing or wording corrections are needed.
-- ============================================================

-- Drop and recreate the view (idempotent)
DROP VIEW IF EXISTS public.public_properties;

CREATE VIEW public.public_properties AS
SELECT
  -- Identity / Location
  p.property_ref,
  p.building_name,
  p.village,
  p.phase,
  p.floor                                     AS floor_number,
  p.floor_type,
  p.block                                     AS building_type,

  -- Listing Classification
  p.prop_type                                 AS property_type,
  p.list_type                                 AS listing_type,
  p.status::TEXT                              AS listing_status,

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
  -- and that date must not be in the future (prevents early exposure of
  -- properties scheduled for a future go-live date).
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
