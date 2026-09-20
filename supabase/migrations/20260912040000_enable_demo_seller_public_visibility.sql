-- Le compte vendeur de démonstration est utilisé pour les tests à deux comptes.
-- Son accès était auparavant simulé uniquement côté application, ce qui le
-- rendait visible par lui-même mais pas par les autres utilisateurs.
UPDATE profiles
SET
  verified_market_badge = true,
  verified_market_badge_at = COALESCE(verified_market_badge_at, NOW()),
  market_access_tier = 'verified'
WHERE id = '853d7644-0ef0-4560-ac80-585c541121ed';

UPDATE boutique_items
SET is_visible_in_search = true
WHERE owner_id = '853d7644-0ef0-4560-ac80-585c541121ed';

NOTIFY pgrst, 'reload schema';
