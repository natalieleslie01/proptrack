-- Add sole agent and key status fields to properties table
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS sole_agent TEXT DEFAULT NULL,        -- 'yes' | 'no'
  ADD COLUMN IF NOT EXISTS sole_agent_name TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS key_status TEXT DEFAULT NULL,        -- 'yes' | 'no' | 'other'
  ADD COLUMN IF NOT EXISTS key_number_location TEXT DEFAULT NULL;
