# Gabon Patrimoine — Audit Technique & Sécurité

# Security Summary

## Reviewed Files
- `/server.ts` — Serveur Express avec compression gzip, en-têtes de sécurité (`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`), API médias, assistance, portefeuille Mobile Money, décaissements SHAP et callback E-Billing.
- `/server/billingEasyService.ts` — Client Billing Easy / E-Billing & SHAP, vérification de signature webhook, stockage atomique JSON.
- `/server/walletService.ts` — Grand livre atomique (`/data/wallet-ledger.json`), validation stricte des préfixes gabonais (`+241` Airtel `074/076/077` & Moov `060/062/065/066`), idempotence des dépôts/retraits et journal d'audit financier.
- `/firestore.rules` — Règles de sécurité Firestore (RBAC, modération stricte, immutabilité des audits, gestion des liens `social_links` validés `https://`).
- `/src/context/AuthContext.tsx` & `/src/context/ThemeContext.tsx` — Authentification Firebase, profils utilisateurs, rafraîchissement des jetons et gestion du mode clair/sombre sans flash (FOUC-free).
- `/src/services/walletService.ts`, `/src/services/ebillingService.ts` & `/src/services/firestoreService.ts` — Services client authentifiés par Bearer token, export CSV sécurisé par Blob, requêtes Firestore filtrées.
- `/src/components/PaymentView.tsx`, `/src/components/AccountWorkspace.tsx`, `/src/components/AdminDashboard.tsx` — Parcours complet Dépôt & Retrait Mobile Money, supervision financière administrateur, gestion CRUD des réseaux sociaux officiels.
- `/src/components/PWAControls.tsx` & `/src/components/ShareModal.tsx` — Installation PWA (`beforeinstallprompt` + guide iOS Safari), indicateur hors ligne et partage natif/social.

## Issues Resolved

| Zone | Problème identifié | Correction appliquée |
| :--- | :--- | :--- |
| Portefeuille Mobile Money & Idempotence | Risque de double crédit/débit ou de validation client non autorisée sur les dépôts et retraits Airtel/Moov Money. | Création de `/server/walletService.ts` avec écritures atomiques (`writeJsonAtomic`), clés d'idempotence, réservation immédiate sur retrait (`pendingWithdrawalXaf`) et crédit exclusif par webhook signé ou réconciliation Enquiry vérifiée. |
| Validation téléphonique Gabon (+241) | Préfixes Airtel/Moov non distingués et risque de routage vers le mauvais opérateur. | Validation stricte serveur & client des préfixes gabonais : Airtel (`074`, `076`, `077`) et Moov (`060`, `062`, `065`, `066`), rejet explicite en cas d'incohérence. |
| Callback `/api/ebilling/callback` | Absence d'endpoint dédié initial et besoin de répercuter automatiquement les paiements confirmés sur le portefeuille. | `POST /api/ebilling/callback` & `/api/webhooks/ebilling/callback` vérifient la signature HMAC-SHA256 / secret temps constant (`503` si non configuré, `401` si invalide), contrôlent le montant XAF et créditent le portefeuille associé. |
| Export CSV & Liens sociaux | Risque d'injection de formules CSV, d'URL non sécurisées (`javascript:`) ou de fuites via `window.open`. | Échappement CSV des formules (`=`, `+`, `-`, `@`), téléchargement CSV par `fetch` authentifié + `Blob`, validation stricte `https://` côté client, service et `firestore.rules` sur `social_links`. |
| En-têtes HTTP & Performance | Absence de compression gzip, d'en-têtes `nosniff`/`Referrer-Policy`, et bundle monolithique. | Ajout de `compression()`, suppression de `X-Powered-By`, en-têtes de sécurité systématiques et découpage de code par `React.lazy` + `<Suspense>` dans `App.tsx`. |

## Safeguards Verified

| Contrôle | Mécanisme en place |
| :--- | :--- |
| Authentification & RBAC | Vérification des jetons Firebase ID Token côté Express pour toutes les routes `/api/wallet*` et contrôle du rôle `admin` Firestore pour `/api/admin/wallet/*` et l'export CSV. |
| Intégrité webhook & montants | `verifyWebhookSecretOrHmac()` en temps constant sur le `rawBody` (échec fermé `503`/`401`), vérification des montants entiers XAF et remboursement automatique en cas d'échec ou refus de retrait. |
| Limitation de débit (Rate Limiting) | Limiteurs dédiés sur la création de dépôts/factures E-Billing, les retraits, le téléversement média et l'assistance publique. |
| PWA & Confidentialité hors ligne | Service Worker Workbox configuré en `NetworkOnly` pour `/api/*` et les requêtes d'authentification afin d'éviter toute mise en cache de données sensibles ou financières. |
| Persistance atomique & RBAC Firestore | `writeJsonAtomic()` protège les registres serveur ; `firestore.rules` (validé sans erreur ESLint et déployé) applique le RBAC, l'immutabilité des audits et les règles `social_links`. |

## PoC Verification

Les contrôles suivants sont exécutés sur la build de production et le serveur local (`http://localhost:3000`) :

1. **Audit des dépendances & règles Firestore (`bun audit`, `npx eslint firestore.rules`)**
   - Vérification de l'absence de vulnérabilités critiques non résolues et validation syntaxique/sécurité des règles Firestore.
2. **Santé API & disponibilité PWA (`GET /api/health`, `GET /api/payments/providers`, `GET /manifest.webmanifest`, `GET /offline.html`)**
   - Vérifie les réponses `200 OK`, les en-têtes `X-Content-Type-Options: nosniff`, `Referrer-Policy`, l'absence de `X-Powered-By` et la compression gzip.
3. **Contrôle d'accès portefeuille (`GET /api/wallet`, `POST /api/wallet/deposit`, `POST /api/wallet/withdraw`, `GET /api/admin/wallet/overview`)**
   - Tout accès anonyme retourne strictement `401 Unauthorized`.
4. **Rejet fail-closed du webhook (`POST /api/ebilling/callback`)**
   - Notification non signée / secret non configuré -> réponse `503 Service Unavailable` (`WEBHOOK_NOT_CONFIGURED`) ou `401 Unauthorized`, aucune balance modifiée.
5. **Routes API inconnues (`GET /api/route-inexistante`)**
   - Retourne `404` au format `application/json` (jamais de fallback HTML).
