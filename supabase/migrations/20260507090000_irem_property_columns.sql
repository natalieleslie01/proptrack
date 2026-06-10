-- Migration: Add iRem-specific columns to properties table
-- These columns map directly from the iRem CSV export format

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS short_code        TEXT,
  ADD COLUMN IF NOT EXISTS area              TEXT,
  ADD COLUMN IF NOT EXISTS tower             TEXT,
  ADD COLUMN IF NOT EXISTS build_year        INTEGER,
  ADD COLUMN IF NOT EXISTS list_type         TEXT,
  ADD COLUMN IF NOT EXISTS floor_type        TEXT,
  ADD COLUMN IF NOT EXISTS prop_types        TEXT,
  ADD COLUMN IF NOT EXISTS outside_sc        NUMERIC,
  ADD COLUMN IF NOT EXISTS publish_dt        DATE,
  ADD COLUMN IF NOT EXISTS direction_view_id TEXT,
  ADD COLUMN IF NOT EXISTS furn_id           TEXT,
  ADD COLUMN IF NOT EXISTS decor_id          TEXT,
  ADD COLUMN IF NOT EXISTS balcony           BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS combined          BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS duplex            BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS garden            BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS openkitch         BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pool              BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS roof              BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS terrace           BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS p_english         TEXT,
  ADD COLUMN IF NOT EXISTS p_chinese         TEXT,
  ADD COLUMN IF NOT EXISTS contact_status_code INTEGER;

-- Index on short_code for quick lookups
CREATE INDEX IF NOT EXISTS idx_properties_short_code ON public.properties(short_code);
CREATE INDEX IF NOT EXISTS idx_properties_area ON public.properties(area);
