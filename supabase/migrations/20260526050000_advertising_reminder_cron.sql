-- PropTrack HK — Advertising Reminder Cron Job
-- Sets up pg_cron to call the check-advertising-reminders Edge Function daily at 08:00 HKT (00:00 UTC)

-- ============================================================
-- 1. ENSURE pg_cron EXTENSION IS ENABLED
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================================
-- 2. GRANT USAGE ON cron SCHEMA TO postgres
-- ============================================================

GRANT USAGE ON SCHEMA cron TO postgres;

-- ============================================================
-- 3. ADD publish_dt COLUMN ALIAS INDEX (if not exists)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_advertising_reminders_not_sent
  ON public.advertising_reminders(reminder_due_date, reminder_sent, property_status)
  WHERE reminder_sent = false AND property_status = 'active';

-- ============================================================
-- 4. SCHEDULE DAILY CRON JOB AT 00:00 UTC (08:00 HKT)
-- ============================================================

-- Remove existing job if it exists (idempotent)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'check-advertising-reminders-daily'
  ) THEN
    PERFORM cron.unschedule('check-advertising-reminders-daily');
  END IF;
END $$;

-- Schedule: every day at 00:00 UTC = 08:00 HKT
-- The job calls the Supabase Edge Function via net.http_post (pg_net)
SELECT cron.schedule(
  'check-advertising-reminders-daily',
  '0 0 * * *',
  $$
    SELECT net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/check-advertising-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
      ),
      body := '{}'::jsonb
    );
  $$
);
