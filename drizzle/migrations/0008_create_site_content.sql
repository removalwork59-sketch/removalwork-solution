CREATE TABLE public.site_content (
  id text PRIMARY KEY DEFAULT 'home',
  published jsonb NOT NULL DEFAULT '{}'::jsonb,
  draft jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_content TO anon;
GRANT SELECT, INSERT, UPDATE ON public.site_content TO authenticated;
GRANT ALL ON public.site_content TO service_role;
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read homepage content" ON public.site_content FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admin can insert homepage content" ON public.site_content FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin can update homepage content" ON public.site_content FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
INSERT INTO public.site_content (id) VALUES ('home');