-- Aggiorna il link del sito web con il dominio Lovable
UPDATE shop_settings
SET website_url = 'https://ziofrank.lovable.app'
WHERE id IS NOT NULL;