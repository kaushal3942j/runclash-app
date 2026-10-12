-- ========================================================
-- RunClash Production Hardened Database Schema & Triggers
-- Execute this script in your Supabase SQL Editor
-- ========================================================

-- Enable PostGIS if not already active
create extension if not exists postgis;

-- 1. Create Private Error Logs Table
create table if not exists public.error_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid,
  error_message text not null,
  error_stack text,
  component text,
  metadata jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Modify Territories Table for Soft-Delete History
alter table public.territories add column if not exists is_active boolean default true;
alter table public.territories add column if not exists status text default 'active'; -- 'active', 'conquered', 'expired'
alter table public.territories add column if not exists conquered_by_id uuid;
alter table public.territories add column if not exists expires_at timestamp with time zone default (now() + interval '72 hours');

-- Ensure polygon_geom accepts both Polygon and MultiPolygon geometries
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'territories'
      and column_name = 'polygon_geom'
  ) then
    alter table public.territories
      alter column polygon_geom type geometry(Geometry, 4326)
      using polygon_geom::geometry(Geometry, 4326);
  else
    alter table public.territories
      add column polygon_geom geometry(Geometry, 4326);
  end if;
end $$;

-- 3. Database Performance & Spatial Indexes
create index if not exists profiles_xp_idx on public.profiles (xp desc);
create index if not exists territories_owner_idx on public.territories (owner_id);
create index if not exists territories_is_active_idx on public.territories (is_active);
-- GiST spatial index for PostGIS geometries
create index if not exists territories_geom_gist_idx on public.territories using gist (polygon_geom);

-- 4. Enable Row Level Security (RLS)
alter table public.clans enable row level security;
alter table public.profiles enable row level security;
alter table public.territories enable row level security;
alter table public.error_logs enable row level security;

-- 5. Row Level Security Policies
-- Profiles: Public read, write own
drop policy if exists "Profiles read access" on public.profiles;
create policy "Profiles read access" on public.profiles for select using (true);
drop policy if exists "Profiles update own" on public.profiles;
create policy "Profiles update own" on public.profiles for update using (auth.uid() = id);
drop policy if exists "Profiles insert own" on public.profiles;
create policy "Profiles insert own" on public.profiles for insert with check (auth.uid() = id);

-- Territories: Public read, insert authenticated, update/delete own active
drop policy if exists "Territories read access" on public.territories;
create policy "Territories read access" on public.territories for select using (true);
drop policy if exists "Territories insert authenticated" on public.territories;
create policy "Territories insert authenticated" on public.territories for insert with check (auth.role() = 'authenticated');
drop policy if exists "Territories update own" on public.territories;
create policy "Territories update own" on public.territories for update using (auth.uid() = owner_id);

-- Clans: Public read, system-restricted write
drop policy if exists "Clans read access" on public.clans;
create policy "Clans read access" on public.clans for select using (true);

-- Error Logs: Insertable by anyone (public/anon crashes), SELECT disallowed (admin-only)
drop policy if exists "Error logs insert" on public.error_logs;
create policy "Error logs insert" on public.error_logs for insert with check (true);

-- 6. Log Retention Strategy: Prunes error logs older than 30 days
create or replace function public.cleanup_old_logs()
returns void as $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'error_logs') then
    delete from public.error_logs where created_at < now() - interval '30 days';
  end if;
end;
$$ language plpgsql security definer
set search_path = pg_catalog, public, pg_temp;

-- 7. Profile Auto-creation Trigger (SignUp)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, clan_name, level, xp, coins, premium)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), 'Runner'),
    coalesce(new.raw_user_meta_data->>'clan_name', 'Udaipur Racers'),
    1,
    0,
    100,
    false
  );
  return new;
end;
$$ language plpgsql security definer
set search_path = pg_catalog, public, pg_temp;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 8. PostGIS Geometry Translator Trigger
create or replace function public.update_territory_geom()
returns trigger as $$
declare
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
begin
  -- On UPDATE where coords did not change and a fully compliant polygonal geometry already exists, preserve it
  if TG_OP = 'UPDATE'
     and new.coords = old.coords
     and new.polygon_geom is not null
     and ST_IsValid(new.polygon_geom)
     and not ST_IsEmpty(new.polygon_geom)
     and ST_SRID(new.polygon_geom) = 4326
     and ST_GeometryType(new.polygon_geom) in ('ST_Polygon', 'ST_MultiPolygon')
     and ST_Area(new.polygon_geom::geography) > 0 then
    return new;
  end if;

  if new.coords is null
     or jsonb_typeof(new.coords::jsonb) <> 'array'
     or jsonb_array_length(new.coords::jsonb) < 3 then
    raise exception 'Invalid territory coords: must provide a JSON array with at least 3 coordinates.';
  end if;

  -- 1. Deduplicate consecutive identical GPS points and validate geographic ranges
  for coord_rec in select jsonb_array_elements(new.coords::jsonb) loop
    if jsonb_typeof(coord_rec) <> 'array' or jsonb_array_length(coord_rec) < 2 then
      raise exception 'Invalid territory coordinate: each entry must be a [latitude, longitude] array.';
    end if;

    curr_lat_str := coord_rec->>0;
    curr_lng_str := coord_rec->>1;

    if curr_lat_str is null or curr_lng_str is null or curr_lat_str = '' or curr_lng_str = '' then
      raise exception 'Invalid territory coordinate: latitude and longitude cannot be null or empty.';
    end if;

    begin
      curr_lat := curr_lat_str::numeric;
      curr_lng := curr_lng_str::numeric;
    exception when others then
      raise exception 'Invalid territory coordinate: non-numeric latitude (%) or longitude (%).', curr_lat_str, curr_lng_str;
    end;

    -- Validate geographic bounds
    if curr_lat < -90.0 or curr_lat > 90.0 then
      raise exception 'Invalid territory coordinate: latitude % out of bounds [-90, 90].', curr_lat;
    end if;

    if curr_lng < -180.0 or curr_lng > 180.0 then
      raise exception 'Invalid territory coordinate: longitude % out of bounds [-180, 180].', curr_lng;
    end if;

    if prev_lat is null or curr_lat <> prev_lat or curr_lng <> prev_lng then
      if points_str <> '' then
        points_str := points_str || ', ';
      end if;
      -- PostGIS standard X Y order: Longitude Latitude
      points_str := points_str || curr_lng::text || ' ' || curr_lat::text;
      if first_lng is null then
        first_lng := curr_lng;
        first_lat := curr_lat;
      end if;
      prev_lng := curr_lng;
      prev_lat := curr_lat;
      pt_count := pt_count + 1;
    end if;
  end loop;

  -- Must have at least 3 distinct vertices to form a polygon
  if pt_count < 3 then
    raise exception 'Invalid territory coords: coordinates contain fewer than 3 distinct vertices.';
  end if;

  -- 2. Ensure closed ring
  if prev_lng <> first_lng or prev_lat <> first_lat then
    points_str := points_str || ', ' || first_lng::text || ' ' || first_lat::text;
  end if;

  -- 3. Construct Geometry safely with ST_MakeValid repair paths
  begin
    raw_geom := ST_GeomFromText('POLYGON((' || points_str || '))', 4326);
  exception when others then
    raw_geom := null;
  end;

  -- Ensure invalid or unformed polygons pass through the appropriate ST_MakeValid repair paths
  -- Note: ST_GeomFromText can successfully construct a geometry that is topologically invalid
  if raw_geom is null or not ST_IsValid(raw_geom) then
    begin
      if raw_geom is not null then
        raw_geom := ST_MakeValid(raw_geom);
      end if;
    exception when others then
      raw_geom := null;
    end;

    -- If direct ST_MakeValid was unsuccessful or resulted in empty/non-polygonal geometry,
    -- fallback to linestring nodal reconstruction
    if raw_geom is null
       or not ST_IsValid(raw_geom)
       or ST_IsEmpty(raw_geom)
       or ST_GeometryType(raw_geom) not in ('ST_Polygon', 'ST_MultiPolygon', 'ST_GeometryCollection') then
      begin
        raw_geom := ST_MakeValid(ST_BuildArea(ST_Node(ST_GeomFromText('LINESTRING(' || points_str || ')', 4326))));
      exception when others then
        begin
          raw_geom := ST_MakeValid(ST_Polygon(ST_GeomFromText('LINESTRING(' || points_str || ')', 4326), 4326));
        exception when others then
          raw_geom := null;
        end;
      end;
    end if;
  end if;

  if raw_geom is not null then
    -- Ensure SRID is 4326 even if ST_BuildArea or ST_Node dropped it to 0
    if ST_SRID(raw_geom) = 0 or ST_SRID(raw_geom) is null then
      raw_geom := ST_SetSRID(raw_geom, 4326);
    end if;

    if not ST_IsValid(raw_geom) then
      begin
        raw_geom := ST_MakeValid(raw_geom);
      exception when others then
        null;
      end;
    end if;

    -- Extract 2D polygonal components if ST_MakeValid returns a GeometryCollection
    if ST_GeometryType(raw_geom) = 'ST_GeometryCollection' then
      raw_geom := ST_CollectionExtract(raw_geom, 3);
    end if;

    -- Guarantee SRID is preserved after extraction
    if ST_SRID(raw_geom) = 0 or ST_SRID(raw_geom) is null then
      raw_geom := ST_SetSRID(raw_geom, 4326);
    end if;

    -- Accept both Polygon and MultiPolygon without discarding components, requiring valid, non-empty, positive area, and SRID 4326
    if ST_GeometryType(raw_geom) in ('ST_Polygon', 'ST_MultiPolygon')
       and not ST_IsEmpty(raw_geom)
       and ST_IsValid(raw_geom)
       and ST_SRID(raw_geom) = 4326
       and ST_Area(raw_geom::geography) > 0 then
      new.polygon_geom := raw_geom;
      if (new.area_sqm is null or new.area_sqm <= 0) then
        begin
          new.area_sqm := round(ST_Area(raw_geom::geography));
        exception when others then
          null;
        end;
      end if;
    else
      new.polygon_geom := null;
    end if;
  else
    new.polygon_geom := null;
  end if;

  if new.polygon_geom is null then
    if raw_geom is not null and ST_GeometryType(raw_geom) not in ('ST_Polygon', 'ST_MultiPolygon') then
      raise exception 'Unrecoverable territory geometry: coordinates collapsed into non-polygonal geometry (%) during repair. A valid 2D polygon or multipolygon is required.', ST_GeometryType(raw_geom);
    elsif raw_geom is not null and ST_IsEmpty(raw_geom) then
      raise exception 'Unrecoverable territory geometry: repair produced an empty geometry.';
    elsif raw_geom is not null and ST_Area(raw_geom::geography) <= 0 then
      raise exception 'Unrecoverable territory geometry: repair produced zero geodesic area.';
    else
      raise exception 'Failed to generate valid territory geometry: coordinates could not be formed or repaired into a valid, non-empty 2D polygon or multipolygon with positive area (SRID 4326).';
    end if;
  end if;

  return new;
exception
  when others then
    raise exception 'Territory geometry generation failed: %', SQLERRM;
end;
$$ language plpgsql;

drop trigger if exists on_territory_geom_update on public.territories;
create trigger on_territory_geom_update
  before insert or update of coords on public.territories
  for each row execute procedure public.update_territory_geom();

-- 9. Updated Territory Takeover Trigger (Soft-delete conquered & expired loops)
create or replace function public.handle_territory_takeovers()
returns trigger as $$
declare
  old_terr record;
  overlap_area numeric;
  old_area numeric;
  ratio numeric;
begin
  if new.polygon_geom is null or not ST_IsValid(new.polygon_geom) then
    return new;
  end if;

  -- Soft-delete overlapping territories (> 50% overlap of the old territory)
  -- Uses GiST bounding box operator (&&) for index-accelerated candidate filtering
  for old_terr in
    select id, owner_id, area_sqm, polygon_geom
    from public.territories
    where id <> new.id
      and is_active = true
      and polygon_geom is not null
      and ST_IsValid(polygon_geom)
      and polygon_geom && new.polygon_geom
  loop
    begin
      if ST_Intersects(new.polygon_geom, old_terr.polygon_geom) then
        overlap_area := ST_Area(ST_CollectionExtract(ST_Intersection(new.polygon_geom, old_terr.polygon_geom), 3)::geography);
        old_area := ST_Area(ST_CollectionExtract(old_terr.polygon_geom, 3)::geography);

        if (old_area is null or old_area <= 0) and old_terr.area_sqm > 0 then
          old_area := old_terr.area_sqm;
        end if;

        if old_area > 0 then
          ratio := overlap_area / old_area;
          if ratio > 0.5 then
            update public.territories
            set is_active = false, status = 'conquered', conquered_by_id = new.owner_id
            where id = old_terr.id;
          end if;
        end if;
      end if;
    exception
      when others then
        raise warning 'Skipping topology exception for territory %: %', old_terr.id, SQLERRM;
        -- ARCHITECTURAL TRADE-OFF:
        -- Skipping candidate topology exceptions allows the new territory claim to commit,
        -- preventing corrupt historical polygons from blocking gameplay. However, if this candidate
        -- truly had > 50% overlap, skipping it leaves both territories co-active (incomplete takeover).
        -- If strict all-or-nothing transactional consistency is preferred, replace with:
        -- RAISE EXCEPTION 'Takeover calculation failed for candidate territory %: %', old_terr.id, SQLERRM;
    end;
  end loop;

  -- Soft-delete expired territories on new captures
  update public.territories
  set is_active = false, status = 'expired'
  where expires_at is not null and expires_at <= now() and is_active = true;

  return new;
end;
$$ language plpgsql;

drop trigger if exists on_territory_insert_takeover on public.territories;
create trigger on_territory_insert_takeover
  after insert on public.territories
  for each row execute procedure public.handle_territory_takeovers();

-- 10. Create Runs Table for Run History (Production monolithic schema)
create table if not exists public.runs (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  distance_km numeric not null default 0,
  duration_seconds integer not null default 0,
  pace_seconds_per_km numeric null,
  average_speed_kmh numeric null,
  calories integer not null default 0,
  gps_path jsonb not null default '[]'::jsonb,
  start_time timestamp with time zone not null,
  end_time timestamp with time zone not null,
  summary_statistics jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint uq_runs_user_operation unique (user_id, operation_id)
);

-- Enable RLS for runs
alter table public.runs enable row level security;

-- Permissions & Policies for runs
revoke all on table public.runs from anon, public;
revoke truncate, references, trigger on table public.runs from authenticated;
grant select, insert, update, delete on table public.runs to authenticated;

-- Dynamically drop all existing policies on public.runs to eliminate any rogue or legacy permissive rules
do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'runs'
  loop
    execute format('drop policy if exists %I on public.runs', pol.policyname);
  end loop;
end $$;

drop policy if exists "runs_select_policy" on public.runs;
create policy "runs_select_policy"
  on public.runs
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "runs_insert_policy" on public.runs;
create policy "runs_insert_policy"
  on public.runs
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "runs_update_policy" on public.runs;
create policy "runs_update_policy"
  on public.runs
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "runs_delete_policy" on public.runs;
create policy "runs_delete_policy"
  on public.runs
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- Privacy-Safe Public Runner Metrics (No GPS Path Exposure)
create or replace view public.runner_activities_public with (security_invoker = false) as
select
  r.id,
  r.operation_id,
  r.user_id,
  r.distance_km,
  r.duration_seconds,
  r.pace_seconds_per_km,
  r.average_speed_kmh,
  r.calories,
  r.created_at
from public.runs r
join public.profiles p on p.id = r.user_id
where (auth.uid() is not null and auth.uid() = r.user_id)
   or (
     coalesce(p.is_profile_public, true) = true
     and coalesce(p.show_activity, true) = true
   );

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'postgres') then
    alter view public.runner_activities_public owner to postgres;
  end if;
end $$;

revoke all on public.runner_activities_public from public;
grant select on public.runner_activities_public to anon, authenticated;

create or replace function public.get_runner_public_stats(target_user_id uuid)
returns table (
  total_distance_km numeric,
  total_runs bigint,
  longest_run_km numeric,
  fastest_pace_seconds numeric,
  average_pace_seconds numeric
)
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = target_user_id
      and (
        (auth.uid() is not null and auth.uid() = target_user_id)
        or (
          coalesce(is_profile_public, true) = true
          and coalesce(show_activity, true) = true
        )
      )
  ) then
    return;
  end if;

  return query
  select
    coalesce(round(sum(r.distance_km)::numeric, 2), 0.0)::numeric,
    count(*)::bigint,
    coalesce(round(max(r.distance_km)::numeric, 2), 0.0)::numeric,
    coalesce(min(r.pace_seconds_per_km) filter (where pace_seconds_per_km > 0), 0)::numeric,
    coalesce(round(avg(r.pace_seconds_per_km) filter (where pace_seconds_per_km > 0)), 0)::numeric
  from public.runs r
  where r.user_id = target_user_id;
end;
$$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'postgres') then
    alter function public.get_runner_public_stats(uuid) owner to postgres;
  end if;
end $$;

revoke execute on function public.get_runner_public_stats(uuid) from public;
grant execute on function public.get_runner_public_stats(uuid) to anon, authenticated;


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

