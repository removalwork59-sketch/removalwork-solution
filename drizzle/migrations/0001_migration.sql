CREATE TABLE public.businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  is_seed boolean NOT NULL DEFAULT false,
  place_id text,
  name text NOT NULL,
  category text,
  address text,
  rating numeric(2,1),
  total_reviews integer,
  maps_uri text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX businesses_user_place_uidx ON public.businesses(user_id, place_id) WHERE place_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.businesses TO authenticated;
GRANT ALL ON public.businesses TO service_role;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own or seed businesses" ON public.businesses FOR SELECT TO authenticated USING (user_id = auth.uid() OR is_seed);
CREATE POLICY "insert own businesses" ON public.businesses FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND NOT is_seed);
CREATE POLICY "update own businesses" ON public.businesses FOR UPDATE TO authenticated USING (user_id = auth.uid());

ALTER TABLE public.scans ADD COLUMN business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL;
ALTER TABLE public.scans ADD COLUMN reviews_retrieved integer NOT NULL DEFAULT 0;
ALTER TABLE public.scans ADD COLUMN requires_review_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.scans ADD COLUMN stage text;
CREATE INDEX scans_user_created_idx ON public.scans(user_id, created_at DESC);

CREATE TABLE public.review_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL UNIQUE REFERENCES public.reviews(id) ON DELETE CASCADE,
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  risk text NOT NULL DEFAULT 'requires_review',
  category text,
  signals text[] NOT NULL DEFAULT '{}',
  reason text,
  evidence text,
  confidence integer NOT NULL DEFAULT 0,
  model text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX review_analyses_scan_idx ON public.review_analyses(scan_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_analyses TO authenticated;
GRANT ALL ON public.review_analyses TO service_role;
ALTER TABLE public.review_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read analyses of visible scans" ON public.review_analyses FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.scans s WHERE s.id = scan_id AND (s.user_id = auth.uid() OR s.is_seed)));
CREATE POLICY "write analyses of own scans" ON public.review_analyses FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.scans s WHERE s.id = scan_id AND s.user_id = auth.uid()));

INSERT INTO public.review_analyses (review_id, scan_id, risk, category, signals, reason, evidence, confidence, model)
SELECT id, scan_id, risk, policy_category, indicators, reason, evidence, confidence, 'development-seed' FROM public.reviews;

COMMENT ON COLUMN public.reviews.risk IS 'DEPRECATED: moved to review_analyses.risk';
COMMENT ON COLUMN public.reviews.policy_category IS 'DEPRECATED: moved to review_analyses.category';
COMMENT ON COLUMN public.reviews.indicators IS 'DEPRECATED: moved to review_analyses.signals';
COMMENT ON COLUMN public.reviews.reason IS 'DEPRECATED: moved to review_analyses.reason';
COMMENT ON COLUMN public.reviews.evidence IS 'DEPRECATED: moved to review_analyses.evidence';
COMMENT ON COLUMN public.reviews.confidence IS 'DEPRECATED: moved to review_analyses.confidence';

CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL UNIQUE REFERENCES public.scans(id) ON DELETE CASCADE,
  user_id uuid,
  is_seed boolean NOT NULL DEFAULT false,
  report_number text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'ready',
  recommended_action text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own or seed reports" ON public.reports FOR SELECT TO authenticated USING (user_id = auth.uid() OR is_seed);
CREATE POLICY "insert own reports" ON public.reports FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND NOT is_seed);

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_user_idx ON public.audit_log(user_id, created_at DESC);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own audit" ON public.audit_log FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "insert own audit" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

UPDATE public.scans SET business_name = replace(business_name, '[DEMO] ', '[DEV] '), reviews_retrieved = high_count + medium_count + normal_count WHERE is_seed;
INSERT INTO public.businesses (is_seed, name, category, address, rating, total_reviews)
SELECT true, business_name, category, address, rating, total_reviews FROM public.scans WHERE is_seed;
UPDATE public.scans s SET business_id = b.id FROM public.businesses b WHERE s.is_seed AND b.is_seed AND b.name = s.business_name;
INSERT INTO public.reports (scan_id, is_seed, report_number, recommended_action)
SELECT id, true, 'DEV-' || upper(substr(replace(id::text,'-',''), 25, 8)), 'Development data — no action required.' FROM public.scans WHERE is_seed;