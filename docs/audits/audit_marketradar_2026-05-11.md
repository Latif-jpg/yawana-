# Audit MarketRadar

Date: 2026-05-11

## Constats Prioritaires

1. La mécanique de confiance est falsifiable côté client. Le profil autorise l'`upsert` de `points`, `level` et `trust_score` depuis l'app [libs/queries.ts](C:/Users/tifla/Music/mes projets/marketradar/libs/queries.ts:948), et l'écran profil pousse automatiquement ces valeurs calculées côté client vers la base [app/(tabs)/profile.tsx](C:/Users/tifla/Music/mes projets/marketradar/app/(tabs)/profile.tsx:139). Comme la policy RLS ne restreint que `auth.uid() = id` sans bloquer les colonnes sensibles [migration_profile_rls_fix.sql](C:/Users/tifla/Music/mes projets/marketradar/supabase/migration/migration_profile_rls_fix.sql:11), un utilisateur authentifié peut gonfler son score, son niveau et sa "fiabilité". Pour un produit orienté marché, c'est un risque critique de crédibilité.

2. Les alertes sont modifiables publiquement, y compris en anonyme. Les policies autorisent `SELECT`, `INSERT` et `UPDATE` à `public` sur `price_alerts`, et `SELECT`/`INSERT` à `public` sur `price_alert_actions` [migration_price_alerts_rls.sql](C:/Users/tifla/Music/mes projets/marketradar/supabase/migration/migration_price_alerts_rls.sql:8). En plus, l'écran profil permet de confirmer/corriger une alerte sans garde explicite sur la session [app/(tabs)/profile.tsx](C:/Users/tifla/Music/mes projets/marketradar/app/(tabs)/profile.tsx:252) [app/(tabs)/profile.tsx](C:/Users/tifla/Music/mes projets/marketradar/app/(tabs)/profile.tsx:281). Résultat: la qualité du signal peut être manipulée par n'importe quel client.

3. La prévention des doublons est incohérente et bloque probablement des relevés légitimes. Le code parle d'une fenêtre de 10 minutes [libs/queries.ts](C:/Users/tifla/Music/mes projets/marketradar/libs/queries.ts:631), mais la base pose un index unique permanent sur `submission_hash` [migration_prevent_duplicate_prices.sql](C:/Users/tifla/Music/mes projets/marketradar/supabase/migration/migration_prevent_duplicate_prices.sql:5). Donc si le même utilisateur ressaisit plus tard le même prix pour le même produit/marché/quantité, l'insertion restera bloquée indéfiniment. C'est mauvais pour la collecte terrain, surtout sur des prix stables.

4. Les notifications push risquent d'être du spam non ciblé. La fonction envoie chaque alerte prioritaire à tous les tokens `expo_push_token` trouvés [daily-refresh/index.ts](C:/Users/tifla/Music/mes projets/marketradar/supabase/functions/daily-refresh/index.ts:501), sans filtrage par ville, marché, rôle ou historique. En plus, le filtre `.is('expo_push_token', 'not.null')` semble incorrect [daily-refresh/index.ts](C:/Users/tifla/Music/mes projets/marketradar/supabase/functions/daily-refresh/index.ts:505), donc soit il ne marche pas, soit il se comporte de façon inattendue. Côté psychologie utilisateur, ça détruit vite la confiance et augmente le churn.

5. Une partie des analyses affichées n'est pas économiquement fiable. `usePrices()` ne charge que les 20 derniers prix globaux [libs/queries.ts](C:/Users/tifla/Music/mes projets/marketradar/libs/queries.ts:124), alors que le feed et la carte en tirent des signaux d'ensemble. Pire, la carte calcule une "moyenne" de marché en moyennant des `price_value` bruts de produits différents [app/(tabs)/map.tsx](C:/Users/tifla/Music/mes projets/marketradar/app/(tabs)/map.tsx:35), ce qui n'a pas de sens économique. Une moyenne maïs + savon + viande n'est pas une métrique exploitable.

## Lecture Transverse

Techniquement, le projet est ambitieux et déjà bien structuré: Expo Router, React Query, Supabase, fonctions d'intelligence, normalisation d'unités, logique d'alertes. Le vrai point faible n'est pas le front, c'est la gouvernance de la donnée. Aujourd'hui, le produit ressemble davantage à une démo avancée qu'à un système de marché robuste.

Côté produit/économie, la proposition de valeur est bonne: capter des prix terrain, comparer au web, prioriser des signaux locaux. Côté psychologie et UX, l'app fait beaucoup de choses pour rassurer et motiver l'utilisateur, mais elle promet plus de précision qu'elle n'en garantit réellement. Si les chiffres sont manipulables ou approximatifs, l'interface "premium" amplifie même le risque de déception.

## Ce Que Je Ferais Ensuite

1. Déplacer le calcul de `points`, `level`, `trust_score` et la résolution des alertes côté serveur uniquement.
2. Fermer les policies `public` sur `price_alerts` et `price_alert_actions`.
3. Revoir la stratégie anti-doublon pour qu'elle corresponde vraiment à une fenêtre temporelle.
4. Segmenter les notifications par zone, rôle et pertinence.
5. Séparer clairement les métriques "signal UX" des métriques économiques réelles, et ne plus calculer d'agrégats globaux sur 20 lignes hétérogènes.

## Note

Je n'ai pas exécuté l'app ni les fonctions en runtime; ce scan est basé sur la lecture du code et des migrations.
