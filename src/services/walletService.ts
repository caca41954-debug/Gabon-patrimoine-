import type {
  GabonMobileProvider,
  WalletAccount,
  WalletAdminOverview,
  WalletSummaryResponse,
  WalletTransaction,
  WalletTransactionsPage,
} from '../types';

export async function fetchWalletSummary(idToken: string): Promise<WalletSummaryResponse> {
  const res = await fetch('/api/wallet', {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  const data = (await res.json().catch(() => ({}))) as WalletSummaryResponse & { error?: string };
  if (!res.ok || !data.account) {
    throw new Error(data.error || 'Impossible de charger votre portefeuille Mobile Money.');
  }
  return data;
}

export async function linkWalletMobileAccount(
  idToken: string,
  provider: GabonMobileProvider,
  rawPhone: string
): Promise<WalletAccount> {
  const res = await fetch('/api/wallet/link-account', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ provider, rawPhone }),
  });
  const data = (await res.json().catch(() => ({}))) as { account?: WalletAccount; error?: string };
  if (!res.ok || !data.account) {
    throw new Error(data.error || 'Impossible de lier ce numéro Mobile Money.');
  }
  return data.account;
}

export async function initiateWalletDepositRequest(
  idToken: string,
  params: {
    provider: GabonMobileProvider;
    rawPhone?: string;
    amountXaf: number;
    mode: 'portal' | 'ussd';
    idempotencyKey?: string;
  }
): Promise<{ transaction: WalletTransaction; account: WalletAccount }> {
  const res = await fetch('/api/wallet/deposit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(params),
  });
  const data = (await res.json().catch(() => ({}))) as {
    transaction?: WalletTransaction;
    account?: WalletAccount;
    message?: string;
    error?: string;
  };
  if (!res.ok || !data.transaction || !data.account) {
    throw new Error(data.message || data.error || 'Impossible d’initier le dépôt Mobile Money.');
  }
  return { transaction: data.transaction, account: data.account };
}

export async function verifyWalletDepositRequest(
  idToken: string,
  reference: string
): Promise<{ transaction: WalletTransaction; account: WalletAccount }> {
  const res = await fetch(`/api/wallet/deposit/verify/${encodeURIComponent(reference)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}` },
  });
  const data = (await res.json().catch(() => ({}))) as {
    transaction?: WalletTransaction;
    account?: WalletAccount;
    error?: string;
  };
  if (!res.ok || !data.transaction || !data.account) {
    throw new Error(data.error || 'Impossible de vérifier ce dépôt.');
  }
  return { transaction: data.transaction, account: data.account };
}

export async function initiateWalletWithdrawalRequest(
  idToken: string,
  params: {
    provider: GabonMobileProvider;
    rawPhone?: string;
    amountXaf: number;
    idempotencyKey?: string;
  }
): Promise<{ transaction: WalletTransaction; account: WalletAccount }> {
  const res = await fetch('/api/wallet/withdraw', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(params),
  });
  const data = (await res.json().catch(() => ({}))) as {
    transaction?: WalletTransaction;
    account?: WalletAccount;
    message?: string;
    error?: string;
  };
  if (!res.ok || !data.transaction || !data.account) {
    throw new Error(data.message || data.error || 'Impossible d’initier le retrait Mobile Money.');
  }
  return { transaction: data.transaction, account: data.account };
}

export async function fetchWalletTransactionsPage(
  idToken: string,
  params: {
    type?: string;
    provider?: string;
    status?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }
): Promise<WalletTransactionsPage> {
  const qs = new URLSearchParams();
  if (params.type && params.type !== 'all') qs.set('type', params.type);
  if (params.provider && params.provider !== 'all') qs.set('provider', params.provider);
  if (params.status && params.status !== 'all') qs.set('status', params.status);
  if (params.search?.trim()) qs.set('search', params.search.trim());
  if (params.page) qs.set('page', String(params.page));
  if (params.pageSize) qs.set('pageSize', String(params.pageSize));

  const res = await fetch(`/api/wallet/transactions?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) {
    throw new Error('Impossible de charger l’historique des transactions.');
  }
  return (await res.json()) as WalletTransactionsPage;
}

export async function fetchAdminWalletOverview(
  idToken: string,
  params: {
    type?: string;
    provider?: string;
    status?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }
): Promise<WalletAdminOverview> {
  const qs = new URLSearchParams();
  if (params.type && params.type !== 'all') qs.set('type', params.type);
  if (params.provider && params.provider !== 'all') qs.set('provider', params.provider);
  if (params.status && params.status !== 'all') qs.set('status', params.status);
  if (params.search?.trim()) qs.set('search', params.search.trim());
  if (params.page) qs.set('page', String(params.page));
  if (params.pageSize) qs.set('pageSize', String(params.pageSize));

  const res = await fetch(`/api/admin/wallet/overview?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  const data = (await res.json().catch(() => ({}))) as WalletAdminOverview & { error?: string };
  if (!res.ok || !data.totals) {
    throw new Error(data.error || 'Impossible de charger la supervision financière.');
  }
  return data;
}

export async function decideAdminWalletWithdrawal(
  idToken: string,
  transactionId: string,
  body: {
    decision: 'approve_shap' | 'approve_manual' | 'reject' | 'reconcile_shap';
    providerReference?: string;
    adminNote?: string;
  }
): Promise<WalletTransaction> {
  const res = await fetch(`/api/admin/wallet/withdrawals/${encodeURIComponent(transactionId)}/decision`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as {
    transaction?: WalletTransaction;
    error?: string;
  };
  if (!res.ok || !data.transaction) {
    throw new Error(data.error || 'Erreur lors de la décision sur le retrait.');
  }
  return data.transaction;
}

export async function downloadAdminWalletCsv(
  idToken: string,
  params: {
    type?: string;
    provider?: string;
    status?: string;
    search?: string;
  }
): Promise<void> {
  const qs = new URLSearchParams();
  if (params.type && params.type !== 'all') qs.set('type', params.type);
  if (params.provider && params.provider !== 'all') qs.set('provider', params.provider);
  if (params.status && params.status !== 'all') qs.set('status', params.status);
  if (params.search?.trim()) qs.set('search', params.search.trim());

  const res = await fetch(`/api/admin/wallet/export.csv?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) {
    throw new Error('Impossible d’exporter le fichier CSV.');
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = `gabon-patrimoine-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
}
