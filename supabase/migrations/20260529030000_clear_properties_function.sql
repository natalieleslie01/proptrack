-- Creates a SECURITY DEFINER function that truncates the properties table
-- using CASCADE to handle all foreign key constraints automatically.
-- This bypasses RLS entirely and is called via rpc() with the service role key.

CREATE OR REPLACE FUNCTION public.admin_clear_all_properties()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_count_before BIGINT;
  row_count_after BIGINT;
BEGIN
  -- Count rows before
  SELECT COUNT(*) INTO row_count_before FROM public.properties;

  -- TRUNCATE with CASCADE handles all FK-referencing tables automatically
  TRUNCATE TABLE public.properties CASCADE;

  -- Count rows after (should be 0)
  SELECT COUNT(*) INTO row_count_after FROM public.properties;

  RETURN jsonb_build_object(
    'success', true,
    'before', row_count_before,
    'after', row_count_after,
    'deleted', row_count_before - row_count_after
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Grant execute to authenticated and service_role
GRANT EXECUTE ON FUNCTION public.admin_clear_all_properties() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_clear_all_properties() TO service_role;
