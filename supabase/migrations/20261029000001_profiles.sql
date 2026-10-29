-- Profiles: one row per auth user, created by trigger on sign-up.
-- Username is null until onboarding (complete_onboarding RPC) and is
-- immutable afterwards for v1.

create extension if not exists citext with schema extensions;

-- Helpers that must not be reachable through the Data API live here.
create schema if not exists private;
revoke all on schema private from public;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username extensions.citext unique,
  display_name text,
  avatar_url text,
  avatar_path text,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Cast to text: a regex match on citext is case-insensitive, and we want
  -- stored usernames to be lowercase.
  constraint profiles_username_format
    check (username is null or username::text ~ '^[a-z0-9_]{3,20}$'),
  constraint profiles_display_name_length
    check (display_name is null
           or (char_length(btrim(display_name)) between 1 and 50 and char_length(display_name) <= 50)),
  constraint profiles_onboarded_has_username
    check (onboarded_at is null or username is not null)
);

comment on table public.profiles is
  'Readable by self, accepted friends and pending-request counterparts only. No public directory.';

alter table public.profiles enable row level security;

create table public.reserved_usernames (
  name extensions.citext primary key
);

comment on table public.reserved_usernames is
  'Read only by security definer functions. RLS on, no policies.';

alter table public.reserved_usernames enable row level security;

insert into public.reserved_usernames (name) values
  ('admin'), ('root'), ('support'), ('help'), ('me'), ('you'), ('circle'),
  ('api'), ('auth'), ('login'), ('logout'), ('onboarding'), ('feed'),
  ('friends'), ('settings'), ('profile'), ('null'), ('undefined'),
  ('system'), ('moderator'), ('staff')
on conflict do nothing;

-- updated_at maintenance
create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function private.touch_updated_at();

-- Create the profile on sign-up. Google puts the photo in avatar_url or
-- picture and the name in full_name or name.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  dn text;
begin
  dn := nullif(btrim(left(btrim(coalesce(meta ->> 'full_name', meta ->> 'name', '')), 50)), '');
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    dn,
    nullif(coalesce(meta ->> 'avatar_url', meta ->> 'picture'), '')
  )
  on conflict (id) do nothing;
  return new;
end
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();
