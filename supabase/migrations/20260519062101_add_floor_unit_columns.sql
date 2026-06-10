-- Migration: Ensure floor and unit columns exist in properties table
-- floor = actual floor number (e.g. "5", "G", "LG")
-- unit = flat/unit identifier (e.g. "01A", "B", "12")

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS floor  TEXT,
  ADD COLUMN IF NOT EXISTS unit   TEXT;

CREATE INDEX IF NOT EXISTS idx_properties_floor ON public.properties(floor);
CREATE INDEX IF NOT EXISTS idx_properties_unit  ON public.properties(unit);
