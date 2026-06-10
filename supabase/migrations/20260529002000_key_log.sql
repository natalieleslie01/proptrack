-- Key Log table: tracks physical keys held by the agency for each property
CREATE TABLE IF NOT EXISTS public.key_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_ref    TEXT,
  property_label  TEXT NOT NULL,
  key_number      TEXT,
  key_type        TEXT NOT NULL DEFAULT 'Main Door',
  held_by         TEXT,
  collected_date  DATE,
  returned_date   DATE,
  notes           TEXT,
  status          TEXT NOT NULL DEFAULT 'held',  -- 'held' | 'returned' | 'missing'
  created_by      UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_key_log_property_ref ON public.key_log(property_ref);
CREATE INDEX IF NOT EXISTS idx_key_log_status ON public.key_log(status);

ALTER TABLE public.key_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_manage_key_log" ON public.key_log;
CREATE POLICY "authenticated_manage_key_log"
ON public.key_log
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Seed a handful of demo rows so the widget is visible immediately
DO $$
BEGIN
  INSERT INTO public.key_log (property_label, property_ref, key_number, key_type, held_by, collected_date, status, notes)
  VALUES
    ('Seabird Lane — Floor 3 Flat A', 'SBL-3A', 'K-001', 'Main Door', 'Nicola Baird',   '2026-04-10', 'held',     'Collected at lease signing'),
    ('Seabird Lane — Floor 5 Flat C', 'SBL-5C', 'K-002', 'Main Door', 'Cris Yan',       '2026-04-22', 'held',     NULL),
    ('High Rise Block B — Floor 8 Flat D', 'HRB-8D', 'K-003', 'Letterbox', 'Natalie Leslie', '2026-05-01', 'held', 'Letterbox + main door set'),
    ('Seabird Lane — Floor 2 Flat B', 'SBL-2B', 'K-004', 'Main Door', 'Nicola Baird',   '2026-03-15', 'returned', 'Returned to landlord on lease end'),
    ('High Rise Block A — Floor 12 Flat E', 'HRA-12E', 'K-005', 'Car Park', 'Cris Yan', '2026-05-18', 'held',     'Car park remote + main door'),
    ('Seabird Lane — Floor 7 Flat F', 'SBL-7F', 'K-006', 'Main Door', 'Natalie Leslie', '2026-05-20', 'held',     NULL)
  ON CONFLICT (id) DO NOTHING;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Key log seed data skipped: %', SQLERRM;
END $$;
