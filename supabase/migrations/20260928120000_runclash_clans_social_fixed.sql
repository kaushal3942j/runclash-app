-- ============================================================
-- RUNCLASH — COMPLETE CLANS + SOCIAL + MEDIA
-- FIXED Idempotent Migration for Supabase Database & Security Policies
-- ============================================================

BEGIN;

-- 1. CLANS EXTENSION
ALTER TABLE public.clans
ADD COLUMN IF NOT EXISTS description text DEFAULT '',
ADD COLUMN IF NOT EXISTS logo_url text,
ADD COLUMN IF NOT EXISTS invite_code text,
ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 1A. BACKFILL OWNER_ID FROM LEGACY LEADER_ID
UPDATE public.clans SET owner_id = leader_id WHERE owner_id IS NULL AND leader_id IS NOT NULL;

-- 1B. AUTOMATIC INVITE CODE TRIGGER
CREATE OR REPLACE FUNCTION public.generate_unique_invite_code()
RETURNS trigger AS $$
DECLARE
  new_code text;
  is_unique boolean := false;
BEGIN
  IF NEW.invite_code IS NULL OR NEW.invite_code = '' THEN
    WHILE NOT is_unique LOOP
      new_code := upper(substring(md5(random()::text), 1, 8));
      IF NOT EXISTS (SELECT 1 FROM public.clans WHERE invite_code = new_code) THEN
        is_unique := true;
        NEW.invite_code := new_code;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS on_clan_invite_code ON public.clans;
CREATE TRIGGER on_clan_invite_code
  BEFORE INSERT ON public.clans
  FOR EACH ROW
  EXECUTE PROCEDURE public.generate_unique_invite_code();

-- 1C. COLLISION-SAFE INVITE CODE BACKFILL
DO $$
DECLARE
  clan_record record;
  new_code text;
  is_unique boolean;
BEGIN
  FOR clan_record IN 
    SELECT id FROM public.clans 
    WHERE invite_code IS NULL 
       OR invite_code = '' 
       OR invite_code IN (
         SELECT invite_code FROM public.clans GROUP BY invite_code HAVING COUNT(*) > 1
       )
  LOOP
    is_unique := false;
    WHILE NOT is_unique LOOP
      new_code := upper(substring(md5(random()::text), 1, 8));
      IF NOT EXISTS (SELECT 1 FROM public.clans WHERE invite_code = new_code) THEN
        UPDATE public.clans SET invite_code = new_code WHERE id = clan_record.id;
        is_unique := true;
      END IF;
    END LOOP;
  END LOOP;
END $$;

ALTER TABLE public.clans DROP CONSTRAINT IF EXISTS clans_invite_code_key;
ALTER TABLE public.clans ADD CONSTRAINT clans_invite_code_key UNIQUE (invite_code);

-- 2. CLAN MEMBERS TABLE
CREATE TABLE IF NOT EXISTS public.clan_members (
  clan_id uuid NOT NULL REFERENCES public.clans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'officer', 'member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (clan_id, user_id)
);

-- 2A. AUTOMATIC OWNER PROVISIONING TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_clan_owner()
RETURNS trigger AS $$
BEGIN
  IF NEW.owner_id IS NOT NULL THEN
    INSERT INTO public.clan_members (clan_id, user_id, role)
    VALUES (NEW.id, NEW.owner_id, 'owner')
    ON CONFLICT (clan_id, user_id) DO UPDATE SET role = 'owner';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS on_clan_created_owner ON public.clans;
CREATE TRIGGER on_clan_created_owner
  AFTER INSERT ON public.clans
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_clan_owner();

-- 2B. OWNERSHIP TRANSFER SYNCHRONIZATION
CREATE OR REPLACE FUNCTION public.handle_clan_ownership_transfer()
RETURNS trigger AS $$
BEGIN
  IF OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN
    IF NEW.owner_id IS NULL AND auth.uid() IS NOT NULL THEN
      RAISE EXCEPTION 'A clan cannot be ownerless. Transfer ownership to another user instead.';
    END IF;
    IF auth.uid() IS NOT NULL AND auth.uid() <> OLD.owner_id THEN
      RAISE EXCEPTION 'Only the current clan owner can transfer ownership';
    END IF;
    IF OLD.owner_id IS NOT NULL THEN
      UPDATE public.clan_members SET role = 'officer' WHERE clan_id = NEW.id AND user_id = OLD.owner_id;
    END IF;
    IF NEW.owner_id IS NOT NULL THEN
      INSERT INTO public.clan_members (clan_id, user_id, role)
      VALUES (NEW.id, NEW.owner_id, 'owner')
      ON CONFLICT (clan_id, user_id) DO UPDATE SET role = 'owner';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS on_clan_ownership_transfer ON public.clans;
CREATE TRIGGER on_clan_ownership_transfer
  AFTER UPDATE OF owner_id ON public.clans
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_clan_ownership_transfer();

-- 2C. RBAC INTEGRITY TRIGGER FOR CLAN MEMBERS (UPDATE)
CREATE OR REPLACE FUNCTION public.protect_clan_members_update()
RETURNS trigger AS $$
DECLARE
  executor_role text;
  actual_owner_id uuid;
BEGIN
  IF NEW.clan_id <> OLD.clan_id OR NEW.user_id <> OLD.user_id THEN
    RAISE EXCEPTION 'Cannot modify clan_id or user_id of a clan member';
  END IF;
  SELECT owner_id INTO actual_owner_id FROM public.clans WHERE id = NEW.clan_id;
  IF NEW.role = 'owner' AND NEW.user_id <> actual_owner_id THEN
    RAISE EXCEPTION 'Owner role in clan_members must match clans.owner_id';
  END IF;
  IF OLD.role = 'owner' AND NEW.role <> 'owner' AND OLD.user_id = actual_owner_id THEN
    RAISE EXCEPTION 'Cannot demote current owner directly. Transfer ownership on clans table instead.';
  END IF;
  IF auth.uid() IS NOT NULL THEN
    SELECT role INTO executor_role FROM public.clan_members WHERE clan_id = OLD.clan_id AND user_id = auth.uid();
    IF executor_role = 'officer' THEN
      IF OLD.role = 'owner' OR NEW.role = 'owner' THEN
        RAISE EXCEPTION 'Officers cannot manage owners';
      END IF;
      IF OLD.role = 'officer' AND OLD.user_id <> auth.uid() THEN
        RAISE EXCEPTION 'Officers cannot modify other officers';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS on_clan_member_update ON public.clan_members;
CREATE TRIGGER on_clan_member_update
  BEFORE UPDATE ON public.clan_members
  FOR EACH ROW
  EXECUTE PROCEDURE public.protect_clan_members_update();

-- 2D. RBAC INTEGRITY TRIGGER FOR CLAN MEMBERS (INSERT)
CREATE OR REPLACE FUNCTION public.protect_clan_members_insert()
RETURNS trigger AS $$
DECLARE
  actual_owner_id uuid;
BEGIN
  SELECT owner_id INTO actual_owner_id FROM public.clans WHERE id = NEW.clan_id;
  IF NEW.role = 'owner' AND NEW.user_id <> actual_owner_id THEN
    RAISE EXCEPTION 'Cannot insert a member with owner role unless they are the designated clan owner. Transfer ownership on clans table instead.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS on_clan_member_insert ON public.clan_members;
CREATE TRIGGER on_clan_member_insert
  BEFORE INSERT ON public.clan_members
  FOR EACH ROW
  EXECUTE PROCEDURE public.protect_clan_members_insert();

-- Backfill clan_members for existing clans so current owners aren't orphaned
INSERT INTO public.clan_members (clan_id, user_id, role)
SELECT id, owner_id, 'owner' FROM public.clans WHERE owner_id IS NOT NULL
ON CONFLICT (clan_id, user_id) DO NOTHING;

-- 3. CLAN JOIN REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.clan_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clan_id uuid NOT NULL REFERENCES public.clans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clan_id, user_id, status)
);

-- 3A. PREVENT MODIFICATION OF CORE FIELDS ON JOIN REQUESTS
CREATE OR REPLACE FUNCTION public.protect_clan_join_request_fields()
RETURNS trigger AS $$
BEGIN
  IF NEW.clan_id <> OLD.clan_id OR NEW.user_id <> OLD.user_id THEN
    RAISE EXCEPTION 'Cannot modify clan_id or user_id of a join request';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS on_clan_join_request_update ON public.clan_join_requests;
CREATE TRIGGER on_clan_join_request_update
  BEFORE UPDATE ON public.clan_join_requests
  FOR EACH ROW
  EXECUTE PROCEDURE public.protect_clan_join_request_fields();

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

-- 8. SECURITY HELPER TO AVOID RLS RECURSION
CREATE OR REPLACE FUNCTION public.is_clan_officer(check_clan_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.clan_members
    WHERE clan_id = check_clan_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'officer')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.is_clan_officer(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_clan_officer(uuid) TO authenticated;

-- 9. ROW LEVEL SECURITY (RLS) POLICIES
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
CREATE POLICY "Users can create clans" ON public.clans FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owner and officers can update clans" ON public.clans;
CREATE POLICY "Owner and officers can update clans" ON public.clans FOR UPDATE TO authenticated 
USING (owner_id = auth.uid() OR public.is_clan_officer(id));

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
WITH CHECK (public.is_clan_officer(clan_id));

DROP POLICY IF EXISTS "Owner/officers can update members" ON public.clan_members;
CREATE POLICY "Owner/officers can update members" ON public.clan_members FOR UPDATE TO authenticated 
USING (public.is_clan_officer(clan_id));

DROP POLICY IF EXISTS "Owner/officers or self can delete members" ON public.clan_members;
CREATE POLICY "Owner/officers or self can delete members" ON public.clan_members FOR DELETE TO authenticated 
USING (user_id = auth.uid() OR public.is_clan_officer(clan_id));

-- CLAN JOIN REQUESTS POLICIES
DROP POLICY IF EXISTS "Users can view relevant join requests" ON public.clan_join_requests;
CREATE POLICY "Users can view relevant join requests" ON public.clan_join_requests FOR SELECT TO authenticated 
USING (user_id = auth.uid() OR public.is_clan_officer(clan_id));

DROP POLICY IF EXISTS "Users can submit join requests" ON public.clan_join_requests;
CREATE POLICY "Users can submit join requests" ON public.clan_join_requests FOR INSERT TO authenticated 
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Owner/officers can update join requests" ON public.clan_join_requests;
CREATE POLICY "Owner/officers can update join requests" ON public.clan_join_requests FOR UPDATE TO authenticated 
USING (public.is_clan_officer(clan_id));

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
CREATE POLICY "Users can update own social posts" ON public.social_posts FOR UPDATE TO authenticated 
USING (user_id = auth.uid()) 
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own social posts" ON public.social_posts;
CREATE POLICY "Users can delete own social posts" ON public.social_posts FOR DELETE TO authenticated USING (user_id = auth.uid());

-- POST LIKES POLICIES
DROP POLICY IF EXISTS "Users can view likes on visible posts" ON public.post_likes;
CREATE POLICY "Users can view likes on visible posts" ON public.post_likes FOR SELECT TO authenticated 
USING (EXISTS (
  SELECT 1 FROM public.social_posts sp
  WHERE sp.id = post_likes.post_id
  AND (
    sp.visibility = 'public' 
    OR sp.user_id = auth.uid() 
    OR (sp.visibility = 'friends' AND EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE (f.user_one_id = auth.uid() AND f.user_two_id = sp.user_id) OR (f.user_two_id = auth.uid() AND f.user_one_id = sp.user_id)
    ))
  )
));

DROP POLICY IF EXISTS "Users can like" ON public.post_likes;
CREATE POLICY "Users can like" ON public.post_likes FOR INSERT TO authenticated 
WITH CHECK (
  user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.social_posts sp
    WHERE sp.id = post_likes.post_id
    AND (
      sp.visibility = 'public' 
      OR sp.user_id = auth.uid() 
      OR (sp.visibility = 'friends' AND EXISTS (
        SELECT 1 FROM public.friendships f
        WHERE (f.user_one_id = auth.uid() AND f.user_two_id = sp.user_id) OR (f.user_two_id = auth.uid() AND f.user_one_id = sp.user_id)
      ))
    )
  )
);

DROP POLICY IF EXISTS "Users can unlike" ON public.post_likes;
CREATE POLICY "Users can unlike" ON public.post_likes FOR DELETE TO authenticated USING (user_id = auth.uid());

-- POST COMMENTS POLICIES
DROP POLICY IF EXISTS "Users can view comments on visible posts" ON public.post_comments;
CREATE POLICY "Users can view comments on visible posts" ON public.post_comments FOR SELECT TO authenticated 
USING (EXISTS (
  SELECT 1 FROM public.social_posts sp
  WHERE sp.id = post_comments.post_id
  AND (
    sp.visibility = 'public' 
    OR sp.user_id = auth.uid() 
    OR (sp.visibility = 'friends' AND EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE (f.user_one_id = auth.uid() AND f.user_two_id = sp.user_id) OR (f.user_two_id = auth.uid() AND f.user_one_id = sp.user_id)
    ))
  )
));

DROP POLICY IF EXISTS "Users can comment" ON public.post_comments;
CREATE POLICY "Users can comment" ON public.post_comments FOR INSERT TO authenticated 
WITH CHECK (
  user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.social_posts sp
    WHERE sp.id = post_comments.post_id
    AND (
      sp.visibility = 'public' 
      OR sp.user_id = auth.uid() 
      OR (sp.visibility = 'friends' AND EXISTS (
        SELECT 1 FROM public.friendships f
        WHERE (f.user_one_id = auth.uid() AND f.user_two_id = sp.user_id) OR (f.user_two_id = auth.uid() AND f.user_one_id = sp.user_id)
      ))
    )
  )
);

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

-- 10. RELOAD SCHEMA CACHE
NOTIFY pgrst, 'reload schema';

COMMIT;
