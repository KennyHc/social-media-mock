-- Post media: up to 10 images per post. Each row points at two objects in the
-- private 'post-media' bucket (full size + thumbnail) that must already be
-- uploaded under {owner_id}/{post_id}/.

create table public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  position smallint not null check (position between 0 and 9),
  path_full text not null,
  path_thumb text not null,
  width int not null check (width > 0),
  height int not null check (height > 0),
  lqip text check (lqip is null or (char_length(lqip) <= 2048 and lqip like 'data:image/%')),
  mime text not null check (mime in ('image/webp', 'image/jpeg', 'image/png', 'image/avif')),
  bytes int not null check (bytes > 0 and bytes <= 8388608),
  created_at timestamptz not null default now(),
  constraint post_media_position_key unique (post_id, position)
);

create index post_media_owner_idx on public.post_media (owner_id);

alter table public.post_media enable row level security;

create or replace function private.check_post_media()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  p record;
  prefix text;
  obj record;
  n int;
  allowed text[] := array['image/webp', 'image/jpeg', 'image/png', 'image/avif'];
  path text;
begin
  -- Lock the post so concurrent inserts and publish_post serialize.
  select id, author_id, status into p
  from public.posts
  where id = new.post_id
  for update;

  if not found then
    raise exception 'not_found' using detail = 'post does not exist';
  end if;
  if new.owner_id is distinct from p.author_id then
    raise exception 'not_allowed' using detail = 'media owner must be the post author';
  end if;
  if p.status <> 'uploading' then
    raise exception 'not_allowed' using detail = 'post is already published';
  end if;

  select count(*) into n from public.post_media where post_id = new.post_id;
  if n >= 10 then
    raise exception 'not_allowed' using detail = 'at most 10 media per post';
  end if;

  prefix := new.owner_id::text || '/' || new.post_id::text || '/';
  foreach path in array array[new.path_full, new.path_thumb] loop
    if not starts_with(path, prefix) or char_length(path) <= char_length(prefix) then
      raise exception 'not_allowed' using detail = 'media path must start with {owner_id}/{post_id}/';
    end if;

    select o.metadata into obj
    from storage.objects o
    where o.bucket_id = 'post-media' and o.name = path;

    if not found then
      raise exception 'not_found' using detail = 'storage object missing: ' || path;
    end if;
    if coalesce(obj.metadata ->> 'mimetype', '') <> all (allowed) then
      raise exception 'not_allowed' using detail = 'unsupported media type';
    end if;
    if coalesce((obj.metadata ->> 'size')::bigint, 0) > 8388608 then
      raise exception 'not_allowed' using detail = 'object too large';
    end if;
  end loop;

  return new;
end
$$;

create trigger post_media_check
  before insert on public.post_media
  for each row execute function private.check_post_media();
