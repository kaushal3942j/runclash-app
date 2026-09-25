-- Fix Clan Members RLS to prevent Officers from modifying/deleting Owners
BEGIN;

-- Drop the old overly permissive policies
DROP POLICY IF EXISTS "Owner/officers can update members" ON public.clan_members;
DROP POLICY IF EXISTS "Owner/officers or self can delete members" ON public.clan_members;

-- New UPDATE Policy: 
-- 1. Owner can update anyone (except maybe changing their own role in a way that leaves 0 owners, handled via triggers or app logic)
-- 2. Officer can update members, but cannot update owners.
CREATE POLICY "Owner/officers can update members" ON public.clan_members FOR UPDATE TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.clan_members cm 
    WHERE cm.clan_id = clan_members.clan_id 
      AND cm.user_id = auth.uid() 
      AND (
        cm.role = 'owner' 
        OR (cm.role = 'officer' AND clan_members.role != 'owner')
      )
  )
);

-- New DELETE Policy:
-- 1. Self can delete self (Leave clan)
-- 2. Owner can delete anyone
-- 3. Officer can delete members, but cannot delete owners.
CREATE POLICY "Owner/officers or self can delete members" ON public.clan_members FOR DELETE TO authenticated 
USING (
  user_id = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM public.clan_members cm 
    WHERE cm.clan_id = clan_members.clan_id 
      AND cm.user_id = auth.uid() 
      AND (
        cm.role = 'owner' 
        OR (cm.role = 'officer' AND clan_members.role != 'owner')
      )
  )
);

COMMIT;
