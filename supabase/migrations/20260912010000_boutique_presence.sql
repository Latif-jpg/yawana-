ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS boutique_status TEXT NOT NULL DEFAULT 'offline',
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_boutique_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_boutique_status_check
  CHECK (boutique_status IN ('online', 'offline'));

CREATE INDEX IF NOT EXISTS profiles_boutique_presence_idx
  ON public.profiles (boutique_status, last_active_at);
