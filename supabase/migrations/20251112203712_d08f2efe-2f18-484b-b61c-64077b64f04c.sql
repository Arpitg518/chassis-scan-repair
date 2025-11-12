-- Create storage bucket for repair photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('repair-photos', 'repair-photos', true);

-- Create storage policies
CREATE POLICY "Anyone can view repair photos" 
  ON storage.objects FOR SELECT 
  USING (bucket_id = 'repair-photos');

CREATE POLICY "Repairmen can upload repair photos" 
  ON storage.objects FOR INSERT 
  WITH CHECK (bucket_id = 'repair-photos' AND has_role(auth.uid(), 'repairman'));

CREATE POLICY "Repairmen can update their repair photos" 
  ON storage.objects FOR UPDATE 
  USING (bucket_id = 'repair-photos' AND has_role(auth.uid(), 'repairman'));