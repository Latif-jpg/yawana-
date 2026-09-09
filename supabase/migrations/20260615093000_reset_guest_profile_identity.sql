UPDATE profiles
SET
  full_name = 'Visiteur Anonyme',
  role = 'client',
  bio = 'Contributeur de passage sur MarketRadar.'
WHERE id = '00000000-0000-0000-0000-000000000000';

NOTIFY pgrst, 'reload schema';
