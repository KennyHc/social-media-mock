-- Row level security policies. RLS is enabled on every table in the table's
-- own migration; anything not allowed here is denied. Table/column grants are
-- in the grants migration.
--
-- Privacy model: content (posts, media, likes, comments) is visible only to
-- its author and the author's accepted friends.

-- True when the caller has completed onboarding. Required to create posts,
-- likes and comments.
create or replace function private.is_onboarded()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles me
    where me.id = (select auth.uid()) and me.onboarded_at is not null
  )
$$;

-- profiles ------------------------------------------------------------------
-- Self, or anyone the caller has a friendship row with (accepted or pending,
-- either direction).
create policy "profiles: read self and connections"
  on public.profiles for select
  to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1
      from public.friendships f
      where least(f.requester_id, f.addressee_id) = least(profiles.id, (select auth.uid()))
        and greatest(f.requester_id, f.addressee_id) = greatest(profiles.id, (select auth.uid()))
    )
  );

-- Column grants limit which columns can change (display_name, avatar_url,
-- avatar_path).
create policy "profiles: update self"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- friendships ---------------------------------------------------------------
create policy "friendships: read own"
  on public.friendships for select
  to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

-- posts ---------------------------------------------------------------------
create policy "posts: read own and friends' published"
  on public.posts for select
  to authenticated
  using (
    author_id = (select auth.uid())
    or (status = 'published' and public.can_see(author_id))
  );

create policy "posts: insert own draft"
  on public.posts for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and status = 'uploading'
    and private.is_onboarded()
  );

create policy "posts: delete own"
  on public.posts for delete
  to authenticated
  using (author_id = (select auth.uid()));

-- post_media ----------------------------------------------------------------
-- The posts subquery is itself filtered by the posts select policy, so a
-- friend never sees media of a post that is still uploading.
create policy "post_media: read visible"
  on public.post_media for select
  to authenticated
  using (
    public.can_see(owner_id)
    and exists (select 1 from public.posts p where p.id = post_media.post_id)
  );

-- The post_media_check trigger enforces post ownership, status, paths and
-- storage objects.
create policy "post_media: insert own"
  on public.post_media for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

-- No delete policy (or grant): media goes away with its post (cascade).

-- likes ---------------------------------------------------------------------
create policy "likes: read on visible posts"
  on public.likes for select
  to authenticated
  using (exists (select 1 from public.posts p where p.id = likes.post_id));

create policy "likes: insert own on visible published posts"
  on public.likes for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and private.is_onboarded()
    and exists (
      select 1 from public.posts p
      where p.id = likes.post_id
        and p.status = 'published'
        and public.can_see(p.author_id)
    )
  );

create policy "likes: delete own"
  on public.likes for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- comments ------------------------------------------------------------------
create policy "comments: read on visible posts"
  on public.comments for select
  to authenticated
  using (exists (select 1 from public.posts p where p.id = comments.post_id));

create policy "comments: insert own on visible published posts"
  on public.comments for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and private.is_onboarded()
    and exists (
      select 1 from public.posts p
      where p.id = comments.post_id
        and p.status = 'published'
        and public.can_see(p.author_id)
    )
  );

-- Comment author, or the author of the post the comment is on.
create policy "comments: delete own or on own post"
  on public.comments for delete
  to authenticated
  using (
    author_id = (select auth.uid())
    or exists (
      select 1 from public.posts p
      where p.id = comments.post_id
        and p.author_id = (select auth.uid())
    )
  );
