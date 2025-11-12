-- Drop existing tables if we're starting fresh
DROP TABLE IF EXISTS public.repairs CASCADE;
DROP TABLE IF EXISTS public.leakages CASCADE;
DROP TABLE IF EXISTS public.leakage_reports CASCADE;
DROP TABLE IF EXISTS public.vehicle_models CASCADE;
DROP TABLE IF EXISTS public.vehicle_types CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;

-- Create ProductLine table
CREATE TABLE public.product_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create Model table
CREATE TABLE public.models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_line_id UUID NOT NULL REFERENCES public.product_lines(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(product_line_id, code)
);

-- Create Machine table
CREATE TABLE public.machines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES public.models(id) ON DELETE CASCADE,
  chassis_number TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create LeakageType table
CREATE TABLE public.leakage_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_line_id UUID NOT NULL REFERENCES public.product_lines(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(product_line_id, code)
);

-- Create InspectionData table
CREATE TABLE public.inspection_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  leakage_type_id UUID REFERENCES public.leakage_types(id),
  tester_id UUID NOT NULL REFERENCES auth.users(id),
  severity TEXT CHECK (severity IN ('Low', 'Medium', 'High', 'None')),
  remarks TEXT,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Assigned', 'Completed', 'Delayed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create RepairData table
CREATE TABLE public.repair_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES public.inspection_data(id) ON DELETE CASCADE,
  repairman_id UUID NOT NULL REFERENCES auth.users(id),
  repair_status TEXT NOT NULL CHECK (repair_status IN ('Repairable', 'Not Repairable')),
  notes TEXT,
  photo_url TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.product_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leakage_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_data ENABLE ROW LEVEL SECURITY;

-- RLS Policies for product_lines
CREATE POLICY "Anyone can view product lines" ON public.product_lines FOR SELECT USING (true);
CREATE POLICY "Admins can manage product lines" ON public.product_lines FOR ALL USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for models
CREATE POLICY "Anyone can view models" ON public.models FOR SELECT USING (true);
CREATE POLICY "Admins can manage models" ON public.models FOR ALL USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for machines
CREATE POLICY "Anyone can view machines" ON public.machines FOR SELECT USING (true);
CREATE POLICY "Testers can create machines" ON public.machines FOR INSERT WITH CHECK (has_role(auth.uid(), 'tester'));
CREATE POLICY "Admins can manage machines" ON public.machines FOR ALL USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for leakage_types
CREATE POLICY "Anyone can view leakage types" ON public.leakage_types FOR SELECT USING (true);
CREATE POLICY "Admins can manage leakage types" ON public.leakage_types FOR ALL USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for inspection_data
CREATE POLICY "Anyone can view inspections" ON public.inspection_data FOR SELECT USING (true);
CREATE POLICY "Testers can create inspections" ON public.inspection_data FOR INSERT WITH CHECK (has_role(auth.uid(), 'tester') AND tester_id = auth.uid());
CREATE POLICY "Admins and repairmen can update inspections" ON public.inspection_data FOR UPDATE USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'repairman'));

-- RLS Policies for repair_data
CREATE POLICY "Anyone can view repairs" ON public.repair_data FOR SELECT USING (true);
CREATE POLICY "Repairmen can create repairs" ON public.repair_data FOR INSERT WITH CHECK (has_role(auth.uid(), 'repairman') AND repairman_id = auth.uid());
CREATE POLICY "Admins and repairmen can update repairs" ON public.repair_data FOR UPDATE USING (has_role(auth.uid(), 'admin') OR (has_role(auth.uid(), 'repairman') AND repairman_id = auth.uid()));

-- Insert sample product lines
INSERT INTO public.product_lines (name, code) VALUES
  ('Tractor Loader Backhoe', 'TLB'),
  ('Vibratory Compactor', 'VC'),
  ('Skid Steer Loader', 'SSL'),
  ('Compact Excavator', 'CHEX');

-- Create trigger for auto-updating inspection status based on time
CREATE OR REPLACE FUNCTION public.update_inspection_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'Pending' AND (now() - NEW.created_at) > INTERVAL '2 days' THEN
    NEW.status = 'Delayed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_inspection_delay
  BEFORE UPDATE ON public.inspection_data
  FOR EACH ROW
  EXECUTE FUNCTION public.update_inspection_status();

-- Create trigger to update inspection status when repair is completed
CREATE OR REPLACE FUNCTION public.update_inspection_on_repair()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.inspection_data
  SET status = 'Completed', updated_at = now()
  WHERE id = NEW.inspection_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER repair_completed
  AFTER INSERT ON public.repair_data
  FOR EACH ROW
  EXECUTE FUNCTION public.update_inspection_on_repair();