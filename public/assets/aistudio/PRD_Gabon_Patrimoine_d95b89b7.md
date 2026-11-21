# PRD — GABON PATRIMOINE
## Document de spécifications fonctionnelles
**Version :** 1.0 — **Date :** novembre 2026  
**Statut :** document de cadrage initial, à valider avant développement

## 1. Vision du produit

Gabon Patrimoine est une plateforme numérique consacrée à la mémoire culturelle du Gabon. Elle doit permettre aux citoyens, aux étudiants et aux enseignants-chercheurs de documenter, préserver, partager et transmettre les patrimoines matériels et immatériels du pays.

La plateforme ne doit pas être un simple fil de publications. Elle doit devenir un espace organisé de documentation, de découverte et de transmission, dans lequel les contenus sont attribués à leurs contributeurs, contextualisés et, lorsque nécessaire, vérifiés avant publication.

**Promesse :** chacun peut contribuer à faire vivre la mémoire du Gabon, dans le respect des communautés, des personnes et des savoirs partagés.

## 2. Objectifs

- Constituer progressivement une collection numérique de ressources sur le patrimoine gabonais.
- Donner de la visibilité aux langues, traditions, récits, pratiques, lieux, objets, arts et savoir-faire.
- Faciliter les travaux pédagogiques et scientifiques.
- Encourager les contributions citoyennes de qualité.
- Reconnaître les contributeurs remarquables par un système transparent de récompenses.
- Permettre à l'administrateur principal de superviser la plateforme et d'accompagner les personnes qui ne parviennent pas à créer leur compte.

## 3. Publics et rôles

### 3.1 Visiteur
Peut consulter les contenus rendus publics, rechercher des ressources et découvrir les contributeurs mis à l'honneur. Il doit créer un compte pour publier ou interagir.

### 3.2 Citoyen contributeur
Peut créer un profil, proposer des récits, témoignages, photographies, enregistrements audio, vidéos, descriptions de lieux, traditions ou savoir-faire. Il peut suivre l'état de ses propositions et consulter son historique.

### 3.3 Étudiant
Dispose des fonctions du contributeur et peut préciser son établissement, sa discipline et son niveau d'études. Il peut déposer des enquêtes de terrain, travaux et documents, sous réserve de respecter les droits des personnes et les règles de citation.

### 3.4 Enseignant-chercheur
Dispose des fonctions de contribution et peut publier des notices documentées, études, analyses et ressources pédagogiques. Un statut vérifié peut être attribué après contrôle par l'administration.

### 3.5 Modérateur ou expert
Rôle facultatif attribué par l'administrateur. Il examine les propositions, signale les erreurs, demande des précisions et recommande une validation. Il ne peut pas modifier les paramètres sensibles ni gérer les paiements, sauf autorisation spécifique.

### 3.6 Administrateur principal
Le propriétaire opérationnel de la plateforme. Il peut :
- consulter et gérer les comptes ;
- aider à créer ou rétablir un compte à la demande de son titulaire ;
- attribuer, modifier ou retirer des rôles ;
- examiner, valider, refuser, corriger avec traçabilité, archiver ou retirer une publication ;
- gérer les catégories, rubriques, signalements et paramètres ;
- désigner les contributeurs récompensés ;
- consulter les demandes de retrait et l'historique financier ;
- consulter les journaux d'activité et gérer les accès.

Les actions sensibles doivent être journalisées. Le compte administrateur principal doit être protégé par une authentification renforcée.

## 4. Périmètre fonctionnel

### 4.1 Comptes et profils
- Inscription par adresse e-mail ou numéro de téléphone, selon les moyens réellement configurés.
- Connexion, déconnexion, réinitialisation du mot de passe et vérification du contact.
- Choix du type de profil : citoyen, étudiant ou enseignant-chercheur.
- Profil modifiable : nom public, biographie, province ou localité déclarée, domaines d'intérêt et photo facultative.
- Possibilité de demander la correction d'un compte ou l'assistance de l'administration.
- Consentement aux conditions d'utilisation, à la politique de confidentialité et aux règles de publication.

### 4.2 Dépôt de contributions
Chaque contribution peut contenir :
- un titre et une description ;
- une catégorie patrimoniale ;
- une localité ou une zone géographique, sans imposer la divulgation d'un lieu sensible ;
- une communauté ou un groupe concerné, si cette information peut être publiée ;
- une langue ;
- une période ou une date approximative ;
- des photos, fichiers audio, vidéos ou documents ;
- les sources, références, auteurs et crédits ;
- les autorisations de publication nécessaires ;
- le niveau de visibilité demandé.

États possibles : brouillon, soumise, en examen, à compléter, validée, publiée, refusée, archivée ou retirée.

Une contribution n'est pas automatiquement considérée comme vraie ou authentifiée parce qu'elle a été déposée sur la plateforme.

### 4.3 Bibliothèque patrimoniale
- Catalogue des contenus publiés.
- Classement par catégories, province, localité, langue, période et type de média.
- Recherche par mots-clés et filtres.
- Fiche détaillée avec auteur, date de publication, sources, crédits et statut de vérification.
- Partage d'une fiche par lien.
- Signalement d'une erreur, d'un contenu illicite ou d'une atteinte aux droits.

Catégories initiales proposées : patrimoine oral, langues, contes et récits, rites et pratiques, musique et danse, arts et artisanat, alimentation, vêtements et parures, architecture, sites et paysages culturels, objets et archives, histoire locale, savoir-faire et patrimoine naturel associé aux pratiques culturelles.

### 4.4 Validation et qualité
- File de modération accessible aux personnes autorisées.
- Liste de contrôle : droits, consentement, contexte, sources, exactitude apparente, sensibilité culturelle et qualité du média.
- Commentaires privés entre modérateur et contributeur.
- Historique des décisions.
- Mention claire des contenus « proposés », « relus » ou « documentés », sans inventer de label scientifique.
- Possibilité de demander une seconde lecture.

### 4.5 Récompenses des contributeurs
- Programme de reconnaissance mensuel ou trimestriel, défini par l'administrateur.
- Critères publiés à l'avance : qualité documentaire, originalité, utilité, fiabilité des sources, respect des droits, régularité et apport à la diversité des patrimoines.
- Tableau des contributions éligibles et fiche de justification du choix.
- Publication du contributeur récompensé après vérification et consentement.
- Historique des récompenses et des décisions.

La récompense ne doit pas être calculée uniquement sur le nombre de vues, de likes ou de publications. Les règles doivent empêcher les faux comptes, le plagiat et les manipulations.

### 4.6 Retraits de récompenses
- Solde disponible, demandes, statut et historique.
- Méthode de retrait affichée uniquement après validation du prestataire.
- Airtel Money et Moov Money envisagés en priorité au Gabon.
- Vérification du bénéficiaire, du numéro et du montant avant exécution.
- Confirmation explicite par l'administrateur ou processus automatisé sécurisé.
- Reçu et référence de transaction.
- Gestion des échecs, doublons, annulations et réclamations.

**Important :** l'intégration d'un prestataire de paiement ne garantit pas automatiquement le droit d'effectuer des décaissements. Il faut confirmer par contrat et documentation que le prestataire autorise les paiements sortants vers Airtel Money et Moov Money au Gabon.

### 4.7 Espace d'administration
Tableau de bord avec :
- nombre de comptes et répartition par rôle ;
- contributions reçues, en attente, publiées et refusées ;
- signalements et demandes d'assistance ;
- contributeurs récompensés ;
- demandes de retrait et transactions ;
- activité récente et alertes de sécurité.

### 4.8 Notifications
Notifications dans l'application pour :
- confirmation de dépôt ;
- demande de complément ;
- décision de modération ;
- publication ;
- récompense ;
- évolution d'une demande de retrait ;
- réponse de l'administration.

Les notifications par SMS, e-mail ou push ne seront activées que si le fournisseur correspondant est configuré.

## 5. Parcours principaux

### Parcours contributeur
1. Le visiteur crée son compte et vérifie son contact.
2. Il complète son profil et accepte les règles.
3. Il dépose une contribution avec ses médias, crédits et autorisations.
4. Il reçoit un accusé de réception.
5. Un modérateur examine le dossier.
6. Le contributeur reçoit une demande de correction, une décision ou une confirmation de publication.

### Parcours de récompense
1. L'administration ouvre une période de sélection.
2. Les contributions éligibles sont examinées selon les critères annoncés.
3. Le choix est documenté et approuvé.
4. Le contributeur est contacté et donne son accord pour l'annonce publique.
5. La récompense est enregistrée.
6. Le paiement est déclenché seulement si le prestataire, les fonds et les contrôles nécessaires sont disponibles.

## 6. Exigences non fonctionnelles côté utilisateur

- Interface en français, claire et accessible sur téléphone Android, tablette et ordinateur.
- Design sobre, élégant et haut de gamme, inspiré par la simplicité des interfaces Apple sans reproduire leur identité visuelle.
- Navigation simple, textes lisibles et médias optimisés pour les connexions limitées.
- États de chargement, erreurs et confirmations compréhensibles.
- Accessibilité : contraste suffisant, tailles de texte adaptées et alternatives textuelles aux images.
- Possibilité d'ajouter ultérieurement des langues locales à l'interface.

## 7. Principes éthiques et éditoriaux

- Respecter les détenteurs de savoirs et les communautés concernées.
- Ne pas publier automatiquement les contenus sacrés, secrets, funéraires ou soumis à restriction.
- Permettre de limiter la visibilité d'un contenu ou de retirer une autorisation selon les conditions convenues.
- Ne pas présenter une tradition comme représentative de tout le Gabon si elle concerne une communauté particulière.
- Distinguer témoignage, tradition orale, hypothèse, analyse et fait documenté.
- Obtenir les autorisations des personnes reconnaissables dans les médias.
- Protéger les mineurs et éviter la publication de données personnelles inutiles.
- Définir une procédure de contestation, de correction et de retrait.

## 8. MVP — première version indispensable

La première version doit se concentrer sur :
1. inscription, connexion et profils ;
2. dépôt de contributions avec photos et documents ;
3. bibliothèque publique avec recherche et filtres ;
4. modération et validation ;
5. administration principale et gestion des rôles ;
6. mise en avant d'un contributeur récompensé ;
7. registre des récompenses et demandes de retrait, d'abord avec validation manuelle ;
8. journalisation des actions sensibles.

Les paiements automatiques, les classements complexes, les commentaires publics, les messageries et les fonctions sociales avancées peuvent attendre une deuxième phase.

## 9. Indicateurs de réussite

- Nombre de contributeurs actifs.
- Nombre de contributions reçues et publiées.
- Délai moyen de modération.
- Part des contenus accompagnés de sources et de crédits.
- Diversité des catégories, langues et régions représentées.
- Nombre de corrections et signalements traités.
- Nombre de récompenses attribuées et retraits correctement exécutés.

## 10. Décisions à confirmer avant lancement

- Nom définitif, identité visuelle et statut juridique de la plateforme.
- Conditions d'utilisation et politique de confidentialité.
- Propriété intellectuelle et licence accordée à la plateforme pour afficher les contenus.
- Règles exactes de sélection et montant des récompenses.
- Prestataire de paiement et capacité réelle de décaissement au Gabon.
- Durée de conservation des données et procédure de suppression de compte.
- Personnes habilitées à modérer et procédure de recours.
