-- Migration: Remove duplicate property records (v3 - aggressive)
-- Purpose: The properties table has 17,210 rows; only 8,606 unique properties should exist.
-- Since property_ref has a UNIQUE constraint, duplicates must be NULL-ref rows.
-- This migration uses short_code as an additional deduplication key for NULL-ref rows.

DO $$
DECLARE
    rows_before INT;
    rows_after INT;
    deleted_count INT;
BEGIN
    SELECT COUNT(*) INTO rows_before FROM public.properties;
    RAISE NOTICE 'Properties before deduplication: %', rows_before;

    -- Step 1: Delete duplicates where property_ref IS NOT NULL (safety pass)
    -- The UNIQUE constraint should prevent these, but run anyway
    DELETE FROM public.properties p
    WHERE p.id NOT IN (
        SELECT DISTINCT ON (property_ref) id
        FROM public.properties
        WHERE property_ref IS NOT NULL AND property_ref <> ''
        ORDER BY property_ref, created_at ASC NULLS LAST, id ASC
    )
    AND property_ref IS NOT NULL AND property_ref <> '';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Step 1 deleted % rows (non-NULL property_ref duplicates)', deleted_count;

    -- Step 2: Delete duplicates where short_code IS NOT NULL and property_ref IS NULL
    -- Keep earliest row per short_code
    DELETE FROM public.properties p
    WHERE p.id NOT IN (
        SELECT DISTINCT ON (short_code) id
        FROM public.properties
        WHERE (property_ref IS NULL OR property_ref = '')
          AND short_code IS NOT NULL AND short_code <> ''
        ORDER BY short_code, created_at ASC NULLS LAST, id ASC
    )
    AND (property_ref IS NULL OR property_ref = '')
    AND short_code IS NOT NULL AND short_code <> '';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Step 2 deleted % rows (NULL property_ref, duplicate short_code)', deleted_count;

    -- Step 3: Delete duplicates where both property_ref and short_code are NULL/empty
    -- Use (phase, block, floor, unit) as deduplication key
    DELETE FROM public.properties
    WHERE id IN (
        SELECT id FROM (
            SELECT
                id,
                ROW_NUMBER() OVER (
                    PARTITION BY
                        COALESCE(LOWER(TRIM(COALESCE(phase, ''))), ''),
                        COALESCE(LOWER(TRIM(COALESCE(block, ''))), ''),
                        COALESCE(LOWER(TRIM(COALESCE(floor, ''))), ''),
                        COALESCE(LOWER(TRIM(COALESCE(unit, ''))), '')
                    ORDER BY created_at ASC NULLS LAST, id ASC
                ) AS rn
            FROM public.properties
            WHERE (property_ref IS NULL OR property_ref = '')
              AND (short_code IS NULL OR short_code = '')
        ) ranked
        WHERE rn > 1
    );

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Step 3 deleted % rows (NULL property_ref + short_code, duplicate phase/block/floor/unit)', deleted_count;

    SELECT COUNT(*) INTO rows_after FROM public.properties;
    RAISE NOTICE 'Properties after deduplication: %', rows_after;
    RAISE NOTICE 'Total removed: %', rows_before - rows_after;
END $$;
