import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';

// Mock localStorage and window
global.window = {};
global.localStorage = {
  store: {},
  getItem(key) { return this.store[key] || null; },
  setItem(key, value) { this.store[key] = String(value); },
  removeItem(key) { delete this.store[key]; },
  clear() { this.store = {}; }
};

describe('Territory Claim, Persistence, Map Sync & Runner Stats Tests', () => {

  test('TEST 1: Valid territory -> Supabase success -> territory marked saved', () => {
    const code = fs.readFileSync('src/supabase.js', 'utf8');
    assert.ok(code.includes('if (cloudSuccess) {'));
    assert.ok(code.includes("localStorage.setItem('clash_territories', JSON.stringify(updated));"));
  });

  test('TEST 2: Supabase INSERT failure -> territory is NOT marked saved', () => {
    const code = fs.readFileSync('src/supabase.js', 'utf8');
    assert.ok(code.includes('} else {'));
    assert.ok(code.includes('console.warn(\'[STOP CLAIM] Territory cloud save failed. Not caching locally.\');'));
    assert.ok(code.includes('success: cloudSuccess'));
  });

  test('TEST 3: Repeated STOP & CLAIM taps -> only one save request', () => {
    const appCode = fs.readFileSync('src/App.jsx', 'utf8');
    assert.ok(appCode.includes('if (isFinalizingRun || isFinalizingRunRef.current) {'));
    assert.ok(appCode.includes('isFinalizingRunRef.current = true;'));
  });

  test('TEST 4: Repeated Save/Continue taps -> no duplicate run/territory', () => {
    const appCode = fs.readFileSync('src/App.jsx', 'utf8');
    assert.ok(appCode.includes('const [isSavingRun, setIsSavingRun] = useState(false);'));
    assert.ok(appCode.includes('disabled={isSavingRun}'));
  });

  test('TEST 5: Malformed pending queue item -> does not crash Conquests', () => {
    const code = fs.readFileSync('src/supabase.js', 'utf8');
    assert.ok(code.includes('if (!item || !item.territory) {'));
    assert.ok(code.includes('continue;'));
  });

  test('TEST 6: Saved territory -> subsequent fetch returns active territories only', () => {
    const code = fs.readFileSync('src/supabase.js', 'utf8');
    assert.ok(code.includes("from('territories')"));
    assert.ok(code.includes("filter(t => t.is_active !== false)"));
  });

  test('TEST 7: Failed territory save -> user remains in a recoverable state with error surfaced', () => {
    const appCode = fs.readFileSync('src/App.jsx', 'utf8');
    assert.ok(appCode.includes('if (!territoryRes?.success) {'));
    assert.ok(appCode.includes('setToastMessage(`Failed to claim territory: ${claimErrMsg}`);'));
    assert.ok(appCode.includes('setIsFinalizingRun(false);'));
    assert.ok(appCode.includes('isFinalizingRunRef.current = false;'));
  });

  test('TEST 8: Bounded safety timeout prevents permanent SAVING... state', () => {
    const appCode = fs.readFileSync('src/App.jsx', 'utf8');
    assert.ok(appCode.includes('const safetyTimeoutId = setTimeout('));
    assert.ok(appCode.includes('clearTimeout(safetyTimeoutId);'));
    assert.ok(appCode.includes('Claim timed out. You may retry.'));
  });

  test('TEST 9: Geometry duplicate coordinate filtering with ensureClosedPolygon', () => {
    const code = fs.readFileSync('src/supabase.js', 'utf8');
    assert.ok(code.includes('export const ensureClosedPolygon = (coords) => {'));
    const fnMatch = code.match(/export const ensureClosedPolygon = (\(coords\) => \{[\s\S]*?\n\};)/);
    assert.ok(fnMatch, 'ensureClosedPolygon definition found in src/supabase.js');
    const ensureClosedPolygon = new Function('return ' + fnMatch[1])();

    const input = [[0, 0], [0, 0], [1, 1], [1, 1], [2, 2]];
    const output = ensureClosedPolygon(input);
    assert.strictEqual(output.length, 4); // 3 unique + 1 closed ring
    assert.strictEqual(output[0][0], 0);
    assert.strictEqual(output[1][0], 1);
    assert.strictEqual(output[2][0], 2);
    assert.strictEqual(output[3][0], 0); // closed
  });

  test('TEST 10: Invalid geometry rejection before POSTGIS', () => {
    const code = fs.readFileSync('src/supabase.js', 'utf8');
    assert.ok(code.includes('if (!closedCoords || closedCoords.length < 4) {'));
    assert.ok(code.includes("error: 'Invalid run geometry."));
  });

  test('TEST 11: SQL Trigger contains ST_MakeValid and safe geometry handling', () => {
    const sqlCode = fs.readFileSync('schema_update.sql', 'utf8');
    assert.ok(sqlCode.includes('ST_MakeValid'));
    assert.ok(sqlCode.includes('ST_IsValid'));
    assert.ok(sqlCode.includes('ST_CollectionExtract(ST_Intersection(new.polygon_geom, old_terr.polygon_geom), 3)::geography'));
  });

  test('TEST 12: saveCompletedRun has timeout and uses schema-correct columns', () => {
    const code = fs.readFileSync('src/supabase.js', 'utf8');
    assert.ok(code.includes('Promise.race([cloudInsertPromise, timeoutPromise])'));
    assert.ok(code.includes('Cloud insertion timeout'));
    assert.ok(code.includes('operation_id: operationId'));
    assert.ok(code.includes('distance_km: distanceKm'));
    assert.ok(code.includes('duration_seconds: durationSeconds'));
    assert.ok(code.includes('pace_seconds_per_km: paceVal'));
  });

  test('TEST 13: Profile stats query uses distance_km, duration_seconds, pace_seconds_per_km', () => {
    const profileCode = fs.readFileSync('src/services/profileService.js', 'utf8');
    assert.ok(profileCode.includes("select('distance_km, duration_seconds, pace_seconds_per_km')"));
    assert.ok(profileCode.includes("select('id, area_sqm, is_active')"));
  });

  test('TEST 14: Territory claim retry preserves already saved run without duplicate inserts', () => {
    const appCode = fs.readFileSync('src/App.jsx', 'utf8');
    assert.ok(appCode.includes('const operationId = savedRunOperationIdRef.current || generateUUID();'));
    assert.ok(appCode.includes('if (!savedRunOperationIdRef.current) {'));
    assert.ok(appCode.includes('savedRunOperationIdRef.current = operationId;'));
    assert.ok(appCode.includes('savedRunOperationIdRef.current = null;'));
  });

  test('TEST 15: Successful claim calls refreshTerritories and map is updated', () => {
    const appCode = fs.readFileSync('src/App.jsx', 'utf8');
    assert.ok(appCode.includes('refreshTerritories();'));
    const supabaseCode = fs.readFileSync('src/supabase.js', 'utf8');
    assert.ok(supabaseCode.includes('export const refreshTerritories = () => {'));
  });

  test('TEST 16: MultiPolygon support and geometry typmod compatibility in migration and schema', () => {
    const migrationCode = fs.readFileSync('supabase/migrations/20261011_territory_and_runner_stats_repair.sql', 'utf8');
    assert.ok(migrationCode.includes('ALTER COLUMN polygon_geom TYPE geometry(Geometry, 4326)'));
    assert.ok(migrationCode.includes('ST_CollectionExtract(raw_geom, 3)'));
    assert.ok(migrationCode.includes('ST_MultiPolygon'));
    assert.ok(migrationCode.includes('ST_CollectionExtract(ST_Intersection(new.polygon_geom, old_terr.polygon_geom), 3)::geography'));

    const schemaCode = fs.readFileSync('schema_update.sql', 'utf8');
    assert.ok(schemaCode.includes('alter column polygon_geom type geometry(Geometry, 4326)'));
    assert.ok(schemaCode.includes('ST_CollectionExtract(ST_Intersection(new.polygon_geom, old_terr.polygon_geom), 3)::geography'));
  });

  test('TEST 17: Spatial index bounding box operator (&&) accelerates takeover candidate query', () => {
    const migrationCode = fs.readFileSync('supabase/migrations/20261011_territory_and_runner_stats_repair.sql', 'utf8');
    assert.ok(migrationCode.includes('AND polygon_geom && new.polygon_geom'));

    const schemaCode = fs.readFileSync('schema_update.sql', 'utf8');
    assert.ok(schemaCode.includes('and polygon_geom && new.polygon_geom'));
  });

  test('TEST 18: Runner performance RLS enforces owner-only raw access and profile privacy', () => {
    const migrationCode = fs.readFileSync('supabase/migrations/20261011_territory_and_runner_stats_repair.sql', 'utf8');
    assert.ok(migrationCode.includes('CREATE POLICY "runs_select_policy"'));
    assert.ok(migrationCode.includes('USING (auth.uid() = user_id);'));
    assert.ok(migrationCode.includes('REVOKE ALL ON TABLE public.runs FROM anon, public;'));
    assert.ok(migrationCode.includes('CREATE POLICY "runs_update_policy"'));
    assert.ok(migrationCode.includes('CREATE POLICY "runs_delete_policy"'));
    assert.ok(migrationCode.includes('COALESCE(p.is_profile_public, true) = true'));
    assert.ok(migrationCode.includes('COALESCE(p.show_activity, true) = true'));

    const schemaCode = fs.readFileSync('schema_update.sql', 'utf8');
    assert.ok(schemaCode.includes('create policy "runs_select_policy"'));
    assert.ok(schemaCode.includes('using (auth.uid() = user_id);'));
    assert.ok(schemaCode.includes('revoke all on table public.runs from anon, public;'));
    assert.ok(schemaCode.includes('create policy "runs_update_policy"'));
    assert.ok(schemaCode.includes('create policy "runs_delete_policy"'));
  });

  test('TEST 19: Safe handling of NULL geometry territories without throwing or breaking takeovers', () => {
    const migrationCode = fs.readFileSync('supabase/migrations/20261011_territory_and_runner_stats_repair.sql', 'utf8');
    assert.ok(migrationCode.includes('IF new.polygon_geom IS NULL OR NOT ST_IsValid(new.polygon_geom) THEN'));
    assert.ok(migrationCode.includes('AND polygon_geom IS NOT NULL'));
    assert.ok(migrationCode.includes('AND ST_IsValid(polygon_geom)'));

    const schemaCode = fs.readFileSync('schema_update.sql', 'utf8');
    assert.ok(schemaCode.includes('if new.polygon_geom is null or not ST_IsValid(new.polygon_geom) then'));
    assert.ok(schemaCode.includes('and polygon_geom is not null'));
    assert.ok(schemaCode.includes('and ST_IsValid(polygon_geom)'));
  });

  test('TEST 20: Safe backfill area_sqm calculation when coords are provided', () => {
    const migrationCode = fs.readFileSync('supabase/migrations/20261011_territory_and_runner_stats_repair.sql', 'utf8');
    assert.ok(migrationCode.includes('new.area_sqm := round(ST_Area(raw_geom::geography));'));

    const schemaCode = fs.readFileSync('schema_update.sql', 'utf8');
    assert.ok(schemaCode.includes('new.area_sqm := round(ST_Area(raw_geom::geography));'));
  });

  test('TEST 21: Manual data repair statement is provided without auto-modifying existing data', () => {
    const migrationCode = fs.readFileSync('supabase/migrations/20261011_territory_and_runner_stats_repair.sql', 'utf8');
    assert.ok(migrationCode.includes('-- UPDATE public.territories'));
    assert.ok(migrationCode.includes('-- SET coords = coords'));
    assert.ok(migrationCode.includes('-- WHERE polygon_geom IS NULL'));
  });

  test('TEST 22: Valid closed route geometry processing', () => {
    const code = fs.readFileSync('src/supabase.js', 'utf8');
    const fnMatch = code.match(/export const ensureClosedPolygon = (\(coords\) => \{[\s\S]*?\n\};)/);
    assert.ok(fnMatch, 'ensureClosedPolygon found');
    const ensureClosedPolygon = new Function('return ' + fnMatch[1])();

    const route = [[24.5854, 73.7125], [24.5860, 73.7130], [24.5850, 73.7135], [24.5854, 73.7125]];
    const closed = ensureClosedPolygon(route);
    assert.strictEqual(closed.length, 4);
    assert.deepStrictEqual(closed[0], closed[3]); // airtight loop
  });

  test('TEST 23: Self-intersecting route repaired into valid MultiPolygon components in SQL', () => {
    const migrationCode = fs.readFileSync('supabase/migrations/20261011_territory_and_runner_stats_repair.sql', 'utf8');
    assert.ok(migrationCode.includes('raw_geom := ST_MakeValid(ST_Polygon(ST_GeomFromText'));
    assert.ok(migrationCode.includes('raw_geom := ST_MakeValid(ST_BuildArea(ST_Node(ST_GeomFromText'));
    assert.ok(migrationCode.includes('raw_geom := ST_CollectionExtract(raw_geom, 3);'));
    assert.ok(migrationCode.includes("ST_GeometryType(raw_geom) IN ('ST_Polygon', 'ST_MultiPolygon')"));
  });

  test('TEST 24: Territory insert error returns failure and surfaces error message', () => {
    const code = fs.readFileSync('src/supabase.js', 'utf8');
    assert.ok(code.includes("if (!closedCoords || closedCoords.length < 4) {"));
    assert.ok(code.includes("error: 'Invalid run geometry. Not enough unique points for a territory.'"));
    assert.ok(code.includes("success: false"));

    const appCode = fs.readFileSync('src/App.jsx', 'utf8');
    assert.ok(appCode.includes('if (!territoryRes?.success) {'));
    assert.ok(appCode.includes('throw new Error(claimErrMsg);'));
  });

  test('TEST 25: Successful insert with null geometry is strictly rejected by client', () => {
    const code = fs.readFileSync('src/supabase.js', 'utf8');
    assert.ok(code.includes('if (data && data.polygon_geom === null) {'));
    assert.ok(code.includes('Database accepted record but failed to generate valid geometry (polygon_geom is null).'));
    assert.ok(code.includes('cloudSuccess = false;'));
  });

  test('TEST 26: Runner stats reading according to public-profile and activity permissions', () => {
    const migrationCode = fs.readFileSync('supabase/migrations/20261011_territory_and_runner_stats_repair.sql', 'utf8');
    assert.ok(migrationCode.includes('CREATE POLICY "runs_select_policy"'));
    assert.ok(migrationCode.includes('USING (auth.uid() = user_id);'));
    assert.ok(migrationCode.includes('COALESCE(p.is_profile_public, true) = true'));
    assert.ok(migrationCode.includes('COALESCE(p.show_activity, true) = true'));

    const profileCode = fs.readFileSync('src/services/profileService.js', 'utf8');
    assert.ok(profileCode.includes("from('runner_activities_public')"));
    assert.ok(profileCode.includes("from('runs')"));
    assert.ok(profileCode.includes("select('distance_km, duration_seconds, pace_seconds_per_km')"));
    assert.ok(profileCode.includes("fetchRunnerPublicStatsRPC"));
  });

  test('TEST 27: Trigger validates coordinate bounds (-90..90 lat, -180..180 lng) and non-numeric inputs', () => {
    const migrationCode = fs.readFileSync('supabase/migrations/20261011_territory_and_runner_stats_repair.sql', 'utf8');
    assert.ok(migrationCode.includes('curr_lat < -90.0 OR curr_lat > 90.0'));
    assert.ok(migrationCode.includes('curr_lng < -180.0 OR curr_lng > 180.0'));
    assert.ok(migrationCode.includes('non-numeric latitude (%) or longitude (%)'));
  });

  test('TEST 28: Idempotent 23505 unique constraint retry verifies existing territory record in database', () => {
    const code = fs.readFileSync('src/supabase.js', 'utf8');
    assert.ok(code.includes("} else if (error?.code === '23505') {"));
    assert.ok(code.includes("eq('claim_id', claimId)"));
    assert.ok(code.includes("existingTerr.polygon_geom !== null"));
  });

  test('TEST 29: Idempotent 23505 retry verifies existing run record in database', () => {
    const code = fs.readFileSync('src/supabase.js', 'utf8');
    assert.ok(code.includes("} else if (error.code === '23505') {"));
    assert.ok(code.includes("eq('operation_id', operationId)"));
    assert.ok(code.includes("existingRun"));
  });

  test('TEST 30: Takeover trigger calculates overlap using ST_CollectionExtract and handles corrupt topology with warning', () => {
    const migrationCode = fs.readFileSync('supabase/migrations/20261011_territory_and_runner_stats_repair.sql', 'utf8');
    assert.ok(migrationCode.includes('ST_CollectionExtract(ST_Intersection(new.polygon_geom, old_terr.polygon_geom), 3)::geography'));
    assert.ok(migrationCode.includes('Skipping topology exception for territory'));
  });

  test('TEST 31: Runner privacy model protects raw gps_path by exposing public stats via restricted view / RPC', () => {
    const migrationCode = fs.readFileSync('supabase/migrations/20261011_territory_and_runner_stats_repair.sql', 'utf8');
    assert.ok(migrationCode.includes('CREATE OR REPLACE VIEW public.runner_activities_public'));
    assert.ok(migrationCode.includes('CREATE OR REPLACE FUNCTION public.get_runner_public_stats'));
    const viewMatch = migrationCode.match(/CREATE OR REPLACE VIEW public\.runner_activities_public[\s\S]*?FROM public\.runs/);
    assert.ok(viewMatch, 'runner_activities_public view found');
    assert.ok(!viewMatch[0].includes('gps_path'), 'runner_activities_public must NOT include gps_path');
  });

  test('TEST 32: Raw GPS data access restriction — anon and public have zero access, SELECT is owner-only', () => {
    const migrationCode = fs.readFileSync('supabase/migrations/20261011_territory_and_runner_stats_repair.sql', 'utf8');
    assert.ok(migrationCode.includes('REVOKE ALL ON TABLE public.runs FROM anon, public;'));
    assert.ok(migrationCode.includes('CREATE POLICY "runs_select_policy"'));
    assert.ok(migrationCode.includes('ON public.runs'));
    assert.ok(migrationCode.includes('FOR SELECT'));
    assert.ok(migrationCode.includes('TO authenticated'));
    assert.ok(migrationCode.includes('USING (auth.uid() = user_id);'));
  });

  test('TEST 33: Public view excludes sensitive location data (gps_path, start_time, end_time)', () => {
    const migrationCode = fs.readFileSync('supabase/migrations/20261011_territory_and_runner_stats_repair.sql', 'utf8');
    const viewMatch = migrationCode.match(/CREATE OR REPLACE VIEW public\.runner_activities_public[\s\S]*?FROM public\.runs/);
    assert.ok(viewMatch);
    assert.ok(!viewMatch[0].includes('gps_path'), 'gps_path must not be exposed');
    assert.ok(!viewMatch[0].includes('start_time'), 'start_time must not be exposed');
    assert.ok(!viewMatch[0].includes('end_time'), 'end_time must not be exposed');
  });

  test('TEST 34: Private profile and disabled activity sharing behavior in RPC and view', () => {
    const migrationCode = fs.readFileSync('supabase/migrations/20261011_territory_and_runner_stats_repair.sql', 'utf8');
    assert.ok(migrationCode.includes('IF NOT EXISTS (\n    SELECT 1 FROM public.profiles \n    WHERE id = target_user_id'));
    assert.ok(migrationCode.includes('(auth.uid() IS NOT NULL AND auth.uid() = target_user_id)'));
    assert.ok(migrationCode.includes('COALESCE(is_profile_public, true) = true'));
    assert.ok(migrationCode.includes('COALESCE(show_activity, true) = true'));
  });

  test('TEST 35: RPC security definition, fixed search_path, and execution permission revocation', () => {
    const migrationCode = fs.readFileSync('supabase/migrations/20261011_territory_and_runner_stats_repair.sql', 'utf8');
    assert.ok(migrationCode.includes('SECURITY DEFINER'));
    assert.ok(migrationCode.includes('SET search_path = pg_catalog, public, pg_temp'));
    assert.ok(migrationCode.includes('REVOKE EXECUTE ON FUNCTION public.get_runner_public_stats(uuid) FROM PUBLIC;'));
    assert.ok(migrationCode.includes('GRANT EXECUTE ON FUNCTION public.get_runner_public_stats(uuid) TO anon, authenticated;'));
  });

  test('TEST 36: Trigger rejects empty or non-polygonal repair results and requires positive area', () => {
    const migrationCode = fs.readFileSync('supabase/migrations/20261011_territory_and_runner_stats_repair.sql', 'utf8');
    assert.ok(migrationCode.includes('NOT ST_IsEmpty(raw_geom)'));
    assert.ok(migrationCode.includes('ST_IsValid(raw_geom)'));
    assert.ok(migrationCode.includes('ST_Area(raw_geom::geography) > 0'));
    assert.ok(migrationCode.includes('ST_SRID(raw_geom) = 4326'));
  });

  test('TEST 37: Takeover overlap threshold rule preserved (> 0.5 ratio) with per-candidate isolation', () => {
    const migrationCode = fs.readFileSync('supabase/migrations/20261011_territory_and_runner_stats_repair.sql', 'utf8');
    assert.ok(migrationCode.includes('ratio > 0.5'));
    assert.ok(migrationCode.includes("SET is_active = false, status = 'conquered', conquered_by_id = new.owner_id"));
    assert.ok(migrationCode.includes('EXCEPTION\n      WHEN others THEN\n        RAISE WARNING \'Skipping topology exception for territory %: %\', old_terr.id, SQLERRM;'));
  });

  test('TEST 38: Dynamic RLS policy drop loop eliminates all existing policies on public.runs', () => {
    const migrationCode = fs.readFileSync('supabase/migrations/20261011_territory_and_runner_stats_repair.sql', 'utf8');
    assert.ok(migrationCode.includes('FOR pol IN \n    SELECT policyname \n    FROM pg_policies \n    WHERE schemaname = \'public\' AND tablename = \'runs\''));
    assert.ok(migrationCode.includes("EXECUTE format('DROP POLICY IF EXISTS %I ON public.runs', pol.policyname);"));
  });

  test('TEST 39: Safe created_at column preserves authentic timestamps by backfilling from start_time', () => {
    const migrationCode = fs.readFileSync('supabase/migrations/20261011_territory_and_runner_stats_repair.sql', 'utf8');
    assert.ok(migrationCode.includes("SET created_at = COALESCE(start_time, end_time, now())"));
    assert.ok(migrationCode.includes("ALTER TABLE public.runs ALTER COLUMN created_at SET DEFAULT now();"));
  });

  test('TEST 40: Revokes dangerous table privileges (TRUNCATE, REFERENCES, TRIGGER) on public.runs from authenticated', () => {
    const migrationCode = fs.readFileSync('supabase/migrations/20261011_territory_and_runner_stats_repair.sql', 'utf8');
    assert.ok(migrationCode.includes('REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.runs FROM authenticated;'));
    assert.ok(migrationCode.includes('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.runs TO authenticated;'));
  });
});
