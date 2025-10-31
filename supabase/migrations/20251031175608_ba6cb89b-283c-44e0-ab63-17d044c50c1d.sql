-- Recreate v_customers view with SECURITY INVOKER to fix linter warning
DROP VIEW IF EXISTS public.v_customers;

CREATE OR REPLACE VIEW public.v_customers 
WITH (security_invoker = true)
AS
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
);

-- Grant select on view
GRANT SELECT ON public.v_customers TO authenticated;