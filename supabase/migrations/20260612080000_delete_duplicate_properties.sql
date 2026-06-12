-- Migration: Delete duplicate properties created by the bad CSV import
-- The bad import created new rows (with IReM PID as property_ref) instead of
-- updating existing rows matched by short_code.
--
-- Strategy:
--   1. For each short_code that appears more than once, keep the OLDEST row
--      (lowest created_at / smallest id) and delete the newer duplicates.
--   2. Also delete rows that have no short_code AND no building_name AND no
--      bedrooms/bathrooms — these are bare skeleton rows created by the bad import.
--
-- This is idempotent: running it again when no duplicates exist is a no-op.

DO $$
DECLARE
  deleted_duplicates INTEGER := 0;
  deleted_bare       INTEGER := 0;
BEGIN

  -- ── Step 1: Delete duplicate short_code rows, keeping the oldest per short_code ──
  DELETE FROM public.properties
  WHERE id IN (
    SELECT id
    FROM (
      SELECT
        id,
        short_code,
        ROW_NUMBER() OVER (
          PARTITION BY short_code
          ORDER BY created_at ASC, id ASC
        ) AS rn
      FROM public.properties
      WHERE short_code IS NOT NULL
        AND short_code <> ''
    ) ranked
    WHERE rn > 1
  );

  GET DIAGNOSTICS deleted_duplicates = ROW_COUNT;
  RAISE NOTICE 'Deleted % duplicate short_code rows (kept oldest per short_code)', deleted_duplicates;

  -- ── Step 2: Delete bare skeleton rows with no short_code, no building_name,
  --            no bedrooms, no bathrooms — these are the orphan rows from the bad import ──
  DELETE FROM public.properties
  WHERE (short_code IS NULL OR short_code = '')
    AND (building_name IS NULL OR building_name = '')
    AND (bedrooms IS NULL OR bedrooms = 0)
    AND (bathrooms IS NULL OR bathrooms = 0)
    AND (saleable_area IS NULL)
    AND (gross_area IS NULL);

  GET DIAGNOSTICS deleted_bare = ROW_COUNT;
  RAISE NOTICE 'Deleted % bare skeleton rows with no short_code/building_name/bedrooms', deleted_bare;

  RAISE NOTICE 'Total deleted: %', deleted_duplicates + deleted_bare;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Cleanup failed: %', SQLERRM;
END $$;
