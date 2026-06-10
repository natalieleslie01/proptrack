-- Fix: Add a proper UNIQUE CONSTRAINT on short_code_prefix so that
-- Supabase upsert with onConflict: 'short_code_prefix' works correctly.
-- The previous migration only created a functional unique INDEX on UPPER(short_code_prefix),
-- but ON CONFLICT requires a plain unique CONSTRAINT on the column itself.

-- Drop the expression-based index (it cannot be used by ON CONFLICT by column name)
DROP INDEX IF EXISTS public.idx_building_codes_prefix;

-- Add a plain unique constraint on the column (case-sensitive, matches upsert target)
ALTER TABLE public.building_codes
  DROP CONSTRAINT IF EXISTS building_codes_short_code_prefix_key;

ALTER TABLE public.building_codes
  ADD CONSTRAINT building_codes_short_code_prefix_key UNIQUE (short_code_prefix);
