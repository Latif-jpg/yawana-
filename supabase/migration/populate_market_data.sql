-- 1. Cities
INSERT INTO cities (name, country)
SELECT 'Tougan', 'Burkina Faso' WHERE NOT EXISTS (SELECT 1 FROM cities WHERE name = 'Tougan');
INSERT INTO cities (name, country)
SELECT 'Niangoloko', 'Burkina Faso' WHERE NOT EXISTS (SELECT 1 FROM cities WHERE name = 'Niangoloko');
INSERT INTO cities (name, country)
SELECT 'Titao', 'Burkina Faso' WHERE NOT EXISTS (SELECT 1 FROM cities WHERE name = 'Titao');
INSERT INTO cities (name, country)
SELECT 'Kongoussi', 'Burkina Faso' WHERE NOT EXISTS (SELECT 1 FROM cities WHERE name = 'Kongoussi');
INSERT INTO cities (name, country)
SELECT 'Léo', 'Burkina Faso' WHERE NOT EXISTS (SELECT 1 FROM cities WHERE name = 'Léo');
INSERT INTO cities (name, country)
SELECT 'Kombissiri', 'Burkina Faso' WHERE NOT EXISTS (SELECT 1 FROM cities WHERE name = 'Kombissiri');
INSERT INTO cities (name, country)
SELECT 'Bogandé', 'Burkina Faso' WHERE NOT EXISTS (SELECT 1 FROM cities WHERE name = 'Bogandé');
INSERT INTO cities (name, country)
SELECT 'Farakan', 'Burkina Faso' WHERE NOT EXISTS (SELECT 1 FROM cities WHERE name = 'Farakan');
INSERT INTO cities (name, country)
SELECT 'Boussé', 'Burkina Faso' WHERE NOT EXISTS (SELECT 1 FROM cities WHERE name = 'Boussé');
INSERT INTO cities (name, country)
SELECT 'Djibo', 'Burkina Faso' WHERE NOT EXISTS (SELECT 1 FROM cities WHERE name = 'Djibo');
INSERT INTO cities (name, country)
SELECT 'Diébougou', 'Burkina Faso' WHERE NOT EXISTS (SELECT 1 FROM cities WHERE name = 'Diébougou');

-- 2. Markets
INSERT INTO markets (name, city_id) 
SELECT 'Sankariaré', id FROM cities 
WHERE name = 'Ouagadougou'
AND NOT EXISTS (SELECT 1 FROM markets WHERE name = 'Sankariaré');

INSERT INTO markets (name, city_id) 
SELECT 'Tougan Central', id FROM cities 
WHERE name = 'Tougan'
AND NOT EXISTS (SELECT 1 FROM markets WHERE name = 'Tougan Central');

INSERT INTO markets (name, city_id) 
SELECT 'Niangoloko Marché', id FROM cities 
WHERE name = 'Niangoloko'
AND NOT EXISTS (SELECT 1 FROM markets WHERE name = 'Niangoloko Marché');

INSERT INTO markets (name, city_id)
SELECT 'Farakan Marché', id FROM cities 
WHERE name = 'Farakan'
AND NOT EXISTS (SELECT 1 FROM markets WHERE name = 'Farakan Marché');

-- 3. Products
INSERT INTO products (name, category, unit) 
SELECT 'Mil', 'Céréales', 'kg' WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Mil');
INSERT INTO products (name, category, unit) 
SELECT 'Maïs (100kg)', 'Céréales', 'sac' WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Maïs (100kg)');
INSERT INTO products (name, category, unit) 
SELECT 'Huile Savor (5L)', 'Alimentation Fraîche', 'bidon' WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Huile Savor (5L)');
INSERT INTO products (name, category, unit) 
SELECT 'Viande de Boeuf', 'Viandes', 'kg' WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Viande de Boeuf');
INSERT INTO products (name, category, unit) 
SELECT 'Sucre', 'Epicerie', 'kg' WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Sucre');
INSERT INTO products (name, category, unit) 
SELECT 'Savon SN-CITEC', 'Ménage', 'boule' WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Savon SN-CITEC');
INSERT INTO products (name, category, unit) 
SELECT 'Détergent (250g)', 'Ménage', 'sachet' WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Détergent (250g)');
INSERT INTO products (name, category, unit) 
SELECT 'Piles', 'Ménage', 'paquet' WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Piles');
INSERT INTO products (name, category, unit) 
SELECT 'Loyer Chambre Salon', 'Immobilier', 'mois' WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Loyer Chambre Salon');
INSERT INTO products (name, category, unit) 
SELECT 'Smartphone Itel', 'Téléphonie', 'unité' WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Smartphone Itel');
INSERT INTO products (name, category, unit) 
SELECT 'Forfait Data 1Go', 'Téléphonie', 'unité' WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Forfait Data 1Go');
INSERT INTO products (name, category, unit) 
SELECT 'Pagne Faso Dan Fani', 'Habillement', 'complet' WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Pagne Faso Dan Fani');

-- 4. Prices
-- Mil - Grand Marché (Rood Woko)
INSERT INTO prices (product_id, market_id, price_value, quantity, recorded_by)
SELECT 
    p.id, m.id, 350, 1, '00000000-0000-0000-0000-000000000000'
FROM products p, markets m
WHERE p.name = 'Mil' AND m.name = 'Grand Marché (Rood Woko)'
AND NOT EXISTS (
    SELECT 1 FROM prices 
    WHERE product_id = p.id AND market_id = m.id AND price_value = 350
);

-- Maïs (100kg) - Grand Marché de Bobo
INSERT INTO prices (product_id, market_id, price_value, quantity, recorded_by)
SELECT 
    p.id, m.id, 21000, 1, '00000000-0000-0000-0000-000000000000'
FROM products p, markets m
WHERE p.name = 'Maïs (100kg)' AND m.name = 'Grand Marché de Bobo'
AND NOT EXISTS (
    SELECT 1 FROM prices 
    WHERE product_id = p.id AND market_id = m.id AND price_value = 21000
);

-- Sucre - Ouahigouya
INSERT INTO prices (product_id, market_id, price_value, quantity, recorded_by)
SELECT 
    p.id, m.id, 1000, 1, '00000000-0000-0000-0000-000000000000'
FROM products p, markets m
WHERE p.name = 'Sucre' AND m.name = 'Grand Marché de Ouahigouya'
AND NOT EXISTS (
    SELECT 1 FROM prices 
    WHERE product_id = p.id AND market_id = m.id AND price_value = 1000
);
