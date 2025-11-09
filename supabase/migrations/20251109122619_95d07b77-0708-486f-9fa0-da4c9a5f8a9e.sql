-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'tester', 'repairman');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check user role
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
  )
$$;

-- Create profiles table for user information
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create products table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chassis_no TEXT UNIQUE NOT NULL,
  product_name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view products
CREATE POLICY "Authenticated users can view products"
  ON public.products FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can insert products
CREATE POLICY "Admins can insert products"
  ON public.products FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create vehicle types and models tables
CREATE TABLE public.vehicle_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.vehicle_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view vehicle types"
  ON public.vehicle_types FOR SELECT
  TO authenticated
  USING (true);

CREATE TABLE public.vehicle_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_type_id UUID REFERENCES public.vehicle_types(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(vehicle_type_id, name)
);

ALTER TABLE public.vehicle_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view vehicle models"
  ON public.vehicle_models FOR SELECT
  TO authenticated
  USING (true);

-- Create leakage types enum
CREATE TYPE public.leakage_type AS ENUM ('oil', 'coolant', 'hydraulic', 'fuel', 'air', 'other');

-- Create leakage reports table
CREATE TABLE public.leakage_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  vehicle_type_id UUID REFERENCES public.vehicle_types(id) NOT NULL,
  vehicle_model_id UUID REFERENCES public.vehicle_models(id) NOT NULL,
  tester_id UUID REFERENCES auth.users(id) NOT NULL,
  status TEXT DEFAULT 'pending' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.leakage_reports ENABLE ROW LEVEL SECURITY;

-- RLS policies for leakage reports
CREATE POLICY "Authenticated users can view leakage reports"
  ON public.leakage_reports FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Testers can create leakage reports"
  ON public.leakage_reports FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'tester') AND tester_id = auth.uid());

CREATE POLICY "System can update leakage reports"
  ON public.leakage_reports FOR UPDATE
  TO authenticated
  USING (true);

-- Create leakages table (details of each leakage in a report)
CREATE TABLE public.leakages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES public.leakage_reports(id) ON DELETE CASCADE NOT NULL,
  leakage_type leakage_type NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.leakages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view leakages"
  ON public.leakages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Testers can create leakages"
  ON public.leakages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leakage_reports
      WHERE id = report_id AND tester_id = auth.uid()
    )
  );

-- Create repairs table
CREATE TABLE public.repairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES public.leakage_reports(id) ON DELETE CASCADE NOT NULL UNIQUE,
  repairman_id UUID REFERENCES auth.users(id) NOT NULL,
  problem_description TEXT NOT NULL,
  repair_description TEXT NOT NULL,
  photo_url TEXT,
  completed_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.repairs ENABLE ROW LEVEL SECURITY;

-- RLS policies for repairs
CREATE POLICY "Authenticated users can view repairs"
  ON public.repairs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Repairmen can create repairs"
  ON public.repairs FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'repairman') AND repairman_id = auth.uid());

-- Create function to update leakage report status when repair is created
CREATE OR REPLACE FUNCTION public.update_report_status_on_repair()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.leakage_reports
  SET status = 'repaired', updated_at = now()
  WHERE id = NEW.report_id;
  RETURN NEW;
END;
$$;

-- Create trigger to auto-update report status
CREATE TRIGGER on_repair_created
  AFTER INSERT ON public.repairs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_report_status_on_repair();

-- Create function to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User')
  );
  RETURN NEW;
END;
$$;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Insert some sample vehicle types and models
INSERT INTO public.vehicle_types (name) VALUES
  ('Excavator'),
  ('Bulldozer'),
  ('Crane'),
  ('Loader'),
  ('Grader');

INSERT INTO public.vehicle_models (vehicle_type_id, name)
SELECT vt.id, model_name
FROM public.vehicle_types vt
CROSS JOIN (VALUES
  ('Model A'),
  ('Model B'),
  ('Model C'),
  ('Model D')
) AS models(model_name);

-- Insert some sample products
INSERT INTO public.products (chassis_no, product_name, description) VALUES
  ('CH001', 'Hydraulic Pump Assembly', 'Main hydraulic pump for excavators'),
  ('CH002', 'Engine Block', 'Diesel engine block for heavy machinery'),
  ('CH003', 'Transmission System', 'Automatic transmission assembly');
