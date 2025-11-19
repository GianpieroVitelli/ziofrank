-- Funzione per ottenere gli slot occupati senza RLS
-- Restituisce solo start_time e end_time per proteggere i dati sensibili
CREATE OR REPLACE FUNCTION public.get_busy_slots(p_day date)
RETURNS TABLE(start_time timestamptz, end_time timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    appointments.start_time,
    appointments.end_time
  FROM public.appointments
  WHERE appointments.status = 'CONFIRMED'
    AND appointments.is_bonus = false
    AND appointments.start_time >= p_day::timestamptz
    AND appointments.start_time < (p_day + interval '1 day')::timestamptz
  ORDER BY appointments.start_time;
$$;