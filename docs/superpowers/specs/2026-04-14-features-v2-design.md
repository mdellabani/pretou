# Features v2 — Design Spec

**Date:** 2026-04-14
**Scope:** Four features that extend the MVP community platform beyond basic feed + events.

## 1. Producteurs Locaux (Circuit Court)

### Purpose
A directory of local food producers (farmers, artisans, AMAPs) promoting short supply chains. Cross-commune by nature — an apiculteur in Morlanne serves the whole EPCI.

### Data Model

New `producers` table (not a post type — producers are persistent directory entries, not feed items):

```
producers
  id              UUID PK
  commune_id      UUID FK → communes (producer's home commune)
  created_by      UUID FK → profiles (who submitted)
  name            TEXT NOT NULL (farm name or person name)
  description     TEXT NOT NULL (story, what they produce)
  categories      TEXT[] NOT NULL (from fixed list)
  photo_path      TEXT (Supabase Storage path, optional)
  pickup_location TEXT (address/description, optional)
  delivers        BOOLEAN DEFAULT false
  contact_phone   TEXT
  contact_email   TEXT
  schedule        TEXT (e.g. "marché de Morlanne le samedi", "panier le jeudi")
  status          TEXT CHECK (status IN ('pending', 'active', 'rejected')) DEFAULT 'pending'
  created_at      TIMESTAMPTZ DEFAULT now()
  updated_at      TIMESTAMPTZ DEFAULT now()
```

**Fixed categories:** `légumes`, `fruits`, `fromages`, `miel`, `pain`, `viande`, `œufs`, `paniers`, `vin`, `conserves`, `autre`

### Visibility Rules
- EPCI-wide by default: any resident in the same EPCI can see all active producers.
- Producer can opt out of delivery (`delivers = false`) and set a pickup location.
- AMAPs list themselves as producers with `paniers` category and describe their system in `description` + `schedule`.

### Creation Flow
1. Any authenticated resident creates a listing via a form.
2. Status starts as `pending`.
3. Admin of the producer's home commune sees pending listings in their admin panel → approves or rejects.
4. Once `active`, visible to all EPCI residents.

### UI — Entry Point
A **banner card** pinned at the top of the feed:
```
🌿 Producteurs locaux
12 producteurs · Circuit court        →
```
Green gradient background, links to `/app/producteurs`.

### UI — Directory Page (`/app/producteurs`)
- **Search bar** at top (searches name + description)
- **Category filter pills** (multi-select, horizontal scroll)
- **List/grid view toggle** (list default)
- Each card shows: name, photo (or placeholder), categories as chips, commune name, pickup/delivery indicator, schedule snippet
- Tapping a card opens a detail view (inline expand or separate page)
- **Map view toggle**: placeholder for now, implemented later with PostGIS + Leaflet/Mapbox. The toggle button is visible but shows "Bientôt disponible" when tapped. **Must be tracked in the implementation plan as a future task** to avoid forgetting.

### RLS
- SELECT: any authenticated user in the same EPCI can read `active` producers.
- INSERT: any authenticated user can insert (status defaults to `pending`).
- UPDATE/DELETE: only the creator or an admin of the producer's commune.

### Mobile
Same flow: banner on feed tab, dedicated screen for directory with search + filters + list/grid toggle.

---

## 2. Service Posts (Annonces de Services)

### Purpose
Paid one-off services between neighbours — mowing, babysitting, cleaning, odd jobs. Not professional ads. Merged with the future "annonces" commercial concept: 7 days free, pay to extend (freemium model, payment not built now).

### Data Model Changes

**Posts table:**
- Add `'service'` to the `type` CHECK constraint.
- Add `expires_at TIMESTAMPTZ` column (nullable). Set to `now() + interval '7 days'` for service posts. NULL for all other types.

**No new tables needed.** Services are posts with `type = 'service'` and an expiration.

### Behaviour
- Any resident can create a service post.
- Service posts have a **7-day lifespan**. After expiration, they stop appearing in the feed and search results.
- Expired posts are NOT deleted — they remain in the database and visible in "Mon espace > Mes publications" (greyed out with "Expiré" badge).
- The poster can **re-post** (creates a new post, no limit on re-posting for now).
- Feed queries filter: `WHERE (expires_at IS NULL OR expires_at > now())`.
- Admin can delete service posts like any other post.

### Future (captured, not built)
- Paid extension: user pays to keep a service post visible beyond 7 days or to boost it to the top.
- This transforms the feature into a local classifieds model with a freemium gate.

### UI
- New type badge: `Service` with color `#f59e0b` (amber) and icon `wrench` (Lucide).
- Creation form: same as other posts but shows a notice: "Les annonces de service expirent après 7 jours."
- Feed: service posts show a countdown badge ("Expire dans 3j") or "Expiré" if past.
- Filter pills on feed: add "Service" alongside existing types.

### Shared Constants
```ts
// Add to PostType
export type PostType = "annonce" | "evenement" | "entraide" | "discussion" | "service";

// Add to POST_TYPE_LABELS
service: "Service",

// Add to POST_TYPE_COLORS
service: "#f59e0b",

// Add to POST_TYPE_ICONS
service: "wrench",
```

---

## 3. Polls (Sondages)

### Purpose
Optional poll attachment on any post type. Supports two modes: multi-choice vote ("quel jour?") and participation count ("qui vient?").

### Data Model

```
polls
  id              UUID PK
  post_id         UUID FK → posts ON DELETE CASCADE (UNIQUE — one poll per post)
  question        TEXT NOT NULL
  poll_type       TEXT CHECK (poll_type IN ('vote', 'participation')) NOT NULL
  allow_multiple  BOOLEAN DEFAULT false (for 'vote' type: can user pick multiple options?)
  created_at      TIMESTAMPTZ DEFAULT now()

poll_options
  id              UUID PK
  poll_id         UUID FK → polls ON DELETE CASCADE
  label           TEXT NOT NULL
  position        INT NOT NULL (display order)

poll_votes
  id              UUID PK
  poll_option_id  UUID FK → poll_options ON DELETE CASCADE
  user_id         UUID FK → profiles
  created_at      TIMESTAMPTZ DEFAULT now()
  UNIQUE(poll_option_id, user_id)
```

### Poll Types

**Vote (`vote`):** Classic sondage. Question + 2–6 options. Each user picks one (or multiple if `allow_multiple`). Results shown as horizontal bars with percentages + count.

**Participation (`participation`):** Simplified RSVP. Auto-generated options: "Je participe" / "Peut-être" / "Je ne peux pas". Results shown as avatar list or count per option. This replaces/extends the current event-only RSVP for non-event posts.

### Interaction with existing RSVPs
- The current `rsvps` table stays for backward compatibility with existing event posts.
- New events created after this feature can use either RSVP or a participation poll — but not both.
- Long-term: migrate events to use participation polls and deprecate the `rsvps` table.

### Creation Flow
1. When creating/editing any post, toggle "Ajouter un sondage".
2. Pick type: "Vote" or "Participation".
3. For vote: enter question + options (2–6). Toggle "Choix multiple" if needed.
4. For participation: question is auto-filled ("Qui participe ?"), options are pre-set.
5. Poll is created alongside the post in a single transaction.

### UI — Display
- Poll renders below the post body, above comments.
- Vote: horizontal bar chart with option label, percentage, count. User's selection highlighted.
- Participation: three buttons (Participe / Peut-être / Pas dispo) with count badges. Current user's choice highlighted.
- Results visible to all after voting (no hidden results).

### RLS
- SELECT polls/options/votes: any authenticated user in the same commune.
- INSERT vote: any authenticated user, one vote per option (UNIQUE constraint).
- DELETE own vote: user can change their mind (delete + re-insert).
- INSERT/UPDATE/DELETE poll: only the post author or admin.

---

## 4. Infos Pratiques Redesign

### Purpose
Transform the current text-dump infos pratiques page into a structured, visually appealing directory.

### Layout (top to bottom)

**1. Mairie Hero Card**
- Full-width gradient card (commune theme colors).
- Left: hours (days + time slots). Right: contact (phone with tap-to-call, email with tap-to-email, address).
- Commune name as card title with 🏛️ icon.

**2. Services de proximité**
- Structured rows, each with: icon (category-based emoji), name, location subtitle, phone number right-aligned.
- Rows on a light background (`pinBg` color), rounded.
- Tap phone number to call (mobile) / copy (web).

**3. Associations**
- Compact pill/chip layout.
- Each chip shows association name. Tapping expands inline to show description + contact if available.
- Uses theme `pinBg` background, `primary` text.

**4. Commerces & services** (new section)
- Same row format as services but with emoji icon, name, hours, phone.
- Data source for now: add a `commerces` key to the existing `infos_pratiques` JSONB.
- Future: dedicated `commerces` table with admin CRUD + map view.

**5. Liens utiles**
- Simple list of clickable links with labels.

### Data Source
No schema changes needed now. The existing `infos_pratiques` JSONB column on `communes` already contains the data. The rendering changes are purely frontend.

For the commerces section, add a `commerces` key to the JSONB in the seed data as a JSON array:
```json
{
  "commerces": [
    { "nom": "Boulangerie Peyret", "horaires": "Mar-Sam 6h30–13h", "tel": "05 59 67 XX XX", "emoji": "🍞" },
    { "nom": "Café O'Médard", "horaires": "Ven-Sam soir, Dim matin", "emoji": "☕" }
  ]
}
```
This avoids schema changes while keeping data structured enough to render nicely. Future: migrate to a dedicated `commerces` table with admin CRUD.

### Mobile
Same layout, adapted to single-column. Mairie card full-width, service rows stack naturally, association chips wrap.

---

## Schema Migration Summary

New migration `003_features_v2.sql`:

```sql
-- 1. Extend post types
ALTER TABLE posts DROP CONSTRAINT posts_type_check;
ALTER TABLE posts ADD CONSTRAINT posts_type_check
  CHECK (type IN ('annonce', 'evenement', 'entraide', 'discussion', 'service'));

-- 2. Add expiration
ALTER TABLE posts ADD COLUMN expires_at TIMESTAMPTZ;

-- 3. Producers table
CREATE TABLE producers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commune_id UUID NOT NULL REFERENCES communes(id),
  created_by UUID NOT NULL REFERENCES profiles(id),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  categories TEXT[] NOT NULL,
  photo_path TEXT,
  pickup_location TEXT,
  delivers BOOLEAN NOT NULL DEFAULT false,
  contact_phone TEXT,
  contact_email TEXT,
  schedule TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'rejected')) DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_producers_commune_id ON producers(commune_id);
CREATE INDEX idx_producers_status ON producers(status);

-- 4. Polls
CREATE TABLE polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL UNIQUE REFERENCES posts(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  poll_type TEXT NOT NULL CHECK (poll_type IN ('vote', 'participation')),
  allow_multiple BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE poll_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  position INT NOT NULL
);

CREATE TABLE poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_option_id UUID NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(poll_option_id, user_id)
);

CREATE INDEX idx_poll_votes_option ON poll_votes(poll_option_id);
CREATE INDEX idx_poll_votes_user ON poll_votes(user_id);

-- 5. RLS for producers
ALTER TABLE producers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Producers visible to EPCI members"
  ON producers FOR SELECT USING (
    -- Active producers visible to all EPCI members
    (status = 'active' AND commune_id IN (
      SELECT c.id FROM communes c
      WHERE c.epci_id = (
        SELECT c2.epci_id FROM communes c2
        JOIN profiles p ON p.commune_id = c2.id
        WHERE p.id = auth.uid()
      )
    ))
    -- Pending/rejected visible to creator and commune admins
    OR created_by = auth.uid()
    OR is_commune_admin()
  );

CREATE POLICY "Authenticated users can create producers"
  ON producers FOR INSERT WITH CHECK (
    auth.uid() = created_by
  );

CREATE POLICY "Creator or admin can update producers"
  ON producers FOR UPDATE USING (
    created_by = auth.uid()
    OR is_commune_admin()
  );

-- 6. RLS for polls
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Polls readable by commune members"
  ON polls FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM posts p
      JOIN profiles pr ON pr.commune_id = p.commune_id
      WHERE p.id = polls.post_id AND pr.id = auth.uid()
    )
  );

CREATE POLICY "Poll options readable by commune members"
  ON poll_options FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM polls pl
      JOIN posts p ON p.id = pl.post_id
      JOIN profiles pr ON pr.commune_id = p.commune_id
      WHERE pl.id = poll_options.poll_id AND pr.id = auth.uid()
    )
  );

CREATE POLICY "Users can vote"
  ON poll_votes FOR INSERT WITH CHECK (
    auth.uid() = user_id
  );

CREATE POLICY "Users can see votes"
  ON poll_votes FOR SELECT USING (true);

CREATE POLICY "Users can delete own votes"
  ON poll_votes FOR DELETE USING (
    auth.uid() = user_id
  );
```

### Feed query update
Add expiration filter to all feed queries:
```sql
WHERE (expires_at IS NULL OR expires_at > now())
```

---

## Implementation Order

1. **Schema migration** (003_features_v2.sql) — foundation for everything
2. **Infos pratiques redesign** (web + mobile) — pure frontend, no schema dependency beyond what exists, immediate visual impact
3. **Service posts** — small schema change (type + expires_at), extend existing post creation/display
4. **Polls** — new tables + UI on post creation and display
5. **Producers** — largest feature: new table, admin approval flow, directory page, feed banner

Each feature is independent after the migration. This order goes from fastest wins to most complex.
