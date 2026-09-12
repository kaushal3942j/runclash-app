-- ========================================================
-- RunClash Phone Auth & Anti-Abuse Schema Updates
-- Execute this script in your Supabase SQL Editor
-- ========================================================

-- 1. Add new columns to public.profiles idempotently
do \$\$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='device_id') then
    alter table public.profiles add column device_id text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='is_phone_verified') then
    alter table public.profiles add column is_phone_verified boolean default false;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='phone') then
    alter table public.profiles add column phone text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='is_guest') then
    alter table public.profiles add column is_guest boolean default false;
  end if;
end
\$\$;

-- 2. Update Profile Auto-creation Trigger (SignUp) to capture device_id and is_guest
create or replace function public.handle_new_user()
returns trigger as \$\$
begin
  insert into public.profiles (id, display_name, clan_name, level, xp, coins, premium, device_id, is_guest)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), 'Runner'),
    coalesce(new.raw_user_meta_data->>'clan_name', 'Udaipur Racers'),
    1,
    0,
    100,
    false,
    new.raw_user_meta_data->>'device_id',
    coalesce((new.raw_user_meta_data->>'is_anonymous')::boolean, new.is_anonymous, false)
  );
  return new;
end;
\$\$ language plpgsql security definer;
