-- User identity persistence for OAuth (name + avatar)
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'users_select_own'
  ) THEN
    CREATE POLICY users_select_own
      ON public.users
      FOR SELECT
      TO authenticated
      USING (auth.uid() = id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'users_insert_own'
  ) THEN
    CREATE POLICY users_insert_own
      ON public.users
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'users_update_own'
  ) THEN
    CREATE POLICY users_update_own
      ON public.users
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_users_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.set_users_updated_at();

-- Public, non-sensitive profile view for project creator display.
CREATE OR REPLACE VIEW public.user_public_profiles AS
SELECT id, name, avatar_url
FROM public.users;

GRANT SELECT ON public.user_public_profiles TO anon, authenticated;

-- Cache creator identity on projects for fast public rendering.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS creator_name TEXT;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS creator_avatar_url TEXT;

UPDATE public.projects p
SET
  creator_name = COALESCE(NULLIF(p.creator_name, ''), u.name),
  creator_avatar_url = COALESCE(NULLIF(p.creator_avatar_url, ''), u.avatar_url)
FROM public.users u
WHERE p.owner_user_id = u.id;
