CREATE TABLE IF NOT EXISTS public.search_debug_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  stage text NOT NULL,
  payload jsonb,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.search_debug_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their search debug logs" ON public.search_debug_logs;
CREATE POLICY "Users can read their search debug logs"
ON public.search_debug_logs FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their search debug logs" ON public.search_debug_logs;
CREATE POLICY "Users can insert their search debug logs"
ON public.search_debug_logs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS search_debug_logs_user_created_idx
  ON public.search_debug_logs (user_id, created_at DESC);
