-- Remove existing cron job if it exists
SELECT cron.unschedule('daily-appointment-reminders');

-- Create cron job for same-day reminders (every day at 8:00 AM)
SELECT cron.schedule(
  'same-day-reminders',
  '0 8 * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://mebkikuipavdlvkbfull.supabase.co/functions/v1/send-daily-reminders',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lYmtpa3VpcGF2ZGx2a2JmdWxsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1ODQyNjIsImV4cCI6MjA3NzE2MDI2Mn0.zqXIFo2L7O3kwvF53L28lMqgMJV0OrxdxuVSnBOD13k"}'::jsonb,
      body := '{"days_ahead": 0}'::jsonb
    ) as request_id;
  $$
);

-- Create cron job for day-before reminders (every day at 10:00 AM)
SELECT cron.schedule(
  'day-before-reminders',
  '0 10 * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://mebkikuipavdlvkbfull.supabase.co/functions/v1/send-daily-reminders',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lYmtpa3VpcGF2ZGx2a2JmdWxsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1ODQyNjIsImV4cCI6MjA3NzE2MDI2Mn0.zqXIFo2L7O3kwvF53L28lMqgMJV0OrxdxuVSnBOD13k"}'::jsonb,
      body := '{"days_ahead": 1}'::jsonb
    ) as request_id;
  $$
);