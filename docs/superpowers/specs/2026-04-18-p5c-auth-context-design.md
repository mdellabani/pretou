# P5c — AuthContext for session identity (Design)

**Date:** 2026-04-18
**Status:** Draft — pending review
**Scope:** Web app, authed routes (`/app/*`, `/admin/*`)
**Depends on:** P0–P5b shipped (React Query infra + admin migration)

## Context

After P5b, authed pages use a "thin server shell + React Query" pattern. Each navigation still runs the server component (`page.tsx`), which calls `supabase.auth.getUser()` + `getProfile(supabase, user.id)` before returning the client component. That's ~60ms of server work per navigation, visible as a skeleton flash even when the client cache is fully warm.

Root cause: **profile was migrated as volatile data** (React Query hook `useProfile()`), but it isn't. Profile is session-scoped identity — set at login, unchanged until logout. Treating it as a query forced a server round-trip on every navigation just to re-derive what the client already knows.

## Goals

- Eliminate the per-navigation server round-trip for authed routes. Navigation should feel instant when the client has warm state.
- Move session identity (`user`, `profile`) out of React Query and into a proper Context.
- Preserve the React Query cache for genuinely volatile data (feed, events, admin lists, etc.).
- Preserve the existing public-route SSR architecture (`/[commune-slug]/*`) and pillar 2 (`unstable_cache` + tags).

## Non-goals

- Supabase custom claims / JWT role encoding. Could eliminate the client-side role seam entirely but requires Supabase auth-hook config and a role-sync pipeline. Out of scope.
- Offline mode / localStorage persistence of profile. Refresh reloads profile from the session. Fine as-is.
- Redux / Zustand / Jotai. Plain React Context is sufficient for two fields (`user`, `profile`).
- Optimistic updates for mutations (separate phase — P6).

## Architecture

Two-layer split inside authed routes:

| Layer | Owner | Contents | Mutability |
|---|---|---|---|
| **Identity** | `AuthProvider` (React Context) | `user`, `profile` | Set on login; refreshed explicitly after self-profile mutations; cleared on logout |
| **Data** | React Query (unchanged) | feed posts, events, comments, admin lists, commune settings, etc. | Query-defined stale/refetch policies |

Routing:
- **Middleware** validates session cookie and redirects unauthed users away from `/app/*` and `/admin/*` to `/auth/login`. No profile fetch.
- **`page.tsx`** becomes a one-liner: return the client component (possibly wrapped in `<AdminGuard>` for admin routes). No server data fetching, no HydrationBoundary.
- **Client components** read `useAuth()` for identity and React Query hooks for data.
- **`AdminGuard`** (client wrapper) checks `useAuth().profile?.role === "admin"` and redirects non-admins. UX guard, not security (RLS still protects data).

## Components

### `apps/web/src/components/providers/auth-provider.tsx` (new)

Client component. Holds `{ user, profile, isLoading }`. Logic:

1. On mount: read session via `supabase.auth.getUser()`, then fetch profile row. Set state.
2. Subscribe to `supabase.auth.onAuthStateChange`. On `SIGNED_OUT`: clear state. On `TOKEN_REFRESHED`: no-op (user/profile unchanged).
3. Expose `refreshProfile()` for callers that mutate their own profile row.
4. Expose `signOut()` — wraps `supabase.auth.signOut()` and clears context.

Shape:

```ts
type AuthState = {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element;
export function useAuth(): AuthState;
```

### `apps/web/src/components/admin-guard.tsx` (new)

Tiny client wrapper that redirects non-admins to `/app/feed`. Used only for admin-scoped pages.

```tsx
export function AdminGuard({ children }: { children: ReactNode }) {
  const { profile, isLoading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!isLoading && profile?.role !== "admin") router.replace("/app/feed");
  }, [profile, isLoading, router]);
  if (isLoading || profile?.role !== "admin") return null;
  return <>{children}</>;
}
```

### `apps/web/src/hooks/use-profile.tsx` (deleted)

Replaced by `useAuth()` from `AuthProvider`. ~15 call sites renamed.

## Page-level changes

**Before** (`/admin/dashboard/page.tsx`, ~90 lines):
- `await supabase.auth.getUser()` + `getProfile(...)` + role redirect
- `prefetchAndDehydrate(async (qc) => { /* 8 parallel prefetches */ })`
- Return `<HydrationBoundary state={dehydratedState}><DashboardClient /></HydrationBoundary>`

**After** (~3 lines):

```tsx
export default function AdminDashboardPage() {
  return <AdminGuard><DashboardClient communeId={...} /></AdminGuard>;
}
```

Note: `communeId` currently comes from the server-side profile lookup. After P5c, `DashboardClient` reads it from `useAuth().profile.commune_id` instead of receiving it as a prop. Same pattern for every other authed page that needs a commune scope.

`/app/*` pages drop the `<AdminGuard>` wrapper — auth alone suffices.

Affected pages:

```
apps/web/src/app/app/
  feed/page.tsx
  evenements/page.tsx
  producteurs/page.tsx
  posts/[id]/page.tsx
  mon-espace/page.tsx
  infos-pratiques/page.tsx
  settings/page.tsx
apps/web/src/app/admin/
  dashboard/page.tsx
  homepage/page.tsx
```

## Layout changes

Both `apps/web/src/app/app/layout.tsx` and `apps/web/src/app/admin/layout.tsx` wrap children in `<AuthProvider>`, nested inside the existing `<QueryProvider>`. NavBar reads from `useAuth()` instead of `useProfile()`.

A note: if the current `layout.tsx` does its own `auth.getUser()` + profile lookup for the role guard, that goes away too. Layout becomes pure structure + providers.

## Middleware changes

Extend `apps/web/src/middleware.ts` to redirect unauthed users away from authed routes:

```ts
const AUTHED_PREFIXES = ["/app/", "/admin/"];
if (AUTHED_PREFIXES.some((p) => pathname.startsWith(p))) {
  const user = await getSessionUser(request);
  if (!user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/auth/login";
    redirectUrl.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(redirectUrl);
  }
}
```

No role check — that's handled client-side by `AdminGuard`. The middleware `getSessionUser` helper already exists.

## Data flow

### Login

1. User submits credentials at `/auth/login`
2. `supabase.auth.signInWithPassword` sets session cookie
3. Client-side redirect to `/app/feed` (or `/super-admin` for super-admin email)
4. `AuthProvider` mounts (first time user enters the authed tree), fetches profile, sets state
5. `FeedClient` mounts, reads `useAuth().profile.commune_id`, `useFeed(communeId)` fires
6. Profile and feed load in parallel; skeletons where needed; ~100ms to fully rendered

### Navigation (warm state)

1. User clicks link from `/app/feed` to `/admin/dashboard`
2. Middleware validates session cookie (~5–10ms, cookie-only — no DB)
3. `page.tsx` returns `<AdminGuard><DashboardClient /></AdminGuard>` immediately
4. Client receives RSC payload; `AdminGuard` runs, `useAuth()` returns already-loaded profile synchronously
5. `DashboardClient` renders; its hooks read from React Query cache synchronously
6. No skeleton flash, no refetch

### Logout

1. User clicks sign out → calls `useAuth().signOut()`
2. `AuthProvider` invokes `supabase.auth.signOut()`, clears `{ user, profile }` in state
3. Redirect to `/`
4. On next authed navigation, middleware redirects to `/auth/login`

### Session expiry mid-use

1. Supabase background refresh fails (e.g., server rotated keys)
2. `onAuthStateChange` fires `SIGNED_OUT`
3. AuthProvider clears state
4. Any component reading `useAuth()` sees `profile: null` — usually re-rendered as a skeleton or empty state
5. Next navigation hits middleware → redirect to login with `?next=` pointing back

## Error handling

- `supabase.auth.getUser()` network error on mount: AuthProvider stays `isLoading: true` and retries on next focus via `onAuthStateChange`. NavBar/feed show skeletons indefinitely until connectivity returns. No crash.
- Profile row missing for a valid session (rare — deleted profile but live JWT): AuthProvider sets `profile: null, isLoading: false`. `AdminGuard` redirects to `/app/feed`. `/app/feed` shows a "profile missing — contact support" error state (add a small `<NoProfile />` fallback).
- Profile update action fails: caller surfaces error; `refreshProfile()` not called; context stays as-is.

## Migration strategy

One-shot migration (all authed pages flip together). Partial migration (some pages on new model, some on old) creates confusion about where profile comes from and doubles the test surface.

Rough order inside the migration plan:

1. Add `AuthProvider`, `useAuth`, `AdminGuard`. Don't wire them up yet.
2. Update middleware (add authed-route gating). Ship + verify redirects work.
3. Wrap each authed layout in `<AuthProvider>`.
4. Convert each `page.tsx` one at a time (delete server auth/profile fetch, delete prefetch, return client component). Run component tests.
5. Rename `useProfile()` → `useAuth()` at call sites.
6. Delete `useProfile` hook, delete `prefetchAndDehydrate` calls that only existed for profile.
7. Delete now-unused `getProfile` server calls in pages (shared query stays — server-side callers still exist elsewhere if any).
8. Manual smoke: full auth flow + cross-segment navigation flash check.

## Testing

- **Component tests** (existing): `useProfile` mocks replaced by `useAuth` mocks. Same shape adjustment throughout.
- **New unit test**: `AuthProvider.test.tsx` — mount calls `getUser` + profile fetch; `onAuthStateChange` subscription; `refreshProfile` updates state; `signOut` clears state.
- **New integration test**: middleware redirects unauthed `/app/feed` request to `/auth/login`.
- **Manual smoke** (gating the merge):
  1. Log in → land on `/app/feed` → see feed
  2. Navigate `/app/feed` → `/admin/dashboard` → `/app/evenements` → `/app/feed` — no skeleton flash after first visit to each route
  3. Hard refresh on `/admin/dashboard` as non-admin → redirected to `/app/feed`
  4. Hard refresh on `/app/feed` signed out → redirected to `/auth/login?next=/app/feed`
  5. Sign out from anywhere → redirected to `/`, returning to `/app/feed` redirects to login

## Risks & mitigations

- **Brief admin-shell flash for non-admins typing `/admin/dashboard` directly** — acknowledged UX seam, not security. RLS protects data. Mitigation: AdminGuard returns `null` until profile resolves, so only the NavBar + empty layout chrome show briefly. If this becomes an issue, upgrade to Supabase custom claims + middleware role check later.
- **Profile stale after external update** (e.g., admin promoted someone to moderator, that user has an open session) — the affected user's context won't refresh until they sign out and back in, or trigger a mutation that calls `refreshProfile()`. Acceptable for v1 since role changes are rare and self-mutations (display_name, avatar) already refresh correctly. If complaints arise, add a Supabase Realtime subscription on the profile row.
- **Existing tests may reference `useProfile`** — catch during migration by typecheck + test run.
- **Public routes accidentally using `useAuth`** — public commune routes should never depend on auth. Lint rule or convention: don't import `useAuth` from `/[commune-slug]/*` files.

## Success criteria

1. Hard refresh on `/app/feed` → first full paint in ≤ 200ms
2. Navigation between authed routes (warm state) → no skeleton flash, page content visible within 50ms of click
3. `grep -r "getProfile" apps/web/src/app` returns no hits (or only in explicitly identified server fetchers that aren't on the nav hot path)
4. `grep -r "useProfile" apps/web/src` returns no hits after rename
5. Existing test suite passes after migration
6. Manual smoke checklist above passes
