# Diagnostic metiers MarketRadar - 2026-06-17

## Synthese

L'application couvre maintenant les principaux metiers prevus :

- Client : consulter les prix, chercher des produits, voir les marches, contacter un vendeur eligible.
- Contributeur : ajouter un prix terrain avec GPS obligatoire, historique de prix, confirmations/corrections.
- Vendeur : profil vendeur, criteres d'acces marche, espace boutique, produits boutique, visibilite conditionnelle.
- Plateforme : score, badges, fiabilite, recherche produit, atlas des prix, messagerie, alertes et consultations.

Etat global : solide pour une version pilote, mais pas encore totalement "blindee production" sans quelques controles serveur et tests de parcours supplementaires.

## Verifications effectuees

- Compilation TypeScript : OK avec `tsc --noEmit`.
- Tests automatises : OK avec `npm test`, 1 fichier de test, 8 tests passes.
- Lecture des ecrans principaux : `index`, `add-price`, `map`, `profile`, `chat`, `market-prices`, `login`.
- Lecture des hooks metier : prix, produits, boutique, recherche, profil, badges, chat, alertes, consultations.
- Lecture des migrations recentes Supabase : boutique, recherche, chat, GPS profil, score vendeur, RLS.

## Matrice metier

| Domaine | Statut | Fiabilite | Commentaire |
| --- | --- | --- | --- |
| Authentification | Branche | Bonne | Creation compte client/vendeur, profil upsert, role via metadata et sync profil. |
| Profil | Branche | Bonne | Profil, role, ville, score, badges, historique et parametres sont connectes. |
| GPS et ville persistante | Branche | Moyenne+ | Ajout de prix persiste `city_id`, `preferred_market_id`, latitude/longitude et verification date. Fallback ajoute. A tester sur Android reel. |
| Ajout de prix marche | Branche | Bonne | GPS obligatoire, ville/marche coherents, produit catalogue, anti-doublon, RPC `submit_price_entry`. |
| Prix boutique | Branche | Bonne | Prix boutique separe du prix marche. Les autres utilisateurs ne modifient pas le prix vendeur. |
| Recherche produit | Branche | Bonne apres correction | Catalogue + boutiques eligibles via `searchable_products`. Fallback client existe. |
| Visibilite vendeur | Branche | Bonne | Palette 1/2 appliquee aux CTA : `Disponible chez X` / `Acheter chez X`. |
| Espace boutique | Branche | Bonne | Ajout produit, prix, photo, statut vitrine privee/visible, liaison catalogue si eligible. |
| Chat vendeur | Branche | Moyenne+ | Creation conversation, messages, inbox vendeur/client. RLS participants en place. Manque encore temps reel/realtime. |
| Carte / atlas | Branche | Bonne | Marches, filtres, fiche marche, produits consultes, CTA vendeur si disponible. |
| Produits consultes | Branche | Moyenne | Consultation enregistree au clic dans `market-prices`. Pas encore un vrai compteur global de popularite sur accueil. |
| Badges et score | Branche | Bonne | Score calcule serveur, champs reward proteges, badges synthetiques + stockes. |
| Alertes et confirmations | Branche | Bonne | Actions confirme/corrige/rejette branchees et comptent pour le score. |
| Notifications push | Partiel | Faible | Desactive temporairement Android tant que FCM n'est pas finalise. |
| Intelligence marche | Branche | Moyenne | Snapshots, ecarts externes, refresh. Dependance aux sources externes/edge function. |

## Forces principales

- Separation propre entre prix marche et prix boutique.
- GPS obligatoire dans le flux d'ajout de prix, avec controle ville/marche.
- Score et champs de recompense proteges cote serveur.
- Recherche vendeur conditionnee par l'eligibilite, pas seulement par la presence d'un produit boutique.
- Messagerie reliee a un produit et a un vendeur.
- RLS sur chat, boutique, consultations, profils et prix.
- UI plus claire pour profil, boutique, carte et recherche.

## Correctifs realises pendant l'audit

### 1. Recherche boutique eligible

Probleme detecte :

- La fonction `searchable_products()` appelait `compute_user_reward_summary(bi.owner_id)`.
- Cette fonction refuse normalement de calculer le score d'un autre utilisateur pour un client authentifie.
- Risque : la recherche pouvait casser lorsqu'elle evaluait les boutiques d'autres vendeurs.

Correction :

- Remplacement de cet appel par des aggregats SQL directs sur `prices` et `price_alert_actions`.
- La RPC filtre maintenant les boutiques visibles selon :
  - badge verifie ou tier `verified`,
  - ou ville rattachee,
  - au moins 10 prix,
  - confiance au moins 60,
  - et 3 confirmations ou 2 corrections.

Fichier :

- `supabase/migrations/20260615103000_searchable_products_eligible_boutiques.sql`

### 2. RLS boutique plus stricte

Probleme detecte :

- La policy `boutique_items` permettait de lire tout produit avec `is_visible_in_search = true`.
- Meme si l'app filtre, la base devait aussi porter la regle metier.

Correction :

- Nouvelle policy : le proprietaire lit toujours ses produits, les autres ne lisent que les produits visibles dont le vendeur est eligible.

Fichier :

- `supabase/migrations/20260615104500_boutique_items_eligible_read_policy.sql`

## Points fiables aujourd'hui

### Flux client

- Le client arrive sur l'accueil.
- Il voit les prix et variations.
- Il peut chercher un produit.
- Si un vendeur eligible declare ce produit disponible, le CTA apparait.
- Le clic ouvre le chat vendeur.
- Sur la carte, les produits les plus consultes affichent aussi le CTA vendeur si disponible.

Conclusion : flux client coherent.

### Flux vendeur

- Le vendeur cree son compte avec role `seller`.
- Le profil synchronise le role depuis les metadata auth.
- Les criteres vendeur sont visibles.
- Il ajoute ses produits en boutique.
- Tant qu'il n'est pas eligible, ses produits restent en vitrine privee.
- Quand il devient eligible, ses produits se lient au catalogue et deviennent visibles.

Conclusion : flux vendeur coherent.

### Flux contribution prix

- Le GPS est obligatoire.
- Le choix manuel est limite pour eviter les prix rattaches a une mauvaise ville.
- Le marche detecte est persiste sur le profil.
- L'ajout de prix passe par RPC serveur.
- Les doublons recents sont bloques.
- Le score et les badges sont recalcules.

Conclusion : flux contribution coherent, avec dependance forte au GPS.

## Fragilites restantes

### 1. GPS web et precision ville

Le GPS fonctionne mieux sur Android que sur navigateur. Sur web, la precision depend du navigateur, des permissions, du reseau et de la position estimee.

Risque :

- Ville incorrecte si les coordonnees sont approximatives.

Mitigation deja en place :

- Distance maximale ville.
- Fallback par centroides de marches.
- Persistance mensuelle.
- Controle marche/ville avant envoi.

Recommandation :

- Ajouter un ecran de confirmation "Ville detectee : X" avec bouton "Confirmer ma zone" avant le premier prix.

### 2. Recherche fallback cote client

La RPC `searchable_products` est la source propre. Le fallback client existe pour eviter une panne totale.

Risque :

- Le fallback est moins strict que le SQL principal.

Mitigation ajoutee :

- RLS boutique durcie.

Recommandation :

- Garder `EXPO_PUBLIC_ENABLE_SEARCHABLE_PRODUCTS_RPC=true` en environnement de test/production.

### 3. Messagerie sans realtime

Le chat refetch toutes les 8 secondes.

Risque :

- Experience moins fluide qu'un vrai chat instantane.

Recommandation :

- Ajouter Supabase Realtime sur `chat_messages`.

### 4. Notifications push Android

Les notifications sont volontairement desactivees tant que FCM n'est pas configure.

Risque :

- Pas d'alerte vendeur/client en dehors de l'app.

Recommandation :

- Finaliser FCM avant build production.

### 5. Tests metier insuffisants

Il y a 8 tests, mais pas encore de tests de parcours complets.

Recommandation :

- Ajouter tests unitaires sur :
  - eligibility vendeur,
  - recherche boutique,
  - separation prix boutique/prix marche,
  - calcul CTA palette 1/2,
  - validation GPS ville/marche.

## Priorites conseillees

1. Tester en reel Android : creation vendeur, GPS, ajout prix, score, boutique visible, recherche, chat.
2. Activer/verifier la RPC `searchable_products` en environnement.
3. Appliquer la migration RLS boutique `20260615104500_boutique_items_eligible_read_policy.sql`.
4. Ajouter un vrai mode Realtime pour le chat.
5. Ajouter un test metier automatique pour chaque regle critique.
6. Finaliser FCM si les notifications doivent sortir en production.

## Verdict

Les metiers principaux sont branches et coherents :

- Client : OK.
- Vendeur : OK.
- Boutique : OK apres durcissement.
- Prix marche : OK.
- Recherche : OK avec RPC active.
- Carte : OK.
- Chat : OK fonctionnel, a rendre temps reel.
- Profil/score/badges : OK.
- Notifications : partiel.

Niveau de confiance global : bon pour beta pilote, moyen+ pour production. Pour passer production, les priorites sont surtout GPS terrain, tests metier, Realtime chat et FCM.
