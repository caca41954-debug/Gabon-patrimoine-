import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  createEbillingCheckout,
  type EbillingRecord,
  enquiryEbillingStatus,
  executeShapPayout,
  type GabonMobileProvider,
  getEbillingConfig,
  getShapConfig,
  maskGabonMsisdn,
  reconcileShapPayout,
  type ShapPayoutLedgerRecord,
  signEbillingStatusToken,
  toShapPaymentSystem,
  validateGabonOperatorMsisdn,
} from './billingEasyService';

export type WalletTransactionType = 'deposit' | 'withdrawal';
export type WalletTransactionStatus =
  | 'pending'
  | 'processing'
  | 'paid'
  | 'failed'
  | 'cancelled'
  | 'rejected';

export interface LinkedMobileMoneyAccount {
  provider: GabonMobileProvider;
  msisdnMasked: string;
  // Server-only normalized local 9-digit MSISDN; stripped before sending to client
  msisdnPrivate?: string;
  verifiedAt: string;
  updatedAt: string;
}

export interface WalletAccount {
  uid: string;
  email: string;
  displayName: string;
  availableXaf: number;
  pendingWithdrawalXaf: number;
  totalDepositedXaf: number;
  totalWithdrawnXaf: number;
  linkedAccounts: {
    airtel_money?: LinkedMobileMoneyAccount;
    moov_money?: LinkedMobileMoneyAccount;
  };
  createdAt: string;
  updatedAt: string;
}

export interface WalletTransaction {
  id: string;
  reference: string;
  uid: string;
  userEmail: string;
  userName: string;
  type: WalletTransactionType;
  provider: GabonMobileProvider;
  msisdnMasked: string;
  // Kept only for server-side withdrawal execution, omitted in client JSON responses
  msisdnPrivate?: string;
  amountXaf: number;
  feeXaf: number;
  netAmountXaf: number;
  status: WalletTransactionStatus;
  channel: 'ebilling_portal' | 'ebilling_ussd' | 'shap_payout' | 'admin_manual';
  externalReference: string;
  providerTransactionId: string | null;
  paymentUrl?: string;
  statusToken?: string;
  ussdPushId?: string | number | null;
  idempotencyKey: string;
  creditedAt: string | null;
  debitedAt: string | null;
  refundedAt: string | null;
  statusMessage: string;
  adminNote?: string;
  reviewedByUid?: string;
  reviewedByEmail?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WalletAuditEvent {
  id: string;
  timestamp: string;
  actorUid: string;
  actorEmail: string;
  action: string;
  reference?: string;
  amountXaf?: number;
  provider?: GabonMobileProvider;
  summary: string;
}

interface WalletStore {
  accounts: Record<string, WalletAccount>;
  transactions: Record<string, WalletTransaction>;
  auditLogs: WalletAuditEvent[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const WALLET_LEDGER_PATH = path.resolve(DATA_DIR, 'wallet-ledger.json');
fs.mkdirSync(DATA_DIR, { recursive: true });

export function getWalletLimits() {
  const toPositiveInt = (raw: string | undefined, fallback: number) => {
    const val = Math.round(Number(raw));
    return Number.isFinite(val) && val > 0 ? val : fallback;
  };
  return {
    minDepositXaf: toPositiveInt(process.env.WALLET_MIN_DEPOSIT_XAF, 500),
    maxDepositXaf: toPositiveInt(process.env.WALLET_MAX_DEPOSIT_XAF, 2_000_000),
    minWithdrawalXaf: toPositiveInt(process.env.WALLET_MIN_WITHDRAWAL_XAF, 1_000),
    maxWithdrawalXaf: toPositiveInt(process.env.WALLET_MAX_WITHDRAWAL_XAF, 1_000_000),
    dailyLimitXaf: toPositiveInt(process.env.WALLET_DAILY_LIMIT_XAF, 5_000_000),
  };
}

function readStore(): WalletStore {
  try {
    if (!fs.existsSync(WALLET_LEDGER_PATH)) {
      return { accounts: {}, transactions: {}, auditLogs: [] };
    }
    const parsed = JSON.parse(fs.readFileSync(WALLET_LEDGER_PATH, 'utf-8')) as Partial<WalletStore>;
    return {
      accounts: parsed.accounts && typeof parsed.accounts === 'object' ? parsed.accounts : {},
      transactions: parsed.transactions && typeof parsed.transactions === 'object' ? parsed.transactions : {},
      auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
    };
  } catch {
    return { accounts: {}, transactions: {}, auditLogs: [] };
  }
}

function writeStoreAtomic(store: WalletStore): void {
  const tmp = path.join(DATA_DIR, `.wallet-ledger.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf-8');
  fs.renameSync(tmp, WALLET_LEDGER_PATH);
}

function appendAudit(store: WalletStore, event: Omit<WalletAuditEvent, 'id' | 'timestamp'>): void {
  store.auditLogs.unshift({
    id: `WAUD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    timestamp: new Date().toISOString(),
    ...event,
  });
  if (store.auditLogs.length > 1000) {
    store.auditLogs = store.auditLogs.slice(0, 1000);
  }
}

function ensureAccount(
  store: WalletStore,
  user: { uid: string; email: string; displayName: string }
): WalletAccount {
  const nowIso = new Date().toISOString();
  const existing = store.accounts[user.uid];
  if (existing) {
    if (user.email) existing.email = user.email;
    if (user.displayName) existing.displayName = user.displayName;
    existing.updatedAt = nowIso;
    return existing;
  }
  const created: WalletAccount = {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName || 'Contributeur',
    availableXaf: 0,
    pendingWithdrawalXaf: 0,
    totalDepositedXaf: 0,
    totalWithdrawnXaf: 0,
    linkedAccounts: {},
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  store.accounts[user.uid] = created;
  return created;
}

export function sanitizeAccountForClient(acc: WalletAccount) {
  const linked: Record<string, Omit<LinkedMobileMoneyAccount, 'msisdnPrivate'>> = {};
  for (const [k, v] of Object.entries(acc.linkedAccounts || {})) {
    if (v) {
      const { msisdnPrivate: _omit, ...safe } = v;
      linked[k] = safe;
    }
  }
  return {
    uid: acc.uid,
    email: acc.email,
    displayName: acc.displayName,
    availableXaf: acc.availableXaf,
    pendingWithdrawalXaf: acc.pendingWithdrawalXaf,
    totalDepositedXaf: acc.totalDepositedXaf,
    totalWithdrawnXaf: acc.totalWithdrawnXaf,
    linkedAccounts: linked as WalletAccount['linkedAccounts'],
    createdAt: acc.createdAt,
    updatedAt: acc.updatedAt,
  };
}

export function sanitizeTxForClient(tx: WalletTransaction) {
  const { msisdnPrivate: _omit, statusToken: _omitTok, ...safe } = tx;
  return safe;
}

export function getOrCreateWalletSummary(user: { uid: string; email: string; displayName: string }) {
  const store = readStore();
  const existed = Boolean(store.accounts[user.uid]);
  const account = ensureAccount(store, user);
  if (!existed) {
    writeStoreAtomic(store);
  }
  const ebillingCfg = getEbillingConfig();
  const shapCfg = getShapConfig();
  return {
    account: sanitizeAccountForClient(account),
    limits: getWalletLimits(),
    readiness: {
      depositConfigured: ebillingCfg.configured,
      depositMissingEnvVars: ebillingCfg.missingEnvVars,
      withdrawalAutoConfigured: shapCfg.configured,
      withdrawalMissingEnvVars: shapCfg.missingEnvVars,
      webhookDepositConfigured: ebillingCfg.webhookSecretConfigured,
      webhookWithdrawalConfigured: shapCfg.webhookSecretConfigured,
    },
  };
}

export function linkMobileMoneyAccount(params: {
  uid: string;
  email: string;
  displayName: string;
  provider: GabonMobileProvider;
  rawPhone: string;
}) {
  const check = validateGabonOperatorMsisdn(params.rawPhone, params.provider);
  if (!check.valid || !check.msisdn) {
    throw new Error(check.error || 'Numéro Mobile Money gabonais invalide.');
  }

  const store = readStore();
  const account = ensureAccount(store, {
    uid: params.uid,
    email: params.email,
    displayName: params.displayName,
  });
  const nowIso = new Date().toISOString();
  account.linkedAccounts[params.provider] = {
    provider: params.provider,
    msisdnMasked: maskGabonMsisdn(check.msisdn),
    msisdnPrivate: check.msisdn,
    verifiedAt: nowIso,
    updatedAt: nowIso,
  };
  account.updatedAt = nowIso;

  appendAudit(store, {
    actorUid: params.uid,
    actorEmail: params.email,
    action: 'WALLET_LINK_MOBILE_MONEY',
    provider: params.provider,
    summary: `Compte ${params.provider} lié (${maskGabonMsisdn(check.msisdn)}).`,
  });

  writeStoreAtomic(store);
  return sanitizeAccountForClient(account);
}

function getTodayVolumeXaf(store: WalletStore, uid: string, type: WalletTransactionType): number {
  const dayPrefix = new Date().toISOString().slice(0, 10);
  let total = 0;
  for (const tx of Object.values(store.transactions)) {
    if (
      tx.uid === uid &&
      tx.type === type &&
      tx.createdAt.startsWith(dayPrefix) &&
      !['failed', 'cancelled', 'rejected'].includes(tx.status)
    ) {
      total += tx.amountXaf;
    }
  }
  return total;
}

export async function initiateWalletDeposit(params: {
  uid: string;
  email: string;
  displayName: string;
  provider: GabonMobileProvider;
  rawPhone?: string;
  amountXaf: number;
  mode: 'portal' | 'ussd';
  idempotencyKey?: string;
  appBaseUrl: string;
}) {
  const limits = getWalletLimits();
  const intAmount = Math.round(Number(params.amountXaf));
  if (!Number.isFinite(intAmount) || intAmount < limits.minDepositXaf || intAmount > limits.maxDepositXaf) {
    throw new Error(
      `Montant de dépôt invalide. Plage autorisée : ${limits.minDepositXaf.toLocaleString('fr-FR')} à ${limits.maxDepositXaf.toLocaleString('fr-FR')} XAF.`
    );
  }

  const cfg = getEbillingConfig(params.appBaseUrl);
  if (!cfg.configured) {
    const err = new Error(
      `Paiement non configuré côté serveur (${cfg.missingEnvVars.join(', ')}). Aucun dépôt fictif n’est crédité.`
    ) as Error & { code?: string; statusCode?: number; missingEnvVars?: string[] };
    err.code = 'PAYMENT_NOT_CONFIGURED';
    err.statusCode = 501;
    err.missingEnvVars = cfg.missingEnvVars;
    throw err;
  }

  const store = readStore();
  const account = ensureAccount(store, {
    uid: params.uid,
    email: params.email,
    displayName: params.displayName,
  });

  // Resolve phone either from input or linked account
  const linked = account.linkedAccounts[params.provider];
  const candidatePhone = params.rawPhone?.trim() || linked?.msisdnPrivate || '';
  const phoneCheck = validateGabonOperatorMsisdn(candidatePhone, params.provider);
  if (!phoneCheck.valid || !phoneCheck.msisdn) {
    throw new Error(phoneCheck.error || 'Veuillez connecter ou saisir un numéro Mobile Money gabonais valide.');
  }

  const idemKey =
    (params.idempotencyKey || '').trim().slice(0, 128) ||
    `dep_${params.uid}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

  // Idempotency replay protection
  const existingByIdem = Object.values(store.transactions).find(
    (t) => t.uid === params.uid && t.type === 'deposit' && t.idempotencyKey === idemKey
  );
  if (existingByIdem) {
    return { transaction: sanitizeTxForClient(existingByIdem), account: sanitizeAccountForClient(account) };
  }

  // Rapid duplicate velocity guard (15 seconds)
  const fifteenSecsAgo = Date.now() - 15_000;
  const recentDuplicate = Object.values(store.transactions).find(
    (t) =>
      t.uid === params.uid &&
      t.type === 'deposit' &&
      t.amountXaf === intAmount &&
      t.provider === params.provider &&
      t.status === 'pending' &&
      Date.parse(t.createdAt) >= fifteenSecsAgo
  );
  if (recentDuplicate) {
    throw new Error('Une demande de dépôt identique vient d’être initialisée. Veuillez confirmer sur votre mobile ou patienter 15 secondes.');
  }

  // Daily cap enforcement
  const todayTotal = getTodayVolumeXaf(store, params.uid, 'deposit');
  if (todayTotal + intAmount > limits.dailyLimitXaf) {
    throw new Error(
      `Plafond journalier de dépôt atteint (${limits.dailyLimitXaf.toLocaleString('fr-FR')} XAF/jour).`
    );
  }

  const externalReference = `DEP-${Date.now()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  const statusToken = signEbillingStatusToken(externalReference);
  const redirectUrl = `${params.appBaseUrl.replace(/\/+$/, '')}/?vue=payment&paiement=succes&ref=${externalReference}&token=${statusToken}`;

  const ebill = await createEbillingCheckout({
    amountXaf: intAmount,
    payerName: params.displayName,
    payerMsisdn: phoneCheck.msisdn,
    payerEmail: params.email,
    purpose: 'Dépôt portefeuille Mobile Money',
    shortDescription: `Dépôt portefeuille ${externalReference}`,
    externalReference,
    redirectUrl,
    operator: toShapPaymentSystem(params.provider),
    triggerUssdPush: params.mode === 'ussd',
    createdByUid: params.uid,
  });

  const nowIso = new Date().toISOString();
  const tx: WalletTransaction = {
    id: `wtx_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`,
    reference: externalReference,
    uid: params.uid,
    userEmail: params.email,
    userName: params.displayName,
    type: 'deposit',
    provider: params.provider,
    msisdnMasked: maskGabonMsisdn(phoneCheck.msisdn),
    amountXaf: intAmount,
    feeXaf: 0,
    netAmountXaf: intAmount,
    status: 'pending',
    channel: params.mode === 'ussd' ? 'ebilling_ussd' : 'ebilling_portal',
    externalReference,
    providerTransactionId: null,
    paymentUrl: ebill.paymentUrl,
    statusToken,
    ussdPushId: ebill.ussdPushId ?? null,
    idempotencyKey: idemKey,
    creditedAt: null,
    debitedAt: null,
    refundedAt: null,
    statusMessage:
      params.mode === 'ussd' && ebill.ussdPushId
        ? `Demande USSD Push #${ebill.ussdPushId} envoyée. Validez le code secret directement sur votre téléphone.`
        : 'Facture E-Billing générée. Finalisez le paiement sur le portail sécurisé puis attendez la confirmation.',
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  store.transactions[tx.id] = tx;
  appendAudit(store, {
    actorUid: params.uid,
    actorEmail: params.email,
    action: 'WALLET_DEPOSIT_INITIATED',
    reference: tx.reference,
    amountXaf: intAmount,
    provider: params.provider,
    summary: `Dépôt initié (${params.mode}) pour ${intAmount.toLocaleString('fr-FR')} XAF — en attente confirmation opérateur.`,
  });

  writeStoreAtomic(store);
  return { transaction: sanitizeTxForClient(tx), account: sanitizeAccountForClient(account) };
}

/**
 * Credits user wallet ONLY when verified by Billing Easy webhook signature or official Enquiry API.
 * Strictly idempotent via `tx.creditedAt`.
 */
export function syncWalletDepositFromEbilling(ebill: EbillingRecord): WalletTransaction | null {
  const store = readStore();
  const tx = Object.values(store.transactions).find(
    (t) => t.type === 'deposit' && t.externalReference === ebill.externalReference
  );
  if (!tx) return null;

  const account = ensureAccount(store, {
    uid: tx.uid,
    email: tx.userEmail,
    displayName: tx.userName,
  });
  const nowIso = new Date().toISOString();

  if (ebill.status === 'paid') {
    if (!tx.creditedAt) {
      tx.status = 'paid';
      tx.creditedAt = nowIso;
      tx.providerTransactionId = ebill.providerTransactionId || ebill.billId;
      tx.statusMessage = 'Dépôt confirmé par l’opérateur Mobile Money et crédité sur votre solde.';
      tx.updatedAt = nowIso;
      account.availableXaf += tx.amountXaf;
      account.totalDepositedXaf += tx.amountXaf;
      account.updatedAt = nowIso;

      appendAudit(store, {
        actorUid: 'system_webhook',
        actorEmail: 'ebilling-webhook',
        action: 'WALLET_DEPOSIT_CREDITED',
        reference: tx.reference,
        amountXaf: tx.amountXaf,
        provider: tx.provider,
        summary: `Crédit validé (+${tx.amountXaf.toLocaleString('fr-FR')} XAF) après confirmation E-Billing (${tx.providerTransactionId}).`,
      });
    }
  } else if (ebill.status === 'failed' || ebill.status === 'expired') {
    if (tx.status === 'pending' || tx.status === 'processing') {
      tx.status = ebill.status === 'expired' ? 'cancelled' : 'failed';
      tx.statusMessage =
        ebill.status === 'expired'
          ? 'Délai dépassé : la demande de dépôt a expiré avant validation PIN.'
          : 'Paiement refusé ou annulé côté opérateur Mobile Money.';
      tx.updatedAt = nowIso;

      appendAudit(store, {
        actorUid: 'system_webhook',
        actorEmail: 'ebilling-webhook',
        action: 'WALLET_DEPOSIT_FAILED',
        reference: tx.reference,
        amountXaf: tx.amountXaf,
        provider: tx.provider,
        summary: `Dépôt ${ebill.status} (${tx.reference}) — aucun crédit effectué.`,
      });
    }
  }

  store.transactions[tx.id] = tx;
  writeStoreAtomic(store);
  return tx;
}

export async function verifyWalletDepositByReference(reference: string, callerUid: string, isAdmin: boolean) {
  const store = readStore();
  const tx = Object.values(store.transactions).find((t) => t.reference === reference && t.type === 'deposit');
  if (!tx) {
    throw new Error('Transaction de dépôt introuvable.');
  }
  if (!isAdmin && tx.uid !== callerUid) {
    throw new Error('Accès non autorisé à cette transaction.');
  }
  const updatedEbill = await enquiryEbillingStatus(tx.externalReference);
  const syncedTx = updatedEbill ? syncWalletDepositFromEbilling(updatedEbill) || tx : tx;
  const freshStore = readStore();
  const account = ensureAccount(freshStore, {
    uid: syncedTx.uid,
    email: syncedTx.userEmail,
    displayName: syncedTx.userName,
  });
  return {
    transaction: sanitizeTxForClient(syncedTx),
    account: sanitizeAccountForClient(account),
  };
}

export async function initiateWalletWithdrawal(params: {
  uid: string;
  email: string;
  displayName: string;
  provider: GabonMobileProvider;
  rawPhone?: string;
  amountXaf: number;
  idempotencyKey?: string;
}) {
  const limits = getWalletLimits();
  const intAmount = Math.round(Number(params.amountXaf));
  if (
    !Number.isFinite(intAmount) ||
    intAmount < limits.minWithdrawalXaf ||
    intAmount > limits.maxWithdrawalXaf
  ) {
    throw new Error(
      `Montant de retrait invalide. Plage autorisée : ${limits.minWithdrawalXaf.toLocaleString('fr-FR')} à ${limits.maxWithdrawalXaf.toLocaleString('fr-FR')} XAF.`
    );
  }

  const store = readStore();
  const account = ensureAccount(store, {
    uid: params.uid,
    email: params.email,
    displayName: params.displayName,
  });

  const linked = account.linkedAccounts[params.provider];
  const candidatePhone = params.rawPhone?.trim() || linked?.msisdnPrivate || '';
  const phoneCheck = validateGabonOperatorMsisdn(candidatePhone, params.provider);
  if (!phoneCheck.valid || !phoneCheck.msisdn) {
    throw new Error(phoneCheck.error || 'Numéro Mobile Money gabonais invalide pour ce retrait.');
  }

  const idemKey =
    (params.idempotencyKey || '').trim().slice(0, 128) ||
    `wdr_${params.uid}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

  const existingByIdem = Object.values(store.transactions).find(
    (t) => t.uid === params.uid && t.type === 'withdrawal' && t.idempotencyKey === idemKey
  );
  if (existingByIdem) {
    return { transaction: sanitizeTxForClient(existingByIdem), account: sanitizeAccountForClient(account) };
  }

  if (account.availableXaf < intAmount) {
    throw new Error(
      `Solde disponible insuffisant (${account.availableXaf.toLocaleString('fr-FR')} XAF disponibles). Effectuez d’abord un dépôt vérifié.`
    );
  }

  const todayWithdrawals = getTodayVolumeXaf(store, params.uid, 'withdrawal');
  if (todayWithdrawals + intAmount > limits.dailyLimitXaf) {
    throw new Error(
      `Plafond journalier de retrait dépassé (${limits.dailyLimitXaf.toLocaleString('fr-FR')} XAF/jour).`
    );
  }

  const shapCfg = getShapConfig();
  const txId = `wtx_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const reference = `WDR-${Date.now()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  const nowIso = new Date().toISOString();

  // Atomically reserve user balance BEFORE any external API call
  account.availableXaf -= intAmount;
  account.pendingWithdrawalXaf += intAmount;
  account.updatedAt = nowIso;

  const tx: WalletTransaction = {
    id: txId,
    reference,
    uid: params.uid,
    userEmail: params.email,
    userName: params.displayName,
    type: 'withdrawal',
    provider: params.provider,
    msisdnMasked: maskGabonMsisdn(phoneCheck.msisdn),
    msisdnPrivate: phoneCheck.msisdn,
    amountXaf: intAmount,
    feeXaf: 0,
    netAmountXaf: intAmount,
    status: shapCfg.configured ? 'processing' : 'pending',
    channel: shapCfg.configured ? 'shap_payout' : 'admin_manual',
    externalReference: `GP-${reference}`,
    providerTransactionId: null,
    idempotencyKey: idemKey,
    creditedAt: null,
    debitedAt: null,
    refundedAt: null,
    statusMessage: shapCfg.configured
      ? 'Ordre de retrait transmis à la passerelle SHAP Mobile Money.'
      : 'Fonds réservés. En attente de validation par l’administrateur (SHAP non configuré).',
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  store.transactions[tx.id] = tx;
  appendAudit(store, {
    actorUid: params.uid,
    actorEmail: params.email,
    action: 'WALLET_WITHDRAWAL_REQUESTED',
    reference: tx.reference,
    amountXaf: intAmount,
    provider: params.provider,
    summary: `Demande de retrait de ${intAmount.toLocaleString('fr-FR')} XAF vers ${tx.msisdnMasked}.`,
  });
  writeStoreAtomic(store);

  // If SHAP is configured, execute automated disbursement now
  if (shapCfg.configured) {
    try {
      const shapRec = await executeShapPayout({
        payoutRequestId: reference,
        provider: params.provider,
        msisdn: phoneCheck.msisdn,
        amountXaf: intAmount,
        payoutType: 'withdrawal',
      });
      const synced = syncWalletWithdrawalFromShap(shapRec);
      const latestStore = readStore();
      const latestAcc = ensureAccount(latestStore, {
        uid: params.uid,
        email: params.email,
        displayName: params.displayName,
      });
      return {
        transaction: sanitizeTxForClient(synced || tx),
        account: sanitizeAccountForClient(latestAcc),
      };
    } catch (err) {
      // Refund atomically on immediate SHAP rejection
      const rollbackStore = readStore();
      const rollbackTx = rollbackStore.transactions[txId];
      const rollbackAcc = rollbackStore.accounts[params.uid];
      if (rollbackTx && rollbackAcc && !rollbackTx.refundedAt && !rollbackTx.debitedAt) {
        rollbackTx.status = 'failed';
        rollbackTx.refundedAt = new Date().toISOString();
        rollbackTx.statusMessage =
          err instanceof Error ? err.message : 'Échec immédiat du virement auprès de l’opérateur.';
        rollbackTx.updatedAt = new Date().toISOString();
        rollbackAcc.pendingWithdrawalXaf = Math.max(0, rollbackAcc.pendingWithdrawalXaf - rollbackTx.amountXaf);
        rollbackAcc.availableXaf += rollbackTx.amountXaf;
        rollbackAcc.updatedAt = new Date().toISOString();
        appendAudit(rollbackStore, {
          actorUid: 'system_shap',
          actorEmail: 'shap-gateway',
          action: 'WALLET_WITHDRAWAL_REFUNDED',
          reference: rollbackTx.reference,
          amountXaf: rollbackTx.amountXaf,
          provider: rollbackTx.provider,
          summary: `Retrait échoué (${rollbackTx.reference}) — montant récrédité sur le solde disponible.`,
        });
        writeStoreAtomic(rollbackStore);
      }
      throw err;
    }
  }

  return { transaction: sanitizeTxForClient(tx), account: sanitizeAccountForClient(account) };
}

export function syncWalletWithdrawalFromShap(shapRec: ShapPayoutLedgerRecord): WalletTransaction | null {
  const store = readStore();
  const tx = Object.values(store.transactions).find(
    (t) =>
      t.type === 'withdrawal' &&
      (t.externalReference === shapRec.externalReference || t.reference === shapRec.payoutRequestId)
  );
  if (!tx) return null;

  const account = ensureAccount(store, {
    uid: tx.uid,
    email: tx.userEmail,
    displayName: tx.userName,
  });
  const nowIso = new Date().toISOString();

  if (shapRec.status === 'success') {
    if (!tx.debitedAt) {
      tx.status = 'paid';
      tx.debitedAt = nowIso;
      tx.providerTransactionId = shapRec.payoutId || shapRec.externalReference;
      tx.statusMessage = 'Retrait Mobile Money exécuté et confirmé par l’opérateur.';
      tx.updatedAt = nowIso;
      account.pendingWithdrawalXaf = Math.max(0, account.pendingWithdrawalXaf - tx.amountXaf);
      account.totalWithdrawnXaf += tx.amountXaf;
      account.updatedAt = nowIso;

      appendAudit(store, {
        actorUid: 'system_shap',
        actorEmail: 'shap-webhook',
        action: 'WALLET_WITHDRAWAL_PAID',
        reference: tx.reference,
        amountXaf: tx.amountXaf,
        provider: tx.provider,
        summary: `Retrait versé (${tx.providerTransactionId}) — ${tx.amountXaf.toLocaleString('fr-FR')} XAF.`,
      });
    }
  } else if (shapRec.status === 'failed') {
    if (!tx.refundedAt && !tx.debitedAt) {
      tx.status = 'failed';
      tx.refundedAt = nowIso;
      tx.statusMessage = shapRec.errorMessage || 'Le virement Mobile Money a échoué chez l’opérateur ; solde restitué.';
      tx.updatedAt = nowIso;
      account.pendingWithdrawalXaf = Math.max(0, account.pendingWithdrawalXaf - tx.amountXaf);
      account.availableXaf += tx.amountXaf;
      account.updatedAt = nowIso;

      appendAudit(store, {
        actorUid: 'system_shap',
        actorEmail: 'shap-webhook',
        action: 'WALLET_WITHDRAWAL_FAILED_REFUNDED',
        reference: tx.reference,
        amountXaf: tx.amountXaf,
        provider: tx.provider,
        summary: `Échec opérateur SHAP (${tx.reference}) — montant restitué au portefeuille.`,
      });
    }
  } else {
    tx.status = 'processing';
    tx.providerTransactionId = shapRec.payoutId || tx.providerTransactionId;
    tx.updatedAt = nowIso;
  }

  store.transactions[tx.id] = tx;
  writeStoreAtomic(store);
  return tx;
}

export async function adminDecideWalletWithdrawal(params: {
  transactionId: string;
  decision: 'approve_shap' | 'approve_manual' | 'reject' | 'reconcile_shap';
  providerReference?: string;
  adminNote?: string;
  adminUid: string;
  adminEmail: string;
}) {
  const store = readStore();
  const tx = store.transactions[params.transactionId] ||
    Object.values(store.transactions).find((t) => t.reference === params.transactionId);
  if (!tx || tx.type !== 'withdrawal') {
    throw new Error('Demande de retrait introuvable.');
  }

  const account = ensureAccount(store, {
    uid: tx.uid,
    email: tx.userEmail,
    displayName: tx.userName,
  });
  const nowIso = new Date().toISOString();

  if (params.decision === 'reconcile_shap') {
    const shapRec = await reconcileShapPayout({
      payoutRequestId: tx.reference,
      msisdnOverride: tx.msisdnPrivate,
    });
    const synced = syncWalletWithdrawalFromShap(shapRec);
    return sanitizeTxForClient(synced || tx);
  }

  if (!['pending', 'processing'].includes(tx.status)) {
    throw new Error(`Cette transaction est déjà au statut « ${tx.status} ».`);
  }

  if (params.decision === 'approve_shap') {
    if (!tx.msisdnPrivate) {
      throw new Error('Numéro bénéficiaire complet introuvable pour ce virement SHAP.');
    }
    const shapRec = await executeShapPayout({
      payoutRequestId: tx.reference,
      provider: tx.provider,
      msisdn: tx.msisdnPrivate,
      amountXaf: tx.amountXaf,
      payoutType: 'withdrawal',
    });
    const synced = syncWalletWithdrawalFromShap(shapRec);
    const freshStore = readStore();
    if (freshStore.transactions[tx.id]) {
      freshStore.transactions[tx.id].reviewedByUid = params.adminUid;
      freshStore.transactions[tx.id].reviewedByEmail = params.adminEmail;
      if (params.adminNote) freshStore.transactions[tx.id].adminNote = params.adminNote.slice(0, 300);
      writeStoreAtomic(freshStore);
      return sanitizeTxForClient(freshStore.transactions[tx.id]);
    }
    return sanitizeTxForClient(synced || tx);
  }

  if (params.decision === 'approve_manual') {
    const cleanRef = (params.providerReference || '').trim().slice(0, 120);
    if (cleanRef.length < 3) {
      throw new Error('Saisissez la référence officielle de transaction Mobile Money (min 3 caractères) pour valider un paiement manuel.');
    }
    if (!tx.debitedAt) {
      tx.status = 'paid';
      tx.channel = 'admin_manual';
      tx.debitedAt = nowIso;
      tx.providerTransactionId = cleanRef;
      tx.reviewedByUid = params.adminUid;
      tx.reviewedByEmail = params.adminEmail;
      tx.adminNote = (params.adminNote || 'Virement manuel vérifié par l’administrateur.').slice(0, 300);
      tx.statusMessage = `Retrait validé manuellement par l’administration (réf. ${cleanRef}).`;
      tx.updatedAt = nowIso;
      account.pendingWithdrawalXaf = Math.max(0, account.pendingWithdrawalXaf - tx.amountXaf);
      account.totalWithdrawnXaf += tx.amountXaf;
      account.updatedAt = nowIso;

      appendAudit(store, {
        actorUid: params.adminUid,
        actorEmail: params.adminEmail,
        action: 'ADMIN_WITHDRAWAL_MANUAL_APPROVED',
        reference: tx.reference,
        amountXaf: tx.amountXaf,
        provider: tx.provider,
        summary: `Retrait validé manuellement (${cleanRef}) pour ${tx.amountXaf.toLocaleString('fr-FR')} XAF.`,
      });
    }
    store.transactions[tx.id] = tx;
    writeStoreAtomic(store);
    return sanitizeTxForClient(tx);
  }

  // decision === 'reject'
  if (!tx.refundedAt && !tx.debitedAt) {
    tx.status = 'rejected';
    tx.refundedAt = nowIso;
    tx.reviewedByUid = params.adminUid;
    tx.reviewedByEmail = params.adminEmail;
    tx.adminNote = (params.adminNote || 'Demande refusée par l’administrateur ; montant restitué.').slice(0, 300);
    tx.statusMessage = tx.adminNote;
    tx.updatedAt = nowIso;
    account.pendingWithdrawalXaf = Math.max(0, account.pendingWithdrawalXaf - tx.amountXaf);
    account.availableXaf += tx.amountXaf;
    account.updatedAt = nowIso;

    appendAudit(store, {
      actorUid: params.adminUid,
      actorEmail: params.adminEmail,
      action: 'ADMIN_WITHDRAWAL_REJECTED',
      reference: tx.reference,
      amountXaf: tx.amountXaf,
      provider: tx.provider,
      summary: `Retrait refusé (${tx.reference}) et solde restitué (${tx.amountXaf.toLocaleString('fr-FR')} XAF).`,
    });
  }
  store.transactions[tx.id] = tx;
  writeStoreAtomic(store);
  return sanitizeTxForClient(tx);
}

export function listWalletTransactions(params: {
  uid?: string;
  type?: string;
  provider?: string;
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const store = readStore();
  const q = (params.search || '').trim().toLowerCase();

  let list = Object.values(store.transactions);
  if (params.uid) list = list.filter((t) => t.uid === params.uid);
  if (params.type && params.type !== 'all') list = list.filter((t) => t.type === params.type);
  if (params.provider && params.provider !== 'all') list = list.filter((t) => t.provider === params.provider);
  if (params.status && params.status !== 'all') list = list.filter((t) => t.status === params.status);
  if (q) {
    list = list.filter(
      (t) =>
        t.reference.toLowerCase().includes(q) ||
        t.userName.toLowerCase().includes(q) ||
        t.userEmail.toLowerCase().includes(q) ||
        t.msisdnMasked.toLowerCase().includes(q) ||
        (t.providerTransactionId || '').toLowerCase().includes(q)
    );
  }

  list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const pageSize = Math.min(Math.max(1, Math.round(Number(params.pageSize) || 10)), 100);
  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, Math.round(Number(params.page) || 1)), totalPages);
  const start = (page - 1) * pageSize;

  return {
    items: list.slice(start, start + pageSize).map(sanitizeTxForClient),
    total,
    page,
    pageSize,
    totalPages,
  };
}

export function getAdminWalletOverview(params: {
  type?: string;
  provider?: string;
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const store = readStore();
  const allTx = Object.values(store.transactions);
  const totals = {
    totalDepositsPaidXaf: allTx
      .filter((t) => t.type === 'deposit' && t.status === 'paid')
      .reduce((sum, t) => sum + t.amountXaf, 0),
    totalWithdrawalsPaidXaf: allTx
      .filter((t) => t.type === 'withdrawal' && t.status === 'paid')
      .reduce((sum, t) => sum + t.amountXaf, 0),
    pendingWithdrawalsCount: allTx.filter(
      (t) => t.type === 'withdrawal' && ['pending', 'processing'].includes(t.status)
    ).length,
    totalAccountsCount: Object.keys(store.accounts).length,
  };

  const paginated = listWalletTransactions(params);
  return {
    totals,
    transactions: paginated,
    auditLogs: store.auditLogs.slice(0, 120),
  };
}

function escapeCsvCell(value: unknown): string {
  const raw = String(value ?? '');
  // Neutralize formula injection in spreadsheet tools
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function exportWalletTransactionsCsv(params: {
  type?: string;
  provider?: string;
  status?: string;
  search?: string;
}): string {
  const { items } = listWalletTransactions({ ...params, page: 1, pageSize: 100 });
  const headers = [
    'Reference',
    'Date ISO',
    'Type',
    'Operateur',
    'Montant XAF',
    'Statut',
    'Canal',
    'Numero masque',
    'Utilisateur',
    'Email',
    'Ref Operateur',
    'Message',
  ];
  const rows = items.map((t) =>
    [
      t.reference,
      t.createdAt,
      t.type === 'deposit' ? 'Depot' : 'Retrait',
      t.provider === 'airtel_money' ? 'Airtel Money' : 'Moov Money',
      t.amountXaf,
      t.status,
      t.channel,
      t.msisdnMasked,
      t.userName,
      t.userEmail,
      t.providerTransactionId || '',
      t.statusMessage,
    ]
      .map(escapeCsvCell)
      .join(',')
  );
  return `\uFEFF${headers.map(escapeCsvCell).join(',')}\n${rows.join('\n')}`;
}
