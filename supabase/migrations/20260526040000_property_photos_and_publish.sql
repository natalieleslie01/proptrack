-- PropTrack HK — Property Photos & Publish to Website Migration
-- Adds property_photos table (ordered, with advertising tick) and matterport_link to properties

-- ============================================================
-- 1. ADD MATTERPORT LINK TO PROPERTIES
-- ============================================================

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS matterport_link TEXT,
  ADD COLUMN IF NOT EXISTS publish_to_website DATE;

-- Note: publish_dt already exists; publish_to_website is an alias column
-- We'll use publish_dt as the canonical "Publish to Website" date field

-- ============================================================
-- 2. CREATE PROPERTY PHOTOS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.property_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_ref TEXT NOT NULL,
  short_code TEXT,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  filename TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_advertising BOOLEAN NOT NULL DEFAULT false,
  uploaded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 3. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_property_photos_property_ref ON public.property_photos(property_ref);
CREATE INDEX IF NOT EXISTS idx_property_photos_short_code ON public.property_photos(short_code);
CREATE INDEX IF NOT EXISTS idx_property_photos_display_order ON public.property_photos(property_ref, display_order);
CREATE INDEX IF NOT EXISTS idx_property_photos_advertising ON public.property_photos(property_ref, is_advertising);

-- ============================================================
-- 4. ENABLE RLS
-- ============================================================

ALTER TABLE public.property_photos ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. RLS POLICIES
-- ============================================================

DROP POLICY IF EXISTS "authenticated_all_property_photos" ON public.property_photos;
CREATE POLICY "authenticated_all_property_photos"
  ON public.property_photos FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public_read_property_photos" ON public.property_photos;
CREATE POLICY "public_read_property_photos"
  ON public.property_photos FOR SELECT TO public
  USING (true);

-- ============================================================
-- 6. UPDATED_AT TRIGGER
-- ============================================================

DROP TRIGGER IF EXISTS set_updated_at_property_photos ON public.property_photos;
CREATE TRIGGER set_updated_at_property_photos
  BEFORE UPDATE ON public.property_photos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
