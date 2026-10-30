-- RPCs. Errors are raised as `raise exception '<code>'` (SQLSTATE P0001) with
-- stable codes: not_found, self, already_friends, already_requested,
-- not_allowed, username_taken, username_reserved, invalid_username,
-- invalid_display_name, already_onboarded, empty_post.
--
-- Note on citext: definer functions run with search_path = '', where
-- citext's own `=` operator is not visible and `citext = citext` would
-- silently fall back to case-sensitive text equality. We therefore spell it
-- `operator(extensions.=)`, which also lets the unique index be used.

-- Onboarding ----------------------------------------------------------------

create or replace function public.username_available(name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select s.n ~ '^[a-z0-9_]{3,20}$'
     and not exists (
       select 1 from public.reserved_usernames r
       where r.name operator(extensions.=) s.n::extensions.citext
     )
     and not exists (
       select 1 from public.profiles p
       where p.username operator(extensions.=) s.n::extensions.citext
     )
  from (select lower(btrim(coalesce($1, ''))) as n) s
$$;

create or replace function public.complete_onboarding(username text, display_name text)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  prof public.profiles;
  n text := lower(btrim(coalesce(complete_onboarding.username, '')));
  dn text := btrim(coalesce(complete_onboarding.display_name, ''));
begin
  if me is null then
    raise exception 'not_allowed';
  end if;

  select * into prof from public.profiles p where p.id = me for update;
  if not found then
    raise exception 'not_found';
  end if;
  if prof.username is not null then
    raise exception 'already_onboarded';
  end if;

  if n !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'invalid_username';
  end if;
  if exists (
    select 1 from public.reserved_usernames r
    where r.name operator(extensions.=) n::extensions.citext
  ) then
    raise exception 'username_reserved';
  end if;
  if char_length(dn) not between 1 and 50 then
    raise exception 'invalid_display_name';
  end if;
  if exists (
    select 1 from public.profiles p
    where p.username operator(extensions.=) n::extensions.citext
  ) then
    raise exception 'username_taken';
  end if;

  begin
    update public.profiles p
       set username = n::extensions.citext,
           display_name = dn,
           onboarded_at = now()
     where p.id = me
     returning * into prof;
  exception when unique_violation then
    raise exception 'username_taken';
  end;

  -- The Next.js proxy reads app_metadata.onboarded from the JWT; the client
  -- refreshes its session after this call.
  update auth.users u
     set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb) || '{"onboarded": true}'::jsonb
   where u.id = me;

  return prof;
end
$$;

-- Discovery -----------------------------------------------------------------

-- Exact, case-insensitive username lookup. Definer because non-friends are
-- not readable through RLS. Un-onboarded users are never returned.
create or replace function public.find_user_by_username(name text)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  relationship text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.username::text,
    p.display_name,
    p.avatar_url,
    case
      when p.id = s.me then 'self'
      when f.status = 'accepted' then 'friends'
      when f.requester_id = s.me then 'outgoing'
      when f.addressee_id = s.me then 'incoming'
      else 'none'
    end
  from (select (select auth.uid()) as me, lower(btrim(coalesce($1, ''))) as n) s
  join public.profiles p
    on p.username operator(extensions.=) s.n::extensions.citext
  left join public.friendships f
    on least(f.requester_id, f.addressee_id) = least(p.id, s.me)
   and greatest(f.requester_id, f.addressee_id) = greatest(p.id, s.me)
  where s.me is not null
    and p.onboarded_at is not null
  limit 1
$$;

-- Friendships ---------------------------------------------------------------

create or replace function public.send_friend_request(target uuid)
returns public.friendships
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  fr public.friendships;
begin
  if me is null then
    raise exception 'not_allowed';
  end if;
  if target is null then
    raise exception 'not_found';
  end if;
  if target = me then
    raise exception 'self';
  end if;
  if not exists (
    select 1 from public.profiles p where p.id = me and p.onboarded_at is not null
  ) then
    raise exception 'not_allowed';
  end if;
  if not exists (
    select 1 from public.profiles p where p.id = target and p.onboarded_at is not null
  ) then
    raise exception 'not_found';
  end if;

  -- Serialize concurrent requests for the same pair (A->B racing B->A).
  perform pg_advisory_xact_lock(
    hashtextextended(least(me, target)::text || greatest(me, target)::text, 0)
  );

  select * into fr
  from public.friendships f
  where least(f.requester_id, f.addressee_id) = least(me, target)
    and greatest(f.requester_id, f.addressee_id) = greatest(me, target)
  for update;

  if found then
    if fr.status = 'accepted' then
      raise exception 'already_friends';
    elsif fr.requester_id = me then
      raise exception 'already_requested';
    else
      -- They already asked us: accept.
      update public.friendships f
         set status = 'accepted', responded_at = now()
       where f.id = fr.id
       returning * into fr;
      return fr;
    end if;
  end if;

  insert into public.friendships (requester_id, addressee_id, status)
  values (me, target, 'pending')
  returning * into fr;
  return fr;
end
$$;

-- Accept sets status=accepted; decline deletes the row (returned as it was).
create or replace function public.respond_friend_request(request_id uuid, accept boolean)
returns public.friendships
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  fr public.friendships;
begin
  if me is null then
    raise exception 'not_allowed';
  end if;

  select * into fr
  from public.friendships f
  where f.id = respond_friend_request.request_id
    and me in (f.requester_id, f.addressee_id)
  for update;

  if not found or fr.status <> 'pending' then
    raise exception 'not_found';
  end if;
  if fr.addressee_id <> me then
    raise exception 'not_allowed';
  end if;

  if coalesce(accept, false) then
    update public.friendships f
       set status = 'accepted', responded_at = now()
     where f.id = fr.id
     returning * into fr;
  else
    delete from public.friendships f where f.id = fr.id;
  end if;
  return fr;
end
$$;

-- Unfriend, cancel an outgoing request or decline an incoming one. Returns
-- whether a row was deleted (idempotent).
create or replace function public.remove_friendship(other uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  n int;
begin
  if me is null then
    raise exception 'not_allowed';
  end if;
  delete from public.friendships f
  where least(f.requester_id, f.addressee_id) = least(me, other)
    and greatest(f.requester_id, f.addressee_id) = greatest(me, other);
  get diagnostics n = row_count;
  return n > 0;
end
$$;

-- Invoker: RLS on friendships and profiles already allows exactly this.
create or replace function public.list_friends()
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  since timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.id, p.username::text, p.display_name, p.avatar_url,
         coalesce(f.responded_at, f.created_at)
  from public.friendships f
  join public.profiles p
    on p.id = case when f.requester_id = (select auth.uid()) then f.addressee_id else f.requester_id end
  where f.status = 'accepted'
    and (select auth.uid()) in (f.requester_id, f.addressee_id)
  order by p.username
$$;

create or replace function public.list_friend_requests()
returns table (
  request_id uuid,
  direction text,
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select f.id,
         case when f.addressee_id = (select auth.uid()) then 'incoming' else 'outgoing' end,
         p.id, p.username::text, p.display_name, p.avatar_url, f.created_at
  from public.friendships f
  join public.profiles p
    on p.id = case when f.requester_id = (select auth.uid()) then f.addressee_id else f.requester_id end
  where f.status = 'pending'
    and (select auth.uid()) in (f.requester_id, f.addressee_id)
  order by f.created_at desc, f.id desc
$$;

-- Posts ---------------------------------------------------------------------

-- Definer because clients have no UPDATE on posts. Idempotent for an
-- already-published post. published_at is truncated to milliseconds so it
-- round-trips through JavaScript Dates as a feed cursor.
create or replace function public.publish_post(post_id uuid)
returns public.posts
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  p public.posts;
begin
  if me is null then
    raise exception 'not_allowed';
  end if;

  select * into p from public.posts x where x.id = publish_post.post_id for update;
  if not found or p.author_id <> me then
    raise exception 'not_found';
  end if;
  if p.status = 'published' then
    return p;
  end if;

  if btrim(p.body) = ''
     and not exists (select 1 from public.post_media m where m.post_id = p.id) then
    raise exception 'empty_post';
  end if;

  update public.posts x
     set status = 'published',
         published_at = date_trunc('milliseconds', now())
   where x.id = p.id
   returning * into p;
  return p;
end
$$;

-- Shared page query for get_feed / get_user_posts. Invoker: RLS on posts,
-- profiles, post_media, likes and comments does the filtering. The explicit
-- author list only lets the planner use posts_author_idx.
create or replace function private.post_page(
  authors uuid[],
  before_published_at timestamptz,
  before_id uuid,
  page_size int
)
returns table (
  id uuid,
  author_id uuid,
  body text,
  status text,
  created_at timestamptz,
  published_at timestamptz,
  author jsonb,
  media jsonb,
  like_count bigint,
  comment_count bigint,
  liked_by_me boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    p.id,
    p.author_id,
    p.body,
    p.status,
    p.created_at,
    p.published_at,
    jsonb_build_object(
      'id', a.id,
      'username', a.username::text,
      'display_name', a.display_name,
      'avatar_url', a.avatar_url
    ),
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', m.id,
               'position', m.position,
               'path_full', m.path_full,
               'path_thumb', m.path_thumb,
               'width', m.width,
               'height', m.height,
               'lqip', m.lqip
             ) order by m.position)
      from public.post_media m
      where m.post_id = p.id
    ), '[]'::jsonb),
    (select count(*) from public.likes l where l.post_id = p.id),
    (select count(*) from public.comments c where c.post_id = p.id),
    exists (
      select 1 from public.likes l
      where l.post_id = p.id and l.user_id = (select auth.uid())
    )
  from public.posts p
  join public.profiles a on a.id = p.author_id
  where p.status = 'published'
    and p.author_id = any (authors)
    and (
      before_published_at is null
      or (p.published_at, p.id)
         < (before_published_at, coalesce(before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
    )
  order by p.published_at desc, p.id desc
  limit greatest(1, least(coalesce(page_size, 10), 30))
$$;

create or replace function public.get_feed(
  before_published_at timestamptz default null,
  before_id uuid default null,
  page_size int default 10
)
returns table (
  id uuid,
  author_id uuid,
  body text,
  status text,
  created_at timestamptz,
  published_at timestamptz,
  author jsonb,
  media jsonb,
  like_count bigint,
  comment_count bigint,
  liked_by_me boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select *
  from private.post_page(
    array(
      select (select auth.uid())
      union all
      select case when f.requester_id = (select auth.uid()) then f.addressee_id else f.requester_id end
      from public.friendships f
      where f.status = 'accepted'
        and (select auth.uid()) in (f.requester_id, f.addressee_id)
    ),
    before_published_at,
    before_id,
    page_size
  )
$$;

create or replace function public.get_user_posts(
  user_id uuid,
  before_published_at timestamptz default null,
  before_id uuid default null,
  page_size int default 10
)
returns table (
  id uuid,
  author_id uuid,
  body text,
  status text,
  created_at timestamptz,
  published_at timestamptz,
  author jsonb,
  media jsonb,
  like_count bigint,
  comment_count bigint,
  liked_by_me boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select *
  from private.post_page(array[get_user_posts.user_id], before_published_at, before_id, page_size)
$$;

-- Comments ------------------------------------------------------------------

-- Comments on a visible post, oldest first, with author info. Definer
-- because a commenter may be a friend of the post author but not of the
-- viewer, in which case their profile is not readable through RLS. Only
-- id/username/display_name/avatar_url are exposed, and only for comments on
-- posts the caller can already see.
create or replace function public.get_comments(
  post_id uuid,
  after_created_at timestamptz default null,
  after_id uuid default null,
  page_size int default 20
)
returns table (
  id uuid,
  body text,
  created_at timestamptz,
  author jsonb,
  can_delete boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    c.body,
    c.created_at,
    jsonb_build_object(
      'id', a.id,
      'username', a.username::text,
      'display_name', a.display_name,
      'avatar_url', a.avatar_url
    ),
    (c.author_id = s.me or p.author_id = s.me)
  from (select (select auth.uid()) as me) s
  join public.posts p
    on p.id = $1
   and (p.author_id = s.me or (p.status = 'published' and public.can_see(p.author_id)))
  join public.comments c on c.post_id = p.id
  join public.profiles a on a.id = c.author_id
  where s.me is not null
    and (
      $2 is null
      or (c.created_at, c.id) > ($2, coalesce($3, '00000000-0000-0000-0000-000000000000'::uuid))
    )
  order by c.created_at, c.id
  limit greatest(1, least(coalesce($4, 20), 50))
$$;

-- Likes ---------------------------------------------------------------------

-- "Who liked" list for a visible post, newest first, capped at 200. Definer
-- for the same reason as get_comments: a liker may be a friend of the post
-- author but not of the viewer.
create or replace function public.get_likers(post_id uuid)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.username::text, a.display_name, a.avatar_url, l.created_at
  from (select (select auth.uid()) as me) s
  join public.posts p
    on p.id = $1
   and (p.author_id = s.me or (p.status = 'published' and public.can_see(p.author_id)))
  join public.likes l on l.post_id = p.id
  join public.profiles a on a.id = l.user_id
  where s.me is not null
  order by l.created_at desc, a.id desc
  limit 200
$$;
