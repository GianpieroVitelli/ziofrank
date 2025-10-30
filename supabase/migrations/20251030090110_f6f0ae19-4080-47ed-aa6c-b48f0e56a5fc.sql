-- Correggi il dominio email con il nome corretto
UPDATE shop_settings
SET email_from = 'noreply@jesterwear.it'
WHERE id IS NOT NULL;