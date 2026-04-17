# Bugfixes & Enhancements — April 2026

Five issues raised after the commune-onboarding launch. Each is independent and small; this single spec collects them so the implementation plan can sequence them efficiently. Every item has its own root-cause analysis and fix.

Order of implementation:

1. Bug #3 — Admin tab missing after approval
2. Bug #5 — Theme/gradient changes not applying on web
3. Bug #4 — Image rendering inconsistent in feed
4. Enhancement #2 — Sessions should never expire silently
5. Feature #1 — Public landing pages (web `/` + mobile welcome screen)
6. Bug #6 — Mobile PostHog never actually initializes (wiring gap)

The first two are grouped because they likely share a stale-client-state failure mode. #6 is a quick config fix bundled in because it surfaced while triaging the others.

---

## 1. Bug #3 — Admin tab missing, navbar shows "Ma Commune"

### Symptoms

After a commune is approved by super-admin, the admin user can log in but:

- The navbar header shows the placeholder "Ma Commune" instead of the registered commune name.
- The "Admin" link is not rendered.
- "Infos pratiques" and account-info pages correctly show the commune name and `role: admin`.
- Supabase admin UI confirms `role = 'admin'`, `status = 'active'`, valid `commune_id`.

### Root cause

Browser DevTools shows the client-side query from `apps/web/src/hooks/use-profile.tsx` returning **HTTP 406** from PostgREST:

```
/rest/v1/profiles?select=*,communes(...)&id=eq.<uuid>
```

`406` with `.single()` means the result set was 0 rows. The row exists, so RLS is filtering it out.

The only `SELECT` policy on `profiles` is (`supabase/migrations/001_initial_schema.sql:475`):

```sql
CREATE POLICY "Users can view profiles in own commune"
  ON profiles FOR SELECT TO authenticated
  USING (commune_id = auth_commune_id());
```

`auth_commune_id()` is `SECURITY DEFINER` but **does not set `search_path`** (line 20-24). Without an explicit search_path, a SECURITY DEFINER function called from RLS context can fail to resolve the `profiles` table reference and silently return `NULL`. When that happens, `commune_id = NULL` is never true and every row is filtered out — including the user's own.

The error is invisible to the app because `use-profile.tsx:46-51` does not destructure `error`, so the failure becomes "profile is null" with no log.

### Fix

Three changes, all small and additive.

**a. Add an explicit self-read policy** in `supabase/migrations/001_initial_schema.sql`:

```sql
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT TO authenticated USING (id = auth.uid());
```

This guarantees self-read works regardless of helper-function health. The existing commune-scoped policy stays in place for reads of *other* members.

**b. Harden every `SECURITY DEFINER` function** in the same migration with:

```sql
SET search_path = public, pg_temp
```

Affected functions: `auth_commune_id()`, `is_approved()`, `is_commune_admin()`, `is_commune_moderator()`, `check_report_threshold()`. Add the `SET` clause to each `CREATE OR REPLACE FUNCTION`.

**c. Surface silent failures** in `apps/web/src/hooks/use-profile.tsx`: destructure `error` from the supabase response, and `console.error` it on failure so this class of bug is visible immediately next time.

### Deployment

Pre-launch — single consolidated migration. Update `001_initial_schema.sql`, run `npx supabase db reset` locally, then re-deploy migration to the Supabase project (demo + prod).

### Verification

- Log in as the approved admin user → navbar shows commune name + Admin link.
- DevTools Network: `/rest/v1/profiles` returns 200 with one row.
- Re-run the same query while signed in as a resident of a different commune → that commune's profile is correctly inaccessible (commune-scoped policy still works).

---

## 2. Bug #5 — Theme / gradient color changes don't apply on web

### Symptoms

Admin changes commune theme color (or gradient) in the admin panel; save succeeds; the web UI continues to show the old colors. (Mobile not yet verified.)

### Investigation needed before final design

This bug is suspected to share root cause family with #1: the client-side `useProfile` context loads the commune theme once on mount and never refetches. After saving theme changes, the admin form likely returns success but the navbar / `theme-injector` keeps the old CSS variables until full page reload.

Steps before designing the fix:

1. Verify the admin "save theme" action actually persists to `communes.theme` / `custom_primary_color` columns (read DB after save).
2. Check `apps/web/src/components/theme-injector.tsx` and `theme-provider.tsx` to see how CSS variables are derived and when they re-render.
3. Determine whether the issue is (a) DB write missing, (b) `useProfile` cache not invalidated, (c) CSS variables computed only on first render, or (d) Next.js cache (`router.refresh()` not called).

### Likely fix shape

Most probable cause is (b)+(d): after the admin save action completes, the page should call `router.refresh()` and the `ProfileProvider` should refetch. A minimal fix is to expose a `refresh()` method on the profile context and call it from the theme-save form's success handler. If the CSS variables are only injected on first mount, the injector also needs to react to profile changes.

Final root cause and exact fix to be confirmed during implementation; if investigation finds a different cause, this section is updated before code changes.

### Verification

- Change primary color → save → navbar gradient updates without page reload.
- Reload page → new color persists.
- Change color back → reverts cleanly.

---

## 3. Bug #4 — Image rendering inconsistent in feed

### Symptoms

In the web feed, posts with an image render differently from posts without:

- Image takes full card width with a fixed `h-48` (192px) regardless of source aspect ratio.
- Thumbnail looks broken (likely crop or missing transform).
- Cards with vs without images have visually inconsistent rhythm.

### Root cause

`apps/web/src/components/post-card.tsx:42-52`:

```tsx
{post.post_images && post.post_images.length > 0 && (
  <div className="relative w-full h-48 bg-gray-200">
    <Image
      src={getImageUrl(post.post_images[0].storage_path)}
      alt="Post image"
      fill
      className="object-cover"
      sizes="(max-width: 768px) 100vw, 600px"
    />
  </div>
)}
```

Issues:

- `w-full h-48` forces a 16:6-ish hard crop irrespective of the source.
- No Supabase image transform is requested, so the full original is downloaded for every thumbnail.
- The card has no consistent media slot — image cards feel "top-heavy" while text cards stay compact.

### Fix

Make image rendering a small, consistent **thumbnail slot** — not a hero image — so cards stay homogeneous:

1. Render the image as a **square thumbnail (~96×96 px)** in the top-left of the card body, with the title/badge/body text wrapping to its right. Same vertical rhythm as text-only cards.
2. Use Supabase image transforms in `getImageUrl()` to fetch a 192×192 (2x) thumbnail: `?width=192&height=192&resize=cover`. Verifies/fixes the "broken thumbnail" symptom by ensuring the URL Supabase returns is actually a small image.
3. Add the Supabase storage URL to `next.config.js` `images.remotePatterns` if not already present (a missing remote pattern is a common cause of next/image showing broken thumbnails).
4. Mobile: confirm `apps/mobile` post-card mirrors the same thumbnail-slot layout. (Likely needs the same change; verify before edit.)

Detail layout (post-detail page) keeps the larger inline image — only the *card* in the feed becomes a thumbnail.

### Verification

- Feed renders posts with and without images at consistent height.
- Thumbnail loads as small image (check Network panel — should be a few KB, not the original).
- Mobile feed: same layout pattern.

---

## 4. Enhancement #2 — Sessions never expire silently

### Symptoms / desired behavior

User: *"I don't want users to be logged out unless they do it themselves; on logout, return to login screen."*

Current behavior: when the Supabase session refresh-token expires (default 60 days inactivity), the next request redirects to `/auth/login` mid-session — looks like an unexplained logout.

### Design

Two parts: server-side configuration and client-side resilience.

**a. Supabase project settings** (no code change — set in Supabase dashboard for both demo and prod projects):

- **Refresh token reuse interval**: 10 seconds (default).
- **Refresh token rotation**: enabled (default — security).
- **Inactivity timeout**: **disabled** (or set to maximum). This is the setting that currently logs users out after a period of no activity.
- **JWT expiry**: keep at 1 hour (default — short JWT, long refresh chain).

The combination of long-lived refresh tokens with rotation gives "stay logged in forever" semantics while preserving security.

**b. Client-side**: Supabase JS already auto-refreshes tokens via `onAuthStateChange`. Currently `apps/web/src/lib/supabase/middleware.ts` just calls `getUser()` and redirects on null. Improvements:

- In middleware, when `getUser()` fails because the refresh token is genuinely invalid, attempt one explicit `refreshSession()` first; only redirect on confirmed failure.
- Confirm `apps/web/src/lib/supabase/client.ts` is created with `auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }` (the defaults — verify no override).
- On manual logout (`handleLogout` in `nav-bar.tsx`), explicit redirect to `/auth/login` is already in place — keep it.

### Verification

- Set Supabase JWT expiry temporarily to 1 minute, leave session idle past expiry, navigate → should refresh transparently and stay logged in.
- Click logout → land on `/auth/login`.
- Manually clear refresh token cookie → next nav redirects to login (genuine invalid session).

---

## 5. Feature #1 — Public landing pages (web `/` + mobile welcome screen)

Two distinct surfaces, same spirit: introduce the product to first-time visitors and route them to the right next step. They share visual language and copy direction but live in different apps and target slightly different audiences.

### 5a. Web landing page at `/`

#### Current state

`apps/web/src/app/page.tsx` is the Forge scaffold default — a placeholder. The platform has no public landing page; visitors to the platform domain see no positioning, no CTA, no product information.

#### Audience and goal

Two distinct visitor types arriving at the platform domain (e.g. `app.example.fr`):

1. **Mairie secretary / elected official** — heard about the platform, needs to understand what it offers and how to register their commune. Primary CTA: **"Inscrire ma commune"** → `/auth/register-commune`.
2. **Resident** — heard about it from their commune, wants to find their commune's site or download the mobile app. Primary CTA: **"Trouver ma commune"** → search/list, plus App Store / Play Store badges.

#### Page sections (top to bottom)

1. **Hero** — name, one-line proposition (e.g. *"L'application qui rapproche votre commune et ses habitants"*), two CTAs side by side (Inscrire ma commune / Trouver ma commune).
2. **Why** — three short value props for mairies (gain de temps, communication moderne, gratuit / faible coût) and three for residents (annonces officielles, entraide, agenda local).
3. **Screenshots** — mobile + web, two or three frames.
4. **How it works** — 3-step path for a mairie (s'inscrire → être validé → publier) and a 2-step path for residents (télécharger → rejoindre la commune avec le code).
5. **Existing communes** — small grid/list of communes already on the platform (links to their public sites). Builds trust.
6. **Footer** — legal (mentions légales, RGPD), contact, social.

Language: French throughout.

#### Tech approach

- New route: `apps/web/src/app/page.tsx` (replace scaffold).
- Reuse existing UI components and theme tokens — no new dependency.
- SSG: page is statically rendered with revalidation (commune list is the only dynamic part — daily revalidate is enough).
- Mobile-first; the page must look great on a phone since many mairies will share the URL via WhatsApp/SMS.
- SEO: descriptive `<title>`, meta description, OpenGraph image (existing favicon + asset), `sitemap.ts` includes `/`.

#### What this page is NOT

- Not a marketing site with blog, pricing tables, comparison matrix, demo videos, lead-capture forms. YAGNI — start with one scrollable page.
- Not a duplicate of per-commune public sites (which live at `/[commune-slug]`).

#### Verification

- Visit `/` logged out → see the landing page.
- Visit `/` logged in → either show landing page (preferred — let admins access it) or redirect to `/app/feed`. Decide during implementation; recommend showing landing page so admins can preview what visitors see.
- Click both CTAs → land on registration and a working "find my commune" affordance respectively.
- Lighthouse on mobile: green performance/accessibility/SEO.

### 5b. Mobile welcome screen

#### Current state

The mobile app (`apps/mobile/src/app/`) has only `auth/login` and `auth/signup` under the auth group. First-launch users with no session are dropped directly onto a login form — no context about what the app is, no path for someone who doesn't yet have a commune invite code.

#### Audience and goal

Mobile is the **resident** surface (mairie secretaries onboard via web). The welcome screen targets:

1. **A new resident with an invite code from their commune** — primary path. CTA: **"J'ai un code d'invitation"** → `auth/signup`.
2. **A returning user** — already has an account. CTA: **"Se connecter"** → `auth/login`.
3. **Curious visitor without a commune yet** — needs a "what is this?" answer and a way to check whether their commune is on the platform. CTA: **"Découvrir l'app"** → short info modal/scroll, plus a link "Je suis élu(e), inscrire ma commune" that opens the web register URL in the system browser.

#### Screen layout

Single screen, vertically scrollable on small devices, hero-only on tall ones:

1. **Logo + name** at the top.
2. **Hero illustration** (full-width, decorative — reuse an existing asset or a simple SVG/gradient if no illustration exists yet).
3. **One-line proposition** (same copy direction as web hero).
4. **Three condensed value bullets** (annonces de la mairie · agenda local · entraide entre voisins).
5. **Primary CTA**: "J'ai un code d'invitation" — large, full-width.
6. **Secondary CTA**: "Se connecter" — text link below.
7. **Tertiary link**: "Je suis élu(e), inscrire ma commune" — opens web URL in browser.

Language: French.

#### Tech approach

- New route: `apps/mobile/src/app/auth/welcome.tsx` (Expo Router).
- Update `apps/mobile/src/app/_layout.tsx` (or wherever the unauthenticated initial route is set) so signed-out users land on `auth/welcome` instead of `auth/login`.
- Update `auth/login.tsx` and `auth/signup.tsx` to provide a back-link to welcome.
- Use `expo-linking` / `Linking.openURL()` for the "register a commune" external link.
- Use existing theme constants and component primitives — no new dependency.
- No analytics events beyond what PostHog already auto-captures on screen view.

#### What this screen is NOT

- Not an onboarding carousel (no swipeable intro slides — adds friction for returning users).
- Not a commune-search interface (deferred — residents almost always have an invite code from their mairie).
- Not a different layout per platform (iOS/Android share the same screen).

#### Verification

- Cold-launch mobile app with no session → land on welcome screen.
- Tap "Se connecter" → login form, can return to welcome via back.
- Tap "J'ai un code d'invitation" → signup form.
- Tap "Inscrire ma commune" → opens platform domain `/auth/register-commune` in system browser.
- Sign in successfully → land on tabs feed; logout → returns to welcome (not directly to login).
- Re-launch with valid session → bypasses welcome, goes straight to tabs.

---

## 6. Bug #6 — Mobile PostHog never actually initializes

### Symptoms

Mobile app appears to have PostHog wired up (`apps/mobile/.env.example` documents `EXPO_PUBLIC_POSTHOG_KEY` / `EXPO_PUBLIC_POSTHOG_HOST`, and `posthog-react-native` is imported), but no events ever reach PostHog. The provider always returns its children unchanged.

### Root cause

`apps/mobile/src/lib/posthog.tsx` reads the key from `Constants.expoConfig?.extra?.posthogKey`:

```ts
const POSTHOG_KEY = Constants.expoConfig?.extra?.posthogKey ?? "";
```

But `apps/mobile/app.config.ts` `extra` block only contains `eas.projectId` — there is no `posthogKey` or `posthogHost` field. The env var is set in `.env`, but nothing maps it into `extra`, so the lookup always resolves to `""` and the provider no-ops.

### Fix

In `apps/mobile/app.config.ts`, expose the env vars through `extra`:

```ts
extra: {
  eas: { projectId: "7618b9c8-3d4d-4bc8-b7df-e2e18cf25b70" },
  posthogKey: process.env.EXPO_PUBLIC_POSTHOG_KEY,
  posthogHost: process.env.EXPO_PUBLIC_POSTHOG_HOST,
},
```

Notes:

- `EXPO_PUBLIC_*` vars are inlined at build time, so EAS profile env vars (per `eas.json`) drive what each build picks up.
- Disabling PostHog per environment is then exactly the same as web: leave the env var unset for that EAS profile (e.g. demo) and rebuild.
- Verify both env-vars are present in `apps/mobile/.env.example` (already true) and document the disable behavior in the deployment guide if not already there.

### Verification

- Build mobile with `EXPO_PUBLIC_POSTHOG_KEY` set → open the app → confirm an event appears in PostHog within ~30 seconds.
- Build mobile with the var unset → confirm no events appear and no network calls go to `*.posthog.com`.

---

## Out of scope

- Theme color picker UX redesign — only fix that saved values apply.
- Image upload pipeline rewrite — only fix the rendering/transform part.
- Custom landing page per commune — that's the existing `/[commune-slug]` route.
- Auth flow rewrite (magic links, social login) — only stop silent logouts.
