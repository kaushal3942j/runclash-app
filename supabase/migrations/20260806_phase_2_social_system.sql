-- ============================================================
-- RUNCLASH 2.0 — PHASE 2: COMPLETE SOCIAL SYSTEM MIGRATION
-- Idempotent Migration for Supabase Database & Security Policies
-- ============================================================

BEGIN;

-- 1. EXTEND PUBLIC.PROFILES SAFELY
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS username text,
ADD COLUMN IF NOT EXISTS bio text DEFAULT '',
ADD COLUMN IF NOT EXISTS avatar_url text,
ADD COLUMN IF NOT EXISTS country text,
ADD COLUMN IF NOT EXISTS state text,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS is_profile_public boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS show_activity boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS allow_friend_requests boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS last_active_at timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- Username format & uniqueness constraints (lowercase, 3-20 chars, alphanumeric + underscore)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_username_format_check'
  ) THEN
    ALTER TABLE public.profiles 
    ADD CONSTRAINT profiles_username_format_check 
    CHECK (username IS NULL OR username ~ '^[a-z0-9_]{3,20}$');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_username_key'
  ) THEN
    ALTER TABLE public.profiles 
    ADD CONSTRAINT profiles_username_key UNIQUE (username);
  END IF;
END $$;

-- 2. CREATE FRIEND_REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.friend_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  CONSTRAINT friend_requests_no_self CHECK (sender_id <> receiver_id)
);

-- Unique pending request constraint (one pending request between pair)
CREATE UNIQUE INDEX IF NOT EXISTS friend_requests_unique_pending_idx 
ON public.friend_requests (
  LEAST(sender_id, receiver_id), 
  GREATEST(sender_id, receiver_id)
) 
WHERE status = 'pending';

-- 3. CREATE FRIENDSHIPS TABLE
CREATE TABLE IF NOT EXISTS public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_one_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_two_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT friendships_ordered CHECK (user_one_id < user_two_id),
  CONSTRAINT friendships_unique_pair UNIQUE (user_one_id, user_two_id)
);

-- 4. CREATE ACTIVITY_FEED TABLE (WITH IDEMPOTENT SOURCE CONSTRAINT)
CREATE TABLE IF NOT EXISTS public.activity_feed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type text NOT NULL CHECK (activity_type IN ('run_completed', 'territory_claimed', 'friendship_created', 'profile_updated', 'clan_joined')),
  run_id uuid REFERENCES public.runs(id) ON DELETE SET NULL,
  territory_id uuid REFERENCES public.territories(id) ON DELETE SET NULL,
  clan_id uuid REFERENCES public.clans(id) ON DELETE SET NULL,
  source_type text,
  source_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'friends', 'private')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Safely add source_type and source_id if missing
ALTER TABLE public.activity_feed
ADD COLUMN IF NOT EXISTS source_type text,
ADD COLUMN IF NOT EXISTS source_id text;

-- Add unique constraint for activity idempotency
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'activity_feed_unique_source'
  ) THEN
    ALTER TABLE public.activity_feed
    ADD CONSTRAINT activity_feed_unique_source UNIQUE (actor_id, activity_type, source_type, source_id);
  END IF;
END $$;

-- 5. CREATE NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type text NOT NULL CHECK (notification_type IN ('friend_request_received', 'friend_request_accepted', 'territory_contested', 'clan_invite', 'system_alert')),
  title text NOT NULL,
  message text NOT NULL,
  entity_type text,
  entity_id uuid,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 6. CREATE BLOCKS TABLE
CREATE TABLE IF NOT EXISTS public.blocks (
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT blocks_no_self CHECK (blocker_id <> blocked_id)
);

-- 7. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_location ON public.profiles(country, state, city);
CREATE INDEX IF NOT EXISTS idx_profiles_last_active ON public.profiles(last_active_at DESC);

CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver ON public.friend_requests(receiver_id, status);
CREATE INDEX IF NOT EXISTS idx_friend_requests_sender ON public.friend_requests(sender_id, status);

CREATE INDEX IF NOT EXISTS idx_friendships_user_one ON public.friendships(user_one_id);
CREATE INDEX IF NOT EXISTS idx_friendships_user_two ON public.friendships(user_two_id);

CREATE INDEX IF NOT EXISTS idx_activity_feed_actor ON public.activity_feed(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_feed_visibility ON public.activity_feed(visibility, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(recipient_id, is_read, created_at DESC);

-- 8. ROW LEVEL SECURITY (RLS) POLICIES

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

-- PROFILES POLICIES
DROP POLICY IF EXISTS "Public profiles are readable by authenticated users" ON public.profiles;
CREATE POLICY "Public profiles are readable by authenticated users"
ON public.profiles FOR SELECT
TO authenticated
USING (
  id = auth.uid() 
  OR (is_profile_public = true AND NOT EXISTS (
    SELECT 1 FROM public.blocks WHERE (blocker_id = profiles.id AND blocked_id = auth.uid()) OR (blocker_id = auth.uid() AND blocked_id = profiles.id)
  ))
);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- FRIEND_REQUESTS POLICIES
DROP POLICY IF EXISTS "Users can view involved friend requests" ON public.friend_requests;
CREATE POLICY "Users can view involved friend requests"
ON public.friend_requests FOR SELECT
TO authenticated
USING (sender_id = auth.uid() OR receiver_id = auth.uid());

DROP POLICY IF EXISTS "Users can send friend requests" ON public.friend_requests;
CREATE POLICY "Users can send friend requests"
ON public.friend_requests FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid() 
  AND NOT EXISTS (
    SELECT 1 FROM public.blocks WHERE (blocker_id = receiver_id AND blocked_id = auth.uid()) OR (blocker_id = auth.uid() AND blocked_id = receiver_id)
  )
);

DROP POLICY IF EXISTS "Users can update involved requests" ON public.friend_requests;
CREATE POLICY "Users can update involved requests"
ON public.friend_requests FOR UPDATE
TO authenticated
USING (sender_id = auth.uid() OR receiver_id = auth.uid());

-- FRIENDSHIPS POLICIES
DROP POLICY IF EXISTS "Users can view own friendships" ON public.friendships;
CREATE POLICY "Users can view own friendships"
ON public.friendships FOR SELECT
TO authenticated
USING (user_one_id = auth.uid() OR user_two_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own friendships" ON public.friendships;
CREATE POLICY "Users can delete own friendships"
ON public.friendships FOR DELETE
TO authenticated
USING (user_one_id = auth.uid() OR user_two_id = auth.uid());

-- ACTIVITY_FEED POLICIES
DROP POLICY IF EXISTS "Activity feed view policy" ON public.activity_feed;
CREATE POLICY "Activity feed view policy"
ON public.activity_feed FOR SELECT
TO authenticated
USING (
  actor_id = auth.uid()
  OR (visibility = 'public' AND NOT EXISTS (
    SELECT 1 FROM public.blocks WHERE (blocker_id = actor_id AND blocked_id = auth.uid()) OR (blocker_id = auth.uid() AND blocked_id = actor_id)
  ))
  OR (visibility = 'friends' AND EXISTS (
    SELECT 1 FROM public.friendships 
    WHERE (user_one_id = LEAST(actor_id, auth.uid()) AND user_two_id = GREATEST(actor_id, auth.uid()))
  ))
);

DROP POLICY IF EXISTS "Users insert own activity" ON public.activity_feed;
CREATE POLICY "Users insert own activity"
ON public.activity_feed FOR INSERT
TO authenticated
WITH CHECK (actor_id = auth.uid());

-- NOTIFICATIONS POLICIES
DROP POLICY IF EXISTS "Users view own notifications" ON public.notifications;
CREATE POLICY "Users view own notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (recipient_id = auth.uid());

DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
CREATE POLICY "Users update own notifications"
ON public.notifications FOR UPDATE
TO authenticated
USING (recipient_id = auth.uid());

-- BLOCKS POLICIES
DROP POLICY IF EXISTS "Users manage own blocks" ON public.blocks;
CREATE POLICY "Users manage own blocks"
ON public.blocks FOR ALL
TO authenticated
USING (blocker_id = auth.uid())
WITH CHECK (blocker_id = auth.uid());

-- 9. SECURE RPC FUNCTIONS (LOCKED WITH SET search_path = public, pg_temp AND FULL SCHEMA QUALIFICATION)

-- A. Send Friend Request
CREATE OR REPLACE FUNCTION public.send_friend_request(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid;
  v_existing_status text;
  v_request_id uuid;
  v_caller_name text;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF v_caller_id = target_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot send friend request to yourself');
  END IF;

  -- Check blocks
  IF EXISTS (
    SELECT 1 FROM public.blocks 
    WHERE (blocker_id = v_caller_id AND blocked_id = target_user_id)
       OR (blocker_id = target_user_id AND blocked_id = v_caller_id)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'User interaction blocked');
  END IF;

  -- Check existing friendship
  IF EXISTS (
    SELECT 1 FROM public.friendships 
    WHERE user_one_id = LEAST(v_caller_id, target_user_id) 
      AND user_two_id = GREATEST(v_caller_id, target_user_id)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already friends');
  END IF;

  -- Check existing pending requests
  SELECT status INTO v_existing_status
  FROM public.friend_requests
  WHERE LEAST(sender_id, receiver_id) = LEAST(v_caller_id, target_user_id)
    AND GREATEST(sender_id, receiver_id) = GREATEST(v_caller_id, target_user_id)
    AND status = 'pending';

  IF v_existing_status IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'A pending request already exists');
  END IF;

  -- Create request
  INSERT INTO public.friend_requests (sender_id, receiver_id, status)
  VALUES (v_caller_id, target_user_id, 'pending')
  RETURNING id INTO v_request_id;

  -- Fetch caller display name for notification
  SELECT COALESCE(display_name, 'Runner') INTO v_caller_name
  FROM public.profiles WHERE id = v_caller_id;

  -- Send notification
  INSERT INTO public.notifications (recipient_id, actor_id, notification_type, title, message, entity_type, entity_id)
  VALUES (
    target_user_id, 
    v_caller_id, 
    'friend_request_received', 
    'New Friend Request', 
    v_caller_name || ' sent you a friend request.', 
    'friend_request', 
    v_request_id
  );

  RETURN jsonb_build_object('success', true, 'request_id', v_request_id);
END;
$$;

-- B. Respond to Friend Request
CREATE OR REPLACE FUNCTION public.respond_to_friend_request(p_request_id uuid, p_response text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid;
  v_req public.friend_requests%ROWTYPE;
  v_u1 uuid;
  v_u2 uuid;
  v_receiver_name text;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_req FROM public.friend_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found');
  END IF;

  IF v_req.receiver_id <> v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only receiver can respond to request');
  END IF;

  IF v_req.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request is no longer pending');
  END IF;

  IF p_response = 'accept' THEN
    UPDATE public.friend_requests 
    SET status = 'accepted', responded_at = now() 
    WHERE id = p_request_id;

    v_u1 := LEAST(v_req.sender_id, v_req.receiver_id);
    v_u2 := GREATEST(v_req.sender_id, v_req.receiver_id);

    INSERT INTO public.friendships (user_one_id, user_two_id)
    VALUES (v_u1, v_u2)
    ON CONFLICT (user_one_id, user_two_id) DO NOTHING;

    -- Fetch receiver name
    SELECT COALESCE(display_name, 'Runner') INTO v_receiver_name
    FROM public.profiles WHERE id = v_caller_id;

    -- Send acceptance notification to sender
    INSERT INTO public.notifications (recipient_id, actor_id, notification_type, title, message, entity_type, entity_id)
    VALUES (
      v_req.sender_id, 
      v_caller_id, 
      'friend_request_accepted', 
      'Friend Request Accepted', 
      v_receiver_name || ' accepted your friend request!', 
      'profile', 
      v_caller_id
    );

    -- Log friendship activity (idempotent ON CONFLICT)
    INSERT INTO public.activity_feed (actor_id, activity_type, source_type, source_id, visibility, metadata)
    VALUES (
      v_caller_id, 
      'friendship_created', 
      'friend_request',
      p_request_id::text,
      'public', 
      jsonb_build_object('friend_id', v_req.sender_id)
    )
    ON CONFLICT (actor_id, activity_type, source_type, source_id) DO NOTHING;

    RETURN jsonb_build_object('success', true, 'status', 'accepted');
  ELSIF p_response = 'reject' THEN
    UPDATE public.friend_requests 
    SET status = 'rejected', responded_at = now() 
    WHERE id = p_request_id;

    RETURN jsonb_build_object('success', true, 'status', 'rejected');
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Invalid response option');
  END IF;
END;
$$;

-- C. Cancel Friend Request
CREATE OR REPLACE FUNCTION public.cancel_friend_request(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  UPDATE public.friend_requests 
  SET status = 'cancelled', responded_at = now()
  WHERE id = p_request_id AND sender_id = v_caller_id AND status = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pending request not found or not owner');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- D. Remove Friend
CREATE OR REPLACE FUNCTION public.remove_friend(friend_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  DELETE FROM public.friendships
  WHERE (user_one_id = LEAST(v_caller_id, friend_user_id) AND user_two_id = GREATEST(v_caller_id, friend_user_id));

  RETURN jsonb_build_object('success', true);
END;
$$;

-- E. Block & Unblock User
CREATE OR REPLACE FUNCTION public.block_user(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF v_caller_id = target_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot block yourself');
  END IF;

  INSERT INTO public.blocks (blocker_id, blocked_id)
  VALUES (v_caller_id, target_user_id)
  ON CONFLICT DO NOTHING;

  -- Remove friendship if exists
  DELETE FROM public.friendships
  WHERE (user_one_id = LEAST(v_caller_id, target_user_id) AND user_two_id = GREATEST(v_caller_id, target_user_id));

  -- Cancel pending requests
  UPDATE public.friend_requests
  SET status = 'cancelled', responded_at = now()
  WHERE LEAST(sender_id, receiver_id) = LEAST(v_caller_id, target_user_id)
    AND GREATEST(sender_id, receiver_id) = GREATEST(v_caller_id, target_user_id)
    AND status = 'pending';

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.unblock_user(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  DELETE FROM public.blocks
  WHERE blocker_id = v_caller_id AND blocked_id = target_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- F. Notifications Management RPCs
CREATE OR REPLACE FUNCTION public.mark_notification_read(notification_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.notifications
  SET is_read = true
  WHERE id = notification_id AND recipient_id = auth.uid();

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.notifications
  SET is_read = true
  WHERE recipient_id = auth.uid() AND is_read = false;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- G. Update Last Active Timestamp
CREATE OR REPLACE FUNCTION public.update_last_active()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    UPDATE public.profiles
    SET last_active_at = now()
    WHERE id = auth.uid();
  END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;

-- H. Dynamic Leaderboard Query RPC
CREATE OR REPLACE FUNCTION public.get_leaderboard_v2(
  p_metric text DEFAULT 'xp',
  p_time_period text DEFAULT 'all_time',
  p_scope text DEFAULT 'global',
  p_limit_count int DEFAULT 100
)
RETURNS TABLE (
  rank bigint,
  id uuid,
  display_name text,
  username text,
  avatar_url text,
  clan_name text,
  level int,
  xp int,
  total_distance numeric,
  territories_owned bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  WITH user_stats AS (
    SELECT 
      p.id,
      p.display_name,
      p.username,
      p.avatar_url,
      p.clan_name,
      p.level,
      p.xp,
      COALESCE((SELECT SUM(r.distance) FROM public.runs r WHERE r.user_id = p.id), 0) AS total_distance,
      COALESCE((SELECT COUNT(t.id) FROM public.territories t WHERE t.owner_id = p.id), 0) AS territories_owned
    FROM public.profiles p
    WHERE p.is_profile_public = true
      AND NOT EXISTS (
        SELECT 1 FROM public.blocks 
        WHERE (blocker_id = p.id AND blocked_id = auth.uid()) OR (blocker_id = auth.uid() AND blocked_id = p.id)
      )
  )
  SELECT 
    DENSE_RANK() OVER (
      ORDER BY 
        CASE WHEN p_metric = 'distance' THEN s.total_distance ELSE 0 END DESC,
        CASE WHEN p_metric = 'territories' THEN s.territories_owned ELSE 0 END DESC,
        CASE WHEN p_metric = 'xp' OR p_metric NOT IN ('distance', 'territories') THEN s.xp ELSE 0 END DESC,
        s.id ASC
    ) AS rank,
    s.id,
    s.display_name,
    s.username,
    s.avatar_url,
    s.clan_name,
    s.level,
    s.xp,
    s.total_distance,
    s.territories_owned
  FROM user_stats s
  LIMIT p_limit_count;
END;
$$;

-- 10. STORAGE SPECIFICATION FOR AVATARS BUCKET
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 3145728, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 3145728,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- Storage RLS Policies
DROP POLICY IF EXISTS "Public Read Avatars" ON storage.objects;
CREATE POLICY "Public Read Avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users Upload Own Avatar" ON storage.objects;
CREATE POLICY "Users Upload Own Avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users Update Own Avatar" ON storage.objects;
CREATE POLICY "Users Update Own Avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users Delete Own Avatar" ON storage.objects;
CREATE POLICY "Users Delete Own Avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

COMMIT;
