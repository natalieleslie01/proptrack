-- Migration: Add separate direction_id and view_id columns
-- The iRem CSV exports direction and view as separate fields
-- We keep direction_view_id for backward compatibility

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS direction_id  TEXT,
  ADD COLUMN IF NOT EXISTS view_id       TEXT,
  ADD COLUMN IF NOT EXISTS prop_type     TEXT;

-- Backfill direction_id from direction_view_id if it contains a direction value
UPDATE public.properties
  SET direction_id = direction_view_id
  WHERE direction_view_id IS NOT NULL
    AND direction_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_properties_direction_id ON public.properties(direction_id);
CREATE INDEX IF NOT EXISTS idx_properties_view_id ON public.properties(view_id);
