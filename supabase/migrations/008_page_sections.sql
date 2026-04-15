-- Page sections table
CREATE TABLE IF NOT EXISTS page_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commune_id UUID NOT NULL REFERENCES communes(id),
  page TEXT NOT NULL DEFAULT 'homepage',
  section_type TEXT NOT NULL CHECK (section_type IN (
    'hero', 'welcome', 'highlights', 'news', 'events',
    'gallery', 'links', 'text', 'services'
  )),
  visible BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  content JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_page_sections_commune_page ON page_sections(commune_id, page, sort_order);

ALTER TABLE page_sections ENABLE ROW LEVEL SECURITY;

-- Public read for website rendering
CREATE POLICY "Anyone can view page sections"
  ON page_sections FOR SELECT TO anon, authenticated
  USING (true);

-- Admin CRUD
CREATE POLICY "Admins can insert page sections"
  ON page_sections FOR INSERT TO authenticated
  WITH CHECK (commune_id = auth_commune_id() AND is_commune_admin());

CREATE POLICY "Admins can update page sections"
  ON page_sections FOR UPDATE TO authenticated
  USING (commune_id = auth_commune_id() AND is_commune_admin());

CREATE POLICY "Admins can delete page sections"
  ON page_sections FOR DELETE TO authenticated
  USING (commune_id = auth_commune_id() AND is_commune_admin());

-- Website images bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('website-images', 'website-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload website images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'website-images');

CREATE POLICY "Anyone can view website images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'website-images');

CREATE POLICY "Authenticated users can delete website images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'website-images');
