-- Add vacant_date column to properties table
ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS vacant_date TEXT;
