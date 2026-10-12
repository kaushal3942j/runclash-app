-- ============================================================================
-- RUNCLASH: STANDALONE MANUAL BACKFILL FOR 4 VERIFIED NULL TERRITORIES
-- File: supabase/manual_repairs/20261011_backfill_4_territories.sql
-- 
-- STRICT TARGET RESTRICTION:
-- Targets ONLY the four verified territory IDs:
--   1. 0be5bd3a-1b75-4051-aa6d-7a774b50e5c9
--   2. 2e8ca9fb-7e81-41a8-9a38-50feed4e367b
--   3. 46011b85-6e14-44ac-8643-3e9f3c2be48b
--   4. 9136cede-baf7-45de-be37-550ec59d3a10
--
-- CAUTION:
-- 1. Execute ONLY after migration 20261011_territory_and_runner_stats_repair.sql
--    has been applied.
-- 2. Do NOT run as part of the automated migration pipeline.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- PART 1: CRASH-PROOF READ-ONLY PRE-FLIGHT VERIFICATION
-- ----------------------------------------------------------------------------
-- Validates existence, active status, and coordinate format for the four exact IDs.
-- Uses exception-safe validation functions: never throws query errors on malformed JSON,
-- non-array entries, oversized numeric strings, NaN, invalid numbers, or bounds violations.

CREATE OR REPLACE FUNCTION pg_temp.safe_jsonb(val text)
RETURNS jsonb AS $$
BEGIN
  IF val IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN val::jsonb;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION pg_temp.validate_coordinate_pair(pt jsonb)
RETURNS boolean AS $$
DECLARE
  lat_num numeric;
  lng_num numeric;
BEGIN
  IF pt IS NULL OR jsonb_typeof(pt) <> 'array' OR jsonb_array_length(pt) < 2 THEN
    RETURN false;
  END IF;

  -- Exception-safe numeric cast: protects against oversized numeric strings (e.g. '1e1000000'),
  -- invalid syntax, NaN, infinity, or precision overflow
  BEGIN
    lat_num := (pt->>0)::numeric;
    lng_num := (pt->>1)::numeric;
  EXCEPTION WHEN others THEN
    RETURN false;
  END;

  IF lat_num IS NULL OR lng_num IS NULL OR lat_num = 'NaN'::numeric OR lng_num = 'NaN'::numeric THEN
    RETURN false;
  END IF;

  -- Geographic bounds validation: latitude [-90, 90], longitude [-180, 180]
  IF lat_num < -90.0 OR lat_num > 90.0 OR lng_num < -180.0 OR lng_num > 180.0 THEN
    RETURN false;
  END IF;

  RETURN true;
EXCEPTION WHEN others THEN
  RETURN false;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION pg_temp.validate_territory_coords(coords_raw jsonb)
RETURNS boolean AS $$
DECLARE
  elem jsonb;
  valid_count integer := 0;
BEGIN
  IF coords_raw IS NULL OR jsonb_typeof(coords_raw) <> 'array' THEN
    RETURN false;
  END IF;

  IF jsonb_array_length(coords_raw) < 3 THEN
    RETURN false;
  END IF;

  FOR elem IN SELECT jsonb_array_elements(coords_raw) LOOP
    IF NOT pg_temp.validate_coordinate_pair(elem) THEN
      RETURN false;
    END IF;
    valid_count := valid_count + 1;
  END LOOP;

  RETURN (valid_count >= 3);
EXCEPTION WHEN others THEN
  RETURN false;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION pg_temp.validate_territory_coords(coords_text text)
RETURNS boolean AS $$
DECLARE
  parsed jsonb;
BEGIN
  IF coords_text IS NULL THEN
    RETURN false;
  END IF;
  parsed := pg_temp.safe_jsonb(coords_text);
  IF parsed IS NULL THEN
    RETURN false;
  END IF;
  RETURN pg_temp.validate_territory_coords(parsed);
EXCEPTION WHEN others THEN
  RETURN false;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

WITH target_ids AS (
  SELECT unnest(ARRAY[
    '0be5bd3a-1b75-4051-aa6d-7a774b50e5c9'::uuid,
    '2e8ca9fb-7e81-41a8-9a38-50feed4e367b'::uuid,
    '46011b85-6e14-44ac-8643-3e9f3c2be48b'::uuid,
    '9136cede-baf7-45de-be37-550ec59d3a10'::uuid
  ]) AS id
),
row_eval AS (
  SELECT 
    tgt.id AS target_id,
    t.id AS found_id,
    t.owner_id,
    t.is_active,
    t.status,
    t.polygon_geom IS NOT NULL AS has_geom,
    CASE WHEN t.polygon_geom IS NOT NULL THEN ST_GeometryType(t.polygon_geom) ELSE NULL END AS current_geom_type,
    CASE 
      WHEN t.coords IS NULL THEN NULL
      WHEN pg_temp.safe_jsonb(t.coords::text) IS NOT NULL THEN jsonb_typeof(pg_temp.safe_jsonb(t.coords::text))
      ELSE 'malformed_json'
    END AS coords_type,
    CASE 
      WHEN pg_temp.safe_jsonb(t.coords::text) IS NOT NULL 
           AND jsonb_typeof(pg_temp.safe_jsonb(t.coords::text)) = 'array' 
      THEN jsonb_array_length(pg_temp.safe_jsonb(t.coords::text)) 
      ELSE 0 
    END AS coord_count,
    pg_temp.validate_territory_coords(t.coords::text) AS coords_strictly_valid
  FROM target_ids tgt
  LEFT JOIN public.territories t ON t.id = tgt.id
)
SELECT 
  r.target_id,
  CASE 
    WHEN r.found_id IS NULL THEN 'MISSING (Not found in table)'
    WHEN r.has_geom = true THEN 'ALREADY VALID (polygon_geom already populated)'
    WHEN r.is_active IS NOT TRUE THEN 'INELIGIBLE (is_active is false)'
    WHEN r.coords_type <> 'array' OR r.coord_count < 3 THEN 'INELIGIBLE (coords not array or < 3 points)'
    WHEN r.coords_strictly_valid IS NOT TRUE THEN 'INELIGIBLE (malformed, non-array, or out-of-bounds coordinates)'
    ELSE 'ELIGIBLE FOR REPAIR'
  END AS preflight_status,
  r.owner_id,
  r.is_active,
  r.has_geom,
  r.coords_type,
  r.coord_count
FROM row_eval r
ORDER BY r.target_id;


-- ----------------------------------------------------------------------------
-- PART 2: ISOLATED TRANSACTIONAL REPAIR WITH POST-UPDATE GEOMETRY VERIFICATION
-- ----------------------------------------------------------------------------
-- Processes only the four target IDs. Uses an explicit subtransaction (BEGIN ... EXCEPTION)
-- for each row. If post-update validation fails, the row changes are rolled back without
-- aborting processing of the other target rows.
DO $$
DECLARE
  target_ids uuid[] := ARRAY[
    '0be5bd3a-1b75-4051-aa6d-7a774b50e5c9'::uuid,
    '2e8ca9fb-7e81-41a8-9a38-50feed4e367b'::uuid,
    '46011b85-6e14-44ac-8643-3e9f3c2be48b'::uuid,
    '9136cede-baf7-45de-be37-550ec59d3a10'::uuid
  ];
  t_id uuid;
  curr_terr RECORD;
  updated_geom geometry;
  updated_area numeric;
  coords_valid boolean;
  ineligibility_reason text;
  
  -- Tracking counters
  repaired_count INTEGER := 0;
  already_valid_count INTEGER := 0;
  ineligible_count INTEGER := 0;
  missing_count INTEGER := 0;
  failed_count INTEGER := 0;
BEGIN
  FOREACH t_id IN ARRAY target_ids LOOP
    -- 1. Check current row state
    SELECT id, owner_id, is_active, polygon_geom, coords
    INTO curr_terr
    FROM public.territories
    WHERE id = t_id;

    -- Categorize current state: Existence
    IF NOT FOUND THEN
      missing_count := missing_count + 1;
      RAISE NOTICE 'Territory %: MISSING (row does not exist in table)', t_id;
      CONTINUE;
    END IF;

    -- Categorize current state: Already Valid
    IF curr_terr.polygon_geom IS NOT NULL 
       AND ST_IsValid(curr_terr.polygon_geom)
       AND NOT ST_IsEmpty(curr_terr.polygon_geom)
       AND ST_SRID(curr_terr.polygon_geom) = 4326
       AND ST_GeometryType(curr_terr.polygon_geom) IN ('ST_Polygon', 'ST_MultiPolygon')
       AND ST_Area(curr_terr.polygon_geom::geography) > 0 THEN
      already_valid_count := already_valid_count + 1;
      RAISE NOTICE 'Territory %: ALREADY VALID (polygon_geom already exists and passes criteria)', t_id;
      CONTINUE;
    END IF;

    -- Categorize current state: Active status
    IF curr_terr.is_active IS NOT TRUE THEN
      ineligible_count := ineligible_count + 1;
      RAISE NOTICE 'Territory %: INELIGIBLE (is_active is false or null)', t_id;
      CONTINUE;
    END IF;

    -- Categorize current state: Coordinate format and bounds validation (exception-safe)
    coords_valid := false;
    ineligibility_reason := null;

    IF curr_terr.coords IS NULL THEN
      ineligibility_reason := 'coords column is null';
    ELSIF NOT pg_temp.validate_territory_coords(curr_terr.coords::text) THEN
      ineligibility_reason := 'malformed elements, non-array coordinates, or out-of-bounds geographic values';
    ELSE
      coords_valid := true;
    END IF;

    IF NOT coords_valid THEN
      ineligible_count := ineligible_count + 1;
      RAISE NOTICE 'Territory %: INELIGIBLE (%)', t_id, ineligibility_reason;
      CONTINUE;
    END IF;

    -- 2. Execute repair in isolated PL/pgSQL subtransaction block
    BEGIN
      -- Trigger update_territory_geom() trigger
      UPDATE public.territories
      SET coords = coords
      WHERE id = t_id;

      -- 3. Confirm resulting geometry meets ALL strict criteria
      SELECT polygon_geom, area_sqm 
      INTO updated_geom, updated_area
      FROM public.territories
      WHERE id = t_id;

      IF updated_geom IS NULL THEN
        RAISE EXCEPTION 'Resulting polygon_geom is NULL';
      ELSIF NOT ST_IsValid(updated_geom) THEN
        RAISE EXCEPTION 'Resulting polygon_geom is invalid (GEOS: %)', ST_IsValidDetail(updated_geom);
      ELSIF ST_IsEmpty(updated_geom) THEN
        RAISE EXCEPTION 'Resulting polygon_geom is empty';
      ELSIF ST_SRID(updated_geom) <> 4326 THEN
        RAISE EXCEPTION 'Resulting polygon_geom has invalid SRID (%)', ST_SRID(updated_geom);
      ELSIF ST_GeometryType(updated_geom) NOT IN ('ST_Polygon', 'ST_MultiPolygon') THEN
        RAISE EXCEPTION 'Resulting polygon_geom is not polygonal (%)', ST_GeometryType(updated_geom);
      ELSIF ST_Area(updated_geom::geography) <= 0 THEN
        RAISE EXCEPTION 'Resulting polygon_geom has non-positive area (%)', ST_Area(updated_geom::geography);
      END IF;

      repaired_count := repaired_count + 1;
      RAISE NOTICE 'Territory %: REPAIRED (Type: %, Area: % sqm)', 
        t_id, ST_GeometryType(updated_geom), round(ST_Area(updated_geom::geography));

    EXCEPTION WHEN others THEN
      -- Rolling back this individual row via subtransaction
      failed_count := failed_count + 1;
      RAISE WARNING 'Territory %: FAILED validation (% - SQLSTATE: %). Changes rolled back.', 
        t_id, SQLERRM, SQLSTATE;
    END;
  END LOOP;

  RAISE NOTICE '=======================================================';
  RAISE NOTICE 'BACKFILL EXECUTION REPORT FOR THE 4 VERIFIED TARGETS:';
  RAISE NOTICE '  Repaired:       %', repaired_count;
  RAISE NOTICE '  Already Valid:  %', already_valid_count;
  RAISE NOTICE '  Ineligible:     %', ineligible_count;
  RAISE NOTICE '  Missing:        %', missing_count;
  RAISE NOTICE '  Failed:         %', failed_count;
  RAISE NOTICE '=======================================================';
END $$;


-- ----------------------------------------------------------------------------
-- PART 3: READ-ONLY POST-REPAIR VERIFICATION QUERY
-- ----------------------------------------------------------------------------
-- Confirms final geometry type, SRID, validity, non-empty status, and positive area.
SELECT 
  id,
  owner_id,
  is_active,
  polygon_geom IS NOT NULL AS has_geom,
  ST_GeometryType(polygon_geom) AS geometry_type,
  ST_IsValid(polygon_geom) AS is_valid,
  NOT ST_IsEmpty(polygon_geom) AS is_non_empty,
  ST_SRID(polygon_geom) AS srid,
  round(ST_Area(polygon_geom::geography)) AS geodesic_area_sqm,
  area_sqm AS stored_area_sqm
FROM public.territories
WHERE id IN (
  '0be5bd3a-1b75-4051-aa6d-7a774b50e5c9'::uuid,
  '2e8ca9fb-7e81-41a8-9a38-50feed4e367b'::uuid,
  '46011b85-6e14-44ac-8643-3e9f3c2be48b'::uuid,
  '9136cede-baf7-45de-be37-550ec59d3a10'::uuid
)
ORDER BY id;
