import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export type GabonMobileProvider = 'airtel_money' | 'moov_money';
export type ShapPaymentSystem = 'airtelmoney' | 'moovmoney';

export interface ProviderStatus {
  id: GabonMobileProvider;
  label: string;
  configured: boolean;
  gateway: 'shap' | 'direct' | 'none';
  mode: 'live_api' | 'manual_review_only';
  missingEnvVars: string[];
  notice: string;
}

export interface GatewayArchitectureStatus {
  shap: {
    configured: boolean;
    baseUrl: string;
    webhookSecretConfigured: boolean;
    callbackUrl: string;
    missingEnvVars: string[];
  };
  ebilling: {
    configured: boolean;
    baseUrl: string;
    portalUrl: string;
    webhookSecretConfigured: boolean;
    callbackUrl: string;
    legacyCallbackUrl: string;
    missingEnvVars: string[];
  };
}

export interface PayoutDestinationRecord {
  payoutRequestId: string;
  beneficiaryUid: string;
  provider: GabonMobileProvider;
  msisdn: string;
  updatedAt: string;
}

export interface ShapPayoutLedgerRecord {
  externalReference: string;
  payoutRequestId: string;
  provider: GabonMobileProvider;
  paymentSystemName: ShapPaymentSystem;
  msisdnMasked: string;
  amountXaf: number;
  payoutId: string | null;
  status: 'pending' | 'success' | 'failed';
  rawState: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EbillingWebhookEventLog {
  receivedAt: string;
  state: string;
  operator?: string;
  transactionId?: string;
  signatureVerified: boolean;
}

export interface EbillingRecord {
  externalReference: string;
  billId: string;
  ussdPushId?: string | number | null;
  amountXaf: number;
  payerName?: string;
  payerEmail: string;
  payerMsisdnMasked: string;
  purpose?: string;
  shortDescription: string;
  paymentUrl: string;
  status: 'pending' | 'paid' | 'failed' | 'expired';
  operator?: string;
  providerTransactionId?: string;
  paidAt?: string | null;
  webhookEvents?: EbillingWebhookEventLog[];
  createdByUid: string;
  createdAt: string;
  updatedAt: string;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const PAYOUT_DEST_PATH = path.resolve(DATA_DIR, 'payout-destinations.json');
const SHAP_LEDGER_PATH = path.resolve(DATA_DIR, 'shap-payouts.json');
const EBILLING_LEDGER_PATH = path.resolve(DATA_DIR, 'ebilling-invoices.json');

fs.mkdirSync(DATA_DIR, { recursive: true });

// Runtime ephemeral HMAC key fallback for public status-check tokens (never hardcoded)
const STATUS_TOKEN_SECRET =
  (process.env.EBILLING_STATUS_TOKEN_SECRET || process.env.EBILLING_WEBHOOK_SECRET || '').trim() ||
  crypto.randomBytes(32).toString('hex');

function readJson<T>(filePath: string, fallback: T): T {
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

function isAllowedBillingEasyUrl(rawUrl: string, allowCognito = false): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (host === 'billing-easy.net' || host.endsWith('.billing-easy.net')) return true;
    if (allowCognito && host.endsWith('.amazoncognito.com')) return true;
    return false;
  } catch {
    return false;
  }
}

function sanitizeGatewayBaseUrl(raw: string | undefined, fallback: string, allowCognito = false): string {
  const candidate = (raw || '').trim().replace(/\/+$/, '');
  if (candidate && isAllowedBillingEasyUrl(candidate, allowCognito)) {
    return candidate;
  }
  return fallback;
}

export function normalizeGabonMsisdn(rawPhone: string): string | null {
  const digits = rawPhone.replace(/\D/g, '');
  let local = digits;
  if (local.startsWith('00241')) {
    local = local.slice(5);
  } else if (local.startsWith('241') && local.length >= 11) {
    local = local.slice(3);
  }
  if (local.length === 8 && /^[567]\d{7}$/.test(local)) {
    local = `0${local}`;
  }
  if (!/^0[567]\d{7}$/.test(local)) {
    return null;
  }
  return local;
}

export function detectGabonOperatorFromMsisdn(msisdn: string): GabonMobileProvider | null {
  if (/^07[467]\d{6}$/.test(msisdn)) return 'airtel_money';
  if (/^06[0256]\d{6}$/.test(msisdn)) return 'moov_money';
  return null;
}

export function validateGabonOperatorMsisdn(
  rawPhone: string,
  expectedProvider?: GabonMobileProvider
): {
  valid: boolean;
  msisdn: string | null;
  detectedProvider: GabonMobileProvider | null;
  error?: string;
} {
  const msisdn = normalizeGabonMsisdn(rawPhone);
  if (!msisdn) {
    return {
      valid: false,
      msisdn: null,
      detectedProvider: null,
      error:
        'Numéro gabonais invalide. Saisissez 9 chiffres locaux ou l’indicatif +241 (ex. +241 074 12 34 56 ou 062 12 34 56).',
    };
  }
  const detected = detectGabonOperatorFromMsisdn(msisdn);
  if (!detected) {
    return {
      valid: false,
      msisdn,
      detectedProvider: null,
      error:
        'Préfixe non reconnu pour Mobile Money Gabon. Utilisez 074 / 076 / 077 pour Airtel Money ou 060 / 062 / 065 / 066 pour Moov Money.',
    };
  }
  if (expectedProvider && detected !== expectedProvider) {
    const expectedLabel = expectedProvider === 'airtel_money' ? 'Airtel Money (074, 076, 077)' : 'Moov Money (060, 062, 065, 066)';
    return {
      valid: false,
      msisdn,
      detectedProvider: detected,
      error: `Le numéro ${msisdn} ne correspond pas à l’opérateur sélectionné (${expectedLabel}).`,
    };
  }
  return { valid: true, msisdn, detectedProvider: detected };
}

export function maskGabonMsisdn(msisdn: string): string {
  const tail = msisdn.slice(-4) || '0000';
  const prefix = msisdn.slice(0, 3) || '0XX';
  return `+241 ${prefix} ** ${tail}`;
}

export function toShapPaymentSystem(provider: GabonMobileProvider): ShapPaymentSystem {
  return provider === 'airtel_money' ? 'airtelmoney' : 'moovmoney';
}

export function signEbillingStatusToken(externalReference: string): string {
  return crypto
    .createHmac('sha256', STATUS_TOKEN_SECRET)
    .update(`ebill_status:${externalReference}`)
    .digest('hex');
}

export function verifyEbillingStatusToken(externalReference: string, token: string | undefined): boolean {
  if (!token || !/^[a-f0-9]{64}$/i.test(token.trim())) return false;
  const expected = signEbillingStatusToken(externalReference);
  const a = Buffer.from(expected, 'utf-8');
  const b = Buffer.from(token.trim().toLowerCase(), 'utf-8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function getShapConfig(appBaseUrl = '') {
  const apiId = (process.env.SHAP_API_ID || '').trim();
  const apiSecret = (process.env.SHAP_API_SECRET || '').trim();
  const baseUrl = sanitizeGatewayBaseUrl(
    process.env.SHAP_BASE_URL,
    'https://test.billing-easy.net/shap/api/v1'
  );
  const webhookSecret = (process.env.SHAP_WEBHOOK_SECRET || '').trim();

  const missing: string[] = [];
  if (!apiId) missing.push('SHAP_API_ID');
  if (!apiSecret) missing.push('SHAP_API_SECRET');

  const cleanAppUrl = appBaseUrl.replace(/\/+$/, '');
  return {
    configured: missing.length === 0,
    apiId,
    apiSecret,
    baseUrl,
    webhookSecret,
    webhookSecretConfigured: webhookSecret.length > 0,
    callbackUrl: cleanAppUrl ? `${cleanAppUrl}/api/webhooks/shap/payout` : '/api/webhooks/shap/payout',
    missingEnvVars: missing,
  };
}

export function getEbillingConfig(appBaseUrl = '') {
  const baseUrl = sanitizeGatewayBaseUrl(
    process.env.EBILLING_BASE_URL,
    'https://lab.billing-easy.net'
  );
  const portalUrl = sanitizeGatewayBaseUrl(
    process.env.EBILLING_PORTAL_URL,
    'https://test.billing-easy.net'
  );
  const clientId = (process.env.EBILLING_CLIENT_ID || '').trim();
  const clientSecret = (process.env.EBILLING_CLIENT_SECRET || '').trim();
  const tokenUrl = sanitizeGatewayBaseUrl(process.env.EBILLING_TOKEN_URL, '', true);
  const username = (process.env.EBILLING_USERNAME || '').trim();
  const sharedKey = (process.env.EBILLING_SHARED_KEY || '').trim();
  const webhookSecret = (process.env.EBILLING_WEBHOOK_SECRET || '').trim();

  const hasOauth2 = Boolean(clientId && clientSecret && tokenUrl);
  const hasBasic = Boolean(username && sharedKey);

  const missing: string[] = [];
  if (!hasOauth2 && !hasBasic) {
    missing.push('EBILLING_CLIENT_ID', 'EBILLING_CLIENT_SECRET', 'EBILLING_TOKEN_URL (ou EBILLING_USERNAME + EBILLING_SHARED_KEY)');
  }

  const cleanAppUrl = appBaseUrl.replace(/\/+$/, '');
  return {
    configured: hasOauth2 || hasBasic,
    authMode: hasOauth2 ? ('oauth2' as const) : hasBasic ? ('basic' as const) : ('none' as const),
    baseUrl,
    portalUrl,
    clientId,
    clientSecret,
    tokenUrl,
    username,
    sharedKey,
    webhookSecret,
    webhookSecretConfigured: webhookSecret.length > 0,
    callbackUrl: cleanAppUrl ? `${cleanAppUrl}/api/ebilling/callback` : '/api/ebilling/callback',
    legacyCallbackUrl: cleanAppUrl ? `${cleanAppUrl}/api/webhooks/ebilling/callback` : '/api/webhooks/ebilling/callback',
    missingEnvVars: missing,
  };
}

export function getGatewayArchitectureStatus(appBaseUrl = ''): GatewayArchitectureStatus {
  const shap = getShapConfig(appBaseUrl);
  const ebilling = getEbillingConfig(appBaseUrl);
  return {
    shap: {
      configured: shap.configured,
      baseUrl: shap.baseUrl,
      webhookSecretConfigured: shap.webhookSecretConfigured,
      callbackUrl: shap.callbackUrl,
      missingEnvVars: shap.missingEnvVars,
    },
    ebilling: {
      configured: ebilling.configured,
      baseUrl: ebilling.baseUrl,
      portalUrl: ebilling.portalUrl,
      webhookSecretConfigured: ebilling.webhookSecretConfigured,
      callbackUrl: ebilling.callbackUrl,
      legacyCallbackUrl: ebilling.legacyCallbackUrl,
      missingEnvVars: ebilling.missingEnvVars,
    },
  };
}

export function getProviderStatuses(): ProviderStatus[] {
  const shap = getShapConfig();
  const airtelDirect =
    Boolean(process.env.AIRTEL_MONEY_CLIENT_ID) &&
    Boolean(process.env.AIRTEL_MONEY_CLIENT_SECRET) &&
    Boolean(process.env.AIRTEL_MONEY_WEBHOOK_SECRET);
  const moovDirect =
    Boolean(process.env.MOOV_MONEY_MERCHANT_ID) &&
    Boolean(process.env.MOOV_MONEY_API_KEY) &&
    Boolean(process.env.MOOV_MONEY_WEBHOOK_SECRET);

  const airtelConfigured = shap.configured || airtelDirect;
  const moovConfigured = shap.configured || moovDirect;

  return [
    {
      id: 'airtel_money',
      label: 'Airtel Money Gabon',
      configured: airtelConfigured,
      gateway: shap.configured ? 'shap' : airtelDirect ? 'direct' : 'none',
      mode: airtelConfigured ? 'live_api' : 'manual_review_only',
      missingEnvVars: airtelConfigured ? [] : ['SHAP_API_ID', 'SHAP_API_SECRET'],
      notice: shap.configured
        ? 'Passerelle SHAP Billing Easy active pour les virements automatiques Airtel Money.'
        : airtelDirect
          ? 'API directe Airtel Money configurée.'
          : 'Prestataire en attente de configuration serveur (SHAP_API_ID et SHAP_API_SECRET). La validation manuelle reste disponible.',
    },
    {
      id: 'moov_money',
      label: 'Moov Money Gabon',
      configured: moovConfigured,
      gateway: shap.configured ? 'shap' : moovDirect ? 'direct' : 'none',
      mode: moovConfigured ? 'live_api' : 'manual_review_only',
      missingEnvVars: moovConfigured ? [] : ['SHAP_API_ID', 'SHAP_API_SECRET'],
      notice: shap.configured
        ? 'Passerelle SHAP Billing Easy active pour les virements automatiques Moov Money.'
        : moovDirect
          ? 'API directe Moov Money configurée.'
          : 'Prestataire en attente de configuration serveur (SHAP_API_ID et SHAP_API_SECRET). La validation manuelle reste disponible.',
    },
  ];
}

// ============================================================================
// IN-MEMORY OAUTH2 TOKEN CACHES (SHAP 7200s & E-Billing Cognito)
// ============================================================================
let shapTokenCache: { token: string; expiresAt: number } | null = null;
let ebillingTokenCache: { token: string; expiresAt: number } | null = null;

export async function getShapAccessToken(): Promise<string> {
  const cfg = getShapConfig();
  if (!cfg.configured) {
    throw new Error(`SHAP non configuré (${cfg.missingEnvVars.join(', ')})`);
  }
  if (shapTokenCache && shapTokenCache.expiresAt > Date.now() + 60_000) {
    return shapTokenCache.token;
  }

  const res = await fetch(`${cfg.baseUrl}/merchant/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ api_id: cfg.apiId, api_secret: cfg.apiSecret }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    message?: string;
    error?: string;
  };

  if (!res.ok || !data.access_token) {
    throw new Error(data.message || data.error || `Échec d’authentification SHAP (HTTP ${res.status}).`);
  }

  const expiresInSec = typeof data.expires_in === 'number' && data.expires_in > 120 ? data.expires_in : 7200;
  shapTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + expiresInSec * 1000,
  };
  return data.access_token;
}

export async function getShapBalances(): Promise<unknown> {
  const cfg = getShapConfig();
  const token = await getShapAccessToken();
  const res = await fetch(`${cfg.baseUrl}/merchant/balance`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data as { message?: string; error?: string }).message ||
        `Impossible de consulter les soldes SHAP (HTTP ${res.status}).`
    );
  }
  return data;
}

// ============================================================================
// SERVER-SIDE PAYOUT DESTINATIONS (PII isolated & ownership-checked)
// ============================================================================
export function savePayoutDestination(record: PayoutDestinationRecord): void {
  const all = readJson<Record<string, PayoutDestinationRecord>>(PAYOUT_DEST_PATH, {});
  const existing = all[record.payoutRequestId];
  if (existing && existing.beneficiaryUid !== record.beneficiaryUid) {
    throw new Error('Action refusée : identifiant de retrait déjà associé à un autre bénéficiaire.');
  }
  all[record.payoutRequestId] = record;
  writeJsonAtomic(PAYOUT_DEST_PATH, all);
}

export function getPayoutDestination(payoutRequestId: string): PayoutDestinationRecord | null {
  const all = readJson<Record<string, PayoutDestinationRecord>>(PAYOUT_DEST_PATH, {});
  return all[payoutRequestId] || null;
}

export function getShapLedgerRecord(externalReference: string): ShapPayoutLedgerRecord | null {
  const all = readJson<Record<string, ShapPayoutLedgerRecord>>(SHAP_LEDGER_PATH, {});
  return all[externalReference] || null;
}

export function listShapLedgerRecords(): ShapPayoutLedgerRecord[] {
  const all = readJson<Record<string, ShapPayoutLedgerRecord>>(SHAP_LEDGER_PATH, {});
  return Object.values(all).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function saveShapLedgerRecord(rec: ShapPayoutLedgerRecord): void {
  const all = readJson<Record<string, ShapPayoutLedgerRecord>>(SHAP_LEDGER_PATH, {});
  all[rec.externalReference] = rec;
  writeJsonAtomic(SHAP_LEDGER_PATH, all);
}

export async function executeShapPayout(params: {
  payoutRequestId: string;
  provider: GabonMobileProvider;
  msisdn: string;
  amountXaf: number;
  payoutType?: 'withdrawal' | 'refund' | 'cashback';
}): Promise<ShapPayoutLedgerRecord> {
  const externalReference = `GP-${params.payoutRequestId}`;
  const existing = getShapLedgerRecord(externalReference);
  if (existing && existing.status === 'success') {
    return existing;
  }

  const cfg = getShapConfig();
  const token = await getShapAccessToken();
  const paymentSystemName = toShapPaymentSystem(params.provider);

  const res = await fetch(`${cfg.baseUrl}/merchant/payout`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      payment_system_name: paymentSystemName,
      payout: {
        payee_msisdn: params.msisdn,
        amount: Math.round(params.amountXaf),
        external_reference: externalReference,
        payout_type: params.payoutType || 'withdrawal',
      },
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    successful?: string;
    error_code?: string;
    code?: string;
    message?: string;
    response?: {
      payoutid?: string;
      payout_id?: string;
      state?: string;
      status?: string;
      message?: string;
    };
  };

  const errorCode = data.error_code || data.code || '';
  if (errorCode === 'SP0016' || JSON.stringify(data).includes('SP0016')) {
    throw new Error('Solde SHAP insuffisant (code SP0016). Approvisionnez votre portefeuille marchand SHAP avant de relancer.');
  }

  const rawState = String(
    data.response?.state || data.response?.status || (res.ok ? 'pending' : 'failed')
  ).toLowerCase();
  const payoutId = data.response?.payoutid || data.response?.payout_id || null;

  let status: ShapPayoutLedgerRecord['status'] = 'pending';
  if (!res.ok || ['failed', 'error', 'rejected', 'cancelled'].includes(rawState)) {
    status = 'failed';
  } else if (
    rawState === 'success' ||
    rawState === 'completed' ||
    rawState === 'paid' ||
    (data.successful === 'transactioncompleted' && rawState !== 'pending')
  ) {
    status = 'success';
  }

  const nowIso = new Date().toISOString();
  const record: ShapPayoutLedgerRecord = {
    externalReference,
    payoutRequestId: params.payoutRequestId,
    provider: params.provider,
    paymentSystemName,
    msisdnMasked: maskGabonMsisdn(params.msisdn),
    amountXaf: Math.round(params.amountXaf),
    payoutId,
    status,
    rawState,
    errorMessage:
      status === 'failed'
        ? data.message || data.response?.message || `Échec SHAP (HTTP ${res.status}).`
        : undefined,
    createdAt: existing?.createdAt || nowIso,
    updatedAt: nowIso,
  };
  saveShapLedgerRecord(record);

  if (status === 'failed') {
    throw new Error(record.errorMessage || 'Le décaissement SHAP a été refusé.');
  }

  return record;
}

export async function reconcileShapPayout(params: {
  payoutRequestId: string;
  msisdnOverride?: string;
}): Promise<ShapPayoutLedgerRecord> {
  const externalReference = `GP-${params.payoutRequestId}`;
  const existing = getShapLedgerRecord(externalReference);
  if (existing && (existing.status === 'success' || existing.status === 'failed')) {
    return existing;
  }

  const cfg = getShapConfig();
  if (!cfg.configured) {
    if (existing) return existing;
    throw new Error(`SHAP non configuré (${cfg.missingEnvVars.join(', ')}).`);
  }

  const dest = getPayoutDestination(params.payoutRequestId);
  const msisdn = params.msisdnOverride ? normalizeGabonMsisdn(params.msisdnOverride) : dest?.msisdn;
  if (!msisdn) {
    if (existing) return existing;
    throw new Error('Numéro bénéficiaire introuvable pour interroger SHAP.');
  }

  const token = await getShapAccessToken();
  const qs = new URLSearchParams({
    payee_msisdn: msisdn,
    external_reference: externalReference,
  });
  const res = await fetch(`${cfg.baseUrl}/merchant/payout?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  const data = (await res.json().catch(() => ({}))) as {
    response?: { payoutid?: string; payout_id?: string; state?: string; status?: string };
    state?: string;
    status?: string;
    message?: string;
  };

  if (!res.ok) {
    if (existing) return existing;
    throw new Error(data.message || `Erreur lors de la réconciliation SHAP (HTTP ${res.status}).`);
  }

  const rawState = String(
    data.response?.state || data.response?.status || data.state || data.status || existing?.rawState || 'pending'
  ).toLowerCase();
  const payoutId = data.response?.payoutid || data.response?.payout_id || existing?.payoutId || null;

  let status: ShapPayoutLedgerRecord['status'] = 'pending';
  if (['success', 'completed', 'paid'].includes(rawState)) status = 'success';
  else if (['failed', 'error', 'rejected', 'cancelled'].includes(rawState)) status = 'failed';

  const nowIso = new Date().toISOString();
  const updated: ShapPayoutLedgerRecord = {
    externalReference,
    payoutRequestId: params.payoutRequestId,
    provider: existing?.provider || dest?.provider || 'airtel_money',
    paymentSystemName: existing?.paymentSystemName || 'airtelmoney',
    msisdnMasked: existing?.msisdnMasked || maskGabonMsisdn(msisdn),
    amountXaf: existing?.amountXaf || 0,
    payoutId,
    status,
    rawState,
    createdAt: existing?.createdAt || nowIso,
    updatedAt: nowIso,
  };
  saveShapLedgerRecord(updated);
  return updated;
}

// ============================================================================
// WEBHOOK SIGNATURE / TOKEN VERIFICATION (Timing-safe HMAC-SHA256 & Secret)
// ============================================================================
function timingSafeMatch(expected: string, candidate: string): boolean {
  const a = Buffer.from(expected, 'utf-8');
  const b = Buffer.from(candidate, 'utf-8');
  return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function verifyWebhookSecretOrHmac(
  secret: string,
  rawBody: string,
  headers: Record<string, string | string[] | undefined>,
  bodySignatureField?: string
): boolean {
  if (!secret) return false;
  const sigHeader = String(
    headers['x-shap-signature'] ||
      headers['x-ebilling-signature'] ||
      headers['x-billing-signature'] ||
      headers['x-provider-signature'] ||
      headers['x-signature'] ||
      bodySignatureField ||
      ''
  ).trim();
  const tokenHeader = String(
    headers['x-webhook-secret'] ||
      headers['x-api-key'] ||
      headers['authorization']?.toString().replace(/^Bearer\s+/i, '') ||
      ''
  ).trim();

  if (sigHeader) {
    const cleanSig = sigHeader.replace(/^sha256=/i, '');
    const expectedHex = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const expectedB64 = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
    if (timingSafeMatch(expectedHex, cleanSig.toLowerCase()) || timingSafeMatch(expectedB64, cleanSig)) {
      return true;
    }
  }

  if (tokenHeader && timingSafeMatch(secret, tokenHeader)) {
    return true;
  }
  return false;
}

export function applyShapWebhookUpdate(payload: Record<string, unknown>): ShapPayoutLedgerRecord | null {
  const externalRef = String(payload.external_reference || payload.reference || '').trim();
  const payoutId = String(payload.payoutid || payload.payout_id || '').trim();
  const rawState = String(payload.state || payload.status || '').toLowerCase();

  const all = readJson<Record<string, ShapPayoutLedgerRecord>>(SHAP_LEDGER_PATH, {});
  const target =
    (externalRef && all[externalRef]) ||
    Object.values(all).find((r) => payoutId && r.payoutId === payoutId) ||
    null;

  if (!target) return null;

  if (['success', 'completed', 'paid'].includes(rawState)) target.status = 'success';
  else if (['failed', 'error', 'rejected', 'cancelled'].includes(rawState)) target.status = 'failed';
  if (payoutId) target.payoutId = payoutId;
  if (rawState) target.rawState = rawState;
  target.updatedAt = new Date().toISOString();

  all[target.externalReference] = target;
  writeJsonAtomic(SHAP_LEDGER_PATH, all);
  return target;
}

// ============================================================================
// E-BILLING COLLECTION SERVICE (eBills, Hosted Portal, USSD Push v2, Callback)
// ============================================================================
async function getEbillingAuthHeader(): Promise<string> {
  const cfg = getEbillingConfig();
  if (!cfg.configured) {
    throw new Error(`E-Billing non configuré (${cfg.missingEnvVars.join(', ')})`);
  }
  if (cfg.authMode === 'basic') {
    const basic = Buffer.from(`${cfg.username}:${cfg.sharedKey}`).toString('base64');
    return `Basic ${basic}`;
  }
  if (ebillingTokenCache && ebillingTokenCache.expiresAt > Date.now() + 60_000) {
    return `Bearer ${ebillingTokenCache.token}`;
  }
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
  });
  const res = await fetch(cfg.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: body.toString(),
  });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number };
  if (!res.ok || !data.access_token) {
    throw new Error(`Échec d’authentification E-Billing OAuth2 (HTTP ${res.status}).`);
  }
  const expiresIn = typeof data.expires_in === 'number' && data.expires_in > 120 ? data.expires_in : 3600;
  ebillingTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + expiresIn * 1000,
  };
  return `Bearer ${data.access_token}`;
}

export async function createEbillingCheckout(params: {
  amountXaf: number;
  payerName?: string;
  payerMsisdn: string;
  payerEmail: string;
  purpose?: string;
  shortDescription: string;
  externalReference: string;
  redirectUrl: string;
  operator?: ShapPaymentSystem;
  triggerUssdPush?: boolean;
  createdByUid: string;
}): Promise<EbillingRecord> {
  const cfg = getEbillingConfig();
  const authHeader = await getEbillingAuthHeader();

  const res = await fetch(`${cfg.baseUrl}/api/v1/merchant/ebills`, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      amount: Math.round(params.amountXaf),
      payer_msisdn: params.payerMsisdn,
      payer_email: params.payerEmail,
      payer_name: params.payerName?.slice(0, 100) || undefined,
      short_description: params.shortDescription.slice(0, 140),
      external_reference: params.externalReference,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    bill_id?: string;
    ebill?: { bill_id?: string };
    message?: string;
  };
  const billId = data.bill_id || data.ebill?.bill_id;
  if (!res.ok || !billId) {
    throw new Error(data.message || `Échec création facture E-Billing (HTTP ${res.status}).`);
  }

  let ussdPushId: string | number | null = null;
  if (params.triggerUssdPush && params.operator) {
    const pushRes = await fetch(`${cfg.baseUrl}/api/v2/merchant/e_bills/${encodeURIComponent(billId)}/ussd_push`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        payer_msisdn: params.payerMsisdn,
        payment_system_name: params.operator,
      }),
    });
    const pushData = (await pushRes.json().catch(() => ({}))) as {
      ussd_push?: { id?: string | number };
    };
    if (pushRes.ok && pushData.ussd_push?.id !== undefined) {
      ussdPushId = pushData.ussd_push.id;
    }
  }

  const portalQuery = new URLSearchParams({
    invoice: billId,
    redirect_url: params.redirectUrl,
  });
  if (params.operator) portalQuery.set('operator', params.operator);

  const nowIso = new Date().toISOString();
  const record: EbillingRecord = {
    externalReference: params.externalReference,
    billId,
    ussdPushId,
    amountXaf: Math.round(params.amountXaf),
    payerName: params.payerName?.trim().slice(0, 100) || undefined,
    payerEmail: params.payerEmail,
    payerMsisdnMasked: maskGabonMsisdn(params.payerMsisdn),
    purpose: params.purpose?.trim().slice(0, 80) || 'Soutien patrimonial',
    shortDescription: params.shortDescription,
    paymentUrl: `${cfg.portalUrl}?${portalQuery.toString()}`,
    status: 'pending',
    operator: params.operator,
    paidAt: null,
    webhookEvents: [],
    createdByUid: params.createdByUid,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const all = readJson<Record<string, EbillingRecord>>(EBILLING_LEDGER_PATH, {});
  all[record.externalReference] = record;
  writeJsonAtomic(EBILLING_LEDGER_PATH, all);
  return record;
}

export function getEbillingRecord(reference: string): EbillingRecord | null {
  const all = readJson<Record<string, EbillingRecord>>(EBILLING_LEDGER_PATH, {});
  return all[reference] || null;
}

export function listEbillingRecords(filterUid?: string): EbillingRecord[] {
  const all = readJson<Record<string, EbillingRecord>>(EBILLING_LEDGER_PATH, {});
  return Object.values(all)
    .filter((r) => !filterUid || r.createdByUid === filterUid)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function enquiryEbillingStatus(reference: string): Promise<EbillingRecord | null> {
  const all = readJson<Record<string, EbillingRecord>>(EBILLING_LEDGER_PATH, {});
  const target = all[reference] || null;
  if (!target) return null;
  if (target.status === 'paid' || target.status === 'failed') return target;

  const cfg = getEbillingConfig();
  if (!cfg.configured) return target;

  const authHeader = await getEbillingAuthHeader();
  const res = await fetch(`${cfg.baseUrl}/api/v1/merchant/e_bills/${encodeURIComponent(target.billId)}`, {
    headers: { Authorization: authHeader, Accept: 'application/json' },
  });
  const data = (await res.json().catch(() => ({}))) as {
    state?: string;
    status?: string;
    payment_system_name?: string;
    paymentsystem?: string;
    transaction_id?: string;
    transactionid?: string;
    ebill?: { state?: string; status?: string };
  };
  if (!res.ok) return target;

  const rawState = String(
    data.state || data.status || data.ebill?.state || data.ebill?.status || ''
  ).toLowerCase();
  if (['paid', 'processed', 'success', '2'].includes(rawState)) {
    target.status = 'paid';
    target.paidAt = target.paidAt || new Date().toISOString();
  } else if (['failed', 'cancelled', 'rejected'].includes(rawState)) {
    target.status = 'failed';
  } else if (rawState === 'expired') {
    target.status = 'expired';
  }
  const op = String(data.payment_system_name || data.paymentsystem || '').trim();
  const txId = String(data.transaction_id || data.transactionid || '').trim();
  if (op) target.operator = op;
  if (txId) target.providerTransactionId = txId;
  target.updatedAt = new Date().toISOString();

  all[target.externalReference] = target;
  writeJsonAtomic(EBILLING_LEDGER_PATH, all);
  return target;
}

export function applyEbillingWebhook(payload: Record<string, unknown>): EbillingRecord | null {
  const reference = String(payload.reference || payload.external_reference || '').trim();
  const billId = String(payload.bill_id || payload.billingid || payload.ebill_id || '').trim();
  const transactionId = String(payload.transaction_id || payload.transactionid || '').trim();
  const operator = String(payload.paymentsystem || payload.payment_system_name || payload.operator || '').trim();
  const state = String(payload.state || payload.status || '').toLowerCase().trim();
  const payloadAmount = payload.amount !== undefined ? Math.round(Number(payload.amount)) : null;

  const all = readJson<Record<string, EbillingRecord>>(EBILLING_LEDGER_PATH, {});
  const target =
    (reference && all[reference]) ||
    Object.values(all).find((r) => billId && r.billId === billId) ||
    null;
  if (!target) return null;

  // Guard against amount tampering if callback reports a different amount
  if (payloadAmount !== null && Number.isFinite(payloadAmount) && payloadAmount > 0 && payloadAmount !== target.amountXaf) {
    return null;
  }

  const nowIso = new Date().toISOString();
  if (['paid', 'processed', 'success', '2', 'completed'].includes(state) || (!state && transactionId)) {
    target.status = 'paid';
    target.paidAt = target.paidAt || nowIso;
  } else if (['failed', 'cancelled', 'rejected', 'error'].includes(state)) {
    target.status = 'failed';
  } else if (state === 'expired') {
    target.status = 'expired';
  }
  if (operator) target.operator = operator;
  if (transactionId) target.providerTransactionId = transactionId;
  target.updatedAt = nowIso;
  target.webhookEvents = [
    ...(target.webhookEvents || []).slice(-9),
    {
      receivedAt: nowIso,
      state: state || 'paid',
      operator: operator || undefined,
      transactionId: transactionId || undefined,
      signatureVerified: true,
    },
  ];

  all[target.externalReference] = target;
  writeJsonAtomic(EBILLING_LEDGER_PATH, all);
  return target;
}
