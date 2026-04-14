# Moderation, Safety & Feed Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add content moderation (reporting, word filter, rate limiting, moderator role, audit log) and cursor-based feed pagination to protect communities and scale the feed.

**Architecture:** Schema migration adds reports, audit_log, word_filters tables + moderator role + is_hidden column + auto-hide trigger. Feed pagination uses cursor-based queries (created_at as cursor). All moderation actions are logged. Word filter runs server-side at post creation time.

**Tech Stack:** Next.js 15 (App Router), Expo/React Native, Supabase (Postgres, RLS), TypeScript, Tailwind CSS, shadcn/ui

---

## File Map

### Schema & Shared
- Create: `supabase/migrations/004_moderation.sql`
- Modify: `packages/shared/src/types/profile.ts` — add `moderator` role
- Create: `packages/shared/src/types/report.ts` — Report types
- Create: `packages/shared/src/types/audit.ts` — AuditLog types
- Modify: `packages/shared/src/types/index.ts` — export new types
- Modify: `packages/shared/src/constants/roles.ts` — add moderator
- Modify: `packages/shared/src/constants/index.ts` — export report categories
- Create: `packages/shared/src/constants/report-categories.ts` — report category labels/icons
- Create: `packages/shared/src/queries/reports.ts` — report CRUD
- Create: `packages/shared/src/queries/audit.ts` — audit log queries
- Modify: `packages/shared/src/queries/posts.ts` — add is_hidden filter, cursor pagination
- Modify: `packages/shared/src/queries/admin.ts` — add promoteToModerator
- Modify: `packages/shared/src/queries/index.ts` — export new queries

### Web — Feed Pagination
- Modify: `apps/web/src/app/app/feed/page.tsx` — pinned + cursor-based first page
- Create: `apps/web/src/app/app/feed/feed-content.tsx` — client component with infinite scroll
- Create: `apps/web/src/app/app/feed/load-more-action.ts` — server action for next page

### Web — Reporting
- Create: `apps/web/src/components/report-dialog.tsx` — report a post
- Create: `apps/web/src/app/app/posts/[id]/report-action.ts` — server action
- Modify: `apps/web/src/components/post-card.tsx` — add flag icon

### Web — Moderator
- Modify: `apps/web/src/hooks/use-profile.ts` — add isModerator
- Modify: `apps/web/src/components/nav-bar.tsx` — show Modération link for moderators
- Create: `apps/web/src/app/moderation/dashboard/page.tsx` — moderator dashboard
- Create: `apps/web/src/app/moderation/report-queue.tsx` — report review queue
- Create: `apps/web/src/app/moderation/report-actions.ts` — restore/delete actions
- Create: `apps/web/src/app/moderation/audit-log-view.tsx` — audit log display
- Modify: `apps/web/src/app/admin/dashboard/page.tsx` — add audit log section, moderator promotion

### Web — Word Filter & Rate Limiting
- Modify: `apps/web/src/app/app/feed/actions.ts` — word filter check + rate limit check

### Mobile — Feed Pagination
- Modify: `apps/mobile/src/app/(tabs)/feed.tsx` — cursor-based loading with onEndReached

### Mobile — Reporting
- Create: `apps/mobile/src/components/report-dialog.tsx` — report modal
- Modify: `apps/mobile/src/components/post-card.tsx` — add flag button
- Modify: `apps/mobile/src/app/post/[id].tsx` — add report button

### Seed Data
- Modify: `supabase/seed.sql` — word filter seed, moderator profile, sample reports

---

## Task 1: Schema Migration

**Files:**
- Create: `supabase/migrations/004_moderation.sql`

- [ ] **Step 1: Create migration file**

```sql
-- 004_moderation.sql
-- Moderation: reports, audit log, word filter, moderator role, feed pagination support

-- 1. Extend profile roles to include 'moderator'
ALTER TABLE profiles DROP CONSTRAINT profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('resident', 'moderator', 'admin'));

-- 2. Add is_hidden to posts (for moderation hiding without deletion)
ALTER TABLE posts ADD COLUMN is_hidden BOOLEAN NOT NULL DEFAULT false;

-- 3. Reports table
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES profiles(id),
  category TEXT NOT NULL CHECK (category IN ('inapproprie', 'spam', 'illegal', 'doublon', 'autre')),
  reason TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'dismissed', 'actioned')) DEFAULT 'pending',
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(post_id, reporter_id)
);

CREATE INDEX idx_reports_post_id ON reports(post_id);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_reporter ON reports(reporter_id);

-- 4. Audit log table
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commune_id UUID NOT NULL REFERENCES communes(id),
  actor_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_commune ON audit_log(commune_id);
CREATE INDEX idx_audit_log_actor ON audit_log(actor_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);

-- 5. Word filters table
CREATE TABLE word_filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Seed default banned words
INSERT INTO word_filters (word) VALUES
  ('cannabis'), ('cocaïne'), ('cocaine'), ('héroïne'), ('heroine'),
  ('crack'), ('dealer'), ('drogue'), ('stupéfiant'), ('shit'),
  ('meth'), ('amphétamine'), ('ecstasy'), ('mdma'), ('lsd'),
  ('pute'), ('salope'), ('enculé'), ('nègre'), ('négro'),
  ('bougnoule'), ('youpin'), ('pd'), ('tapette'), ('gouine'),
  ('meurtre'), ('tuer'), ('buter'), ('crever'),
  ('escroquerie'), ('arnaque'),
  ('pédophile'), ('viol'), ('violer');

-- 7. Helper function: is user a moderator or admin?
CREATE OR REPLACE FUNCTION is_commune_moderator()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('moderator', 'admin') AND status = 'active'
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 8. Auto-hide trigger: hide post when it reaches 3 pending reports
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

-- 9. RLS: Reports
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reports_insert" ON reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id AND is_approved());

CREATE POLICY "reports_select" ON reports FOR SELECT USING (
  reporter_id = auth.uid()
  OR is_commune_moderator()
);

CREATE POLICY "reports_update" ON reports FOR UPDATE USING (
  is_commune_moderator()
);

-- 10. RLS: Audit log
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_select" ON audit_log FOR SELECT USING (
  commune_id = auth_commune_id()
  AND (is_commune_admin() OR actor_id = auth.uid())
);

CREATE POLICY "audit_insert" ON audit_log FOR INSERT WITH CHECK (
  is_commune_moderator()
  OR actor_id IS NULL
);

-- 11. RLS: Word filters (read-only for all authenticated)
ALTER TABLE word_filters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "word_filters_select" ON word_filters FOR SELECT USING (true);

-- 12. Add index for feed pagination (cursor-based)
CREATE INDEX idx_posts_feed ON posts(commune_id, is_pinned DESC, created_at DESC)
  WHERE is_hidden = false;
```

- [ ] **Step 2: Apply and verify**

Run: `npx supabase db reset`
Expected: All migrations apply, seed loads cleanly.

- [ ] **Step 3: Verify tables and trigger**

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "\dt reports; \dt audit_log; \dt word_filters;"
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "SELECT count(*) FROM word_filters;"
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "SELECT tgname FROM pg_trigger WHERE tgname = 'trigger_report_threshold';"
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/004_moderation.sql
git commit -m "feat(db): add moderation schema — reports, audit log, word filters, moderator role"
```

---

## Task 2: Shared Types & Constants

**Files:**
- Modify: `packages/shared/src/types/profile.ts`
- Create: `packages/shared/src/types/report.ts`
- Create: `packages/shared/src/types/audit.ts`
- Modify: `packages/shared/src/types/index.ts`
- Modify: `packages/shared/src/constants/roles.ts`
- Create: `packages/shared/src/constants/report-categories.ts`
- Modify: `packages/shared/src/constants/index.ts`

- [ ] **Step 1: Update Role type**

In `packages/shared/src/types/profile.ts`:

```ts
import type { Database } from "./database";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Role = "resident" | "moderator" | "admin" | "epci_admin";
export type ProfileStatus = "pending" | "active" | "rejected";
```

- [ ] **Step 2: Create Report types**

Create `packages/shared/src/types/report.ts`:

```ts
export type ReportCategory = "inapproprie" | "spam" | "illegal" | "doublon" | "autre";
export type ReportStatus = "pending" | "dismissed" | "actioned";

export type Report = {
  id: string;
  post_id: string;
  reporter_id: string;
  category: ReportCategory;
  reason: string | null;
  status: ReportStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  profiles?: { display_name: string };
};
```

- [ ] **Step 3: Create AuditLog types**

Create `packages/shared/src/types/audit.ts`:

```ts
export type AuditAction =
  | "post_hidden"
  | "post_deleted"
  | "post_restored"
  | "report_dismissed"
  | "report_actioned"
  | "producer_approved"
  | "producer_rejected"
  | "user_approved"
  | "role_changed";

export type AuditLog = {
  id: string;
  commune_id: string;
  actor_id: string | null;
  action: AuditAction;
  target_type: string;
  target_id: string;
  reason: string | null;
  created_at: string;
  profiles?: { display_name: string } | null;
};
```

- [ ] **Step 4: Update type exports**

In `packages/shared/src/types/index.ts`, add:

```ts
export type { Report, ReportCategory, ReportStatus } from "./report";
export type { AuditLog, AuditAction } from "./audit";
```

- [ ] **Step 5: Update roles constant**

In `packages/shared/src/constants/roles.ts`:

```ts
import type { Role } from "../types";

export const ROLE_LABELS: Record<Role, string> = {
  resident: "Résident",
  moderator: "Modérateur",
  admin: "Administrateur",
  epci_admin: "Admin EPCI",
};

export const ADMIN_ROLES: Role[] = ["admin", "epci_admin"];
export const MODERATOR_ROLES: Role[] = ["moderator", "admin", "epci_admin"];
```

- [ ] **Step 6: Create report categories constant**

Create `packages/shared/src/constants/report-categories.ts`:

```ts
import type { ReportCategory } from "../types";

export const REPORT_CATEGORIES: { value: ReportCategory; label: string; emoji: string }[] = [
  { value: "inapproprie", label: "Contenu inapproprié", emoji: "🚫" },
  { value: "spam", label: "Spam / publicité", emoji: "📢" },
  { value: "illegal", label: "Contenu illégal", emoji: "⚠️" },
  { value: "doublon", label: "Doublon", emoji: "🔄" },
  { value: "autre", label: "Autre", emoji: "🤷" },
];
```

- [ ] **Step 7: Update constants index**

In `packages/shared/src/constants/index.ts`, add:

```ts
export { REPORT_CATEGORIES } from "./report-categories";
export { MODERATOR_ROLES } from "./roles";
```

- [ ] **Step 8: Commit**

```bash
git add packages/shared/src/
git commit -m "feat(shared): add types and constants for reports, audit log, moderator role"
```

---

## Task 3: Shared Queries

**Files:**
- Create: `packages/shared/src/queries/reports.ts`
- Create: `packages/shared/src/queries/audit.ts`
- Modify: `packages/shared/src/queries/posts.ts`
- Modify: `packages/shared/src/queries/admin.ts`
- Modify: `packages/shared/src/queries/index.ts`

- [ ] **Step 1: Create reports queries**

Create `packages/shared/src/queries/reports.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ReportCategory } from "../types";

type Client = SupabaseClient<Database>;

export async function createReport(
  client: Client,
  postId: string,
  reporterId: string,
  category: ReportCategory,
  reason: string | null
) {
  return client
    .from("reports")
    .insert({ post_id: postId, reporter_id: reporterId, category, reason })
    .select()
    .single();
}

export async function getPendingReports(client: Client, communeId: string) {
  return client
    .from("reports")
    .select("*, profiles!reporter_id(display_name), posts!post_id(id, title, author_id, commune_id, profiles!author_id(display_name))")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
}

export async function getReportsByPost(client: Client, postId: string) {
  return client
    .from("reports")
    .select("*, profiles!reporter_id(display_name)")
    .eq("post_id", postId)
    .order("created_at", { ascending: false });
}

export async function dismissReport(client: Client, reportId: string, reviewerId: string) {
  return client
    .from("reports")
    .update({ status: "dismissed", reviewed_by: reviewerId, reviewed_at: new Date().toISOString() })
    .eq("id", reportId);
}

export async function actionReport(client: Client, reportId: string, reviewerId: string) {
  return client
    .from("reports")
    .update({ status: "actioned", reviewed_by: reviewerId, reviewed_at: new Date().toISOString() })
    .eq("id", reportId);
}

export async function getReporterStats(client: Client, reporterId: string) {
  const { data } = await client
    .from("reports")
    .select("status")
    .eq("reporter_id", reporterId);
  const total = data?.length ?? 0;
  const dismissed = data?.filter((r) => r.status === "dismissed").length ?? 0;
  return { total, dismissed };
}

export async function hasUserReported(client: Client, postId: string, userId: string) {
  const { data } = await client
    .from("reports")
    .select("id")
    .eq("post_id", postId)
    .eq("reporter_id", userId)
    .maybeSingle();
  return !!data;
}
```

- [ ] **Step 2: Create audit log queries**

Create `packages/shared/src/queries/audit.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, AuditAction } from "../types";

type Client = SupabaseClient<Database>;

export async function logAction(
  client: Client,
  communeId: string,
  actorId: string | null,
  action: AuditAction,
  targetType: string,
  targetId: string,
  reason?: string | null
) {
  return client.from("audit_log").insert({
    commune_id: communeId,
    actor_id: actorId,
    action,
    target_type: targetType,
    target_id: targetId,
    reason: reason ?? null,
  });
}

export async function getAuditLog(client: Client, communeId: string, limit = 50) {
  return client
    .from("audit_log")
    .select("*, profiles!actor_id(display_name)")
    .eq("commune_id", communeId)
    .order("created_at", { ascending: false })
    .limit(limit);
}

export async function getMyAuditLog(client: Client, actorId: string, limit = 50) {
  return client
    .from("audit_log")
    .select("*, profiles!actor_id(display_name)")
    .eq("actor_id", actorId)
    .order("created_at", { ascending: false })
    .limit(limit);
}
```

- [ ] **Step 3: Update posts queries — add is_hidden filter + pagination helper**

In `packages/shared/src/queries/posts.ts`, modify `getPosts` to add `is_hidden = false`:

```ts
export async function getPosts(client: Client, communeId: string) {
  return client
    .from("posts")
    .select("*, profiles!author_id(display_name, avatar_url), post_images(id, storage_path), comments(count), rsvps(status)")
    .eq("commune_id", communeId)
    .eq("is_hidden", false)
    .or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });
}
```

Add new pagination query:

```ts
export async function getPostsPaginated(
  client: Client,
  communeId: string,
  cursor: string | null,
  limit = 20
) {
  let query = client
    .from("posts")
    .select("*, profiles!author_id(display_name, avatar_url), post_images(id, storage_path), comments(count), rsvps(status)")
    .eq("commune_id", communeId)
    .eq("is_hidden", false)
    .eq("is_pinned", false)
    .or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  return query;
}

export async function getPinnedPosts(client: Client, communeId: string) {
  return client
    .from("posts")
    .select("*, profiles!author_id(display_name, avatar_url), post_images(id, storage_path), comments(count), rsvps(status)")
    .eq("commune_id", communeId)
    .eq("is_hidden", false)
    .eq("is_pinned", true)
    .or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
    .order("created_at", { ascending: false });
}
```

Also apply `is_hidden = false` to `getPostsByType`.

- [ ] **Step 4: Update admin queries — add moderator promotion**

In `packages/shared/src/queries/admin.ts`, add:

```ts
export async function promoteToModerator(client: Client, userId: string) {
  return client.from("profiles").update({ role: "moderator" }).eq("id", userId);
}
```

- [ ] **Step 5: Update queries index**

In `packages/shared/src/queries/index.ts`, add:

```ts
export { createReport, getPendingReports, getReportsByPost, dismissReport, actionReport, getReporterStats, hasUserReported } from "./reports";
export { logAction, getAuditLog, getMyAuditLog } from "./audit";
export { getPostsPaginated, getPinnedPosts } from "./posts";
export { promoteToModerator } from "./admin";
```

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/
git commit -m "feat(shared): add queries for reports, audit log, pagination, moderator promotion"
```

---

## Task 4: Feed Pagination (Web)

**Files:**
- Modify: `apps/web/src/app/app/feed/page.tsx`
- Create: `apps/web/src/app/app/feed/feed-content.tsx`
- Create: `apps/web/src/app/app/feed/load-more-action.ts`

- [ ] **Step 1: Create load-more server action**

Create `apps/web/src/app/app/feed/load-more-action.ts`:

```ts
"use server";

import { createClient } from "@/lib/supabase/server";
import type { Post } from "@rural-community-platform/shared";

export async function loadMorePosts(
  communeId: string,
  cursor: string,
  types: string[],
  dateFilter: string
) {
  const supabase = await createClient();

  let query = supabase
    .from("posts")
    .select("*, profiles!author_id(display_name, avatar_url), post_images(id, storage_path), comments(count), rsvps(status)")
    .eq("commune_id", communeId)
    .eq("is_hidden", false)
    .eq("is_pinned", false)
    .or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
    .lt("created_at", cursor)
    .order("created_at", { ascending: false })
    .limit(20);

  if (types.length > 0) {
    query = query.in("type", types);
  }

  if (dateFilter === "today") {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    query = query.gte("created_at", d.toISOString());
  } else if (dateFilter === "week") {
    const d = new Date(); d.setDate(d.getDate() - 7);
    query = query.gte("created_at", d.toISOString());
  } else if (dateFilter === "month") {
    const d = new Date(); d.setDate(d.getDate() - 30);
    query = query.gte("created_at", d.toISOString());
  }

  const { data } = await query;
  return (data ?? []) as Post[];
}
```

- [ ] **Step 2: Create FeedContent client component**

Create `apps/web/src/app/app/feed/feed-content.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PostCard } from "@/components/post-card";
import { loadMorePosts } from "./load-more-action";
import type { Post } from "@rural-community-platform/shared";

interface FeedContentProps {
  initialPosts: Post[];
  pinnedPosts: Post[];
  communeId: string;
  types: string[];
  dateFilter: string;
}

export function FeedContent({ initialPosts, pinnedPosts, communeId, types, dateFilter }: FeedContentProps) {
  const [posts, setPosts] = useState(initialPosts);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialPosts.length >= 20);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset when filters change
  useEffect(() => {
    setPosts(initialPosts);
    setHasMore(initialPosts.length >= 20);
  }, [initialPosts]);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore || posts.length === 0) return;
    setLoading(true);

    const cursor = posts[posts.length - 1].created_at;
    const newPosts = await loadMorePosts(communeId, cursor, types, dateFilter);

    if (newPosts.length < 20) setHasMore(false);
    setPosts((prev) => [...prev, ...newPosts]);
    setLoading(false);
  }, [loading, hasMore, posts, communeId, types, dateFilter]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  return (
    <div className="space-y-4">
      {/* Pinned posts always at top */}
      {pinnedPosts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}

      {/* Regular posts */}
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}

      {/* Sentinel for infinite scroll */}
      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-4">
          {loading && (
            <p className="text-sm text-[var(--muted-foreground)]">Chargement...</p>
          )}
        </div>
      )}

      {!hasMore && posts.length > 0 && (
        <p className="py-4 text-center text-sm text-[var(--muted-foreground)]">
          Aucune publication plus ancienne.
        </p>
      )}

      {pinnedPosts.length === 0 && posts.length === 0 && (
        <p className="py-8 text-center text-[var(--muted-foreground)]">
          Aucune publication pour cette sélection.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Update feed page to use pagination**

Modify `apps/web/src/app/app/feed/page.tsx`:
- Split query into pinned + first page (limit 20, non-pinned)
- Add `is_hidden = false` filter
- Pass data to `<FeedContent>` client component instead of rendering posts directly
- Keep all existing elements (header, scope toggle, filters, producer banner)

The pinned query:
```ts
const { data: pinnedPosts } = await supabase
  .from("posts")
  .select("*, profiles!author_id(display_name, avatar_url), post_images(id, storage_path), comments(count), rsvps(status)")
  .eq("commune_id", profile.commune_id)
  .eq("is_hidden", false)
  .eq("is_pinned", true)
  .or("expires_at.is.null,expires_at.gt." + new Date().toISOString());
```

The first page query:
```ts
let query = supabase
  .from("posts")
  .select("*, profiles!author_id(display_name, avatar_url), post_images(id, storage_path), comments(count), rsvps(status)")
  .eq("commune_id", profile.commune_id)
  .eq("is_hidden", false)
  .eq("is_pinned", false)
  .or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
  .order("created_at", { ascending: false })
  .limit(20);
// ... apply type and date filters ...
```

Replace the posts rendering with:
```tsx
<FeedContent
  initialPosts={(posts ?? []) as Post[]}
  pinnedPosts={(pinnedPosts ?? []) as Post[]}
  communeId={profile.commune_id}
  types={selectedTypes}
  dateFilter={dateFilter}
/>
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/app/feed/
git commit -m "feat(web): cursor-based feed pagination with infinite scroll"
```

---

## Task 5: Feed Pagination (Mobile)

**Files:**
- Modify: `apps/mobile/src/app/(tabs)/feed.tsx`

- [ ] **Step 1: Add cursor-based pagination to mobile feed**

In `apps/mobile/src/app/(tabs)/feed.tsx`:

Add state for pagination:
```ts
const [cursor, setCursor] = useState<string | null>(null);
const [hasMore, setHasMore] = useState(true);
const [loadingMore, setLoadingMore] = useState(false);
```

Modify `loadPosts` to load pinned + first 20 non-pinned separately:
```ts
const loadPosts = useCallback(async () => {
  if (!profile?.commune_id) return;

  // Load pinned
  const { data: pinned } = await supabase
    .from("posts")
    .select("*, profiles!author_id(display_name, avatar_url), post_images(id, storage_path), comments(count), rsvps(status)")
    .eq("commune_id", profile.commune_id)
    .eq("is_hidden", false)
    .eq("is_pinned", true)
    .or("expires_at.is.null,expires_at.gt." + new Date().toISOString());

  // Load first page
  const { data } = await supabase
    .from("posts")
    .select("*, profiles!author_id(display_name, avatar_url), post_images(id, storage_path), comments(count), rsvps(status)")
    .eq("commune_id", profile.commune_id)
    .eq("is_hidden", false)
    .eq("is_pinned", false)
    .or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(20);

  const allPosts = [...(pinned ?? []), ...(data ?? [])] as Post[];
  setPosts(allPosts);
  setHasMore((data ?? []).length >= 20);
  setCursor(data?.length ? data[data.length - 1].created_at : null);

  // Load producer count
  const { data: producers } = await getProducers(supabase);
  if (producers) setProducerCount(producers.length);
}, [profile?.commune_id, scope]);
```

Add `loadMore` function:
```ts
const loadMore = useCallback(async () => {
  if (loadingMore || !hasMore || !cursor || !profile?.commune_id) return;
  setLoadingMore(true);

  const { data } = await supabase
    .from("posts")
    .select("*, profiles!author_id(display_name, avatar_url), post_images(id, storage_path), comments(count), rsvps(status)")
    .eq("commune_id", profile.commune_id)
    .eq("is_hidden", false)
    .eq("is_pinned", false)
    .or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
    .lt("created_at", cursor)
    .order("created_at", { ascending: false })
    .limit(20);

  if (data) {
    setPosts((prev) => [...prev, ...(data as Post[])]);
    setHasMore(data.length >= 20);
    setCursor(data.length ? data[data.length - 1].created_at : null);
  }
  setLoadingMore(false);
}, [loadingMore, hasMore, cursor, profile?.commune_id]);
```

Add to FlatList:
```tsx
onEndReached={loadMore}
onEndReachedThreshold={0.5}
ListFooterComponent={loadingMore ? <ActivityIndicator style={{ padding: 16 }} /> : null}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/app/\(tabs\)/feed.tsx
git commit -m "feat(mobile): cursor-based feed pagination with infinite scroll"
```

---

## Task 6: Post Reporting (Web)

**Files:**
- Create: `apps/web/src/components/report-dialog.tsx`
- Create: `apps/web/src/app/app/posts/[id]/report-action.ts`
- Modify: `apps/web/src/components/post-card.tsx`

- [ ] **Step 1: Create report server action**

Create `apps/web/src/app/app/posts/[id]/report-action.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ReportCategory } from "@rural-community-platform/shared";

export async function reportPostAction(postId: string, category: ReportCategory, reason: string | null) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };

  // Check if already reported
  const { data: existing } = await supabase
    .from("reports")
    .select("id")
    .eq("post_id", postId)
    .eq("reporter_id", user.id)
    .maybeSingle();

  if (existing) return { error: "Vous avez déjà signalé cette publication" };

  const { error } = await supabase
    .from("reports")
    .insert({ post_id: postId, reporter_id: user.id, category, reason });

  if (error) return { error: "Erreur lors du signalement" };

  revalidatePath("/app/feed");
  return { error: null };
}
```

- [ ] **Step 2: Create report dialog component**

Create `apps/web/src/components/report-dialog.tsx`:

A shadcn Dialog with:
- Category picker: radio buttons with emoji + label for each REPORT_CATEGORIES
- Optional reason textarea (required when category is "autre")
- Submit button calls reportPostAction
- Success state: "Merci, votre signalement a été pris en compte."

```tsx
"use client";

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Flag } from "lucide-react";
import { REPORT_CATEGORIES } from "@rural-community-platform/shared";
import type { ReportCategory } from "@rural-community-platform/shared";
import { reportPostAction } from "@/app/app/posts/[id]/report-action";

export function ReportDialog({ postId }: { postId: string }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!category) return;
    if (category === "autre" && !reason.trim()) return;
    setLoading(true);
    setError(null);

    const result = await reportPostAction(postId, category, reason || null);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(true);
    }
    setLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setCategory(null); setReason(""); setSuccess(false); setError(null); } }}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-1 text-xs text-[var(--muted-foreground)] transition-colors hover:text-red-500" title="Signaler">
          <Flag size={12} />
          Signaler
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Signaler cette publication</DialogTitle>
        </DialogHeader>
        {success ? (
          <p className="py-4 text-center text-sm text-green-700">
            Merci, votre signalement a été pris en compte.
          </p>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-[var(--muted-foreground)]">
              Pourquoi signalez-vous cette publication ?
            </p>
            <div className="space-y-2">
              {REPORT_CATEGORIES.map((cat) => (
                <label
                  key={cat.value}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors ${category === cat.value ? "border-red-300 bg-red-50" : "border-gray-200 hover:bg-gray-50"}`}
                >
                  <input
                    type="radio"
                    name="category"
                    value={cat.value}
                    checked={category === cat.value}
                    onChange={() => setCategory(cat.value)}
                    className="sr-only"
                  />
                  <span>{cat.emoji}</span>
                  <span>{cat.label}</span>
                </label>
              ))}
            </div>
            <Textarea
              placeholder={category === "autre" ? "Précisez la raison (obligatoire)" : "Détails supplémentaires (optionnel)"}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              rows={3}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button
              onClick={handleSubmit}
              disabled={!category || loading || (category === "autre" && !reason.trim())}
              variant="destructive"
              className="w-full"
            >
              {loading ? "Envoi..." : "Envoyer le signalement"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Add report button to post card**

In `apps/web/src/components/post-card.tsx`, add a `<ReportDialog postId={post.id} />` in the footer/meta row. Import it. Don't show it on the user's own posts (need to pass `currentUserId` prop or handle it differently — simplest: always show, the server action will handle the "already reported" case).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/report-dialog.tsx apps/web/src/app/app/posts/ apps/web/src/components/post-card.tsx
git commit -m "feat(web): add post reporting with category picker and flag icon"
```

---

## Task 7: Post Reporting (Mobile)

**Files:**
- Create: `apps/mobile/src/components/report-dialog.tsx`
- Modify: `apps/mobile/src/components/post-card.tsx`
- Modify: `apps/mobile/src/app/post/[id].tsx`

- [ ] **Step 1: Create mobile report dialog**

Create `apps/mobile/src/components/report-dialog.tsx`:

A React Native Modal with:
- Category picker as TouchableOpacity rows with emoji + label
- Optional TextInput for reason
- Submit button calls supabase directly
- Same category list as web (REPORT_CATEGORIES from shared)
- Success/error states

- [ ] **Step 2: Add report to post card and detail**

In `apps/mobile/src/components/post-card.tsx`, add a small Flag icon button.
In `apps/mobile/src/app/post/[id].tsx`, add a "Signaler" button.

Both open the ReportDialog modal.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/
git commit -m "feat(mobile): add post reporting with category picker"
```

---

## Task 8: Moderator Dashboard & Role (Web)

**Files:**
- Modify: `apps/web/src/hooks/use-profile.ts`
- Modify: `apps/web/src/components/nav-bar.tsx`
- Create: `apps/web/src/app/moderation/dashboard/page.tsx`
- Create: `apps/web/src/app/moderation/report-queue.tsx`
- Create: `apps/web/src/app/moderation/report-actions.ts`
- Create: `apps/web/src/app/moderation/audit-log-view.tsx`
- Modify: `apps/web/src/app/admin/dashboard/page.tsx`

- [ ] **Step 1: Update useProfile hook**

In `apps/web/src/hooks/use-profile.ts`, add:

```ts
return {
  profile,
  loading,
  isAdmin: profile?.role === "admin",
  isModerator: profile?.role === "moderator" || profile?.role === "admin",
};
```

- [ ] **Step 2: Update nav bar for moderators**

In `apps/web/src/components/nav-bar.tsx`, show a "Modération" link for moderators (instead of "Admin") and keep "Admin" for admins. Use `isModerator` and `isAdmin` from useProfile.

```tsx
{isAdmin && (
  <Link href="/admin/dashboard" ...>Admin</Link>
)}
{!isAdmin && isModerator && (
  <Link href="/moderation/dashboard" ...>Modération</Link>
)}
```

- [ ] **Step 3: Create moderator dashboard page**

Create `apps/web/src/app/moderation/dashboard/page.tsx`:

Server component. Auth check — redirect if not moderator or admin. Shows:
- Report queue (ReportQueue component)
- Pending producers (reuse PendingProducers from admin)
- Audit log (own actions only for moderators)

- [ ] **Step 4: Create report queue component**

Create `apps/web/src/app/moderation/report-queue.tsx`:

Client component listing pending reports grouped by post. For each post:
- Post title, author name, report count
- Expandable: list of individual reports with category emoji, reason text, reporter name, reporter stats (X dismissed / Y total)
- Action buttons: "Restaurer" (dismiss all reports, unhide) and "Supprimer" (delete post, mark actioned)

- [ ] **Step 5: Create report server actions**

Create `apps/web/src/app/moderation/report-actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function restorePostAction(postId: string, reason?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };

  // Unhide the post
  await supabase.from("posts").update({ is_hidden: false }).eq("id", postId);

  // Dismiss all pending reports on this post
  await supabase
    .from("reports")
    .update({ status: "dismissed", reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq("post_id", postId)
    .eq("status", "pending");

  // Get commune_id for audit log
  const { data: post } = await supabase.from("posts").select("commune_id").eq("id", postId).single();

  // Audit log
  if (post) {
    await supabase.from("audit_log").insert({
      commune_id: post.commune_id,
      actor_id: user.id,
      action: "post_restored",
      target_type: "post",
      target_id: postId,
      reason: reason ?? "Signalements rejetés",
    });
  }

  revalidatePath("/moderation/dashboard");
  return { error: null };
}

export async function deleteReportedPostAction(postId: string, reason?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };

  // Get commune_id before deletion
  const { data: post } = await supabase.from("posts").select("commune_id").eq("id", postId).single();

  // Mark all reports as actioned
  await supabase
    .from("reports")
    .update({ status: "actioned", reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq("post_id", postId)
    .eq("status", "pending");

  // Delete the post
  await supabase.from("posts").delete().eq("id", postId);

  // Audit log
  if (post) {
    await supabase.from("audit_log").insert({
      commune_id: post.commune_id,
      actor_id: user.id,
      action: "post_deleted",
      target_type: "post",
      target_id: postId,
      reason: reason ?? "Supprimé suite à signalement",
    });
  }

  revalidatePath("/moderation/dashboard");
  return { error: null };
}
```

- [ ] **Step 6: Create audit log view component**

Create `apps/web/src/app/moderation/audit-log-view.tsx`:

Client component. Reverse-chronological list of audit entries. Each row:
- Actor name (or "Système" if null) + action verb + target description
- Timestamp
- Reason (if provided)

Format: "Secrétariat Mairie a supprimé un post — 14 avr. à 10:32 — Raison : contenu illégal"

- [ ] **Step 7: Add moderator promotion to admin dashboard**

In `apps/web/src/app/admin/dashboard/page.tsx`:
- Add "Promouvoir modérateur" button to user management (alongside existing promote/demote)
- Add audit log section at the bottom (full commune log, not just own actions)

- [ ] **Step 8: Add moderator badge to post cards**

In `apps/web/src/components/post-card.tsx`, show a shield icon + "Modérateur" next to the author name when the post author's role is moderator. This requires the post query to include the author's role — modify the select to add `profiles!author_id(display_name, avatar_url, role)`.

Similarly update `apps/mobile/src/components/post-card.tsx`.

- [ ] **Step 9: Commit**

```bash
git add apps/web/
git commit -m "feat(web): moderator dashboard with report queue, audit log, role promotion"
```

---

## Task 9: Word Filter & Rate Limiting (Web + Mobile)

**Files:**
- Modify: `apps/web/src/app/app/feed/actions.ts`
- Modify: `apps/mobile/src/app/(tabs)/create.tsx`

- [ ] **Step 1: Add word filter + rate limiting to web create action**

In `apps/web/src/app/app/feed/actions.ts`, after validation and before insert:

```ts
// Rate limiting (skip for moderators/admins)
if (profile.role === "resident") {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: dailyCount } = await supabase
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("author_id", user.id)
    .gte("created_at", oneDayAgo);

  if ((dailyCount ?? 0) >= 5) {
    return { error: "Vous avez atteint la limite de publications pour aujourd'hui (5 maximum)" };
  }

  if (parsed.data.type === "service") {
    const { count: serviceCount } = await supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("author_id", user.id)
      .eq("type", "service")
      .gte("created_at", oneDayAgo);

    if ((serviceCount ?? 0) >= 2) {
      return { error: "Vous avez atteint la limite d'annonces de service pour aujourd'hui (2 maximum)" };
    }
  }
}

// Word filter check
const { data: bannedWords } = await supabase.from("word_filters").select("word");
if (bannedWords) {
  const text = `${parsed.data.title} ${parsed.data.body}`.toLowerCase();
  const matchedWord = bannedWords.find((w) => {
    const regex = new RegExp(`\\b${w.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    return regex.test(text);
  });

  if (matchedWord) {
    // Insert post as hidden
    const { data: post, error } = await supabase
      .from("posts")
      .insert({
        ...parsed.data,
        commune_id: profile.commune_id,
        author_id: user.id,
        expires_at: expiresAt,
        is_hidden: true,
      })
      .select()
      .single();

    if (error || !post) return { error: "Erreur lors de la publication" };

    // Auto-report
    await supabase.from("reports").insert({
      post_id: post.id,
      reporter_id: user.id,
      category: "autre",
      reason: `Mot filtré automatiquement : ${matchedWord.word}`,
    });

    // Audit log
    await supabase.from("audit_log").insert({
      commune_id: profile.commune_id,
      actor_id: null,
      action: "post_hidden",
      target_type: "post",
      target_id: post.id,
      reason: `Filtre automatique : ${matchedWord.word}`,
    });

    // Handle poll creation even for hidden posts
    if (pollDataStr) {
      const pollData: CreatePollInput = JSON.parse(pollDataStr);
      await createPoll(supabase, post.id, pollData);
    }

    revalidatePath("/app/feed");
    return { error: null, warning: "Votre publication est en cours de vérification." };
  }
}
```

Update the return type to include optional `warning`.

- [ ] **Step 2: Add rate limiting to mobile create**

In `apps/mobile/src/app/(tabs)/create.tsx`, add a rate limit check before insert:

```ts
// Rate limiting
if (profile.role === "resident") {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: dailyCount } = await supabase
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("author_id", profile.id)
    .gte("created_at", oneDayAgo);

  if ((dailyCount ?? 0) >= 5) {
    Alert.alert("Limite atteinte", "Vous avez atteint la limite de publications pour aujourd'hui (5 maximum)");
    setLoading(false);
    return;
  }
}
```

Add word filter check similarly — fetch banned words, check title + body, if match: insert with `is_hidden: true`, show Alert "Votre publication est en cours de vérification."

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/app/feed/actions.ts apps/mobile/src/app/\(tabs\)/create.tsx
git commit -m "feat: add word filter and rate limiting to post creation"
```

---

## Task 10: Seed Data & Final Verification

**Files:**
- Modify: `supabase/seed.sql`

- [ ] **Step 1: Add moderator profile to seed**

In Saint-Médard, promote Jeanne Larrieu to moderator (she's active and engaged — good fit):

Actually, add a new user as moderator to keep Jeanne as a resident for testing:

```sql
-- Add moderator user for Saint-Médard
-- In auth.users INSERT, add:
(
  '00000000-0000-0000-0000-000000000103',
  '00000000-0000-0000-0000-000000000000',
  'moderateur@saintmedard64.fr',
  crypt('demo1234', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}', '{}',
  'authenticated', 'authenticated',
  '', '', '', '',
  NULL, '', '', '', '',
  false, false
)

-- In auth.identities INSERT, add:
(
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000103',
  '00000000-0000-0000-0000-000000000103',
  'email',
  jsonb_build_object('sub', '00000000-0000-0000-0000-000000000103', 'email', 'moderateur@saintmedard64.fr', 'email_verified', true, 'phone_verified', false),
  now(), now(), now()
)

-- In profiles INSERT, add:
('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000010', 'Sophie Dupin', 'moderator', 'active')
```

- [ ] **Step 2: Update README with moderator account**

Add to the Saint-Médard section:
```
| Moderator | moderateur@saintmedard64.fr | Sophie Dupin |
```

- [ ] **Step 3: Reset DB and smoke test**

Run: `npx supabase db reset`
Test:
- Login as Pierre → feed loads with pagination (scroll to bottom, more posts load)
- Create a post → works, rate limit kicks in after 5
- Report a post → flag icon, category dialog, confirmation
- Login as moderateur → Modération nav link, report queue, audit log
- Login as secretaire → Admin dashboard, full audit log, can promote to moderator

- [ ] **Step 4: Commit**

```bash
git add supabase/seed.sql README.md
git commit -m "chore: add moderator seed data, update README"
```

---

## Future Tasks (tracked, not built)

- **Comment reporting** — extend reporting to comments, not just posts
- **Admin word filter UI** — CRUD interface for managing the word list
- **Automated reporter penalties** — weight decay for habitual false reporters
- **Notification on report action** — notify post author when their post is restored or deleted
