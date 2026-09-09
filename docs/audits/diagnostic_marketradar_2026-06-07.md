# Diagnostic MarketRadar

Date: 2026-06-07

Analyse basee sur la lecture du code et des migrations, sans execution de l'app ni des fonctions server.

## Resume Executif

MarketRadar est deja plus qu'une simple demo: l'architecture est decoupee, la couche donnee est riche, et plusieurs pieces critiques sont deja poussees cote serveur. En revanche, la base reste fragile sur trois axes: type safety, testabilite, et taille des ecrans/metiers cotes client.

## Plan D'Action

### Phase 1: securiser la base technique

1. Ajouter un vrai point d'entree de verification avec `typecheck`.
2. Replacer progressivement les `any` les plus visibles par des types metier stables.
3. Retirer les synchronisations dangereuses de champs sensibles comme `role` depuis les metadata auth.

### Phase 2: reduire la charge des ecrans

1. Extraire les derivees metier recurrentes des grands ecrans vers des hooks ou helpers.
2. Decouper les composants les plus lourds de `profile`, `add-price` et `map`.
3. Uniformiser les structures de retour de `libs/queries.ts`.

### Phase 3: renforcer la non-regression

1. Ajouter des tests sur les fonctions pures: normalisation, analytique et comparaison.
2. Ajouter des tests de flux sur la soumission de prix et les alertes.
3. Utiliser ces tests comme barriere avant toute nouvelle regle metier.

## Forces

### 1. Architecture bien structuree

Le projet est organise en couches assez lisibles: navigation Expo Router, composants reutilisables, logique metier dans `libs/`, et automatisations serverless dans `supabase/functions/`.

- Point d'entree propre avec providers globaux dans [app/_layout.tsx](<C:/Users/tifla/Music/mes projets/marketradar/app/_layout.tsx#L1>).
- Separation claire entre UI, logique et access Supabase dans [libs/queries.ts](<C:/Users/tifla/Music/mes projets/marketradar/libs/queries.ts#L187>) et [libs/auth.tsx](<C:/Users/tifla/Music/mes projets/marketradar/libs/auth.tsx#L14>).
- Presence de fonctions serveur dediees pour le rafraichissement et les sources externes dans [supabase/functions/daily-refresh/index.ts](<C:/Users/tifla/Music/mes projets/marketradar/supabase/functions/daily-refresh/index.ts#L1>) et [supabase/functions/fetch-external-prices/index.ts](<C:/Users/tifla/Music/mes projets/marketradar/supabase/functions/fetch-external-prices/index.ts#L1>).

### 2. La logique de prix est deja serieuse

Vous avez deja une vraie base de normalisation et d'analyse statistique, ce qui est un gros point fort pour un produit de suivi de marches.

- Normalisation des unites et des prix par unite de base dans [libs/normalization.ts](<C:/Users/tifla/Music/mes projets/marketradar/libs/normalization.ts#L35>).
- Analytique locale avec moyenne, mediane, ecart-type, anomalies et confiance dans [libs/analytics.ts](<C:/Users/tifla/Music/mes projets/marketradar/libs/analytics.ts#L116>).
- Comparaison local vs externe dans [libs/comparison.ts](<C:/Users/tifla/Music/mes projets/marketradar/libs/comparison.ts#L14>).
- Construction d'un snapshot metier exploitable dans [libs/scanner.ts](<C:/Users/tifla/Music/mes projets/marketradar/libs/scanner.ts#L73>).

### 3. L'experience produit est soignee

L'app ne se limite pas a des tableaux. Elle a deja des composants qui donnent une sensation de produit fini.

- Ticker anime et cartes dynamiques dans [components/PriceTicker.tsx](<C:/Users/tifla/Music/mes projets/marketradar/components/PriceTicker.tsx#L65>).
- Carte interactive WebView/Leaflet dans [components/RealMarketMap.native.tsx](<C:/Users/tifla/Music/mes projets/marketradar/components/RealMarketMap.native.tsx#L17>).
- Toasts centralises pour les retours utilisateur dans [components/ToastProvider.tsx](<C:/Users/tifla/Music/mes projets/marketradar/components/ToastProvider.tsx#L29>).
- UI composee avec des composants reutilisables comme [components/Card.tsx](<C:/Users/tifla/Music/mes projets/marketradar/components/Card.tsx#L10>).

### 4. Les risques critiques d'origine ont deja ete largement absorbes

Le code montre une vraie evolution vers plus de fiabilite serveur:

- Soumission de prix via RPC dans [libs/queries.ts](<C:/Users/tifla/Music/mes projets/marketradar/libs/queries.ts#L763>).
- Calcul de recompenses via RPC dans [libs/queries.ts](<C:/Users/tifla/Music/mes projets/marketradar/libs/queries.ts#L929>).
- Actions d'alertes via RPC dans [libs/queries.ts](<C:/Users/tifla/Music/mes projets/marketradar/libs/queries.ts#L532>).
- Les fonctions serveur reforment les signaux et les alertes au lieu de tout laisser au client dans [supabase/functions/daily-refresh/index.ts](<C:/Users/tifla/Music/mes projets/marketradar/supabase/functions/daily-refresh/index.ts#L627>).

## Faiblesses

### 1. Type safety trop souvent contournee

Le projet reste en TypeScript, mais beaucoup de flux importants passent encore par `any`, casts implicites, ou meme un `@ts-nocheck`.

- Gros volume de `any` dans [libs/queries.ts](<C:/Users/tifla/Music/mes projets/marketradar/libs/queries.ts#L137>), [app/(tabs)/profile.tsx](<C:/Users/tifla/Music/mes projets/marketradar/app/(tabs)/profile.tsx#L92>), [app/(tabs)/add-price.tsx](<C:/Users/tifla/Music/mes projets/marketradar/app/(tabs)/add-price.tsx#L60>), [app/(tabs)/map.tsx](<C:/Users/tifla/Music/mes projets/marketradar/app/(tabs)/map.tsx#L20>) et [components/RealMarketMap.native.tsx](<C:/Users/tifla/Music/mes projets/marketradar/components/RealMarketMap.native.tsx#L7>).
- Fonctions server marquees `@ts-nocheck` dans [supabase/functions/daily-refresh/index.ts](<C:/Users/tifla/Music/mes projets/marketradar/supabase/functions/daily-refresh/index.ts#L1>).

Impact: plus de risque de regressions silencieuses, plus de temps perdu a deboguer des formes de donnees incoherentes.

### 2. Absence de vrai filet de securite de tests

Je ne vois ni script de test, ni configuration de lint/test, ni fichiers `*.spec.*` ou `*.test.*` dans le projet.

- `package.json` ne contient pas de script `test`, `lint` ou `typecheck` dans [package.json](<C:/Users/tifla/Music/mes projets/marketradar/package.json#L1>).

Impact: les morceaux les plus critiques, comme l'envoi de prix, les alertes, la fiabilite et les snapshots, ne sont pas proteges par une suite minimale de non-regression.

### 3. Les ecrans principaux font trop de choses

Certaines vues cumulent beaucoup de responsabilites: affichage, transformation de donnees, gestion de formulaires, synchronisation de profil, auto-detection GPS, historique, alertes, recompenses, etc.

- La page profil concentre une grosse partie du metier dans [app/(tabs)/profile.tsx](<C:/Users/tifla/Music/mes projets/marketradar/app/(tabs)/profile.tsx#L177>).
- La page ajout de prix combine recherche, creation de produit, creation de marche, validation, geoloc et soumission dans [app/(tabs)/add-price.tsx](<C:/Users/tifla/Music/mes projets/marketradar/app/(tabs)/add-price.tsx#L48>).
- La page carte derive ses propres stats a partir des donnees brutes dans [app/(tabs)/map.tsx](<C:/Users/tifla/Music/mes projets/marketradar/app/(tabs)/map.tsx#L37>).

Impact: plus de charge cognitive, plus de duplication, et plus difficile de maintenir les comportements sans casser autre chose.

### 4. Le modele de role et de profil reste sensible

Le login pousse le role dans les metadata auth et dans `profiles`, puis le profil peut resynchroniser ces valeurs. Si le role sert a piloter des droits, des alertes ou des recompenses, il merite une politique plus stricte.

- Role choisi a l'inscription dans [app/(auth)/login.tsx](<C:/Users/tifla/Music/mes projets/marketradar/app/(auth)/login.tsx#L114>).
- Synchronisation metadata -> profil dans [app/(tabs)/profile.tsx](<C:/Users/tifla/Music/mes projets/marketradar/app/(tabs)/profile.tsx#L205>).
- Mise a jour du profil avec `supabase.auth.updateUser` puis `profiles.upsert` dans [libs/queries.ts](<C:/Users/tifla/Music/mes projets/marketradar/libs/queries.ts#L1121>).

Impact: si ce role est suppose etre une info metier sensible, il devrait etre davantage verrouille cote serveur.

### 5. Quelques choix techniques sont pratiques mais fragiles

- La carte WebView charge Leaflet depuis un CDN externe et utilise `originWhitelist={['*']}` dans [components/RealMarketMap.native.tsx](<C:/Users/tifla/Music/mes projets/marketradar/components/RealMarketMap.native.tsx#L41>).
- Les vues regroupent et recalculent beaucoup de choses cote client sur des lots de prix deja assez larges dans [libs/queries.ts](<C:/Users/tifla/Music/mes projets/marketradar/libs/queries.ts#L187>) et [app/(tabs)/index.tsx](<C:/Users/tifla/Music/mes projets/marketradar/app/(tabs)/index.tsx#L87>).

Impact: bon pour prototyper, mais plus sensible au reseau, au cache et a la croissance du volume de donnees.

## Verdict

MarketRadar a une base metier solide et une vraie ambition produit. Les fondations les plus importantes sont la: normalisation, analyse, notifications, carte, pipeline serveur. Le principal risque maintenant n'est plus fonctionnel, mais de soutenabilite: trop de logique vitale reste dispersee cote client, trop de `any`, et pas assez de garde-fous automatises.

## Priorites Recommandees

1. Retirer progressivement les `any` des zones critiques et supprimer le `@ts-nocheck` de la fonction daily refresh.
2. Ajouter un minimum de tests de non-regression sur `submit_price_entry`, `act_on_price_alert`, `compute_user_reward_summary` et `computePriceAnalytics`.
3. Decouper les gros ecrans en sous-composants et extraire les derivees metier dans des hooks ou selecteurs.
4. Verrouiller davantage les decisions sensibles cote serveur, surtout autour du role, des recompenses et des alertes.
5. Remplacer les dependances WebView/CDN les plus fragiles par une strategie plus controlee si la cible offline ou reseau faible devient prioritaire.
