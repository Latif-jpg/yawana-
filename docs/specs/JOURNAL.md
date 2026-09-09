# 📖 Journal de l'Application MarketRadar

> **Version documentée :** 1.0.0  
> **Dernière mise à jour :** 18 juin 2026  
> **Plateforme :** iOS · Android · Web  
> **Périmètre géographique :** Burkina Faso

---

## 🧭 Introduction

MarketRadar est une application mobile et web de suivi des prix sur les marchés du Burkina Faso. Son ambition est simple mais structurante : rendre visible, en temps réel, ce que coûtent les denrées sur les marchés locaux — du maïs au marché de Bobo, à l'ananas à Banfora.

Le projet est né d'un constat : les prix varient fortement d'un marché à l'autre, parfois de 100 à 500 % pour un même produit, et cette information est aujourd'hui invisible, dispersée et non exploitable pour les citoyens, les commerçants et les décideurs.

MarketRadar est conçu pour trois types d'acteurs :

- **Le client** : il veut savoir où trouver le meilleur prix avant d'aller au marché.
- **Le contributeur** : il collecte des prix terrain, valide les alertes et gagne en réputation.
- **Le vendeur (commerçant)** : il expose ses produits en boutique numérique et peut être contacté directement.

---

## 🏗️ Architecture Générale

### Stack Technique

| Couche | Technologie |
|--------|-------------|
| Mobile / Web | React Native 0.83.6 · Expo ~55 · Expo Router |
| Langage | TypeScript 5.3 |
| État serveur | TanStack React Query v5 |
| Base de données | Supabase (PostgreSQL 15) |
| Auth | Supabase Auth (JWT) |
| API | PostgREST (auto-généré depuis le schéma SQL) |
| Fonctions serveur | Supabase Edge Functions (Deno) |
| Cartographie | React Native Maps · Google Maps API |
| Animations | React Native Reanimated 4 |
| Icônes | Lucide React Native |
| Tests | Vitest |
| Build / Distribution | EAS Build (Expo Application Services) |

### Organisation du Code

```
marketradar/
├── app/                      # Écrans (Expo Router)
│   ├── (auth)/               # Flux authentification
│   ├── (tabs)/               # Navigation principale par onglets
│   │   ├── index.tsx             # Tableau de bord (prix + alertes)
│   │   ├── add-price.tsx         # Ajout de prix terrain (GPS)
│   │   ├── map.tsx               # Carte / Atlas des marchés
│   │   └── profile.tsx           # Profil, boutique, gamification
│   ├── chat.tsx              # Messagerie vendeur/client
│   └── market-prices.tsx     # Détail produit/marché
├── components/               # Composants réutilisables
│   ├── MarketAtlas.tsx           # Atlas des prix
│   ├── PriceTicker.tsx           # Ticker de prix défilant
│   ├── Sparkline.tsx             # Mini-graphique de tendance
│   ├── RealMarketMap.tsx         # Carte (web/native)
│   ├── WatchlistItem.tsx         # Item de liste de suivi
│   └── ToastProvider.tsx         # Notifications in-app
├── libs/                     # Logique métier pure
│   ├── queries.ts                # ~40 hooks React Query (~2000 lignes)
│   ├── analytics.ts              # Calculs analytiques prix
│   ├── normalization.ts          # Normalisation unités et noms
│   ├── alerts.ts                 # Logique d'alertes
│   ├── scanner.ts                # Snapshots marché
│   ├── comparison.ts             # Comparaison prix local/web
│   ├── format.ts                 # Formatage devise et dates
│   ├── validation.ts             # Validation saisies
│   ├── notifications.ts          # Notifications push
│   └── supabase.ts               # Client Supabase configuré
└── supabase/
    ├── migrations/           # 49 migrations SQL chronologiques
    └── functions/
        └── daily-refresh/    # Edge Function de rafraîchissement quotidien
```

---

## 📅 Chronologie du Projet

### Phase 1 — Fondations (Mars 2026)

**20 mars 2026**

Création du schéma de base de données initial. Les tables fondamentales sont posées :

- `cities` — villes du Burkina Faso
- `markets` — marchés physiques, de rue et en galerie marchande
- `products` — catalogue de produits (céréales, légumes, fruits, viande…)
- `prices` — relevés de prix terrain
- `external_price_sources` — sources de prix web/IA pour comparaison
- `market_price_snapshots` — agrégats calculés par produit/marché
- `shops` — boutiques des commerçants

Les politiques RLS (Row Level Security) sont activées dès le départ.

**21 mars 2026**

Ajout du schéma de géolocalisation, des profils utilisateurs et du système de gamification. Naissance des notions de `trust_score`, `level` et `points`.

**22 mars 2026**

Intégration de la couche intelligence : snapshots calculés automatiquement, comparaison avec des prix web, détection d'anomalies. La fonction Edge `daily-refresh` est mise en place pour orchestrer les mises à jour chaque nuit.

---

### Phase 2 — Sécurisation (Mai 2026)

**11 mai 2026 — Premier audit critique**

Un audit complet du code est réalisé. Cinq risques majeurs sont identifiés :

1. **Gamification falsifiable côté client** : les champs `points`, `level`, `trust_score` pouvaient être modifiés directement par l'app.
2. **Alertes modifiables publiquement** : n'importe qui, même anonyme, pouvait écrire dans `price_alerts`.
3. **Anti-doublon incohérent** : une unicité permanente sur `submission_hash` bloquait des relevés légitimes.
4. **Notifications push non ciblées** : toutes les alertes étaient envoyées à tous les utilisateurs.
5. **Analyses économiquement fragiles** : une pseudo-moyenne mélangeait des produits hétérogènes.

**11–15 mai 2026 — Sprint de correction**

Toutes les failles sont corrigées :

- Les policies publiques d'écriture sur les alertes sont supprimées.
- Un trigger bloque les modifications client des champs de récompense.
- La RPC `act_on_price_alert` (SECURITY DEFINER) remplace l'insertion directe.
- Le calcul de score est entièrement centralisé côté serveur via `compute_user_reward_summary`.
- L'ajout de prix passe par la RPC `submit_price_entry` (force `recorded_by = auth.uid()`).
- La fenêtre anti-doublon passe d'une unicité permanente à une règle temporelle de 10 minutes.
- Les notifications push sont filtrées par ville, rôle et token valide.

**15 mai 2026 — Second audit**

L'audit de mise à jour confirme que les 5 risques critiques sont fermés.

---

### Phase 3 — Expansion Métier (Juin 2026)

**10 juin 2026**

- Table `boutique_items` pour les produits vendeur.
- Niveaux d'accès marché (`reliable`, `verified`).
- Enregistrement des consultations produits.

**11 juin 2026**

- La RPC `searchable_products()` combine catalogue officiel et boutiques vendeurs éligibles.
- Critères d'éligibilité : badge vérifié, ou (ville + score ≥ 60 + ≥ 10 prix + ≥ 3 confirmations ou ≥ 2 corrections).

**12 juin 2026**

- Tables `chat_conversations` et `chat_messages`. La messagerie est attachée à un produit et un vendeur. RLS stricte sur les participants.

**13 juin 2026**

- Ajout de `owner_id` sur `shops`, liant une boutique à son propriétaire.

**15 juin 2026**

- Correction d'un bug critique dans `searchable_products()` qui appelait `compute_user_reward_summary` sur des tiers.
- Durcissement RLS `boutique_items` : les tiers ne voient que les produits de vendeurs éligibles.
- Ajout des colonnes de comptage `price_count`, `confirmed_action_count`, `corrected_action_count` sur `profiles` avec triggers de mise à jour automatique.

**17 juin 2026**

- Création de la RPC `get_dashboard_summary()` : une seule requête SQL qui calcule prix récents, variations, tendances et infos vendeur pour alimenter le tableau de bord.

---

### Phase 4 — Débogage Production (17–18 juin 2026)

**Incident 1 : Erreur 404 sur get_dashboard_summary**  
→ La migration n'avait pas été exécutée en base. Exécution manuelle.

**Incident 2 : Erreur 400 (42703) — alias manquant**  
→ `shop_trust_score` non aliasé dans le SELECT final. Corrigé.

**Incident 3 : Erreur 400 (42703) — s.owner_id does not exist**  
→ La migration `shop_owner_link.sql` (colonne `owner_id` sur `shops`) n'avait pas été appliquée en production. Exécution manuelle.

**Incident 4 : Fichier migration corrompu**  
→ Le fichier SQL a été accidentellement remplacé par 4011 lignes de logs navigateur. Restauration manuelle.

**Résolution finale — 18 juin 2026**

```sql
SELECT * FROM public.get_dashboard_summary() LIMIT 3;
-- ✅ Retourne des données correctes :
-- Ananas | Marché de Banfora Est   | +567% | trend: [150, 1000]
-- Mil    | Grand Marché de Bobo    | +138% | trend: [210, 500]
-- Maïs   | Rood Woko (Grand Marché)| +116% | trend: [185, 400]
```

---

## 🎯 Fonctionnalités Métier

### Tableau de Bord

Les prix les plus significatifs du moment, triés par amplitude de variation. Chaque entrée montre le produit, le marché, le dernier prix, la variation en %, et une sparkline de tendance sur 10 points. Rafraîchissement toutes les 30 secondes via la RPC `get_dashboard_summary()`.

### Ajout de Prix Terrain

- GPS obligatoire — aucun prix sans géolocalisation
- Détection automatique de la ville et du marché
- Anti-doublon : fenêtre de 10 minutes
- Soumission via RPC `submit_price_entry` (SECURITY DEFINER)
- Mise à jour automatique du score et des badges

### Carte / Atlas

Vue cartographique des marchés avec filtres par produit et fourchette de prix. Fiche marché : prix récents, produits les plus consultés, comparaison prix local/web. CTA vendeur si disponible.

### Profil & Boutique

Profil, score, badges, historique. Espace boutique vendeur : ajout/modification de produits, statut vitrine privée/publique selon éligibilité.

### Recherche Produit

Moteur combiné : catalogue officiel + boutiques vendeurs éligibles. CTA conditionnel (`Disponible chez X`). Fallback côté client si la RPC est indisponible.

### Messagerie

Chat vendeur/client attaché à un produit. RLS stricte sur les participants. Rafraîchissement toutes les 8 secondes (Realtime à venir).

### Alertes Marché

Alertes automatiques (hausse, conflit, périmé, opportunité) générées par `daily-refresh`. Actions utilisateur (confirmer/corriger/rejeter) comptent dans le score. Filtrage push par ville et rôle.

---

## 🔐 Modèle de Sécurité

### Row Level Security

| Table | SELECT | Écriture |
|-------|--------|----------|
| `prices` | public | RPC `submit_price_entry` uniquement |
| `boutique_items` | owner + vendeurs éligibles | owner uniquement |
| `profiles` | public | self uniquement (champs restreints) |
| `price_alerts` | authenticated | SECURITY DEFINER |
| `price_alert_actions` | self uniquement | SECURITY DEFINER |
| `chat_messages` | participants uniquement | participants uniquement |

### Champs Protégés par Trigger

`points`, `level`, `trust_score`, `price_count`, `confirmed_action_count`, `corrected_action_count` dans `profiles` ne peuvent pas être modifiés directement par le client. Un trigger PostgreSQL bloque toute tentative externe.

### RPC SECURITY DEFINER

| RPC | Rôle |
|-----|------|
| `submit_price_entry` | Soumettre un prix terrain |
| `act_on_price_alert` | Agir sur une alerte |
| `compute_user_reward_summary` | Calculer le score |
| `sync_user_reward_summary` | Synchroniser le score |
| `get_dashboard_summary` | Données tableau de bord |
| `searchable_products` | Recherche unifiée |
| `sync_profile_contribution_counts` | Compteurs profil (trigger) |

---

## 📊 Migrations SQL — Jalons Majeurs

| Date | Migration | Importance |
|------|-----------|------------|
| 20-03-20 | `supabase_schema.sql` | Schéma initial |
| 21-03-21 | `gamification_schema.sql` | Points, niveaux, badges |
| 22-03-22 | `step1_intelligence.sql` | Intelligence marché |
| 11-05-11 | `security_hardening.sql` | ⚠️ Fermeture 5 failles critiques |
| 13-05-13 | `price_alert_actions_rpc.sql` | RPC alertes sécurisée |
| 15-05-15 | `server_reward_sync.sql` | ⭐ Score centralisé serveur |
| 15-05-15 | `submit_price_entry_rpc.sql` | ⭐ RPC soumission prix |
| 10-06-10 | `boutique_items.sql` | ⭐ Boutique vendeur |
| 11-06-11 | `searchable_products_rpc.sql` | ⭐ Recherche unifiée |
| 12-06-12 | `chat_messaging.sql` | ⭐ Messagerie |
| 15-06-15 | `boutique_items_eligible_read_policy.sql` | RLS durcie + compteurs |
| 17-06-17 | `dashboard_summary_rpc.sql` | ⭐ RPC tableau de bord |

---

## 🩺 État de Santé (18 juin 2026)

### ✅ Stables

- Authentification et profil
- Ajout de prix terrain (GPS + RPC)
- Score et badges (calcul serveur)
- Alertes et validations
- Tableau de bord (RPC fonctionnelle)
- Boutique vendeur
- Carte / Atlas
- Recherche produit

### ⚠️ Partiellement Stables

- GPS web (précision variable)
- Messagerie (polling 8 s, pas encore Realtime)
- Tests (8 tests, pas de parcours complets)

### 🔴 Non Finalisé

- Notifications push Android (FCM à configurer)
- Realtime chat (Supabase Realtime non branché)
- Tests d'intégration RPC

---

## 🚀 Prochaines Étapes

### Avant Beta Publique

1. Activer Supabase Realtime sur `chat_messages`
2. Configurer Firebase Cloud Messaging (FCM) pour Android
3. Ajouter un écran de confirmation de zone GPS
4. Tests d'intégration sur les RPC critiques

### Pour la Production

5. Monitoring des notifications push (logs par segment)
6. Tests de parcours complets (client, vendeur, contributeur)
7. Optimisation carte (clustering, lazy loading par zone)
8. Mode offline (cache des derniers prix consultés)

### Long Terme

9. Analytics économiques par filière
10. API publique pour partenaires institutionnels
11. Extension géographique (autres villes du Sahel)
12. IA prédictive (anticipation hausses saisonnières)

---

## 📐 Conventions Techniques

### Cache React Query

| Hook | staleTime | refetchInterval |
|------|-----------|-----------------|
| `useDashboardSummary` | 10 s | 30 s |
| `usePrices` | 10 s | 30 s |
| `usePriceAlerts` | — | 30 s |
| `useChatMessages` | — | 8 s |

### Nommage SQL

- Tables : `snake_case` pluriel
- RPC : verbe_objet (`submit_price_entry`, `get_dashboard_summary`)
- Triggers : `trg_` + action + `_from_` + table source
- Index : `table_colonne_idx`

---

## 🗒️ Glossaire

| Terme | Définition |
|-------|-----------|
| **RLS** | Row Level Security — règles de sécurité ligne par ligne en PostgreSQL |
| **RPC** | Fonction PostgreSQL appelable via l'API Supabase REST |
| **SECURITY DEFINER** | La fonction s'exécute avec les droits de son créateur |
| **Snapshot** | Agrégat calculé (moyenne, médiane, min/max) pour un produit/marché |
| **Trust score** | Score de fiabilité utilisateur (0–100), calculé côté serveur uniquement |
| **Éligibilité vendeur** | Critère : badge vérifié ou (ville + score ≥ 60 + 10 prix + validations) |
| **Sparkline** | Mini-graphique de tendance (tableau de valeurs historiques) |
| **EAS** | Expo Application Services — build et distribution mobile |
| **FCM** | Firebase Cloud Messaging — notifications push Android |
| **XOF** | Franc CFA ouest-africain — devise par défaut |

---

*Ce journal est un document vivant. Il doit être mis à jour à chaque jalon : nouvelle migration, correction de bug critique, ajout de fonctionnalité, changement d'architecture.*
