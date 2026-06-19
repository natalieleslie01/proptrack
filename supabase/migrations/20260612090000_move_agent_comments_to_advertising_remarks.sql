-- Migration: Move Agent Comments → Advertising Remarks
-- For all properties that have content in `notes` (Agent Comments),
-- copy that content into `p_english` (Advertising Remarks English),
-- then clear `notes` on those rows.
--
-- Rules:
--   • Only affects rows where notes IS NOT NULL and notes <> ''
--   • If p_english already has content, APPEND the agent comment
--     (separated by a newline) so no existing advertising remarks are lost.
--   • After copying, notes is set to NULL on those rows.

DO $$
DECLARE
  affected_count INTEGER;
BEGIN
  -- Step 1: For rows where p_english already has content, append notes to it
  UPDATE public.properties
  SET
    p_english = p_english || E'\n' || notes,
    notes     = NULL,
    updated_at = CURRENT_TIMESTAMP
  WHERE
    notes IS NOT NULL
    AND notes <> ''
    AND p_english IS NOT NULL
    AND p_english <> '';

  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RAISE NOTICE 'Step 1 – appended agent comments to existing advertising remarks: % rows', affected_count;

  -- Step 2: For rows where p_english is empty/null, move notes directly into p_english
  UPDATE public.properties
  SET
    p_english  = notes,
    notes      = NULL,
    updated_at = CURRENT_TIMESTAMP
  WHERE
    notes IS NOT NULL
    AND notes <> ''
    AND (p_english IS NULL OR p_english = '');

  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RAISE NOTICE 'Step 2 – moved agent comments to empty advertising remarks: % rows', affected_count;

END $$;
