# P5 — `/admin/*` Migration Design

**Date:** 2026-04-18
**Status:** approved (with 2026-04-18 addendum on cache API)
**Phase:** P5 of the client-side data architecture migration (P0–P6)
**Predecessors:** P0 foundation, P1a/b/c feed, P2 identity + simple reads, P3 events + producers, P4 post detail
**Successor:** P6 — optimistic updates polish

## Addendum (2026-04-18) — verified Next 16 cache API

P5a Task 1 (smoke test) was run against a production build and revealed two things:

1. **`unstable_cache` works correctly in prod.** Cached values stick across requests. Dev mode is much looser; only the prod build accurately reflects runtime behavior.
2. **`revalidateTag(tag, profile)` is lazy** — it schedules invalidation per the `cacheLife` profile (e.g. minutes/hours), it does NOT immediately bust the cache. The new immediate-invalidation primitive is **`updateTag(tag)`**, which is **only callable from server actions** (this enables read-your-own-writes semantics).

**Decision:** Throughout this spec and the P5b plan, every reference to `revalidateTag(\`commune:\${slug}\`)` should be read as **`updateTag(\`commune:\${slug}\`)`**. The mutation flow stays identical; only the function name changes. All 5 mutation paths affected (theme, commune, council, homepage, domain) are server actions, which is exactly what `updateTag` requires.

`unstable_cache` is still the right read-side primitive (no change to P5a's `getCommuneBySlugCached` design). `"use cache"` directive + `cacheTag()` is the newer alternative but is still flagged experimental in Next 16.2.3 — defer that migration to a future cleanup phase.

## Goal

Migrate the entire `/admin/*` surface (dashboard + homepage editor) to the thin-shell + React Query pattern established in P1b/P2/P3/P4. Replace all 32 `revalidatePath` calls in admin actions with:

1. **Surgical client-side invalidation** (`qc.invalidateQueries`) for the admin's own React Query cache.
2. **Targeted server-cache invalidation** (`revalidateTag("commune:${slug}")`) for the public commune site, used only when the change affects what visitors see (theme, contact info, council docs, homepage sections, custom domain).

After P5 the admin dashboard loads instantly on return navigation (cached) and approval/edit interactions feel ~5× faster (~80ms vs ~400ms today). Theme changes propagate to the public site within seconds via tag-based invalidation rather than nuking Next's full page cache with `revalidatePath("/", "layout")`.

## Architecture

### Today (pre-P5)

`apps/web/src/app/admin/dashboard/page.tsx` is a 199-line server component that:

- Auth-guards the user.
- Runs **8+ Supabase queries sequentially** on every visit (`pendingUsers`, `pendingProducers`, `communeMembers`, `auditLog`, commune metadata, council docs, posts-this-week count, paginated posts).
- Parses URL search params for filters/pagination.
- Renders a 6-tab layout (`<AdminTabs>`).

Every mutation in the 7 admin action files calls `revalidatePath("/admin/dashboard")` (or `revalidatePath("/", "layout")` in `theme-actions.ts`), forcing the entire page to re-render and re-run all 8 queries — even when only one row changed.

### After P5

**`page.tsx` becomes a thin server shell** (~30 lines): auth guard + `Promise.all` prefetch of all 8 queries into a `QueryClient`, then `<HydrationBoundary state={dehydratedState}>` wrapping a new `<DashboardClient />`.

**`dashboard-client.tsx`** consumes 8 hooks via `useQuery`. Each hook reads from the hydrated cache on mount (zero refetches), then invalidates only its own cache slice when an admin mutation succeeds. Tabs render independently.

**`homepage/page.tsx`** follows the same pattern but smaller: one prefetched query, one client component wrapping the existing `homepage-editor.tsx`.

**Public commune site (`/[commune-slug]/*`)** stays server-rendered. Its data fetches move into a new `unstable_cache` wrapper tagged `commune:${slug}`. Admin mutations that change visitor-facing data (theme, contact, hours, sections, council docs, custom domain) call `revalidateTag("commune:${slug}")` after success — the next visitor request rebuilds with fresh data.

## Two-phase delivery

### P5a — Reads (~10 tasks)

Ships first. Adds hooks, rewrites the two pages as thin shells. No mutation paths change yet — all existing `revalidatePath` calls keep working.

**New hooks** in `apps/web/src/hooks/queries/`:

| Hook | Returns | staleTime |
|---|---|---|
| `usePendingUsers(communeId)` | `Profile[]` (status='pending') | 1 min |
| `usePendingProducers(communeId)` | `Producer[]` (status='pending') | 1 min |
| `useCommuneMembers(communeId)` | `Profile[]` (active members) | 5 min (default) |
| `useAuditLog(communeId, limit?)` | `AuditEntry[]` | 30 s |
| `useCommuneAdmin(communeId)` | full commune row (admin-side fields: invite_code, theme, custom_primary_color, logo_url, address, phone, email, opening_hours, associations, custom_domain, domain_verified) | 30 min |
| `useCouncilDocs(communeId)` | `CouncilDocument[]` | 30 min |
| `usePostsThisWeek(communeId)` | `number` (count only) | 5 min |
| `useHomepageSections(communeId)` | `PageSection[]` | 30 min |

The post-management tab reuses `usePosts(communeId, filters)` from P1b — filter shape (`types`, `dateFilter`, `page`, `perPage`) already matches the `PostListFilters` type.

**New client components:**

- `apps/web/src/app/admin/dashboard/dashboard-client.tsx` — consumes all 8 hooks, renders the 6 existing tab components (`SummaryCards`, `PendingUsers`, `PendingProducers`, `CommuneInfoForm`, `AssociationsManager`, `InviteCodeManager`, `ThemeCustomizer`, `DomainManager`, `CommuneMembers`, `PostManagement`, `CouncilDocuments`, `AuditLogView`) inside `<AdminTabs>`. Filter state for the post-management tab stays URL-driven via `useSearchParams`.
- `apps/web/src/app/admin/homepage/homepage-client.tsx` — wraps the existing `homepage-editor.tsx`, consumes `useHomepageSections(communeId)`.

**Page rewrites:**

- `apps/web/src/app/admin/dashboard/page.tsx` — 199 lines → ~50 lines. Auth guard, profile guard (admin role), `Promise.all` prefetch of all 8 queries into the dehydrated state, render `<HydrationBoundary>` + `<DashboardClient>`. Filter parsing for the prefetched posts query stays here (so the prefetched cache key matches what the client hook will request).
- `apps/web/src/app/admin/homepage/page.tsx` — already small, stays small. Add prefetch of `homepageSections(communeId)`.

**Loading skeletons:**

- `apps/web/src/app/admin/dashboard/loading.tsx` — page-shaped placeholder with a tab bar + summary cards + 3 list rows.
- `apps/web/src/app/admin/homepage/loading.tsx` — editor-shaped placeholder.

**`unstable_cache` wiring** (foundation for P5b's `revalidateTag`):

- New file `apps/web/src/lib/cached-fetchers/commune.ts` exposing `getCommuneBySlugCached(slug)` and `getHomepageSectionsBySlugCached(slug)`. Both wrap their existing Supabase calls with `unstable_cache(..., ["..."], { tags: [`commune:${slug}`], revalidate: 3600 })`.
- Refactor `apps/web/src/app/[commune-slug]/page.tsx` and any nested commune-public pages (`/[commune-slug]/conseil`, `/[commune-slug]/evenements`, etc) to read through these cached fetchers.

**P5a smoke test (Task 1):** Before any other work, write a tiny `unstable_cache` + `revalidateTag` test in dev mode to confirm Turbopack actually busts the cache when `revalidateTag` fires. Recent Next 16 + Turbopack versions have had quirks here. If the smoke test fails, escalate before continuing.

### P5b — Writes (~7 tasks)

Ships second, after P5a is merged. For each action file, drop `revalidatePath` and update calling components to invalidate the right query keys (and call `revalidateTag` where the public site cares).

| Action file | Calls to drop | Client invalidations | `revalidateTag` |
|---|---|---|---|
| `apps/web/src/app/admin/dashboard/actions.ts` (post mgmt: pin, hide, delete) | 6 | `posts.list(communeId, filters)`, `posts.pinned(communeId)` | — |
| `apps/web/src/app/admin/dashboard/commune-actions.ts` (contact, hours, associations) | 2 | `commune(communeId)` | `commune:${slug}` |
| `apps/web/src/app/admin/dashboard/council-actions.ts` (upload, delete docs) | 2 | `councilDocs(communeId)` | `commune:${slug}` |
| `apps/web/src/app/admin/dashboard/domain-actions.ts` (set, verify, remove custom domain) | 3 | `commune(communeId)` | `commune:${slug}` |
| `apps/web/src/app/admin/dashboard/invite-actions.ts` (regenerate invite code) | 1 | `commune(communeId)` | — (admin-only data, not on public site) |
| `apps/web/src/app/admin/dashboard/theme-actions.ts` (theme, custom color, logo) | 3 (currently `revalidatePath("/", "layout")` — the most destructive call in the codebase) | `commune(communeId)` | `commune:${slug}` |
| `apps/web/src/app/admin/producer-actions.ts` (approve/reject producer) | 2 | `admin.pendingProducers(communeId)`, `producers(communeId)` | — (producers shown on `/app/producteurs` which is already client-cached, no public site impact) |
| `apps/web/src/app/admin/homepage/actions.ts` (CRUD homepage sections) | 4 | `admin.homepageSections(communeId)` | `commune:${slug}` |

The mutation refactor pattern (already used in P4): components calling these actions wrap success branch with `qc.invalidateQueries({ queryKey: ... })`. Server actions stop calling `revalidatePath` and (when relevant) call `revalidateTag` directly.

## Query keys to add

In `packages/shared/src/query-keys.ts`:

```ts
admin: {
  pendingUsers: (communeId: string) => ["admin", "pending-users", communeId] as const,
  pendingProducers: (communeId: string) => ["admin", "pending-producers", communeId] as const,
  members: (communeId: string) => ["admin", "members", communeId] as const,
  postsThisWeek: (communeId: string) => ["admin", "posts-this-week", communeId] as const,
  homepageSections: (communeId: string) => ["admin", "homepage-sections", communeId] as const,
},
councilDocs: (communeId: string) => ["council-docs", communeId] as const,
```

Reuse existing keys: `queryKeys.audit(communeId)`, `queryKeys.commune(communeId)`, `queryKeys.posts.list/pinned`, `queryKeys.producers(communeId)`.

## Tag-based public-site invalidation

The public commune site (`/[commune-slug]/*`) is server-rendered with `revalidate = 3600`. Admin mutations that change visitor-facing data must bust that cache. Today they nuke everything via `revalidatePath("/", "layout")`. After P5b they tag and bust precisely:

```ts
// apps/web/src/lib/cached-fetchers/commune.ts (new)
import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export function getCommuneBySlugCached(slug: string) {
  return unstable_cache(
    async () => {
      const supabase = await createClient();
      const { data } = await supabase.from("communes").select("*").eq("slug", slug).single();
      return data;
    },
    ["commune-by-slug", slug],
    { tags: [`commune:${slug}`], revalidate: 3600 },
  )();
}
```

Mutation example (P5b):

```ts
// apps/web/src/app/admin/dashboard/theme-actions.ts (after P5b)
"use server";
import { revalidateTag } from "next/cache";
// ...
export async function saveTheme(...) {
  // ...DB write...
  revalidateTag(`commune:${slug}`);
  return { error: null };
}
```

Client side, the `<ThemeCustomizer>` component additionally calls `qc.invalidateQueries({ queryKey: queryKeys.commune(communeId) })` so the admin's own dashboard reflects the change without waiting for the next render.

## Out of scope

- **Optimistic updates** for approval clicks / theme save — deferred to P6.
- **`/[commune-slug]/*` client-side migration** — these pages stay SSR-first. Tag-based invalidation handles updates without needing React Query on the public side.
- **Audit log realtime** — refetch on tab switch (or 30s `staleTime` window) is sufficient. Adding `postgres_changes` subscription would be over-engineering for a tab moderators rarely sit on.
- **`/moderation` route** — separate from `/admin`, already client-side enough. Not in P5.
- **Mobile admin (`apps/mobile/...admin`)** — not in this phase. Mobile migration is its own roadmap (Phase 2 of the test suite spec).

## Cache strategy summary

| Query key | staleTime | Why |
|---|---|---|
| `commune(communeId)` | 30 min | Rarely changes; admin will manually refresh after own edits |
| `admin.pendingUsers/pendingProducers` | 1 min | Admin actively manages these — should feel current |
| `audit(communeId)` | 30 s | Updates often during moderation sessions |
| `admin.homepageSections`, `councilDocs` | 30 min | Static content |
| `admin.postsThisWeek` | 5 min (default) | Just a counter |
| `admin.members` | 5 min (default) | Slow churn |

## User-visible outcomes

- Dashboard loads instantly on return navigation within `staleTime` window (most common pattern).
- First visit shows page-shaped skeleton, then content fills.
- Approving a pending user/producer: row vanishes in ~80 ms (vs ~400 ms today, full page rerender).
- Editing commune contact/hours: form saves, dashboard reflects in ~100 ms; public site updates within 1–2 s for next visitor.
- Theme/color/logo change: admin pages update instantly; public site updates within 1–2 s. **No more "I changed my color but the site looks the same until I clear cache"** bug — this was the worst-felt regression hidden behind the `revalidatePath("/", "layout")` sledgehammer.

## Risks

- **`unstable_cache` + `revalidateTag` flakiness in Turbopack dev mode.** Recent Next 16 + Turbopack releases have had bugs where tags don't invalidate. **Mitigation:** Task 1 of P5a is a tiny smoke test (write a cached value, bust the tag, confirm fresh value on next read). If it fails, fall back to option A from the brainstorm (preserve `revalidatePath` only for theme-actions) and escalate.
- **File uploads in `council-actions.ts`.** Document upload happens before the DB row insert. Client invalidation must wait for both steps to complete; otherwise the React Query cache refetches and finds the new row without the file. **Mitigation:** the action returns only after both finish; the client only calls `invalidateQueries` after `await`.
- **Filter URL state for the posts tab.** The dashboard-client must read `searchParams` via `useSearchParams()` (client hook) rather than receiving them as props (server pattern), since the page now is mostly client. Filter changes must update the URL via `router.replace()` to keep deep-linking working.
- **Coordination cost.** P5b touches 8 mutation paths and many components; one missed invalidation = a stale row that confuses admins. **Mitigation:** the per-action-file table above is the checklist; spec reviewer in subagent-driven-development should verify each.

## Implementation handoff

After this spec is committed, the next step is `superpowers:writing-plans` to produce `docs/superpowers/plans/2026-04-18-p5a-admin-reads.md` and `docs/superpowers/plans/2026-04-18-p5b-admin-writes.md`. P5a ships first; P5b waits for it to merge.
