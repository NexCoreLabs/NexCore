-- ========================================
-- AI Assist Feature: Supabase Database Setup
-- ========================================
-- This migration creates the necessary database objects for the AI Assist feature
-- with a daily limit of 3 actions per user.

-- Create ai_usage table to track daily AI usage per user
CREATE TABLE IF NOT EXISTS public.ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  use_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure one row per user per day
  UNIQUE(user_id, usage_date)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_date ON public.ai_usage(user_id, usage_date);

-- Enable Row Level Security
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own usage
CREATE POLICY "Users can view own AI usage"
  ON public.ai_usage
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Users can insert their own usage records
CREATE POLICY "Users can insert own AI usage"
  ON public.ai_usage
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update their own usage records
CREATE POLICY "Users can update own AI usage"
  ON public.ai_usage
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ========================================
-- RPC Function: consume_ai_use
-- ========================================
-- This function enforces the daily AI usage limit.
-- It atomically increments the usage counter and returns current stats.
-- If the limit is exceeded, it raises an exception.

CREATE OR REPLACE FUNCTION public.consume_ai_use(max_uses INT DEFAULT 3)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID;
  current_usage_record RECORD;
  new_count INT;
  remaining_uses INT;
BEGIN
  -- Get the authenticated user ID
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Lock and get current usage for today (or create if doesn't exist)
  SELECT * INTO current_usage_record
  FROM public.ai_usage
  WHERE user_id = current_user_id
    AND usage_date = CURRENT_DATE
  FOR UPDATE;
  
  -- If no record exists for today, create one
  IF current_usage_record IS NULL THEN
    INSERT INTO public.ai_usage (user_id, usage_date, use_count)
    VALUES (current_user_id, CURRENT_DATE, 1)
    RETURNING use_count INTO new_count;
    
    remaining_uses := max_uses - new_count;
    
    RETURN json_build_object(
      'used', new_count,
      'remaining', remaining_uses
    );
  END IF;
  
  -- Check if limit is reached
  IF current_usage_record.use_count >= max_uses THEN
    RAISE EXCEPTION 'AI daily limit reached';
  END IF;
  
  -- Increment usage count
  UPDATE public.ai_usage
  SET use_count = use_count + 1,
      updated_at = NOW()
  WHERE user_id = current_user_id
    AND usage_date = CURRENT_DATE
  RETURNING use_count INTO new_count;
  
  remaining_uses := max_uses - new_count;
  
  -- Return usage statistics
  RETURN json_build_object(
    'used', new_count,
    'remaining', remaining_uses
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.consume_ai_use(INT) TO authenticated;

-- ========================================
-- Optional: Function to check current AI usage without consuming
-- ========================================

CREATE OR REPLACE FUNCTION public.get_ai_usage(max_uses INT DEFAULT 3)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID;
  current_count INT;
  remaining_uses INT;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Get current usage for today
  SELECT use_count INTO current_count
  FROM public.ai_usage
  WHERE user_id = current_user_id
    AND usage_date = CURRENT_DATE;
  
  -- If no record, user hasn't used AI today
  IF current_count IS NULL THEN
    current_count := 0;
  END IF;
  
  remaining_uses := max_uses - current_count;
  
  IF remaining_uses < 0 THEN
    remaining_uses := 0;
  END IF;
  
  RETURN json_build_object(
    'used', current_count,
    'remaining', remaining_uses
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_ai_usage(INT) TO authenticated;

-- ========================================
-- Cleanup: Optional function to remove old usage records
-- ========================================
-- This can be run periodically (e.g., via a cron job) to clean up old data

CREATE OR REPLACE FUNCTION public.cleanup_old_ai_usage()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INT;
BEGIN
  -- Delete records older than 90 days
  DELETE FROM public.ai_usage
  WHERE usage_date < CURRENT_DATE - INTERVAL '90 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$;

-- Grant execute to service role only (for cron jobs)
GRANT EXECUTE ON FUNCTION public.cleanup_old_ai_usage() TO service_role;
