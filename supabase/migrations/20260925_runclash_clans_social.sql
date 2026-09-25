-- ============================================================
-- RUNCLASH — COMPLETE CLANS + SOCIAL + MEDIA
-- Idempotent Migration for Supabase Database & Security Policies
-- Execute this script in your Supabase SQL Editor
-- ============================================================

BEGIN;

-- 1. CLANS EXTENSION
ALTER TABLE public.clans
ADD COLUMN IF NOT EXISTS description text DEFAULT '',
ADD COLUMN IF NOT EXISTS logo_url text,
ADD COLUMN IF NOT EXISTS invite_code text,
ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Automatically generate unique invite code for existing clans if null
UPDATE public.clans SET invite_code = upper(substring(md5(random()::text), 1, 8)) WHERE invite_code IS NULL;
ALTER TABLE public.clans ADD CONSTRAINT clans_invite_code_key UNIQUE (invite_code);

-- 2. CLAN MEMBERS TABLE
CREATE TABLE IF NOT EXISTS public.clan_members (
  clan_id uuid NOT NULL REFERENCES public.clans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'officer', 'member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (clan_id, user_id)
);

-- 3. CLAN JOIN REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.clan_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clan_id uuid NOT NULL REFERENCES public.clans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clan_id, user_id, status)
);

-- 4. SOCIAL POSTS TABLE
CREATE TABLE IF NOT EXISTS public.social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_url text,
  media_type text CHECK (media_type IN ('photo', 'video', 'text')),
  caption text,
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'friends', 'private')),
  run_id uuid REFERENCES public.runs(id) ON DELETE SET NULL,
  territory_id uuid REFERENCES public.territories(id) ON DELETE SET NULL,
  is_story boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. POST LIKES TABLE
CREATE TABLE IF NOT EXISTS public.post_likes (
  post_id uuid NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

-- 6. POST COMMENTS TABLE
CREATE TABLE IF NOT EXISTS public.post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 7. STORAGE BUCKET FOR MEDIA
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('social_media', 'social_media', true, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'])
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'];

-- 8. ROW LEVEL SECURITY (RLS) POLICIES

-- Enable RLS
ALTER TABLE public.clans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clan_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clan_join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

-- CLANS POLICIES
DROP POLICY IF EXISTS "Public can view all clans" ON public.clans;
CREATE POLICY "Public can view all clans" ON public.clans FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can create clans" ON public.clans;
CREATE POLICY "Users can create clans" ON public.clans FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Owner and officers can update clans" ON public.clans;
CREATE POLICY "Owner and officers can update clans" ON public.clans FOR UPDATE TO authenticated 
USING (owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.clan_members WHERE clan_id = clans.id AND user_id = auth.uid() AND role IN ('owner', 'officer')));

DROP POLICY IF EXISTS "Owner can delete clans" ON public.clans;
CREATE POLICY "Owner can delete clans" ON public.clans FOR DELETE TO authenticated USING (owner_id = auth.uid());

-- CLAN MEMBERS POLICIES
DROP POLICY IF EXISTS "Public can view clan members" ON public.clan_members;
CREATE POLICY "Public can view clan members" ON public.clan_members FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can insert themselves if public" ON public.clan_members;
CREATE POLICY "Users can insert themselves if public" ON public.clan_members FOR INSERT TO authenticated 
WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.clans WHERE id = clan_id AND is_public = true));

DROP POLICY IF EXISTS "Owner/officers can insert members" ON public.clan_members;
CREATE POLICY "Owner/officers can insert members" ON public.clan_members FOR INSERT TO authenticated 
WITH CHECK (EXISTS (SELECT 1 FROM public.clan_members WHERE clan_id = clan_members.clan_id AND user_id = auth.uid() AND role IN ('owner', 'officer')));

DROP POLICY IF EXISTS "Owner/officers can update members" ON public.clan_members;
CREATE POLICY "Owner/officers can update members" ON public.clan_members FOR UPDATE TO authenticated 
USING (EXISTS (SELECT 1 FROM public.clan_members cm WHERE cm.clan_id = clan_members.clan_id AND cm.user_id = auth.uid() AND cm.role IN ('owner', 'officer')));

DROP POLICY IF EXISTS "Owner/officers or self can delete members" ON public.clan_members;
CREATE POLICY "Owner/officers or self can delete members" ON public.clan_members FOR DELETE TO authenticated 
USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.clan_members cm WHERE cm.clan_id = clan_members.clan_id AND cm.user_id = auth.uid() AND cm.role IN ('owner', 'officer')));

-- CLAN JOIN REQUESTS POLICIES
DROP POLICY IF EXISTS "Users can view relevant join requests" ON public.clan_join_requests;
CREATE POLICY "Users can view relevant join requests" ON public.clan_join_requests FOR SELECT TO authenticated 
USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.clan_members WHERE clan_id = clan_join_requests.clan_id AND user_id = auth.uid() AND role IN ('owner', 'officer')));

DROP POLICY IF EXISTS "Users can submit join requests" ON public.clan_join_requests;
CREATE POLICY "Users can submit join requests" ON public.clan_join_requests FOR INSERT TO authenticated 
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Owner/officers can update join requests" ON public.clan_join_requests;
CREATE POLICY "Owner/officers can update join requests" ON public.clan_join_requests FOR UPDATE TO authenticated 
USING (EXISTS (SELECT 1 FROM public.clan_members WHERE clan_id = clan_join_requests.clan_id AND user_id = auth.uid() AND role IN ('owner', 'officer')));

-- SOCIAL POSTS POLICIES
DROP POLICY IF EXISTS "Users can view appropriate social posts" ON public.social_posts;
CREATE POLICY "Users can view appropriate social posts" ON public.social_posts FOR SELECT TO authenticated 
USING (
  visibility = 'public' 
  OR user_id = auth.uid() 
  OR (visibility = 'friends' AND EXISTS (
    SELECT 1 FROM public.friendships 
    WHERE (user_one_id = auth.uid() AND user_two_id = social_posts.user_id) OR (user_two_id = auth.uid() AND user_one_id = social_posts.user_id)
  ))
);

DROP POLICY IF EXISTS "Users can create social posts" ON public.social_posts;
CREATE POLICY "Users can create social posts" ON public.social_posts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own social posts" ON public.social_posts;
CREATE POLICY "Users can update own social posts" ON public.social_posts FOR UPDATE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own social posts" ON public.social_posts;
CREATE POLICY "Users can delete own social posts" ON public.social_posts FOR DELETE TO authenticated USING (user_id = auth.uid());

-- POST LIKES & COMMENTS
DROP POLICY IF EXISTS "Public can view likes" ON public.post_likes;
CREATE POLICY "Public can view likes" ON public.post_likes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can like" ON public.post_likes;
CREATE POLICY "Users can like" ON public.post_likes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can unlike" ON public.post_likes;
CREATE POLICY "Users can unlike" ON public.post_likes FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Public can view comments" ON public.post_comments;
CREATE POLICY "Public can view comments" ON public.post_comments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can comment" ON public.post_comments;
CREATE POLICY "Users can comment" ON public.post_comments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can delete own comments" ON public.post_comments;
CREATE POLICY "Users can delete own comments" ON public.post_comments FOR DELETE TO authenticated USING (user_id = auth.uid());

-- STORAGE MEDIA POLICIES
DROP POLICY IF EXISTS "Public Read Social Media" ON storage.objects;
CREATE POLICY "Public Read Social Media" ON storage.objects FOR SELECT TO public USING (bucket_id = 'social_media');

DROP POLICY IF EXISTS "Users Upload Own Media" ON storage.objects;
CREATE POLICY "Users Upload Own Media" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'social_media' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users Update Own Media" ON storage.objects;
CREATE POLICY "Users Update Own Media" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'social_media' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users Delete Own Media" ON storage.objects;
CREATE POLICY "Users Delete Own Media" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'social_media' AND (storage.foldername(name))[1] = auth.uid()::text);

COMMIT;
