-- Demo external reference prices for step 1 intelligence
-- Safe to rerun: removes previous demo rows before inserting fresh ones.

DELETE FROM external_price_sources
WHERE source_name IN (
    'SONAGESS Bulletin',
    'Marche Public Burkina',
    'Catalogue Grossiste Ouaga',
    'Reference Saisonnale Cascades'
);

DO $$
DECLARE
    p_mais UUID;
    p_mil UUID;
    p_riz UUID;
    p_tomate UUID;
    p_oignon UUID;
    p_huile UUID;
    p_ananas UUID;
BEGIN
    SELECT id INTO p_mais FROM products WHERE name IN ('Maïs Blanc', 'MaÃ¯s Blanc') LIMIT 1;
    SELECT id INTO p_mil FROM products WHERE name = 'Mil Local' LIMIT 1;
    SELECT id INTO p_riz FROM products WHERE name IN ('Riz Importé', 'Riz ImportÃ©') LIMIT 1;
    SELECT id INTO p_tomate FROM products WHERE name = 'Tomate' LIMIT 1;
    SELECT id INTO p_oignon FROM products WHERE name IN ('Oignon Jaune', 'Oignon Rouge') ORDER BY name LIMIT 1;
    SELECT id INTO p_huile FROM products WHERE name = 'Huile de Palme' LIMIT 1;
    SELECT id INTO p_ananas FROM products WHERE name = 'Ananas' LIMIT 1;

    IF p_mais IS NOT NULL THEN
        INSERT INTO external_price_sources (
            product_id, source_name, source_type, url, location_label, unit, quantity, currency,
            price_value, confidence_score, collected_at, raw_payload
        ) VALUES
        (
            p_mais,
            'SONAGESS Bulletin',
            'public_dataset',
            'https://www.sonagess.bf/',
            'Ouagadougou',
            'kg',
            1,
            'XOF',
            205,
            0.82,
            NOW() - INTERVAL '2 days',
            jsonb_build_object('label', 'mais_reference', 'origin', 'bulletin')
        ),
        (
            p_mais,
            'Catalogue Grossiste Ouaga',
            'merchant',
            'https://example.com/grossiste-ouaga',
            'Ouagadougou',
            'kg',
            1,
            'XOF',
            198,
            0.68,
            NOW() - INTERVAL '1 day',
            jsonb_build_object('label', 'grossiste_ouaga')
        );
    END IF;

    IF p_mil IS NOT NULL THEN
        INSERT INTO external_price_sources (
            product_id, source_name, source_type, url, location_label, unit, quantity, currency,
            price_value, confidence_score, collected_at, raw_payload
        ) VALUES
        (
            p_mil,
            'SONAGESS Bulletin',
            'public_dataset',
            'https://www.sonagess.bf/',
            'Sahel',
            'kg',
            1,
            'XOF',
            540,
            0.84,
            NOW() - INTERVAL '2 days',
            jsonb_build_object('label', 'mil_reference', 'origin', 'bulletin')
        ),
        (
            p_mil,
            'Marche Public Burkina',
            'marketplace',
            'https://example.com/marche-public-burkina',
            'Ouahigouya',
            'kg',
            1,
            'XOF',
            515,
            0.61,
            NOW() - INTERVAL '3 days',
            jsonb_build_object('label', 'mil_marketplace')
        );
    END IF;

    IF p_riz IS NOT NULL THEN
        INSERT INTO external_price_sources (
            product_id, source_name, source_type, url, location_label, unit, quantity, currency,
            price_value, confidence_score, collected_at, raw_payload
        ) VALUES
        (
            p_riz,
            'Catalogue Grossiste Ouaga',
            'merchant',
            'https://example.com/grossiste-ouaga',
            'Ouagadougou',
            'kg',
            1,
            'XOF',
            430,
            0.73,
            NOW() - INTERVAL '1 day',
            jsonb_build_object('label', 'riz_importe_ouaga')
        ),
        (
            p_riz,
            'Marche Public Burkina',
            'marketplace',
            'https://example.com/marche-public-burkina',
            'Dori',
            'kg',
            1,
            'XOF',
            680,
            0.66,
            NOW() - INTERVAL '4 days',
            jsonb_build_object('label', 'riz_importe_dori')
        );
    END IF;

    IF p_tomate IS NOT NULL THEN
        INSERT INTO external_price_sources (
            product_id, source_name, source_type, url, location_label, unit, quantity, currency,
            price_value, confidence_score, collected_at, raw_payload
        ) VALUES
        (
            p_tomate,
            'Marche Public Burkina',
            'marketplace',
            'https://example.com/marche-public-burkina',
            'Ouagadougou',
            'kg',
            1,
            'XOF',
            620,
            0.58,
            NOW() - INTERVAL '1 day',
            jsonb_build_object('label', 'tomate_ouaga')
        );
    END IF;

    IF p_oignon IS NOT NULL THEN
        INSERT INTO external_price_sources (
            product_id, source_name, source_type, url, location_label, unit, quantity, currency,
            price_value, confidence_score, collected_at, raw_payload
        ) VALUES
        (
            p_oignon,
            'Catalogue Grossiste Ouaga',
            'merchant',
            'https://example.com/grossiste-ouaga',
            'Ouagadougou',
            'kg',
            1,
            'XOF',
            410,
            0.64,
            NOW() - INTERVAL '2 days',
            jsonb_build_object('label', 'oignon_reference')
        );
    END IF;

    IF p_huile IS NOT NULL THEN
        INSERT INTO external_price_sources (
            product_id, source_name, source_type, url, location_label, unit, quantity, currency,
            price_value, confidence_score, collected_at, raw_payload
        ) VALUES
        (
            p_huile,
            'Catalogue Grossiste Ouaga',
            'merchant',
            'https://example.com/grossiste-ouaga',
            'Ouagadougou',
            'litre',
            1,
            'XOF',
            1025,
            0.70,
            NOW() - INTERVAL '2 days',
            jsonb_build_object('label', 'huile_reference')
        );
    END IF;

    IF p_ananas IS NOT NULL THEN
        INSERT INTO external_price_sources (
            product_id, source_name, source_type, url, location_label, unit, quantity, currency,
            price_value, confidence_score, collected_at, raw_payload
        ) VALUES
        (
            p_ananas,
            'Reference Saisonnale Cascades',
            'manual',
            'https://example.com/reference-cascades',
            'Banfora',
            'pièce',
            1,
            'XOF',
            175,
            0.77,
            NOW() - INTERVAL '1 day',
            jsonb_build_object('label', 'ananas_saisonnier')
        );
    END IF;
END $$;
