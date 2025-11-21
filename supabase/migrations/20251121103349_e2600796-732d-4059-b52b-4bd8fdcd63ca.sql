-- Add reminder_hour_next_day column to shop_settings
ALTER TABLE shop_settings 
ADD COLUMN reminder_hour_next_day INTEGER DEFAULT 10;

COMMENT ON COLUMN shop_settings.reminder_hour_next_day IS 'Orario (0-23) per l''invio dei reminder per appuntamenti del giorno successivo (inviati il giorno prima)';

-- Update existing row to set the value
UPDATE shop_settings 
SET reminder_hour_next_day = 10 
WHERE reminder_hour_next_day IS NULL;