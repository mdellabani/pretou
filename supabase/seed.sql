-- Seed EPCI
INSERT INTO epci (id, name) VALUES
  ('00000000-0000-0000-0000-000000000001', 'CC du Pays de Test');

-- Seed communes with design fields
INSERT INTO communes (id, epci_id, name, slug, code_postal, invite_code, theme, motto, description) VALUES
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'Saint-Test-le-Petit', 'saint-test-le-petit', '12345', 'test01', 'terre_doc', 'Vivre ensemble, simplement', 'Saint-Test-le-Petit est un village de 350 habitants niché dans les collines du Béarn, entre vallées verdoyantes et traditions vivantes.'),
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'Testville-sur-Cher', 'testville-sur-cher', '12346', 'test02', 'atlantique', 'Penn ar bed', 'Testville-sur-Cher est une commune de 800 habitants au bord du Cher, connue pour son marché du dimanche et son église romane.');
