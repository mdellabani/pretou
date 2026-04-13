-- Seed EPCI
INSERT INTO epci (id, name) VALUES
  ('00000000-0000-0000-0000-000000000001', 'CC du Pays de Test');

-- Seed communes
INSERT INTO communes (id, epci_id, name, slug, code_postal, invite_code) VALUES
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'Saint-Test-le-Petit', 'saint-test-le-petit', '12345', 'test01'),
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'Testville-sur-Cher', 'testville-sur-cher', '12346', 'test02');
