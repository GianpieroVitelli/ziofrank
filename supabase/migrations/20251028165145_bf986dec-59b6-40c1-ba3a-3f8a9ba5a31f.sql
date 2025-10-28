-- Create news_status enum
CREATE TYPE public.news_status AS ENUM ('DRAFT', 'PUBLISHED');

-- Create news table
CREATE TABLE public.news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status news_status NOT NULL DEFAULT 'DRAFT',
  is_featured BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create blocks table (for closed time slots)
CREATE TABLE public.blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Add missing fields to shop_settings
ALTER TABLE public.shop_settings
ADD COLUMN IF NOT EXISTS description TEXT DEFAULT 'Barbiere professionista a Roma',
ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{"facebook": "", "instagram": "", "whatsapp": ""}'::jsonb;

-- Enable RLS on new tables
ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for news table
CREATE POLICY "Everyone can view published news"
ON public.news
FOR SELECT
USING (status = 'PUBLISHED' OR has_role(auth.uid(), 'PROPRIETARIO'));

CREATE POLICY "Only owners can manage news"
ON public.news
FOR ALL
USING (has_role(auth.uid(), 'PROPRIETARIO'));

-- RLS Policies for blocks table
CREATE POLICY "Everyone can view blocks"
ON public.blocks
FOR SELECT
USING (true);

CREATE POLICY "Only owners can manage blocks"
ON public.blocks
FOR ALL
USING (has_role(auth.uid(), 'PROPRIETARIO'));

-- Update trigger for news
CREATE TRIGGER update_news_updated_at
BEFORE UPDATE ON public.news
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance
CREATE INDEX idx_news_status_published ON public.news(status, published_at DESC) WHERE status = 'PUBLISHED';
CREATE INDEX idx_blocks_time_range ON public.blocks(start_time, end_time);

-- Update appointments RLS for better privacy
-- Drop existing policies that might expose data
DROP POLICY IF EXISTS "Users can view their own appointments" ON public.appointments;

-- Recreate with stricter privacy
CREATE POLICY "Users can view only their own appointments"
ON public.appointments
FOR SELECT
USING (
  has_role(auth.uid(), 'PROPRIETARIO') 
  OR auth.uid() = user_id
);

-- Update appointment creation policy to allow walk-in (null user_id) only by owner
DROP POLICY IF EXISTS "Authenticated users can create appointments" ON public.appointments;

CREATE POLICY "Users can create their own appointments"
ON public.appointments
FOR INSERT
WITH CHECK (
  (auth.uid() = user_id AND user_id IS NOT NULL) 
  OR has_role(auth.uid(), 'PROPRIETARIO')
);