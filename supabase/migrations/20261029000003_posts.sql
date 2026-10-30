-- Posts. Created by the client in 'uploading' state (the client picks the id
-- so it can build storage paths before insert), then published through
-- publish_post() once media rows exist.

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null default '' check (char_length(body) <= 2000),
  status text not null default 'uploading' check (status in ('uploading', 'published')),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  constraint posts_published_at_matches_status
    check ((status = 'published') = (published_at is not null))
);

create index posts_feed_idx
  on public.posts (published_at desc, id desc)
  where status = 'published';
create index posts_author_idx
  on public.posts (author_id, published_at desc, id desc);

alter table public.posts enable row level security;
