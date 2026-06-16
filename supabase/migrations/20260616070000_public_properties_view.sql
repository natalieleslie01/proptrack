-- ============================================================
-- PUBLIC PROPERTIES VIEW
-- A read-only, public-safe view of the properties table.
-- Exposes only advertising/display fields — never owner details,
-- contact info, key log data, agent comments, internal notes,
-- or any HK Forms / compliance data.
--
-- Filtered to rows where:
--   • publish_to_website IS NOT NULL  (explicitly marked for public display)
--   • status NOT IN ('self-occupy', 'leased')
--   • contact_status NOT IN ('no-contact', 'unknown')
-- ============================================================

-- Drop the view if it already exists so this migration is idempotent
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
  -- Floor plan URL: stored in Supabase Storage bucket 'floor-plans'.
  -- No URL column exists on the properties table; query the bucket directly
  -- using the property_ref as the path key when needed.
  NULL::TEXT                                  AS floor_plan_url,

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
-- GRANT SELECT ON THE VIEW TO THE ANON ROLE
-- The view itself does not have RLS (views are not tables),
-- but we must GRANT SELECT to anon so the Supabase REST API
-- (PostgREST) exposes it to unauthenticated / anon-key callers.
-- The underlying tables retain their own RLS policies unchanged.
-- ============================================================

GRANT SELECT ON public.public_properties TO anon;
GRANT SELECT ON public.public_properties TO authenticated;

-- ============================================================
-- ALSO GRANT SELECT ON property_photos TO anon
-- The view's subquery reads property_photos; anon must be able
-- to read that table for the aggregation to work correctly.
-- The existing "public_read_property_photos" RLS policy on
-- property_photos already allows public SELECT, so this GRANT
-- ensures PostgREST can execute the subquery under the anon role.
-- ============================================================

GRANT SELECT ON public.property_photos TO anon;
