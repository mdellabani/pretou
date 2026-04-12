# Rural Community Platform

SaaS platform for small French communes (<2,000 inhabitants). Combines community interaction, official municipal communication, and mairie back-office tools in one product. Targets rural France where adoption depends on App Store presence and simplicity.

## Architecture

Monorepo with two frontend apps sharing a common backend and TypeScript package.

```
apps/web/       — Next.js 15 (App Router) — commune public website (SSR/SEO) + desktop admin panel
apps/mobile/    — Expo (React Native) — resident app + field admin for mairie workers
packages/shared — TypeScript types, Supabase queries (platform-agnostic), Zod validation, constants
supabase/       — Postgres schema, RLS policies, Edge Functions, migrations
```

Full architecture spec: `docs/superpowers/specs/2026-04-12-architecture-design.md`
Feature scope and business context: `design.md`

## Tech Stack

| Layer | Tech |
|---|---|
| Web | Next.js 15, App Router, Tailwind CSS, shadcn/ui |
| Mobile | Expo, Expo Router, React Native |
| Backend | Supabase (Postgres, Auth, Realtime, Storage, Edge Functions) |
| Geo | PostGIS (Supabase extension) |
| Shared | TypeScript, Zod |
| Monorepo | Turborepo + pnpm workspaces |
| Deploy | Vercel (web), EAS (mobile), Supabase Cloud |

## Build / Dev Commands

Not yet scaffolded. Once set up:

```bash
pnpm install              # install all dependencies
pnpm dev                  # start all apps (via turborepo)
pnpm dev --filter web     # start web app only
pnpm dev --filter mobile  # start mobile app only
pnpm build                # build all packages
pnpm lint                 # lint all packages
```

## Key Conventions

- **Multi-tenancy:** every tenant-scoped table has `commune_id`. Security enforced via Supabase RLS, not app code.
- **Shared queries:** data-fetching functions live in `packages/shared`, accept a Supabase client param. No platform-specific code in shared.
- **No UI sharing:** web uses `<div>` + Tailwind, mobile uses `<View>` + StyleSheet. The screens serve different purposes — don't force shared components.
- **One write, multiple outputs:** admin posts once -> appears on mobile feed (Realtime), commune website (SSR), and triggers push notification (Edge Function).
- **French context:** UI labels, error messages, and content are in French. Code (variable names, comments) stays in English.

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=       # server-side only, never exposed to client
```

## Current Status

- MVP scope: v1 (Community Board + Official Announcements)
- Phase: architecture defined, implementation not yet started
- Old implementation plan (`implementation-plan-v1.md`) is superseded — kept for reference on Supabase schema/RLS details
