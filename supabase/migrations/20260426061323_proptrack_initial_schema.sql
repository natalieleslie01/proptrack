-- PropTrack HK — Initial Schema Migration
-- Creates: user_profiles, properties, clients, viewings, storage buckets

-- ============================================================
-- 1. TYPES (ENUMs) — safe idempotent creation (no CASCADE)
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.user_role AS ENUM ('agent', 'manager', 'admin');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'property_status' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.property_status AS ENUM ('for-sale', 'for-rent', 'for-sale-and-rent', 'self-occupy', 'leased');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'occupancy_status' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.occupancy_status AS ENUM ('vacant', 'vacant-soon', 'leased', 'with-ta');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contact_status' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.contact_status AS ENUM ('active', 'no-contact', 'unknown');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'viewing_status' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.viewing_status AS ENUM ('scheduled', 'completed', 'cancelled', 'no-show');
  END IF;
END $$;

-- ============================================================
-- 2. CORE TABLES
-- ============================================================

-- User profiles (linked to auth.users via trigger)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  role public.user_role DEFAULT 'agent'::public.user_role,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Properties table
CREATE TABLE IF NOT EXISTS public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_ref TEXT NOT NULL UNIQUE,
  village TEXT NOT NULL DEFAULT 'Discovery Bay',
  phase TEXT,
  block TEXT,
  floor TEXT,
  unit TEXT,
  address TEXT,
  bedrooms INTEGER DEFAULT 0,
  bathrooms INTEGER DEFAULT 0,
  saleable_area INTEGER,
  gross_area INTEGER,
  asking_price BIGINT,
  asking_rent INTEGER,
  status public.property_status DEFAULT 'for-rent'::public.property_status,
  occupancy public.occupancy_status DEFAULT 'vacant'::public.occupancy_status,
  contact_status public.contact_status DEFAULT 'active'::public.contact_status,
  landlord_name TEXT,
  landlord_phone TEXT,
  landlord_email TEXT,
  tenant_name TEXT,
  tenant_phone TEXT,
  lease_start TEXT,
  lease_end TEXT,
  management_fee INTEGER,
  notes TEXT,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Clients table
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  mobile TEXT,
  email TEXT,
  budget_min INTEGER,
  budget_max INTEGER,
  preferred_bedrooms INTEGER[],
  preferred_areas TEXT[],
  notes TEXT,
  assigned_agent UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Client-Property matches (shortlisted properties for a client)
CREATE TABLE IF NOT EXISTS public.client_property_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  notes TEXT,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Viewings table
CREATE TABLE IF NOT EXISTS public.viewings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  agent_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  viewing_date DATE NOT NULL,
  viewing_time TEXT,
  status public.viewing_status DEFAULT 'scheduled'::public.viewing_status,
  notes TEXT,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 3. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_properties_ref ON public.properties(property_ref);
CREATE INDEX IF NOT EXISTS idx_properties_village ON public.properties(village);
CREATE INDEX IF NOT EXISTS idx_properties_status ON public.properties(status);
CREATE INDEX IF NOT EXISTS idx_clients_assigned_agent ON public.clients(assigned_agent);
CREATE INDEX IF NOT EXISTS idx_client_property_matches_client ON public.client_property_matches(client_id);
CREATE INDEX IF NOT EXISTS idx_client_property_matches_property ON public.client_property_matches(property_id);
CREATE INDEX IF NOT EXISTS idx_viewings_property ON public.viewings(property_id);
CREATE INDEX IF NOT EXISTS idx_viewings_client ON public.viewings(client_id);
CREATE INDEX IF NOT EXISTS idx_viewings_agent ON public.viewings(agent_id);
CREATE INDEX IF NOT EXISTS idx_viewings_date ON public.viewings(viewing_date);

-- ============================================================
-- 4. FUNCTIONS (must be before RLS policies)
-- ============================================================

-- Auto-create user_profiles when a new auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'agent')::public.user_role
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

-- Check if current user is admin (reads from auth metadata to avoid recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND (raw_user_meta_data->>'role' = 'admin' OR raw_app_meta_data->>'role' = 'admin')
  )
$$;

-- Check if current user is manager or admin
CREATE OR REPLACE FUNCTION public.is_manager_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND (
      raw_user_meta_data->>'role' IN ('admin', 'manager')
      OR raw_app_meta_data->>'role' IN ('admin', 'manager')
    )
  )
$$;

-- ============================================================
-- 5. ENABLE ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_property_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viewings ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. RLS POLICIES
-- ============================================================

-- user_profiles: users manage own profile; admins see all
DROP POLICY IF EXISTS "users_manage_own_user_profiles" ON public.user_profiles;
CREATE POLICY "users_manage_own_user_profiles"
ON public.user_profiles
FOR ALL
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "admins_manage_all_user_profiles" ON public.user_profiles;
CREATE POLICY "admins_manage_all_user_profiles"
ON public.user_profiles
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- properties: all authenticated users can read; managers/admins can write
DROP POLICY IF EXISTS "authenticated_read_properties" ON public.properties;
CREATE POLICY "authenticated_read_properties"
ON public.properties
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "agents_insert_properties" ON public.properties;
CREATE POLICY "agents_insert_properties"
ON public.properties
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "agents_update_properties" ON public.properties;
CREATE POLICY "agents_update_properties"
ON public.properties
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "admins_delete_properties" ON public.properties;
CREATE POLICY "admins_delete_properties"
ON public.properties
FOR DELETE
TO authenticated
USING (public.is_manager_or_admin());

-- clients: agents see their own; managers/admins see all
DROP POLICY IF EXISTS "agents_manage_own_clients" ON public.clients;
CREATE POLICY "agents_manage_own_clients"
ON public.clients
FOR ALL
TO authenticated
USING (assigned_agent = auth.uid() OR created_by = auth.uid() OR public.is_manager_or_admin())
WITH CHECK (auth.uid() IS NOT NULL);

-- client_property_matches: follow client access
DROP POLICY IF EXISTS "authenticated_manage_client_matches" ON public.client_property_matches;
CREATE POLICY "authenticated_manage_client_matches"
ON public.client_property_matches
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- viewings: all authenticated users can read/write
DROP POLICY IF EXISTS "authenticated_manage_viewings" ON public.viewings;
CREATE POLICY "authenticated_manage_viewings"
ON public.viewings
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- 7. TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS set_properties_updated_at ON public.properties;
CREATE TRIGGER set_properties_updated_at
  BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_clients_updated_at ON public.clients;
CREATE TRIGGER set_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_viewings_updated_at ON public.viewings;
CREATE TRIGGER set_viewings_updated_at
  BEFORE UPDATE ON public.viewings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 8. STORAGE BUCKETS
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('property-photos', 'property-photos', true, 10485760, ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('floor-plans', 'floor-plans', true, 20971520, ARRAY['image/jpeg','image/png','image/webp','application/pdf']),
  ('documents', 'documents', false, 52428800, ARRAY['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS "authenticated_read_property_photos" ON storage.objects;
CREATE POLICY "authenticated_read_property_photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'property-photos');

DROP POLICY IF EXISTS "authenticated_upload_property_photos" ON storage.objects;
CREATE POLICY "authenticated_upload_property_photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'property-photos');

DROP POLICY IF EXISTS "authenticated_read_floor_plans" ON storage.objects;
CREATE POLICY "authenticated_read_floor_plans"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'floor-plans');

DROP POLICY IF EXISTS "authenticated_upload_floor_plans" ON storage.objects;
CREATE POLICY "authenticated_upload_floor_plans"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'floor-plans');

DROP POLICY IF EXISTS "authenticated_read_documents" ON storage.objects;
CREATE POLICY "authenticated_read_documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'documents');

DROP POLICY IF EXISTS "authenticated_upload_documents" ON storage.objects;
CREATE POLICY "authenticated_upload_documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents');

-- ============================================================
-- 9. MOCK DATA — Demo agent accounts for PropTrack
-- ============================================================

DO $$
DECLARE
  admin_uuid UUID := gen_random_uuid();
  manager_uuid UUID := gen_random_uuid();
  agent_uuid UUID := gen_random_uuid();
BEGIN
  -- Create auth users (trigger auto-creates user_profiles)
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_user_meta_data, raw_app_meta_data,
    is_sso_user, is_anonymous, confirmation_token, confirmation_sent_at,
    recovery_token, recovery_sent_at, email_change_token_new, email_change,
    email_change_sent_at, email_change_token_current, email_change_confirm_status,
    reauthentication_token, reauthentication_sent_at, phone, phone_change,
    phone_change_token, phone_change_sent_at
  ) VALUES
    (
      admin_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'christine.lau@proptrack.hk', crypt('Admin@PropHK2026', gen_salt('bf', 10)), now(), now(), now(),
      jsonb_build_object('full_name', 'Christine Lau', 'role', 'admin'),
      jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
      false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null
    ),
    (
      manager_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'alice.tam@proptrack.hk', crypt('Manager@PropHK2026', gen_salt('bf', 10)), now(), now(), now(),
      jsonb_build_object('full_name', 'Alice Tam', 'role', 'manager'),
      jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
      false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null
    ),
    (
      agent_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'marcus.wong@proptrack.hk', crypt('Agent@PropHK2026', gen_salt('bf', 10)), now(), now(), now(),
      jsonb_build_object('full_name', 'Marcus Wong', 'role', 'agent'),
      jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
      false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null
    )
  ON CONFLICT (id) DO NOTHING;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Mock data insertion skipped: %', SQLERRM;
END $$;
