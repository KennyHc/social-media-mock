-- Grants. Supabase grants everything in public to anon/authenticated by
-- default; start from nothing and grant authenticated only what the policies
-- and RPCs need. anon gets nothing. service_role is left untouched.

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;

-- Future objects: no automatic anon access, no automatic PUBLIC execute.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from anon;
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema private revoke execute on functions from public;

-- Helpers referenced from policies (evaluated as the caller).
grant usage on schema private to authenticated;
grant execute on function private.uuid_or_null(text) to authenticated;
grant execute on function private.post_page(uuid[], timestamptz, uuid, int) to authenticated;
grant execute on function public.can_see(uuid) to authenticated;
grant execute on function private.is_onboarded() to authenticated;
-- public.is_friend(uuid, uuid) is intentionally NOT granted: it would let any
-- user probe the friend graph of arbitrary pairs.

-- Tables
grant select on public.profiles to authenticated;
grant update (display_name, avatar_url, avatar_path) on public.profiles to authenticated;

grant select on public.friendships to authenticated;

grant select, delete on public.posts to authenticated;
grant insert (id, author_id, body, status) on public.posts to authenticated;

-- No client delete: removing media after publish could leave an empty
-- published post. Deleting the post cascades.
grant select on public.post_media to authenticated;
grant insert (id, post_id, owner_id, position, path_full, path_thumb, width, height, lqip, mime, bytes)
  on public.post_media to authenticated;

grant select, delete on public.likes to authenticated;
grant insert (post_id, user_id) on public.likes to authenticated;

grant select, delete on public.comments to authenticated;
grant insert (id, post_id, author_id, body) on public.comments to authenticated;

-- public.reserved_usernames: no grants.

-- RPCs
grant execute on function public.username_available(text) to authenticated;
grant execute on function public.complete_onboarding(text, text) to authenticated;
grant execute on function public.find_user_by_username(text) to authenticated;
grant execute on function public.send_friend_request(uuid) to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.remove_friendship(uuid) to authenticated;
grant execute on function public.list_friends() to authenticated;
grant execute on function public.list_friend_requests() to authenticated;
grant execute on function public.publish_post(uuid) to authenticated;
grant execute on function public.get_feed(timestamptz, uuid, int) to authenticated;
grant execute on function public.get_user_posts(uuid, timestamptz, uuid, int) to authenticated;
grant execute on function public.get_comments(uuid, timestamptz, uuid, int) to authenticated;
grant execute on function public.get_likers(uuid) to authenticated;
