-- Add website_url to shop_settings
ALTER TABLE public.shop_settings 
ADD COLUMN website_url text DEFAULT 'https://tuosito.it' NOT NULL;