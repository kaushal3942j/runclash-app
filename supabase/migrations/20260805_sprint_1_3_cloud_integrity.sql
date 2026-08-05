-- ============================================================================
-- RUNCLASH 2.0 — SPRINT 1.3A MONOLITHIC CLOUD INTEGRITY MIGRATION SCRIPT
-- Copy and paste this ENTIRE file once into the Supabase Dashboard SQL Editor
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- STEP 0: ENABLE PGCRYPTO EXTENSION FOR UUID GENERATION
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- STEP 1: CREATE PUBLIC.RUNS TABLE FOR CLOUD RUN HISTORY
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  distance_km NUMERIC NOT NULL DEFAULT 0,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  pace_seconds_per_km NUMERIC NULL,
  average_speed_kmh NUMERIC NULL,
  calories INTEGER NOT NULL DEFAULT 0,
  gps_path JSONB NOT NULL DEFAULT '[]'::jsonb,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  summary_statistics JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_runs_user_operation UNIQUE (user_id, operation_id)
);

-- Idempotent index management for runs table
DROP INDEX IF EXISTS idx_runs_user_start;
CREATE INDEX idx_runs_user_start 
  ON public.runs(user_id, start_time DESC);

-- ----------------------------------------------------------------------------
-- STEP 2: SAFE ALTERATIONS & IDEMPOTENT INDEXES FOR PUBLIC.TERRITORIES
-- ----------------------------------------------------------------------------
-- Safely add claim_id UUID column if missing (allows NULL initially for legacy compatibility)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'territories' 
      AND column_name = 'claim_id'
  ) THEN
    ALTER TABLE public.territories ADD COLUMN claim_id UUID NULL;
  END IF;
END $$;

-- Idempotent index management for territories table
DROP INDEX IF EXISTS idx_territories_owner_id;
CREATE INDEX idx_territories_owner_id 
  ON public.territories(owner_id);

DROP INDEX IF EXISTS idx_territories_expires_at;
CREATE INDEX idx_territories_expires_at 
  ON public.territories(expires_at);

-- Partial Unique Index for Idempotent Claims (applies only when claim_id is not null)
DROP INDEX IF EXISTS idx_territories_owner_claim;
CREATE UNIQUE INDEX idx_territories_owner_claim 
  ON public.territories(owner_id, claim_id) 
  WHERE claim_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- STEP 3: ENABLE ROW LEVEL SECURITY (RLS)
-- ----------------------------------------------------------------------------
ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.territories ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- STEP 4: DROP LEGACY AND RE-RUNNABLE POLICIES
-- ----------------------------------------------------------------------------
-- Legacy policies on territories
DROP POLICY IF EXISTS "Allow public read access" ON public.territories;
DROP POLICY IF EXISTS "Allow public write access" ON public.territories;
DROP POLICY IF EXISTS "Territories read access" ON public.territories;
DROP POLICY IF EXISTS "Territories insert authenticated" ON public.territories;
DROP POLICY IF EXISTS "Territories update own" ON public.territories;

-- Current target policies (ensures clean script re-runability)
DROP POLICY IF EXISTS "runs_select_policy" ON public.runs;
DROP POLICY IF EXISTS "runs_insert_policy" ON public.runs;
DROP POLICY IF EXISTS "runs_update_policy" ON public.runs;
DROP POLICY IF EXISTS "runs_delete_policy" ON public.runs;

DROP POLICY IF EXISTS "territories_select_policy" ON public.territories;
DROP POLICY IF EXISTS "territories_insert_policy" ON public.territories;
DROP POLICY IF EXISTS "territories_update_policy" ON public.territories;

-- ----------------------------------------------------------------------------
-- STEP 5: CREATE FINAL STRICT RLS SECURITY POLICIES
-- ----------------------------------------------------------------------------

-- PUBLIC.RUNS POLICIES
CREATE POLICY "runs_select_policy" 
  ON public.runs 
  FOR SELECT 
  TO authenticated 
  USING (auth.uid() = user_id);

CREATE POLICY "runs_insert_policy" 
  ON public.runs 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "runs_update_policy" 
  ON public.runs 
  FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "runs_delete_policy" 
  ON public.runs 
  FOR DELETE 
  TO authenticated 
  USING (auth.uid() = user_id);

-- PUBLIC.TERRITORIES FINAL POLICIES
CREATE POLICY "territories_select_policy" 
  ON public.territories 
  FOR SELECT 
  TO public 
  USING (true);

CREATE POLICY "territories_insert_policy" 
  ON public.territories 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND auth.uid() = owner_id
  );

CREATE POLICY "territories_update_policy" 
  ON public.territories 
  FOR UPDATE 
  TO authenticated 
  USING (
    auth.uid() IS NOT NULL 
    AND auth.uid() = owner_id
  ) 
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND auth.uid() = owner_id
  );

COMMIT;
