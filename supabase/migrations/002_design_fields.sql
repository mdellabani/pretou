ALTER TABLE communes ADD COLUMN theme TEXT NOT NULL DEFAULT 'terre_doc'
  CHECK (theme IN ('terre_doc', 'provence', 'atlantique', 'alpin', 'ble_dore', 'corse', 'champagne', 'ardoise'));

ALTER TABLE communes ADD COLUMN motto TEXT;
ALTER TABLE communes ADD COLUMN hero_image_url TEXT;
ALTER TABLE communes ADD COLUMN description TEXT;
ALTER TABLE communes ADD COLUMN blason_url TEXT;
ALTER TABLE communes ADD COLUMN infos_pratiques JSONB DEFAULT '{}';
