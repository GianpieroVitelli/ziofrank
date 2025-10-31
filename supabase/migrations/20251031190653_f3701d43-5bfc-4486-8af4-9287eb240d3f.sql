-- Create function to cancel appointment with 24h rule
CREATE OR REPLACE FUNCTION cancel_appointment(p_appointment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec appointments%rowtype;
  v_user_id uuid;
  v_is_owner boolean;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  -- Check if user is owner
  v_is_owner := has_role(v_user_id, 'PROPRIETARIO'::app_role);
  
  -- Get appointment with lock
  SELECT * INTO v_rec FROM appointments WHERE id = p_appointment_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appuntamento non trovato';
  END IF;

  -- Check if user is authorized (owner or appointment owner)
  IF NOT v_is_owner AND v_rec.user_id != v_user_id THEN
    RAISE EXCEPTION 'Non autorizzato';
  END IF;

  -- Block cancellation < 24h for regular users
  IF NOT v_is_owner AND now() > (v_rec.start_time - interval '24 hours') THEN
    RAISE EXCEPTION 'Non è più possibile annullare: mancano meno di 24 ore all''appuntamento. Contatta il negozio per urgenze.';
  END IF;

  -- Update appointment status
  UPDATE appointments
     SET status = 'CANCELED',
         updated_at = now()
   WHERE id = p_appointment_id;
   
  -- Return success with appointment data
  RETURN jsonb_build_object(
    'success', true,
    'appointment_id', p_appointment_id,
    'client_email', v_rec.client_email,
    'client_name', v_rec.client_name,
    'start_time', v_rec.start_time
  );
END;
$$;

-- Update RLS policies for appointments
DROP POLICY IF EXISTS "Users can cancel their own appointments" ON appointments;

CREATE POLICY "Users can cancel their own appointments within 24h"
ON appointments
FOR UPDATE
USING (
  auth.uid() = user_id 
  AND now() <= (start_time - interval '24 hours')
)
WITH CHECK (status = 'CANCELED'::appointment_status);

CREATE POLICY "Owners can cancel any appointment anytime"
ON appointments
FOR UPDATE
USING (has_role(auth.uid(), 'PROPRIETARIO'::app_role))
WITH CHECK (true);