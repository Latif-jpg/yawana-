ALTER TABLE markets ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

INSERT INTO cities (name, country)
SELECT 'Yako', 'Burkina Faso'
WHERE NOT EXISTS (
  SELECT 1 FROM cities WHERE lower(name) = lower('Yako')
);

UPDATE markets
SET
  city_id = COALESCE(
    city_id,
    (SELECT id FROM cities WHERE lower(name) = lower('Ouagadougou') LIMIT 1)
  ),
  latitude = COALESCE(latitude, 12.3687),
  longitude = COALESCE(longitude, -1.5274)
WHERE name = 'Rood Woko (Grand Marché)';

UPDATE markets
SET
  city_id = COALESCE(
    city_id,
    (SELECT id FROM cities WHERE lower(name) = lower('Ouagadougou') LIMIT 1)
  ),
  latitude = COALESCE(latitude, 12.3671),
  longitude = COALESCE(longitude, -1.5192)
WHERE name = 'Sankariaré';

UPDATE markets
SET
  city_id = COALESCE(
    city_id,
    (SELECT id FROM cities WHERE lower(name) = lower('Farakan') LIMIT 1)
  ),
  latitude = COALESCE(latitude, 10.6278),
  longitude = COALESCE(longitude, -4.7753)
WHERE name = 'Farakan Marché';

UPDATE markets
SET
  city_id = COALESCE(
    city_id,
    (SELECT id FROM cities WHERE lower(name) = lower('Niangoloko') LIMIT 1)
  ),
  latitude = COALESCE(latitude, 10.2818),
  longitude = COALESCE(longitude, -4.9297)
WHERE name = 'Niangoloko Marché';

UPDATE markets
SET
  city_id = COALESCE(
    city_id,
    (SELECT id FROM cities WHERE lower(name) = lower('Tougan') LIMIT 1)
  ),
  latitude = COALESCE(latitude, 13.0721),
  longitude = COALESCE(longitude, -3.0694)
WHERE name = 'Tougan Central';

UPDATE markets
SET
  city_id = COALESCE(
    city_id,
    (SELECT id FROM cities WHERE lower(name) = lower('Yako') LIMIT 1)
  )
WHERE lower(name) = lower('Marché de yako');
