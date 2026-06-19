-- Property Transactions Migration
-- Tracks sales, leases, and renewals with buyer/tenant, amount, dates, and completion status

DROP TYPE IF EXISTS public.transaction_type CASCADE;
CREATE TYPE public.transaction_type AS ENUM ('sale', 'lease', 'renewal');

DROP TYPE IF EXISTS public.transaction_status CASCADE;
CREATE TYPE public.transaction_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled', 'fallen_through');

CREATE TABLE IF NOT EXISTS public.property_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_ref TEXT NOT NULL,
  property_address TEXT,
  village TEXT DEFAULT 'Discovery Bay',
  district TEXT,
  transaction_type public.transaction_type NOT NULL DEFAULT 'lease'::public.transaction_type,
  party_name TEXT NOT NULL,
  party_phone TEXT,
  party_email TEXT,
  agent_name TEXT,
  amount NUMERIC,
  currency TEXT DEFAULT 'HKD',
  transaction_date DATE,
  completion_date DATE,
  status public.transaction_status NOT NULL DEFAULT 'pending'::public.transaction_status,
  notes TEXT,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_property_transactions_property_ref ON public.property_transactions(property_ref);
CREATE INDEX IF NOT EXISTS idx_property_transactions_type ON public.property_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_property_transactions_status ON public.property_transactions(status);
CREATE INDEX IF NOT EXISTS idx_property_transactions_district ON public.property_transactions(district);
CREATE INDEX IF NOT EXISTS idx_property_transactions_created_at ON public.property_transactions(created_at DESC);

ALTER TABLE public.property_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_transactions" ON public.property_transactions;
CREATE POLICY "authenticated_read_transactions"
ON public.property_transactions
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "authenticated_insert_transactions" ON public.property_transactions;
CREATE POLICY "authenticated_insert_transactions"
ON public.property_transactions
FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_update_transactions" ON public.property_transactions;
CREATE POLICY "authenticated_update_transactions"
ON public.property_transactions
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_delete_transactions" ON public.property_transactions;
CREATE POLICY "authenticated_delete_transactions"
ON public.property_transactions
FOR DELETE
TO authenticated
USING (true);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_property_transactions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_property_transactions_updated_at ON public.property_transactions;
CREATE TRIGGER trg_property_transactions_updated_at
BEFORE UPDATE ON public.property_transactions
FOR EACH ROW EXECUTE FUNCTION public.update_property_transactions_updated_at();

-- Sample data
DO $$
DECLARE
  existing_user_id UUID;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_profiles'
  ) THEN
    SELECT id INTO existing_user_id FROM public.user_profiles LIMIT 1;

    IF existing_user_id IS NOT NULL THEN
      INSERT INTO public.property_transactions (id, property_ref, property_address, village, district, transaction_type, party_name, party_phone, agent_name, amount, currency, transaction_date, completion_date, status, notes, created_by)
      VALUES
        (gen_random_uuid(), 'DB-001', '1 Seabee Lane, Discovery Bay', 'Discovery Bay', 'Lantau Island', 'sale'::public.transaction_type, 'James Wong', '+852 9123 4567', 'Natalie Leslie', 8500000, 'HKD', '2026-03-15', '2026-05-01', 'completed'::public.transaction_status, 'Smooth transaction, buyer paid full amount.', existing_user_id),
        (gen_random_uuid(), 'DB-002', '5 Headland Drive, Discovery Bay', 'Discovery Bay', 'Lantau Island', 'lease'::public.transaction_type, 'Sarah Chen', '+852 9234 5678', 'Natalie Leslie', 28000, 'HKD', '2026-04-01', '2026-04-15', 'completed'::public.transaction_status, '2-year lease signed.', existing_user_id),
        (gen_random_uuid(), 'DB-003', '12 Siena Avenue, Discovery Bay', 'Discovery Bay', 'Lantau Island', 'renewal'::public.transaction_type, 'Michael Lam', '+852 9345 6789', 'Natalie Leslie', 32000, 'HKD', '2026-05-10', NULL, 'in_progress'::public.transaction_status, 'Renewal negotiation ongoing.', existing_user_id),
        (gen_random_uuid(), 'DB-004', '8 Bijou Hamlet, Discovery Bay', 'Discovery Bay', 'Lantau Island', 'sale'::public.transaction_type, 'Emily Ng', '+852 9456 7890', 'Natalie Leslie', 12000000, 'HKD', '2026-05-20', NULL, 'in_progress'::public.transaction_status, 'Awaiting mortgage approval.', existing_user_id),
        (gen_random_uuid(), 'DB-005', '3 Greenbelt, Discovery Bay', 'Discovery Bay', 'Lantau Island', 'lease'::public.transaction_type, 'David Park', '+852 9567 8901', 'Natalie Leslie', 22000, 'HKD', '2026-06-01', NULL, 'pending'::public.transaction_status, 'Viewing completed, offer pending.', existing_user_id),
        (gen_random_uuid(), 'DB-006', '20 Parkvale, Discovery Bay', 'Discovery Bay', 'Lantau Island', 'renewal'::public.transaction_type, 'Linda Ho', '+852 9678 9012', 'Natalie Leslie', 35000, 'HKD', '2026-06-05', '2026-07-01', 'completed'::public.transaction_status, 'Renewal signed at agreed rent.', existing_user_id),
        (gen_random_uuid(), 'DB-007', '15 Chianti Drive, Discovery Bay', 'Discovery Bay', 'Lantau Island', 'sale'::public.transaction_type, 'Robert Tsang', '+852 9789 0123', 'Natalie Leslie', 9800000, 'HKD', '2026-04-12', NULL, 'cancelled'::public.transaction_status, 'Buyer withdrew due to financing issues.', existing_user_id),
        (gen_random_uuid(), 'DB-008', '7 Positano, Discovery Bay', 'Discovery Bay', 'Lantau Island', 'lease'::public.transaction_type, 'Anna Cheung', '+852 9890 1234', 'Natalie Leslie', 26500, 'HKD', '2026-06-10', NULL, 'pending'::public.transaction_status, 'Lease terms under review.', existing_user_id)
      ON CONFLICT (id) DO NOTHING;
    ELSE
      RAISE NOTICE 'No existing users found. Sample data skipped.';
    END IF;
  ELSE
    RAISE NOTICE 'Table user_profiles does not exist. Sample data skipped.';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Sample data insertion failed: %', SQLERRM;
END $$;
