# Supabase Migrations

Ce projet suit maintenant le format attendu par la CLI Supabase:

- `supabase/config.toml`
- `supabase/migrations/*.sql` avec horodatage

Le dossier historique `supabase/migration/` est conserve pour reference et pour les seeds existants.

## Reprise d'historique

Comme les scripts SQL du projet existaient avant la standardisation CLI, la table d'historique distante a ete alignee avec les versions locales via `supabase migration repair`.

Commandes utiles:

```powershell
npx supabase migration list
npx supabase db push
```

Pour une nouvelle migration:

```powershell
npx supabase migration new nom_de_la_migration
```
