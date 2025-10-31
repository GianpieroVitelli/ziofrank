-- Create RPC function to get customers with search and sort
CREATE OR REPLACE FUNCTION public.get_customers(
  search_query text DEFAULT NULL,
  sort_order text DEFAULT 'alpha'
)
RETURNS TABLE (
  id uuid,
  display_name text,
  email text,
  phone text,
  last_appointment_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.name as display_name,
    p.email,
    p.phone,
    (
      SELECT MAX(a.start_time)
      FROM public.appointments a
      WHERE a.user_id = p.id
        AND a.status = 'CONFIRMED'::appointment_status
    ) as last_appointment_at
  FROM public.profiles p
  WHERE EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p.id AND ur.role = 'UTENTE'::app_role
  )
  AND (
    search_query IS NULL 
    OR p.name ILIKE '%' || search_query || '%'
    OR p.email ILIKE '%' || search_query || '%'
    OR p.phone ILIKE '%' || search_query || '%'
  )
  ORDER BY
    CASE 
      WHEN sort_order = 'alpha' THEN LOWER(p.name)
      ELSE NULL
    END ASC NULLS LAST,
    CASE 
      WHEN sort_order = 'last' THEN (
        SELECT MAX(a.start_time)
        FROM public.appointments a
        WHERE a.user_id = p.id
          AND a.status = 'CONFIRMED'::appointment_status
      )
      ELSE NULL
    END DESC NULLS LAST,
    CASE 
      WHEN sort_order = 'last' THEN LOWER(p.name)
      ELSE NULL
    END ASC;
$$;