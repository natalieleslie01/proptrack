-- Seed building code mappings
-- CHI series (Chianti)
INSERT INTO public.building_codes (short_code_prefix, building_name)
VALUES
  ('CHI01', 'The Pavilion'),
  ('CHI02', 'The Barion'),
  ('CHI03', 'The Hemex'),
  ('CHI05', 'The Lustre'),
  ('CHI06', 'The Premier'),
  ('NEO01', 'Neo Horizon 1'),
  ('NEO02', 'Neo Horizon 2'),
  ('AH1',   'Celestial Mansion'),
  ('AH2',   'Graceful Mansion'),
  ('AH3',   'Joyful Mansion'),
  ('AH5',   'Peaceful Mansion'),
  ('SN1',   'Siena One'),
  ('SN2',   'Siena Two'),
  ('HG1',   'Glamour Court'),
  ('HG2',   'Brilliance Court'),
  ('HG3',   'Elegance Court'),
  ('CT1',   'Costa Court'),
  ('CT2',   'Onda Court')
ON CONFLICT (short_code_prefix)
DO UPDATE SET
  building_name = EXCLUDED.building_name,
  updated_at    = CURRENT_TIMESTAMP;
