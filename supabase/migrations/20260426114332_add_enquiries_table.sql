-- Homes R Us: Public enquiries table
-- Visitors can submit enquiries without authentication

CREATE TABLE IF NOT EXISTS public.enquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_name TEXT NOT NULL,
  visitor_email TEXT NOT NULL,
  visitor_phone TEXT,
  message TEXT NOT NULL,
  property_ref TEXT,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_enquiries_property_id ON public.enquiries(property_id);
CREATE INDEX IF NOT EXISTS idx_enquiries_created_at ON public.enquiries(created_at DESC);

ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;

-- Allow anyone (public) to insert enquiries (no auth required)
DROP POLICY IF EXISTS "public_insert_enquiries" ON public.enquiries;
CREATE POLICY "public_insert_enquiries"
ON public.enquiries
FOR INSERT
TO public
WITH CHECK (true);

-- Only authenticated users (agents) can read enquiries
DROP POLICY IF EXISTS "authenticated_read_enquiries" ON public.enquiries;
CREATE POLICY "authenticated_read_enquiries"
ON public.enquiries
FOR SELECT
TO authenticated
USING (true);

-- Only authenticated users can update (mark as read)
DROP POLICY IF EXISTS "authenticated_update_enquiries" ON public.enquiries;
CREATE POLICY "authenticated_update_enquiries"
ON public.enquiries
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
