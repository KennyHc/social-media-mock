-- Storage buckets and policies. Both buckets are private; reads go through
-- signed URLs gated by the select policies below.
-- Object names: post-media  -> {owner_id}/{post_id}/{file}
--               avatars     -> {owner_id}/{file}

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('post-media', 'post-media', false, 8388608,
   array['image/webp', 'image/jpeg', 'image/png', 'image/avif']),
  ('avatars', 'avatars', false, 2097152,
   array['image/webp', 'image/jpeg', 'image/png', 'image/avif'])
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- post-media: readable only while the post row ({owner}/{post}/...) is
-- visible to the caller through posts RLS: the owner for any status, accepted
-- friends once published. Draft or deleted posts' objects are therefore not
-- readable (and not signable) by friends. Non-uuid folder names yield null ->
-- no matching post -> false (never raises).
create policy "post-media: read objects of visible posts"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'post-media'
    and exists (
      select 1 from public.posts p
      where p.id = private.uuid_or_null((storage.foldername(name))[2])
        and p.author_id = private.uuid_or_null((storage.foldername(name))[1])
    )
  );

create policy "post-media: insert own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "post-media: update own folder"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "post-media: delete own folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- avatars: any signed-in user may read; write own folder only.
create policy "avatars: read authenticated"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'avatars');

create policy "avatars: insert own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "avatars: update own folder"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "avatars: delete own folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
