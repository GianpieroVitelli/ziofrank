-- Add phone column to profiles if not exists
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;

-- Create customer_notes table
CREATE TABLE IF NOT EXISTS public.customer_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  note text NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- Enable RLS on customer_notes
ALTER TABLE public.customer_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customer_notes
CREATE POLICY "Owners can view all customer notes"
  ON public.customer_notes
  FOR SELECT
  USING (has_role(auth.uid(), 'PROPRIETARIO'::app_role));

CREATE POLICY "Owners can insert customer notes"
  ON public.customer_notes
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'PROPRIETARIO'::app_role));

CREATE POLICY "Owners can update customer notes"
  ON public.customer_notes
  FOR UPDATE
  USING (has_role(auth.uid(), 'PROPRIETARIO'::app_role));

CREATE POLICY "Owners can delete customer notes"
  ON public.customer_notes
  FOR DELETE
  USING (has_role(auth.uid(), 'PROPRIETARIO'::app_role));

-- Create v_customers view
CREATE OR REPLACE VIEW public.v_customers AS
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

-- Grant select on view to authenticated users with owner role
GRANT SELECT ON public.v_customers TO authenticated;