import type {
  EbillingTransaction,
  GatewayArchitectureStatus,
  MobileMoneyProviderStatus,
} from '../types';

export interface ProvidersOverviewResponse {
  providers: MobileMoneyProviderStatus[];
  gateway: GatewayArchitectureStatus;
}

export interface CreateEbillingPaymentInput {
  amountXaf: number;
  payerName?: string;
  payerMsisdn: string;
  payerEmail: string;
  purpose?: string;
  shortDescription: string;
  provider?: 'airtel_money' | 'moov_money';
  triggerUssdPush?: boolean;
}

export interface CreateEbillingPaymentResult {
  record: EbillingTransaction;
  statusToken: string;
}

export async function fetchPaymentArchitecture(): Promise<ProvidersOverviewResponse> {
  const res = await fetch('/api/payments/providers');
  if (!res.ok) {
    throw new Error('Impossible de vérifier la configuration des passerelles de paiement.');
  }
  return (await res.json()) as ProvidersOverviewResponse;
}

export async function createEbillingPayment(
  input: CreateEbillingPaymentInput,
  idToken?: string | null
): Promise<CreateEbillingPaymentResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (idToken) headers.Authorization = `Bearer ${idToken}`;

  const res = await fetch('/api/ebilling/checkout', {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });

  const data = (await res.json().catch(() => ({}))) as {
    record?: EbillingTransaction;
    statusToken?: string;
    message?: string;
    error?: string;
  };

  if (!res.ok || !data.record || !data.statusToken) {
    throw new Error(data.message || data.error || 'Impossible de générer la facture E-Billing.');
  }

  return { record: data.record, statusToken: data.statusToken };
}

export async function fetchEbillingStatus(
  reference: string,
  options?: { statusToken?: string | null; idToken?: string | null }
): Promise<EbillingTransaction> {
  const headers: Record<string, string> = {};
  if (options?.idToken) headers.Authorization = `Bearer ${options.idToken}`;
  if (options?.statusToken) headers['x-status-token'] = options.statusToken;

  const qs = options?.statusToken ? `?token=${encodeURIComponent(options.statusToken)}` : '';
  const res = await fetch(`/api/ebilling/status/${encodeURIComponent(reference)}${qs}`, { headers });
  const data = (await res.json().catch(() => ({}))) as {
    record?: EbillingTransaction;
    error?: string;
  };
  if (!res.ok || !data.record) {
    throw new Error(data.error || 'Impossible de consulter cette transaction.');
  }
  return data.record;
}

export async function enquiryEbillingTransaction(
  reference: string,
  options?: { statusToken?: string | null; idToken?: string | null }
): Promise<EbillingTransaction> {
  const headers: Record<string, string> = {};
  if (options?.idToken) headers.Authorization = `Bearer ${options.idToken}`;
  if (options?.statusToken) headers['x-status-token'] = options.statusToken;

  const qs = options?.statusToken ? `?token=${encodeURIComponent(options.statusToken)}` : '';
  const res = await fetch(`/api/ebilling/enquiry/${encodeURIComponent(reference)}${qs}`, {
    method: 'POST',
    headers,
  });
  const data = (await res.json().catch(() => ({}))) as {
    record?: EbillingTransaction;
    message?: string;
    error?: string;
  };
  if (!res.ok || !data.record) {
    throw new Error(data.message || data.error || 'Impossible d’interroger le statut E-Billing.');
  }
  return data.record;
}

export async function fetchEbillingTransactions(idToken: string): Promise<EbillingTransaction[]> {
  const res = await fetch('/api/ebilling/transactions', {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) {
    throw new Error('Impossible de charger l’historique E-Billing.');
  }
  const data = (await res.json()) as { records?: EbillingTransaction[] };
  return data.records || [];
}
