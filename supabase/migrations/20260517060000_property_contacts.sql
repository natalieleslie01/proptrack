-- Property Contacts table
-- Stores contact details per property, linked by PID (property_ref) or short_code
-- Columns: short_code, pid (property_ref), contact_role (type), contact_person, contact_number

CREATE TABLE IF NOT EXISTS public.property_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_ref TEXT,
  short_code TEXT,
  contact_role TEXT NOT NULL DEFAULT 'owner',
  contact_person TEXT NOT NULL DEFAULT '',
  contact_number TEXT NOT NULL DEFAULT '',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_property_contacts_property_ref ON public.property_contacts(property_ref);
CREATE INDEX IF NOT EXISTS idx_property_contacts_short_code ON public.property_contacts(short_code);

ALTER TABLE public.property_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_manage_property_contacts" ON public.property_contacts;
CREATE POLICY "authenticated_manage_property_contacts"
ON public.property_contacts
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
