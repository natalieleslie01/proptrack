-- Fix property column types to accept CSV import values
-- Issues fixed:
--   1. asking_price BIGINT → NUMERIC  (CSV has decimal millions: 5.3, 8.5, 14.5)
--   2. asking_rent  INTEGER → NUMERIC (CSV has decimal rent values)
--   3. saleable_area INTEGER → NUMERIC (CSV may have decimal sqft)
--   4. gross_area    INTEGER → NUMERIC (CSV may have decimal sqft)
--   5. outside_sc already NUMERIC — no change needed

-- Change asking_price from BIGINT to NUMERIC to accept decimal values like 5.3, 14.5
ALTER TABLE public.properties
  ALTER COLUMN asking_price TYPE NUMERIC USING asking_price::NUMERIC;

-- Change asking_rent from INTEGER to NUMERIC to accept decimal rent values
ALTER TABLE public.properties
  ALTER COLUMN asking_rent TYPE NUMERIC USING asking_rent::NUMERIC;

-- Change saleable_area from INTEGER to NUMERIC to accept decimal sqft values
ALTER TABLE public.properties
  ALTER COLUMN saleable_area TYPE NUMERIC USING saleable_area::NUMERIC;

-- Change gross_area from INTEGER to NUMERIC to accept decimal sqft values
ALTER TABLE public.properties
  ALTER COLUMN gross_area TYPE NUMERIC USING gross_area::NUMERIC;
