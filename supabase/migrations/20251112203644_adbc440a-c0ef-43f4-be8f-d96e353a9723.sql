-- Fix RLS policies for user_roles table
CREATE POLICY "Users can view their own roles" ON public.user_roles 
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all roles" ON public.user_roles 
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Fix function search paths for trigger functions
CREATE OR REPLACE FUNCTION public.update_inspection_status()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'Pending' AND (now() - NEW.created_at) > INTERVAL '2 days' THEN
    NEW.status = 'Delayed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_inspection_on_repair()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.inspection_data
  SET status = 'Completed', updated_at = now()
  WHERE id = NEW.inspection_id;
  RETURN NEW;
END;
$$;