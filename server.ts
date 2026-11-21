import compression from 'compression';
import crypto from 'crypto';
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { type DecodedIdToken, getAuth } from 'firebase-admin/auth';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  applyEbillingWebhook,
  applyShapWebhookUpdate,
  createEbillingCheckout,
  enquiryEbillingStatus,
  executeShapPayout,
  getEbillingConfig,
  getEbillingRecord,
  getGatewayArchitectureStatus,
  getPayoutDestination,
  getProviderStatuses,
  getShapBalances,
  getShapConfig,
  listEbillingRecords,
  listShapLedgerRecords,
  normalizeGabonMsisdn,
  reconcileShapPayout,
  savePayoutDestination,
  signEbillingStatusToken,
  toShapPaymentSystem,
  validateGabonOperatorMsisdn,
  verifyEbillingStatusToken,
  verifyWebhookSecretOrHmac,
} from './server/billingEasyService';
import {
  adminDecideWalletWithdrawal,
  exportWalletTransactionsCsv,
  getAdminWalletOverview,
  getOrCreateWalletSummary,
  initiateWalletDeposit,
  initiateWalletWithdrawal,
  linkMobileMoneyAccount,
  listWalletTransactions,
  syncWalletDepositFromEbilling,
  syncWalletWithdrawalFromShap,
  verifyWalletDepositByReference,
} from './server/walletService';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const BOOTSTRAP_ADMIN_EMAIL = 'arnaudndoumelobe821@gmail.com';

const firebaseConfigPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
let firebaseConfig: { projectId?: string; firestoreDatabaseId?: string } = {};
if (fs.existsSync(firebaseConfigPath)) {
  firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf-8'));
}

if (firebaseConfig.projectId) {
  if (!getApps().length) {
    initializeApp({ projectId: firebaseConfig.projectId });
  } else {
    getApp();
  }
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const UPLOAD_DIR = path.resolve(DATA_DIR, 'uploads');
const MEDIA_INDEX_PATH = path.resolve(DATA_DIR, 'media-index.json');
const PUBLIC_ASSISTANCE_PATH = path.resolve(DATA_DIR, 'public-assistance.json');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

interface MediaAssetRecord {
  id: string;
  ownerUid: string;
  contributionId: string | null;
  status: 'pending' | 'published' | 'rejected';
  mediaType: 'image' | 'audio' | 'video' | 'document';
  mimeType: string;
  fileSize: number;
  storedFileName: string;
  originalExtension: string;
  exifStripped: boolean;
  createdAt: string;
}

interface PublicAssistanceRecord {
  id: string;
  requesterName: string;
  contactInfo: string;
  requestedRole: 'citizen' | 'student' | 'researcher';
  message: string;
  status: 'open' | 'in_progress' | 'resolved';
  adminNote: string;
  createdAt: string;
  updatedAt: string;
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

function writeJsonAtomic<T>(filePath: string, data: T): void {
  const dir = path.dirname(filePath);
  const tmpPath = path.join(dir, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

// ============================================================================
// JPEG EXIF / APP SEGMENT STRIPPER (Removes GPS & camera metadata)
// ============================================================================
function stripJpegMetadata(buffer: Buffer): Buffer {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return buffer;
  }
  const chunks: Buffer[] = [buffer.subarray(0, 2)];
  let offset = 2;
  while (offset < buffer.length - 1) {
    if (buffer[offset] !== 0xff) break;
    const marker = buffer[offset + 1];
    if (marker === 0xda || marker === 0xd9) {
      chunks.push(buffer.subarray(offset));
      break;
    }
    if (offset + 3 >= buffer.length) break;
    const segLen = buffer.readUInt16BE(offset + 2);
    if (segLen < 2 || offset + 2 + segLen > buffer.length) break;
    const isSensitiveMeta = (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe;
    if (!isSensitiveMeta) {
      chunks.push(buffer.subarray(offset, offset + 2 + segLen));
    }
    offset += 2 + segLen;
  }
  return Buffer.concat(chunks);
}

// ============================================================================
// AUTHENTICATION HELPERS (verifyIdToken + Caller-scoped Firestore REST)
// ============================================================================
interface AuthenticatedRequest extends Request {
  user?: DecodedIdToken;
  idToken?: string;
  rawBody?: string;
}

async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentification requise.' });
    return;
  }
  const token = authHeader.slice('Bearer '.length).trim();
  try {
    const decoded = await getAuth().verifyIdToken(token);
    req.user = decoded;
    req.idToken = token;
    next();
  } catch {
    res.status(401).json({ error: 'Jeton de session invalide ou expiré.' });
  }
}

async function decodeOptionalUser(req: AuthenticatedRequest): Promise<{ user: DecodedIdToken; idToken: string } | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) return null;
  try {
    const decoded = await getAuth().verifyIdToken(token);
    return { user: decoded, idToken: token };
  } catch {
    return null;
  }
}

async function getCallerRoleViaFirestoreRest(
  uid: string,
  email: string | undefined,
  emailVerified: boolean | undefined,
  idToken: string
): Promise<string> {
  if (emailVerified && email === BOOTSTRAP_ADMIN_EMAIL) {
    return 'admin';
  }
  if (!firebaseConfig.projectId) return 'citizen';
  const dbId = firebaseConfig.firestoreDatabaseId || '(default)';
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(firebaseConfig.projectId)}/databases/${encodeURIComponent(dbId)}/documents/users/${encodeURIComponent(uid)}`;
  try {
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!resp.ok) return 'citizen';
    const docData = (await resp.json()) as { fields?: { role?: { stringValue?: string } } };
    return docData.fields?.role?.stringValue || 'citizen';
  } catch {
    return 'citizen';
  }
}

// ============================================================================
// FILE UPLOAD VALIDATION & IN-MEMORY RATE LIMITERS
// ============================================================================
const ALLOWED_MIME_TYPES: Record<
  string,
  { mediaType: 'image' | 'audio' | 'video' | 'document'; extensions: string[]; maxBytes: number }
> = {
  'image/jpeg': { mediaType: 'image', extensions: ['.jpg', '.jpeg'], maxBytes: 8 * 1024 * 1024 },
  'image/png': { mediaType: 'image', extensions: ['.png'], maxBytes: 8 * 1024 * 1024 },
  'image/webp': { mediaType: 'image', extensions: ['.webp'], maxBytes: 8 * 1024 * 1024 },
  'audio/mpeg': { mediaType: 'audio', extensions: ['.mp3'], maxBytes: 15 * 1024 * 1024 },
  'audio/mp3': { mediaType: 'audio', extensions: ['.mp3'], maxBytes: 15 * 1024 * 1024 },
  'audio/wav': { mediaType: 'audio', extensions: ['.wav'], maxBytes: 15 * 1024 * 1024 },
  'audio/ogg': { mediaType: 'audio', extensions: ['.ogg'], maxBytes: 15 * 1024 * 1024 },
  'audio/mp4': { mediaType: 'audio', extensions: ['.m4a', '.mp4'], maxBytes: 15 * 1024 * 1024 },
  'audio/webm': { mediaType: 'audio', extensions: ['.webm'], maxBytes: 15 * 1024 * 1024 },
  'video/mp4': { mediaType: 'video', extensions: ['.mp4'], maxBytes: 40 * 1024 * 1024 },
  'video/webm': { mediaType: 'video', extensions: ['.webm'], maxBytes: 40 * 1024 * 1024 },
  'application/pdf': { mediaType: 'document', extensions: ['.pdf'], maxBytes: 10 * 1024 * 1024 },
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 40 * 1024 * 1024 },
});

function createWindowRateLimiter(maxHits: number, windowMs: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (key: string): boolean => {
    const now = Date.now();
    const entry = hits.get(key);
    if (entry && entry.resetAt > now) {
      if (entry.count >= maxHits) return false;
      entry.count += 1;
      return true;
    }
    hits.set(key, { count: 1, resetAt: now + windowMs });
    if (hits.size > 2000) {
      for (const [k, v] of hits.entries()) {
        if (v.resetAt <= now) hits.delete(k);
      }
    }
    return true;
  };
}

const allowAssistanceRequest = createWindowRateLimiter(5, 10 * 60 * 1000);
const allowEbillingCheckout = createWindowRateLimiter(12, 10 * 60 * 1000);
const allowWalletAction = createWindowRateLimiter(20, 5 * 60 * 1000);

function resolveAppBaseUrl(req: Request): string {
  const envAppUrl = (process.env.APP_URL || '').trim();
  if (envAppUrl && envAppUrl !== 'MY_APP_URL') return envAppUrl.replace(/\/+$/, '');
  const host = req.get('host');
  return host ? `${req.protocol}://${host}` : `http://localhost:${PORT}`;
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(compression());

  // Security headers (preserving iframe embedding compatibility for AI Studio)
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });

  const captureRawBody = (req: Request, _res: Response, buf: Buffer) => {
    (req as AuthenticatedRequest).rawBody = buf.toString('utf-8');
  };

  app.use(express.json({ limit: '1mb', verify: captureRawBody }));
  app.use(express.urlencoded({ extended: true, limit: '1mb', verify: captureRawBody }));

  // 1. Health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'gabon-patrimoine' });
  });

  // 2. Payment providers & Billing Easy / SHAP architecture status
  app.get('/api/payments/providers', (req, res) => {
    const appBaseUrl = resolveAppBaseUrl(req);
    res.json({
      providers: getProviderStatuses(),
      gateway: getGatewayArchitectureStatus(appBaseUrl),
    });
  });

  // 2b. Securely store beneficiary MSISDN on server for automated SHAP payout
  app.post('/api/payments/payout-destination', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    if (!req.user?.email_verified) {
      res.status(403).json({ error: 'Adresse e-mail vérifiée requise.' });
      return;
    }
    const { payoutRequestId, provider, rawPhone } = req.body as {
      payoutRequestId?: string;
      provider?: 'airtel_money' | 'moov_money';
      rawPhone?: string;
    };
    if (
      typeof payoutRequestId !== 'string' ||
      !/^[a-zA-Z0-9_-]{4,128}$/.test(payoutRequestId) ||
      (provider !== 'airtel_money' && provider !== 'moov_money') ||
      typeof rawPhone !== 'string'
    ) {
      res.status(400).json({ error: 'Paramètres de destination Mobile Money invalides.' });
      return;
    }

    const phoneCheck = validateGabonOperatorMsisdn(rawPhone, provider);
    if (!phoneCheck.valid || !phoneCheck.msisdn) {
      res.status(400).json({
        error:
          phoneCheck.error ||
          'Numéro Mobile Money gabonais invalide (format attendu : 074/076/077 pour Airtel ou 060/062/065/066 pour Moov).',
      });
      return;
    }
    const msisdn = phoneCheck.msisdn;

    try {
      savePayoutDestination({
        payoutRequestId,
        beneficiaryUid: req.user.uid,
        provider,
        msisdn,
        updatedAt: new Date().toISOString(),
      });
      res.status(201).json({ saved: true });
    } catch (err) {
      res.status(403).json({
        error: err instanceof Error ? err.message : 'Impossible d’enregistrer cette destination.',
      });
    }
  });

  // 3. SHAP Admin Wallet Balance & Payout Execution
  app.get('/api/payments/shap/balance', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const callerRole = await getCallerRoleViaFirestoreRest(
      req.user!.uid,
      req.user!.email,
      req.user!.email_verified,
      req.idToken!
    );
    if (callerRole !== 'admin') {
      res.status(403).json({ error: 'Accès réservé à l’administrateur principal.' });
      return;
    }
    const cfg = getShapConfig();
    if (!cfg.configured) {
      res.status(501).json({
        error: 'PROVIDER_NOT_CONFIGURED',
        missingEnvVars: cfg.missingEnvVars,
        message: `SHAP non configuré (${cfg.missingEnvVars.join(', ')}). Ajoutez ces clés dans AI Studio → Settings → Secrets.`,
      });
      return;
    }
    try {
      const balance = await getShapBalances();
      res.json({ balance });
    } catch (err) {
      res.status(502).json({
        error: 'SHAP_BALANCE_ERROR',
        message: err instanceof Error ? err.message : 'Erreur lors de la lecture du solde SHAP.',
      });
    }
  });

  app.get('/api/payments/shap/ledger', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const callerRole = await getCallerRoleViaFirestoreRest(
      req.user!.uid,
      req.user!.email,
      req.user!.email_verified,
      req.idToken!
    );
    if (callerRole !== 'admin') {
      res.status(403).json({ error: 'Accès réservé à l’administrateur principal.' });
      return;
    }
    res.json({ records: listShapLedgerRecords() });
  });

  app.post('/api/payments/shap/payout', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const callerRole = await getCallerRoleViaFirestoreRest(
      req.user!.uid,
      req.user!.email,
      req.user!.email_verified,
      req.idToken!
    );
    if (callerRole !== 'admin') {
      res.status(403).json({ error: 'Accès réservé à l’administrateur principal.' });
      return;
    }

    const { payoutRequestId, provider, amountXaf, payeeMsisdnOverride, payoutType } = req.body as {
      payoutRequestId?: string;
      provider?: 'airtel_money' | 'moov_money';
      amountXaf?: number;
      payeeMsisdnOverride?: string;
      payoutType?: 'withdrawal' | 'refund' | 'cashback';
    };

    if (
      typeof payoutRequestId !== 'string' ||
      !/^[a-zA-Z0-9_-]{4,128}$/.test(payoutRequestId) ||
      (provider !== 'airtel_money' && provider !== 'moov_money')
    ) {
      res.status(400).json({ error: 'Demande de retrait ou opérateur Mobile Money invalide.' });
      return;
    }

    const intAmount = Math.round(Number(amountXaf));
    if (!Number.isFinite(intAmount) || intAmount < 100 || intAmount > 50000000) {
      res.status(400).json({
        error: 'Le montant SHAP doit être un entier compris entre 100 XAF et 50 000 000 XAF.',
      });
      return;
    }

    const cfg = getShapConfig();
    if (!cfg.configured) {
      res.status(501).json({
        error: 'PROVIDER_NOT_CONFIGURED',
        provider,
        missingEnvVars: cfg.missingEnvVars,
        message: `SHAP non configuré (${cfg.missingEnvVars.join(', ')}). Configurez ces secrets côté serveur ou utilisez le paiement manuel vérifié.`,
      });
      return;
    }

    const savedDest = getPayoutDestination(payoutRequestId);
    const rawPhone = payeeMsisdnOverride?.trim() || savedDest?.msisdn || '';
    const msisdn = normalizeGabonMsisdn(rawPhone);
    if (!msisdn) {
      res.status(400).json({
        error: 'MISSING_OR_INVALID_MSISDN',
        message:
          'Numéro bénéficiaire complet manquant ou invalide. Saisissez le numéro Mobile Money gabonais (ex. 074XXXXXX) pour exécuter le virement SHAP.',
      });
      return;
    }

    try {
      const record = await executeShapPayout({
        payoutRequestId,
        provider,
        msisdn,
        amountXaf: intAmount,
        payoutType:
          payoutType && ['withdrawal', 'refund', 'cashback'].includes(payoutType) ? payoutType : 'withdrawal',
      });
      res.status(record.status === 'pending' ? 202 : 200).json({ record });
    } catch (err) {
      res.status(502).json({
        error: 'SHAP_PAYOUT_FAILED',
        message: err instanceof Error ? err.message : 'Erreur lors du décaissement SHAP.',
      });
    }
  });

  app.post('/api/payments/shap/reconcile', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const callerRole = await getCallerRoleViaFirestoreRest(
      req.user!.uid,
      req.user!.email,
      req.user!.email_verified,
      req.idToken!
    );
    if (callerRole !== 'admin') {
      res.status(403).json({ error: 'Accès réservé à l’administrateur principal.' });
      return;
    }
    const { payoutRequestId, payeeMsisdnOverride } = req.body as {
      payoutRequestId?: string;
      payeeMsisdnOverride?: string;
    };
    if (typeof payoutRequestId !== 'string' || !/^[a-zA-Z0-9_-]{4,128}$/.test(payoutRequestId)) {
      res.status(400).json({ error: 'Identifiant de retrait invalide.' });
      return;
    }
    try {
      const record = await reconcileShapPayout({
        payoutRequestId,
        msisdnOverride: payeeMsisdnOverride,
      });
      res.json({ record });
    } catch (err) {
      res.status(400).json({
        error: 'SHAP_RECONCILE_ERROR',
        message: err instanceof Error ? err.message : 'Impossible de réconcilier ce décaissement.',
      });
    }
  });

  // 3b. E-Billing Collection Service (eBills + Portal URL + optional USSD Push v2 + Enquiry + Transactions)
  app.post('/api/ebilling/checkout', async (req: AuthenticatedRequest, res: Response) => {
    const ip = req.ip || 'unknown';
    if (!allowEbillingCheckout(ip)) {
      res.status(429).json({
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Trop de tentatives de paiement en peu de temps. Merci de patienter quelques minutes.',
      });
      return;
    }

    const optionalAuth = await decodeOptionalUser(req);
    const { amountXaf, payerName, payerMsisdn, payerEmail, purpose, shortDescription, provider, triggerUssdPush } =
      req.body as {
        amountXaf?: number;
        payerName?: string;
        payerMsisdn?: string;
        payerEmail?: string;
        purpose?: string;
        shortDescription?: string;
        provider?: 'airtel_money' | 'moov_money';
        triggerUssdPush?: boolean;
      };

    const intAmount = Math.round(Number(amountXaf));
    const msisdn = normalizeGabonMsisdn(payerMsisdn || '');
    const emailCandidate = typeof payerEmail === 'string' ? payerEmail.trim() : '';
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailCandidate);

    if (
      !Number.isFinite(intAmount) ||
      intAmount < 100 ||
      intAmount > 50000000 ||
      !msisdn ||
      !emailValid ||
      typeof shortDescription !== 'string' ||
      shortDescription.trim().length < 3
    ) {
      res.status(400).json({
        error: 'INVALID_EBILLING_PARAMS',
        message:
          'Paramètres E-Billing invalides (montant entre 100 et 50 000 000 XAF, numéro gabonais, e-mail valide et libellé requis).',
      });
      return;
    }

    const cfg = getEbillingConfig();
    if (!cfg.configured) {
      res.status(501).json({
        error: 'EBILLING_NOT_CONFIGURED',
        missingEnvVars: cfg.missingEnvVars,
        message: `Service E-Billing en attente de configuration serveur (${cfg.missingEnvVars.join(', ')}).`,
      });
      return;
    }

    const appBaseUrl = resolveAppBaseUrl(req);
    const externalReference = `EBL-${Date.now()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const statusToken = signEbillingStatusToken(externalReference);

    try {
      const record = await createEbillingCheckout({
        amountXaf: intAmount,
        payerName: typeof payerName === 'string' ? payerName.trim() : optionalAuth?.user.name,
        payerMsisdn: msisdn,
        payerEmail: emailCandidate.slice(0, 120),
        purpose: typeof purpose === 'string' ? purpose.trim() : undefined,
        shortDescription: shortDescription.trim(),
        externalReference,
        redirectUrl: `${appBaseUrl}/?paiement=succes&ref=${externalReference}&token=${statusToken}`,
        operator: provider ? toShapPaymentSystem(provider) : undefined,
        triggerUssdPush: Boolean(triggerUssdPush),
        createdByUid: optionalAuth?.user.uid || 'public_supporter',
      });
      res.status(201).json({ record, statusToken });
    } catch (err) {
      res.status(502).json({
        error: 'EBILLING_CHECKOUT_ERROR',
        message: err instanceof Error ? err.message : 'Erreur lors de la création de la facture E-Billing.',
      });
    }
  });

  async function authorizeEbillingAccess(req: AuthenticatedRequest, reference: string): Promise<boolean> {
    const tokenParam =
      typeof req.query.token === 'string'
        ? req.query.token
        : typeof req.headers['x-status-token'] === 'string'
          ? req.headers['x-status-token']
          : undefined;

    if (verifyEbillingStatusToken(reference, tokenParam)) {
      return true;
    }

    const optionalAuth = await decodeOptionalUser(req);
    if (!optionalAuth) return false;

    const record = getEbillingRecord(reference);
    if (record && record.createdByUid === optionalAuth.user.uid) return true;

    const role = await getCallerRoleViaFirestoreRest(
      optionalAuth.user.uid,
      optionalAuth.user.email,
      optionalAuth.user.email_verified,
      optionalAuth.idToken
    );
    return role === 'admin';
  }

  app.get('/api/ebilling/status/:reference', async (req: AuthenticatedRequest, res: Response) => {
    const ref = req.params.reference;
    if (!/^[a-zA-Z0-9_-]{4,128}$/.test(ref)) {
      res.status(400).json({ error: 'Référence de paiement invalide.' });
      return;
    }
    const record = getEbillingRecord(ref);
    if (!record) {
      res.status(404).json({ error: 'Transaction introuvable.' });
      return;
    }
    const authorized = await authorizeEbillingAccess(req, ref);
    if (!authorized) {
      res.status(403).json({ error: 'Accès non autorisé à cette facture.' });
      return;
    }
    res.json({ record });
  });

  app.post('/api/ebilling/enquiry/:reference', async (req: AuthenticatedRequest, res: Response) => {
    const ref = req.params.reference;
    if (!/^[a-zA-Z0-9_-]{4,128}$/.test(ref)) {
      res.status(400).json({ error: 'Référence de paiement invalide.' });
      return;
    }
    const existing = getEbillingRecord(ref);
    if (!existing) {
      res.status(404).json({ error: 'Transaction introuvable.' });
      return;
    }
    const authorized = await authorizeEbillingAccess(req, ref);
    if (!authorized) {
      res.status(403).json({ error: 'Accès non autorisé à cette facture.' });
      return;
    }
    try {
      const updated = await enquiryEbillingStatus(ref);
      if (updated) syncWalletDepositFromEbilling(updated);
      res.json({ record: updated });
    } catch (err) {
      res.status(502).json({
        error: 'EBILLING_ENQUIRY_ERROR',
        message: err instanceof Error ? err.message : 'Impossible de synchroniser le statut E-Billing.',
      });
    }
  });

  app.get('/api/ebilling/transactions', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const callerRole = await getCallerRoleViaFirestoreRest(
      req.user!.uid,
      req.user!.email,
      req.user!.email_verified,
      req.idToken!
    );
    const records = callerRole === 'admin' ? listEbillingRecords() : listEbillingRecords(req.user!.uid);
    res.json({ records });
  });

  // 3c. Mobile Money User Wallet (Dépôt, Retrait, Compte lié, Historique paginé & Admin)
  app.get('/api/wallet', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const summary = getOrCreateWalletSummary({
      uid: req.user!.uid,
      email: req.user!.email || '',
      displayName: req.user!.name || req.user!.email?.split('@')[0] || 'Contributeur',
    });
    res.json(summary);
  });

  app.post('/api/wallet/link-account', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    if (!req.user?.email_verified) {
      res.status(403).json({ error: 'Adresse e-mail vérifiée requise pour lier un compte Mobile Money.' });
      return;
    }
    const { provider, rawPhone } = req.body as {
      provider?: 'airtel_money' | 'moov_money';
      rawPhone?: string;
    };
    if ((provider !== 'airtel_money' && provider !== 'moov_money') || typeof rawPhone !== 'string') {
      res.status(400).json({ error: 'Opérateur ou numéro Mobile Money invalide.' });
      return;
    }
    try {
      const account = linkMobileMoneyAccount({
        uid: req.user.uid,
        email: req.user.email || '',
        displayName: req.user.name || req.user.email?.split('@')[0] || 'Contributeur',
        provider,
        rawPhone,
      });
      res.json({ account });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Numéro Mobile Money invalide.' });
    }
  });

  app.post('/api/wallet/deposit', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user?.email_verified) {
      res.status(403).json({ error: 'Adresse e-mail vérifiée requise pour effectuer un dépôt.' });
      return;
    }
    if (!allowWalletAction(`${req.user.uid}:${req.ip}`)) {
      res.status(429).json({ error: 'Trop de requêtes financières en peu de temps. Patientez quelques instants.' });
      return;
    }
    const { provider, rawPhone, amountXaf, mode, idempotencyKey } = req.body as {
      provider?: 'airtel_money' | 'moov_money';
      rawPhone?: string;
      amountXaf?: number;
      mode?: 'portal' | 'ussd';
      idempotencyKey?: string;
    };
    if (provider !== 'airtel_money' && provider !== 'moov_money') {
      res.status(400).json({ error: 'Sélectionnez Airtel Money ou Moov Money.' });
      return;
    }
    try {
      const result = await initiateWalletDeposit({
        uid: req.user.uid,
        email: req.user.email || '',
        displayName: req.user.name || req.user.email?.split('@')[0] || 'Contributeur',
        provider,
        rawPhone,
        amountXaf: Number(amountXaf),
        mode: mode === 'ussd' ? 'ussd' : 'portal',
        idempotencyKey:
          typeof idempotencyKey === 'string'
            ? idempotencyKey
            : typeof req.headers['idempotency-key'] === 'string'
              ? req.headers['idempotency-key']
              : undefined,
        appBaseUrl: resolveAppBaseUrl(req),
      });
      res.status(201).json(result);
    } catch (err) {
      const typed = err as Error & { code?: string; statusCode?: number; missingEnvVars?: string[] };
      res.status(typed.statusCode || 400).json({
        error: typed.code || 'WALLET_DEPOSIT_ERROR',
        missingEnvVars: typed.missingEnvVars,
        message: typed.message || 'Impossible d’initialiser le dépôt Mobile Money.',
      });
    }
  });

  app.post('/api/wallet/deposit/verify/:reference', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const ref = req.params.reference;
    if (!/^[a-zA-Z0-9_-]{4,128}$/.test(ref)) {
      res.status(400).json({ error: 'Référence de dépôt invalide.' });
      return;
    }
    try {
      const callerRole = await getCallerRoleViaFirestoreRest(
        req.user!.uid,
        req.user!.email,
        req.user!.email_verified,
        req.idToken!
      );
      const result = await verifyWalletDepositByReference(ref, req.user!.uid, callerRole === 'admin');
      res.json(result);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Impossible de vérifier ce dépôt.',
      });
    }
  });

  app.post('/api/wallet/withdraw', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user?.email_verified) {
      res.status(403).json({ error: 'Adresse e-mail vérifiée requise pour effectuer un retrait.' });
      return;
    }
    if (!allowWalletAction(`${req.user.uid}:${req.ip}`)) {
      res.status(429).json({ error: 'Trop de requêtes financières en peu de temps. Patientez quelques instants.' });
      return;
    }
    const { provider, rawPhone, amountXaf, idempotencyKey } = req.body as {
      provider?: 'airtel_money' | 'moov_money';
      rawPhone?: string;
      amountXaf?: number;
      idempotencyKey?: string;
    };
    if (provider !== 'airtel_money' && provider !== 'moov_money') {
      res.status(400).json({ error: 'Sélectionnez Airtel Money ou Moov Money.' });
      return;
    }
    try {
      const result = await initiateWalletWithdrawal({
        uid: req.user.uid,
        email: req.user.email || '',
        displayName: req.user.name || req.user.email?.split('@')[0] || 'Contributeur',
        provider,
        rawPhone,
        amountXaf: Number(amountXaf),
        idempotencyKey:
          typeof idempotencyKey === 'string'
            ? idempotencyKey
            : typeof req.headers['idempotency-key'] === 'string'
              ? req.headers['idempotency-key']
              : undefined,
      });
      res.status(201).json(result);
    } catch (err) {
      res.status(400).json({
        error: 'WALLET_WITHDRAWAL_ERROR',
        message: err instanceof Error ? err.message : 'Impossible d’initier le retrait.',
      });
    }
  });

  app.get('/api/wallet/transactions', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const result = listWalletTransactions({
      uid: req.user!.uid,
      type: typeof req.query.type === 'string' ? req.query.type : undefined,
      provider: typeof req.query.provider === 'string' ? req.query.provider : undefined,
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      page: req.query.page ? Number(req.query.page) : 1,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : 10,
    });
    res.json(result);
  });

  app.get('/api/admin/wallet/overview', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const role = await getCallerRoleViaFirestoreRest(
      req.user!.uid,
      req.user!.email,
      req.user!.email_verified,
      req.idToken!
    );
    if (role !== 'admin') {
      res.status(403).json({ error: 'Accès réservé à l’administrateur principal.' });
      return;
    }
    const overview = getAdminWalletOverview({
      type: typeof req.query.type === 'string' ? req.query.type : undefined,
      provider: typeof req.query.provider === 'string' ? req.query.provider : undefined,
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      page: req.query.page ? Number(req.query.page) : 1,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : 15,
    });
    res.json(overview);
  });

  app.post('/api/admin/wallet/withdrawals/:id/decision', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const role = await getCallerRoleViaFirestoreRest(
      req.user!.uid,
      req.user!.email,
      req.user!.email_verified,
      req.idToken!
    );
    if (role !== 'admin') {
      res.status(403).json({ error: 'Accès réservé à l’administrateur principal.' });
      return;
    }
    const txId = req.params.id;
    if (!/^[a-zA-Z0-9_-]{4,128}$/.test(txId)) {
      res.status(400).json({ error: 'Identifiant de transaction invalide.' });
      return;
    }
    const { decision, providerReference, adminNote } = req.body as {
      decision?: 'approve_shap' | 'approve_manual' | 'reject' | 'reconcile_shap';
      providerReference?: string;
      adminNote?: string;
    };
    if (!decision || !['approve_shap', 'approve_manual', 'reject', 'reconcile_shap'].includes(decision)) {
      res.status(400).json({ error: 'Décision administrative invalide.' });
      return;
    }
    try {
      const updated = await adminDecideWalletWithdrawal({
        transactionId: txId,
        decision,
        providerReference,
        adminNote,
        adminUid: req.user!.uid,
        adminEmail: req.user!.email || '',
      });
      res.json({ transaction: updated });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Erreur lors du traitement administratif du retrait.',
      });
    }
  });

  app.get('/api/admin/wallet/export.csv', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const role = await getCallerRoleViaFirestoreRest(
      req.user!.uid,
      req.user!.email,
      req.user!.email_verified,
      req.idToken!
    );
    if (role !== 'admin') {
      res.status(403).json({ error: 'Accès réservé à l’administrateur principal.' });
      return;
    }
    const csv = exportWalletTransactionsCsv({
      type: typeof req.query.type === 'string' ? req.query.type : undefined,
      provider: typeof req.query.provider === 'string' ? req.query.provider : undefined,
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="gabon-patrimoine-transactions-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  });

  // 4. Webhooks Billing Easy (SHAP Payout & E-Billing Callback — /api/ebilling/callback)
  app.post('/api/webhooks/shap/payout', (req: AuthenticatedRequest, res: Response) => {
    const cfg = getShapConfig();
    if (!cfg.webhookSecretConfigured) {
      res.status(503).json({ error: 'SHAP_WEBHOOK_SECRET non configuré.' });
      return;
    }
    const rawBody = req.rawBody ?? JSON.stringify(req.body ?? {});
    if (!verifyWebhookSecretOrHmac(cfg.webhookSecret, rawBody, req.headers)) {
      res.status(401).json({ error: 'Signature webhook SHAP invalide.' });
      return;
    }
    const updated = applyShapWebhookUpdate((req.body || {}) as Record<string, unknown>);
    if (updated) {
      syncWalletWithdrawalFromShap(updated);
    }
    res.status(200).json({ success: true, matched: Boolean(updated) });
  });

  const handleEbillingCallback = (req: AuthenticatedRequest, res: Response) => {
    const cfg = getEbillingConfig();
    if (!cfg.webhookSecretConfigured) {
      res.status(503).json({ error: 'EBILLING_WEBHOOK_SECRET non configuré.' });
      return;
    }
    const rawBody = req.rawBody ?? JSON.stringify(req.body ?? {});
    const bodyObj = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
    const bodySignature =
      typeof bodyObj.signature === 'string'
        ? bodyObj.signature
        : typeof bodyObj.hmac === 'string'
          ? bodyObj.hmac
          : undefined;

    if (!verifyWebhookSecretOrHmac(cfg.webhookSecret, rawBody, req.headers, bodySignature)) {
      res.status(401).json({ error: 'Signature webhook E-Billing invalide.' });
      return;
    }

    const updated = applyEbillingWebhook(bodyObj);
    if (updated) {
      syncWalletDepositFromEbilling(updated);
    }
    res.status(200).json({
      success: true,
      matched: Boolean(updated),
      status: updated?.status || null,
      reference: updated?.externalReference || null,
    });
  };

  app.post('/api/ebilling/callback', handleEbillingCallback);
  app.post('/api/webhooks/ebilling/callback', handleEbillingCallback);

  // 5. Public account creation assistance intake
  app.post('/api/public/assistance', (req, res) => {
    const ip = req.ip || 'unknown';
    if (!allowAssistanceRequest(ip)) {
      res.status(429).json({ error: 'Trop de demandes envoyées. Veuillez patienter quelques minutes.' });
      return;
    }

    const { requesterName, contactInfo, requestedRole, message } = req.body as Partial<PublicAssistanceRecord>;
    if (
      typeof requesterName !== 'string' ||
      requesterName.trim().length < 2 ||
      requesterName.trim().length > 100 ||
      typeof contactInfo !== 'string' ||
      contactInfo.trim().length < 4 ||
      contactInfo.trim().length > 160 ||
      !['citizen', 'student', 'researcher'].includes(String(requestedRole)) ||
      typeof message !== 'string' ||
      message.trim().length < 10 ||
      message.trim().length > 1500
    ) {
      res.status(400).json({
        error: 'Veuillez renseigner un nom, un contact valide, un rôle et une description claire de votre difficulté.',
      });
      return;
    }

    const records = readJsonFile<PublicAssistanceRecord[]>(PUBLIC_ASSISTANCE_PATH, []);
    const nowIso = new Date().toISOString();
    const newRecord: PublicAssistanceRecord = {
      id: `pub_${crypto.randomUUID()}`,
      requesterName: requesterName.trim(),
      contactInfo: contactInfo.trim(),
      requestedRole: requestedRole as 'citizen' | 'student' | 'researcher',
      message: message.trim(),
      status: 'open',
      adminNote: '',
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    records.unshift(newRecord);
    writeJsonAtomic(PUBLIC_ASSISTANCE_PATH, records.slice(0, 500));
    res.status(201).json({ id: newRecord.id, status: newRecord.status });
  });

  app.get('/api/admin/assistance', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const role = await getCallerRoleViaFirestoreRest(
      req.user!.uid,
      req.user!.email,
      req.user!.email_verified,
      req.idToken!
    );
    if (role !== 'admin') {
      res.status(403).json({ error: 'Accès administrateur requis.' });
      return;
    }
    const records = readJsonFile<PublicAssistanceRecord[]>(PUBLIC_ASSISTANCE_PATH, []);
    res.json({ requests: records });
  });

  app.patch('/api/admin/assistance/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const role = await getCallerRoleViaFirestoreRest(
      req.user!.uid,
      req.user!.email,
      req.user!.email_verified,
      req.idToken!
    );
    if (role !== 'admin') {
      res.status(403).json({ error: 'Accès administrateur requis.' });
      return;
    }
    const reqId = req.params.id;
    if (!/^[a-zA-Z0-9_-]{4,128}$/.test(reqId)) {
      res.status(400).json({ error: 'Identifiant de demande invalide.' });
      return;
    }
    const { status, adminNote } = req.body as { status?: string; adminNote?: string };
    if (status && !['open', 'in_progress', 'resolved'].includes(status)) {
      res.status(400).json({ error: 'Statut invalide.' });
      return;
    }
    const records = readJsonFile<PublicAssistanceRecord[]>(PUBLIC_ASSISTANCE_PATH, []);
    const idx = records.findIndex((r) => r.id === reqId);
    if (idx === -1) {
      res.status(404).json({ error: 'Demande introuvable.' });
      return;
    }
    if (status) records[idx].status = status as PublicAssistanceRecord['status'];
    if (typeof adminNote === 'string') records[idx].adminNote = adminNote.slice(0, 1000);
    records[idx].updatedAt = new Date().toISOString();
    writeJsonAtomic(PUBLIC_ASSISTANCE_PATH, records);
    res.json({ request: records[idx] });
  });

  // 6. Secure Media Upload (Server-generated filename, MIME/size check, EXIF strip, private pending access)
  app.post('/api/media/upload', requireAuth, upload.single('file'), (req: AuthenticatedRequest, res: Response) => {
    if (!req.user?.email_verified) {
      res.status(403).json({ error: 'Adresse e-mail vérifiée requise pour téléverser des médias.' });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: 'Aucun fichier reçu.' });
      return;
    }

    const rule = ALLOWED_MIME_TYPES[req.file.mimetype];
    if (!rule) {
      res.status(400).json({
        error: `Type MIME non autorisé (${req.file.mimetype}). Formats acceptés : JPG, PNG, WebP, MP3, WAV, OGG, M4A, MP4, WebM, PDF.`,
      });
      return;
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    if (!rule.extensions.includes(ext)) {
      res.status(400).json({ error: `Extension de fichier incompatible avec le type ${req.file.mimetype}.` });
      return;
    }

    if (req.file.size > rule.maxBytes) {
      res.status(400).json({ error: `Fichier trop volumineux pour la catégorie ${rule.mediaType}.` });
      return;
    }

    let finalBuffer = req.file.buffer;
    let exifStripped = false;
    if (req.file.mimetype === 'image/jpeg') {
      finalBuffer = stripJpegMetadata(req.file.buffer);
      exifStripped = true;
    }

    const assetId = `med_${crypto.randomUUID().replace(/-/g, '')}`;
    const safeStoredFileName = `${assetId}${ext}`;
    const resolvedDest = path.resolve(UPLOAD_DIR, safeStoredFileName);
    if (!resolvedDest.startsWith(UPLOAD_DIR + path.sep)) {
      res.status(400).json({ error: 'Chemin de fichier invalide.' });
      return;
    }

    fs.writeFileSync(resolvedDest, finalBuffer);

    const index = readJsonFile<Record<string, MediaAssetRecord>>(MEDIA_INDEX_PATH, {});
    const record: MediaAssetRecord = {
      id: assetId,
      ownerUid: req.user.uid,
      contributionId: typeof req.body?.contributionId === 'string' ? req.body.contributionId.slice(0, 128) : null,
      status: 'pending',
      mediaType: rule.mediaType,
      mimeType: req.file.mimetype,
      fileSize: finalBuffer.length,
      storedFileName: safeStoredFileName,
      originalExtension: ext,
      exifStripped,
      createdAt: new Date().toISOString(),
    };
    index[assetId] = record;
    writeJsonAtomic(MEDIA_INDEX_PATH, index);

    res.status(201).json({
      id: assetId,
      url: `/api/media/${assetId}`,
      mediaType: record.mediaType,
      mimeType: record.mimeType,
      fileSize: record.fileSize,
      exifStripped: record.exifStripped,
      status: record.status,
    });
  });

  // 7. Sync media publication status (Moderator / Admin only)
  app.patch('/api/media/sync-status', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const role = await getCallerRoleViaFirestoreRest(
      req.user!.uid,
      req.user!.email,
      req.user!.email_verified,
      req.idToken!
    );
    if (!['moderator', 'admin'].includes(role)) {
      res.status(403).json({ error: 'Rôle modérateur ou administrateur requis.' });
      return;
    }

    const { assetIds, status, contributionId } = req.body as {
      assetIds?: string[];
      status?: 'pending' | 'published' | 'rejected';
      contributionId?: string;
    };
    if (!Array.isArray(assetIds) || !status || !['pending', 'published', 'rejected'].includes(status)) {
      res.status(400).json({ error: 'Paramètres de synchronisation invalides.' });
      return;
    }

    const index = readJsonFile<Record<string, MediaAssetRecord>>(MEDIA_INDEX_PATH, {});
    let updatedCount = 0;
    for (const id of assetIds) {
      if (typeof id === 'string' && index[id]) {
        index[id].status = status;
        if (contributionId) index[id].contributionId = contributionId;
        updatedCount += 1;
      }
    }
    writeJsonAtomic(MEDIA_INDEX_PATH, index);
    res.json({ updatedCount });
  });

  // 8. Serve media with private-pending gate
  app.get('/api/media/:assetId', async (req: AuthenticatedRequest, res: Response) => {
    const assetId = req.params.assetId;
    if (!/^[a-zA-Z0-9_-]+$/.test(assetId)) {
      res.status(400).json({ error: 'Identifiant média invalide.' });
      return;
    }

    const index = readJsonFile<Record<string, MediaAssetRecord>>(MEDIA_INDEX_PATH, {});
    const record = index[assetId];
    if (!record) {
      res.status(404).json({ error: 'Média introuvable.' });
      return;
    }

    if (record.status !== 'published') {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(403).json({ error: 'Média en attente de modération : accès privé.' });
        return;
      }
      const token = authHeader.slice('Bearer '.length).trim();
      try {
        const decoded = await getAuth().verifyIdToken(token);
        if (decoded.uid !== record.ownerUid) {
          const role = await getCallerRoleViaFirestoreRest(decoded.uid, decoded.email, decoded.email_verified, token);
          if (!['moderator', 'admin'].includes(role)) {
            res.status(403).json({ error: 'Accès non autorisé à ce média en cours de modération.' });
            return;
          }
        }
      } catch {
        res.status(403).json({ error: 'Jeton invalide pour accéder à un média non publié.' });
        return;
      }
    }

    const resolvedFile = path.resolve(UPLOAD_DIR, record.storedFileName);
    if (!resolvedFile.startsWith(UPLOAD_DIR + path.sep) || !fs.existsSync(resolvedFile)) {
      res.status(404).json({ error: 'Fichier introuvable sur le serveur.' });
      return;
    }

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', record.mimeType);
    res.setHeader('Cache-Control', record.status === 'published' ? 'public, max-age=3600' : 'private, no-store');
    res.sendFile(resolvedFile);
  });

  // Clean JSON 404 for unmatched /api routes & Multer/JSON error handler
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Point de terminaison API introuvable.' });
  });

  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (!req.path.startsWith('/api')) {
      next(err);
      return;
    }
    if (err instanceof multer.MulterError) {
      res.status(400).json({
        error:
          err.code === 'LIMIT_FILE_SIZE'
            ? 'Le fichier dépasse la limite maximale autorisée (40 Mo).'
            : `Erreur de téléversement : ${err.message}`,
      });
      return;
    }
    res.status(400).json({
      error: err instanceof Error ? err.message : 'Requête API invalide.',
    });
  });

  // Vite middleware in dev / static dist in prod
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Gabon Patrimoine server listening on http://localhost:${PORT}`);
  });
}

startServer();
