CREATE TABLE public.scan_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  stage text NOT NULL,
  status text NOT NULL DEFAULT 'ok',
  message text,
  duration_ms integer,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.scan_events TO authenticated;
GRANT ALL ON public.scan_events TO service_role;
ALTER TABLE public.scan_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own scan events read" ON public.scan_events FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own scan events insert" ON public.scan_events FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.scans s WHERE s.id = scan_id AND s.user_id = auth.uid()));
CREATE INDEX scan_events_scan_idx ON public.scan_events(scan_id, created_at);
CREATE INDEX scan_events_user_idx ON public.scan_events(user_id, created_at DESC);

ALTER TABLE public.reviews ADD COLUMN processing_status text NOT NULL DEFAULT 'STORED',
  ADD COLUMN content_hash text;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_processing_status_chk CHECK (processing_status IN ('RETRIEVED','STORED','ANALYZED','FAILED','SKIPPED'));
UPDATE public.reviews r SET processing_status = 'ANALYZED' WHERE EXISTS (SELECT 1 FROM public.review_analyses a WHERE a.review_id = r.id);
CREATE INDEX reviews_hash_idx ON public.reviews(content_hash);

ALTER TABLE public.review_analyses ADD COLUMN prompt_version text,
  ADD COLUMN content_hash text,
  ADD COLUMN verification jsonb,
  ADD COLUMN cached boolean NOT NULL DEFAULT false;
CREATE INDEX review_analyses_cache_idx ON public.review_analyses(content_hash, analysis_version);

ALTER TABLE public.scans ADD COLUMN api_rating_raw numeric,
  ADD COLUMN api_total_reviews_raw integer,
  ADD COLUMN rating_mismatch boolean NOT NULL DEFAULT false,
  ADD COLUMN data_quality text,
  ADD COLUMN data_quality_reasons text[] NOT NULL DEFAULT '{}',
  ADD COLUMN review_health_score integer,
  ADD COLUMN reviews_failed_analysis integer NOT NULL DEFAULT 0;

CREATE TABLE public.review_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL UNIQUE REFERENCES public.reviews(id) ON DELETE CASCADE,
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  status text NOT NULL DEFAULT 'NOT_REVIEWED' CHECK (status IN ('NOT_REVIEWED','REVIEWED','ACTION_RECOMMENDED','GOOGLE_REPORTING_PATH_AVAILABLE','USER_ACTION_PENDING','RESOLVED','NOT_ACTIONABLE')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.review_actions TO authenticated;
GRANT ALL ON public.review_actions TO service_role;
ALTER TABLE public.review_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own actions read" ON public.review_actions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own actions insert" ON public.review_actions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.scans s WHERE s.id = scan_id AND s.user_id = auth.uid()));
CREATE POLICY "own actions update" ON public.review_actions FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE INDEX review_actions_user_idx ON public.review_actions(user_id, status);

CREATE TABLE public.error_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  module text NOT NULL,
  route text,
  scan_id uuid REFERENCES public.scans(id) ON DELETE SET NULL,
  business text,
  code text NOT NULL,
  message text NOT NULL,
  severity text NOT NULL DEFAULT 'MEDIUM' CHECK (severity IN ('CRITICAL','HIGH','MEDIUM','LOW')),
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','INVESTIGATING','FIXED','VERIFIED')),
  resolution text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.error_events TO authenticated;
GRANT ALL ON public.error_events TO service_role;
ALTER TABLE public.error_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own errors read" ON public.error_events FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own errors insert" ON public.error_events FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own errors update" ON public.error_events FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE INDEX error_events_user_idx ON public.error_events(user_id, created_at DESC);

CREATE TABLE public.debug_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_code text NOT NULL UNIQUE,
  severity text NOT NULL CHECK (severity IN ('CRITICAL','HIGH','MEDIUM','LOW')),
  module text NOT NULL,
  component text,
  route text,
  description text NOT NULL,
  expected text,
  actual text,
  reproduction text,
  root_cause text,
  fix text,
  verification text,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','FIXING','FIXED','RETESTING','VERIFIED','BLOCKED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.debug_findings TO authenticated;
GRANT ALL ON public.debug_findings TO service_role;
ALTER TABLE public.debug_findings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read findings" ON public.debug_findings FOR SELECT TO authenticated USING (true);

ALTER TABLE public.audit_log ADD COLUMN resource text, ADD COLUMN resource_id text, ADD COLUMN result text NOT NULL DEFAULT 'success';
CREATE INDEX IF NOT EXISTS audit_log_user_idx ON public.audit_log(user_id, created_at DESC);