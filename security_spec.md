# Spécification de Sécurité — Gabon Patrimoine

## 1. Invariants de données et de gouvernance
1. **Zéro auto-élévation de privilège** : Un utilisateur ne peut jamais s'attribuer les rôles `moderator` ou `admin`, ni modifier son propre champ `role`, `verifiedBadge` ou `accountStatus` après inscription.
2. **Isolation des données personnelles (PII)** : Les adresses e-mail et numéros de téléphone restent confinés dans `/users/{userId}` (lisibles uniquement par le titulaire et l'administrateur) et `/assisted_accounts/{assistedId}` (lisibles par l'administrateur ou par l'utilisateur dont l'e-mail vérifié correspond lors de la récupération).
3. **Modération obligatoire avant publication** : Aucune contribution créée par un utilisateur ne peut naître avec le statut `published` ou `validated` ni le label `relu`/`documente`. Seuls les modérateurs habilités et l'administrateur peuvent publier une contribution.
4. **Intégrité financière (XAF entiers uniquement)** : Les récompenses, demandes de retrait et transactions utilisent exclusivement des montants entiers en francs CFA (`int`), et seul l'administrateur peut créer une récompense ou valider/enregistrer une transaction Mobile Money.
5. **Journal d'audit immuable** : Les documents dans `/audit_logs/{logId}` ne peuvent jamais être modifiés ni supprimés.
6. **Liens sociaux officiels durcis** : Les documents dans `/social_links/{linkId}` exigent une URL HTTPS valide (`^https://.+`) et ne peuvent être créés, modifiés ou supprimés que par l'administrateur principal. Les liens désactivés (`isActive: false`) ne sont visibles que par l'administrateur.

## 2. Payloads adversariaux (« Dirty Dozen »)
1. **Escalade de rôle à l'inscription** : Création dans `/users/{uid}` avec `role: "admin"` par un compte non administrateur -> `PERMISSION_DENIED`.
2. **Auto-vérification scientifique** : Mise à jour de `/users/{uid}` ajoutant `verifiedBadge: true` -> `PERMISSION_DENIED`.
3. **Contournement de modération** : Création dans `/contributions/{id}` avec `status: "published"` par un contributeur -> `PERMISSION_DENIED`.
4. **Usurpation d'auteur** : Création dans `/contributions/{id}` avec `authorId: "autre_uid"` -> `PERMISSION_DENIED`.
5. **Lecture PII tierce** : Requête `get` sur `/users/{autre_uid}` par un utilisateur ordinaire -> `PERMISSION_DENIED`.
6. **Liste non bornée de contributions privées** : Requête `list` sur `/contributions` sans filtre `status == 'published'` ni `authorId == uid` par un citoyen -> `PERMISSION_DENIED`.
7. **Falsification d'horodatage** : Création de contribution avec `createdAt` anti-daté côté client différent de `request.time` -> `PERMISSION_DENIED`.
8. **Champ fantôme (« Shadow Update »)** : Mise à jour de profil incluant un champ non autorisé `isAdmin: true` -> `PERMISSION_DENIED`.
9. **Montant flottant ou négatif** : Création de demande de retrait `/payout_requests/{id}` avec `amountXaf: -5000` ou `1500.5` -> `PERMISSION_DENIED`.
10. **Auto-validation de retrait Mobile Money** : Mise à jour de `/payout_requests/{id}` par le bénéficiaire avec `status: "paid"` -> `PERMISSION_DENIED`.
11. **Altération d'audit** : Tentative de `update` ou `delete` sur `/audit_logs/{logId}` même par un administrateur -> `PERMISSION_DENIED`.
12. **Injection d'identifiant surdimensionné** : Création sur un chemin avec un ID de 300 caractères ou contenant des caractères spéciaux `/` -> `PERMISSION_DENIED`.
13. **Injection de lien social non HTTPS** : Création ou modification dans `/social_links/{id}` avec `url: "javascript:alert(1)"` ou par un non-administrateur -> `PERMISSION_DENIED`.

