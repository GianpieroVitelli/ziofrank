-- 1. Creare tabella services
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 45,
  price DECIMAL(10,2),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Creare tabella appointment_services (many-to-many)
CREATE TABLE public.appointment_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  duration_at_booking INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(appointment_id, service_id)
);

-- 3. Aggiungere colonna show_prices_to_customers a shop_settings
ALTER TABLE public.shop_settings ADD COLUMN show_prices_to_customers BOOLEAN NOT NULL DEFAULT true;

-- 4. Abilitare RLS
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_services ENABLE ROW LEVEL SECURITY;

-- 5. RLS policies per services
-- Tutti possono vedere i servizi attivi
CREATE POLICY "Everyone can view active services"
ON public.services
FOR SELECT
USING (is_active = true OR has_role(auth.uid(), 'PROPRIETARIO'::app_role));

-- Solo proprietario può gestire i servizi
CREATE POLICY "Owners can manage services"
ON public.services
FOR ALL
USING (has_role(auth.uid(), 'PROPRIETARIO'::app_role))
WITH CHECK (has_role(auth.uid(), 'PROPRIETARIO'::app_role));

-- 6. RLS policies per appointment_services
-- Utenti possono vedere i servizi dei propri appuntamenti
CREATE POLICY "Users can view their appointment services"
ON public.appointment_services
FOR SELECT
USING (
  has_role(auth.uid(), 'PROPRIETARIO'::app_role) 
  OR EXISTS (
    SELECT 1 FROM public.appointments 
    WHERE appointments.id = appointment_services.appointment_id 
    AND appointments.user_id = auth.uid()
  )
);

-- Utenti possono inserire servizi per i propri appuntamenti
CREATE POLICY "Users can insert appointment services"
ON public.appointment_services
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'PROPRIETARIO'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.appointments 
    WHERE appointments.id = appointment_services.appointment_id 
    AND appointments.user_id = auth.uid()
  )
);

-- Solo proprietario può eliminare/modificare appointment_services
CREATE POLICY "Owners can manage appointment services"
ON public.appointment_services
FOR ALL
USING (has_role(auth.uid(), 'PROPRIETARIO'::app_role));

-- 7. Trigger per updated_at su services
CREATE TRIGGER update_services_updated_at
BEFORE UPDATE ON public.services
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Inserire servizio di default "Taglio Classico"
INSERT INTO public.services (name, duration_minutes, price, description, is_active, sort_order)
VALUES ('Taglio Classico', 45, 20.00, 'Taglio capelli tradizionale', true, 0);