-- Tabella per gestire aperture/chiusure straordinarie
CREATE TABLE IF NOT EXISTS public.day_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day date NOT NULL UNIQUE,
  state text NOT NULL CHECK (state IN ('OPEN', 'CLOSED')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Tabella per bloccare singoli slot da 45 minuti
CREATE TABLE IF NOT EXISTS public.slot_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(day, start_time),
  CHECK (end_time > start_time)
);

-- Aggiunta colonna is_blocked alla tabella profiles per bloccare clienti
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false;

-- Enable RLS
ALTER TABLE public.day_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slot_blocks ENABLE ROW LEVEL SECURITY;

-- Politiche RLS per day_overrides
-- Tutti possono leggere gli override per vedere le aperture/chiusure
CREATE POLICY "Everyone can view day overrides"
ON public.day_overrides
FOR SELECT
USING (true);

-- Solo i proprietari possono gestire gli override
CREATE POLICY "Owners can manage day overrides"
ON public.day_overrides
FOR ALL
USING (has_role(auth.uid(), 'PROPRIETARIO'::app_role));

-- Politiche RLS per slot_blocks
-- Tutti possono leggere i blocchi per vedere gli slot non disponibili
CREATE POLICY "Everyone can view slot blocks"
ON public.slot_blocks
FOR SELECT
USING (true);

-- Solo i proprietari possono gestire i blocchi
CREATE POLICY "Owners can manage slot blocks"
ON public.slot_blocks
FOR ALL
USING (has_role(auth.uid(), 'PROPRIETARIO'::app_role));

-- Policy per impedire ai clienti bloccati di creare prenotazioni
CREATE POLICY "Blocked users cannot create appointments"
ON public.appointments
FOR INSERT
WITH CHECK (
  NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = appointments.user_id
      AND profiles.is_blocked = true
  )
);