@AGENTS.md

# Circle: project conventions

- Stack: Next.js 16 App Router (`src/proxy.ts`, Cache Components on), React 19.3, TS strict, Tailwind v4, Supabase, TanStack Query v5, `motion`, canvas-confetti (lazy).
- Data access happens client-side through `supabaseBrowser()` with RLS as the only authorization layer. Server code that needs elevated rights lives in route handlers under `src/app/api/` and re-validates input with the zod schemas in `src/lib/validation.ts`.
- Query keys only come from `src/lib/query/keys.ts`.
- Motion: tokens in `src/motion/tokens.ts`, primitives in `src/components/motion/`. No literal durations or springs elsewhere. Animate only transform and opacity. Respect reduced motion.
- Theme colors only via Tailwind tokens defined in `src/app/globals.css`.
- File ownership per agent is listed in `.claude/agents/*.md`. Orchestrator owns `src/lib/**`, `src/types/**` (except generated `database.ts`), `src/proxy.ts`, and config files.
- Checks: `npm run typecheck && npm run lint && npm test`.
- Accepted motion exception: SVG `pathLength` (stroke-dashoffset) may animate; it is paint-only.
- Theme tokens meet WCAG AA: text on accent uses `text-accent-fg`, text on danger uses `text-danger-fg`, input borders use `border-border-strong`.
