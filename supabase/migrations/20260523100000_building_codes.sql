-- Building codes table: maps short_code_prefix to building_name
CREATE TABLE IF NOT EXISTS public.building_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  short_code_prefix TEXT NOT NULL,
  building_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_building_codes_prefix
  ON public.building_codes (UPPER(short_code_prefix));

CREATE INDEX IF NOT EXISTS idx_building_codes_name
  ON public.building_codes (building_name);

ALTER TABLE public.building_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_manage_building_codes" ON public.building_codes;
CREATE POLICY "authenticated_manage_building_codes"
  ON public.building_codes
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
