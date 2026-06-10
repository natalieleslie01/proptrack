-- PropTrack HK — New Features Migration
-- Creates: maintenance_requests, lease_renewals, commission_tracking tables

-- ============================================================
-- 1. ENUMS
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'maintenance_status' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.maintenance_status AS ENUM ('open', 'in_progress', 'awaiting_parts', 'completed', 'cancelled');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'maintenance_priority' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.maintenance_priority AS ENUM ('low', 'medium', 'high', 'urgent');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'renewal_status' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.renewal_status AS ENUM ('pending', 'negotiating', 'agreed', 'documents_sent', 'signed', 'declined');
  END IF;
END $$;

-- ============================================================
-- 2. MAINTENANCE REQUESTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.maintenance_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_ref TEXT NOT NULL,
  property_address TEXT,
  reported_by TEXT NOT NULL,
  reported_by_type TEXT DEFAULT 'tenant',
  category TEXT NOT NULL DEFAULT 'General',
  description TEXT NOT NULL,
  priority public.maintenance_priority DEFAULT 'medium'::public.maintenance_priority,
  status public.maintenance_status DEFAULT 'open'::public.maintenance_status,
  assigned_agent TEXT,
  contractor_name TEXT,
  contractor_phone TEXT,
  estimated_cost NUMERIC(10,2),
  actual_cost NUMERIC(10,2),
  scheduled_date DATE,
  completed_date DATE,
  notes TEXT,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 3. LEASE RENEWALS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.lease_renewals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_ref TEXT NOT NULL,
  property_address TEXT,
  tenant_name TEXT NOT NULL,
  tenant_email TEXT,
  tenant_phone TEXT,
  landlord_name TEXT,
  current_lease_end DATE NOT NULL,
  proposed_new_rent NUMERIC(10,2),
  agreed_new_rent NUMERIC(10,2),
  new_lease_start DATE,
  new_lease_end DATE,
  status public.renewal_status DEFAULT 'pending'::public.renewal_status,
  assigned_agent TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 4. COMMISSION TRACKING TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.commission_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT NOT NULL,
  property_ref TEXT NOT NULL,
  property_address TEXT,
  tenant_name TEXT,
  commission_type TEXT NOT NULL DEFAULT 'new_listing',
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'HKD',
  month_year TEXT NOT NULL,
  notes TEXT,
  paid BOOLEAN DEFAULT false,
  paid_date DATE,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 5. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_maintenance_property_ref ON public.maintenance_requests(property_ref);
CREATE INDEX IF NOT EXISTS idx_maintenance_status ON public.maintenance_requests(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_priority ON public.maintenance_requests(priority);
CREATE INDEX IF NOT EXISTS idx_lease_renewals_property_ref ON public.lease_renewals(property_ref);
CREATE INDEX IF NOT EXISTS idx_lease_renewals_status ON public.lease_renewals(status);
CREATE INDEX IF NOT EXISTS idx_commission_agent ON public.commission_tracking(agent_name);
CREATE INDEX IF NOT EXISTS idx_commission_month ON public.commission_tracking(month_year);

-- ============================================================
-- 6. ENABLE RLS
-- ============================================================

ALTER TABLE public.maintenance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lease_renewals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_tracking ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 7. RLS POLICIES
-- ============================================================

DROP POLICY IF EXISTS "authenticated_all_maintenance" ON public.maintenance_requests;
CREATE POLICY "authenticated_all_maintenance"
  ON public.maintenance_requests FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_all_lease_renewals" ON public.lease_renewals;
CREATE POLICY "authenticated_all_lease_renewals"
  ON public.lease_renewals FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_all_commission" ON public.commission_tracking;
CREATE POLICY "authenticated_all_commission"
  ON public.commission_tracking FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ============================================================
-- 8. UPDATED_AT TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS set_updated_at_maintenance ON public.maintenance_requests;
CREATE TRIGGER set_updated_at_maintenance
  BEFORE UPDATE ON public.maintenance_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_lease_renewals ON public.lease_renewals;
CREATE TRIGGER set_updated_at_lease_renewals
  BEFORE UPDATE ON public.lease_renewals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_commission ON public.commission_tracking;
CREATE TRIGGER set_updated_at_commission
  BEFORE UPDATE ON public.commission_tracking
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
