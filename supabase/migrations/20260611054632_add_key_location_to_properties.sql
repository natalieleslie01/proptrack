-- Add key_location JSONB column to properties table
-- Stores: { type: 'office'|'agent'|'landlord', keyNumber?: string, agentName?: string, agentPhone?: string }

ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS key_location JSONB DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_properties_key_location ON public.properties USING gin(key_location);
