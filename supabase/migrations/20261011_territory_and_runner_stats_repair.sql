-- ============================================================================
-- RUNCLASH 2.0 — TERRITORY GEOMETRY, TAKEOVER & RUNNER STATS RLS REPAIR
-- Version: 20261011_territory_and_runner_stats_repair
-- Execute this script in your Supabase Dashboard SQL Editor
-- ============================================================================

-- ============================================================================
-- PRE-MIGRATION READ-ONLY PREFLIGHT AUDIT QUERIES
-- Execute these read-only diagnostic queries in Supabase SQL Editor BEFORE
-- applying the migration to inspect current schema state without mutating data:
-- ============================================================================
-- 1. Check actual column type, SRID, and nullability of territories.polygon_geom:
--    SELECT column_name, data_type, udt_name, is_nullable
--    FROM information_schema.columns 
--    WHERE table_schema = 'public' AND table_name = 'territories' AND column_name = 'polygon_geom';
--
-- 2. Check indexes on public.territories and public.runs:
--    SELECT tablename, indexname, indexdef 
--    FROM pg_indexes 
--    WHERE schemaname = 'public' AND tablename IN ('territories', 'runs')
--    ORDER BY tablename, indexname;
--
-- 3. Check view dependencies referencing territories or runs:
--    SELECT table_name, view_definition 
--    FROM information_schema.views 
--    WHERE table_schema = 'public' 
--      AND (view_definition ILIKE '%territories%' OR view_definition ILIKE '%runs%');
--
-- 4. Check existing triggers on public.territories and public.runs:
--    SELECT trigger_name, event_manipulation, event_object_table, action_statement, action_timing 
--    FROM information_schema.triggers 
--    WHERE event_object_schema = 'public' AND event_object_table IN ('territories', 'runs');
--
-- 5. Check required columns on public.territories, public.runs, and public.profiles:
--    SELECT table_name, column_name, data_type, is_nullable, column_default 
--    FROM information_schema.columns 
--    WHERE table_schema = 'public' 
--      AND (
--        (table_name = 'territories' AND column_name IN ('polygon_geom', 'coords', 'is_active', 'status', 'conquered_by_id', 'expires_at'))
--        OR (table_name = 'runs' AND column_name IN ('id', 'user_id', 'operation_id', 'distance_km', 'created_at', 'gps_path'))
--        OR (table_name = 'profiles' AND column_name IN ('id', 'is_profile_public', 'show_activity'))
--      )
--    ORDER BY table_name, column_name;
--
-- 6. Inventory existing RLS policies on public.runs and public.territories:
--    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
--    FROM pg_policies 
--    WHERE schemaname = 'public' AND tablename IN ('runs', 'territories')
--    ORDER BY tablename, policyname;
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- STEP 0: ENSURE POSTGIS EXTENSION & GEOMETRY COLUMN COMPATIBILITY
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS postgis;

-- Assert core table dependency
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'territories'
  ) THEN
    RAISE EXCEPTION 'Dependency check failed: table public.territories does not exist.';
  END IF;
END $$;

-- Ensure territory state columns exist safely without schema rewrites
ALTER TABLE public.territories ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.territories ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
ALTER TABLE public.territories ADD COLUMN IF NOT EXISTS conquered_by_id uuid;
ALTER TABLE public.territories ADD COLUMN IF NOT EXISTS expires_at timestamptz DEFAULT (now() + interval '72 hours');

-- Ensure polygon_geom accepts both Polygon and MultiPolygon geometries
-- without discarding polygon components or failing typmod validation.
-- PREFLIGHT LOCKING & DEPENDENCY NOTES:
-- 1. ALTER TABLE ... ALTER COLUMN TYPE acquires an ACCESS EXCLUSIVE lock on public.territories,
--    blocking concurrent reads and writes for the duration of the typmod conversion and spatial index validation.
--    Preflight checks (see diagnostic queries above) must be executed before applying this change in production.
-- 2. No existing views reference polygon_geom directly. Existing GiST spatial index
--    territories_geom_gist_idx is maintained and fully supports geometry(Geometry, 4326).
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'territories' 
      AND column_name = 'polygon_geom'
  ) THEN
    ALTER TABLE public.territories 
      ALTER COLUMN polygon_geom TYPE geometry(Geometry, 4326) 
      USING polygon_geom::geometry(Geometry, 4326);
  ELSE
    ALTER TABLE public.territories 
      ADD COLUMN polygon_geom geometry(Geometry, 4326);
  END IF;
END $$;

-- Spatial index for high-performance takeover and query operations
CREATE INDEX IF NOT EXISTS territories_geom_gist_idx 
  ON public.territories USING gist (polygon_geom);


-- ----------------------------------------------------------------------------
-- STEP 1: POSTGIS GEOMETRY TRANSLATOR TRIGGER
-- ----------------------------------------------------------------------------
-- Safely builds polygons from JSON coords with duplicate filtering,
-- robust coordinate bounds validation, self-intersection repair, and guaranteed
-- non-empty Polygon/MultiPolygon validation (SRID 4326)
CREATE OR REPLACE FUNCTION public.update_territory_geom()
RETURNS trigger AS $$
DECLARE
  points_str text := '';
  coord_rec jsonb;
  prev_lng numeric := null;
  prev_lat numeric := null;
  curr_lng_str text;
  curr_lat_str text;
  curr_lng numeric;
  curr_lat numeric;
  first_lng numeric := null;
  first_lat numeric := null;
  pt_count integer := 0;
  raw_geom geometry;
BEGIN
  -- On UPDATE where coords did not change and a fully compliant polygonal geometry already exists, preserve it
  IF TG_OP = 'UPDATE' 
     AND new.coords = old.coords 
     AND new.polygon_geom IS NOT NULL 
     AND ST_IsValid(new.polygon_geom)
     AND NOT ST_IsEmpty(new.polygon_geom)
     AND ST_SRID(new.polygon_geom) = 4326
     AND ST_GeometryType(new.polygon_geom) IN ('ST_Polygon', 'ST_MultiPolygon')
     AND ST_Area(new.polygon_geom::geography) > 0 THEN
    RETURN new;
  END IF;

  IF new.coords IS NULL 
     OR jsonb_typeof(new.coords::jsonb) <> 'array' 
     OR jsonb_array_length(new.coords::jsonb) < 3 THEN
    RAISE EXCEPTION 'Invalid territory coords: must provide a JSON array with at least 3 coordinates.';
  END IF;

  -- 1. Deduplicate consecutive identical GPS points and validate geographic ranges
  FOR coord_rec IN SELECT jsonb_array_elements(new.coords::jsonb) LOOP
    IF jsonb_typeof(coord_rec) <> 'array' OR jsonb_array_length(coord_rec) < 2 THEN
      RAISE EXCEPTION 'Invalid territory coordinate: each entry must be a [latitude, longitude] array.';
    END IF;

    curr_lat_str := coord_rec->>0;
    curr_lng_str := coord_rec->>1;

    IF curr_lat_str IS NULL OR curr_lng_str IS NULL OR curr_lat_str = '' OR curr_lng_str = '' THEN
      RAISE EXCEPTION 'Invalid territory coordinate: latitude and longitude cannot be null or empty.';
    END IF;

    BEGIN
      curr_lat := curr_lat_str::numeric;
      curr_lng := curr_lng_str::numeric;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Invalid territory coordinate: non-numeric latitude (%) or longitude (%).', curr_lat_str, curr_lng_str;
    END;

    -- Validate geographic bounds
    IF curr_lat < -90.0 OR curr_lat > 90.0 THEN
      RAISE EXCEPTION 'Invalid territory coordinate: latitude % out of bounds [-90, 90].', curr_lat;
    END IF;

    IF curr_lng < -180.0 OR curr_lng > 180.0 THEN
      RAISE EXCEPTION 'Invalid territory coordinate: longitude % out of bounds [-180, 180].', curr_lng;
    END IF;

    IF prev_lat IS NULL OR curr_lat <> prev_lat OR curr_lng <> prev_lng THEN
      IF points_str <> '' THEN
        points_str := points_str || ', ';
      END IF;
      -- PostGIS standard X Y order: Longitude Latitude
      points_str := points_str || curr_lng::text || ' ' || curr_lat::text;
      IF first_lng IS NULL THEN
        first_lng := curr_lng;
        first_lat := curr_lat;
      END IF;
      prev_lng := curr_lng;
      prev_lat := curr_lat;
      pt_count := pt_count + 1;
    END IF;
  END LOOP;

  -- Must have at least 3 distinct vertices to form a polygon
  IF pt_count < 3 THEN
    RAISE EXCEPTION 'Invalid territory coords: coordinates contain fewer than 3 distinct vertices.';
  END IF;

  -- 2. Ensure closed ring
  IF prev_lng <> first_lng OR prev_lat <> first_lat THEN
    points_str := points_str || ', ' || first_lng::text || ' ' || first_lat::text;
  END IF;

  -- 3. Construct Geometry safely with ST_MakeValid repair paths
  BEGIN
    raw_geom := ST_GeomFromText('POLYGON((' || points_str || '))', 4326);
  EXCEPTION WHEN others THEN
    raw_geom := null;
  END;

  -- Ensure invalid or unformed polygons pass through the appropriate ST_MakeValid repair paths
  -- Note: ST_GeomFromText can successfully construct a geometry that is topologically invalid
  IF raw_geom IS NULL OR NOT ST_IsValid(raw_geom) THEN
    BEGIN
      IF raw_geom IS NOT NULL THEN
        raw_geom := ST_MakeValid(raw_geom);
      END IF;
    EXCEPTION WHEN others THEN
      raw_geom := null;
    END;

    -- If direct ST_MakeValid was unsuccessful or resulted in empty/non-polygonal geometry,
    -- fallback to linestring nodal reconstruction
    IF raw_geom IS NULL 
       OR NOT ST_IsValid(raw_geom) 
       OR ST_IsEmpty(raw_geom) 
       OR ST_GeometryType(raw_geom) NOT IN ('ST_Polygon', 'ST_MultiPolygon', 'ST_GeometryCollection') THEN
      BEGIN
        raw_geom := ST_MakeValid(ST_BuildArea(ST_Node(ST_GeomFromText('LINESTRING(' || points_str || ')', 4326))));
      EXCEPTION WHEN others THEN
        BEGIN
          raw_geom := ST_MakeValid(ST_Polygon(ST_GeomFromText('LINESTRING(' || points_str || ')', 4326), 4326));
        EXCEPTION WHEN others THEN
          raw_geom := null;
        END;
      END;
    END IF;
  END IF;

  IF raw_geom IS NOT NULL THEN
    -- Ensure SRID is 4326 even if ST_BuildArea or ST_Node dropped it to 0
    IF ST_SRID(raw_geom) = 0 OR ST_SRID(raw_geom) IS NULL THEN
      raw_geom := ST_SetSRID(raw_geom, 4326);
    END IF;

    IF NOT ST_IsValid(raw_geom) THEN
      BEGIN
        raw_geom := ST_MakeValid(raw_geom);
      EXCEPTION WHEN others THEN
        NULL;
      END;
    END IF;

    -- Extract 2D polygonal components if ST_MakeValid returns a GeometryCollection
    IF ST_GeometryType(raw_geom) = 'ST_GeometryCollection' THEN
      raw_geom := ST_CollectionExtract(raw_geom, 3);
    END IF;

    -- Guarantee SRID is preserved after extraction
    IF ST_SRID(raw_geom) = 0 OR ST_SRID(raw_geom) IS NULL THEN
      raw_geom := ST_SetSRID(raw_geom, 4326);
    END IF;

    -- Accept both Polygon and MultiPolygon without discarding components, requiring valid, non-empty, positive area, and SRID 4326
    IF ST_GeometryType(raw_geom) IN ('ST_Polygon', 'ST_MultiPolygon') 
       AND NOT ST_IsEmpty(raw_geom) 
       AND ST_IsValid(raw_geom) 
       AND ST_SRID(raw_geom) = 4326 
       AND ST_Area(raw_geom::geography) > 0 THEN
      new.polygon_geom := raw_geom;
      IF (new.area_sqm IS NULL OR new.area_sqm <= 0) THEN
        BEGIN
          new.area_sqm := round(ST_Area(raw_geom::geography));
        EXCEPTION WHEN others THEN
          NULL;
        END;
      END IF;
    ELSE
      new.polygon_geom := null;
    END IF;
  ELSE
    new.polygon_geom := null;
  END IF;

  IF new.polygon_geom IS NULL THEN
    IF raw_geom IS NOT NULL AND ST_GeometryType(raw_geom) NOT IN ('ST_Polygon', 'ST_MultiPolygon') THEN
      RAISE EXCEPTION 'Unrecoverable territory geometry: coordinates collapsed into non-polygonal geometry (%) during repair. A valid 2D polygon or multipolygon is required.', ST_GeometryType(raw_geom);
    ELSIF raw_geom IS NOT NULL AND ST_IsEmpty(raw_geom) THEN
      RAISE EXCEPTION 'Unrecoverable territory geometry: repair produced an empty geometry.';
    ELSIF raw_geom IS NOT NULL AND ST_Area(raw_geom::geography) <= 0 THEN
      RAISE EXCEPTION 'Unrecoverable territory geometry: repair produced zero geodesic area.';
    ELSE
      RAISE EXCEPTION 'Failed to generate valid territory geometry: coordinates could not be formed or repaired into a valid, non-empty 2D polygon or multipolygon with positive area (SRID 4326).';
    END IF;
  END IF;

  RETURN new;
EXCEPTION
  WHEN others THEN
    RAISE EXCEPTION 'Territory geometry generation failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_territory_geom_update ON public.territories;
CREATE TRIGGER on_territory_geom_update
  BEFORE INSERT OR UPDATE OF coords ON public.territories
  FOR EACH ROW EXECUTE PROCEDURE public.update_territory_geom();


-- ----------------------------------------------------------------------------
-- STEP 2: CRASH-PROOF LOG CLEANUP FUNCTION
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_old_logs()
RETURNS void AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'error_logs') THEN
    DELETE FROM public.error_logs WHERE created_at < now() - interval '30 days';
  END IF;
END;
$$ LANGUAGE plpgsql;


-- ----------------------------------------------------------------------------
-- STEP 3: TERRITORY TAKEOVER TRIGGER (CRASH-PROOF MULTIPOLYGON COMPATIBILITY)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_territory_takeovers()
RETURNS trigger AS $$
DECLARE
  old_terr record;
  overlap_area numeric;
  old_area numeric;
  ratio numeric;
BEGIN
  IF new.polygon_geom IS NULL OR NOT ST_IsValid(new.polygon_geom) THEN
    RETURN new;
  END IF;

  -- Soft-delete overlapping territories (> 50% overlap of the old territory)
  -- Uses GiST bounding box operator (&&) for index-accelerated candidate filtering
  FOR old_terr IN
    SELECT id, owner_id, area_sqm, polygon_geom
    FROM public.territories
    WHERE id <> new.id 
      AND is_active = true 
      AND polygon_geom IS NOT NULL 
      AND ST_IsValid(polygon_geom)
      AND polygon_geom && new.polygon_geom
  LOOP
    BEGIN
      IF ST_Intersects(new.polygon_geom, old_terr.polygon_geom) THEN
        -- Safely extract 2D polygonal overlap components to avoid GeometryCollection cast errors
        overlap_area := ST_Area(ST_CollectionExtract(ST_Intersection(new.polygon_geom, old_terr.polygon_geom), 3)::geography);
        old_area := ST_Area(ST_CollectionExtract(old_terr.polygon_geom, 3)::geography);

        IF (old_area IS NULL OR old_area <= 0) AND old_terr.area_sqm > 0 THEN
          old_area := old_terr.area_sqm;
        END IF;

        IF old_area > 0 THEN
          ratio := overlap_area / old_area;
          IF ratio > 0.5 THEN
            UPDATE public.territories
            SET is_active = false, status = 'conquered', conquered_by_id = new.owner_id
            WHERE id = old_terr.id;
          END IF;
        END IF;
      END IF;
    EXCEPTION
      WHEN others THEN
        RAISE WARNING 'Skipping topology exception for territory %: %', old_terr.id, SQLERRM;
        -- ARCHITECTURAL FAILURE STRATEGY & BEHAVIOR DOCUMENTATION:
        -- 1. BEHAVIOR ON TOPOLOGY EXCEPTION:
        --    When PostGIS ST_Intersection or ST_Area fails with a topology exception on an intersecting candidate:
        --    - The exception is trapped, leaving this candidate territory active (is_active = true).
        --    - The database does NOT mark the candidate conquered and does NOT claim complete takeover of it.
        --    - The new territory claim commits, preventing corrupt legacy polygons from blocking live runners.
        -- 2. PARTIAL TAKEOVER INCOMPLETE STATE:
        --    If the candidate actually had > 50% overlap, skipping it leaves both territories co-active.
        --    Client applications must verify returned territory states rather than assuming all overlapping
        --    polygons were conquered.
        -- 3. RECOMMENDED TESTABLE STRATEGY:
        --    - Automated tests and strict environments: Fail transaction atomically using:
        --      RAISE EXCEPTION 'Takeover calculation failed for candidate territory %: %', old_terr.id, SQLERRM;
        --      This guarantees zero partial takeovers and allows test suites to catch corrupt geometries early.
        --    - Production resilience: Keep candidate-skipping with WARNING to avoid crashing runner activity,
        --      and record the error in error_logs for offline repair.
    END;
  END LOOP;

  -- Soft-delete expired territories on new captures
  UPDATE public.territories
  SET is_active = false, status = 'expired'
  WHERE expires_at IS NOT NULL AND expires_at <= now() AND is_active = true;

  RETURN new;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_territory_insert_takeover ON public.territories;
CREATE TRIGGER on_territory_insert_takeover
  AFTER INSERT ON public.territories
  FOR EACH ROW EXECUTE PROCEDURE public.handle_territory_takeovers();


-- ----------------------------------------------------------------------------
-- STEP 4: PERMISSIONS & RLS FOR RUNS TABLE (RUNNER PRIVACY HARDENING)
-- ----------------------------------------------------------------------------
-- Explicit dependency validation: Assert required tables exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'runs'
  ) THEN
    RAISE EXCEPTION 'Dependency check failed: table public.runs does not exist. Apply 20260805_sprint_1_3_cloud_integrity.sql first.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) THEN
    RAISE EXCEPTION 'Dependency check failed: table public.profiles does not exist.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_profile_public'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'show_activity'
  ) THEN
    RAISE EXCEPTION 'Dependency check failed: columns is_profile_public or show_activity missing on public.profiles. Apply 20260806_phase_2_social_system.sql first.';
  END IF;
END $$;

-- Ensure created_at exists on public.runs without assigning misleading timestamps to existing runs
-- Verified live finding: public.runs.created_at already exists, is NOT NULL, and defaults to now().
-- Defensive check ensures script idempotency without altering existing columns or timestamps:
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'runs' 
      AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.runs ADD COLUMN created_at timestamptz;
    -- Backfill created_at from historical run start_time to preserve authentic timestamps
    UPDATE public.runs 
    SET created_at = COALESCE(start_time, end_time, now()) 
    WHERE created_at IS NULL;
    ALTER TABLE public.runs ALTER COLUMN created_at SET DEFAULT now();
    ALTER TABLE public.runs ALTER COLUMN created_at SET NOT NULL;
  END IF;
END $$;

-- Enable RLS for runs
ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY;

-- Grant PostgREST roles access to runs table:
-- Revoke all direct privileges on raw runs table from anon and public roles
REVOKE ALL ON TABLE public.runs FROM anon, public;
-- Revoke dangerous and unnecessary table privileges (TRUNCATE, REFERENCES, TRIGGER) from authenticated
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.runs FROM authenticated;
-- Explicitly grant required DML privileges to authenticated role only
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.runs TO authenticated;

-- PRIVACY FIX: Restrict direct access to public.runs STRICTLY to the authenticated owner.
-- RATIONALE FOR POLICY CLEANUP ON public.runs:
-- 1. public.runs stores sensitive location telemetry (gps_path, precise run timestamps).
-- 2. In PostgreSQL RLS, multiple permissive SELECT policies combine using logical OR.
--    If any legacy permissive policy exists on public.runs (e.g. "Allow authenticated read runs"
--    or "Runs read access"), adding a new owner-only policy DOES NOT RESTRICT access.
-- 3. The loop below targets ONLY tablename = 'runs' in schema 'public'. It does NOT drop
--    policies on profiles, clans, territories, or any other unrelated table.
-- 4. The 4 owner-only policies recreated below (runs_select_policy, runs_insert_policy,
--    runs_update_policy, runs_delete_policy) guarantee that direct table access is restricted
--    strictly to auth.uid() = user_id.
-- 5. Cross-user activity feeds and leaderboard metrics are accessed exclusively through
--    public.runner_activities_public and public.get_runner_public_stats(uuid), which omit
--    gps_path and enforce each runner's profile visibility settings.
-- Dynamically drop ALL existing policies on public.runs to eliminate any rogue or legacy permissive rules
DO $$ 
DECLARE
  pol record;
BEGIN
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'runs'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.runs', pol.policyname);
  END LOOP;
END $$;

-- Explicitly drop known legacy named policies as fallback
DROP POLICY IF EXISTS "runs_select_policy" ON public.runs;
DROP POLICY IF EXISTS "runs_insert_policy" ON public.runs;
DROP POLICY IF EXISTS "runs_update_policy" ON public.runs;
DROP POLICY IF EXISTS "runs_delete_policy" ON public.runs;
DROP POLICY IF EXISTS "Allow public read runs" ON public.runs;
DROP POLICY IF EXISTS "Allow authenticated read runs" ON public.runs;
DROP POLICY IF EXISTS "Runs read access" ON public.runs;
DROP POLICY IF EXISTS "runs_read_policy" ON public.runs;

CREATE POLICY "runs_select_policy" 
  ON public.runs 
  FOR SELECT 
  TO authenticated 
  USING (auth.uid() = user_id);

-- Ensure authenticated users can only insert their own runs
DROP POLICY IF EXISTS "runs_insert_policy" ON public.runs;
CREATE POLICY "runs_insert_policy" 
  ON public.runs 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = user_id);

-- Ensure authenticated users can only update their own runs and cannot change user_id
DROP POLICY IF EXISTS "runs_update_policy" ON public.runs;
CREATE POLICY "runs_update_policy" 
  ON public.runs 
  FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Ensure authenticated users can only delete their own runs
DROP POLICY IF EXISTS "runs_delete_policy" ON public.runs;
CREATE POLICY "runs_delete_policy" 
  ON public.runs 
  FOR DELETE 
  TO authenticated 
  USING (auth.uid() = user_id);


-- ----------------------------------------------------------------------------
-- STEP 5: PRIVACY-SAFE PUBLIC RUNNER METRICS (NO GPS_PATH EXPOSURE)
-- ----------------------------------------------------------------------------
-- Security-hardened public view that exposes performance metrics (distance, pace,
-- duration) while completely omitting raw GPS breadcrumbs (gps_path) and precise
-- start/end timestamps that could expose home/workplace locations.
-- Uses security_invoker = false (security definer view execution) to allow reading
-- non-sensitive aggregate run attributes across users while enforcing profile privacy flags.
CREATE OR REPLACE VIEW public.runner_activities_public WITH (security_invoker = false) AS
SELECT 
  r.id,
  r.operation_id,
  r.user_id,
  r.distance_km,
  r.duration_seconds,
  r.pace_seconds_per_km,
  r.average_speed_kmh,
  r.calories,
  r.created_at
FROM public.runs r
JOIN public.profiles p ON p.id = r.user_id
WHERE (auth.uid() IS NOT NULL AND auth.uid() = r.user_id)
   OR (
     COALESCE(p.is_profile_public, true) = true
     AND COALESCE(p.show_activity, true) = true
   );

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
    ALTER VIEW public.runner_activities_public OWNER TO postgres;
  END IF;
END $$;

REVOKE ALL ON public.runner_activities_public FROM PUBLIC;
GRANT SELECT ON public.runner_activities_public TO anon, authenticated;

-- Security-Definer RPC for high-performance aggregate profile statistics.
-- Validates profile existence and privacy flags before executing query.
CREATE OR REPLACE FUNCTION public.get_runner_public_stats(target_user_id uuid)
RETURNS TABLE (
  total_distance_km numeric,
  total_runs bigint,
  longest_run_km numeric,
  fastest_pace_seconds numeric,
  average_pace_seconds numeric
) 
LANGUAGE plpgsql SECURITY DEFINER 
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  -- Validate target profile existence and privacy permissions:
  -- Target profile must exist, and either:
  -- 1) The caller is the target user (auth.uid() = target_user_id), OR
  -- 2) The profile is public (is_profile_public = true) AND activity sharing is enabled (show_activity = true)
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = target_user_id 
      AND (
        (auth.uid() IS NOT NULL AND auth.uid() = target_user_id)
        OR (
          COALESCE(is_profile_public, true) = true 
          AND COALESCE(show_activity, true) = true
        )
      )
  ) THEN
    -- If private, hidden, or nonexistent user, return no rows (empty result set)
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    COALESCE(round(sum(r.distance_km)::numeric, 2), 0.0)::numeric,
    count(*)::bigint,
    COALESCE(round(max(r.distance_km)::numeric, 2), 0.0)::numeric,
    COALESCE(min(r.pace_seconds_per_km) FILTER (WHERE r.pace_seconds_per_km > 0), 0)::numeric,
    COALESCE(round(avg(r.pace_seconds_per_km) FILTER (WHERE r.pace_seconds_per_km > 0)), 0)::numeric
  FROM public.runs r
  WHERE r.user_id = target_user_id;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
    ALTER FUNCTION public.get_runner_public_stats(uuid) OWNER TO postgres;
  END IF;
END $$;

-- Revoke default public execution privileges and grant strictly to anon and authenticated
REVOKE EXECUTE ON FUNCTION public.get_runner_public_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_runner_public_stats(uuid) TO anon, authenticated;


-- ----------------------------------------------------------------------------
-- STEP 6: OPTIONAL MANUAL REPAIR FOR EXISTING TERRITORIES WITH NULL GEOMETRY
-- ----------------------------------------------------------------------------
-- This statement is intentionally commented out. Do not execute automatically.
-- Verified live finding: 4 active territories currently have polygon_geom IS NULL.
-- A standalone, dependency-isolated repair script with comprehensive pre-checks
-- is provided separately in: supabase/manual_repairs/20261011_backfill_4_territories.sql
--
-- Once the migration is applied and independently reviewed, execute separately:
--
-- UPDATE public.territories
-- SET coords = coords
-- WHERE polygon_geom IS NULL 
--   AND is_active = true
--   AND coords IS NOT NULL 
--   AND jsonb_typeof(coords::jsonb) = 'array'
--   AND jsonb_array_length(coords::jsonb) >= 3;

COMMIT;
