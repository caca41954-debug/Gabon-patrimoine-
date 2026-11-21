# TRD — GABON PATRIMOINE
## Document de conception technique
**Version :** 1.0 — **Date :** novembre 2026  
**Statut :** architecture cible à confirmer avec les capacités du projet Rork choisi

## 1. Objectif technique

Définir une architecture sécurisée, maintenable et évolutive pour une plateforme de documentation du patrimoine gabonais. Le système doit prendre en charge les comptes, les rôles, les médias, la modération, la recherche, les récompenses et, après validation contractuelle, les paiements Mobile Money.

Le document décrit une cible technique. Il ne signifie pas que Rork fournit gratuitement tous les services nécessaires ni que les intégrations sont déjà disponibles.

## 2. Architecture générale proposée

### 2.1 Applications
- Application Android générée avec Rork.
- Application web responsive ou portail web d'administration si le projet Rork le permet dans la formule choisie.
- Backend central exposant une API sécurisée.
- Stockage objet pour les photos, audios, vidéos et documents.
- Base de données relationnelle pour les comptes, contenus, décisions et transactions.

### 2.2 Choix techniques à valider
Rork documente la génération d'applications Android natives en Kotlin/Jetpack Compose et d'applications web en React/Vite. Les capacités exactes dépendent du type de projet et du forfait actif.

Architecture backend recommandée :
- Supabase Auth pour l'authentification ;
- PostgreSQL/Supabase pour les données relationnelles ;
- Supabase Storage ou stockage objet compatible pour les médias ;
- fonctions serveur sécurisées pour les opérations sensibles et les webhooks ;
- service de notification activé uniquement après configuration.

Si Rork impose ou propose un backend hébergé spécifique, comparer ses limites, son coût, l'export des données et la possibilité de migrer avant de s'y engager.

## 3. Modules techniques

### 3.1 Authentification
- Inscription, connexion, déconnexion et réinitialisation.
- Vérification d'e-mail ou de téléphone selon le fournisseur.
- Sessions sécurisées et expiration contrôlée.
- Authentification renforcée obligatoire pour l'administrateur principal.
- Aucun mot de passe stocké en clair.
- Les comptes créés manuellement par l'administration doivent être associés à une procédure de première connexion et de changement de mot de passe.

### 3.2 Autorisation et rôles
Rôles : `visitor`, `citizen`, `student`, `researcher`, `moderator`, `admin`.

- Contrôle des droits côté serveur, jamais uniquement dans l'interface.
- Principe du moindre privilège.
- L'administrateur principal peut attribuer les rôles.
- Les modérateurs ne peuvent pas effectuer de retraits financiers ni modifier le compte principal.
- Les actions de suppression, changement de rôle, validation et paiement sont journalisées.

### 3.3 Gestion des médias
- Téléversement direct sécurisé avec URL temporaire ou mécanisme équivalent.
- Contrôle du type MIME, de l'extension et de la taille.
- Limites configurables pour photos, audio, vidéo et documents.
- Noms de fichiers générés côté serveur ; ne pas faire confiance aux noms fournis.
- Analyse antivirus si un service approprié est disponible.
- Miniatures et compression pour les images.
- Métadonnées EXIF sensibles supprimées ou contrôlées avant publication, notamment la géolocalisation.
- Accès privé par défaut aux fichiers en attente ; diffusion publique seulement après validation.
- Sauvegardes et politique de conservation documentées.

### 3.4 Modération
- File de travail filtrable par date, catégorie et état.
- Décisions enregistrées avec auteur, date et motif.
- Historique des versions et des changements.
- Commentaires internes non visibles du public.
- Un contenu refusé ne doit pas devenir public par une erreur d'interface.
- Les contenus sensibles doivent pouvoir être bloqués et transmis à un expert habilité.

### 3.5 Recherche et catalogue
- Recherche plein texte sur les titres, descriptions et mots-clés.
- Filtres par catégorie, région, langue, période et format.
- Pagination côté serveur.
- Indexation des contenus publiés uniquement, sauf accès privilégié.
- Les coordonnées précises des lieux sensibles ne doivent jamais être exposées par défaut.

## 4. Modèle de données initial

Les tables ci-dessous sont indicatives. Les migrations définitives doivent être produites et testées avant mise en production.

### `profiles`
- `id` UUID, clé étrangère vers l'identité d'authentification
- `display_name`
- `email` ou contact vérifié selon le modèle retenu
- `role`
- `bio`
- `institution`
- `discipline`
- `location_label`
- `avatar_path`
- `account_status`
- `created_at`, `updated_at`

### `contributions`
- `id` UUID
- `author_id`
- `title`
- `description`
- `category_id`
- `language`
- `location_label`
- `sensitive_location` booléen
- `period_label`
- `status`
- `visibility`
- `reviewed_by`
- `reviewed_at`
- `created_at`, `updated_at`, `published_at`

### `media_assets`
- `id`
- `contribution_id`
- `storage_path`
- `media_type`
- `mime_type`
- `file_size`
- `alt_text`
- `credit`
- `rights_status`
- `created_at`

### `sources_and_permissions`
- `id`
- `contribution_id`
- `source_description`
- `source_url` facultative
- `permission_type`
- `permission_evidence_path` facultatif
- `consent_status`
- `created_at`

### `categories`
- `id`, `name`, `slug`, `description`, `is_active`

### `moderation_events`
- `id`
- `contribution_id`
- `moderator_id`
- `decision`
- `reason`
- `internal_note`
- `created_at`

### `rewards`
- `id`
- `contributor_id`
- `period_start`, `period_end`
- `amount_xaf`
- `currency`
- `criteria_summary`
- `decision_status`
- `approved_by`
- `announced_at`
- `created_at`

### `payout_requests`
- `id`
- `reward_id`
- `beneficiary_id`
- `provider`
- `masked_phone`
- `amount_xaf`
- `status`
- `provider_reference`
- `failure_reason`
- `requested_at`, `processed_at`

### `transactions`
- `id`
- `payout_request_id`
- `provider`
- `provider_transaction_id`
- `amount_xaf`
- `status`
- `idempotency_key`
- `callback_payload_hash`
- `created_at`, `updated_at`

### `audit_logs`
- `id`
- `actor_id`
- `action`
- `target_type`
- `target_id`
- `metadata`
- `created_at`

Les données financières ne doivent jamais être modifiées directement depuis le client. Les montants doivent être conservés en unités entières de XAF, jamais en nombres flottants.

## 5. Sécurité et règles d'accès

- Activer les politiques RLS de PostgreSQL sur toutes les tables exposées.
- Un contributeur peut consulter et modifier ses brouillons ; il ne peut pas modifier une contribution déjà publiée sans passer par un nouveau processus de révision.
- Un utilisateur ne peut pas changer lui-même son rôle.
- Les contenus non publiés ne sont visibles que par leur auteur et les personnes habilitées.
- Les secrets API restent dans les variables d'environnement du serveur.
- Ne jamais placer de clé secrète dans l'application mobile ou le code web public.
- Vérifier les autorisations à chaque requête serveur.
- Limiter les tentatives de connexion et les dépôts abusifs.
- Prévoir sauvegardes, restauration et procédure de réponse aux incidents.
- Ne jamais conserver les codes PIN Mobile Money des utilisateurs.

## 6. Paiements et récompenses Mobile Money

### 6.1 Principe
L'application doit isoler les fournisseurs derrière une interface serveur, par exemple `PaymentProvider`, afin de pouvoir changer de prestataire sans réécrire le système de récompenses.

Les opérateurs envisagés sont Airtel Money et Moov Money au Gabon. L'utilisation d'un agrégateur ou d'une API directe dépendra des contrats, de l'accès marchand, des environnements de test et des fonctionnalités de décaissement réellement autorisées.

### 6.2 Flux de paiement sortant
1. L'administrateur approuve une récompense.
2. Le serveur crée une demande de retrait avec un identifiant unique.
3. Le bénéficiaire confirme son numéro et l'opérateur.
4. Le serveur vérifie le solde disponible, le statut et les limites.
5. Une demande est envoyée au prestataire depuis le serveur.
6. Le prestataire renvoie un statut ou appelle un webhook.
7. Le serveur vérifie l'authenticité du webhook et interroge le statut auprès du prestataire si nécessaire.
8. La transaction passe à `success`, `failed`, `pending` ou `reversed`.
9. Un reçu et une trace d'audit sont conservés.

### 6.3 Garde-fous
- Clé d'idempotence pour empêcher les doubles paiements.
- Aucun paiement sur simple retour de l'application cliente.
- Vérification de signature ou mécanisme d'authentification du webhook.
- Rapprochement régulier des transactions.
- Seuils et plafonds configurables.
- Approbation humaine au lancement.
- Journal financier non modifiable par les rôles ordinaires.
- Mode simulation séparé de la production.
- En cas de doute sur le statut, ne pas relancer automatiquement un paiement.

**Blocage de mise en production :** ne pas annoncer les retraits automatiques comme disponibles avant d'avoir obtenu un compte marchand, les clés, la documentation officielle et la confirmation écrite que les décaissements vers les deux opérateurs sont autorisés.

## 7. API logique indicative

- `POST /auth/register`
- `POST /auth/login`
- `GET /me`
- `PATCH /me`
- `POST /contributions`
- `PATCH /contributions/{id}`
- `GET /contributions`
- `GET /contributions/{id}`
- `POST /contributions/{id}/submit`
- `POST /contributions/{id}/moderation`
- `POST /admin/users/{id}/role`
- `POST /admin/rewards`
- `POST /payout-requests`
- `GET /payout-requests/{id}`
- `POST /webhooks/payments/{provider}`

Ces routes sont une description logique. Rork et le backend retenu peuvent utiliser des fonctions RPC ou des fonctions serveur plutôt qu'une API REST classique.

## 8. Expérience utilisateur et performance

- Mobile-first, adapté aux petits écrans Android.
- Interface légère, contrastée et cohérente.
- Chargement différé des médias lourds.
- Compression des images et prévisualisation avant envoi.
- Sauvegarde de brouillon et reprise après interruption lorsque possible.
- Messages d'erreur compréhensibles.
- Gestion des connexions instables et prévention des doubles soumissions.
- Pagination et limites de taille.
- Accessibilité des textes et descriptions alternatives.

## 9. Tests obligatoires

### Tests fonctionnels
- inscription et récupération de compte ;
- permissions de chaque rôle ;
- dépôt, édition, soumission et modération ;
- recherche et filtres ;
- publication et retrait d'un contenu ;
- création et annonce d'une récompense ;
- demande de retrait.

### Tests de sécurité
- tentative d'accès aux contenus d'un autre utilisateur ;
- tentative de modification de rôle depuis le client ;
- accès à un fichier non publié ;
- webhook falsifié ;
- paiement répété avec le même identifiant ;
- fuite de secrets dans le code livré.

### Tests de paiement
- succès, refus, expiration, statut inconnu, callback en double, callback tardif, remboursement ou reversal si supporté.
- Les tests doivent être réalisés en environnement sandbox avant toute transaction réelle.

## 10. Déploiement et exploitation

Environnements séparés :
- développement ;
- test / staging ;
- production.

Avant lancement :
- domaine et certificat HTTPS ;
- variables d'environnement et secrets ;
- politiques RLS vérifiées ;
- sauvegardes activées ;
- comptes administrateurs protégés ;
- conditions d'utilisation et politique de confidentialité publiées ;
- test sur plusieurs appareils Android ;
- test des procédures de restauration et de support.

Surveiller les erreurs serveur, les échecs d'upload, les refus de modération, les connexions suspectes et les transactions en attente.

## 11. Stratégie de livraison

### Phase 1 — Fondations
Authentification, profils, rôles, design system, navigation et base de données.

### Phase 2 — Patrimoine
Dépôt de contributions, stockage des médias, catalogue public, recherche et filtres.

### Phase 3 — Gouvernance
Administration, modération, signalements, audit et assistance aux comptes.

### Phase 4 — Reconnaissance
Critères de récompense, sélection, publication du contributeur distingué et registre financier.

### Phase 5 — Paiements
Intégration du prestataire choisi, tests sandbox, validation contractuelle et décaissements réels.

## 12. Consignes à donner à Rork

Construire progressivement, module par module, en respectant les documents PRD et TRD. Ne pas générer une simple maquette présentée comme une application terminée.

À chaque phase :
- créer les écrans réellement fonctionnels ;
- connecter les formulaires à la base de données ;
- appliquer les autorisations côté serveur ;
- afficher les états de chargement, succès et erreur ;
- écrire et tester les migrations ;
- ne jamais inventer de clés API, de paiements réussis, de comptes vérifiés ou de données réelles ;
- utiliser des données de démonstration clairement identifiées ;
- laisser les fonctions non configurées désactivées et signalées comme telles ;
- expliquer les services externes payants avant de les activer.

Le lancement initial doit privilégier une bibliothèque patrimoniale fiable et une modération rigoureuse. Les paiements automatiques ne sont pas prioritaires tant que les autorisations et moyens financiers ne sont pas confirmés.
