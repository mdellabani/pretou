# MVP Implementation Plan (v1 — Community Board)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the MVP community board — a multi-tenant platform where small French communes can post announcements, events, and community messages, with mairie admin moderation. Delivered as a monorepo with a Next.js web app and Expo mobile app sharing a common TypeScript package and Supabase backend.

**Architecture:** Turborepo monorepo with `apps/web` (Next.js 15, App Router), `apps/mobile` (Expo, Expo Router), `packages/shared` (types, queries, validation), and `supabase/` (schema, RLS, Edge Functions). Multi-tenant via `commune_id` on all tables, secured by Supabase RLS.

**Tech Stack:** Next.js 15, Expo SDK 54, TypeScript, Supabase (Postgres + Auth + Realtime + Storage), Tailwind CSS, shadcn/ui, Zod, Turborepo, pnpm

**Spec:** `docs/superpowers/specs/2026-04-12-architecture-design.md`

---

## Phase 1: Foundation

### Task 1: Monorepo Scaffolding

**Files:**
- Create: `package.json` (root)
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `.gitignore` (root)
- Create: `.npmrc`
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`

- [ ] **Step 1: Initialize root package.json**

Create `package.json` in project root:
```json
{
  "name": "rural-community-platform",
  "private": true,
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "clean": "turbo clean"
  },
  "devDependencies": {
    "turbo": "^2"
  },
  "packageManager": "pnpm@9.15.0"
}
```

- [ ] **Step 2: Create pnpm workspace config**

Create `pnpm-workspace.yaml`:
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 3: Create turbo.json**

Create `turbo.json`:
```json
{
  "$schema": "https://turborepo.dev/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev": {
      "persistent": true,
      "cache": false
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "clean": {
      "cache": false
    }
  }
}
```

- [ ] **Step 4: Create .npmrc**

Create `.npmrc`:
```
auto-install-peers=true
```

- [ ] **Step 5: Create shared package skeleton**

Create `packages/shared/package.json`:
```json
{
  "name": "@rural/shared",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc",
    "clean": "rm -rf dist"
  },
  "devDependencies": {
    "typescript": "^5"
  }
}
```

Create `packages/shared/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

Create `packages/shared/src/index.ts`:
```typescript
// Entry point — re-exports all shared modules
// Populated as types, queries, and validation are added
```

- [ ] **Step 6: Update .gitignore**

Append to `.gitignore`:
```
node_modules
.turbo
dist
.env
.env.local
.next
```

- [ ] **Step 7: Install dependencies and verify**

Run:
```bash
pnpm install
pnpm build
```

Expected: Install succeeds, `turbo build` runs shared package build with no errors.

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "chore: scaffold monorepo with Turborepo, pnpm workspaces, and shared package"
```

---

### Task 2: Supabase Project Setup

**Files:**
- Create: `supabase/config.toml` (via `supabase init`)
- Create: `.env.local` (root, gitignored)

- [ ] **Step 1: Initialize Supabase**

Run:
```bash
pnpm add -D supabase -w
npx supabase init
```

Expected: `supabase/` directory created with `config.toml`.

- [ ] **Step 2: Create root .env.local**

Create `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-local-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-local-service-role-key
```

Verify `.env.local` is in `.gitignore`.

- [ ] **Step 3: Start local Supabase**

Run:
```bash
npx supabase start
```

Expected: Local Supabase running. Copy the `anon key` and `service_role key` from the output into `.env.local`.

- [ ] **Step 4: Commit**

```bash
git add supabase/config.toml
git commit -m "chore: initialize local Supabase project"
```

---

### Task 3: Database Schema & RLS

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`
- Create: `supabase/seed.sql`

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

-- EPCI policies (authenticated users can see all EPCI)
CREATE POLICY "Authenticated users can view EPCI"
  ON epci FOR SELECT TO authenticated
  USING (true);

-- Commune policies
CREATE POLICY "Authenticated users can view communes"
  ON communes FOR SELECT TO authenticated
  USING (true);

-- Anon users can view communes by slug (for public website)
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

-- Admin-specific policies
CREATE POLICY "Admins can update profiles in own commune"
  ON profiles FOR UPDATE TO authenticated
  USING (commune_id = auth_commune_id() AND is_commune_admin());

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

Create `supabase/seed.sql`:
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

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/001_initial_schema.sql supabase/seed.sql
git commit -m "feat(db): add schema with EPCI, communes, posts, comments, RSVPs, and RLS"
```

---

### Task 4: Shared Types

**Files:**
- Create: `packages/shared/src/types/database.ts`
- Create: `packages/shared/src/types/post.ts`
- Create: `packages/shared/src/types/commune.ts`
- Create: `packages/shared/src/types/profile.ts`
- Create: `packages/shared/src/types/index.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/shared/package.json`

- [ ] **Step 1: Add Supabase dependency to shared**

Run:
```bash
pnpm add @supabase/supabase-js -F @rural/shared
```

- [ ] **Step 2: Generate database types**

Run:
```bash
npx supabase gen types typescript --local > packages/shared/src/types/database.ts
```

- [ ] **Step 3: Create domain types**

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

Create `packages/shared/src/types/index.ts`:
```typescript
export type { Database } from "./database";
export type { Post, PostType, CreatePostInput } from "./post";
export type { Commune, EPCI } from "./commune";
export type { Profile, Role, ProfileStatus } from "./profile";
```

- [ ] **Step 4: Update shared index**

Replace `packages/shared/src/index.ts`:
```typescript
export * from "./types";
```

- [ ] **Step 5: Verify build**

Run:
```bash
pnpm build
```

Expected: Shared package compiles with no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/
git commit -m "feat(shared): add database types and domain type definitions"
```

---

### Task 5: Shared Constants

**Files:**
- Create: `packages/shared/src/constants/post-types.ts`
- Create: `packages/shared/src/constants/roles.ts`
- Create: `packages/shared/src/constants/index.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Create post type constants**

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

- [ ] **Step 2: Create role constants**

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

- [ ] **Step 3: Create constants index**

Create `packages/shared/src/constants/index.ts`:
```typescript
export { POST_TYPE_LABELS, POST_TYPE_COLORS, POST_TYPE_ICONS } from "./post-types";
export { ROLE_LABELS, ADMIN_ROLES } from "./roles";
```

- [ ] **Step 4: Update shared index**

Replace `packages/shared/src/index.ts`:
```typescript
export * from "./types";
export * from "./constants";
```

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/constants/ packages/shared/src/index.ts
git commit -m "feat(shared): add post type and role constants"
```

---

### Task 6: Shared Validation (Zod)

**Files:**
- Create: `packages/shared/src/validation/post.schema.ts`
- Create: `packages/shared/src/validation/profile.schema.ts`
- Create: `packages/shared/src/validation/index.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/shared/package.json`

- [ ] **Step 1: Add Zod dependency**

Run:
```bash
pnpm add zod -F @rural/shared
```

- [ ] **Step 2: Create post validation schema**

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

- [ ] **Step 3: Create profile validation schema**

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

- [ ] **Step 4: Create validation index**

Create `packages/shared/src/validation/index.ts`:
```typescript
export { createPostSchema, createCommentSchema } from "./post.schema";
export type { CreatePostFormData, CreateCommentFormData } from "./post.schema";
export { updateProfileSchema, signupSchema } from "./profile.schema";
export type { UpdateProfileFormData, SignupFormData } from "./profile.schema";
```

- [ ] **Step 5: Update shared index**

Replace `packages/shared/src/index.ts`:
```typescript
export * from "./types";
export * from "./constants";
export * from "./validation";
```

- [ ] **Step 6: Verify build**

Run:
```bash
pnpm build
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/
git commit -m "feat(shared): add Zod validation schemas for posts and profiles"
```

---

### Task 7: Shared Query Functions

**Files:**
- Create: `packages/shared/src/queries/posts.ts`
- Create: `packages/shared/src/queries/communes.ts`
- Create: `packages/shared/src/queries/profiles.ts`
- Create: `packages/shared/src/queries/admin.ts`
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

- [ ] **Step 5: Create queries index**

Create `packages/shared/src/queries/index.ts`:
```typescript
export { getPosts, getPostById, createPost, deletePost, togglePinPost, getPostsByType } from "./posts";
export { getCommune, getCommuneBySlug, getCommunesByEpci, getAllCommunes, getCommuneByInviteCode } from "./communes";
export { getProfile, createProfile, updateProfile } from "./profiles";
export { getPendingUsers, approveUser, rejectUser, promoteToAdmin, demoteToResident, getCommuneMembers } from "./admin";
```

- [ ] **Step 6: Update shared index**

Replace `packages/shared/src/index.ts`:
```typescript
export * from "./types";
export * from "./constants";
export * from "./validation";
export * from "./queries";
```

- [ ] **Step 7: Verify build**

Run:
```bash
pnpm build
```

Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add packages/shared/src/queries/ packages/shared/src/index.ts
git commit -m "feat(shared): add platform-agnostic Supabase query functions"
```

---

### Task 8: Comment & RSVP Queries

**Files:**
- Create: `packages/shared/src/queries/comments.ts`
- Create: `packages/shared/src/queries/rsvps.ts`
- Modify: `packages/shared/src/queries/index.ts`

- [ ] **Step 1: Create comment queries**

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

- [ ] **Step 2: Create RSVP queries**

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

- [ ] **Step 3: Update queries index**

Add to `packages/shared/src/queries/index.ts`:
```typescript
export { getComments, createComment, deleteComment } from "./comments";
export { getRsvps, setRsvp, removeRsvp, getRsvpCounts } from "./rsvps";
export type { RsvpStatus } from "./rsvps";
```

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/queries/
git commit -m "feat(shared): add comment and RSVP query functions"
```

---

## Phase 2: Web App (Next.js)

### Task 9: Next.js App Scaffolding

**Files:**
- Create: `apps/web/` (via create-next-app)
- Modify: `apps/web/package.json`
- Modify: `apps/web/next.config.ts`

- [ ] **Step 1: Create Next.js app**

Run from project root:
```bash
cd apps && npx create-next-app@latest web --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" && cd ..
```

Expected: `apps/web/` created with Next.js 15 boilerplate.

- [ ] **Step 2: Add shared package dependency**

Add to `apps/web/package.json` in `dependencies`:
```json
"@rural/shared": "workspace:*"
```

Run:
```bash
pnpm install
```

- [ ] **Step 3: Install Supabase SSR helpers**

Run:
```bash
pnpm add @supabase/supabase-js @supabase/ssr -F web
```

- [ ] **Step 4: Install shadcn/ui**

Run:
```bash
cd apps/web && npx shadcn@latest init -d && cd ../..
```

Then add components:
```bash
cd apps/web && npx shadcn@latest add button card dialog form input label select separator tabs textarea toast badge avatar dropdown-menu sheet && cd ../..
```

- [ ] **Step 5: Configure next.config.ts for monorepo**

Replace `apps/web/next.config.ts`:
```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@rural/shared"],
};

export default nextConfig;
```

- [ ] **Step 6: Create .env.local for web app**

Create `apps/web/.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-local-anon-key
```

- [ ] **Step 7: Verify dev server starts**

Run:
```bash
pnpm dev --filter web
```

Expected: Next.js dev server starts on http://localhost:3000.

- [ ] **Step 8: Commit**

```bash
git add apps/web/
git commit -m "feat(web): scaffold Next.js 15 app with shadcn/ui and shared package"
```

---

### Task 10: Web Supabase Client Setup

**Files:**
- Create: `apps/web/src/lib/supabase/client.ts`
- Create: `apps/web/src/lib/supabase/server.ts`
- Create: `apps/web/src/lib/supabase/middleware.ts`
- Create: `apps/web/src/middleware.ts`

- [ ] **Step 1: Create browser client**

Create `apps/web/src/lib/supabase/client.ts`:
```typescript
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@rural/shared";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 2: Create server client**

Create `apps/web/src/lib/supabase/server.ts`:
```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@rural/shared";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component — ignore
          }
        },
      },
    }
  );
}
```

- [ ] **Step 3: Create middleware helper**

Create `apps/web/src/lib/supabase/middleware.ts`:
```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Protect /admin and /app routes
  const isProtected = request.nextUrl.pathname.startsWith("/admin") || request.nextUrl.pathname.startsWith("/app");
  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
```

- [ ] **Step 4: Create middleware**

Create `apps/web/src/middleware.ts`:
```typescript
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/supabase/ apps/web/src/middleware.ts
git commit -m "feat(web): add Supabase client (browser, server, middleware) with auth protection"
```

---

### Task 11: Web Auth Pages

**Files:**
- Create: `apps/web/src/app/auth/login/page.tsx`
- Create: `apps/web/src/app/auth/signup/page.tsx`
- Create: `apps/web/src/app/auth/callback/route.ts`
- Create: `apps/web/src/app/auth/pending/page.tsx`

- [ ] **Step 1: Create auth callback route**

Create `apps/web/src/app/auth/callback/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/app/feed`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
}
```

- [ ] **Step 2: Create login page**

Create `apps/web/src/app/auth/login/page.tsx`:
```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("Email ou mot de passe incorrect");
      setLoading(false);
      return;
    }

    router.push("/app/feed");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Connexion</CardTitle>
          <CardDescription>Connectez-vous à votre commune</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Connexion..." : "Se connecter"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Pas encore inscrit ?{" "}
            <Link href="/auth/signup" className="underline">Créer un compte</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Create signup page**

Create `apps/web/src/app/auth/signup/page.tsx`:
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
    if (!parsed.success) {
      setError(parsed.error.errors[0].message);
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    });

    if (authError || !authData.user) {
      setError(authError?.message ?? "Erreur lors de l'inscription");
      setLoading(false);
      return;
    }

    const { error: profileError } = await supabase.from("profiles").insert({
      id: authData.user.id,
      commune_id: form.commune_id,
      display_name: form.display_name,
    });

    if (profileError) {
      setError("Erreur lors de la création du profil");
      setLoading(false);
      return;
    }

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
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez votre commune" />
                </SelectTrigger>
                <SelectContent>
                  {communes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Inscription..." : "S'inscrire"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Déjà inscrit ?{" "}
            <Link href="/auth/login" className="underline">Se connecter</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Create pending approval page**

Create `apps/web/src/app/auth/pending/page.tsx`:
```typescript
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function PendingApprovalPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle>Inscription en attente</CardTitle>
          <CardDescription>
            Votre demande a été envoyée à la mairie de votre commune.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Vous recevrez un email une fois votre inscription validée par un administrateur.
            En attendant, vous pouvez fermer cette page.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 5: Verify pages render**

Run:
```bash
pnpm dev --filter web
```

Visit http://localhost:3000/auth/login and http://localhost:3000/auth/signup. Expected: forms render without errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/auth/
git commit -m "feat(web): add login, signup, callback, and pending approval pages"
```

---

### Task 12: Web Profile Hook & Layout

**Files:**
- Create: `apps/web/src/hooks/use-profile.ts`
- Create: `apps/web/src/app/app/layout.tsx`
- Create: `apps/web/src/components/nav-bar.tsx`

- [ ] **Step 1: Create profile hook**

Create `apps/web/src/hooks/use-profile.ts`:
```typescript
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@rural/shared";

type ProfileWithCommune = Profile & {
  communes: { name: string; slug: string; epci_id: string | null };
};

export function useProfile() {
  const [profile, setProfile] = useState<ProfileWithCommune | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("*, communes(name, slug, epci_id)")
        .eq("id", user.id)
        .single();

      setProfile(data as ProfileWithCommune | null);
      setLoading(false);
    }

    load();
  }, []);

  return { profile, loading, isAdmin: profile?.role === "admin" };
}
```

- [ ] **Step 2: Create nav bar**

Create `apps/web/src/components/nav-bar.tsx`:
```typescript
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/hooks/use-profile";
import { Button } from "@/components/ui/button";

export function NavBar() {
  const router = useRouter();
  const { profile, loading, isAdmin } = useProfile();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  }

  if (loading) return null;

  return (
    <nav className="border-b bg-white px-4 py-3">
      <div className="mx-auto flex max-w-5xl items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/app/feed" className="font-semibold">
            {profile?.communes?.name ?? "Ma Commune"}
          </Link>
          <Link href="/app/feed" className="text-sm text-muted-foreground hover:text-foreground">
            Fil
          </Link>
          {isAdmin && (
            <Link href="/admin/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
              Admin
            </Link>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{profile?.display_name}</span>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            Déconnexion
          </Button>
        </div>
      </div>
    </nav>
  );
}
```

- [ ] **Step 3: Create app layout**

Create `apps/web/src/app/app/layout.tsx`:
```typescript
import { NavBar } from "@/components/nav-bar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/hooks/ apps/web/src/components/nav-bar.tsx apps/web/src/app/app/layout.tsx
git commit -m "feat(web): add profile hook, navigation bar, and app layout"
```

---

### Task 13: Web Feed Page

**Files:**
- Create: `apps/web/src/app/app/feed/page.tsx`
- Create: `apps/web/src/components/post-card.tsx`
- Create: `apps/web/src/components/post-type-badge.tsx`

- [ ] **Step 1: Create post type badge**

Create `apps/web/src/components/post-type-badge.tsx`:
```typescript
import { Badge } from "@/components/ui/badge";
import { POST_TYPE_LABELS, POST_TYPE_COLORS } from "@rural/shared";
import type { PostType } from "@rural/shared";

export function PostTypeBadge({ type }: { type: PostType }) {
  return (
    <Badge style={{ backgroundColor: POST_TYPE_COLORS[type], color: "white" }}>
      {POST_TYPE_LABELS[type]}
    </Badge>
  );
}
```

- [ ] **Step 2: Create post card**

Create `apps/web/src/components/post-card.tsx`:
```typescript
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PostTypeBadge } from "@/components/post-type-badge";
import type { Post, PostType } from "@rural/shared";

export function PostCard({ post }: { post: Post }) {
  const commentCount = post.comments?.[0]?.count ?? 0;
  const rsvpCount = post.rsvps?.filter((r) => r.status === "going").length ?? 0;

  return (
    <Link href={`/app/posts/${post.id}`}>
      <Card className="transition-shadow hover:shadow-md">
        <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <PostTypeBadge type={post.type as PostType} />
              {post.is_pinned && <span className="text-xs text-amber-600 font-medium">Épinglé</span>}
            </div>
            <h3 className="font-semibold leading-tight">{post.title}</h3>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground line-clamp-3">{post.body}</p>
          <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
            <span>{post.profiles?.display_name}</span>
            <span>{new Date(post.created_at).toLocaleDateString("fr-FR")}</span>
            {commentCount > 0 && <span>{commentCount} commentaire{commentCount > 1 ? "s" : ""}</span>}
            {post.type === "evenement" && rsvpCount > 0 && <span>{rsvpCount} participant{rsvpCount > 1 ? "s" : ""}</span>}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
```

- [ ] **Step 3: Create feed page**

Create `apps/web/src/app/app/feed/page.tsx`:
```typescript
import { createClient } from "@/lib/supabase/server";
import { getProfile, getPosts } from "@rural/shared";
import { redirect } from "next/navigation";
import { PostCard } from "@/components/post-card";
import type { Post } from "@rural/shared";

export default async function FeedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await getProfile(supabase, user.id);
  if (!profile) redirect("/auth/signup");
  if (profile.status === "pending") redirect("/auth/pending");

  const { data: posts } = await getPosts(supabase, profile.commune_id);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Fil de la commune</h1>
      </div>
      {posts && posts.length > 0 ? (
        <div className="space-y-3">
          {(posts as Post[]).map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">Aucune publication pour le moment.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verify feed renders**

Run:
```bash
pnpm dev --filter web
```

Visit http://localhost:3000/app/feed (after logging in). Expected: empty feed with "Aucune publication" message, or posts if seed data includes some.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/app/feed/ apps/web/src/components/post-card.tsx apps/web/src/components/post-type-badge.tsx
git commit -m "feat(web): add community feed page with post cards"
```

---

### Task 14: Web Post Creation

**Files:**
- Create: `apps/web/src/components/create-post-dialog.tsx`
- Create: `apps/web/src/app/app/feed/actions.ts`
- Modify: `apps/web/src/app/app/feed/page.tsx`

- [ ] **Step 1: Create server action for post creation**

Create `apps/web/src/app/app/feed/actions.ts`:
```typescript
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createPostSchema } from "@rural/shared";

export async function createPostAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("commune_id, role, status")
    .eq("id", user.id)
    .single();

  if (!profile || profile.status !== "active") return { error: "Compte non approuvé" };

  const raw = {
    title: formData.get("title") as string,
    body: formData.get("body") as string,
    type: formData.get("type") as string,
    event_date: formData.get("event_date") as string || null,
    event_location: formData.get("event_location") as string || null,
    epci_visible: formData.get("epci_visible") === "true",
  };

  const parsed = createPostSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  if (parsed.data.type === "annonce" && profile.role !== "admin") {
    return { error: "Seuls les administrateurs peuvent publier des annonces officielles" };
  }

  const { error } = await supabase.from("posts").insert({
    ...parsed.data,
    commune_id: profile.commune_id,
    author_id: user.id,
  });

  if (error) return { error: "Erreur lors de la publication" };

  revalidatePath("/app/feed");
  return { error: null };
}
```

- [ ] **Step 2: Create post dialog component**

Create `apps/web/src/components/create-post-dialog.tsx`:
```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { POST_TYPE_LABELS } from "@rural/shared";
import type { PostType } from "@rural/shared";
import { createPostAction } from "@/app/app/feed/actions";

const POST_TYPES_FOR_RESIDENTS: PostType[] = ["evenement", "entraide", "discussion"];
const ALL_POST_TYPES: PostType[] = ["annonce", "evenement", "entraide", "discussion"];

export function CreatePostDialog({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<PostType>("discussion");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const availableTypes = isAdmin ? ALL_POST_TYPES : POST_TYPES_FOR_RESIDENTS;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    formData.set("type", type);

    const result = await createPostAction(formData);
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setOpen(false);
    setLoading(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Nouvelle publication</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Créer une publication</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as PostType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableTypes.map((t) => (
                  <SelectItem key={t} value={t}>{POST_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="title">Titre</Label>
            <Input id="title" name="title" required maxLength={200} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="body">Contenu</Label>
            <Textarea id="body" name="body" required maxLength={5000} rows={5} />
          </div>
          {type === "evenement" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="event_date">Date de l'événement</Label>
                <Input id="event_date" name="event_date" type="datetime-local" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event_location">Lieu</Label>
                <Input id="event_location" name="event_location" maxLength={200} />
              </div>
            </>
          )}
          <input type="hidden" name="epci_visible" value="false" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Publication..." : "Publier"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Add create button to feed page**

Update `apps/web/src/app/app/feed/page.tsx` — replace the `<h1>` wrapper div:
```typescript
import { createClient } from "@/lib/supabase/server";
import { getProfile, getPosts } from "@rural/shared";
import { redirect } from "next/navigation";
import { PostCard } from "@/components/post-card";
import { CreatePostDialog } from "@/components/create-post-dialog";
import type { Post } from "@rural/shared";

export default async function FeedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await getProfile(supabase, user.id);
  if (!profile) redirect("/auth/signup");
  if (profile.status === "pending") redirect("/auth/pending");

  const { data: posts } = await getPosts(supabase, profile.commune_id);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Fil de la commune</h1>
        <CreatePostDialog isAdmin={profile.role === "admin"} />
      </div>
      {posts && posts.length > 0 ? (
        <div className="space-y-3">
          {(posts as Post[]).map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">Aucune publication pour le moment.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verify post creation works**

Run dev server, log in, click "Nouvelle publication", fill the form, submit. Expected: post appears in feed.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/app/feed/ apps/web/src/components/create-post-dialog.tsx
git commit -m "feat(web): add post creation with dialog and server action"
```

---

### Task 15: Web Post Detail, Comments & RSVP

**Files:**
- Create: `apps/web/src/app/app/posts/[id]/page.tsx`
- Create: `apps/web/src/app/app/posts/[id]/actions.ts`
- Create: `apps/web/src/components/comment-section.tsx`
- Create: `apps/web/src/components/rsvp-buttons.tsx`

- [ ] **Step 1: Create post detail actions**

Create `apps/web/src/app/app/posts/[id]/actions.ts`:
```typescript
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createComment, deleteComment } from "@rural/shared";
import { setRsvp, removeRsvp } from "@rural/shared";
import { createCommentSchema } from "@rural/shared";

export async function addCommentAction(postId: string, body: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };

  const parsed = createCommentSchema.safeParse({ body });
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const { error } = await createComment(supabase, postId, user.id, parsed.data.body);
  if (error) return { error: "Erreur lors de l'ajout du commentaire" };

  revalidatePath(`/app/posts/${postId}`);
  return { error: null };
}

export async function deleteCommentAction(commentId: string, postId: string) {
  const supabase = await createClient();
  const { error } = await deleteComment(supabase, commentId);
  if (error) return { error: "Erreur lors de la suppression" };

  revalidatePath(`/app/posts/${postId}`);
  return { error: null };
}

export async function setRsvpAction(postId: string, status: "going" | "maybe" | "not_going") {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };

  const { error } = await setRsvp(supabase, postId, user.id, status);
  if (error) return { error: "Erreur lors de l'enregistrement" };

  revalidatePath(`/app/posts/${postId}`);
  return { error: null };
}

export async function removeRsvpAction(postId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };

  const { error } = await removeRsvp(supabase, postId, user.id);
  if (error) return { error: "Erreur" };

  revalidatePath(`/app/posts/${postId}`);
  return { error: null };
}
```

- [ ] **Step 2: Create comment section component**

Create `apps/web/src/components/comment-section.tsx`:
```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addCommentAction, deleteCommentAction } from "@/app/app/posts/[id]/actions";

type Comment = {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  profiles: { display_name: string; avatar_url: string | null };
};

export function CommentSection({
  postId,
  comments,
  currentUserId,
  isAdmin,
}: {
  postId: string;
  comments: Comment[];
  currentUserId: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setLoading(true);

    await addCommentAction(postId, body);
    setBody("");
    setLoading(false);
    router.refresh();
  }

  async function handleDelete(commentId: string) {
    await deleteCommentAction(commentId, postId);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Commentaires ({comments.length})</h3>

      {comments.map((comment) => (
        <div key={comment.id} className="rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{comment.profiles.display_name}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {new Date(comment.created_at).toLocaleDateString("fr-FR")}
              </span>
              {(comment.author_id === currentUserId || isAdmin) && (
                <Button variant="ghost" size="sm" onClick={() => handleDelete(comment.id)}>
                  Supprimer
                </Button>
              )}
            </div>
          </div>
          <p className="mt-1 text-sm">{comment.body}</p>
        </div>
      ))}

      <form onSubmit={handleSubmit} className="space-y-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Écrire un commentaire..."
          maxLength={2000}
          rows={3}
        />
        <Button type="submit" size="sm" disabled={loading || !body.trim()}>
          {loading ? "Envoi..." : "Commenter"}
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Create RSVP buttons component**

Create `apps/web/src/components/rsvp-buttons.tsx`:
```typescript
"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { setRsvpAction, removeRsvpAction } from "@/app/app/posts/[id]/actions";

type RsvpStatus = "going" | "maybe" | "not_going";

export function RsvpButtons({
  postId,
  currentStatus,
  counts,
}: {
  postId: string;
  currentStatus: RsvpStatus | null;
  counts: { going: number; maybe: number; not_going: number };
}) {
  const router = useRouter();

  async function handleRsvp(status: RsvpStatus) {
    if (currentStatus === status) {
      await removeRsvpAction(postId);
    } else {
      await setRsvpAction(postId, status);
    }
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant={currentStatus === "going" ? "default" : "outline"}
        size="sm"
        onClick={() => handleRsvp("going")}
      >
        J'y vais ({counts.going})
      </Button>
      <Button
        variant={currentStatus === "maybe" ? "default" : "outline"}
        size="sm"
        onClick={() => handleRsvp("maybe")}
      >
        Peut-être ({counts.maybe})
      </Button>
      <Button
        variant={currentStatus === "not_going" ? "default" : "outline"}
        size="sm"
        onClick={() => handleRsvp("not_going")}
      >
        Pas dispo ({counts.not_going})
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Create post detail page**

Create `apps/web/src/app/app/posts/[id]/page.tsx`:
```typescript
import { createClient } from "@/lib/supabase/server";
import { getPostById, getComments, getRsvps, getRsvpCounts } from "@rural/shared";
import { redirect, notFound } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PostTypeBadge } from "@/components/post-type-badge";
import { CommentSection } from "@/components/comment-section";
import { RsvpButtons } from "@/components/rsvp-buttons";
import type { PostType } from "@rural/shared";

export default async function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, commune_id")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/auth/signup");

  const { data: post } = await getPostById(supabase, id);
  if (!post) notFound();

  const { data: comments } = await getComments(supabase, id);
  const rsvpCounts = await getRsvpCounts(supabase, id);

  // Get current user's RSVP status
  let currentRsvpStatus: "going" | "maybe" | "not_going" | null = null;
  if (post.type === "evenement") {
    const { data: rsvps } = await getRsvps(supabase, id);
    const myRsvp = rsvps?.find((r) => r.user_id === user.id);
    currentRsvpStatus = myRsvp?.status as typeof currentRsvpStatus ?? null;
  }

  const isAdmin = profile.role === "admin";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <PostTypeBadge type={post.type as PostType} />
            {post.is_pinned && <span className="text-xs text-amber-600 font-medium">Épinglé</span>}
          </div>
          <h1 className="text-2xl font-bold">{post.title}</h1>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>{post.profiles?.display_name}</span>
            <span>{new Date(post.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="whitespace-pre-wrap">{post.body}</p>

          {post.type === "evenement" && post.event_date && (
            <div className="rounded-lg bg-blue-50 p-3 text-sm">
              <p><strong>Date :</strong> {new Date(post.event_date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
              {post.event_location && <p><strong>Lieu :</strong> {post.event_location}</p>}
            </div>
          )}

          {post.post_images && post.post_images.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {post.post_images.map((img) => (
                <img
                  key={img.id}
                  src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/post-images/${img.storage_path}`}
                  alt=""
                  className="rounded-lg object-cover"
                />
              ))}
            </div>
          )}

          {post.type === "evenement" && (
            <RsvpButtons postId={id} currentStatus={currentRsvpStatus} counts={rsvpCounts} />
          )}
        </CardContent>
      </Card>

      <CommentSection
        postId={id}
        comments={(comments ?? []) as any}
        currentUserId={user.id}
        isAdmin={isAdmin}
      />
    </div>
  );
}
```

- [ ] **Step 5: Verify post detail, comments, and RSVP work**

Create a post, click on it. Add a comment. If it's an event, test RSVP buttons.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/app/posts/ apps/web/src/components/comment-section.tsx apps/web/src/components/rsvp-buttons.tsx
git commit -m "feat(web): add post detail page with comments and RSVP"
```

---

### Task 16: Web Admin Panel

**Files:**
- Create: `apps/web/src/app/admin/layout.tsx`
- Create: `apps/web/src/app/admin/dashboard/page.tsx`
- Create: `apps/web/src/app/admin/dashboard/actions.ts`
- Create: `apps/web/src/components/admin/pending-users.tsx`
- Create: `apps/web/src/components/admin/post-management.tsx`

- [ ] **Step 1: Create admin layout with role check**

Create `apps/web/src/app/admin/layout.tsx`:
```typescript
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { NavBar } from "@/components/nav-bar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") redirect("/app/feed");

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Create admin actions**

Create `apps/web/src/app/admin/dashboard/actions.ts`:
```typescript
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { approveUser, rejectUser, togglePinPost, deletePost } from "@rural/shared";

export async function approveUserAction(userId: string) {
  const supabase = await createClient();
  const { error } = await approveUser(supabase, userId);
  if (error) return { error: "Erreur" };
  revalidatePath("/admin/dashboard");
  return { error: null };
}

export async function rejectUserAction(userId: string) {
  const supabase = await createClient();
  const { error } = await rejectUser(supabase, userId);
  if (error) return { error: "Erreur" };
  revalidatePath("/admin/dashboard");
  return { error: null };
}

export async function togglePinAction(postId: string, isPinned: boolean) {
  const supabase = await createClient();
  const { error } = await togglePinPost(supabase, postId, isPinned);
  if (error) return { error: "Erreur" };
  revalidatePath("/admin/dashboard");
  return { error: null };
}

export async function deletePostAction(postId: string) {
  const supabase = await createClient();
  const { error } = await deletePost(supabase, postId);
  if (error) return { error: "Erreur" };
  revalidatePath("/admin/dashboard");
  return { error: null };
}
```

- [ ] **Step 3: Create pending users component**

Create `apps/web/src/components/admin/pending-users.tsx`:
```typescript
"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { approveUserAction, rejectUserAction } from "@/app/admin/dashboard/actions";

type PendingUser = { id: string; display_name: string; created_at: string };

export function PendingUsers({ users }: { users: PendingUser[] }) {
  const router = useRouter();

  async function handleApprove(userId: string) {
    await approveUserAction(userId);
    router.refresh();
  }

  async function handleReject(userId: string) {
    await rejectUserAction(userId);
    router.refresh();
  }

  if (users.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>Inscriptions en attente</CardTitle></CardHeader>
        <CardContent><p className="text-muted-foreground">Aucune inscription en attente.</p></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle>Inscriptions en attente ({users.length})</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {users.map((user) => (
          <div key={user.id} className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="font-medium">{user.display_name}</p>
              <p className="text-xs text-muted-foreground">
                Inscrit le {new Date(user.created_at).toLocaleDateString("fr-FR")}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => handleApprove(user.id)}>Approuver</Button>
              <Button size="sm" variant="destructive" onClick={() => handleReject(user.id)}>Refuser</Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Create post management component**

Create `apps/web/src/components/admin/post-management.tsx`:
```typescript
"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PostTypeBadge } from "@/components/post-type-badge";
import { togglePinAction, deletePostAction } from "@/app/admin/dashboard/actions";
import type { PostType } from "@rural/shared";

type AdminPost = {
  id: string;
  title: string;
  type: string;
  is_pinned: boolean;
  created_at: string;
  profiles: { display_name: string };
};

export function PostManagement({ posts }: { posts: AdminPost[] }) {
  const router = useRouter();

  async function handleTogglePin(postId: string, isPinned: boolean) {
    await togglePinAction(postId, isPinned);
    router.refresh();
  }

  async function handleDelete(postId: string) {
    if (!confirm("Supprimer cette publication ?")) return;
    await deletePostAction(postId);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader><CardTitle>Publications ({posts.length})</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {posts.map((post) => (
          <div key={post.id} className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-3">
              <PostTypeBadge type={post.type as PostType} />
              <div>
                <p className="font-medium">{post.title}</p>
                <p className="text-xs text-muted-foreground">
                  {post.profiles?.display_name} — {new Date(post.created_at).toLocaleDateString("fr-FR")}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => handleTogglePin(post.id, post.is_pinned)}>
                {post.is_pinned ? "Désépingler" : "Épingler"}
              </Button>
              <Button size="sm" variant="destructive" onClick={() => handleDelete(post.id)}>
                Supprimer
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: Create admin dashboard page**

Create `apps/web/src/app/admin/dashboard/page.tsx`:
```typescript
import { createClient } from "@/lib/supabase/server";
import { getPendingUsers } from "@rural/shared";
import { redirect } from "next/navigation";
import { PendingUsers } from "@/components/admin/pending-users";
import { PostManagement } from "@/components/admin/post-management";

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("commune_id")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/app/feed");

  const { data: pendingUsers } = await getPendingUsers(supabase, profile.commune_id);

  const { data: posts } = await supabase
    .from("posts")
    .select("id, title, type, is_pinned, created_at, profiles!author_id(display_name)")
    .eq("commune_id", profile.commune_id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Administration</h1>
      <PendingUsers users={(pendingUsers ?? []) as any} />
      <PostManagement posts={(posts ?? []) as any} />
    </div>
  );
}
```

- [ ] **Step 6: Verify admin panel works**

Log in as admin user, navigate to /admin/dashboard. Verify pending users and post management render.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/admin/ apps/web/src/components/admin/
git commit -m "feat(web): add admin dashboard with user approval and post management"
```

---

### Task 17: Public Commune Website

**Files:**
- Create: `apps/web/src/app/[commune-slug]/page.tsx`
- Create: `apps/web/src/app/[commune-slug]/layout.tsx`
- Create: `apps/web/src/app/[commune-slug]/evenements/page.tsx`

- [ ] **Step 1: Create commune website layout**

Create `apps/web/src/app/[commune-slug]/layout.tsx`:
```typescript
import { createClient } from "@/lib/supabase/server";
import { getCommuneBySlug } from "@rural/shared";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function CommuneLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ "commune-slug": string }>;
}) {
  const { "commune-slug": slug } = await params;
  const supabase = await createClient();
  const { data: commune } = await getCommuneBySlug(supabase, slug);

  if (!commune) notFound();

  return (
    <div className="min-h-screen">
      <header className="border-b bg-white px-4 py-4" style={{ borderBottomColor: commune.primary_color ?? "#1e40af" }}>
        <div className="mx-auto max-w-4xl">
          <h1 className="text-xl font-bold" style={{ color: commune.primary_color ?? "#1e40af" }}>
            {commune.name}
          </h1>
          <nav className="mt-2 flex gap-4 text-sm">
            <Link href={`/${slug}`} className="hover:underline">Accueil</Link>
            <Link href={`/${slug}/evenements`} className="hover:underline">Événements</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
      <footer className="border-t bg-gray-50 px-4 py-6 text-center text-xs text-muted-foreground">
        <p>Mairie de {commune.name} — Site officiel</p>
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: Create commune homepage (latest announcements + events)**

Create `apps/web/src/app/[commune-slug]/page.tsx`:
```typescript
import { createClient } from "@/lib/supabase/server";
import { getCommuneBySlug } from "@rural/shared";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ "commune-slug": string }> }): Promise<Metadata> {
  const { "commune-slug": slug } = await params;
  const supabase = await createClient();
  const { data: commune } = await getCommuneBySlug(supabase, slug);
  if (!commune) return {};
  return {
    title: `${commune.name} — Site officiel`,
    description: `Actualités et informations de la commune de ${commune.name}`,
  };
}

export default async function CommuneHomePage({ params }: { params: Promise<{ "commune-slug": string }> }) {
  const { "commune-slug": slug } = await params;
  const supabase = await createClient();
  const { data: commune } = await getCommuneBySlug(supabase, slug);
  if (!commune) notFound();

  const { data: announcements } = await supabase
    .from("posts")
    .select("id, title, body, created_at")
    .eq("commune_id", commune.id)
    .eq("type", "annonce")
    .order("created_at", { ascending: false })
    .limit(10);

  const { data: events } = await supabase
    .from("posts")
    .select("id, title, body, event_date, event_location, created_at")
    .eq("commune_id", commune.id)
    .eq("type", "evenement")
    .gte("event_date", new Date().toISOString())
    .order("event_date", { ascending: true })
    .limit(5);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-4 text-xl font-bold">Dernières annonces</h2>
        {announcements && announcements.length > 0 ? (
          <div className="space-y-4">
            {announcements.map((post) => (
              <article key={post.id} className="rounded-lg border p-4">
                <h3 className="font-semibold">{post.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {new Date(post.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                </p>
                <p className="mt-2 text-sm line-clamp-4">{post.body}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">Aucune annonce pour le moment.</p>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold">Prochains événements</h2>
        {events && events.length > 0 ? (
          <div className="space-y-4">
            {events.map((event) => (
              <article key={event.id} className="rounded-lg border p-4">
                <h3 className="font-semibold">{event.title}</h3>
                {event.event_date && (
                  <p className="mt-1 text-sm text-blue-600">
                    {new Date(event.event_date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
                    {event.event_location && ` — ${event.event_location}`}
                  </p>
                )}
                <p className="mt-2 text-sm line-clamp-3">{event.body}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">Aucun événement à venir.</p>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Create events listing page**

Create `apps/web/src/app/[commune-slug]/evenements/page.tsx`:
```typescript
import { createClient } from "@/lib/supabase/server";
import { getCommuneBySlug } from "@rural/shared";
import { notFound } from "next/navigation";

export default async function CommuneEventsPage({ params }: { params: Promise<{ "commune-slug": string }> }) {
  const { "commune-slug": slug } = await params;
  const supabase = await createClient();
  const { data: commune } = await getCommuneBySlug(supabase, slug);
  if (!commune) notFound();

  const { data: events } = await supabase
    .from("posts")
    .select("id, title, body, event_date, event_location")
    .eq("commune_id", commune.id)
    .eq("type", "evenement")
    .order("event_date", { ascending: true });

  const now = new Date().toISOString();
  const upcoming = events?.filter((e) => e.event_date && e.event_date >= now) ?? [];
  const past = events?.filter((e) => e.event_date && e.event_date < now) ?? [];

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-4 text-xl font-bold">Événements à venir</h2>
        {upcoming.length > 0 ? (
          <div className="space-y-4">
            {upcoming.map((event) => (
              <article key={event.id} className="rounded-lg border p-4">
                <h3 className="font-semibold">{event.title}</h3>
                {event.event_date && (
                  <p className="text-sm text-blue-600">
                    {new Date(event.event_date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
                    {event.event_location && ` — ${event.event_location}`}
                  </p>
                )}
                <p className="mt-2 text-sm">{event.body}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">Aucun événement à venir.</p>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="mb-4 text-xl font-bold text-muted-foreground">Événements passés</h2>
          <div className="space-y-4 opacity-60">
            {past.map((event) => (
              <article key={event.id} className="rounded-lg border p-4">
                <h3 className="font-semibold">{event.title}</h3>
                {event.event_date && (
                  <p className="text-sm">{new Date(event.event_date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</p>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verify public website renders**

Visit http://localhost:3000/saint-test-le-petit. Expected: public commune page renders with announcements and events (or empty state).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\[commune-slug\]/
git commit -m "feat(web): add public commune website with announcements and events"
```

---

## Phase 3: Mobile App (Expo)

### Task 18: Expo App Scaffolding

**Files:**
- Create: `apps/mobile/` (via create-expo-app)

- [ ] **Step 1: Create Expo app**

Run from project root:
```bash
cd apps && npx create-expo-app@latest mobile --template tabs && cd ..
```

- [ ] **Step 2: Add shared package dependency**

Add to `apps/mobile/package.json` in `dependencies`:
```json
"@rural/shared": "workspace:*"
```

- [ ] **Step 3: Install Supabase and additional dependencies**

Run:
```bash
pnpm add @supabase/supabase-js expo-secure-store expo-image-picker -F mobile
```

- [ ] **Step 4: Create env config**

Create `apps/mobile/src/lib/config.ts`:
```typescript
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
```

Create `apps/mobile/.env`:
```
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-local-anon-key
```

Add `apps/mobile/.env` to root `.gitignore`.

- [ ] **Step 5: Verify Expo starts**

Run:
```bash
pnpm dev --filter mobile
```

Expected: Expo dev server starts.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/
git commit -m "feat(mobile): scaffold Expo app with tabs template"
```

---

### Task 19: Mobile Supabase Client

**Files:**
- Create: `apps/mobile/src/lib/supabase.ts`
- Create: `apps/mobile/src/lib/auth-context.tsx`

- [ ] **Step 1: Create Supabase client with secure storage**

Create `apps/mobile/src/lib/supabase.ts`:
```typescript
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config";
import type { Database } from "@rural/shared";

const secureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: secureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

- [ ] **Step 2: Create auth context**

Create `apps/mobile/src/lib/auth-context.tsx`:
```typescript
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { Session } from "@supabase/supabase-js";
import type { Profile } from "@rural/shared";

type ProfileWithCommune = Profile & {
  communes: { name: string; slug: string; epci_id: string | null };
};

type AuthState = {
  session: Session | null;
  profile: ProfileWithCommune | null;
  loading: boolean;
  isAdmin: boolean;
};

const AuthContext = createContext<AuthState>({
  session: null,
  profile: null,
  loading: true,
  isAdmin: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileWithCommune | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) loadProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) loadProfile(session.user.id);
      else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile(userId: string) {
    const { data } = await supabase
      .from("profiles")
      .select("*, communes(name, slug, epci_id)")
      .eq("id", userId)
      .single();

    setProfile(data as ProfileWithCommune | null);
    setLoading(false);
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, isAdmin: profile?.role === "admin" }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/lib/
git commit -m "feat(mobile): add Supabase client with SecureStore and auth context"
```

---

### Task 20: Mobile Auth Screens

**Files:**
- Create: `apps/mobile/src/app/auth/login.tsx`
- Create: `apps/mobile/src/app/auth/signup.tsx`
- Create: `apps/mobile/src/app/auth/_layout.tsx`
- Modify: `apps/mobile/src/app/_layout.tsx`

- [ ] **Step 1: Create auth layout**

Create `apps/mobile/src/app/auth/_layout.tsx`:
```typescript
import { Stack } from "expo-router";

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 2: Create login screen**

Create `apps/mobile/src/app/auth/login.tsx`:
```typescript
import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useRouter, Link } from "expo-router";
import { supabase } from "../../lib/supabase";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      Alert.alert("Erreur", "Email ou mot de passe incorrect");
      return;
    }

    router.replace("/(tabs)/feed");
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Connexion</Text>
      <Text style={styles.subtitle}>Connectez-vous à votre commune</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Mot de passe"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? "Connexion..." : "Se connecter"}</Text>
      </TouchableOpacity>

      <Link href="/auth/signup" style={styles.link}>
        <Text style={styles.linkText}>Pas encore inscrit ? Créer un compte</Text>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#fff" },
  title: { fontSize: 28, fontWeight: "bold", marginBottom: 4 },
  subtitle: { fontSize: 16, color: "#6b7280", marginBottom: 32 },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 14, fontSize: 16, marginBottom: 12 },
  button: { backgroundColor: "#1e40af", borderRadius: 8, padding: 16, alignItems: "center", marginTop: 8 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  link: { marginTop: 24, alignSelf: "center" },
  linkText: { color: "#1e40af", fontSize: 14 },
});
```

- [ ] **Step 3: Create signup screen**

Create `apps/mobile/src/app/auth/signup.tsx`:
```typescript
import { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from "react-native";
import { useRouter, Link } from "expo-router";
import { supabase } from "../../lib/supabase";
import { signupSchema } from "@rural/shared";

export default function SignupScreen() {
  const router = useRouter();
  const [communes, setCommunes] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({ email: "", password: "", display_name: "", commune_id: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from("communes").select("id, name").order("name").then(({ data }) => {
      if (data) setCommunes(data);
    });
  }, []);

  async function handleSignup() {
    const parsed = signupSchema.safeParse(form);
    if (!parsed.success) {
      Alert.alert("Erreur", parsed.error.errors[0].message);
      return;
    }

    setLoading(true);
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    });

    if (authError || !authData.user) {
      Alert.alert("Erreur", authError?.message ?? "Erreur lors de l'inscription");
      setLoading(false);
      return;
    }

    const { error: profileError } = await supabase.from("profiles").insert({
      id: authData.user.id,
      commune_id: form.commune_id,
      display_name: form.display_name,
    });

    setLoading(false);

    if (profileError) {
      Alert.alert("Erreur", "Erreur lors de la création du profil");
      return;
    }

    Alert.alert(
      "Inscription envoyée",
      "Votre demande a été envoyée à la mairie. Vous serez notifié une fois approuvé.",
      [{ text: "OK", onPress: () => router.replace("/auth/login") }]
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Inscription</Text>
      <Text style={styles.subtitle}>Rejoignez votre commune</Text>

      <TextInput
        style={styles.input}
        placeholder="Votre nom"
        value={form.display_name}
        onChangeText={(v) => setForm((f) => ({ ...f, display_name: v }))}
      />
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={form.email}
        onChangeText={(v) => setForm((f) => ({ ...f, email: v }))}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Mot de passe"
        value={form.password}
        onChangeText={(v) => setForm((f) => ({ ...f, password: v }))}
        secureTextEntry
      />

      <Text style={styles.label}>Votre commune</Text>
      {communes.map((c) => (
        <TouchableOpacity
          key={c.id}
          style={[styles.communeItem, form.commune_id === c.id && styles.communeItemSelected]}
          onPress={() => setForm((f) => ({ ...f, commune_id: c.id }))}
        >
          <Text style={form.commune_id === c.id ? styles.communeTextSelected : styles.communeText}>
            {c.name}
          </Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity style={styles.button} onPress={handleSignup} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? "Inscription..." : "S'inscrire"}</Text>
      </TouchableOpacity>

      <Link href="/auth/login" style={styles.link}>
        <Text style={styles.linkText}>Déjà inscrit ? Se connecter</Text>
      </Link>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: "center", padding: 24, backgroundColor: "#fff" },
  title: { fontSize: 28, fontWeight: "bold", marginBottom: 4 },
  subtitle: { fontSize: 16, color: "#6b7280", marginBottom: 32 },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 14, fontSize: 16, marginBottom: 12 },
  label: { fontSize: 14, fontWeight: "600", marginBottom: 8, marginTop: 4 },
  communeItem: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 12, marginBottom: 6 },
  communeItemSelected: { borderColor: "#1e40af", backgroundColor: "#eff6ff" },
  communeText: { fontSize: 14 },
  communeTextSelected: { fontSize: 14, color: "#1e40af", fontWeight: "600" },
  button: { backgroundColor: "#1e40af", borderRadius: 8, padding: 16, alignItems: "center", marginTop: 16 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  link: { marginTop: 24, alignSelf: "center" },
  linkText: { color: "#1e40af", fontSize: 14 },
});
```

- [ ] **Step 4: Update root layout to wrap with AuthProvider**

Replace `apps/mobile/src/app/_layout.tsx`:
```typescript
import { Stack } from "expo-router";
import { AuthProvider, useAuth } from "../lib/auth-context";
import { useRouter, useSegments } from "expo-router";
import { useEffect } from "react";

function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, profile, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === "auth";

    if (!session && !inAuthGroup) {
      router.replace("/auth/login");
    } else if (session && inAuthGroup) {
      if (profile?.status === "active") {
        router.replace("/(tabs)/feed");
      }
    }
  }, [session, profile, loading, segments]);

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AuthGate>
        <Stack screenOptions={{ headerShown: false }} />
      </AuthGate>
    </AuthProvider>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/
git commit -m "feat(mobile): add auth screens (login, signup) with auth gate"
```

---

### Task 21: Mobile Feed Screen

**Files:**
- Create: `apps/mobile/src/app/(tabs)/feed/index.tsx`
- Create: `apps/mobile/src/app/(tabs)/_layout.tsx`
- Create: `apps/mobile/src/components/post-card.tsx`

- [ ] **Step 1: Create tabs layout**

Create `apps/mobile/src/app/(tabs)/_layout.tsx`:
```typescript
import { Tabs } from "expo-router";

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: "#1e40af" }}>
      <Tabs.Screen name="feed/index" options={{ title: "Fil", tabBarLabel: "Fil" }} />
      <Tabs.Screen name="events" options={{ title: "Événements", tabBarLabel: "Événements" }} />
      <Tabs.Screen name="create" options={{ title: "Publier", tabBarLabel: "Publier" }} />
      <Tabs.Screen name="profile" options={{ title: "Profil", tabBarLabel: "Profil" }} />
    </Tabs>
  );
}
```

- [ ] **Step 2: Create mobile post card**

Create `apps/mobile/src/components/post-card.tsx`:
```typescript
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { POST_TYPE_LABELS, POST_TYPE_COLORS } from "@rural/shared";
import type { PostType } from "@rural/shared";

type PostCardProps = {
  post: {
    id: string;
    title: string;
    body: string;
    type: string;
    is_pinned: boolean;
    created_at: string;
    profiles: { display_name: string } | null;
    comments: { count: number }[];
  };
};

export function PostCard({ post }: PostCardProps) {
  const router = useRouter();
  const type = post.type as PostType;
  const commentCount = post.comments?.[0]?.count ?? 0;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/post/${post.id}`)}
    >
      <View style={styles.header}>
        <View style={[styles.badge, { backgroundColor: POST_TYPE_COLORS[type] }]}>
          <Text style={styles.badgeText}>{POST_TYPE_LABELS[type]}</Text>
        </View>
        {post.is_pinned && <Text style={styles.pinned}>Épinglé</Text>}
      </View>
      <Text style={styles.title}>{post.title}</Text>
      <Text style={styles.body} numberOfLines={3}>{post.body}</Text>
      <View style={styles.footer}>
        <Text style={styles.meta}>{post.profiles?.display_name}</Text>
        <Text style={styles.meta}>{new Date(post.created_at).toLocaleDateString("fr-FR")}</Text>
        {commentCount > 0 && <Text style={styles.meta}>{commentCount} com.</Text>}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  pinned: { fontSize: 11, color: "#d97706", fontWeight: "600" },
  title: { fontSize: 16, fontWeight: "600", marginBottom: 4 },
  body: { fontSize: 14, color: "#6b7280", lineHeight: 20 },
  footer: { flexDirection: "row", gap: 12, marginTop: 10 },
  meta: { fontSize: 12, color: "#9ca3af" },
});
```

- [ ] **Step 3: Create feed screen**

Create `apps/mobile/src/app/(tabs)/feed/index.tsx`:
```typescript
import { useEffect, useState, useCallback } from "react";
import { View, FlatList, Text, StyleSheet, RefreshControl } from "react-native";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/auth-context";
import { getPosts } from "@rural/shared";
import { PostCard } from "../../../components/post-card";

export default function FeedScreen() {
  const { profile } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadPosts = useCallback(async () => {
    if (!profile) return;
    const { data } = await getPosts(supabase, profile.commune_id);
    if (data) setPosts(data);
  }, [profile]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  // Realtime subscription
  useEffect(() => {
    if (!profile) return;

    const channel = supabase
      .channel("posts-feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "posts", filter: `commune_id=eq.${profile.commune_id}` },
        () => loadPosts()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile, loadPosts]);

  async function onRefresh() {
    setRefreshing(true);
    await loadPosts();
    setRefreshing(false);
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <PostCard post={item} />}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={styles.empty}>Aucune publication pour le moment.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f4f6" },
  list: { padding: 16 },
  empty: { textAlign: "center", color: "#9ca3af", marginTop: 40 },
});
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/
git commit -m "feat(mobile): add feed screen with realtime updates and post cards"
```

---

### Task 22: Mobile Post Creation

**Files:**
- Create: `apps/mobile/src/app/(tabs)/create.tsx`

- [ ] **Step 1: Create post creation screen**

Create `apps/mobile/src/app/(tabs)/create.tsx`:
```typescript
import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, Image } from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth-context";
import { createPostSchema, POST_TYPE_LABELS } from "@rural/shared";
import type { PostType } from "@rural/shared";

const POST_TYPES: PostType[] = ["discussion", "entraide", "evenement"];
const ADMIN_POST_TYPES: PostType[] = ["annonce", ...POST_TYPES];

export default function CreatePostScreen() {
  const router = useRouter();
  const { profile, isAdmin } = useAuth();
  const [type, setType] = useState<PostType>("discussion");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const availableTypes = isAdmin ? ADMIN_POST_TYPES : POST_TYPES;

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 4,
    });

    if (!result.canceled) {
      setImages((prev) => [...prev, ...result.assets.map((a) => a.uri)].slice(0, 4));
    }
  }

  async function handleSubmit() {
    if (!profile) return;

    const parsed = createPostSchema.safeParse({
      title,
      body,
      type,
      event_date: eventDate || null,
      event_location: eventLocation || null,
      epci_visible: false,
    });

    if (!parsed.success) {
      Alert.alert("Erreur", parsed.error.errors[0].message);
      return;
    }

    setLoading(true);

    const { data: post, error } = await supabase
      .from("posts")
      .insert({
        ...parsed.data,
        commune_id: profile.commune_id,
        author_id: profile.id,
      })
      .select()
      .single();

    if (error || !post) {
      Alert.alert("Erreur", "Impossible de publier");
      setLoading(false);
      return;
    }

    // Upload images
    for (const uri of images) {
      const fileName = `${post.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
      const response = await fetch(uri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from("post-images")
        .upload(fileName, blob, { contentType: "image/jpeg" });

      if (!uploadError) {
        await supabase.from("post_images").insert({ post_id: post.id, storage_path: fileName });
      }
    }

    setLoading(false);
    router.replace("/(tabs)/feed");
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Nouvelle publication</Text>

      <View style={styles.typeRow}>
        {availableTypes.map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.typeChip, type === t && styles.typeChipActive]}
            onPress={() => setType(t)}
          >
            <Text style={type === t ? styles.typeChipTextActive : styles.typeChipText}>
              {POST_TYPE_LABELS[t]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TextInput style={styles.input} placeholder="Titre" value={title} onChangeText={setTitle} maxLength={200} />
      <TextInput style={[styles.input, styles.textArea]} placeholder="Contenu" value={body} onChangeText={setBody} multiline maxLength={5000} />

      {type === "evenement" && (
        <>
          <TextInput style={styles.input} placeholder="Date (AAAA-MM-JJ HH:MM)" value={eventDate} onChangeText={setEventDate} />
          <TextInput style={styles.input} placeholder="Lieu" value={eventLocation} onChangeText={setEventLocation} maxLength={200} />
        </>
      )}

      <TouchableOpacity style={styles.imageButton} onPress={pickImage}>
        <Text style={styles.imageButtonText}>Ajouter des photos ({images.length}/4)</Text>
      </TouchableOpacity>

      {images.length > 0 && (
        <View style={styles.imageRow}>
          {images.map((uri, i) => (
            <Image key={i} source={{ uri }} style={styles.thumbnail} />
          ))}
        </View>
      )}

      <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? "Publication..." : "Publier"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, backgroundColor: "#fff", flexGrow: 1 },
  heading: { fontSize: 22, fontWeight: "bold", marginBottom: 16 },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  typeChip: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  typeChipActive: { borderColor: "#1e40af", backgroundColor: "#eff6ff" },
  typeChipText: { fontSize: 13, color: "#6b7280" },
  typeChipTextActive: { fontSize: 13, color: "#1e40af", fontWeight: "600" },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 14, fontSize: 16, marginBottom: 12 },
  textArea: { minHeight: 120, textAlignVertical: "top" },
  imageButton: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 14, alignItems: "center", marginBottom: 12 },
  imageButtonText: { color: "#6b7280", fontSize: 14 },
  imageRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  thumbnail: { width: 72, height: 72, borderRadius: 8 },
  button: { backgroundColor: "#1e40af", borderRadius: 8, padding: 16, alignItems: "center" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/app/\(tabs\)/create.tsx
git commit -m "feat(mobile): add post creation screen with image picker"
```

---

### Task 23: Mobile Post Detail, Comments & RSVP

**Files:**
- Create: `apps/mobile/src/app/post/[id].tsx`

- [ ] **Step 1: Create post detail screen**

Create `apps/mobile/src/app/post/[id].tsx`:
```typescript
import { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Image, Alert } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth-context";
import { getPostById, getComments, createComment, deleteComment, getRsvpCounts, setRsvp, removeRsvp } from "@rural/shared";
import { POST_TYPE_LABELS, POST_TYPE_COLORS } from "@rural/shared";
import type { PostType, RsvpStatus } from "@rural/shared";

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile, isAdmin } = useAuth();
  const [post, setPost] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [rsvpCounts, setRsvpCounts] = useState({ going: 0, maybe: 0, not_going: 0 });
  const [myRsvp, setMyRsvp] = useState<RsvpStatus | null>(null);
  const [commentBody, setCommentBody] = useState("");

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    if (!id || !profile) return;

    const { data: postData } = await getPostById(supabase, id);
    setPost(postData);

    const { data: commentsData } = await getComments(supabase, id);
    setComments(commentsData ?? []);

    const counts = await getRsvpCounts(supabase, id);
    setRsvpCounts(counts);

    const { data: rsvps } = await supabase
      .from("rsvps")
      .select("status")
      .eq("post_id", id)
      .eq("user_id", profile.id);

    setMyRsvp((rsvps?.[0]?.status as RsvpStatus) ?? null);
  }

  async function handleComment() {
    if (!commentBody.trim() || !profile) return;
    await createComment(supabase, id!, profile.id, commentBody);
    setCommentBody("");
    loadData();
  }

  async function handleDeleteComment(commentId: string) {
    await deleteComment(supabase, commentId);
    loadData();
  }

  async function handleRsvp(status: RsvpStatus) {
    if (!profile) return;
    if (myRsvp === status) {
      await removeRsvp(supabase, id!, profile.id);
    } else {
      await setRsvp(supabase, id!, profile.id, status);
    }
    loadData();
  }

  if (!post) return <View style={styles.container}><Text>Chargement...</Text></View>;

  const type = post.type as PostType;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={[styles.badge, { backgroundColor: POST_TYPE_COLORS[type] }]}>
        <Text style={styles.badgeText}>{POST_TYPE_LABELS[type]}</Text>
      </View>

      <Text style={styles.title}>{post.title}</Text>
      <Text style={styles.meta}>
        {post.profiles?.display_name} — {new Date(post.created_at).toLocaleDateString("fr-FR")}
      </Text>
      <Text style={styles.body}>{post.body}</Text>

      {post.type === "evenement" && post.event_date && (
        <View style={styles.eventInfo}>
          <Text style={styles.eventText}>
            {new Date(post.event_date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
          </Text>
          {post.event_location && <Text style={styles.eventText}>{post.event_location}</Text>}
        </View>
      )}

      {post.post_images?.length > 0 && (
        <View style={styles.imageRow}>
          {post.post_images.map((img: any) => (
            <Image
              key={img.id}
              source={{ uri: `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/post-images/${img.storage_path}` }}
              style={styles.postImage}
            />
          ))}
        </View>
      )}

      {post.type === "evenement" && (
        <View style={styles.rsvpRow}>
          {(["going", "maybe", "not_going"] as RsvpStatus[]).map((status) => (
            <TouchableOpacity
              key={status}
              style={[styles.rsvpButton, myRsvp === status && styles.rsvpButtonActive]}
              onPress={() => handleRsvp(status)}
            >
              <Text style={myRsvp === status ? styles.rsvpTextActive : styles.rsvpText}>
                {status === "going" ? `J'y vais (${rsvpCounts.going})` : status === "maybe" ? `Peut-être (${rsvpCounts.maybe})` : `Pas dispo (${rsvpCounts.not_going})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Text style={styles.sectionTitle}>Commentaires ({comments.length})</Text>
      {comments.map((c) => (
        <View key={c.id} style={styles.comment}>
          <View style={styles.commentHeader}>
            <Text style={styles.commentAuthor}>{c.profiles?.display_name}</Text>
            {(c.author_id === profile?.id || isAdmin) && (
              <TouchableOpacity onPress={() => handleDeleteComment(c.id)}>
                <Text style={styles.deleteText}>Supprimer</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.commentBody}>{c.body}</Text>
        </View>
      ))}

      <View style={styles.commentForm}>
        <TextInput
          style={styles.commentInput}
          placeholder="Écrire un commentaire..."
          value={commentBody}
          onChangeText={setCommentBody}
          multiline
          maxLength={2000}
        />
        <TouchableOpacity style={styles.commentButton} onPress={handleComment} disabled={!commentBody.trim()}>
          <Text style={styles.commentButtonText}>Envoyer</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 20 },
  badge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4, marginBottom: 12 },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 4 },
  meta: { fontSize: 13, color: "#9ca3af", marginBottom: 16 },
  body: { fontSize: 15, lineHeight: 22, marginBottom: 16 },
  eventInfo: { backgroundColor: "#eff6ff", borderRadius: 8, padding: 12, marginBottom: 16 },
  eventText: { fontSize: 14, color: "#1e40af" },
  imageRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  postImage: { width: 150, height: 150, borderRadius: 8 },
  rsvpRow: { flexDirection: "row", gap: 8, marginBottom: 24 },
  rsvpButton: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  rsvpButtonActive: { borderColor: "#1e40af", backgroundColor: "#eff6ff" },
  rsvpText: { fontSize: 13, color: "#6b7280" },
  rsvpTextActive: { fontSize: 13, color: "#1e40af", fontWeight: "600" },
  sectionTitle: { fontSize: 16, fontWeight: "600", marginBottom: 12 },
  comment: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 8, padding: 12, marginBottom: 8 },
  commentHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  commentAuthor: { fontSize: 13, fontWeight: "600" },
  deleteText: { fontSize: 12, color: "#dc2626" },
  commentBody: { fontSize: 14 },
  commentForm: { marginTop: 12 },
  commentInput: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 12, fontSize: 14, marginBottom: 8, minHeight: 60, textAlignVertical: "top" },
  commentButton: { backgroundColor: "#1e40af", borderRadius: 8, padding: 12, alignItems: "center" },
  commentButtonText: { color: "#fff", fontSize: 14, fontWeight: "600" },
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/app/post/
git commit -m "feat(mobile): add post detail screen with comments and RSVP"
```

---

### Task 24: Mobile Admin Quick Actions

**Files:**
- Create: `apps/mobile/src/app/(tabs)/profile.tsx`
- Create: `apps/mobile/src/app/admin/moderation.tsx`
- Create: `apps/mobile/src/app/admin/_layout.tsx`

- [ ] **Step 1: Create admin layout**

Create `apps/mobile/src/app/admin/_layout.tsx`:
```typescript
import { Stack } from "expo-router";

export default function AdminLayout() {
  return <Stack />;
}
```

- [ ] **Step 2: Create moderation screen**

Create `apps/mobile/src/app/admin/moderation.tsx`:
```typescript
import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Alert } from "react-native";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth-context";
import { getPendingUsers, approveUser, rejectUser } from "@rural/shared";

type PendingUser = { id: string; display_name: string; created_at: string };

export default function ModerationScreen() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<PendingUser[]>([]);

  useEffect(() => { loadUsers(); }, []);

  async function loadUsers() {
    if (!profile) return;
    const { data } = await getPendingUsers(supabase, profile.commune_id);
    setUsers((data ?? []) as PendingUser[]);
  }

  async function handleApprove(userId: string) {
    await approveUser(supabase, userId);
    loadUsers();
  }

  async function handleReject(userId: string) {
    Alert.alert("Confirmer", "Refuser cette inscription ?", [
      { text: "Annuler", style: "cancel" },
      { text: "Refuser", style: "destructive", onPress: async () => { await rejectUser(supabase, userId); loadUsers(); } },
    ]);
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View>
              <Text style={styles.name}>{item.display_name}</Text>
              <Text style={styles.date}>Inscrit le {new Date(item.created_at).toLocaleDateString("fr-FR")}</Text>
            </View>
            <View style={styles.actions}>
              <TouchableOpacity style={styles.approveButton} onPress={() => handleApprove(item.id)}>
                <Text style={styles.approveText}>Approuver</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.rejectButton} onPress={() => handleReject(item.id)}>
                <Text style={styles.rejectText}>Refuser</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Aucune inscription en attente</Text>}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f4f6" },
  list: { padding: 16 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { fontSize: 15, fontWeight: "600" },
  date: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  actions: { flexDirection: "row", gap: 8 },
  approveButton: { backgroundColor: "#16a34a", borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 },
  approveText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  rejectButton: { backgroundColor: "#dc2626", borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 },
  rejectText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  empty: { textAlign: "center", color: "#9ca3af", marginTop: 40 },
});
```

- [ ] **Step 3: Create profile screen with admin link**

Create `apps/mobile/src/app/(tabs)/profile.tsx`:
```typescript
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth-context";

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, isAdmin } = useAuth();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/auth/login");
  }

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.name}>{profile?.display_name}</Text>
        <Text style={styles.commune}>{profile?.communes?.name}</Text>
        <Text style={styles.role}>{isAdmin ? "Administrateur" : "Résident"}</Text>
      </View>

      {isAdmin && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Administration</Text>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/admin/moderation")}>
            <Text style={styles.menuText}>Inscriptions en attente</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Déconnexion</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f4f6", padding: 24 },
  section: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 16 },
  name: { fontSize: 20, fontWeight: "bold" },
  commune: { fontSize: 15, color: "#6b7280", marginTop: 2 },
  role: { fontSize: 13, color: "#9ca3af", marginTop: 4 },
  sectionTitle: { fontSize: 14, fontWeight: "600", color: "#6b7280", marginBottom: 12 },
  menuItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  menuText: { fontSize: 15 },
  logoutButton: { backgroundColor: "#fff", borderRadius: 12, padding: 16, alignItems: "center", marginTop: 8 },
  logoutText: { color: "#dc2626", fontSize: 15, fontWeight: "600" },
});
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/app/admin/ apps/mobile/src/app/\(tabs\)/profile.tsx
git commit -m "feat(mobile): add profile screen and admin moderation"
```

---

## Phase 4: Polish & Launch

### Task 25: Push Notifications (Mobile)

**Files:**
- Create: `apps/mobile/src/lib/notifications.ts`
- Create: `supabase/functions/push-notification/index.ts`
- Modify: `apps/mobile/src/app/_layout.tsx`

- [ ] **Step 1: Create notification registration helper**

Create `apps/mobile/src/lib/notifications.ts`:
```typescript
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { supabase } from "./supabase";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications(userId: string) {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") return null;

  const token = await Notifications.getExpoPushTokenAsync();

  // Store token in profiles table
  await supabase
    .from("profiles")
    .update({ push_token: token.data } as any)
    .eq("id", userId);

  return token.data;
}
```

Note: This requires adding a `push_token TEXT` column to the `profiles` table.

- [ ] **Step 2: Create migration for push_token column**

Create `supabase/migrations/002_add_push_token.sql`:
```sql
ALTER TABLE profiles ADD COLUMN push_token TEXT;
```

- [ ] **Step 3: Create Edge Function for push notifications**

Create `supabase/functions/push-notification/index.ts`:
```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const { record } = await req.json();

  // Only notify for official announcements
  if (record.type !== "annonce") {
    return new Response("Not an announcement", { status: 200 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Get all push tokens for the commune
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

  // Send via Expo push API
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

- [ ] **Step 4: Add notification registration to root layout**

In `apps/mobile/src/app/_layout.tsx`, add to the `AuthGate` component's useEffect:
```typescript
// Add import at top
import { registerForPushNotifications } from "../lib/notifications";

// Inside useEffect, after the redirect logic:
if (session && profile?.status === "active") {
  registerForPushNotifications(profile.id);
}
```

- [ ] **Step 5: Apply migration**

Run:
```bash
npx supabase db reset
```

- [ ] **Step 6: Deploy edge function**

Run:
```bash
npx supabase functions deploy push-notification
```

Set up a database webhook in Supabase dashboard: trigger on INSERT to `posts` table, call the `push-notification` function.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/lib/notifications.ts supabase/migrations/002_add_push_token.sql supabase/functions/
git commit -m "feat: add push notifications for official announcements"
```

---

### Task 26: Intercommunalité Toggle

**Files:**
- Create: `packages/shared/src/queries/epci.ts`
- Modify: `apps/web/src/app/app/feed/page.tsx`
- Modify: `apps/mobile/src/app/(tabs)/feed/index.tsx`

- [ ] **Step 1: Add EPCI posts query to shared**

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

Add to `packages/shared/src/queries/index.ts`:
```typescript
export { getEpciPosts } from "./epci";
```

- [ ] **Step 2: Add toggle to web feed**

Update `apps/web/src/app/app/feed/page.tsx` to accept a `?scope=epci` query param and conditionally call `getEpciPosts` instead of `getPosts`. Add a toggle button in the UI that switches between `?scope=commune` and `?scope=epci`.

The page should read `searchParams`, and render a toggle:
```typescript
// Add to imports
import { getEpciPosts } from "@rural/shared";

// In the component, after getting profile:
const scope = searchParams?.scope === "epci" ? "epci" : "commune";

const { data: posts } = scope === "epci" && profile.communes?.epci_id
  ? await getEpciPosts(supabase, profile.communes.epci_id)
  : await getPosts(supabase, profile.commune_id);

// In the JSX, add toggle before the posts list:
// <div className="flex gap-2">
//   <Link href="/app/feed?scope=commune">Ma commune</Link>
//   <Link href="/app/feed?scope=epci">Intercommunalité</Link>
// </div>
```

- [ ] **Step 3: Add toggle to mobile feed**

Update `apps/mobile/src/app/(tabs)/feed/index.tsx` to add a state toggle and conditionally call `getEpciPosts`.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/queries/ apps/web/src/app/app/feed/ apps/mobile/src/app/\(tabs\)/feed/
git commit -m "feat: add intercommunalité toggle to web and mobile feeds"
```

---

### Task 27: Deployment Setup

**Files:**
- Create: `apps/web/vercel.json`
- Modify: `apps/mobile/app.json`

- [ ] **Step 1: Configure Vercel for monorepo**

Create `apps/web/vercel.json`:
```json
{
  "installCommand": "pnpm install",
  "buildCommand": "cd ../.. && pnpm turbo build --filter web"
}
```

- [ ] **Step 2: Configure Expo for EAS builds**

Update `apps/mobile/app.json` with production values:
```json
{
  "expo": {
    "name": "Ma Commune",
    "slug": "ma-commune",
    "version": "1.0.0",
    "ios": {
      "bundleIdentifier": "com.macommune.app"
    },
    "android": {
      "package": "com.macommune.app"
    }
  }
}
```

Create `apps/mobile/eas.json`:
```json
{
  "cli": { "version": ">= 3.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {}
  }
}
```

- [ ] **Step 3: Create production environment variables checklist**

Document in `CLAUDE.md` the required production env vars:
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` — for server-side only
- `EXPO_PUBLIC_SUPABASE_URL` — same URL for mobile
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — same anon key for mobile

- [ ] **Step 4: Commit**

```bash
git add apps/web/vercel.json apps/mobile/eas.json apps/mobile/app.json
git commit -m "chore: add Vercel and EAS deployment configuration"
```

---

## Summary

| Phase | Tasks | What it delivers |
|---|---|---|
| 1. Foundation | 1-8 | Monorepo, Supabase schema, shared types/queries/validation |
| 2. Web | 9-17 | Next.js app with auth, feed, post creation, comments, RSVP, admin, public website |
| 3. Mobile | 18-24 | Expo app with auth, feed, post creation, comments, RSVP, admin moderation |
| 4. Polish | 25-27 | Push notifications, intercommunalité toggle, deployment config |
