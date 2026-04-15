# v2 Commune Website Completion — Design Spec

**Date:** 2026-04-15
**Status:** Approved
**Scope:** Complete v2 — theme customization, data cleanup, bulletin municipal, conseil municipal, mentions légales, admin panel updates

## 1. Schema Changes & Data Cleanup

### New table: `council_documents`

```sql
CREATE TABLE council_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commune_id UUID NOT NULL REFERENCES communes(id),
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('deliberation', 'pv', 'compte_rendu')),
  document_date DATE NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

RLS: public read (anon + authenticated), admin insert/delete for own commune.

### New columns on `communes`

| Column | Type | Default | Purpose |
|---|---|---|---|
| `address` | TEXT | null | Mairie physical address |
| `phone` | TEXT | null | Mairie phone |
| `email` | TEXT | null | Mairie email |
| `opening_hours` | JSONB | `'{}'` | `{"lundi": "9h-12h", ...}` |
| `custom_primary_color` | TEXT | null | Hex color override, null = use theme |
| `associations` | JSONB | `'[]'` | Array of `{name, description?, contact?, schedule?}` |

### Drop

- `primary_color` column — never used in code, theme system handles colors

### Data migration

- Parse `infos_pratiques.contact` → populate `address`, `phone`, `email`
- Move `infos_pratiques.horaires` → populate `opening_hours`
- Move `infos_pratiques.associations` → populate `associations`
- Strip `contact`, `horaires`, `associations` keys from `infos_pratiques` JSONB (keep `services`, `commerces`, `liens`)

### New Storage bucket

- `council-documents` (public, for PDF downloads)

## 2. Theme Customization & Accessibility

### How it works

- Admin picks a **base theme** from the 8 presets (terre_doc, provence, etc.)
- Admin can optionally set a **custom primary color** (hex input + color picker)
- When `custom_primary_color` is set, the palette auto-derives from it:
  - `background` — primary lightened to 95% luminance
  - `muted` — primary desaturated 50%, lightened to 65% luminance
  - `pinBg` — primary lightened to 92% luminance
  - `gradient` — [primary darkened 10%, primary, primary lightened 15%]
- When `custom_primary_color` is null, the base theme is used unchanged

### Accessibility guardrail

- Check WCAG AA contrast ratio of custom color against white text (4.5:1 minimum)
- If it fails: show yellow warning "Cette couleur manque de contraste avec le texte blanc. Essayez une teinte plus foncée." + suggest nearest accessible shade
- Don't block — just warn

### Palette derivation

Logic lives in `packages/shared` (new `deriveThemeFromColor(hex)` function) so all three surfaces share it:
- Commune website (`[commune-slug]/`) — via ThemeInjector
- Resident app (web `/app/`) — via ThemeInjector
- Mobile app — via `useTheme()` hook

### Logo

- Admin uploads logo via admin panel → Supabase Storage (reuse `avatars` bucket or dedicated path)
- `logo_url` column already exists on communes
- Commune website header shows `logo_url` (with `blason_url` as fallback)

## 3. Public Website Pages

### Existing pages (no change needed)

- `/[commune-slug]` — Accueil (latest news)
- `/[commune-slug]/evenements` — Events
- `/[commune-slug]/infos-pratiques` — Practical info (updated to use new data sources)

### New pages

**`/[commune-slug]/bulletin`**
- Auto-generated from `annonce` posts from the last 30 days
- Grouped by week ("Semaine du 7 au 13 avril")
- Each post: title, body excerpt, date, author
- Print-friendly CSS (`@media print`)
- Empty state: "Aucune annonce récente"

**`/[commune-slug]/conseil-municipal`**
- Lists documents from `council_documents` table
- Grouped by category: Délibérations, Procès-verbaux, Comptes-rendus
- Each document: title, date, download link (PDF)
- Sorted by date descending within each category
- Empty state: "Aucun document publié"

**`/[commune-slug]/mentions-legales`**
- Auto-generated template using commune data (name, address, phone, email)
- Hosting info: hardcoded "Hébergé par Vercel Inc."
- RGPD section: standard text about data processing
- Directeur de publication: commune name
- Linked from footer only (not in main nav)

### Nav update

**Header nav:** Accueil, Événements, Infos pratiques, Bulletin, Conseil municipal
- Responsive: horizontal on desktop, hamburger on mobile viewports

**Footer:** Mentions légales link

### Infos pratiques updates

The infos pratiques page (on all three surfaces) updates to read from new data sources:

- **Contact section:** reads `address`, `phone`, `email`, `opening_hours` from dedicated commune columns (replaces parsing `infos_pratiques.contact` string)
- **Associations section:** reads `associations` JSONB array from commune (replaces `infos_pratiques.associations`)
- **Remaining sections:** commerces, services, liens still read from `infos_pratiques` JSONB
- Remove the old `parseContact()` regex parsing logic

Same page structure on public website, web app, and mobile app. All read the same data.

## 4. Admin Panel — New Sections

### "Personnalisation" section

- Theme picker: 8 presets as visual swatches, currently selected highlighted
- Custom primary color: hex input + color picker, live preview, WCAG contrast warning
- Logo upload: file input → Storage, preview of current logo

### "Informations de la commune" section

- Text inputs: address, phone, email
- Opening hours: key-value per day (lundi → "9h-12h", etc.)
- Replaces the unstructured `contact` and `horaires` in infos_pratiques

### "Associations" section

- List of current associations from JSONB array
- Add/edit/remove inline (name, description, contact, schedule)
- No separate page — simple inline form

### "Conseil municipal" section

- Upload form: title, date, category picker (Délibération / PV / Compte-rendu), PDF file
- List of uploaded documents with delete button
- PDFs stored in `council-documents` Storage bucket

### Existing sections (unchanged)

- Pending users, pending producers, post management, community members, audit log, invite code manager
- Infos pratiques editor: remove contact/horaires/associations fields (they moved to dedicated sections above)

## 5. Build Order

1. **Migration** — new table, new columns, data migration, drop primary_color, new storage bucket
2. **Theme customization** — palette derivation in shared, ThemeInjector update, useTheme update, admin personnalisation section
3. **Admin panel sections** — commune info, associations, conseil municipal upload
4. **Infos pratiques update** — all three surfaces read from new data sources, remove old parsing
5. **New public pages** — bulletin, conseil municipal, mentions légales
6. **Nav update** — responsive nav with new links

## Deferred

- Custom domain support (macommune.fr) — next after v2
- AI summary of council documents — future feature, own design cycle
- Illustrated avatar gallery — v-next
- Web push notifications — v-next
