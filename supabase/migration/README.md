# Supabase SQL

Ce dossier centralise tous les scripts SQL du projet.

Ordre de lecture utile:

- `supabase_schema.sql`: schema complet pour une base vide
- `profile_schema.sql`: schema profil/gamification initial
- `seed_data.sql`: donnees de demo locales
- `seed_external_price_sources.sql`: references externes de demo
- `migration_*.sql`: evolutions incrementales appliquees sur une base existante
- `fix_rls.sql`, `setup_policies.sql`, `*_rls.sql`: politiques RLS et correctifs d'acces
- `migration_schedule_daily_refresh.sql`: planification cron Supabase pour regenerer snapshots + alertes chaque matin a 8h

Regle pratique:

- base vide: partir de `supabase_schema.sql`, puis scripts complementaires necessaires
- base existante: appliquer seulement les `migration_*.sql` utiles

Routine recommandee:

- deployer la function `supabase/functions/daily-refresh`
- creer les secrets Vault `project_url` et `service_role_key`
- executer `migration_schedule_daily_refresh.sql`
