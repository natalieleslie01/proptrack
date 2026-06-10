-- Add contact_email column to property_contacts table
ALTER TABLE public.property_contacts
ADD COLUMN IF NOT EXISTS contact_email TEXT NOT NULL DEFAULT '';
