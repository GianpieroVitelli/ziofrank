-- Drop and recreate the policy for slot_blocks to include WITH CHECK
DROP POLICY IF EXISTS "Owners can manage slot blocks" ON slot_blocks;

-- Create new policy with both USING and WITH CHECK
CREATE POLICY "Owners can manage slot blocks"
ON slot_blocks
FOR ALL
USING (has_role(auth.uid(), 'PROPRIETARIO'::app_role))
WITH CHECK (has_role(auth.uid(), 'PROPRIETARIO'::app_role));