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
