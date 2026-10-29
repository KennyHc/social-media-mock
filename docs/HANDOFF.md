# Handoff: Circle build status

Read this first if you are a new Claude Code session picking up this project. Also read `CLAUDE.md`, `AGENTS.md` and `.claude/agents/*.md`. The original requirements are in the first message of the cloud session that built M1 and M2. Their essentials are restated here.

## Project
- **What it is:** "Circle", a private, friends-only social PWA.
- **Stack:** Next.js 16 App Router (`src/proxy.ts`, Cache Components on), React 19.3, TypeScript strict, Tailwind v4, Supabase (Postgres, Google OAuth, Storage, RLS), TanStack Query v5, `motion`, canvas-confetti (lazy-loaded). Deploys to Vercel.
- **Branch:** `claude/focused-sagan-opnu2b`. PR: https://github.com/KennyHc/social-media-mock/pull/1

## Working agreement (from the user)
- **Milestones:** build in milestones and stop after each with a report covering which agents ran, the model each used, what was reworked, and what to check.
- **Ask before adding dependencies** beyond the approved list:
  - the stack above;
  - `@tanstack/react-virtual`, `@use-gesture/react`, `@serwist/next`, `web-vitals`;
  - dev and validation: `vitest`, `pg`, `@testing-library/react`, `zod`, `clsx`, `tailwind-merge`, `supabase` CLI.
- **Before each milestone,** show the delegation plan (who does what, in parallel or in sequence, which model) and describe each major animation, so the user can adjust the feel. Wait for "go".
- **Orchestrator role:** the orchestrator (strongest model) owns planning, interfaces, merges, final review, and personally reviews every RLS and storage policy.
- **Delegation:** to the `.claude/agents` roster, one level deep. Every brief states the goal, owned files, files not to touch, acceptance criteria and the tokens to reuse.
- **Like animation:** pure Motion, no Lottie or Rive.
- **LQIP:** a 16 px base64 WebP thumbnail stored in `post_media.lqip`, not blurhash.

## Done
- **M1:** setup; motion tokens (`src/motion/tokens.ts`) and primitives (`src/components/motion/`); schema, RLS and storage (`supabase/migrations/`, 10 files); Google auth with the callback; username onboarding; splash.
- **M2:** the friends system (`src/features/friends/`, `/friends`) with optimistic mutations, rollback shake, layout animations and celebrations (large tier for a first friend).
- **Tests:** 109 passing: 83 RLS and friendship tests in `tests/rls/`, 26 unit tests in `tests/unit/`.
- **Dev harnesses (development only):** `/dev/motion` (every primitive) and `/dev/friends` (the real friends screen, for Playwright with mocked Supabase RPCs).

## Open items
1. **Not yet verified on real Supabase.** The RLS tests ran on plain Postgres 16 with stubs, because the cloud container couldn't pull Docker images. Locally, run:
   `npx supabase start && npx supabase db reset && npm run test:rls`
   The fallback is `npm run db:reset:fallback` against Postgres on port 54322.
2. **Bundle size:** first-load JS is about 330 KB gzipped on `/friends`, and about 282 KB on `/login`. Investigate in M6.
3. **Toasts:** each toast now sets its own announcement role, which some screen readers don't read reliably when the element is added. Revisit in M7.
4. **Avatars bucket:** readable by any authenticated user, so search results and friend requests can show a face. The user hasn't objected.

## Next: M3, posts, photo upload and feed (plan proposed, awaiting the user's "go")
- **Pending decision:** the user must answer **"validate"** or **"bucket-only"**.
  - **"validate":** add `/api/posts/[id]/publish`. It verifies the user, checks each uploaded object's magic bytes (WebP, JPEG, PNG or AVIF), then publishes via a service-role-only DB function. This needs `SUPABASE_SERVICE_ROLE_KEY` on Vercel, server-side only. db-engineer adds the function and tests, and revokes `publish_post` from `authenticated`.
  - **"bucket-only":** rely on the bucket's `allowed_mime_types` and `file_size_limit`, plus the `post_media` trigger.
- **Orchestrator:**
  - `src/lib/images/` (off-main-thread resize to WebP at 1080 and 480, plus a 16 px LQIP);
  - `src/lib/upload/queue.ts` (XHR PUT to signed upload URLs with progress and retry; a store outside React so uploads continue while the user browses);
  - `src/features/posts/{api,hooks}.ts` (create draft, upload, insert `post_media`, publish; `get_feed` infinite query with keyset cursor `(published_at, id)`; batched and cached signed URLs; delete removes storage objects by path, then the row).
- **ui-builder (Sonnet):** feed page, PostCard, skeleton matching it exactly, composer form, delete-own-post menu.
- **motion-engineer (Sonnet):** composer morph from the "+" button (shared layoutId, gentle spring, about 0.4 s); photo tiles with `Reorder` (lift scale 1.04) and a ProgressRing that resolves into a check; blur-up image (opacity-only crossfade over the static blurred LQIP); a new post sliding into the feed top (y -24→0, siblings glide via layout); publish burst and confetti from the Post button (large tier for a first post).
- **Then:** test-runner (Haiku), perf-and-a11y-reviewer (Sonnet), orchestrator review.

## Later milestones
- **M4:** likes (spring pop, particle burst, rolling count, double-tap heart) and comments (bottom sheet; the Sheet already drags from its handle only; swipe-to-delete; layout insert and collapse).
- **M5:** photo viewer (shared element, pinch via @use-gesture, swipe, drag-to-dismiss); page transitions (View Transitions API with a Motion fallback; direction-aware); tab bar with a layoutId indicator; scroll-linked hide/show of the header and nav; profile page; PWA via Serwist.
- **M6:** prefetching, stale-while-revalidate persistence, virtualization, offline queue and banner, "new posts" pill, pull-to-refresh, Web Vitals reporting, bundle work.
- **M7:** polish audit; README with env vars, Google OAuth setup, Supabase setup and Vercel deploy.

## Gotchas learned
- **Next 16:** middleware is `src/proxy.ts`. With Cache Components on, `useSearchParams` and request APIs need Suspense boundaries. Read `node_modules/next/dist/docs/` before using Next APIs.
- **Onboarding flag:** the `complete_onboarding` RPC sets `app_metadata.onboarded`, and the proxy reads it from the JWT (no DB call). The client refreshes its session after onboarding.
- **Supabase functions:** definer functions use `search_path = ''` and compare citext with `operator(extensions.=)`.
- **Mutations:** hoist them to a component that outlives the row, otherwise TanStack drops per-call `onError` after the row unmounts. Only network errors are retried (`src/lib/query/client.ts`).
- **First-friend detection:** `onMutate` runs before `mutationFn`, so exclude the optimistic item when computing "first ever".
- **Builds:** running `next build` while `next dev` is up can kill the dev server. Build in a copy, or stop dev first.
