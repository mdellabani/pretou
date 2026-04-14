# Moderation, Safety & Feed Pagination — Design Spec

**Date:** 2026-04-14
**Scope:** Post reporting, moderator role, word filtering, rate limiting, audit log, and cursor-based feed pagination.

## 1. Post Reporting

### Purpose
Allow residents to flag inappropriate content. Anonymous to the community, visible to moderators. Auto-hide at threshold to limit exposure of harmful content.

### Data Model

```
reports
  id              UUID PK
  post_id         UUID FK → posts ON DELETE CASCADE
  reporter_id     UUID FK → profiles
  category        TEXT NOT NULL CHECK (category IN ('inapproprie', 'spam', 'illegal', 'doublon', 'autre'))
  reason          TEXT (optional free text, max 500 chars)
  status          TEXT NOT NULL CHECK (status IN ('pending', 'dismissed', 'actioned')) DEFAULT 'pending'
  reviewed_by     UUID FK → profiles (nullable)
  reviewed_at     TIMESTAMPTZ
  created_at      TIMESTAMPTZ DEFAULT now()
  UNIQUE(post_id, reporter_id)
```

**Report categories:**
- 🚫 `inapproprie` — Contenu inapproprié
- 📢 `spam` — Spam / publicité
- ⚠️ `illegal` — Contenu illégal
- 🔄 `doublon` — Doublon
- 🤷 `autre` — Autre (free text required)

### Auto-Hide Trigger

Postgres trigger on `reports` INSERT: when a post reaches **3 pending reports**, set `posts.is_hidden = true`.

```sql
CREATE OR REPLACE FUNCTION check_report_threshold() RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT count(*) FROM reports WHERE post_id = NEW.post_id AND status = 'pending') >= 3 THEN
    UPDATE posts SET is_hidden = true WHERE id = NEW.post_id;
    INSERT INTO audit_log (commune_id, actor_id, action, target_type, target_id, reason)
    SELECT p.commune_id, NULL, 'post_hidden', 'post', p.id, 'Seuil de signalements atteint (3)'
    FROM posts p WHERE p.id = NEW.post_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_report_threshold
  AFTER INSERT ON reports
  FOR EACH ROW EXECUTE FUNCTION check_report_threshold();
```

### User-Facing Behaviour

- **Reporting:** Flag icon (Lucide `Flag`) + "Signaler" on every post card and detail page (not shown on own posts or if already reported). Opens dialog with category picker + optional text. Confirmation: "Merci, votre signalement a été pris en compte."
- **Post author:** Sees nothing when reported. If post is hidden: post appears greyed out in Mon Espace with "Masqué" badge. Author does not see who reported or how many times.
- **Already reported:** Button disabled with "Déjà signalé."

### Moderator Review Queue

- List of posts with pending reports, sorted by report count descending.
- Each item: post title, author name, report count, category breakdown, individual report reasons (moderator sees reporter names + dismissed/total stats per reporter).
- Actions:
  - **Restaurer** — dismiss all pending reports on this post, set `is_hidden = false`. Audit log: `post_restored`.
  - **Supprimer** — delete the post, mark all reports as `actioned`. Audit log: `post_deleted`.

### Reporter Stats

Visible to moderators in the queue: next to each reporter name, show "(X rejetés / Y total)". Moderator uses this to assess false reporting patterns and can warn or restrict users at their discretion (manual, not automated).

### RLS

- INSERT: any authenticated user can create a report (`reporter_id = auth.uid()`).
- SELECT: moderators and admins of the commune can read reports. Regular users cannot.
- UPDATE: moderators and admins can update status (review).

---

## 2. Moderator Role

### Role Hierarchy

`resident < moderator < admin`

| Capability | Resident | Moderator | Admin |
|---|---|---|---|
| Create posts (all types) | Yes | Yes | Yes |
| Create annonces officielles | No | No | Yes |
| Delete own posts | Yes | Yes | Yes |
| Delete/hide any post | No | Yes | Yes |
| Report posts | Yes | Yes | No |
| Review report queue | No | Yes | Yes |
| Approve/reject producers | No | Yes | Yes |
| Manage users | No | No | Yes |
| Commune settings | No | No | Yes |
| View audit log | No | Own actions | All |

### Schema Change

Extend `profiles.role` CHECK constraint:
```sql
ALTER TABLE profiles DROP CONSTRAINT profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('resident', 'moderator', 'admin'));
```

### Helper Function

```sql
CREATE OR REPLACE FUNCTION is_commune_moderator() RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('moderator', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Use `is_commune_moderator()` for moderation-related RLS policies. Keep `is_commune_admin()` for admin-only policies.

### Promotion Flow

Admin goes to user management → existing user list → new option "Promouvoir modérateur" alongside existing "Promouvoir admin." Demote works the same way.

### Moderator Badge

Shield icon (Lucide `Shield`) + "Modérateur" displayed:
- Next to display name on posts and comments
- In user profile/settings
- In admin user management list

### Moderator Dashboard

Moderators see a "Modération" link in nav (instead of "Admin"). Their dashboard shows:
- Report queue (pending reports for their commune)
- Pending producers
- Their own audit log entries

Admins see the full dashboard: everything moderators see + user management + commune settings + full audit log.

---

## 3. Word Filter

### Purpose

Automatically flag posts containing banned words. Posts are created but hidden pending moderator review. Protects against legal liability for illegal content.

### Data Model

```
word_filters
  id              UUID PK
  word            TEXT NOT NULL UNIQUE
  created_at      TIMESTAMPTZ DEFAULT now()
```

### Behaviour

1. On post creation (server-side, after validation, before response), check `title + body` against `word_filters` table.
2. Matching: case-insensitive, whole-word. Postgres regex with word boundaries: `\y{word}\y` with `~*` operator.
3. If match found:
   - Post is inserted with `is_hidden = true`.
   - Auto-report inserted: `category = 'autre'`, `reason = 'Mot filtré automatiquement : {word}'`, `reporter_id` = system UUID.
   - User sees: "Votre publication est en cours de vérification."
4. Post appears in moderator queue with "Filtre auto" tag.
5. Moderator can approve (unhide) or delete.

### Word List

Platform-wide default seeded via migration. ~50 French terms covering:
- Drug references (cannabis, cocaïne, héroïne, crack, deal, dealer, drogue, stupéfiant, shit)
- Slurs and hate speech (racial, sexual orientation, religious)
- Violence (meurtre, tuer, arme, agression)
- Other illegal activity (escroquerie, arnaque)

No admin UI for managing the list — managed via migration/seed. Admin UI can be added later if needed.

### Scope

Applies to post `title` and `body` only. Not comments (future enhancement).

---

## 4. Rate Limiting

### Rules

| Scope | Limit | Who |
|---|---|---|
| All post types combined | 5 per day per user | Residents only |
| Service posts specifically | 2 per day per user | Residents only |
| Moderators and admins | Exempt | — |

### Implementation

Check at creation time (server-side, in the create post action):

```sql
SELECT count(*) FROM posts
WHERE author_id = :user_id
  AND created_at > now() - interval '1 day'
```

If over limit: reject with "Vous avez atteint la limite de publications pour aujourd'hui (5 maximum)."

For service-specific limit: same query with `AND type = 'service'`.

No dedicated table — pure query-time check against existing `posts` table.

---

## 5. Feed Pagination

### Cursor-Based Infinite Scroll

**First load:**
1. Pinned posts: `WHERE is_pinned = true AND is_hidden = false AND commune_id = :id` (separate query, always shown at top, not paginated)
2. First page: `WHERE is_pinned = false AND is_hidden = false AND commune_id = :id ORDER BY created_at DESC LIMIT 20`
3. Return `created_at` of last post as cursor

**Subsequent loads:**
```sql
WHERE is_pinned = false AND is_hidden = false
  AND commune_id = :id
  AND created_at < :cursor
ORDER BY created_at DESC LIMIT 20
```

If fewer than 20 returned → end of feed, show "Aucune publication plus ancienne."

**Page size:** 20 posts per load.

### Web Implementation

- Server component loads pinned + first 20 posts (SSR)
- Client wrapper component with `IntersectionObserver` on a sentinel `<div>` at the bottom
- When sentinel enters viewport, call server action to fetch next page (returns posts + next cursor)
- Append to list, update cursor

### Mobile Implementation

- FlatList `onEndReached` with `onEndReachedThreshold={0.5}`
- Cursor stored in state, fetch next batch via supabase query, append to data array
- Loading spinner at bottom while fetching

### Filter Interaction

- Type filters, date filters, and scope (commune/EPCI) are applied to the paginated query
- When any filter changes: reset cursor to null, reload from page 1
- Pinned posts are re-fetched with filters too (a pinned annonce should disappear when filtering by "entraide")

### Hidden Posts

Add `AND is_hidden = false` to all feed queries. This integrates with the reporting system — hidden posts are excluded from the feed without deletion.

---

## 6. Audit Log

### Data Model

```
audit_log
  id              UUID PK
  commune_id      UUID NOT NULL FK → communes
  actor_id        UUID FK → profiles (nullable for system actions)
  action          TEXT NOT NULL
  target_type     TEXT NOT NULL
  target_id       UUID NOT NULL
  reason          TEXT
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
```

### Logged Actions

| Action | Trigger | Actor |
|---|---|---|
| `post_hidden` | Auto-hide by report threshold or word filter | system |
| `post_deleted` | Moderator/admin deletes a post | moderator/admin |
| `post_restored` | Moderator/admin unhides a post | moderator/admin |
| `report_dismissed` | Moderator dismisses a report | moderator/admin |
| `report_actioned` | Moderator acts on a report | moderator/admin |
| `producer_approved` | Moderator/admin approves producer | moderator/admin |
| `producer_rejected` | Moderator/admin rejects producer | moderator/admin |
| `user_approved` | Admin approves signup | admin |
| `role_changed` | Admin promotes/demotes user | admin |

### System Actions

For automated actions (auto-hide by threshold, word filter), `actor_id` is `NULL`. Display as "Système" in the UI. The `actor_id` column is nullable to support this without requiring a fake profile row.

### Visibility

- **Admin dashboard:** Full log for the commune, filterable by action type and date. Reverse chronological. Display: "Secrétariat Mairie a supprimé « Vente de... » — 14 avr. à 10:32 — Raison : contenu illégal"
- **Moderator dashboard:** Only their own actions.

### Implementation

Explicit inserts in server actions alongside every moderation action. Not a Postgres trigger (except for auto-hide, which uses the report threshold trigger). This ensures reason and actor are always captured with full context.

### Retention

Indefinite. Small table, append-only, rarely queried but critical for accountability.

### RLS

- SELECT: admin sees all for their commune, moderator sees only their own actions (`actor_id = auth.uid()`).
- INSERT: moderators and admins can insert.
- No UPDATE/DELETE — audit logs are immutable.

---

## 7. Schema Changes Summary

New `posts` column:
- `is_hidden BOOLEAN NOT NULL DEFAULT false`

Extended `profiles.role` CHECK:
- Add `'moderator'` to allowed values

New tables:
- `reports` (post reporting with categories)
- `audit_log` (immutable action log)
- `word_filters` (banned word list)

New functions:
- `is_commune_moderator()` — returns true for moderator + admin
- `check_report_threshold()` — trigger function for auto-hide

New trigger:
- `trigger_report_threshold` on `reports` INSERT

---

## 8. Implementation Order

1. **Schema migration** (004_moderation.sql) — new tables, columns, functions, trigger, word list seed
2. **Feed pagination** (web + mobile) — cursor-based queries, infinite scroll UI. Independent of moderation.
3. **Moderator role** — extend profiles, helper function, update RLS, promote/demote UI, badge, moderator dashboard
4. **Post reporting** — report dialog, report creation, auto-hide, review queue
5. **Word filter** — check at post creation, auto-flag, queue integration
6. **Rate limiting** — check at post creation, error messages
7. **Audit log** — add logging to all moderation actions, admin/moderator log viewer

Steps 2-7 are independent after the migration, but the order above minimizes rework (moderator role is needed by reporting, reporting is needed by word filter's auto-report).
