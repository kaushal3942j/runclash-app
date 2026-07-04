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
  delete from public.error_logs where created_at < now() - interval '30 days';
end;
$$ language plpgsql security definer;

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
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 8. PostGIS Geometry Translator Trigger
create or replace function public.update_territory_geom()
returns trigger as $$
declare
  points_str text;
  coord_rec json;
  first_coord json;
begin
  if new.coords is null or jsonb_array_length(new.coords) < 3 then
    new.polygon_geom := null;
    return new;
  end if;

  points_str := '';
  for coord_rec in select jsonb_array_elements(new.coords) loop
    if points_str <> '' then
      points_str := points_str || ', ';
    end if;
    points_str := points_str || (coord_rec->>1) || ' ' || (coord_rec->>0);
  end loop;

  first_coord := new.coords->0;
  if (first_coord->>0) <> (new.coords->-1->>0) or (first_coord->>1) <> (new.coords->-1->>1) then
    points_str := points_str || ', ' || (first_coord->>1) || ' ' || (first_coord->>0);
  end if;

  new.polygon_geom := ST_GeomFromText('POLYGON((' || points_str || '))', 4326);
  return new;
exception
  when others then
    raise warning 'Failed to generate polygon geometry: %', SQLERRM;
    new.polygon_geom := null;
    return new;
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
  if new.polygon_geom is null then
    return new;
  end if;

  -- Soft-delete overlapping territories (> 50% overlap of the old territory)
  for old_terr in 
    select id, owner_id, area_sqm, polygon_geom 
    from public.territories 
    where id <> new.id and is_active = true and polygon_geom is not null and ST_Intersects(new.polygon_geom, polygon_geom)
  loop
    overlap_area := ST_Area(ST_Intersection(new.polygon_geom::geography, old_terr.polygon_geom::geography));
    old_area := ST_Area(old_terr.polygon_geom::geography);

    if old_area > 0 then
      ratio := overlap_area / old_area;
      if ratio > 0.5 then
        update public.territories 
        set is_active = false, status = 'conquered', conquered_by_id = new.owner_id 
        where id = old_terr.id;
      end if;
    end if;
  end loop;

  -- Soft-delete expired territories on new captures
  update public.territories 
  set is_active = false, status = 'expired' 
  where expires_at <= now() and is_active = true;

  -- Prune old logs as part of the database maintenance
  perform public.cleanup_old_logs();

  return new;
end;
$$ language plpgsql;

drop trigger if exists on_territory_insert_takeover on public.territories;
create trigger on_territory_insert_takeover
  after insert on public.territories
  for each row execute procedure public.handle_territory_takeovers();
