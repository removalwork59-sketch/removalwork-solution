CREATE TABLE public.scan_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  batch_number serial,
  total integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.scan_batches TO authenticated;
GRANT USAGE ON SEQUENCE public.scan_batches_batch_number_seq TO authenticated;
GRANT ALL ON public.scan_batches TO service_role;
ALTER TABLE public.scan_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own batches read" ON public.scan_batches FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own batches insert" ON public.scan_batches FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own batches update" ON public.scan_batches FOR UPDATE TO authenticated USING (user_id = auth.uid());
ALTER TABLE public.scans ADD COLUMN batch_id uuid REFERENCES public.scan_batches(id);
CREATE INDEX scans_batch_id_idx ON public.scans(batch_id);
ALTER SEQUENCE public.scan_batches_batch_number_seq RESTART WITH 1001;