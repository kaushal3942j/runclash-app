-- ============================================================================
-- RUNCLASH 2.0 — OPERATION 2: LIVING TERRITORIES MIGRATION
-- Adds tracking columns for territory decay and health recharge mechanics.
-- ============================================================================

BEGIN;

-- 1. Safely add last_recharged_at to territories
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'territories' 
      AND column_name = 'last_recharged_at'
  ) THEN
    ALTER TABLE public.territories ADD COLUMN last_recharged_at TIMESTAMPTZ NULL;
  END IF;
END $$;

-- 2. Backfill existing territories to use their created_at as their first recharge time
UPDATE public.territories 
SET last_recharged_at = created_at 
WHERE last_recharged_at IS NULL;

-- 3. Idempotent Index on last_recharged_at for query performance when finding decayed territories
DROP INDEX IF EXISTS idx_territories_last_recharged_at;
CREATE INDEX idx_territories_last_recharged_at 
  ON public.territories(last_recharged_at DESC);

-- Note: We rely on existing RLS policies on territories which restrict UPDATE to:
-- Auth Self (owner_id = auth.uid()) OR Clan Leader.
-- The recharge action will be a standard UPDATE public.territories SET last_recharged_at = now()
-- which is already protected by:
-- CREATE POLICY "territories_update_policy" ON public.territories FOR UPDATE TO authenticated 
-- USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

COMMIT;
