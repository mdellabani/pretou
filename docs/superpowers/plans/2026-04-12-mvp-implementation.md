# MVP Implementation Plan (v1 — Community Board)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the MVP community board — a multi-tenant platform where small French communes can post announcements, events, and community messages, with mairie admin moderation. Delivered as a monorepo with a Next.js web app and Expo mobile app sharing a common TypeScript package and Supabase backend.

**Architecture:** Turborepo monorepo with `apps/web` (Next.js 16, App Router), `apps/mobile` (Expo SDK 52, Expo Router), `packages/shared` (types, queries, validation), and `supabase/` (schema, RLS, Edge Functions). Multi-tenant via `commune_id` on all tables, secured by Supabase RLS.

**Tech Stack:** Next.js 16, Expo SDK 52, TypeScript, Supabase (Postgres + Auth + Realtime + Storage), Tailwind CSS v4, shadcn/ui, Zod, Turborepo, pnpm

**Bootstrapped with:** Forge (`/home/mde/Code/personal/forge`) — monorepo mode with `db-supabase`, `auth-supabase`, `push-notifications`, `camera`, `geolocation` modules. This scaffolds the monorepo structure, Supabase client setup (web + mobile), auth pages, push notification plumbing, camera/image picker utilities, and shared package skeleton.

**Spec:** `docs/superpowers/specs/2026-04-12-architecture-design.md`

---

## Phase 1: Foundation

### Task 1: Scaffold with Forge

**What Forge generates for us:**
- Root monorepo: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.gitignore`
- `apps/web/` — Next.js 16 with Tailwind v4, shadcn/ui, Vitest
- `apps/mobile/` — Expo 52 with Expo Router, React Query
- `packages/shared/` — TypeScript package with types, constants, validation skeletons
- Supabase clients: `apps/web/src/lib/supabase/{client,server,middleware}.ts`
- Mobile Supabase client: `apps/mobile/src/lib/supabase.ts` (with SecureStore)
- Auth pages: `apps/web/src/app/auth/{login,signup,callback}`, `apps/mobile/src/app/auth/{login,signup}.tsx`
- Auth validation: `packages/shared/src/validation/auth.schema.ts`
- Middleware: `apps/web/src/middleware.ts`
- Push notifications: `apps/mobile/src/lib/notifications.ts`, `apps/mobile/src/hooks/use-notifications.ts`
- Camera utilities: `apps/mobile/src/lib/camera.ts`, `apps/mobile/src/components/image-picker-button.tsx`
- Supabase config: `supabase/config.toml`, `supabase/migrations/.gitkeep`, `supabase/seed.sql`
- Environment files: `.env.example` with Supabase vars

- [ ] **Step 1: Scaffold the project**

Run from a temporary directory (Forge creates into a new folder):
```bash
cd /tmp && npx /home/mde/Code/personal/forge/packages/create-forge rural-community-platform --mode=monorepo --modules db-supabase,auth-supabase,push-notifications,camera,geolocation
```

- [ ] **Step 2: Copy generated files into our repo**

Copy the scaffolded files into our existing repo (which already has design docs):
```bash
cp -r /tmp/rural-community-platform/* /home/mde/Code/personal/rural-community-platform/
cp -r /tmp/rural-community-platform/.* /home/mde/Code/personal/rural-community-platform/ 2>/dev/null || true
```

Be careful not to overwrite existing files like `design.md`, `CLAUDE.md`, and `docs/`.

- [ ] **Step 3: Install dependencies**

```bash
pnpm install
```

- [ ] **Step 4: Start local Supabase**

```bash
npx supabase start
```

Copy the `anon key` and `service_role key` from output into `.env.local` files for both web and mobile.

- [ ] **Step 5: Verify everything starts**

Run:
```bash
pnpm dev
```

Expected: Both web (http://localhost:3000) and mobile (Expo) dev servers start.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold monorepo with Forge (db-supabase, auth-supabase, push, camera, geo)"
```

---

### Task 2: Database Schema & RLS

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`
- Modify: `supabase/seed.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/001_initial_schema.sql`:
```sql
-- EPCI (intercommunalités)
CREATE TABLE epci (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Communes (tenants)
CREATE TABLE communes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  epci_id UUID REFERENCES epci(id),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  code_postal TEXT,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#1e40af',
  invite_code TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(6), 'hex'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User profiles (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  commune_id UUID NOT NULL REFERENCES communes(id),
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'resident' CHECK (role IN ('resident', 'admin', 'epci_admin')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'rejected')),
  push_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Posts (community board)
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commune_id UUID NOT NULL REFERENCES communes(id),
  author_id UUID NOT NULL REFERENCES profiles(id),
  type TEXT NOT NULL CHECK (type IN ('annonce', 'evenement', 'entraide', 'discussion')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  epci_visible BOOLEAN NOT NULL DEFAULT false,
  event_date TIMESTAMPTZ,
  event_location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Post images
CREATE TABLE post_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Comments
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RSVPs (for events)
CREATE TABLE rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  status TEXT NOT NULL CHECK (status IN ('going', 'maybe', 'not_going')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- Indexes
CREATE INDEX idx_communes_epci_id ON communes(epci_id);
CREATE INDEX idx_communes_slug ON communes(slug);
CREATE INDEX idx_profiles_commune_id ON profiles(commune_id);
CREATE INDEX idx_posts_commune_id ON posts(commune_id);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX idx_posts_type ON posts(type);
CREATE INDEX idx_comments_post_id ON comments(post_id);
CREATE INDEX idx_rsvps_post_id ON rsvps(post_id);

-- Row Level Security
ALTER TABLE epci ENABLE ROW LEVEL SECURITY;
ALTER TABLE communes ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE rsvps ENABLE ROW LEVEL SECURITY;

-- Helper: get current user's commune_id
CREATE OR REPLACE FUNCTION auth_commune_id()
RETURNS UUID AS $$
  SELECT commune_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: check if current user is admin in their commune
CREATE OR REPLACE FUNCTION is_commune_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin' AND status = 'active'
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: check if current user is approved
CREATE OR REPLACE FUNCTION is_approved()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND status = 'active'
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- EPCI policies
CREATE POLICY "Authenticated users can view EPCI"
  ON epci FOR SELECT TO authenticated
  USING (true);

-- Commune policies
CREATE POLICY "Authenticated users can view communes"
  ON communes FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Anon can view communes by slug"
  ON communes FOR SELECT TO anon
  USING (true);

-- Profile policies
CREATE POLICY "Users can view profiles in own commune"
  ON profiles FOR SELECT TO authenticated
  USING (commune_id = auth_commune_id());

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Admins can update profiles in own commune"
  ON profiles FOR UPDATE TO authenticated
  USING (commune_id = auth_commune_id() AND is_commune_admin());

-- Post policies
CREATE POLICY "Users can view posts in own commune"
  ON posts FOR SELECT TO authenticated
  USING (commune_id = auth_commune_id());

CREATE POLICY "Users can view EPCI-visible posts"
  ON posts FOR SELECT TO authenticated
  USING (
    epci_visible = true
    AND commune_id IN (
      SELECT c.id FROM communes c
      WHERE c.epci_id = (SELECT c2.epci_id FROM communes c2 WHERE c2.id = auth_commune_id())
    )
  );

CREATE POLICY "Anon can view posts for public website"
  ON posts FOR SELECT TO anon
  USING (type = 'annonce' OR type = 'evenement');

CREATE POLICY "Approved users can create posts"
  ON posts FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND commune_id = auth_commune_id()
    AND is_approved()
    AND (type != 'annonce' OR is_commune_admin())
  );

CREATE POLICY "Authors can update own posts"
  ON posts FOR UPDATE TO authenticated
  USING (author_id = auth.uid());

CREATE POLICY "Admins can update posts in own commune"
  ON posts FOR UPDATE TO authenticated
  USING (commune_id = auth_commune_id() AND is_commune_admin());

CREATE POLICY "Authors and admins can delete posts"
  ON posts FOR DELETE TO authenticated
  USING (
    author_id = auth.uid()
    OR (commune_id = auth_commune_id() AND is_commune_admin())
  );

-- Post image policies
CREATE POLICY "Users can view post images in own commune"
  ON post_images FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM posts WHERE posts.id = post_images.post_id
      AND posts.commune_id = auth_commune_id()
    )
  );

CREATE POLICY "Anon can view post images for public website"
  ON post_images FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM posts WHERE posts.id = post_images.post_id
      AND (posts.type = 'annonce' OR posts.type = 'evenement')
    )
  );

CREATE POLICY "Post authors can add images"
  ON post_images FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM posts WHERE posts.id = post_images.post_id AND posts.author_id = auth.uid()
    )
  );

-- Comment policies
CREATE POLICY "Users can view comments in own commune"
  ON comments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM posts WHERE posts.id = comments.post_id
      AND posts.commune_id = auth_commune_id()
    )
  );

CREATE POLICY "Approved users can create comments"
  ON comments FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND is_approved()
    AND EXISTS (
      SELECT 1 FROM posts WHERE posts.id = comments.post_id
      AND posts.commune_id = auth_commune_id()
    )
  );

CREATE POLICY "Authors can delete own comments"
  ON comments FOR DELETE TO authenticated
  USING (author_id = auth.uid());

CREATE POLICY "Admins can delete comments in own commune"
  ON comments FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM posts
      WHERE posts.id = comments.post_id
      AND posts.commune_id = auth_commune_id()
    )
    AND is_commune_admin()
  );

-- RSVP policies
CREATE POLICY "Users can view RSVPs in own commune"
  ON rsvps FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM posts WHERE posts.id = rsvps.post_id
      AND posts.commune_id = auth_commune_id()
    )
  );

CREATE POLICY "Approved users can create RSVPs"
  ON rsvps FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND is_approved());

CREATE POLICY "Users can update own RSVPs"
  ON rsvps FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own RSVPs"
  ON rsvps FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER posts_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Storage bucket for post images
INSERT INTO storage.buckets (id, name, public) VALUES ('post-images', 'post-images', true);

CREATE POLICY "Authenticated users can upload post images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'post-images');

CREATE POLICY "Anyone can view post images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'post-images');
```

- [ ] **Step 2: Write seed data**

Replace `supabase/seed.sql`:
```sql
-- Seed EPCI
INSERT INTO epci (id, name) VALUES
  ('00000000-0000-0000-0000-000000000001', 'CC du Pays de Test');

-- Seed communes
INSERT INTO communes (id, epci_id, name, slug, code_postal, invite_code) VALUES
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'Saint-Test-le-Petit', 'saint-test-le-petit', '12345', 'test01'),
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'Testville-sur-Cher', 'testville-sur-cher', '12346', 'test02');
```

- [ ] **Step 3: Apply migration and seed**

Run:
```bash
npx supabase db reset
```

Expected: Migration applied, seed data inserted. Verify in Supabase Studio at http://127.0.0.1:54323.

- [ ] **Step 4: Generate TypeScript types**

Run:
```bash
npx supabase gen types typescript --local > packages/shared/src/types/database.ts
```

- [ ] **Step 5: Commit**

```bash
git add supabase/ packages/shared/src/types/database.ts
git commit -m "feat(db): add schema with EPCI, communes, posts, comments, RSVPs, and RLS"
```

---

### Task 3: Shared Domain Types

**Files:**
- Create: `packages/shared/src/types/post.ts`
- Create: `packages/shared/src/types/commune.ts`
- Create: `packages/shared/src/types/profile.ts`
- Modify: `packages/shared/src/types/index.ts`

- [ ] **Step 1: Create domain types**

Create `packages/shared/src/types/post.ts`:
```typescript
import type { Database } from "./database";

type PostRow = Database["public"]["Tables"]["posts"]["Row"];
type PostInsert = Database["public"]["Tables"]["posts"]["Insert"];

export type PostType = "annonce" | "evenement" | "entraide" | "discussion";

export type Post = PostRow & {
  profiles: { display_name: string; avatar_url: string | null };
  post_images: { id: string; storage_path: string }[];
  comments: { count: number }[];
  rsvps: { status: string }[];
};

export type CreatePostInput = Pick<PostInsert, "title" | "body" | "type" | "event_date" | "event_location" | "epci_visible">;
```

Create `packages/shared/src/types/commune.ts`:
```typescript
import type { Database } from "./database";

export type Commune = Database["public"]["Tables"]["communes"]["Row"];
export type EPCI = Database["public"]["Tables"]["epci"]["Row"];
```

Create `packages/shared/src/types/profile.ts`:
```typescript
import type { Database } from "./database";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Role = "resident" | "admin" | "epci_admin";
export type ProfileStatus = "pending" | "active" | "rejected";
```

- [ ] **Step 2: Update types index**

Replace `packages/shared/src/types/index.ts`:
```typescript
export type { Database } from "./database";
export type { Post, PostType, CreatePostInput } from "./post";
export type { Commune, EPCI } from "./commune";
export type { Profile, Role, ProfileStatus } from "./profile";
```

- [ ] **Step 3: Verify build**

Run:
```bash
pnpm build
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/types/
git commit -m "feat(shared): add domain type definitions for posts, communes, profiles"
```

---

### Task 4: Shared Constants & Validation

**Files:**
- Create: `packages/shared/src/constants/post-types.ts`
- Create: `packages/shared/src/constants/roles.ts`
- Modify: `packages/shared/src/constants/index.ts`
- Create: `packages/shared/src/validation/post.schema.ts`
- Create: `packages/shared/src/validation/profile.schema.ts`
- Modify: `packages/shared/src/validation/index.ts`

- [ ] **Step 1: Add Zod dependency to shared**

Run:
```bash
pnpm add zod -F @rural/shared
```

Note: `@supabase/supabase-js` should already be in shared from the Forge scaffold. If not:
```bash
pnpm add @supabase/supabase-js -F @rural/shared
```

- [ ] **Step 2: Create post type constants**

Create `packages/shared/src/constants/post-types.ts`:
```typescript
import type { PostType } from "../types";

export const POST_TYPE_LABELS: Record<PostType, string> = {
  annonce: "Annonce officielle",
  evenement: "Événement",
  entraide: "Entraide",
  discussion: "Discussion",
};

export const POST_TYPE_COLORS: Record<PostType, string> = {
  annonce: "#dc2626",
  evenement: "#2563eb",
  entraide: "#16a34a",
  discussion: "#6b7280",
};

export const POST_TYPE_ICONS: Record<PostType, string> = {
  annonce: "megaphone",
  evenement: "calendar",
  entraide: "heart-handshake",
  discussion: "message-circle",
};
```

Create `packages/shared/src/constants/roles.ts`:
```typescript
import type { Role } from "../types";

export const ROLE_LABELS: Record<Role, string> = {
  resident: "Résident",
  admin: "Administrateur",
  epci_admin: "Admin EPCI",
};

export const ADMIN_ROLES: Role[] = ["admin", "epci_admin"];
```

- [ ] **Step 3: Update constants index**

Replace `packages/shared/src/constants/index.ts`:
```typescript
export { POST_TYPE_LABELS, POST_TYPE_COLORS, POST_TYPE_ICONS } from "./post-types";
export { ROLE_LABELS, ADMIN_ROLES } from "./roles";
```

- [ ] **Step 4: Create validation schemas**

Create `packages/shared/src/validation/post.schema.ts`:
```typescript
import { z } from "zod";

export const createPostSchema = z.object({
  title: z.string().min(1, "Le titre est requis").max(200, "Le titre est trop long"),
  body: z.string().min(1, "Le contenu est requis").max(5000, "Le contenu est trop long"),
  type: z.enum(["annonce", "evenement", "entraide", "discussion"]),
  event_date: z.string().datetime().nullable().optional(),
  event_location: z.string().max(200).nullable().optional(),
  epci_visible: z.boolean().default(false),
});

export type CreatePostFormData = z.infer<typeof createPostSchema>;

export const createCommentSchema = z.object({
  body: z.string().min(1, "Le commentaire est requis").max(2000, "Le commentaire est trop long"),
});

export type CreateCommentFormData = z.infer<typeof createCommentSchema>;
```

Create `packages/shared/src/validation/profile.schema.ts`:
```typescript
import { z } from "zod";

export const updateProfileSchema = z.object({
  display_name: z.string().min(2, "Le nom est trop court").max(100, "Le nom est trop long"),
  avatar_url: z.string().url().nullable().optional(),
});

export type UpdateProfileFormData = z.infer<typeof updateProfileSchema>;

export const signupSchema = z.object({
  email: z.string().email("Adresse email invalide"),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
  display_name: z.string().min(2, "Le nom est trop court").max(100, "Le nom est trop long"),
  commune_id: z.string().uuid("Commune invalide"),
});

export type SignupFormData = z.infer<typeof signupSchema>;
```

- [ ] **Step 5: Update validation index**

Replace `packages/shared/src/validation/index.ts` (Forge generated a basic `auth.schema.ts` — we replace it with our domain schemas):
```typescript
export { createPostSchema, createCommentSchema } from "./post.schema";
export type { CreatePostFormData, CreateCommentFormData } from "./post.schema";
export { updateProfileSchema, signupSchema } from "./profile.schema";
export type { UpdateProfileFormData, SignupFormData } from "./profile.schema";
```

- [ ] **Step 6: Update shared root index**

Replace `packages/shared/src/index.ts`:
```typescript
export * from "./types";
export * from "./constants";
export * from "./validation";
```

- [ ] **Step 7: Verify build**

Run:
```bash
pnpm build
```

- [ ] **Step 8: Commit**

```bash
git add packages/shared/
git commit -m "feat(shared): add constants, validation schemas for posts and profiles"
```

---

### Task 5: Shared Query Functions

**Files:**
- Create: `packages/shared/src/queries/posts.ts`
- Create: `packages/shared/src/queries/communes.ts`
- Create: `packages/shared/src/queries/profiles.ts`
- Create: `packages/shared/src/queries/admin.ts`
- Create: `packages/shared/src/queries/comments.ts`
- Create: `packages/shared/src/queries/rsvps.ts`
- Create: `packages/shared/src/queries/epci.ts`
- Create: `packages/shared/src/queries/index.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Create post queries**

Create `packages/shared/src/queries/posts.ts`:
```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, CreatePostInput } from "../types";

type Client = SupabaseClient<Database>;

export async function getPosts(client: Client, communeId: string) {
  return client
    .from("posts")
    .select("*, profiles!author_id(display_name, avatar_url), post_images(id, storage_path), comments(count), rsvps(status)")
    .eq("commune_id", communeId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });
}

export async function getPostById(client: Client, postId: string) {
  return client
    .from("posts")
    .select("*, profiles!author_id(display_name, avatar_url), post_images(id, storage_path)")
    .eq("id", postId)
    .single();
}

export async function createPost(client: Client, communeId: string, authorId: string, input: CreatePostInput) {
  return client
    .from("posts")
    .insert({ ...input, commune_id: communeId, author_id: authorId })
    .select()
    .single();
}

export async function deletePost(client: Client, postId: string) {
  return client.from("posts").delete().eq("id", postId);
}

export async function togglePinPost(client: Client, postId: string, isPinned: boolean) {
  return client.from("posts").update({ is_pinned: !isPinned }).eq("id", postId);
}

export async function getPostsByType(client: Client, communeId: string, type: string) {
  return client
    .from("posts")
    .select("*, profiles!author_id(display_name, avatar_url), post_images(id, storage_path), comments(count), rsvps(status)")
    .eq("commune_id", communeId)
    .eq("type", type)
    .order("created_at", { ascending: false });
}
```

- [ ] **Step 2: Create commune queries**

Create `packages/shared/src/queries/communes.ts`:
```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types";

type Client = SupabaseClient<Database>;

export async function getCommune(client: Client, communeId: string) {
  return client.from("communes").select("*, epci(name)").eq("id", communeId).single();
}

export async function getCommuneBySlug(client: Client, slug: string) {
  return client.from("communes").select("*, epci(name)").eq("slug", slug).single();
}

export async function getCommunesByEpci(client: Client, epciId: string) {
  return client.from("communes").select("id, name, slug").eq("epci_id", epciId);
}

export async function getAllCommunes(client: Client) {
  return client.from("communes").select("id, name, slug, code_postal").order("name");
}

export async function getCommuneByInviteCode(client: Client, inviteCode: string) {
  return client.from("communes").select("id, name, slug").eq("invite_code", inviteCode).single();
}
```

- [ ] **Step 3: Create profile queries**

Create `packages/shared/src/queries/profiles.ts`:
```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types";

type Client = SupabaseClient<Database>;

export async function getProfile(client: Client, userId: string) {
  return client.from("profiles").select("*, communes(name, slug, epci_id)").eq("id", userId).single();
}

export async function createProfile(client: Client, userId: string, communeId: string, displayName: string) {
  return client
    .from("profiles")
    .insert({ id: userId, commune_id: communeId, display_name: displayName })
    .select()
    .single();
}

export async function updateProfile(client: Client, userId: string, data: { display_name?: string; avatar_url?: string | null }) {
  return client.from("profiles").update(data).eq("id", userId).select().single();
}
```

- [ ] **Step 4: Create admin queries**

Create `packages/shared/src/queries/admin.ts`:
```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types";

type Client = SupabaseClient<Database>;

export async function getPendingUsers(client: Client, communeId: string) {
  return client
    .from("profiles")
    .select("id, display_name, created_at")
    .eq("commune_id", communeId)
    .eq("status", "pending")
    .order("created_at", { ascending: true });
}

export async function approveUser(client: Client, userId: string) {
  return client.from("profiles").update({ status: "active" }).eq("id", userId);
}

export async function rejectUser(client: Client, userId: string) {
  return client.from("profiles").update({ status: "rejected" }).eq("id", userId);
}

export async function promoteToAdmin(client: Client, userId: string) {
  return client.from("profiles").update({ role: "admin" }).eq("id", userId);
}

export async function demoteToResident(client: Client, userId: string) {
  return client.from("profiles").update({ role: "resident" }).eq("id", userId);
}

export async function getCommuneMembers(client: Client, communeId: string) {
  return client
    .from("profiles")
    .select("id, display_name, role, status, created_at")
    .eq("commune_id", communeId)
    .order("created_at", { ascending: false });
}
```

- [ ] **Step 5: Create comment queries**

Create `packages/shared/src/queries/comments.ts`:
```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types";

type Client = SupabaseClient<Database>;

export async function getComments(client: Client, postId: string) {
  return client
    .from("comments")
    .select("*, profiles!author_id(display_name, avatar_url)")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
}

export async function createComment(client: Client, postId: string, authorId: string, body: string) {
  return client
    .from("comments")
    .insert({ post_id: postId, author_id: authorId, body })
    .select("*, profiles!author_id(display_name, avatar_url)")
    .single();
}

export async function deleteComment(client: Client, commentId: string) {
  return client.from("comments").delete().eq("id", commentId);
}
```

- [ ] **Step 6: Create RSVP queries**

Create `packages/shared/src/queries/rsvps.ts`:
```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types";

type Client = SupabaseClient<Database>;

export type RsvpStatus = "going" | "maybe" | "not_going";

export async function getRsvps(client: Client, postId: string) {
  return client
    .from("rsvps")
    .select("*, profiles!user_id(display_name)")
    .eq("post_id", postId);
}

export async function setRsvp(client: Client, postId: string, userId: string, status: RsvpStatus) {
  return client
    .from("rsvps")
    .upsert({ post_id: postId, user_id: userId, status }, { onConflict: "post_id,user_id" })
    .select()
    .single();
}

export async function removeRsvp(client: Client, postId: string, userId: string) {
  return client.from("rsvps").delete().eq("post_id", postId).eq("user_id", userId);
}

export async function getRsvpCounts(client: Client, postId: string) {
  const { data } = await client
    .from("rsvps")
    .select("status")
    .eq("post_id", postId);

  const counts = { going: 0, maybe: 0, not_going: 0 };
  data?.forEach((r) => { counts[r.status as RsvpStatus]++; });
  return counts;
}
```

- [ ] **Step 7: Create EPCI query**

Create `packages/shared/src/queries/epci.ts`:
```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types";

type Client = SupabaseClient<Database>;

export async function getEpciPosts(client: Client, epciId: string) {
  const { data: communes } = await client
    .from("communes")
    .select("id")
    .eq("epci_id", epciId);

  if (!communes || communes.length === 0) return { data: [], error: null };

  const communeIds = communes.map((c) => c.id);

  return client
    .from("posts")
    .select("*, profiles!author_id(display_name, avatar_url), post_images(id, storage_path), comments(count), rsvps(status), communes!commune_id(name)")
    .in("commune_id", communeIds)
    .eq("epci_visible", true)
    .order("created_at", { ascending: false });
}
```

- [ ] **Step 8: Create queries index**

Create `packages/shared/src/queries/index.ts`:
```typescript
export { getPosts, getPostById, createPost, deletePost, togglePinPost, getPostsByType } from "./posts";
export { getCommune, getCommuneBySlug, getCommunesByEpci, getAllCommunes, getCommuneByInviteCode } from "./communes";
export { getProfile, createProfile, updateProfile } from "./profiles";
export { getPendingUsers, approveUser, rejectUser, promoteToAdmin, demoteToResident, getCommuneMembers } from "./admin";
export { getComments, createComment, deleteComment } from "./comments";
export { getRsvps, setRsvp, removeRsvp, getRsvpCounts } from "./rsvps";
export type { RsvpStatus } from "./rsvps";
export { getEpciPosts } from "./epci";
```

- [ ] **Step 9: Update shared root index**

Replace `packages/shared/src/index.ts`:
```typescript
export * from "./types";
export * from "./constants";
export * from "./validation";
export * from "./queries";
```

- [ ] **Step 10: Verify build**

Run:
```bash
pnpm build
```

- [ ] **Step 11: Commit**

```bash
git add packages/shared/src/queries/ packages/shared/src/index.ts
git commit -m "feat(shared): add all query functions (posts, communes, profiles, admin, comments, RSVPs, EPCI)"
```

---

## Phase 2: Web App

### Task 6: Customize Auth Pages for Communes

Forge gives us basic login/signup pages. We need to add commune selection to signup and profile creation post-signup.

**Files:**
- Modify: `apps/web/src/app/auth/signup/page.tsx`
- Create: `apps/web/src/app/auth/pending/page.tsx`
- Modify: `apps/web/src/lib/supabase/middleware.ts`

- [ ] **Step 1: Replace signup page with commune-aware version**

Replace `apps/web/src/app/auth/signup/page.tsx`:
```typescript
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { signupSchema } from "@rural/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SignupPage() {
  const router = useRouter();
  const [communes, setCommunes] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({ email: "", password: "", display_name: "", commune_id: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.from("communes").select("id, name").order("name").then(({ data }) => {
      if (data) setCommunes(data);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const parsed = signupSchema.safeParse(form);
    if (!parsed.success) { setError(parsed.error.errors[0].message); setLoading(false); return; }

    const supabase = createClient();
    const { data: authData, error: authError } = await supabase.auth.signUp({ email: form.email, password: form.password });
    if (authError || !authData.user) { setError(authError?.message ?? "Erreur lors de l'inscription"); setLoading(false); return; }

    const { error: profileError } = await supabase.from("profiles").insert({
      id: authData.user.id, commune_id: form.commune_id, display_name: form.display_name,
    });
    if (profileError) { setError("Erreur lors de la création du profil"); setLoading(false); return; }

    router.push("/auth/pending");
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Inscription</CardTitle>
          <CardDescription>Rejoignez votre commune</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="display_name">Votre nom</Label>
              <Input id="display_name" value={form.display_name} onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input id="password" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label>Votre commune</Label>
              <Select value={form.commune_id} onValueChange={(v) => setForm((f) => ({ ...f, commune_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Sélectionnez votre commune" /></SelectTrigger>
                <SelectContent>
                  {communes.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>{loading ? "Inscription..." : "S'inscrire"}</Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Déjà inscrit ? <Link href="/auth/login" className="underline">Se connecter</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Create pending approval page**

Create `apps/web/src/app/auth/pending/page.tsx`:
```typescript
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function PendingApprovalPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle>Inscription en attente</CardTitle>
          <CardDescription>Votre demande a été envoyée à la mairie de votre commune.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Vous recevrez un email une fois votre inscription validée par un administrateur.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Update middleware to protect /admin and /app routes**

Update `apps/web/src/lib/supabase/middleware.ts` — add route protection after the `await supabase.auth.getUser()` call:
```typescript
  const { data: { user } } = await supabase.auth.getUser();

  const isProtected = request.nextUrl.pathname.startsWith("/admin") || request.nextUrl.pathname.startsWith("/app");
  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/auth/ apps/web/src/lib/supabase/middleware.ts
git commit -m "feat(web): customize auth for commune selection, pending approval, route protection"
```

---

### Task 7: Web Feed & Post Creation

**Files:**
- Create: `apps/web/src/hooks/use-profile.ts`
- Create: `apps/web/src/components/nav-bar.tsx`
- Create: `apps/web/src/components/post-card.tsx`
- Create: `apps/web/src/components/post-type-badge.tsx`
- Create: `apps/web/src/components/create-post-dialog.tsx`
- Create: `apps/web/src/app/app/layout.tsx`
- Create: `apps/web/src/app/app/feed/page.tsx`
- Create: `apps/web/src/app/app/feed/actions.ts`

This is a large task. For each file, use the exact code from Tasks 12-14 of the previous plan version (found in git at commit `e920d00`). The files are:

- [ ] **Step 1: Create profile hook** — `apps/web/src/hooks/use-profile.ts` (same as previous plan Task 12 Step 1)
- [ ] **Step 2: Create nav bar** — `apps/web/src/components/nav-bar.tsx` (same as previous plan Task 12 Step 2)
- [ ] **Step 3: Create app layout** — `apps/web/src/app/app/layout.tsx` (same as previous plan Task 12 Step 3)
- [ ] **Step 4: Create post type badge** — `apps/web/src/components/post-type-badge.tsx` (same as previous plan Task 13 Step 1)
- [ ] **Step 5: Create post card** — `apps/web/src/components/post-card.tsx` (same as previous plan Task 13 Step 2)
- [ ] **Step 6: Create feed server action** — `apps/web/src/app/app/feed/actions.ts` (same as previous plan Task 14 Step 1)
- [ ] **Step 7: Create post dialog** — `apps/web/src/components/create-post-dialog.tsx` (same as previous plan Task 14 Step 2)
- [ ] **Step 8: Create feed page with create button** — `apps/web/src/app/app/feed/page.tsx` (same as previous plan Task 14 Step 3)

- [ ] **Step 9: Verify feed and post creation work**

Run dev server, sign up, get approved (manually in Supabase Studio), create a post.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/hooks/ apps/web/src/components/ apps/web/src/app/app/
git commit -m "feat(web): add feed page, post creation, navigation, and app layout"
```

> **For agentic workers:** The code for steps 1-8 is in the git history at commit `e920d00` in file `docs/superpowers/plans/2026-04-12-mvp-implementation.md`, Tasks 12-14. Copy the exact code from there — it was reviewed and approved.

---

### Task 8: Web Post Detail, Comments & RSVP

Same as previous plan Task 15. All code is in git at commit `e920d00`.

**Files:**
- Create: `apps/web/src/app/app/posts/[id]/page.tsx`
- Create: `apps/web/src/app/app/posts/[id]/actions.ts`
- Create: `apps/web/src/components/comment-section.tsx`
- Create: `apps/web/src/components/rsvp-buttons.tsx`

- [ ] **Step 1: Create post detail actions** — code from previous plan Task 15 Step 1
- [ ] **Step 2: Create comment section** — code from previous plan Task 15 Step 2
- [ ] **Step 3: Create RSVP buttons** — code from previous plan Task 15 Step 3
- [ ] **Step 4: Create post detail page** — code from previous plan Task 15 Step 4
- [ ] **Step 5: Verify** — create a post, view detail, add comment, RSVP to an event
- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/app/posts/ apps/web/src/components/comment-section.tsx apps/web/src/components/rsvp-buttons.tsx
git commit -m "feat(web): add post detail page with comments and RSVP"
```

---

### Task 9: Web Admin Panel

Same as previous plan Task 16. All code is in git at commit `e920d00`.

**Files:**
- Create: `apps/web/src/app/admin/layout.tsx`
- Create: `apps/web/src/app/admin/dashboard/page.tsx`
- Create: `apps/web/src/app/admin/dashboard/actions.ts`
- Create: `apps/web/src/components/admin/pending-users.tsx`
- Create: `apps/web/src/components/admin/post-management.tsx`

- [ ] **Step 1: Create admin layout** — code from previous plan Task 16 Step 1
- [ ] **Step 2: Create admin actions** — code from previous plan Task 16 Step 2
- [ ] **Step 3: Create pending users component** — code from previous plan Task 16 Step 3
- [ ] **Step 4: Create post management component** — code from previous plan Task 16 Step 4
- [ ] **Step 5: Create admin dashboard page** — code from previous plan Task 16 Step 5
- [ ] **Step 6: Verify** — log in as admin, approve users, pin/delete posts
- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/admin/ apps/web/src/components/admin/
git commit -m "feat(web): add admin dashboard with user approval and post management"
```

---

### Task 10: Public Commune Website

Same as previous plan Task 17. All code is in git at commit `e920d00`.

**Files:**
- Create: `apps/web/src/app/[commune-slug]/layout.tsx`
- Create: `apps/web/src/app/[commune-slug]/page.tsx`
- Create: `apps/web/src/app/[commune-slug]/evenements/page.tsx`

- [ ] **Step 1: Create commune website layout** — code from previous plan Task 17 Step 1
- [ ] **Step 2: Create commune homepage** — code from previous plan Task 17 Step 2
- [ ] **Step 3: Create events page** — code from previous plan Task 17 Step 3
- [ ] **Step 4: Verify** — visit http://localhost:3000/saint-test-le-petit
- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\[commune-slug\]/
git commit -m "feat(web): add public commune website with announcements and events"
```

---

## Phase 3: Mobile App

### Task 11: Customize Mobile Auth for Communes

Forge gives us basic mobile login/signup. We need to add commune selection and profile creation.

**Files:**
- Modify: `apps/mobile/src/app/auth/signup.tsx`
- Modify: `apps/mobile/src/app/_layout.tsx`
- Create: `apps/mobile/src/lib/auth-context.tsx`

- [ ] **Step 1: Create auth context with profile loading**

Create `apps/mobile/src/lib/auth-context.tsx` — use the code from previous plan Task 19 Step 2 (git commit `e920d00`, Task 19).

- [ ] **Step 2: Replace signup screen with commune-aware version**

Replace `apps/mobile/src/app/auth/signup.tsx` — use the code from previous plan Task 20 Step 3.

- [ ] **Step 3: Update root layout with AuthProvider and auth gate**

Replace `apps/mobile/src/app/_layout.tsx` — use the code from previous plan Task 20 Step 4. Integrate with Forge's existing QueryClientProvider.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/
git commit -m "feat(mobile): customize auth for commune selection and profile creation"
```

---

### Task 12: Mobile Feed & Post Creation

**Files:**
- Create/Modify: `apps/mobile/src/app/(tabs)/_layout.tsx`
- Create: `apps/mobile/src/app/(tabs)/feed/index.tsx`
- Create: `apps/mobile/src/components/post-card.tsx`
- Create: `apps/mobile/src/app/(tabs)/create.tsx`

- [ ] **Step 1: Update tabs layout** — use code from previous plan Task 21 Step 1
- [ ] **Step 2: Create mobile post card** — use code from previous plan Task 21 Step 2
- [ ] **Step 3: Create feed screen with realtime** — use code from previous plan Task 21 Step 3
- [ ] **Step 4: Create post creation screen** — use code from previous plan Task 22 Step 1. Integrate with Forge's `ImagePickerButton` component from the camera module instead of custom image picker code.
- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/
git commit -m "feat(mobile): add feed with realtime updates and post creation with image picker"
```

---

### Task 13: Mobile Post Detail, Comments & RSVP

**Files:**
- Create: `apps/mobile/src/app/post/[id].tsx`

- [ ] **Step 1: Create post detail screen** — use code from previous plan Task 23 Step 1
- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/app/post/
git commit -m "feat(mobile): add post detail screen with comments and RSVP"
```

---

### Task 14: Mobile Profile & Admin

**Files:**
- Create: `apps/mobile/src/app/(tabs)/profile.tsx`
- Create: `apps/mobile/src/app/admin/_layout.tsx`
- Create: `apps/mobile/src/app/admin/moderation.tsx`

- [ ] **Step 1: Create admin layout and moderation screen** — use code from previous plan Task 24 Steps 1-2
- [ ] **Step 2: Create profile screen** — use code from previous plan Task 24 Step 3
- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/
git commit -m "feat(mobile): add profile screen and admin moderation"
```

---

## Phase 4: Polish & Launch

### Task 15: Push Notification Edge Function

Forge scaffolded the mobile-side push notification plumbing (`notifications.ts`, `use-notifications.ts`). We need the server-side Edge Function that sends notifications when an announcement is posted.

**Files:**
- Create: `supabase/functions/push-notification/index.ts`

- [ ] **Step 1: Create Edge Function**

Create `supabase/functions/push-notification/index.ts`:
```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const { record } = await req.json();

  if (record.type !== "annonce") {
    return new Response("Not an announcement", { status: 200 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: profiles } = await supabase
    .from("profiles")
    .select("push_token")
    .eq("commune_id", record.commune_id)
    .eq("status", "active")
    .not("push_token", "is", null);

  if (!profiles || profiles.length === 0) {
    return new Response("No tokens", { status: 200 });
  }

  const tokens = profiles.map((p) => p.push_token).filter(Boolean);

  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      tokens.map((token) => ({
        to: token,
        title: "Annonce officielle",
        body: record.title,
        data: { postId: record.id },
      }))
    ),
  });

  const result = await response.json();
  return new Response(JSON.stringify(result), { status: 200 });
});
```

- [ ] **Step 2: Deploy and configure webhook**

Run:
```bash
npx supabase functions deploy push-notification
```

In Supabase dashboard: create a database webhook that triggers on INSERT to `posts` table, calling the `push-notification` function.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/
git commit -m "feat: add push notification Edge Function for official announcements"
```

---

### Task 16: Intercommunalité Toggle

**Files:**
- Modify: `apps/web/src/app/app/feed/page.tsx`
- Modify: `apps/mobile/src/app/(tabs)/feed/index.tsx`

- [ ] **Step 1: Add scope param to web feed**

Update `apps/web/src/app/app/feed/page.tsx` to accept `?scope=epci` search param. When `scope=epci` and the user's commune has an `epci_id`, call `getEpciPosts()` instead of `getPosts()`. Add toggle links above the feed:
```typescript
// In the JSX, before the posts list:
<div className="flex gap-2">
  <Link href="/app/feed" className={scope === "commune" ? "font-bold" : ""}>Ma commune</Link>
  <Link href="/app/feed?scope=epci" className={scope === "epci" ? "font-bold" : ""}>Intercommunalité</Link>
</div>
```

- [ ] **Step 2: Add toggle to mobile feed**

Update `apps/mobile/src/app/(tabs)/feed/index.tsx` to add a state-based toggle. When toggled, call `getEpciPosts()` from shared package instead of `getPosts()`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/app/feed/ apps/mobile/src/app/\(tabs\)/feed/
git commit -m "feat: add intercommunalité toggle to web and mobile feeds"
```

---

### Task 17: Deployment Configuration

**Files:**
- Create: `apps/web/vercel.json`
- Modify: `apps/mobile/app.json`
- Create: `apps/mobile/eas.json` (if not already from Forge)

- [ ] **Step 1: Configure Vercel for monorepo**

Create `apps/web/vercel.json`:
```json
{
  "installCommand": "pnpm install",
  "buildCommand": "cd ../.. && pnpm turbo build --filter web"
}
```

- [ ] **Step 2: Configure Expo for production**

Update `apps/mobile/app.json`:
```json
{
  "expo": {
    "name": "Ma Commune",
    "slug": "ma-commune",
    "version": "1.0.0",
    "ios": { "bundleIdentifier": "com.macommune.app" },
    "android": { "package": "com.macommune.app" }
  }
}
```

Verify `apps/mobile/eas.json` exists (Forge should have created it).

- [ ] **Step 3: Update CLAUDE.md with production env vars**

Add to `CLAUDE.md`:
```
## Production Environment Variables
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY (server-side only)
- EXPO_PUBLIC_SUPABASE_URL
- EXPO_PUBLIC_SUPABASE_ANON_KEY
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/vercel.json apps/mobile/app.json apps/mobile/eas.json CLAUDE.md
git commit -m "chore: add Vercel and EAS deployment configuration"
```

---

## Summary

| Phase | Tasks | What it delivers |
|---|---|---|
| 1. Foundation | 1-5 | Forge scaffold, Supabase schema + RLS, shared types/constants/validation/queries |
| 2. Web | 6-10 | Auth customization, feed, post creation, comments, RSVP, admin, public website |
| 3. Mobile | 11-14 | Auth customization, feed with realtime, post creation, comments, RSVP, admin |
| 4. Polish | 15-17 | Push notification Edge Function, intercommunalité toggle, deployment config |

**Forge saves us ~10 tasks** of boilerplate scaffolding. Tasks 7-10 and 12-14 reference code from the previous plan version (git commit `e920d00`) — that code was reviewed and is correct, just copy it.
