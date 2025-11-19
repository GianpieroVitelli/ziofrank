-- Funzione per verificare sovrapposizioni tra appuntamenti NON-bonus
CREATE OR REPLACE FUNCTION public.check_appointment_overlap()
RETURNS TRIGGER AS $$
BEGIN
  -- Verifica solo se l'appuntamento è NON-bonus e CONFIRMED
  IF NEW.is_bonus = false AND NEW.status = 'CONFIRMED' THEN
    -- Verifica se esiste un appuntamento confermato NON-bonus che si sovrappone
    IF EXISTS (
      SELECT 1 
      FROM public.appointments 
      WHERE id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND status = 'CONFIRMED'
        AND is_bonus = false
        AND (
          -- Caso 1: Il nuovo appuntamento inizia durante un appuntamento esistente
          (NEW.start_time >= start_time AND NEW.start_time < end_time)
          OR
          -- Caso 2: Il nuovo appuntamento finisce durante un appuntamento esistente
          (NEW.end_time > start_time AND NEW.end_time <= end_time)
          OR
          -- Caso 3: Il nuovo appuntamento contiene completamente un appuntamento esistente
          (NEW.start_time <= start_time AND NEW.end_time >= end_time)
        )
    ) THEN
      RAISE EXCEPTION 'Slot non disponibile: esiste già un appuntamento in questo orario';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger su INSERT
CREATE TRIGGER prevent_appointment_overlap_insert
  BEFORE INSERT ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.check_appointment_overlap();

-- Trigger su UPDATE
CREATE TRIGGER prevent_appointment_overlap_update
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.check_appointment_overlap();