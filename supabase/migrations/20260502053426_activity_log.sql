-- Activity Log Migration
-- Captures all property, contact, and form changes with user, timestamp, and action type

-- 1. Create ENUM types
DROP TYPE IF EXISTS public.activity_entity_type CASCADE;
CREATE TYPE public.activity_entity_type AS ENUM (
  'property',
  'contact',
  'form',
  'tenancy',
  'maintenance',
  'viewing',
  'enquiry',
  'lease_renewal',
  'commission',
  'client'
);

DROP TYPE IF EXISTS public.activity_action_type CASCADE;
CREATE TYPE public.activity_action_type AS ENUM (
  'created',
  'updated',
  'deleted',
  'status_changed',
  'contact_added',
  'contact_updated',
  'contact_removed',
  'form_generated',
  'form_submitted',
  'document_uploaded',
  'note_added',
  'assigned',
  'archived'
);

-- 2. Create activity_log table
CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type public.activity_entity_type NOT NULL,
  action_type public.activity_action_type NOT NULL,
  entity_id TEXT,
  entity_ref TEXT,
  entity_label TEXT,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL DEFAULT '',
  user_role TEXT NOT NULL DEFAULT 'agent',
  description TEXT NOT NULL,
  before_state JSONB,
  after_state JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_activity_log_entity_type ON public.activity_log(entity_type);
CREATE INDEX IF NOT EXISTS idx_activity_log_action_type ON public.activity_log(action_type);
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON public.activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON public.activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity_ref ON public.activity_log(entity_ref);

-- 4. Enable RLS
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies — all authenticated users can read; authenticated users can insert
DROP POLICY IF EXISTS "authenticated_read_activity_log" ON public.activity_log;
CREATE POLICY "authenticated_read_activity_log"
ON public.activity_log
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "authenticated_insert_activity_log" ON public.activity_log;
CREATE POLICY "authenticated_insert_activity_log"
ON public.activity_log
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 6. Seed sample activity log entries
DO $$
DECLARE
  existing_user_id UUID;
  existing_user_name TEXT;
  existing_user_role TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_profiles'
  ) THEN
    SELECT id, full_name, COALESCE(role::TEXT, 'agent')
    INTO existing_user_id, existing_user_name, existing_user_role
    FROM public.user_profiles LIMIT 1;

    IF existing_user_id IS NOT NULL THEN
      INSERT INTO public.activity_log (entity_type, action_type, entity_ref, entity_label, user_id, user_name, user_role, description, created_at)
      VALUES
        ('property', 'created', 'DB-001', 'DB-001 Headland Village', existing_user_id, existing_user_name, existing_user_role, 'Property DB-001 Headland Village was created', NOW() - INTERVAL '2 days'),
        ('property', 'status_changed', 'DB-001', 'DB-001 Headland Village', existing_user_id, existing_user_name, existing_user_role, 'Property status changed from For Rent to Leased', NOW() - INTERVAL '1 day 18 hours'),
        ('contact', 'contact_added', 'DB-002', 'DB-002 Siena One', existing_user_id, existing_user_name, existing_user_role, 'New contact added: Landlord', NOW() - INTERVAL '1 day 12 hours'),
        ('form', 'form_generated', 'DB-003', 'DB-003 Bijou Hamlet', existing_user_id, existing_user_name, existing_user_role, 'Form 2 (Tenancy Agreement) generated for DB-003', NOW() - INTERVAL '1 day 6 hours'),
        ('property', 'updated', 'DB-004', 'DB-004 Chianti', existing_user_id, existing_user_name, existing_user_role, 'Property details updated: asking rent, notes', NOW() - INTERVAL '20 hours'),
        ('contact', 'contact_updated', 'DB-005', 'DB-005 La Costa', existing_user_id, existing_user_name, existing_user_role, 'Contact details updated: phone number', NOW() - INTERVAL '16 hours'),
        ('tenancy', 'status_changed', 'DB-006', 'DB-006 Discovery Bay Plaza', existing_user_id, existing_user_name, existing_user_role, 'Tenancy status changed to Active', NOW() - INTERVAL '12 hours'),
        ('form', 'form_generated', 'DB-007', 'DB-007 Positano', existing_user_id, existing_user_name, existing_user_role, 'Form 3 (Landlord Authorization) generated for DB-007', NOW() - INTERVAL '8 hours'),
        ('property', 'updated', 'DB-008', 'DB-008 Siena Two', existing_user_id, existing_user_name, existing_user_role, 'Property specifications updated: gross sqft, net sqft', NOW() - INTERVAL '5 hours'),
        ('contact', 'contact_added', 'DB-009', 'DB-009 Headland Village', existing_user_id, existing_user_name, existing_user_role, 'New contact added: Agent', NOW() - INTERVAL '3 hours'),
        ('maintenance', 'created', 'DB-010', 'DB-010 Bijou Hamlet', existing_user_id, existing_user_name, existing_user_role, 'Maintenance request created: Plumbing issue', NOW() - INTERVAL '2 hours'),
        ('form', 'form_submitted', 'DB-011', 'DB-011 Chianti', existing_user_id, existing_user_name, existing_user_role, 'CR109 form submitted for DB-011', NOW() - INTERVAL '1 hour'),
        ('property', 'status_changed', 'DB-012', 'DB-012 La Costa', existing_user_id, existing_user_name, existing_user_role, 'Property contact status changed to Active', NOW() - INTERVAL '45 minutes'),
        ('contact', 'contact_removed', 'DB-013', 'DB-013 Discovery Bay Plaza', existing_user_id, existing_user_name, existing_user_role, 'Contact removed: Previous tenant', NOW() - INTERVAL '30 minutes'),
        ('property', 'updated', 'DB-014', 'DB-014 Positano', existing_user_id, existing_user_name, existing_user_role, 'Agent comments updated', NOW() - INTERVAL '15 minutes')
      ON CONFLICT (id) DO NOTHING;
    ELSE
      RAISE NOTICE 'No existing users found. Skipping activity log seed data.';
    END IF;
  ELSE
    RAISE NOTICE 'Table user_profiles does not exist. Skipping activity log seed data.';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Activity log seed data insertion failed: %', SQLERRM;
END $$;
