-- Add agent assignment and follow-up status to enquiries table

-- Add follow_up_status enum type
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'follow_up_status') THEN
    CREATE TYPE public.follow_up_status AS ENUM ('pending', 'replied', 'closed');
  END IF;
END$$;

-- Add assigned_agent_id column
ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS assigned_agent_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;

-- Add follow_up_status column
ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS follow_up_status public.follow_up_status DEFAULT 'pending';

-- Index for agent assignment queries
CREATE INDEX IF NOT EXISTS idx_enquiries_assigned_agent ON public.enquiries(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_enquiries_follow_up_status ON public.enquiries(follow_up_status);
