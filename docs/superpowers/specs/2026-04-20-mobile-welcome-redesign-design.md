# Mobile Welcome Screen Redesign — Design

**Date:** 2026-04-20
**Status:** Spec
**Scope:** `apps/mobile/src/app/auth/welcome.tsx` — the signed-out entry screen

## Context

The mobile welcome screen (what a signed-out user sees on app open) has not been updated since it was shipped with the basic v1 onboarding. Meanwhile the web landing (`apps/web/src/app/page.tsx`) has grown into a full marketing page with hero, how-it-works, for-residents, for-mairies, communes grid, FAQ, and footer sections. The two surfaces now feel like they belong to different products: same brand, very different pitch.

Current mobile welcome:
- Muted cream/brown palette, no brand accents
- 3-bullet hero, 3 stacked buttons, single-screen
- "Inscrire ma commune" is a small underlined link

This spec redesigns the screen to match the brand identity established on the web and to serve the three audiences that actually land on it.

## Goals

- Visual consistency with the web landing (same palette, same brand voice)
- Primary action (invite-code flow) reachable without scrolling
- Enough context below the fold for non-invited users (curious residents, élus evaluating) to understand the product
- Ship in one PR, no new infra, no new dependencies

## Non-goals

- Native mobile signup flow for élus — the "Inscrire ma mairie" CTA continues to deep-link to the web registration form
- Screenshots/illustrations in v1 — copy deck stays text-only; images can come as a follow-up
- FAQ section — defer, not worth the scroll length on mobile
- `CommunesGrid` equivalent — residents know their commune; the grid is web-only marketing
- i18n refactor — strings stay inline, matching the existing mobile pattern
- Animation polish beyond default expo-router transitions
- Mobile test infrastructure — mobile has no tests today (Phase 2 roadmap); testing for this screen is best-effort, not blocking

## Audiences served (decided)

All three audiences share the screen. Visual hierarchy is resident-first:

1. **Residents of onboarded communes** (primary) — have an invite code, need to log in or redeem it
2. **Residents of non-onboarded communes** (secondary) — downloaded the app out of curiosity; need to understand what the product is so they can ask their mairie to sign up
3. **Élus evaluating the platform** (tertiary) — rare on mobile (will mostly evaluate from desktop), but supported via deep-link to web signup

## Architecture decisions

1. **Single file, no component extraction.** `welcome.tsx` hosts 4 local helper components (`Hero`, `HowItWorks`, `ForResidents`, `EluBlock`). Extraction into `components/landing/` deferred until a second surface needs them.
2. **Web-aligned palette.** Cream `#FBF7F1` background, dark brown `#2a1a14` text, red/orange accent gradient `#BF3328 → #D35230 → #E49035`, card borders `#f0e0d0`. Matches `apps/web/src/components/landing/*`.
3. **Short scroll, not single-screen.** Hero + primary CTA above the fold; how-it-works and residents blocks unfold below for anyone who scrolls. Total ~2 phone screens.
4. **Deep-link retained for élu signup.** `Linking.openURL(${WEB_URL}/auth/register-commune)` — same behavior as today; just relocated to a softer gradient card at the bottom.

## Screen structure

ScrollView with four vertical sections:

### 1. Hero (above the fold)

- Brand pill: `🌾 Pour les communes rurales` (rounded, white/transparent bg, red text, thin red border)
- Two-line headline:
  - Line 1: `Le village dans votre poche.` (solid dark brown)
  - Line 2: `La mairie en direct.` (rendered with a gradient text effect — RN handles this via `MaskedView` + `LinearGradient`, or falls back to solid `#D35230` if that proves fragile)
- Supporting sentence: `Annonces, événements, entraide — une app simple, connectée à votre mairie.`
- Primary CTA: `J'ai un code d'invitation` — dark filled button (`#2a1a14` background, white text)
- Secondary CTA: `Se connecter` — white bg, red outline, red text
- Microcopy: `Démarrage immédiat · Sans engagement`
- Soft radial gradient blur in the top-right corner for warmth (RN approximation via `LinearGradient` or a static `<View>` with opacity — pixel-perfect blur is not required)

Above-the-fold height target: ≤ 640pt on standard iPhone to ensure primary CTA is visible without scroll.

### 2. How it works

- Section heading: `Une publication. Trois destinations.` (two-line; second line in `#D35230`)
- Sub-copy: `La mairie publie une fois — tout est à jour.`
- Three stacked cards (white/cream bg, `#f0e0d0` border), each with:
  - Colored badge pill: Mairie (`#BF3328`) / Résidents (`#D35230`) / Site public (`#E49035`)
  - Short step title
  - One-line body

### 3. Pour les résidents

- Small pill label: `Pour les résidents` (red, uppercase)
- Heading: `Tout ce qui se passe au village, au creux de la main.` (two-line; second line in `#D35230`)
- Three cards, each with emoji + title + one-line body:
  - 📰 Le fil du village — `Annonces, événements, entraide.`
  - 🗓️ Événements & RSVP — `Confirmez votre présence en un clic.`
  - 🥕 Producteurs locaux — `Annuaire des producteurs de la commune.`

### 4. Élu block (tertiary CTA)

- Soft gradient card (`#FDF0EB → #FBF7F1`), `#f0e0d0` border
- Heading: `Vous êtes élu(e) ?`
- Sub-copy: `Inscrivez votre commune sur la plateforme.`
- Single CTA link: `Inscrire ma mairie →` (red, underlined) → `Linking.openURL(${WEB_URL}/auth/register-commune)`
- Footer line below card: `Hébergé en France · Sans engagement`

## Navigation

Unchanged from current behavior:

| Action | Route |
|---|---|
| "J'ai un code d'invitation" | `router.push("/auth/signup")` |
| "Se connecter" | `router.push("/auth/login")` |
| "Inscrire ma mairie" | `Linking.openURL(${WEB_URL}/auth/register-commune)` |

`WEB_URL` reads from `process.env.EXPO_PUBLIC_WEB_URL` with the same fallback already in the file.

## Data flow

None. The screen is fully static — hard-coded French strings, color constants declared at the top of the file. No Supabase calls, no context reads, no state beyond what the existing screen has (i.e., nothing).

## Error handling

The only failure path is `Linking.openURL`. The current screen does not handle its rejection, and we keep that behavior — a failed deep-link leaves the user on the welcome screen, which is acceptable for this edge case.

## Dependencies

No new packages. Uses existing:
- `expo-router` (already imported for `useRouter`)
- `expo-linear-gradient` (already a dep — used elsewhere in the app e.g. `feed.tsx`)
- `react-native` primitives
- `@expo-google-fonts/dm-sans` (already wired in `_layout.tsx`)

For the gradient text on line 2 of the hero, we'll try `@react-native-masked-view/masked-view` + `expo-linear-gradient`. If `masked-view` is not already installed, we fall back to a solid `#D35230` color — the spec prefers simplicity over a one-off dependency. The decision happens at implementation time based on what's already in `node_modules`.

## Testing

Mobile has no test infrastructure today (Phase 2 of the test suite roadmap covers this and is not started). Given that, testing for this screen is best-effort:

- **Manual smoke test** on iOS simulator + Android emulator: scroll reaches the bottom, all 3 CTAs navigate correctly, `Linking.openURL` opens the mobile browser to the web signup.
- **No automated tests are added** by this spec. When Phase 2 lands, a welcome smoke test can be added as one of the first mobile tests.

## Rollout

- Single PR, no feature flag.
- Pre-auth surface — no user data touched, no RLS implications.
- Visual-only change; no schema, no backend, no env vars.

## File changes summary

| File | Change |
|---|---|
| `apps/mobile/src/app/auth/welcome.tsx` | Rewrite: replace current minimal layout with the 4-section hero + how-it-works + residents + élu structure described above |

No other files change.

## Out of scope / follow-ups

- **Screenshots in cards** — copy `apps/web/public/landing/*.png` into mobile assets and wire into the 3 residents cards. ~1h follow-up PR.
- **FAQ section** — skipped; revisit if analytics show élus bouncing without converting.
- **Native élu signup flow** — reconsider once we have adoption signal that the deep-link is a real blocker.
- **Mobile tests** — Phase 2 of the test-suite roadmap; this screen will be one of the first covered.
