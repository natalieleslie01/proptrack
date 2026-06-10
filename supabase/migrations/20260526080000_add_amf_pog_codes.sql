-- Add AMF (Amalfi) and POG (Poggibonsi) building codes
-- POB is not added as it does not exist in the data
INSERT INTO public.building_codes (short_code_prefix, building_name)
VALUES
  ('AMF01', 'Amalfi (Block 1)'),
  ('AMF02', 'Amalfi (Block 2)'),
  ('AMF03', 'Amalfi (Block 3)'),
  ('POG',   'Poggibonsi'),
  ('POG05', 'Poggibonsi (Block 5)'),
  ('POG06', 'Poggibonsi (Block 6)'),
  ('POG08', 'Poggibonsi (Block 8)')
ON CONFLICT (short_code_prefix)
DO UPDATE SET
  building_name = EXCLUDED.building_name,
  updated_at    = CURRENT_TIMESTAMP;
