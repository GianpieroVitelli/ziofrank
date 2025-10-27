-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('UTENTE', 'PROPRIETARIO');

-- Create enum for appointment status
CREATE TYPE public.appointment_status AS ENUM ('CONFIRMED', 'CANCELED');

-- Create enum for email types
CREATE TYPE public.email_type AS ENUM ('CONFIRMATION', 'REMINDER');

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'UTENTE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- Create profiles table for user info
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create shop_settings table
CREATE TABLE public.shop_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timezone TEXT NOT NULL DEFAULT 'Europe/Rome',
  open_hours JSONB NOT NULL DEFAULT '{
    "mon": [["09:00", "13:00"], ["15:00", "19:00"]],
    "tue": [["09:00", "13:00"], ["15:00", "19:00"]],
    "wed": [["09:00", "13:00"], ["15:00", "19:00"]],
    "thu": [["09:00", "13:00"], ["15:00", "19:00"]],
    "fri": [["09:00", "13:00"], ["15:00", "19:00"]],
    "sat": [["09:00", "13:00"]],
    "sun": []
  }'::jsonb,
  holiday_dates JSONB DEFAULT '[]'::jsonb,
  reminder_hour INTEGER NOT NULL DEFAULT 8,
  address TEXT NOT NULL DEFAULT 'Via Roma 1, 00100 Roma',
  phone TEXT NOT NULL DEFAULT '+39 06 1234567',
  email_from TEXT NOT NULL DEFAULT 'info@ziofrank.it',
  email_bcc TEXT,
  shop_name TEXT NOT NULL DEFAULT 'ZIO FRANK',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create appointments table
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  client_name TEXT,
  client_email TEXT,
  client_phone TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  is_bonus BOOLEAN NOT NULL DEFAULT FALSE,
  status appointment_status NOT NULL DEFAULT 'CONFIRMED',
  notes TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create email_logs table
CREATE TABLE public.email_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE,
  type email_type NOT NULL,
  recipient TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'sent',
  error_message TEXT
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Owners can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'PROPRIETARIO'));

CREATE POLICY "Owners can manage roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'PROPRIETARIO'));

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Owners can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'PROPRIETARIO'));

-- RLS Policies for shop_settings
CREATE POLICY "Everyone can view shop settings"
  ON public.shop_settings FOR SELECT
  USING (true);

CREATE POLICY "Only owners can update shop settings"
  ON public.shop_settings FOR ALL
  USING (public.has_role(auth.uid(), 'PROPRIETARIO'));

-- RLS Policies for appointments
CREATE POLICY "Users can view their own appointments"
  ON public.appointments FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Authenticated users can create appointments"
  ON public.appointments FOR INSERT
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'PROPRIETARIO'));

CREATE POLICY "Owners can view all appointments"
  ON public.appointments FOR SELECT
  USING (public.has_role(auth.uid(), 'PROPRIETARIO'));

CREATE POLICY "Owners can manage all appointments"
  ON public.appointments FOR ALL
  USING (public.has_role(auth.uid(), 'PROPRIETARIO'));

CREATE POLICY "Users can cancel their own appointments"
  ON public.appointments FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (status = 'CANCELED');

-- RLS Policies for email_logs
CREATE POLICY "Owners can view email logs"
  ON public.email_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'PROPRIETARIO'));

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'UTENTE');
  
  RETURN NEW;
END;
$$;

-- Trigger for new user
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE PLPGSQL
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_shop_settings_updated_at
  BEFORE UPDATE ON public.shop_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default shop settings
INSERT INTO public.shop_settings (id) VALUES (uuid_generate_v4());

-- Create index for appointments overlap checking
CREATE INDEX idx_appointments_time_range ON public.appointments(start_time, end_time) WHERE status = 'CONFIRMED' AND is_bonus = FALSE;

-- Create index for appointment lookups
CREATE INDEX idx_appointments_user_id ON public.appointments(user_id);
CREATE INDEX idx_appointments_start_time ON public.appointments(start_time);