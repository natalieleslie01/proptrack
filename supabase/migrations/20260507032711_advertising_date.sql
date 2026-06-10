-- PropTrack HK — Advertising Date Migration
-- Adds advertising_date to properties and creates advertising_reminders table

-- ============================================================
-- 1. ADD ADVERTISING DATE TO PROPERTIES TABLE
-- ============================================================

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS advertising_date DATE,
  ADD COLUMN IF NOT EXISTS advertising_agent TEXT,
  ADD COLUMN IF NOT EXISTS advertising_workflow_type TEXT; -- 'sales' or 'tenancy'

-- ============================================================
-- 2. CREATE ADVERTISING REMINDERS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.advertising_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_ref TEXT NOT NULL,
  property_address TEXT,
  advertising_date DATE NOT NULL,
  reminder_due_date DATE NOT NULL, -- advertising_date + 3 months
  agent_name TEXT,
  agent_email TEXT,
  workflow_type TEXT NOT NULL DEFAULT 'sales', -- 'sales' or 'tenancy'
  reminder_sent BOOLEAN DEFAULT false,
  reminder_sent_at TIMESTAMPTZ,
  property_status TEXT DEFAULT 'active', -- 'active', 'sold', 'leased'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 3. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_advertising_reminders_property_ref ON public.advertising_reminders(property_ref);
CREATE INDEX IF NOT EXISTS idx_advertising_reminders_due_date ON public.advertising_reminders(reminder_due_date);
CREATE INDEX IF NOT EXISTS idx_advertising_reminders_sent ON public.advertising_reminders(reminder_sent);

-- ============================================================
-- 4. ENABLE RLS
-- ============================================================

ALTER TABLE public.advertising_reminders ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. RLS POLICIES
-- ============================================================

DROP POLICY IF EXISTS "authenticated_all_advertising_reminders" ON public.advertising_reminders;
CREATE POLICY "authenticated_all_advertising_reminders"
  ON public.advertising_reminders FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ============================================================
-- 6. UPDATED_AT TRIGGER
-- ============================================================

DROP TRIGGER IF EXISTS set_updated_at_advertising_reminders ON public.advertising_reminders;
CREATE TRIGGER set_updated_at_advertising_reminders
  BEFORE UPDATE ON public.advertising_reminders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
