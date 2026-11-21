# MISE À JOUR ET AMÉLIORATION DE LA PLATEFORME

## Rôle

Agis comme un développeur senior full-stack spécialisé dans la création de plateformes modernes, sécurisées et professionnelles.

## Mission

Améliore entièrement le site existant **en conservant toutes ses fonctionnalités déjà opérationnelles**. Travaille directement sur le projet existant, dans le code réel. Ne crée pas une simple maquette. Ne supprime aucune fonctionnalité importante. Conserve les données existantes (aucune perte, migrations de base de données non destructives).

Avant de modifier quoi que ce soit : analyse la structure du projet, liste les pages, composants, routes, API et tables de la base de données, puis présente un court plan d'action avant d'appliquer les changements.

---

## 1. Dépôt et retrait d'argent (Mobile Money)

- Affiche clairement les boutons **Dépôt** et **Retrait** dans l'espace utilisateur (tableau de bord et menu principal).
- Permets aux utilisateurs de connecter leur compte Mobile Money avec leur **numéro de téléphone gabonais** (validation du format, indicatif +241, vérification des préfixes par opérateur).
- Prends en charge **Airtel Money** et **Moov Money**.
- Permets d'envoyer et de recevoir de l'argent directement depuis la plateforme.
- Ajoute un **historique des transactions** : montant, date, heure, opérateur, type (dépôt/retrait), référence et statut (en attente, réussi, échoué, annulé). Avec filtres et pagination.
- Affiche des **confirmations et messages d'erreur clairs** pour chaque étape (saisie, validation du code PIN côté opérateur, succès, échec, délai dépassé).
- Prévois une **interface d'administration des paiements** : liste de toutes les transactions, recherche, filtres, détail, statuts, validation/rejet manuel des retraits si nécessaire, export CSV, et journal d'audit.

### Règles impératives

- Utilise une **véritable intégration avec un prestataire Mobile Money agréé et ses API officielles** (API directe des opérateurs ou agrégateur de paiement reconnu opérant au Gabon). Indique-moi quel prestataire tu utilises et quelles clés/identifiants je dois obtenir auprès de lui.
- **Ne simule jamais les paiements** et ne prétends jamais qu'une transaction a réussi sans **confirmation du prestataire** (callback/webhook signé ou vérification du statut via l'API).
- Le solde de l'utilisateur ne doit être crédité ou débité **qu'après confirmation officielle** du prestataire.
- Toute la logique de paiement s'exécute **côté serveur**. Les clés API et secrets sont stockés dans des variables d'environnement, **jamais dans le code front-end**.
- Vérifie la signature des webhooks, gère l'idempotence (pas de double crédit), les transactions atomiques en base de données, les délais d'expiration et les nouvelles tentatives.
- Ajoute des limites (montants min/max, limites journalières), une protection anti-fraude de base et la journalisation des événements.
- Si les identifiants du prestataire ne sont pas encore disponibles, prépare l'architecture complète avec un fichier `.env.example` et affiche un état « Paiement non configuré » plutôt que de simuler un succès.

---

## 2. Design Apple Premium

- Adopte un design moderne, élégant et minimaliste inspiré de l'expérience Apple.
- Améliore les polices (système type SF Pro / Inter), les couleurs, les icônes, les boutons et les animations (transitions fluides, micro-interactions discrètes).
- Utilise des espaces harmonieux, des cartes élégantes, des coins arrondis, des ombres douces.
- Prévois un **mode clair et un mode sombre**.
- Rends le site agréable et **entièrement responsive** sur Android, iPhone, tablette et ordinateur (approche mobile-first, zones tactiles confortables, respect des zones sûres iOS).
- Améliore la navigation pour que chaque utilisateur comprenne facilement les différentes rubriques (barre de navigation du bas sur mobile, menu latéral ou supérieur sur ordinateur).
- Respecte l'accessibilité : contrastes, labels, navigation clavier, tailles de texte.

---

## 3. Organisation du site

- Réorganise les pages et les menus pour obtenir une structure claire et professionnelle.
- Améliore la **page d'accueil** et les **tableaux de bord** (utilisateur et administrateur).
- Mets en évidence les fonctionnalités importantes.
- Évite les pages surchargées et les éléments inutiles.
- Crée une expérience agréable qui encourage les utilisateurs à revenir régulièrement (états vides soignés, notifications utiles, raccourcis vers les actions fréquentes).

---

## 4. Téléchargement, partage et PWA

- Ajoute un bouton **« Télécharger l'application »** bien visible (accueil, menu, tableau de bord).
- Transforme le site en **PWA complète** :
  - `manifest.webmanifest` (nom, icônes toutes tailles dont maskable, couleurs, `display: standalone`, `start_url`),
  - **service worker** (mise en cache des ressources essentielles, page hors ligne, mises à jour propres),
  - HTTPS obligatoire,
  - gestion de l'événement `beforeinstallprompt` pour proposer l'installation sur Android et ordinateur,
  - sur iPhone/iOS : instructions claires « Partager → Sur l'écran d'accueil »,
  - le bouton n'apparaît que si l'application n'est pas déjà installée.
- Permets de **partager la plateforme** sur WhatsApp, Facebook, Instagram et les autres réseaux (Web Share API en priorité sur mobile, avec liens de repli et option « Copier le lien »).
- Ajoute un bouton de partage accessible depuis les principales pages.
- Ajoute les balises Open Graph / Twitter Card pour de beaux aperçus de partage.

---

## 5. Réseaux sociaux et administration

Dans le panneau d'administration, ajoute une rubrique **« Réseaux sociaux »** permettant à l'administrateur de connecter et gérer les réseaux sociaux de la plateforme via leurs **liens externes**.

Prévois :

- L'**ajout** et la **modification** des liens (validation des URL).
- L'**activation et la désactivation** de chaque réseau.
- L'**affichage automatique des icônes** correspondantes sur le site (pied de page, accueil, page contact) uniquement pour les réseaux actifs.
- L'**accès aux pages officielles** de la plateforme (ouverture dans un nouvel onglet avec `rel="noopener noreferrer"`).
- Stockage en base de données, avec ordre d'affichage modifiable.

---

## 6. Correction et optimisation générale

- Examine **tout le code et toutes les pages**.
- Détecte et corrige les bugs.
- Répare les boutons qui ne fonctionnent pas.
- Vérifie les formulaires (validation côté client **et** serveur), les connexions/inscriptions, les menus et toutes les fonctionnalités.
- Améliore la **sécurité** : hachage des mots de passe, sessions/JWT sécurisés, protection CSRF et XSS, injection SQL, limitation du taux de requêtes, contrôle des rôles (utilisateur/admin), en-têtes de sécurité, secrets en variables d'environnement.
- Améliore les **performances** : chargement différé, images optimisées, compression, mise en cache, requêtes de base de données optimisées.
- Supprime les éléments répétitifs, le code mort et les erreurs visuelles.
- Vérifie que **toutes les fonctionnalités communiquent correctement avec la base de données**.

---

## CONSIGNE FINALE

- Effectue les modifications **réellement dans le code**, teste chaque fonctionnalité et conserve les données existantes.
- À la fin, fournis : la liste des fichiers modifiés/créés, les bugs corrigés, les variables d'environnement à renseigner, les étapes de déploiement et un récapitulatif de ce qui a été testé (et de ce qui reste à configurer, notamment les clés du prestataire Mobile Money).
- Résultat attendu : une plateforme **professionnelle, rapide, sécurisée, moderne et entièrement responsive**, avec une expérience utilisateur digne des meilleures applications internationales, **installable en PWA**.
