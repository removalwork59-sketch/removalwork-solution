CREATE TABLE public.profiles (
  user_id uuid PRIMARY KEY,
  name text NOT NULL DEFAULT 'Admin',
  username text,
  avatar_path text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own profile" ON public.profiles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username) VALUES (NEW.id, NEW.email) ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE POLICY "avatar own read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatar own upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatar own update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);