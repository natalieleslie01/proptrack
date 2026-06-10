-- Migration: Update properties table to match exact CSV column headers
-- CSV columns: pid, short-code, Phase, village, area, building-name, build_year,
--   list_type, floor_type, prop_type, s_size, g_size, o_size, room, bath_rm,
--   publish_dt, s_price, r_price, direction_view_id, furn_id, decor_id,
--   balcony, combined, duplex, garden, openkitch, pool, roof, terrace, p_eng_res, status

ALTER TABLE public.properties
  -- Add phase column (CSV: Phase)
  ADD COLUMN IF NOT EXISTS phase              TEXT,
  -- Add building_name column (CSV: building-name) — replaces/supplements tower
  ADD COLUMN IF NOT EXISTS building_name      TEXT,
  -- Rename outside_sc to o_size equivalent — add o_size as alias column
  -- outside_sc already exists; add p_eng_res mapping column
  ADD COLUMN IF NOT EXISTS p_eng_res          TEXT;

-- Ensure outside_sc exists (maps from o_size in CSV)
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS outside_sc         NUMERIC;

-- Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_properties_phase         ON public.properties(phase);
CREATE INDEX IF NOT EXISTS idx_properties_building_name ON public.properties(building_name);
