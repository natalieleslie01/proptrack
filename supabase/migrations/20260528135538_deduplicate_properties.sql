-- Migration: Remove duplicate property records
-- Purpose: The properties table has 17,210 rows when only 8,606 unique properties should exist.
-- This migration deletes duplicate rows, keeping the earliest-created record for each unique property.
-- Deduplication key: property_ref (for non-NULL rows), or (phase, block, floor, unit) for NULL-ref rows.

DO $$
DECLARE
    rows_before INT;
    rows_after INT;
    deleted_count INT;
BEGIN
    SELECT COUNT(*) INTO rows_before FROM public.properties;
    RAISE NOTICE 'Properties before deduplication: %', rows_before;

    -- Step 1: Delete duplicates where property_ref IS NOT NULL
    -- Keep the row with the smallest ctid (earliest physical insertion) for each property_ref
    DELETE FROM public.properties
    WHERE id IN (
        SELECT id FROM (
            SELECT
                id,
                ROW_NUMBER() OVER (
                    PARTITION BY property_ref
                    ORDER BY created_at ASC, id ASC
                ) AS rn
            FROM public.properties
            WHERE property_ref IS NOT NULL
        ) ranked
        WHERE rn > 1
    );

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % duplicate rows with non-NULL property_ref', deleted_count;

    -- Step 2: Delete duplicates where property_ref IS NULL
    -- Use (phase, block, floor, unit) as the deduplication key for NULL-ref rows
    DELETE FROM public.properties
    WHERE id IN (
        SELECT id FROM (
            SELECT
                id,
                ROW_NUMBER() OVER (
                    PARTITION BY
                        COALESCE(phase, ''),
                        COALESCE(block, ''),
                        COALESCE(floor, ''),
                        COALESCE(unit, '')
                    ORDER BY created_at ASC, id ASC
                ) AS rn
            FROM public.properties
            WHERE property_ref IS NULL
        ) ranked
        WHERE rn > 1
    );

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % duplicate rows with NULL property_ref', deleted_count;

    SELECT COUNT(*) INTO rows_after FROM public.properties;
    RAISE NOTICE 'Properties after deduplication: %', rows_after;
    RAISE NOTICE 'Total removed: %', rows_before - rows_after;
END $$;
