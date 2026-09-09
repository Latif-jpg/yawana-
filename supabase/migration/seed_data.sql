-- Clean existing data to avoid conflicts during testing
DELETE FROM prices;
DELETE FROM shops;
DELETE FROM markets;
DELETE FROM products;
DELETE FROM cities;

-- Insert all major cities/regions
INSERT INTO cities (name, country) VALUES 
('Ouagadougou', 'Burkina Faso'),
('Bobo-Dioulasso', 'Hauts-Bassins'),
('Koudougou', 'Centre-Ouest'),
('Ouahigouya', 'Nord'),
('Kaya', 'Centre-Nord'),
('Tenkodogo', 'Centre-Est'),
('Dédougou', 'Boucle du Mouhoun'),
('Dori', 'Sahel'),
('Gaoua', 'Sud-Ouest'),
('Banfora', 'Cascades'),
('Manga', 'Centre-Sud'),
('Ziniaré', 'Plateau-Central'),
('Fada N’Gourma', 'Est');

-- Insert comprehensive products
INSERT INTO products (name, category, unit) VALUES
-- Céréales
('Maïs Blanc', 'Céréales', 'kg'),
('Mil Local', 'Céréales', 'kg'),
('Sorgho Rouge', 'Céréales', 'kg'),
('Riz Importé', 'Céréales', 'kg'),
('Riz Local (Kam)', 'Céréales', 'kg'),
('Fonio', 'Céréales', 'kg'),
('Niébé (Haricot)', 'Céréales', 'kg'),
-- Alimentation Fraîche
('Tomate', 'Alimentation Fraîche', 'kg'),
('Oignon Jaune', 'Alimentation Fraîche', 'kg'),
('Oignon Rouge', 'Alimentation Fraîche', 'kg'),
('Gombo', 'Alimentation Fraîche', 'kg'),
('Aubergine', 'Alimentation Fraîche', 'kg'),
('Chou', 'Alimentation Fraîche', 'kg'),
('Pomme de Terre', 'Alimentation Fraîche', 'kg'),
-- Fruits
('Mangue (Carton 40kg)', 'Fruits', 'carton'),
('Ananas', 'Fruits', 'pièce'),
('Banane Douce', 'Fruits', 'kg'),
('Papaye', 'Fruits', 'pièce'),
-- Divers
('Beurre de Karité', 'Epicerie', 'kg'),
('Savon Local (Tangawizi)', 'Ménage', 'bloc'),
('Huile de Palme', 'Epicerie', 'litre'),
('Pagne Faso Danfani', 'Habillement', 'pagne'),
('Chapeau Saponé', 'Artisanat', 'pièce');

-- Insert Markets and Initial Prices
DO $$
DECLARE
    ouaga_id UUID;
    bobo_id UUID;
    dori_id UUID;
    banfora_id UUID;
    ouahi_id UUID;
    
    p_mais UUID;
    p_mil UUID;
    p_sorgho UUID;
    p_riz UUID;
    p_tomate UUID;
    p_mangue UUID;
    p_ananas UUID;
    
    m_roodwoko UUID;
    m_wemtenga UUID;
    m_pissy UUID;
    m_bobo_central UUID;
    m_dori_central UUID;
    m_banfora_est UUID;
BEGIN
    -- Get City IDs
    SELECT id INTO ouaga_id FROM cities WHERE name = 'Ouagadougou' LIMIT 1;
    SELECT id INTO bobo_id FROM cities WHERE name = 'Bobo-Dioulasso' LIMIT 1;
    SELECT id INTO dori_id FROM cities WHERE name = 'Dori' LIMIT 1;
    SELECT id INTO banfora_id FROM cities WHERE name = 'Banfora' LIMIT 1;
    SELECT id INTO ouahi_id FROM cities WHERE name = 'Ouahigouya' LIMIT 1;

    -- Get Product IDs
    SELECT id INTO p_mais FROM products WHERE name = 'Maïs Blanc' LIMIT 1;
    SELECT id INTO p_mil FROM products WHERE name = 'Mil Local' LIMIT 1;
    SELECT id INTO p_sorgho FROM products WHERE name = 'Sorgho Rouge' LIMIT 1;
    SELECT id INTO p_riz FROM products WHERE name = 'Riz Importé' LIMIT 1;
    SELECT id INTO p_tomate FROM products WHERE name = 'Tomate' LIMIT 1;
    SELECT id INTO p_mangue FROM products WHERE name = 'Mangue (Carton 40kg)' LIMIT 1;
    SELECT id INTO p_ananas FROM products WHERE name = 'Ananas' LIMIT 1;

    -- Insert Markets
    INSERT INTO markets (name, city_id, market_type) VALUES
    ('Rood Woko (Grand Marché)', ouaga_id, 'physical') RETURNING id INTO m_roodwoko;
    INSERT INTO markets (name, city_id, market_type) VALUES
    ('Wemtenga', ouaga_id, 'physical') RETURNING id INTO m_wemtenga;
    INSERT INTO markets (name, city_id, market_type) VALUES
    ('Marché de Pissy', ouaga_id, 'physical') RETURNING id INTO m_pissy;
    INSERT INTO markets (name, city_id, market_type) VALUES
    ('Grand Marché de Bobo', bobo_id, 'physical') RETURNING id INTO m_bobo_central;
    INSERT INTO markets (name, city_id, market_type) VALUES
    ('Marché de Dori Centre', dori_id, 'physical') RETURNING id INTO m_dori_central;
    INSERT INTO markets (name, city_id, market_type) VALUES
    ('Marché de Banfora Est', banfora_id, 'street') RETURNING id INTO m_banfora_est;

    -- Insert Initial Baseline Prices (Realistic based on report)
    -- Ouagadougou
    INSERT INTO prices (product_id, market_id, price_value, recorded_by) VALUES
    (p_mais, m_roodwoko, 185, '00000000-0000-0000-0000-000000000000'),
    (p_mil, m_roodwoko, 234, '00000000-0000-0000-0000-000000000000'),
    (p_riz, m_wemtenga, 400, '00000000-0000-0000-0000-000000000000'),
    (p_tomate, m_pissy, 535, '00000000-0000-0000-0000-000000000000');
    
    -- Bobo (Often cheaper for cereals and mangos)
    INSERT INTO prices (product_id, market_id, price_value, recorded_by) VALUES
    (p_mil, m_bobo_central, 210, '00000000-0000-0000-0000-000000000000'),
    (p_mangue, m_bobo_central, 8500, '00000000-0000-0000-0000-000000000000');
    
    -- Dori (Sahel - more expensive)
    INSERT INTO prices (product_id, market_id, price_value, recorded_by) VALUES
    (p_mil, m_dori_central, 580, '00000000-0000-0000-0000-000000000000'),
    (p_riz, m_dori_central, 700, '00000000-0000-0000-0000-000000000000');

    -- Banfora (Cascades - fruit paradise)
    INSERT INTO prices (product_id, market_id, price_value, recorded_by) VALUES
    (p_ananas, m_banfora_est, 150, '00000000-0000-0000-0000-000000000000');

END $$;
-- Sample Shops for Marketplace
INSERT INTO shops (name, market_id, contact_info, trust_score, is_verified) 
SELECT 'Chez Moussa', id, '+226 70 00 00 01', 4.8, true FROM markets WHERE name = 'Rood Woko' LIMIT 1;

INSERT INTO shops (name, market_id, contact_info, trust_score, is_verified) 
SELECT 'Boutique Fatou', id, '+226 75 00 00 02', 4.5, true FROM markets WHERE name = 'Grand Marché de Bobo' LIMIT 1;

-- Link some prices to these shops
UPDATE prices SET shop_id = (SELECT id FROM shops WHERE name = 'Chez Moussa') 
WHERE id IN (
    SELECT id FROM prices 
    WHERE market_id = (SELECT market_id FROM shops WHERE name = 'Chez Moussa') 
    LIMIT 3
);

UPDATE prices SET shop_id = (SELECT id FROM shops WHERE name = 'Boutique Fatou') 
WHERE id IN (
    SELECT id FROM prices 
    WHERE market_id = (SELECT market_id FROM shops WHERE name = 'Boutique Fatou') 
    LIMIT 3
);
