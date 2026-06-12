-- Extend key_log table with new fields for the Key Log section in Property Overview
-- Adds: key_status (Yes/No/Other), sole_agent, sole_agent_name, sole_agent_valid_from, sole_agent_valid_to

ALTER TABLE public.key_log
  ADD COLUMN IF NOT EXISTS key_status TEXT DEFAULT NULL,        -- 'Yes' | 'No' | 'Other'
  ADD COLUMN IF NOT EXISTS sole_agent TEXT DEFAULT NULL,        -- 'Homes R Us' | 'Other'
  ADD COLUMN IF NOT EXISTS sole_agent_name TEXT DEFAULT NULL,   -- free text agent name
  ADD COLUMN IF NOT EXISTS sole_agent_valid_from DATE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sole_agent_valid_to DATE DEFAULT NULL;
