-- Friendships: one row per unordered pair. 'pending' = request from
-- requester to addressee; 'accepted' = mutual friends. Declines and
-- unfriends delete the row. Clients never write this table directly; all
-- changes go through the friendship RPCs.

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint friendships_not_self check (requester_id <> addressee_id),
  constraint friendships_responded_when_accepted
    check (status = 'pending' or responded_at is not null)
);

create unique index friendships_pair_key
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index friendships_requester_idx on public.friendships (requester_id, status);
create index friendships_addressee_idx on public.friendships (addressee_id, status);

alter table public.friendships enable row level security;

-- Visibility helpers.
--
-- NOTE (messaging): is_friend / can_see are the single source of truth for
-- "may these two users see each other's content". Future conversations /
-- messages tables should reuse them in their policies rather than
-- re-deriving friendship.

-- Not granted to authenticated: answering for arbitrary (a, b) pairs would
-- leak the friend graph. Policies call can_see(), which is definer.
create or replace function public.is_friend(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.friendships f
    where f.status = 'accepted'
      and least(f.requester_id, f.addressee_id) = least(a, b)
      and greatest(f.requester_id, f.addressee_id) = greatest(a, b)
  )
$$;

-- True when the current user is owner or an accepted friend of owner.
-- Null owner or no session -> false.
create or replace function public.can_see(owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    owner = (select auth.uid()) or public.is_friend((select auth.uid()), owner),
    false
  )
$$;

-- Non-raising text -> uuid cast for storage folder names.
create or replace function private.uuid_or_null(value text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then value::uuid
  end
$$;
