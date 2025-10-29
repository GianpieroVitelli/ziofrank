-- Aggiorna le impostazioni del negozio con il dominio personalizzato jesterwer.it
UPDATE shop_settings
SET 
  email_from = 'noreply@jesterwer.it',
  website_url = 'https://jesterwer.it'
WHERE id IS NOT NULL;