# 📡 MarketRadar — Résumé Complet du Projet

> **Version** : 1.0.0 | **Dernière mise à jour** : Septembre 2026  
> **Stack principale** : React Native + Expo + Supabase + TypeScript

---

## 🎯 Vision du Projet

**MarketRadar** est une application mobile/web communautaire de surveillance des prix de marché. Elle permet aux utilisateurs de **relever, consulter et comparer les prix** de produits dans les marchés locaux (céréales, fruits, légumes, viandes, épicerie, etc.), avec une intelligence de données intégrée pour détecter les anomalies, tendances et écarts par rapport aux prix de référence externes.

L'application vise les marchés africains / locaux et inclut un système de **gamification**, une **boutique en ligne** pour les vendeurs et une **messagerie** entre acheteurs et vendeurs.

---

## 🏗️ Architecture Technique

```
marketradar/
├── app/                    # Pages (Expo Router file-based routing)
│   ├── (auth)/             # Écrans d'authentification
│   ├── (tabs)/             # Navigation principale (4 onglets)
│   ├── chat.tsx            # Messagerie privée
│   ├── market-prices.tsx   # Détail des prix d'un marché
│   └── messages.tsx        # Liste des conversations
├── components/             # Composants UI réutilisables
│   └── profile/            # Modales du profil vendeur
├── constants/              # Thème, mock data, config
├── hooks/                  # Custom React hooks
├── libs/                   # Logique métier et data layer
│   └── queries/            # Hooks React Query par domaine
├── supabase/
│   ├── functions/          # Edge Functions (Deno)
│   └── migrations/         # 49 migrations SQL
├── tests/                  # Tests unitaires (Vitest)
└── types/                  # Types TypeScript globaux
```

---

## 📦 Librairies & Dépendances

### 🔵 Framework & Navigation
| Librairie | Version | Rôle |
|-----------|---------|------|
| `expo` | ~55.0.24 | Framework React Native cross-platform |
| `expo-router` | ~55.0.14 | Navigation file-based (Stack + Tabs) |
| `react-native` | 0.83.6 | Runtime mobile natif |
| `react` | 19.2.0 | UI library |

### 🎨 UI & Animations
| Librairie | Version | Rôle |
|-----------|---------|------|
| `react-native-reanimated` | 4.2.1 | Animations fluides (FadeIn, SlideIn, etc.) |
| `react-native-gesture-handler` | ~2.30.0 | Gestes tactiles (swipe, pinch...) |
| `react-native-safe-area-context` | ~5.6.2 | Gestion des zones sécurisées (notch, etc.) |
| `react-native-screens` | ~4.23.0 | Optimisation des écrans natifs |
| `react-native-svg` | 15.15.3 | Graphiques SVG (sparklines, icônes) |
| `react-native-maps` | ^1.27.2 | Carte interactive (natif) |
| `react-native-webview` | 13.16.0 | Carte web (fallback web) |
| `lucide-react-native` | ^0.473.0 | **Bibliothèque d'icônes principale** |

### 🗄️ Data & Backend
| Librairie | Version | Rôle |
|-----------|---------|------|
| `@supabase/supabase-js` | ^2.39.7 | Client Supabase (BDD + Auth + Realtime) |
| `@tanstack/react-query` | ^5.25.0 | Cache serveur, gestion des requêtes async |
| `react-native-url-polyfill` | ^2.0.0 | Compatibilité URL pour Supabase sur mobile |

### 📍 Natif & Système
| Librairie | Version | Rôle |
|-----------|---------|------|
| `expo-location` | ~55.1.10 | Géolocalisation GPS |
| `expo-notifications` | ~55.0.23 | Push notifications |
| `expo-secure-store` | ~55.0.14 | Stockage sécurisé (tokens) |
| `expo-constants` | ~55.0.16 | Accès aux constantes de l'app |
| `expo-device` | ~55.0.17 | Infos sur le device |
| `expo-font` | ~55.0.4 | Chargement de polices |
| `expo-linking` | ~55.0.15 | Deep linking |
| `react-native-worklets` | latest | Workers JS (Reanimated worklets) |

### 🛠️ Dev & Tests
| Librairie | Version | Rôle |
|-----------|---------|------|
| `vitest` | ^4.1.8 | Tests unitaires |
| `typescript` | ^5.3.3 | Typage statique |
| `vite-tsconfig-paths` | ^6.1.1 | Résolution des alias @/ |

---

## 🖼️ Système de Design

Le design suit les **conventions iOS dark mode** avec un thème OLED noir premium.

### Palette de couleurs (`constants/Theme.ts`)
| Token | Valeur | Usage |
|-------|--------|-------|
| `primary` | `#0A84FF` | iOS Blue — CTA, liens actifs |
| `secondary` | `#5E5CE6` | iOS Indigo — éléments secondaires |
| `emerald` | `#30D158` | iOS Green — prix fiables, succès |
| `gold` | `#FFD60A` | iOS Yellow — récompenses, en attente |
| `error` | `#FF453A` | iOS Red — alertes, conflits |
| `background` | `#000000` | Fond OLED pur |
| `card` | `#1C1C1E` | Fond des cartes |
| `glass` | `rgba(28,28,30,0.8)` | Glassmorphism (tab bar) |

### Composants UI Custom
| Composant | Description |
|-----------|-------------|
| `Button` | Bouton stylisé avec états |
| `Card` | Conteneur avec ombre et border-radius |
| `Typography` | Texte avec variantes (h1, h2, body, caption...) |
| `Skeleton` | Placeholder de chargement animé |
| `PriceTicker` | Affichage prix avec badge de tendance |
| `WatchlistItem` | Item de liste de surveillance de prix |
| `Sparkline` | Mini graphique de tendance SVG |
| `RadarScanButton` | Bouton animé d'actualisation |
| `ToastProvider` | Système de notifications in-app |
| `MarketAtlas` | Composant de carte de marchés |
| `RealMarketMap` | Carte native (.native.tsx) + web (.web.tsx) |

---

## 📱 Écrans & Fonctionnalités

### Navigation principale (4 onglets flottants)

#### 1. 🔍 Explorer (`app/(tabs)/index.tsx`)
- Dashboard de prix avec indicateurs en temps réel
- Barre de recherche avec filtre par catégorie (céréales, fruits, légumes, viandes...)
- Filtre par ville/marché avec sélection géographique
- Intelligence de prix : badges de fiabilité (Fiable / Confirmé / À vérifier / Brut)
- Score de confiance affiché en pourcentage par relevé
- Tendances 7j / 30j avec indicateurs TrendingUp / TrendingDown
- Sparklines pour visualiser l'évolution des prix
- PriceTicker — ticker de prix défilant en haut de l'écran
- Watchlist personnelle de produits suivis
- Sources externes avec indicateur de santé
- Rafraîchissement pull-to-refresh

#### 2. ➕ Ajouter un prix (`app/(tabs)/add-price.tsx`)
- Flux multi-étapes (produit → marché → prix → confirmation)
- Géolocalisation automatique pour pré-remplir la ville
- Sélection de produit avec recherche et création de nouveau produit
- Sélection du marché avec tri par distance GPS
- Saisie du prix avec validation stricte
- Normalisation automatique de l'unité et du prix par unité de base
- Intelligence contextuelle : affichage du dernier prix connu du marché
- Récompenses : points XP attribués à chaque relevé valide
- RPC sécurisé `submit_price_entry` côté serveur
- Anti-duplication des relevés (30 min de cooldown)
- Animations Reanimated (FadeIn, SlideInRight, SlideOutLeft)

#### 3. 🏪 Boutiques (`app/(tabs)/map.tsx`)
- Marketplace des vendeurs locaux avec leurs produits
- Recherche par produit, catégorie ou nom de vendeur
- Filtres : Tous / En ligne / Vérifiés
- Badge de vérification pour les vendeurs certifiés
- Fiche vendeur expandable avec liste de produits et prix
- Lien direct vers la messagerie pour contacter un vendeur
- Score de confiance des vendeurs affiché

#### 4. 👤 Ma Boutique / Profil (`app/(tabs)/profile.tsx`)
- Profil utilisateur avec avatar, nom, rôle (acheteur / vendeur)
- Score de confiance (trust score) du profil
- Badge de vérification du marché
- Tableau de bord vendeur avec statistiques de ventes
- Historique de relevés de prix avec détails
- Gestion de la boutique en ligne (ajout/suppression d'articles)
- Système de gamification (XP, badges, classement, roadmap)
- Alertes de prix : créer, activer, désactiver, supprimer
- Messagerie : accès à l'inbox et conversations actives
- Paramètres : langue, notifications, déconnexion
- Modales : EditProfile, Settings, HistoryDetail, PriceCorrection

### Écrans secondaires (Stack)

#### 💬 Chat (`app/chat.tsx`)
- Messagerie temps réel entre acheteur et vendeur
- Contexte produit affiché dans la conversation
- Envoi/réception de messages avec horodatage
- Auto-scroll vers le dernier message
- KeyboardAvoidingView + SafeAreaView

#### 📨 Messages (`app/messages.tsx`)
- Liste des conversations (inbox)
- Prévisualisation du dernier message
- Badge de non-lu par conversation

#### 💰 Prix du Marché (`app/market-prices.tsx`)
- Vue détaillée de tous les prix d'un marché donné
- Filtres par statut de fiabilité
- Tri par date ou par produit
- Consultation trackée

#### 🔑 Authentification (`app/(auth)/login.tsx`)
- Connexion par email + mot de passe
- Inscription avec création de profil
- Mode invité (guest session anonyme)
- Persistance de session via expo-secure-store

---

## ⚙️ Couche Data (libs/)

### Modules utilitaires
| Module | Rôle |
|--------|------|
| `libs/analytics.ts` | Calcul de statistiques (moyenne, médiane, écart-type, tendance 7j/30j, détection d'anomalies, score de confiance) |
| `libs/scanner.ts` | Agrégation de snapshots marché-produit avec comparaison prix externes |
| `libs/normalization.ts` | Normalisation des noms de produits, catégories, unités, prix par unité de base |
| `libs/validation.ts` | Validation des prix soumis (fourchettes, cohérence) |
| `libs/comparison.ts` | Comparaison prix locaux vs sources externes |
| `libs/alerts.ts` | Logique des alertes de prix (création, triggers) |
| `libs/format.ts` | Formatage (prix, dates relatives formatTimeAgo) |
| `libs/notifications.ts` | Enregistrement token push, envoi de notifications |
| `libs/auth.tsx` | Contexte d'authentification + hook useAuth |
| `libs/supabase.ts` | Client Supabase initialisé |

### Hooks React Query (`libs/queries/`)
| Hook | Domaine |
|------|---------|
| `useProducts`, `useAddProduct`, `useSearchableProducts` | Produits |
| `usePrices`, `useLatestPrice`, `useAddPrice` | Prix |
| `useMarkets`, `useMarketsWithCoords`, `useCities` | Géographie |
| `useIntelligenceSnapshots`, `useProductMarketIntelligence`, `useRefreshAllSnapshots` | Analytics |
| `useExternalSourceHealth` | Sources externes |
| `useDashboardSummary` | Dashboard |
| `useProfile`, `useUpdateProfile`, `useUserStats` | Profil |
| `useUserBadges`, `useUserRewardSummary`, `useZoneLeaderboard` | Gamification |
| `useUserPriceHistory`, `useUserRecentMarkets` | Historique |
| `useTargetedPriceAlerts`, `useActOnPriceAlert`, `useUserAlertActions` | Alertes |
| `useChatInbox`, `useChatThread` | Chat |
| `useUserBoutiqueItems`, `useAddBoutiqueItem` | Boutique |
| `useRecordProductConsultation` | Consultations |

### Custom Hooks (`hooks/`)
| Hook | Rôle |
|------|------|
| `useAsyncAction` | Wrapper async avec gestion d'état loading/error |
| `useDebounce` | Debounce sur une valeur (recherche) |
| `useZoneDetection` | Détection de la zone géographique de l'utilisateur |

---

## 🗃️ Base de Données (Supabase)

### Tables principales
| Table | Description |
|-------|-------------|
| `profiles` | Profils utilisateurs (nom, rôle, ville, trust score, niveau) |
| `products` | Catalogue de produits (nom, catégorie, unité) |
| `markets` | Marchés (nom, ville, coordonnées GPS, type) |
| `prices` | Relevés de prix (produit, marché, valeur, quantité, horodatage) |
| `market_price_snapshots` | Snapshots agrégés (moyenne, médiane, tendances, score de confiance) |
| `price_alerts` | Alertes de prix créées par les utilisateurs |
| `conversations` | Conversations entre acheteurs et vendeurs |
| `messages` | Messages individuels dans une conversation |
| `boutique_items` | Articles mis en vente par les vendeurs |
| `user_badges` | Badges de gamification attribués |
| `external_price_sources` | Sources de prix externes |
| `external_prices` | Prix collectés depuis les sources externes |
| `cities` | Référentiel de villes avec coordonnées |
| `price_consultations` | Tracking des consultations produit |

### Edge Functions (Deno)
| Fonction | Rôle |
|----------|------|
| `fetch-external-prices` | Collecte des prix depuis sources externes |
| `daily-refresh` | Recalcul quotidien des snapshots d'intelligence |

### RPCs principales
| RPC | Description |
|-----|-------------|
| `submit_price_entry` | Soumission sécurisée d'un relevé avec anti-duplication et récompenses |
| `get_dashboard_summary` | Résumé agrégé pour le dashboard |
| `get_searchable_products` | Produits indexés pour la marketplace |
| `act_on_price_alert` | Actions sur les alertes |
| `sync_profile_role_from_auth_metadata` | Synchronisation du rôle depuis les métadonnées auth |

---

## 🎮 Système de Gamification

- **Points XP** attribués à chaque relevé de prix validé
- **Niveaux progressifs** (Contributeur → Expert → Référent)
- **Badges débloquables** selon les actions (premier relevé, 10 relevés, etc.)
- **Classement par zone** : top contributeurs dans la région géographique
- **Feuille de route vendeur** : critères mesurables pour débloquer le statut "Vendeur vérifié"
- **Score de confiance** du profil : indicateur de fiabilité communautaire

---

## 🔔 Système de Notifications

- **Push notifications** via `expo-notifications` (enregistrement token au login)
- **Alertes de prix in-app** : notification quand un prix dépasse/descend sous un seuil défini
- **Toast in-app** : `ToastProvider` pour les confirmations et erreurs
- **Notifications temps réel** via Supabase Realtime (chat)

---

## 🌍 Fonctionnalités Géographiques

- **Géolocalisation GPS** via `expo-location` pour auto-détecter la ville de l'utilisateur
- **Carte des boutiques** native (iOS/Android) avec `react-native-maps`
- **Carte web** via WebView (fallback navigateur)
- **Détection de zone** automatique pour le leaderboard
- **Calcul de distance** Haversine (entre utilisateur et marchés)
- **Persistance de la localisation** dans le profil (rechargement périodique 30j)

---

## 🧪 Tests

- **Framework** : Vitest 4.x
- **Couverture** : modules utilitaires (analytics, normalization, validation, scanner, comparison)
- **Commandes** : `npm test` / `npm run test:watch`

---

## 🚀 Scripts & Déploiement

| Commande | Description |
|----------|-------------|
| `npm start` | Lance le serveur de dev Expo |
| `npm run android` | Lance sur Android |
| `npm run ios` | Lance sur iOS |
| `npm run web` | Lance la version web |
| `npm run typecheck` | Vérification TypeScript |
| `npm run build:dev:android` | Build Android dev via EAS |
| `npm run build:preview:android` | Build Android preview via EAS |
| `npm run build:production:android` | Build Android production via EAS |

---

## 📁 Fichiers de Configuration

| Fichier | Rôle |
|---------|------|
| `app.config.ts` | Config Expo (nom, icône, splash, permissions) |
| `eas.json` | Config EAS Build (profils dev/preview/production) |
| `tsconfig.json` | Config TypeScript avec alias @/ |
| `babel.config.js` | Config Babel (Expo + Reanimated) |
| `vitest.config.ts` | Config des tests unitaires |
| `supabase/config.toml` | Config du projet Supabase local |
| `.env` | Variables d'environnement (URL Supabase, clé anon) |

---

*Document généré automatiquement le 08 septembre 2026.*
