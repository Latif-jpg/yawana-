# Audit MarketRadar - Mise a jour

Date: 2026-05-15

Reference comparee: `audit_marketradar_2026-05-11.md`

## Resume Executif

Depuis l'audit du 11 mai 2026, l'etat du projet s'est nettement ameliore. Les 5 constats prioritaires sont maintenant corriges ou traites de maniere defendable dans l'etat actuel du code et de la base distante. Les derniers correctifs importants ont finalise la centralisation serveur de la gamification, retabli la visibilite REST des RPC de recompense, et remplace l'insertion directe de prix par une RPC serveur dediee.

## Tableau de Suivi

| Point d'audit | Etat actuel | Statut | Action restante |
| --- | --- | --- | --- |
| 1. `points`, `level`, `trust_score` falsifiables cote client | Les scores sont maintenant calcules via RPC serveur, synchronises dans `profiles`, et proteges par trigger contre toute modification client directe. L'app lit desormais `compute_user_reward_summary` cote serveur. | Corrige | Ajouter des tests d'integration pour verrouiller le cycle complet prix/alertes -> scores -> badges. |
| 2. Alertes modifiables publiquement | Les ecritures publiques sur `price_alerts` et `price_alert_actions` ont ete retirees. Les actions utilisateur passent par une RPC `act_on_price_alert` reservee aux utilisateurs authentifies. | Corrige | Verifier en base que les anciennes policies publiques ne sont plus actives sur l'environnement de production. |
| 3. Anti-doublon incoherent | L'unicite permanente sur `submission_hash` a ete remplacee par une prevention temporelle de 10 minutes via trigger SQL, coherente avec la verification cote app. L'insertion des prix passe maintenant par une RPC serveur `submit_price_entry`, ce qui supprime le point de friction RLS du flux client. | Corrige | Ajouter un test d'integration couvrant deux cas: doublon < 10 min refuse, meme prix > 10 min accepte. |
| 4. Notifications push non ciblees | Les notifications hautes priorites sont maintenant filtrees par `city_id`, par role, et par presence d'un `expo_push_token` valide. | Corrige | Ajouter un journal ou compteur d'envoi par segment pour suivre le bruit et l'efficacite. |
| 5. Analyses economiquement fragiles | `usePrices()` charge davantage de donnees, et la carte n'affiche plus une moyenne brute de produits heterogenes. Elle travaille desormais par produit et s'appuie aussi sur les snapshots. | Corrige | Continuer a separer clairement les metriques UX des metriques economiques officielles. |

## Detail Par Point

### 1. Gamification et confiance

#### Ce qui a change

- Le client ne pousse plus `points`, `level` ou `trust_score` dans `profiles` lors des mises a jour de profil.
- La mutation de profil se limite maintenant aux champs metier classiques dans [libs/queries.ts](C:/Users/tifla/Music/mes projets/marketradar/libs/queries.ts:1103).
- Un trigger bloque les modifications des champs de recompense depuis les appels non serveur dans [20260511194139_security_hardening.sql](C:/Users/tifla/Music/mes projets/marketradar/supabase/migrations/20260511194139_security_hardening.sql:54).
- Le calcul officiel des scores est maintenant centralise dans `compute_user_reward_summary` et `sync_user_reward_summary` dans [20260515113000_server_reward_sync.sql](C:/Users/tifla/Music/mes projets/marketradar/supabase/migrations/20260515113000_server_reward_sync.sql:24).
- Les scores et badges sont resynchronises automatiquement apres les vrais evenements metier via des triggers sur `prices` et `price_alert_actions` dans [20260515113000_server_reward_sync.sql](C:/Users/tifla/Music/mes projets/marketradar/supabase/migrations/20260515113000_server_reward_sync.sql:229).
- L'app lit maintenant le resume de recompense via la RPC serveur `compute_user_reward_summary` dans [libs/queries.ts](C:/Users/tifla/Music/mes projets/marketradar/libs/queries.ts:926).

#### Conclusion

Le risque de triche directe et l'ecart entre client et serveur sont maintenant traites. Ce point peut etre considere comme corrige.

### 2. Securite des alertes

#### Ce qui a change

- Les anciennes policies publiques d'ecriture ont ete retirees dans [20260511194139_security_hardening.sql](C:/Users/tifla/Music/mes projets/marketradar/supabase/migrations/20260511194139_security_hardening.sql:4).
- La lecture et l'insertion des actions d'alerte sont maintenant limitees a l'utilisateur concerne dans [20260511194139_security_hardening.sql](C:/Users/tifla/Music/mes projets/marketradar/supabase/migrations/20260511194139_security_hardening.sql:9).
- Les actions de confirmation/correction passent par la RPC `act_on_price_alert` en `SECURITY DEFINER` dans [20260513133500_price_alert_actions_rpc.sql](C:/Users/tifla/Music/mes projets/marketradar/supabase/migrations/20260513133500_price_alert_actions_rpc.sql:1).
- Le client verifie aussi la session avant d'agir sur une alerte dans [libs/queries.ts](C:/Users/tifla/Music/mes projets/marketradar/libs/queries.ts:504) et [app/(tabs)/profile.tsx](C:/Users/tifla/Music/mes projets/marketradar/app/(tabs)/profile.tsx:455).

#### Conclusion

Le constat critique de l'audit sur la modification publique des alertes n'est plus representatif de l'etat actuel du code. Ce point peut etre considere comme corrige, sous reserve que les migrations recentes aient bien ete appliquees en production.

### 3. Prevention des doublons

#### Ce qui a change

- Le client continue de proteger contre les doublons recents dans [libs/queries.ts](C:/Users/tifla/Music/mes projets/marketradar/libs/queries.ts:744).
- Surtout, la base ne repose plus sur une unicite permanente: un trigger refuse seulement les doublons dans une fenetre de 10 minutes dans [20260511194139_security_hardening.sql](C:/Users/tifla/Music/mes projets/marketradar/supabase/migrations/20260511194139_security_hardening.sql:25).
- L'insertion de prix passe maintenant par une RPC `submit_price_entry` en `SECURITY DEFINER`, qui fixe `recorded_by = auth.uid()` cote serveur dans [20260515193000_submit_price_entry_rpc.sql](C:/Users/tifla/Music/mes projets/marketradar/supabase/migrations/20260515193000_submit_price_entry_rpc.sql:1).
- Le client utilise cette RPC au lieu d'un `insert()` direct sur `prices` dans [libs/queries.ts](C:/Users/tifla/Music/mes projets/marketradar/libs/queries.ts:762).

#### Conclusion

La contradiction relevee dans l'audit est resolue. La logique de prevention est maintenant alignee entre client et base, et le flux de soumission est plus robuste face aux contraintes RLS.

### 4. Notifications push

#### Ce qui a change

- Les profils cibles sont recuperes avec `expo_push_token`, `city_id` et `role` dans [daily-refresh/index.ts](C:/Users/tifla/Music/mes projets/marketradar/supabase/functions/daily-refresh/index.ts:731).
- Les envois sont filtres par ville dans [daily-refresh/index.ts](C:/Users/tifla/Music/mes projets/marketradar/supabase/functions/daily-refresh/index.ts:744).
- Les envois sont filtres par role selon le type d'alerte dans [daily-refresh/index.ts](C:/Users/tifla/Music/mes projets/marketradar/supabase/functions/daily-refresh/index.ts:461) et [daily-refresh/index.ts](C:/Users/tifla/Music/mes projets/marketradar/supabase/functions/daily-refresh/index.ts:745).
- Le filtre de token non nul est corrige dans [daily-refresh/index.ts](C:/Users/tifla/Music/mes projets/marketradar/supabase/functions/daily-refresh/index.ts:732).

#### Conclusion

Le risque de spam massif non cible a ete nettement reduit. Le sujet n'est plus un probleme structurel, mais un sujet normal d'optimisation produit.

### 5. Fiabilite analytique

#### Ce qui a change

- `usePrices()` charge maintenant jusqu'a 200 lignes au lieu de 20 dans [libs/queries.ts](C:/Users/tifla/Music/mes projets/marketradar/libs/queries.ts:167).
- La carte ne calcule plus une pseudo-moyenne economique sur des produits differents.
- Elle reconstruit des stats a partir des prix du marche selectionne, en gardant les derniers prix par produit dans [app/(tabs)/map.tsx](C:/Users/tifla/Music/mes projets/marketradar/app/(tabs)/map.tsx:38).
- Elle exploite aussi les snapshots d'intelligence pour les comparaisons locales/web dans [app/(tabs)/map.tsx](C:/Users/tifla/Music/mes projets/marketradar/app/(tabs)/map.tsx:72).

#### Conclusion

Le probleme de sens economique signale dans l'audit a ete bien adresse. La carte est maintenant beaucoup plus defendable en termes de lecture metier.

## Priorites Recommandees

1. Ajouter des tests d'integration autour des RPC `submit_price_entry`, `act_on_price_alert`, `compute_user_reward_summary` et des triggers associes.
2. Instrumenter les notifications push pour mesurer leur precision et leur bruit.
3. Uniformiser davantage les retours utilisateur succes/erreur sur toutes les operations de l'app.
4. Continuer a distinguer les metriques UX des indicateurs economiques officiels dans les vues avancees.

## Verdict

L'audit du 11 mai 2026 n'est plus representatif de l'etat global actuel du projet. Il reste utile comme photo des risques initiaux, mais les risques critiques qu'il soulevait ont maintenant ete fermes ou fortement absorbes par l'architecture actuelle. La suite du travail releve davantage de la consolidation, des tests et de l'observabilite que d'un correctif de faille structurelle.
