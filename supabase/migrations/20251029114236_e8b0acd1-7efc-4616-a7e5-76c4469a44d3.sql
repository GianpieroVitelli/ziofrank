-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA extensions TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA extensions TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- Create cron job for daily appointment reminders
-- Runs every day at 8:00 AM (can be adjusted via shop_settings.reminder_hour in the future)
SELECT cron.schedule(
  'daily-appointment-reminders',
  '0 8 * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://mebkikuipavdlvkbfull.supabase.co/functions/v1/send-daily-reminders',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lYmtpa3VpcGF2ZGx2a2JmdWxsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1ODQyNjIsImV4cCI6MjA3NzE2MDI2Mn0.zqXIFo2L7O3kwvF53L28lMqgMJV0OrxdxuVSnBOD13k"}'::jsonb,
      body := '{}'::jsonb
    ) as request_id;
  $$
);