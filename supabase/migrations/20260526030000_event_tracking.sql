-- Event tracking table for logging key user actions
CREATE TABLE IF NOT EXISTS public.event_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_event_tracking_event_type ON public.event_tracking(event_type);
CREATE INDEX IF NOT EXISTS idx_event_tracking_user_id ON public.event_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_event_tracking_created_at ON public.event_tracking(created_at DESC);

ALTER TABLE public.event_tracking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_insert_events" ON public.event_tracking;
CREATE POLICY "authenticated_insert_events"
ON public.event_tracking
FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "anon_insert_events" ON public.event_tracking;
CREATE POLICY "anon_insert_events"
ON public.event_tracking
FOR INSERT
TO anon
WITH CHECK (true);

DROP POLICY IF EXISTS "users_view_own_events" ON public.event_tracking;
CREATE POLICY "users_view_own_events"
ON public.event_tracking
FOR SELECT
TO authenticated
USING (user_id = auth.uid());
