-- Completed Tenancies: archive for closed tenancies with handover notes

CREATE TABLE IF NOT EXISTS public.completed_tenancies (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_ref      TEXT NOT NULL,
  property_address  TEXT NOT NULL,
  tenant_name       TEXT NOT NULL,
  landlord_name     TEXT,
  lease_start       TEXT,
  lease_end         TEXT,
  actual_end_date   DATE NOT NULL,
  monthly_rent      INTEGER,
  handover_notes    TEXT,
  deposit_returned  BOOLEAN DEFAULT false,
  keys_returned     BOOLEAN DEFAULT false,
  utilities_settled BOOLEAN DEFAULT false,
  agent_name        TEXT,
  archived_by       UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  archived_at       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_completed_tenancies_property_ref ON public.completed_tenancies(property_ref);
CREATE INDEX IF NOT EXISTS idx_completed_tenancies_archived_at  ON public.completed_tenancies(archived_at DESC);
CREATE INDEX IF NOT EXISTS idx_completed_tenancies_archived_by  ON public.completed_tenancies(archived_by);

ALTER TABLE public.completed_tenancies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_manage_completed_tenancies" ON public.completed_tenancies;
CREATE POLICY "authenticated_manage_completed_tenancies"
  ON public.completed_tenancies
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
