-- Migration: Remove duplicate property records (v2)
-- Purpose: The properties table still has 17,210 rows when only 8,606 unique properties should exist.
-- This migration deletes duplicate rows using a broader deduplication strategy.

DO $$
DECLARE
    rows_before INT;
    rows_after INT;
    deleted_count INT;
BEGIN
    SELECT COUNT(*) INTO rows_before FROM public.properties;
    RAISE NOTICE 'Properties before deduplication: %', rows_before;

    -- Step 1: Delete duplicates where property_ref IS NOT NULL
    -- Keep the row with the smallest id (earliest) for each property_ref
    DELETE FROM public.properties
    WHERE id IN (
        SELECT id FROM (
            SELECT
                id,
                ROW_NUMBER() OVER (
                    PARTITION BY property_ref
                    ORDER BY created_at ASC NULLS LAST, id ASC
                ) AS rn
            FROM public.properties
            WHERE property_ref IS NOT NULL
              AND property_ref <> ''
        ) ranked
        WHERE rn > 1
    );

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % duplicate rows with non-NULL/non-empty property_ref', deleted_count;

    -- Step 2: Delete duplicates where property_ref IS NULL or empty
    -- Use (phase, block, floor, unit) as the deduplication key
    DELETE FROM public.properties
    WHERE id IN (
        SELECT id FROM (
            SELECT
                id,
                ROW_NUMBER() OVER (
                    PARTITION BY
                        COALESCE(LOWER(TRIM(phase)), ''),
                        COALESCE(LOWER(TRIM(block)), ''),
                        COALESCE(LOWER(TRIM(floor)), ''),
                        COALESCE(LOWER(TRIM(unit)), '')
                    ORDER BY created_at ASC NULLS LAST, id ASC
                ) AS rn
            FROM public.properties
            WHERE property_ref IS NULL OR property_ref = ''
        ) ranked
        WHERE rn > 1
    );

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % duplicate rows with NULL/empty property_ref', deleted_count;

    SELECT COUNT(*) INTO rows_after FROM public.properties;
    RAISE NOTICE 'Properties after deduplication: %', rows_after;
    RAISE NOTICE 'Total removed: %', rows_before - rows_after;
END $$;
