-- Comments: flat, append-only (no edits in v1).

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) >= 1 and char_length(body) <= 1000),
  -- Millisecond precision so it round-trips through JS Dates as a
  -- get_comments cursor (same reasoning as posts.published_at).
  created_at timestamptz not null default date_trunc('milliseconds', now())
);

create index comments_post_idx on public.comments (post_id, created_at, id);
create index comments_author_idx on public.comments (author_id);

alter table public.comments enable row level security;
