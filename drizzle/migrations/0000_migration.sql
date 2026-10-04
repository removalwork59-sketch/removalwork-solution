CREATE TABLE public.scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  is_seed boolean NOT NULL DEFAULT false,
  data_source text NOT NULL DEFAULT 'google_places',
  source_url text NOT NULL,
  place_id text,
  business_name text,
  category text,
  address text,
  rating numeric(2,1),
  total_reviews integer,
  maps_uri text,
  status text NOT NULL DEFAULT 'pending',
  error text,
  high_count integer NOT NULL DEFAULT 0,
  medium_count integer NOT NULL DEFAULT 0,
  normal_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scans TO authenticated;
GRANT ALL ON public.scans TO service_role;
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own or seed scans" ON public.scans FOR SELECT TO authenticated USING (user_id = auth.uid() OR is_seed);
CREATE POLICY "insert own scans" ON public.scans FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND is_seed = false);
CREATE POLICY "update own scans" ON public.scans FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "delete own scans" ON public.scans FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  author text NOT NULL DEFAULT 'Anonymous',
  author_uri text,
  rating integer NOT NULL,
  published_at timestamptz,
  relative_time text,
  text text,
  review_uri text,
  risk text NOT NULL DEFAULT 'normal',
  policy_category text,
  indicators text[] NOT NULL DEFAULT '{}',
  reason text,
  evidence text,
  confidence integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read reviews of visible scans" ON public.reviews FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.scans s WHERE s.id = scan_id AND (s.user_id = auth.uid() OR s.is_seed)));
CREATE POLICY "write reviews of own scans" ON public.reviews FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.scans s WHERE s.id = scan_id AND s.user_id = auth.uid()));
CREATE INDEX reviews_scan_idx ON public.reviews(scan_id);

INSERT INTO public.scans (id, is_seed, data_source, source_url, business_name, category, address, rating, total_reviews, status, high_count, medium_count, normal_count, created_at) VALUES
('00000000-0000-4000-8000-000000000001', true, 'seed', 'https://maps.google.com/?q=seed-demo-bistro', '[DEMO] Harbor Lane Bistro', 'Restaurant', 'Demo City, Example Country', 4.3, 1284, 'complete', 1, 1, 3, now() - interval '2 days'),
('00000000-0000-4000-8000-000000000002', true, 'seed', 'https://maps.google.com/?q=seed-demo-dental', '[DEMO] Northside Dental Studio', 'Dentist', 'Demo City, Example Country', 4.7, 312, 'complete', 0, 1, 4, now() - interval '6 days');

INSERT INTO public.reviews (scan_id, author, rating, relative_time, text, risk, policy_category, indicators, reason, evidence, confidence) VALUES
('00000000-0000-4000-8000-000000000001','Demo Reviewer A',1,'2 weeks ago','Worst place ever. Go to Marina Grill across the street instead, they are way better and cheaper. Use code SAVE20 there!','high','Conflict of interest / Spam',ARRAY['Competitor promotion','Promo code','No visit details'],'Review redirects customers to a named competitor and includes a promotional code.','"Go to Marina Grill across the street instead" · "Use code SAVE20"',87),
('00000000-0000-4000-8000-000000000001','Demo Reviewer B',1,'1 month ago','The owner is a criminal and a liar, everyone knows it.','medium','Harassment / Personal attack',ARRAY['Personal accusation','No experience described'],'Contains unsubstantiated personal accusations against an individual.','"The owner is a criminal and a liar"',64),
('00000000-0000-4000-8000-000000000001','Demo Reviewer C',4,'3 weeks ago','Great seafood pasta, service was a bit slow on a Friday night but staff were friendly.','normal',NULL,'{}','Describes a genuine first-hand experience.',NULL,92),
('00000000-0000-4000-8000-000000000001','Demo Reviewer D',5,'2 months ago','Lovely terrace, excellent wine list. Will come back.','normal',NULL,'{}','Ordinary positive experience.',NULL,90),
('00000000-0000-4000-8000-000000000001','Demo Reviewer E',2,'1 month ago','Food was cold and the bill had an error. Manager fixed it though.','normal',NULL,'{}','Legitimate negative experience with specifics.',NULL,88),
('00000000-0000-4000-8000-000000000002','Demo Reviewer F',5,'1 week ago','Dr. visit was painless, clean clinic.','normal',NULL,'{}','Genuine experience.',NULL,91),
('00000000-0000-4000-8000-000000000002','Demo Reviewer G',1,'3 days ago','Never been here but heard bad things.','medium','Not based on real experience',ARRAY['Admits no visit'],'Reviewer states they have not visited the business.','"Never been here"',78),
('00000000-0000-4000-8000-000000000002','Demo Reviewer H',5,'1 month ago','Friendly reception, quick appointment.','normal',NULL,'{}','Genuine experience.',NULL,90),
('00000000-0000-4000-8000-000000000002','Demo Reviewer I',4,'2 months ago','Good cleaning, parking is hard.','normal',NULL,'{}','Genuine experience.',NULL,89),
('00000000-0000-4000-8000-000000000002','Demo Reviewer J',5,'3 months ago','Best dentist in town.','normal',NULL,'{}','Ordinary positive review.',NULL,80);