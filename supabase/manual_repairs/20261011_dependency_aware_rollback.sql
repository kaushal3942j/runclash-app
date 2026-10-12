-- ============================================================================
-- RUNCLASH: DEPENDENCY-AWARE ROLLBACK SCRIPT FOR MIGRATION 20261011
-- File: supabase/manual_repairs/20261011_dependency_aware_rollback.sql
-- 
-- Restores pre-migration database state safely without using un-inventoried
-- CASCADE drops and without silently discarding MultiPolygon geometry components.
-- ============================================================================

BEGIN;

-- 1. DROP CREATED VIEW AND RPC (USING RESTRICT TO PREVENT UNINTENDED CASCADES)
-- RESTRICT ensures that if any unexpected downstream view or trigger was created
-- on top of runner_activities_public or get_runner_public_stats, PostgreSQL will
-- block the drop rather than silently destroying downstream dependencies.
DROP VIEW IF EXISTS public.runner_activities_public RESTRICT;
DROP FUNCTION IF EXISTS public.get_runner_public_stats(uuid) RESTRICT;

-- 2. RESTORE TABLE PRIVILEGES ON public.runs FOR authenticated ROLE
-- Re-grants the pre-migration privileges (TRUNCATE, REFERENCES, TRIGGER) that were
-- verified to exist before the migration.
GRANT TRUNCATE, REFERENCES, TRIGGER ON TABLE public.runs TO authenticated;

-- 3. DEPENDENCY-AWARE GEOMETRY TYPMOD REVERSION
-- CRITICAL SAFETY RULE: Do NOT silently discard MultiPolygon components!
-- If any territory has been saved or repaired as a MultiPolygon, altering the
-- typmod to geometry(Polygon, 4326) would either fail with an error or discard
-- sub-polygon parts if forced with ST_GeometryN.
DO $$
DECLARE
  multi_count INTEGER;
BEGIN
  SELECT count(*) INTO multi_count 
  FROM public.territories 
  WHERE polygon_geom IS NOT NULL 
    AND ST_GeometryType(polygon_geom) = 'ST_MultiPolygon';

  IF multi_count > 0 THEN
    RAISE WARNING 'SAFETY GUARD: % MultiPolygon geometries exist in public.territories. '
                  'Typmod will NOT be reverted to Polygon to prevent silent data loss. '
                  'Column remains geometry(Geometry, 4326), which is 100%% backwards-compatible.', 
                  multi_count;
  ELSE
    -- Safe to revert typmod because all existing geometries are single-part Polygons
    ALTER TABLE public.territories 
      ALTER COLUMN polygon_geom TYPE geometry(Polygon, 4326) 
      USING polygon_geom::geometry(Polygon, 4326);
    RAISE NOTICE 'Reverted polygon_geom typmod to geometry(Polygon, 4326).';
  END IF;
END $$;

-- 4. RESTORE PRE-MIGRATION POLICIES ON public.runs IF NEEDED
-- (The migration recreated owner-only policies matching the 4 pre-existing policies.
-- If legacy policy names need exact restoration, they can be confirmed here.)

COMMIT;
