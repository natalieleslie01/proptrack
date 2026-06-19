-- ============================================================
-- UPDATE public_properties VIEW — Add floor_plan_url
--
-- The floor-plans bucket is public. Files are stored with
-- object names like "<property_ref>/<filename>" (or just
-- "<property_ref>/<filename>" depending on upload path).
--
-- Strategy:
--   1. Create a helper function get_supabase_storage_base_url()
--      that derives the project base URL from the first
--      property_photos.public_url record (which already stores
--      full public URLs). Falls back to NULL if no photos exist.
--   2. Recreate public_properties with a subquery on
--      storage.objects to find the first floor-plan file for
--      each property_ref and construct its public URL.
-- ============================================================

-- ============================================================
-- 1. HELPER FUNCTION — derive Supabase project base URL
--    from existing property_photos.public_url values.
--    Returns e.g. "https://abcxyz.supabase.co"
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_supabase_storage_base_url()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    -- Extract everything up to (but not including) "/storage/v1/..."
    -- e.g. "https://abcxyz.supabase.co/storage/v1/object/public/property-photos/foo.jpg"
    --   → "https://abcxyz.supabase.co"
    regexp_replace(public_url, '/storage/v1/.*$', '')
  FROM public.property_photos
  WHERE public_url IS NOT NULL
    AND public_url LIKE 'https://%/storage/v1/%'
  LIMIT 1
$$;

-- ============================================================
-- 2. GRANT EXECUTE on the helper to anon / authenticated
-- ============================================================
GRANT EXECUTE ON FUNCTION public.get_supabase_storage_base_url() TO anon;
GRANT EXECUTE ON FUNCTION public.get_supabase_storage_base_url() TO authenticated;

-- ============================================================
-- 3. GRANT SELECT on storage.objects to anon
--    (needed so the view subquery can read the bucket listing
--    under the anon role via PostgREST)
-- ============================================================
GRANT SELECT ON storage.objects TO anon;
GRANT SELECT ON storage.objects TO authenticated;

-- ============================================================
-- 4. RECREATE public_properties VIEW with floor_plan_url
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
  -- Must be explicitly marked for public display
  p.publish_to_website IS NOT NULL

  -- Exclude statuses that should never appear publicly
  AND p.status NOT IN (
    'self-occupy'::public.property_status,
    'leased'::public.property_status
  )

  -- Exclude contact-restricted records
  AND (
    p.contact_status IS NULL
    OR p.contact_status NOT IN (
      'no-contact'::public.contact_status,
      'unknown'::public.contact_status
    )
  );

-- ============================================================
-- 5. RE-GRANT SELECT ON THE VIEW
-- ============================================================
GRANT SELECT ON public.public_properties TO anon;
GRANT SELECT ON public.public_properties TO authenticated;

-- ============================================================
-- 6. RE-GRANT SELECT ON property_photos TO anon
--    (required for the photo_urls subquery)
-- ============================================================
GRANT SELECT ON public.property_photos TO anon;
