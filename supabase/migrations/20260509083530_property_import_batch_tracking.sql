-- PropTrack HK — Import Batch Tracking Migration
-- Creates: import_history table
-- Modifies: properties table (adds import_batch_id, validation_status)

-- ============================================================
-- 1. CREATE import_history TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.import_history (
  id TEXT PRIMARY KEY,
  import_type TEXT NOT NULL DEFAULT 'csv',
  filename TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  total_records INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  skipped_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  imported_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  notes TEXT,
  imported_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 2. ADD COLUMNS TO properties TABLE
-- ============================================================

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS import_batch_id TEXT REFERENCES public.import_history(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS validation_status TEXT DEFAULT 'valid';

-- ============================================================
-- 3. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_import_history_imported_at ON public.import_history(imported_at DESC);
CREATE INDEX IF NOT EXISTS idx_properties_import_batch_id ON public.properties(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_properties_validation_status ON public.properties(validation_status);

-- ============================================================
-- 4. ENABLE RLS
-- ============================================================

ALTER TABLE public.import_history ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. RLS POLICIES
-- ============================================================

DROP POLICY IF EXISTS "authenticated_all_import_history" ON public.import_history;
CREATE POLICY "authenticated_all_import_history"
  ON public.import_history FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
