DROP INDEX IF EXISTS public.businesses_user_place_uidx;
ALTER TABLE public.businesses ADD CONSTRAINT businesses_user_place_key UNIQUE (user_id, place_id);