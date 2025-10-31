-- Create storage bucket for customer photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('customer-photos', 'customer-photos', false);

-- Add customer_photo column to profiles table
ALTER TABLE public.profiles
ADD COLUMN customer_photo TEXT;

-- Create RLS policies for customer photos bucket
-- Only owners can upload customer photos
CREATE POLICY "Owners can upload customer photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'customer-photos' 
  AND has_role(auth.uid(), 'PROPRIETARIO'::app_role)
);

-- Only owners can view customer photos
CREATE POLICY "Owners can view customer photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'customer-photos' 
  AND has_role(auth.uid(), 'PROPRIETARIO'::app_role)
);

-- Only owners can update customer photos
CREATE POLICY "Owners can update customer photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'customer-photos' 
  AND has_role(auth.uid(), 'PROPRIETARIO'::app_role)
);

-- Only owners can delete customer photos
CREATE POLICY "Owners can delete customer photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'customer-photos' 
  AND has_role(auth.uid(), 'PROPRIETARIO'::app_role)
);

-- Allow owners to update customer_photo column
CREATE POLICY "Owners can update customer photos in profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'PROPRIETARIO'::app_role))
WITH CHECK (has_role(auth.uid(), 'PROPRIETARIO'::app_role));