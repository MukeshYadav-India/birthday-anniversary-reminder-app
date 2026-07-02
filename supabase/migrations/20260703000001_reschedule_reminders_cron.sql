-- Migration: reschedule reminders cron to run every 2 hours

-- Remove the previous daily job
SELECT cron.unschedule('send-daily-reminders')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'send-daily-reminders'
);

-- Schedule: every 2 hours
SELECT cron.schedule(
  'send-reminders-every-2h',
  '0 */2 * * *',
  $$
    SELECT
      net.http_post(
        url     := current_setting('app.supabase_url') || '/functions/v1/send-reminders',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || current_setting('app.service_role_key')
        ),
        body    := '{}'::jsonb
      )
    AS request_id;
  $$
);

-- Verify
SELECT jobname, schedule, command FROM cron.job WHERE jobname = 'send-reminders-every-2h';
