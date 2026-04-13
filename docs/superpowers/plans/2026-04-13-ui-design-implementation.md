# UI Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the UI design system to all 3 surfaces (mobile app, web admin panel, public commune website) — theme system with 8 regional palettes, DM Sans typography, Lucide + Phosphor icons, and the visual design validated in mockups.

**Architecture:** Theme config lives in `packages/shared` (pure data, no UI). Each app reads the commune's theme slug from the database and resolves colors from the shared config map. Web uses CSS custom properties derived from theme. Mobile uses a React context providing theme colors. Database gets new columns for theme, motto, hero image, blason, description, and infos pratiques.

**Tech Stack:** DM Sans (Google Fonts / expo-font), Lucide React / lucide-react-native, @phosphor-icons/react (web) / phosphor-react-native (mobile), Tailwind CSS custom properties (web), React Native StyleSheet (mobile)

**Spec:** `docs/superpowers/specs/2026-04-13-ui-design-system.md`

---

## Phase 1: Foundation

### Task 1: Theme Config in Shared Package

**Files:**
- Create: `packages/shared/src/constants/themes.ts`
- Modify: `packages/shared/src/constants/index.ts`
- Modify: `packages/shared/src/types/commune.ts`

- [ ] **Step 1: Create theme config**

Create `packages/shared/src/constants/themes.ts`:
```typescript
export type ThemeSlug =
  | "terre_doc"
  | "provence"
  | "atlantique"
  | "alpin"
  | "ble_dore"
  | "corse"
  | "champagne"
  | "ardoise";

export type ThemeConfig = {
  name: string;
  region: string;
  gradient: [string, string, string]; // 3-stop header gradient
  primary: string;
  background: string;
  muted: string;
  pinBg: string; // tinted background for "Épinglé" label
};

export const THEMES: Record<ThemeSlug, ThemeConfig> = {
  terre_doc: {
    name: "Terre d'Oc",
    region: "Sud-Ouest",
    gradient: ["#BF3328", "#D35230", "#E49035"],
    primary: "#D35230",
    background: "#FBF7F1",
    muted: "#BBA98E",
    pinBg: "#FDF0EB",
  },
  provence: {
    name: "Provence",
    region: "Sud-Est",
    gradient: ["#6B3FA0", "#8B5DC8", "#A87DDC"],
    primary: "#6B3FA0",
    background: "#F8F4FB",
    muted: "#B0A3C4",
    pinBg: "#F0E8F8",
  },
  atlantique: {
    name: "Atlantique",
    region: "Bretagne / Ouest",
    gradient: ["#1A5276", "#217DAB", "#2E9BC6"],
    primary: "#1A5276",
    background: "#F2F7F9",
    muted: "#90AEBB",
    pinBg: "#E4F0F6",
  },
  alpin: {
    name: "Alpin",
    region: "Rhône-Alpes",
    gradient: ["#1B5E3B", "#28804E", "#3AA66A"],
    primary: "#1B5E3B",
    background: "#F2F7F3",
    muted: "#8EAE96",
    pinBg: "#E4F2E8",
  },
  ble_dore: {
    name: "Blé Doré",
    region: "Centre",
    gradient: ["#C8900A", "#E2A80E", "#F0C030"],
    primary: "#C8900A",
    background: "#FFFCF0",
    muted: "#B0A46A",
    pinBg: "#FFF6D6",
  },
  corse: {
    name: "Corse",
    region: "Île de Beauté",
    gradient: ["#A03018", "#C04428", "#DA6030"],
    primary: "#A03018",
    background: "#FDF5EF",
    muted: "#C08A74",
    pinBg: "#FDECE6",
  },
  champagne: {
    name: "Champagne",
    region: "Nord-Est",
    gradient: ["#B83070", "#D44888", "#E868A4"],
    primary: "#B83070",
    background: "#FEF5F7",
    muted: "#C890A8",
    pinBg: "#FDE8F2",
  },
  ardoise: {
    name: "Ardoise",
    region: "Normandie / Nord",
    gradient: ["#2C4A6E", "#3D6490", "#5080B0"],
    primary: "#2C4A6E",
    background: "#F0F4F8",
    muted: "#88A0B8",
    pinBg: "#E0EAF4",
  },
};

export const DEFAULT_THEME: ThemeSlug = "terre_doc";

export function getTheme(slug: string | null | undefined): ThemeConfig {
  if (slug && slug in THEMES) return THEMES[slug as ThemeSlug];
  return THEMES[DEFAULT_THEME];
}
```

- [ ] **Step 2: Update constants index**

Add to `packages/shared/src/constants/index.ts`:
```typescript
export { THEMES, DEFAULT_THEME, getTheme } from "./themes";
export type { ThemeSlug, ThemeConfig } from "./themes";
```

- [ ] **Step 3: Update commune type**

Add to `packages/shared/src/types/commune.ts` — extend the Commune type comment to note the new columns. The generated `database.ts` will pick them up after migration, but we add the ThemeSlug import for typed usage:
```typescript
import type { Database } from "./database";
import type { ThemeSlug } from "../constants/themes";

export type Commune = Database["public"]["Tables"]["communes"]["Row"];
export type EPCI = Database["public"]["Tables"]["epci"]["Row"];

// Extended commune type with new design fields
export type CommuneWithDesign = Commune & {
  theme: ThemeSlug;
  motto: string | null;
  hero_image_url: string | null;
  description: string | null;
  blason_url: string | null;
  infos_pratiques: Record<string, string>;
};
```

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/constants/themes.ts packages/shared/src/constants/index.ts packages/shared/src/types/commune.ts
git commit -m "feat(shared): add theme system with 8 regional palettes"
```

---

### Task 2: Database Migration for Design Fields

**Files:**
- Create: `supabase/migrations/002_design_fields.sql`
- Modify: `supabase/seed.sql`

- [ ] **Step 1: Create migration**

Create `supabase/migrations/002_design_fields.sql`:
```sql
-- Theme and design customization fields for communes
ALTER TABLE communes ADD COLUMN theme TEXT NOT NULL DEFAULT 'terre_doc'
  CHECK (theme IN ('terre_doc', 'provence', 'atlantique', 'alpin', 'ble_dore', 'corse', 'champagne', 'ardoise'));

ALTER TABLE communes ADD COLUMN motto TEXT;
ALTER TABLE communes ADD COLUMN hero_image_url TEXT;
ALTER TABLE communes ADD COLUMN description TEXT;
ALTER TABLE communes ADD COLUMN blason_url TEXT;
ALTER TABLE communes ADD COLUMN infos_pratiques JSONB DEFAULT '{}';

-- Allow anon users to read design fields for public website
-- (commune SELECT policies already allow anon, no changes needed)
```

- [ ] **Step 2: Update seed data**

Update `supabase/seed.sql` to include design fields:
```sql
-- Seed EPCI
INSERT INTO epci (id, name) VALUES
  ('00000000-0000-0000-0000-000000000001', 'CC du Pays de Test');

-- Seed communes with design fields
INSERT INTO communes (id, epci_id, name, slug, code_postal, invite_code, theme, motto, description) VALUES
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'Saint-Test-le-Petit', 'saint-test-le-petit', '12345', 'test01', 'terre_doc', 'Vivre ensemble, simplement', 'Saint-Test-le-Petit est un village de 350 habitants niché dans les collines du Béarn, entre vallées verdoyantes et traditions vivantes.'),
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'Testville-sur-Cher', 'testville-sur-cher', '12346', 'test02', 'atlantique', 'Penn ar bed', 'Testville-sur-Cher est une commune de 800 habitants au bord du Cher, connue pour son marché du dimanche et son église romane.');
```

- [ ] **Step 3: Apply migration and regenerate types**

Run:
```bash
npx supabase db reset
npx supabase gen types typescript --local > packages/shared/src/types/database.ts
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/002_design_fields.sql supabase/seed.sql packages/shared/src/types/database.ts
git commit -m "feat(db): add theme, motto, hero image, blason, description, infos pratiques to communes"
```

---

### Task 3: Install Design Dependencies

**Files:**
- Modify: `apps/web/package.json` (via pnpm add)
- Modify: `apps/mobile/package.json` (via pnpm add)

- [ ] **Step 1: Install web dependencies**

```bash
pnpm add @phosphor-icons/react -F @rural-community-platform/web
```

Note: `lucide-react` and `@google/fonts` (DM Sans via next/font) are already available. DM Sans will be loaded via `next/font/google` in the root layout.

- [ ] **Step 2: Install mobile dependencies**

```bash
pnpm add phosphor-react-native expo-font lucide-react-native react-native-svg -F @rural-community-platform/mobile
```

Note: `react-native-svg` is required by both `lucide-react-native` and `phosphor-react-native`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json apps/mobile/package.json pnpm-lock.yaml
git commit -m "chore: add Phosphor icons, Lucide native, DM Sans font dependencies"
```

---

## Phase 2: Web App Reskin

### Task 4: Web Global Styles & Font

**Files:**
- Modify: `apps/web/src/app/globals.css`
- Modify: `apps/web/src/app/layout.tsx`

- [ ] **Step 1: Replace globals.css**

Replace `apps/web/src/app/globals.css` with a version that:
- Keeps the Tailwind imports and CSS variable structure
- Changes the `:root` color values to match the "Terre d'Oc" defaults (warm cream background, warm text colors)
- Adds CSS custom properties for theme colors: `--theme-primary`, `--theme-gradient-1`, `--theme-gradient-2`, `--theme-gradient-3`, `--theme-background`, `--theme-muted`, `--theme-pin-bg`
- Removes the `.dark` theme entirely (spec says no dark mode)
- Sets `--font-sans` to DM Sans

The actual theme values will be injected at runtime via a `<style>` tag in the layout based on the commune's theme.

- [ ] **Step 2: Update root layout**

Modify `apps/web/src/app/layout.tsx`:
- Import DM Sans from `next/font/google` instead of Geist
- Apply DM Sans to the body
- Remove the ThemeProvider (no dark mode)
- Remove Geist font imports

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/globals.css apps/web/src/app/layout.tsx
git commit -m "feat(web): switch to DM Sans font, warm color defaults, remove dark mode"
```

---

### Task 5: Web Theme Provider (Commune-Aware)

**Files:**
- Create: `apps/web/src/components/theme-injector.tsx`
- Create: `apps/web/src/hooks/use-commune-theme.ts`

- [ ] **Step 1: Create theme injector**

Create `apps/web/src/components/theme-injector.tsx`:

A server component that takes a theme slug and injects CSS custom properties via a `<style>` tag. Used in layouts that know which commune is being viewed.

```typescript
import { getTheme } from "@rural-community-platform/shared";
import type { ThemeSlug } from "@rural-community-platform/shared";

export function ThemeInjector({ theme }: { theme?: string | null }) {
  const t = getTheme(theme);
  return (
    <style dangerouslySetInnerHTML={{ __html: `
      :root {
        --theme-primary: ${t.primary};
        --theme-gradient-1: ${t.gradient[0]};
        --theme-gradient-2: ${t.gradient[1]};
        --theme-gradient-3: ${t.gradient[2]};
        --theme-background: ${t.background};
        --theme-muted: ${t.muted};
        --theme-pin-bg: ${t.pinBg};
      }
    `}} />
  );
}
```

- [ ] **Step 2: Create commune theme hook**

Create `apps/web/src/hooks/use-commune-theme.ts`:

Client-side hook that reads CSS custom properties for components that need theme colors in JS:

```typescript
"use client";

export function useCommuneTheme() {
  if (typeof window === "undefined") return null;
  const styles = getComputedStyle(document.documentElement);
  return {
    primary: styles.getPropertyValue("--theme-primary").trim(),
    gradient1: styles.getPropertyValue("--theme-gradient-1").trim(),
    gradient2: styles.getPropertyValue("--theme-gradient-2").trim(),
    gradient3: styles.getPropertyValue("--theme-gradient-3").trim(),
    background: styles.getPropertyValue("--theme-background").trim(),
    muted: styles.getPropertyValue("--theme-muted").trim(),
    pinBg: styles.getPropertyValue("--theme-pin-bg").trim(),
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/theme-injector.tsx apps/web/src/hooks/use-commune-theme.ts
git commit -m "feat(web): add theme injector and commune theme hook"
```

---

### Task 6: Web Nav Bar Redesign

**Files:**
- Modify: `apps/web/src/components/nav-bar.tsx`

- [ ] **Step 1: Redesign nav bar**

Replace `apps/web/src/components/nav-bar.tsx` with a themed version:
- Gradient header background using CSS custom properties (`--theme-gradient-1/2/3`)
- Commune name in white, DM Sans 600
- Département/code postal underneath in white at 65% opacity
- Motto in frosted pill if available
- Navigation links (Fil, Admin if admin) in white with opacity
- User avatar initials + name on right
- Logout button
- Decorative subtle circles (pseudo-elements, `rgba(255,255,255,0.06)`)

The nav bar needs the commune's profile data (name, code_postal, motto, theme). Use the existing `useProfile()` hook which already loads commune data, and extend it to include the new fields.

- [ ] **Step 2: Update use-profile hook**

Modify `apps/web/src/hooks/use-profile.ts` — extend the `ProfileWithCommune` type to include theme, motto, code_postal from the communes join:

```typescript
type ProfileWithCommune = Profile & {
  communes: { name: string; slug: string; epci_id: string | null; code_postal: string | null; theme: string; motto: string | null };
};
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/nav-bar.tsx apps/web/src/hooks/use-profile.ts
git commit -m "feat(web): redesign nav bar with gradient header, commune identity, themed colors"
```

---

### Task 7: Web Post Card & Badge Redesign

**Files:**
- Modify: `apps/web/src/components/post-card.tsx`
- Modify: `apps/web/src/components/post-type-badge.tsx`

- [ ] **Step 1: Redesign post type badge**

Replace `apps/web/src/components/post-type-badge.tsx`:
- Use Lucide React icons (megaphone, calendar, heart-handshake, message-circle) inside the badge
- Fixed colors per type (not theme-dependent)
- Rounded pill shape (6px border-radius)
- Icon + text, 10px font, 600 weight

- [ ] **Step 2: Redesign post card**

Replace `apps/web/src/components/post-card.tsx`:
- White card, 14px border-radius, soft warm shadow (`0 1px 6px rgba(160,130,90,0.06)`)
- Pinned post: 2.5px gradient accent bar at top using CSS custom properties
- "Épinglé" label: primary color text on `--theme-pin-bg` background, with Lucide `Pin` icon
- Post title: DM Sans 600, 14px
- Excerpt: 400 weight, 13px, muted color
- Meta line with Lucide `MessageCircle` icon for comment count
- Event posts: warm info box (`#FFF9F2` background), calendar icon, date + location
- RSVP pill buttons on event cards

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/post-card.tsx apps/web/src/components/post-type-badge.tsx
git commit -m "feat(web): redesign post cards with Lucide icons, themed pins, warm shadows"
```

---

### Task 8: Web Feed Page & App Layout Redesign

**Files:**
- Modify: `apps/web/src/app/app/layout.tsx`
- Modify: `apps/web/src/app/app/feed/page.tsx`

- [ ] **Step 1: Update app layout**

Modify `apps/web/src/app/app/layout.tsx`:
- Add ThemeInjector — but app layout doesn't know the commune yet. The feed page does (via profile). Move ThemeInjector to the feed page, or load commune theme in the layout via middleware.
- Simplest approach: the layout uses `--theme-background` for the page background. The feed page injects the theme based on the user's commune.
- Set body background to `var(--theme-background)` in the layout.

- [ ] **Step 2: Update feed page**

Modify `apps/web/src/app/app/feed/page.tsx`:
- Add ThemeInjector at the top of the page output, passing `profile.communes.theme`
- Add quick action filter chips as a horizontal row above the feed (Annonces, Entraide, Événements, Favoris) — these can be links with query params or client-side filters
- Add section headers ("Aujourd'hui", "Cette semaine") grouping posts by date
- Style the "Publier" button with theme gradient
- Use themed page background

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/app/layout.tsx apps/web/src/app/app/feed/page.tsx
git commit -m "feat(web): redesign feed page with themed background, filter chips, date sections"
```

---

### Task 9: Web Admin Panel Redesign

**Files:**
- Modify: `apps/web/src/app/admin/dashboard/page.tsx`
- Modify: `apps/web/src/app/admin/layout.tsx`
- Modify: `apps/web/src/components/admin/pending-users.tsx`
- Modify: `apps/web/src/components/admin/post-management.tsx`
- Create: `apps/web/src/components/admin/summary-cards.tsx`
- Create: `apps/web/src/components/admin/mini-calendar.tsx`

- [ ] **Step 1: Create summary cards component**

Create `apps/web/src/components/admin/summary-cards.tsx`:
- 3 cards in a row: "Inscriptions en attente", "Publications cette semaine", "Signalements ouverts"
- Each shows a count number (large), a label, and a colored status dot if count > 0
- Cards use white background, subtle shadow, themed accent for the count color
- Clickable — scrolls to relevant section or navigates

- [ ] **Step 2: Create mini calendar component**

Create `apps/web/src/components/admin/mini-calendar.tsx`:
- Month view grid (Mon-Sun headers, day cells)
- Events shown as small colored dots on their dates
- Clicking a date shows events for that day in a popover or side panel
- Read-only — no create/edit
- Uses theme primary color for today's date highlight
- Props: `events` array with `{ date: string, title: string, type: string }`

- [ ] **Step 3: Update admin dashboard page**

Modify `apps/web/src/app/admin/dashboard/page.tsx`:
- Add ThemeInjector with commune theme
- Layout: SummaryCards at top → MiniCalendar in middle → PendingUsers + PostManagement below
- "Publier" button top-right, themed gradient, always visible
- Pass event posts to MiniCalendar

- [ ] **Step 4: Update admin layout**

Modify `apps/web/src/app/admin/layout.tsx`:
- Use same themed NavBar as app layout
- Set page background to `var(--theme-background)`

- [ ] **Step 5: Restyle pending users and post management**

Update `apps/web/src/components/admin/pending-users.tsx` and `post-management.tsx`:
- Use DM Sans typography (already global)
- Warm shadows on cards
- Lucide icons for actions (Check for approve, X for reject, Pin for pin, Trash2 for delete)
- Themed accent colors for buttons

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/admin/ apps/web/src/components/admin/
git commit -m "feat(web): redesign admin panel with summary cards, calendar, themed layout"
```

---

### Task 10: Public Commune Website Redesign

**Files:**
- Modify: `apps/web/src/app/[commune-slug]/layout.tsx`
- Modify: `apps/web/src/app/[commune-slug]/page.tsx`
- Modify: `apps/web/src/app/[commune-slug]/evenements/page.tsx`
- Create: `apps/web/src/app/[commune-slug]/infos-pratiques/page.tsx`

- [ ] **Step 1: Redesign commune layout**

Replace `apps/web/src/app/[commune-slug]/layout.tsx`:
- Add ThemeInjector with commune theme
- Thin gradient accent bar at very top (4px, theme gradient)
- White header with commune name (DM Sans 600, large, theme primary color)
- Blason/logo next to commune name if available
- Département underneath
- Motto in italics
- Nav links: Accueil, Événements, Infos pratiques — theme primary color on hover/active
- Footer: "Mairie de [name] — Site officiel" + legal mentions
- App download banner at bottom: "Téléchargez l'application pour participer"
- Load commune with new fields: `getCommuneBySlug` already works but the select needs to include new columns

- [ ] **Step 2: Redesign commune homepage**

Replace `apps/web/src/app/[commune-slug]/page.tsx`:
- Hero image (full-width, rounded corners, if `hero_image_url` exists)
- Commune description below hero
- "Dernières annonces" section — styled announcement cards (not post-card component, simpler for public)
- "Prochains événements" section — event cards with date/location
- Warm, newspaper-like layout with generous white space

- [ ] **Step 3: Redesign events page**

Replace `apps/web/src/app/[commune-slug]/evenements/page.tsx`:
- Read-only month calendar view at top (reuse or adapt mini-calendar component)
- Upcoming events below as full cards
- Past events dimmed at bottom

- [ ] **Step 4: Create infos pratiques page**

Create `apps/web/src/app/[commune-slug]/infos-pratiques/page.tsx`:
- Load commune's `infos_pratiques` JSONB field
- Render each key as a section: "Horaires de la mairie", "Contact", "Services de proximité", "Associations", "Liens utiles"
- Plain text with line breaks preserved (`whitespace-pre-wrap`)
- If a key doesn't exist, skip the section
- Warm card styling per section

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\[commune-slug\]/
git commit -m "feat(web): redesign public commune website with hero, infos pratiques, themed layout"
```

---

## Phase 3: Mobile App Reskin

### Task 11: Mobile Theme Context

**Files:**
- Create: `apps/mobile/src/lib/theme-context.tsx`
- Modify: `apps/mobile/src/lib/auth-context.tsx`
- Modify: `apps/mobile/src/constants/colors.ts`

- [ ] **Step 1: Create theme context**

Create `apps/mobile/src/lib/theme-context.tsx`:

React context that provides the resolved theme colors to all mobile components:

```typescript
import { createContext, useContext } from "react";
import { getTheme, type ThemeConfig } from "@rural-community-platform/shared";

const ThemeContext = createContext<ThemeConfig>(getTheme(null));

export function ThemeProvider({ theme, children }: { theme: string | null; children: React.ReactNode }) {
  return (
    <ThemeContext.Provider value={getTheme(theme)}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeConfig {
  return useContext(ThemeContext);
}
```

- [ ] **Step 2: Integrate theme into auth context**

Modify `apps/mobile/src/lib/auth-context.tsx`:
- Wrap children with `ThemeProvider` passing `profile?.communes?.theme`
- Extend the profile select to include `theme` from communes join

- [ ] **Step 3: Update mobile colors constant**

Replace `apps/mobile/src/constants/colors.ts` with fixed post type colors only (theme colors come from context):

```typescript
export const POST_TYPE_COLORS = {
  annonce: "#D35230",
  evenement: "#D4871C",
  entraide: "#508A40",
  discussion: "#8B7355",
} as const;

export const CARD = {
  background: "#FFFFFF",
  borderRadius: 14,
  shadow: { color: "#A0846428", offset: { width: 0, height: 1 }, radius: 6 },
} as const;
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/lib/theme-context.tsx apps/mobile/src/lib/auth-context.tsx apps/mobile/src/constants/colors.ts
git commit -m "feat(mobile): add theme context provider, integrate with auth"
```

---

### Task 12: Mobile Font Setup

**Files:**
- Modify: `apps/mobile/src/app/_layout.tsx`

- [ ] **Step 1: Load DM Sans font**

Modify `apps/mobile/src/app/_layout.tsx`:
- Import DM Sans using `expo-font` and `useFonts` hook:
```typescript
import { useFonts, DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold } from "@expo-google-fonts/dm-sans";
```
- Show splash screen while fonts load (`expo-splash-screen`)
- Pass font family name through the app (via a constant or theme context)

Note: Need to install `@expo-google-fonts/dm-sans`:
```bash
pnpm add @expo-google-fonts/dm-sans -F @rural-community-platform/mobile
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/app/_layout.tsx apps/mobile/package.json pnpm-lock.yaml
git commit -m "feat(mobile): load DM Sans font via expo-google-fonts"
```

---

### Task 13: Mobile Tab Bar Redesign

**Files:**
- Modify: `apps/mobile/src/app/(tabs)/_layout.tsx`

- [ ] **Step 1: Redesign tab layout**

Replace `apps/mobile/src/app/(tabs)/_layout.tsx`:
- 5 tabs: feed, events, exchanges, alerts, profile
- Use Phosphor Fill icons (`phosphor-react-native`): House, CalendarDots, ChatTeardropDots, BellRinging, UserCircle
- Active tab: theme primary color (from `useTheme()`) with tinted background pill
- Inactive tabs: muted color from theme
- Labels in French: Fil, Événements, Échanges, Alertes, Profil
- Font: DM Sans 500, 9px for labels

Note: `exchanges` tab needs to be created (Task 15). For now, create the tab pointing to a placeholder screen.

- [ ] **Step 2: Create exchanges placeholder**

Create `apps/mobile/src/app/(tabs)/exchanges.tsx`:
```typescript
import { View, Text, StyleSheet } from "react-native";

export default function ExchangesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Échanges — Bientôt disponible</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#FBF7F1" },
  text: { fontFamily: "DMSans_500Medium", fontSize: 16, color: "#907B64" },
});
```

- [ ] **Step 3: Create alerts placeholder**

Create `apps/mobile/src/app/(tabs)/alerts.tsx`:
```typescript
import { View, Text, StyleSheet } from "react-native";

export default function AlertsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Alertes — Bientôt disponible</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#FBF7F1" },
  text: { fontFamily: "DMSans_500Medium", fontSize: 16, color: "#907B64" },
});
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/app/\(tabs\)/
git commit -m "feat(mobile): redesign tab bar with Phosphor Fill icons, themed colors, 5 tabs"
```

---

### Task 14: Mobile Header & Feed Redesign

**Files:**
- Modify: `apps/mobile/src/app/(tabs)/feed/index.tsx`
- Modify: `apps/mobile/src/components/post-card.tsx`
- Create: `apps/mobile/src/components/feed-header.tsx`
- Create: `apps/mobile/src/components/quick-actions.tsx`

- [ ] **Step 1: Create feed header component**

Create `apps/mobile/src/components/feed-header.tsx`:
- Gradient background using theme's 3 gradient stops (use `LinearGradient` from `expo-linear-gradient` — install if needed)
- Commune name (DM Sans 600, 21px, white)
- Code postal + département (12px, white 65%)
- Motto in frosted pill (if available)
- Avatar initials top-right (36x36, rounded-12, frosted glass)
- Decorative circles (Views with `rgba(255,255,255,0.06)` background, absolute positioned)

Install: `pnpm add expo-linear-gradient -F @rural-community-platform/mobile`

- [ ] **Step 2: Create quick actions chips**

Create `apps/mobile/src/components/quick-actions.tsx`:
- Horizontal ScrollView with 4 chip buttons: Annonces, Entraide, Événements, Favoris
- Each chip: white card, 12px border-radius, Lucide icon in colored rounded square + label
- Icons from `lucide-react-native`: Megaphone, HeartHandshake, Calendar, Star
- On press: filters the feed (callback prop)

- [ ] **Step 3: Redesign post card**

Replace `apps/mobile/src/components/post-card.tsx`:
- White card, 14px radius, warm shadow
- Pinned post: 2.5px gradient bar at top
- Type badges with Lucide icons (from `lucide-react-native`)
- "Épinglé" label with Pin icon
- DM Sans font weights (title: 600, excerpt: 400, meta: 400)
- Comment count with MessageCircle icon
- Event info box with CalendarDays icon
- RSVP pill buttons

- [ ] **Step 4: Redesign feed screen**

Replace `apps/mobile/src/app/(tabs)/feed/index.tsx`:
- FeedHeader as `ListHeaderComponent` in FlatList
- QuickActions below header
- Section headers ("Aujourd'hui", "Cette semaine") between post groups
- FAB "Publier" button — pill-shaped, bottom-right, theme gradient, Lucide Plus icon + text
- Pull-to-refresh still works
- Realtime subscription still works
- Page background: theme background color

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/components/feed-header.tsx apps/mobile/src/components/quick-actions.tsx apps/mobile/src/components/post-card.tsx apps/mobile/src/app/\(tabs\)/feed/
git commit -m "feat(mobile): redesign feed with gradient header, quick actions, themed post cards, FAB"
```

---

### Task 15: Mobile Post Detail Redesign

**Files:**
- Modify: `apps/mobile/src/app/post/[id].tsx`

- [ ] **Step 1: Redesign post detail screen**

Replace `apps/mobile/src/app/post/[id].tsx`:
- Theme background color
- Type badge with Lucide icon
- Title in DM Sans 600
- Author + date in muted theme color
- Body text in DM Sans 400
- Event info box (warm gradient background, CalendarDays icon)
- Images in rounded cards
- RSVP pill buttons with theme active color
- Comments section with themed styling
- Comment input at bottom with themed send button
- All icons from lucide-react-native

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/app/post/
git commit -m "feat(mobile): redesign post detail with themed layout, Lucide icons"
```

---

### Task 16: Mobile Create Post & Profile Redesign

**Files:**
- Modify: `apps/mobile/src/app/(tabs)/create.tsx`
- Modify: `apps/mobile/src/app/(tabs)/profile.tsx`
- Modify: `apps/mobile/src/app/admin/moderation.tsx`

- [ ] **Step 1: Redesign create post screen**

Modify `apps/mobile/src/app/(tabs)/create.tsx`:
- Type selector as horizontal pill buttons (not chips) with theme styling
- DM Sans throughout
- Themed submit button (gradient background)
- Lucide icons in type pills
- Clean spacing, warm background

- [ ] **Step 2: Redesign profile screen**

Modify `apps/mobile/src/app/(tabs)/profile.tsx`:
- Large avatar initials circle at top with theme gradient border
- Name, commune, role badge
- Admin section with themed accent
- DM Sans throughout
- Lucide icons (Settings, Shield for admin, LogOut)

- [ ] **Step 3: Redesign moderation screen**

Modify `apps/mobile/src/app/admin/moderation.tsx`:
- Themed header
- User cards with warm shadows
- Lucide Check and X icons for approve/reject
- DM Sans font

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/app/\(tabs\)/create.tsx apps/mobile/src/app/\(tabs\)/profile.tsx apps/mobile/src/app/admin/moderation.tsx
git commit -m "feat(mobile): redesign create post, profile, and moderation screens"
```

---

### Task 17: Mobile Auth Screens Redesign

**Files:**
- Modify: `apps/mobile/src/app/auth/login.tsx`
- Modify: `apps/mobile/src/app/auth/signup.tsx`

- [ ] **Step 1: Redesign login screen**

Modify `apps/mobile/src/app/auth/login.tsx`:
- App logo/name at top with default theme gradient background section
- DM Sans font throughout
- Warm input styling (rounded, soft border)
- Themed submit button (gradient)
- Clean, welcoming feel

- [ ] **Step 2: Redesign signup screen**

Modify `apps/mobile/src/app/auth/signup.tsx`:
- Same warm styling as login
- Commune selection list with themed highlight on selected item
- DM Sans throughout

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/app/auth/
git commit -m "feat(mobile): redesign auth screens with DM Sans, warm styling"
```

---

## Summary

| Phase | Tasks | What it delivers |
|---|---|---|
| 1. Foundation | 1-3 | Theme config in shared, database migration, dependencies |
| 2. Web reskin | 4-10 | Font, global styles, themed nav/feed/cards, admin with calendar, public website with hero + infos pratiques |
| 3. Mobile reskin | 11-17 | Theme context, DM Sans font, Phosphor tab bar, gradient header, Lucide icons everywhere, FAB, all screens redesigned |
