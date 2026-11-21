import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Link2,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  Wallet,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  EBILLING_STATUS_LABELS,
  formatDateFr,
  PROVIDER_LABELS,
  validateGabonPhoneClient,
  WALLET_TX_STATUS_LABELS,
} from '../data/gabonData';
import {
  createEbillingPayment,
  enquiryEbillingTransaction,
  fetchEbillingStatus,
  fetchEbillingTransactions,
  fetchPaymentArchitecture,
} from '../services/ebillingService';
import {
  fetchWalletSummary,
  fetchWalletTransactionsPage,
  initiateWalletDepositRequest,
  initiateWalletWithdrawalRequest,
  linkWalletMobileAccount,
  verifyWalletDepositRequest,
} from '../services/walletService';
import type {
  EbillingTransaction,
  GabonMobileProvider,
  GatewayArchitectureStatus,
  WalletAccount,
  WalletLimits,
  WalletReadiness,
  WalletTransaction,
  WalletTransactionsPage,
} from '../types';

interface PaymentViewProps {
  initialReference?: string | null;
  initialStatusToken?: string | null;
  initialReturnState?: string | null;
  initialMode?: 'deposit' | 'withdraw' | 'support';
  onOpenAuthModal?: () => void;
}

const PRESET_AMOUNTS = [2500, 5000, 10000, 25000, 50000];

const PURPOSE_OPTIONS = [
  {
    id: 'numerisation',
    label: 'Numérisation et sauvegarde d’archives',
    defaultDesc: 'Soutien à la numérisation du patrimoine gabonais',
  },
  {
    id: 'enquetes',
    label: 'Bourse d’enquêtes étudiantes sur le terrain',
    defaultDesc: 'Appui aux enquêtes de terrain Gabon Patrimoine',
  },
  {
    id: 'recherche',
    label: 'Fonds pour la documentation des langues',
    defaultDesc: 'Contribution à la documentation linguistique',
  },
  {
    id: 'libre',
    label: 'Contribution libre à la mémoire collective',
    defaultDesc: 'Soutien libre Gabon Patrimoine',
  },
] as const;

export function PaymentView({
  initialReference,
  initialStatusToken,
  initialReturnState,
  initialMode = 'deposit',
  onOpenAuthModal,
}: PaymentViewProps) {
  const { profile, firebaseUser, getFreshIdToken } = useAuth();

  const [mode, setMode] = useState<'deposit' | 'withdraw' | 'support'>(() => {
    if (initialReference && !initialReference.startsWith('DEP-')) return 'support';
    return initialMode;
  });

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const [gateway, setGateway] = useState<GatewayArchitectureStatus | null>(null);
  const [loadingGateway, setLoadingGateway] = useState(true);

  // Wallet state
  const [walletAccount, setWalletAccount] = useState<WalletAccount | null>(null);
  const [walletLimits, setWalletLimits] = useState<WalletLimits | null>(null);
  const [walletReadiness, setWalletReadiness] = useState<WalletReadiness | null>(null);
  const [loadingWallet, setLoadingWallet] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [walletSuccess, setWalletSuccess] = useState<string | null>(null);

  // Link Mobile Money Account form
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkProvider, setLinkProvider] = useState<GabonMobileProvider>('airtel_money');
  const [linkPhone, setLinkPhone] = useState('');
  const [linkSaving, setLinkSaving] = useState(false);

  // Deposit form
  const [depProvider, setDepProvider] = useState<GabonMobileProvider>('airtel_money');
  const [depPhone, setDepPhone] = useState('');
  const [depAmount, setDepAmount] = useState('5000');
  const [depChannel, setDepChannel] = useState<'portal' | 'ussd'>('portal');
  const [depSubmitting, setDepSubmitting] = useState(false);
  const [activeWalletTx, setActiveWalletTx] = useState<WalletTransaction | null>(null);
  const [verifyingRef, setVerifyingRef] = useState<string | null>(null);

  // Withdrawal form
  const [wdProvider, setWdProvider] = useState<GabonMobileProvider>('airtel_money');
  const [wdPhone, setWdPhone] = useState('');
  const [wdAmount, setWdAmount] = useState('5000');
  const [wdSubmitting, setWdSubmitting] = useState(false);

  // Wallet transactions table filters & pagination
  const [txPage, setTxPage] = useState<WalletTransactionsPage>({
    items: [],
    total: 0,
    page: 1,
    pageSize: 8,
    totalPages: 1,
  });
  const [txTypeFilter, setTxTypeFilter] = useState<string>('all');
  const [txProviderFilter, setTxProviderFilter] = useState<string>('all');
  const [txStatusFilter, setTxStatusFilter] = useState<string>('all');
  const [txSearch, setTxSearch] = useState('');
  const [txPageNum, setTxPageNum] = useState(1);
  const [loadingTxPage, setLoadingTxPage] = useState(false);

  // Legacy/public E-Billing cultural support checkout state
  const [purpose, setPurpose] = useState<string>(PURPOSE_OPTIONS[0].label);
  const [amountXaf, setAmountXaf] = useState<number>(5000);
  const [customAmount, setCustomAmount] = useState<string>('5000');
  const [provider, setProvider] = useState<GabonMobileProvider>('airtel_money');
  const [paymentMethod, setPaymentMethod] = useState<'portal' | 'ussd'>('portal');
  const [payerName, setPayerName] = useState('');
  const [payerEmail, setPayerEmail] = useState('');
  const [payerMsisdn, setPayerMsisdn] = useState('');
  const [shortDescription, setShortDescription] = useState<string>(PURPOSE_OPTIONS[0].defaultDesc);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [activeRecord, setActiveRecord] = useState<EbillingTransaction | null>(null);
  const [activeStatusToken, setActiveStatusToken] = useState<string | null>(initialStatusToken || null);
  const [syncing, setSyncing] = useState(false);
  const [history, setHistory] = useState<EbillingTransaction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (profile) {
      if (!payerName) setPayerName(profile.displayName);
      if (!payerEmail) setPayerEmail(profile.email);
      if (!payerMsisdn && profile.phone) setPayerMsisdn(profile.phone);
      if (!depPhone && profile.phone) setDepPhone(profile.phone);
      if (!wdPhone && profile.phone) setWdPhone(profile.phone);
      if (!linkPhone && profile.phone) setLinkPhone(profile.phone);
    } else if (firebaseUser?.email && !payerEmail) {
      setPayerEmail(firebaseUser.email);
    }
  }, [profile, firebaseUser, payerName, payerEmail, payerMsisdn, depPhone, wdPhone, linkPhone]);

  const loadWalletTransactions = useCallback(
    async (pageNumber = txPageNum) => {
      if (!firebaseUser) return;
      setLoadingTxPage(true);
      try {
        const token = await getFreshIdToken();
        if (!token) return;
        const pageData = await fetchWalletTransactionsPage(token, {
          type: txTypeFilter,
          provider: txProviderFilter,
          status: txStatusFilter,
          search: txSearch,
          page: pageNumber,
          pageSize: 8,
        });
        setTxPage(pageData);
      } catch {
        // Keep previous state cleanly
      } finally {
        setLoadingTxPage(false);
      }
    },
    [firebaseUser, getFreshIdToken, txPageNum, txTypeFilter, txProviderFilter, txStatusFilter, txSearch]
  );

  const loadWalletAndGateway = useCallback(async () => {
    setLoadingGateway(true);
    try {
      const arch = await fetchPaymentArchitecture();
      setGateway(arch.gateway);
    } catch {
      setGateway(null);
    } finally {
      setLoadingGateway(false);
    }

    if (!firebaseUser) {
      setWalletAccount(null);
      setHistory([]);
      return;
    }

    setLoadingWallet(true);
    setLoadingHistory(true);
    try {
      const token = await getFreshIdToken();
      if (!token) return;
      const [summary, ebillRows] = await Promise.all([
        fetchWalletSummary(token).catch(() => null),
        fetchEbillingTransactions(token).catch(() => []),
      ]);
      if (summary) {
        setWalletAccount(summary.account);
        setWalletLimits(summary.limits);
        setWalletReadiness(summary.readiness);
      }
      setHistory(ebillRows);
    } finally {
      setLoadingWallet(false);
      setLoadingHistory(false);
    }
  }, [firebaseUser, getFreshIdToken]);

  useEffect(() => {
    void loadWalletAndGateway();
  }, [loadWalletAndGateway]);

  useEffect(() => {
    if (firebaseUser) {
      void loadWalletTransactions(txPageNum);
    }
  }, [firebaseUser, txPageNum, txTypeFilter, txProviderFilter, txStatusFilter, txSearch, loadWalletTransactions]);

  // Restore return from Billing Easy hosted portal (?ref=DEP-... or EBL-...)
  useEffect(() => {
    if (!initialReference) return;
    let active = true;
    async function restoreRef() {
      setSyncing(true);
      try {
        const token = firebaseUser ? await getFreshIdToken() : null;
        if (initialReference!.startsWith('DEP-')) {
          setMode('deposit');
          if (token) {
            const res = await verifyWalletDepositRequest(token, initialReference!);
            if (!active) return;
            setActiveWalletTx(res.transaction);
            setWalletAccount(res.account);
            if (res.transaction.status === 'paid') {
              setWalletSuccess(
                `Dépôt de ${res.transaction.amountXaf.toLocaleString('fr-FR')} XAF confirmé et crédité sur votre solde.`
              );
            }
            void loadWalletTransactions(1);
          }
          return;
        }

        const record = await fetchEbillingStatus(initialReference!, {
          statusToken: initialStatusToken,
          idToken: token,
        });
        if (!active) return;
        setMode('support');
        setActiveRecord(record);
        if (record.status === 'pending') {
          const synced = await enquiryEbillingTransaction(initialReference!, {
            statusToken: initialStatusToken,
            idToken: token,
          }).catch(() => record);
          if (active) setActiveRecord(synced);
        }
      } catch (err) {
        if (active) {
          const msg = err instanceof Error ? err.message : 'Impossible de retrouver la référence transmise.';
          if (initialReference!.startsWith('DEP-')) setWalletError(msg);
          else setFormError(msg);
        }
      } finally {
        if (active) setSyncing(false);
      }
    }
    void restoreRef();
    return () => {
      active = false;
    };
  }, [initialReference, initialStatusToken, firebaseUser, getFreshIdToken, loadWalletTransactions]);

  // Lightweight polling for pending wallet deposit
  useEffect(() => {
    if (!activeWalletTx || !firebaseUser) return;
    if (activeWalletTx.type !== 'deposit') return;
    if (activeWalletTx.status !== 'pending' && activeWalletTx.status !== 'processing') return;

    const timer = window.setInterval(async () => {
      try {
        const token = await getFreshIdToken();
        if (!token) return;
        const res = await verifyWalletDepositRequest(token, activeWalletTx.reference);
        setActiveWalletTx(res.transaction);
        setWalletAccount(res.account);
        if (res.transaction.status === 'paid') {
          setWalletSuccess(
            `Dépôt de ${res.transaction.amountXaf.toLocaleString('fr-FR')} XAF confirmé par votre opérateur.`
          );
          void loadWalletTransactions(1);
        }
      } catch {
        // Silent retry
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [activeWalletTx, firebaseUser, getFreshIdToken, loadWalletTransactions]);

  // Lightweight polling for legacy E-Billing support checkout
  useEffect(() => {
    if (!activeRecord || activeRecord.status !== 'pending') return;
    const timer = window.setInterval(async () => {
      try {
        const token = firebaseUser ? await getFreshIdToken() : null;
        const latest = await fetchEbillingStatus(activeRecord.externalReference, {
          statusToken: activeStatusToken,
          idToken: token,
        });
        setActiveRecord(latest);
        if (latest.status !== 'pending' && token) {
          const rows = await fetchEbillingTransactions(token).catch(() => []);
          setHistory(rows);
        }
      } catch {
        // Silent retry
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [activeRecord, activeStatusToken, firebaseUser, getFreshIdToken]);

  const handleLinkMobileAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setWalletError(null);
    setWalletSuccess(null);
    const check = validateGabonPhoneClient(linkPhone, linkProvider);
    if (!check.valid) {
      setWalletError(check.error || 'Numéro Mobile Money gabonais invalide.');
      return;
    }
    setLinkSaving(true);
    try {
      const token = await getFreshIdToken();
      if (!token) throw new Error('Session expirée : veuillez vous reconnecter.');
      const updated = await linkWalletMobileAccount(token, linkProvider, linkPhone);
      setWalletAccount(updated);
      setShowLinkForm(false);
      setWalletSuccess(
        `Numéro ${PROVIDER_LABELS[linkProvider]} vérifié et enregistré pour vos dépôts et retraits.`
      );
    } catch (err) {
      setWalletError(err instanceof Error ? err.message : 'Erreur lors de la liaison du numéro.');
    } finally {
      setLinkSaving(false);
    }
  };

  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWalletError(null);
    setWalletSuccess(null);

    const parsed = Math.round(Number(depAmount));
    const minDep = walletLimits?.minDepositXaf ?? 500;
    const maxDep = walletLimits?.maxDepositXaf ?? 2000000;
    if (!Number.isFinite(parsed) || parsed < minDep || parsed > maxDep) {
      setWalletError(
        `Le montant du dépôt doit être compris entre ${minDep.toLocaleString('fr-FR')} XAF et ${maxDep.toLocaleString('fr-FR')} XAF.`
      );
      return;
    }

    const linkedForProvider = walletAccount?.linkedAccounts[depProvider];
    if (depPhone.trim()) {
      const check = validateGabonPhoneClient(depPhone, depProvider);
      if (!check.valid) {
        setWalletError(check.error || 'Numéro gabonais invalide.');
        return;
      }
    } else if (!linkedForProvider) {
      setWalletError('Saisissez un numéro gabonais (+241) ou connectez votre compte Mobile Money.');
      return;
    }

    setDepSubmitting(true);
    try {
      const token = await getFreshIdToken();
      if (!token) throw new Error('Session expirée : veuillez vous reconnecter.');
      const res = await initiateWalletDepositRequest(token, {
        provider: depProvider,
        rawPhone: depPhone.trim() || undefined,
        amountXaf: parsed,
        mode: depChannel,
        idempotencyKey: `dep_${crypto.randomUUID()}`,
      });
      setActiveWalletTx(res.transaction);
      setWalletAccount(res.account);
      setWalletSuccess(
        depChannel === 'ussd'
          ? 'Demande USSD Push envoyée sur votre téléphone. Confirmez la saisie de votre code PIN côté opérateur.'
          : 'Facture de dépôt générée. Finalisez le paiement sur le portail sécurisé E-Billing.'
      );
      setTxPageNum(1);
      await loadWalletTransactions(1);
    } catch (err) {
      setWalletError(err instanceof Error ? err.message : 'Impossible d’initier le dépôt.');
    } finally {
      setDepSubmitting(false);
    }
  };

  const handleVerifyDeposit = async (reference: string) => {
    setVerifyingRef(reference);
    setWalletError(null);
    try {
      const token = await getFreshIdToken();
      if (!token) throw new Error('Veuillez vous reconnecter.');
      const res = await verifyWalletDepositRequest(token, reference);
      setActiveWalletTx(res.transaction);
      setWalletAccount(res.account);
      if (res.transaction.status === 'paid') {
        setWalletSuccess(
          `Dépôt ${res.transaction.reference} confirmé : +${res.transaction.amountXaf.toLocaleString('fr-FR')} XAF crédités.`
        );
      } else {
        setWalletSuccess(res.transaction.statusMessage);
      }
      await loadWalletTransactions(txPageNum);
    } catch (err) {
      setWalletError(err instanceof Error ? err.message : 'Erreur lors de la vérification du dépôt.');
    } finally {
      setVerifyingRef(null);
    }
  };

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWalletError(null);
    setWalletSuccess(null);

    const parsed = Math.round(Number(wdAmount));
    const minWd = walletLimits?.minWithdrawalXaf ?? 1000;
    const maxWd = walletLimits?.maxWithdrawalXaf ?? 1000000;
    if (!Number.isFinite(parsed) || parsed < minWd || parsed > maxWd) {
      setWalletError(
        `Le montant du retrait doit être compris entre ${minWd.toLocaleString('fr-FR')} XAF et ${maxWd.toLocaleString('fr-FR')} XAF.`
      );
      return;
    }
    if (walletAccount && parsed > walletAccount.availableXaf) {
      setWalletError(
        `Solde disponible insuffisant (${walletAccount.availableXaf.toLocaleString('fr-FR')} XAF disponibles).`
      );
      return;
    }

    const linkedForProvider = walletAccount?.linkedAccounts[wdProvider];
    if (wdPhone.trim()) {
      const check = validateGabonPhoneClient(wdPhone, wdProvider);
      if (!check.valid) {
        setWalletError(check.error || 'Numéro gabonais invalide.');
        return;
      }
    } else if (!linkedForProvider) {
      setWalletError('Saisissez votre numéro Mobile Money gabonais ou connectez un compte.');
      return;
    }

    setWdSubmitting(true);
    try {
      const token = await getFreshIdToken();
      if (!token) throw new Error('Session expirée : veuillez vous reconnecter.');
      const res = await initiateWalletWithdrawalRequest(token, {
        provider: wdProvider,
        rawPhone: wdPhone.trim() || undefined,
        amountXaf: parsed,
        idempotencyKey: `wd_${crypto.randomUUID()}`,
      });
      setActiveWalletTx(res.transaction);
      setWalletAccount(res.account);
      setWalletSuccess(
        res.transaction.status === 'paid'
          ? `Retrait de ${res.transaction.amountXaf.toLocaleString('fr-FR')} XAF envoyé avec succès.`
          : `Retrait de ${res.transaction.amountXaf.toLocaleString('fr-FR')} XAF enregistré et réservé pour traitement.`
      );
      setTxPageNum(1);
      await loadWalletTransactions(1);
    } catch (err) {
      setWalletError(err instanceof Error ? err.message : 'Impossible d’initier le retrait.');
    } finally {
      setWdSubmitting(false);
    }
  };

  // Support form handlers
  const handleSelectPreset = (val: number) => {
    setAmountXaf(val);
    setCustomAmount(String(val));
  };

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const parsedAmount = Math.round(Number(customAmount));
    if (!Number.isFinite(parsedAmount) || parsedAmount < 100 || parsedAmount > 50000000) {
      setFormError('Veuillez saisir un montant compris entre 100 XAF et 50 000 000 XAF.');
      return;
    }
    setSubmitting(true);
    try {
      const token = firebaseUser ? await getFreshIdToken() : null;
      const result = await createEbillingPayment(
        {
          amountXaf: parsedAmount,
          payerName: payerName.trim() || undefined,
          payerMsisdn,
          payerEmail,
          purpose,
          shortDescription,
          provider,
          triggerUssdPush: paymentMethod === 'ussd',
        },
        token
      );
      setActiveRecord(result.record);
      setActiveStatusToken(result.statusToken);
      if (token) {
        const rows = await fetchEbillingTransactions(token).catch(() => []);
        setHistory(rows);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Échec lors de la création de la facture E-Billing.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualSync = async (ref: string, statusTok?: string | null) => {
    setSyncing(true);
    setFormError(null);
    try {
      const token = firebaseUser ? await getFreshIdToken() : null;
      const updated = await enquiryEbillingTransaction(ref, {
        statusToken: statusTok ?? activeStatusToken,
        idToken: token,
      });
      setActiveRecord(updated);
      if (token) {
        const rows = await fetchEbillingTransactions(token).catch(() => []);
        setHistory(rows);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erreur lors de la synchronisation du statut.');
    } finally {
      setSyncing(false);
    }
  };

  const renderEbillingIcon = (status: EbillingTransaction['status']) => {
    if (status === 'paid') return <CheckCircle2 className="w-4 h-4 text-[#14532D] dark:text-emerald-400 shrink-0" />;
    if (status === 'failed' || status === 'expired')
      return <XCircle className="w-4 h-4 text-red-700 dark:text-red-400 shrink-0" />;
    return <Clock className="w-4 h-4 text-[#92400E] dark:text-amber-400 shrink-0" />;
  };

  const renderWalletIcon = (status: WalletTransaction['status']) => {
    if (status === 'paid') return <CheckCircle2 className="w-4 h-4 text-[#14532D] dark:text-emerald-400 shrink-0" />;
    if (status === 'failed' || status === 'cancelled' || status === 'rejected')
      return <XCircle className="w-4 h-4 text-red-700 dark:text-red-400 shrink-0" />;
    return <Clock className="w-4 h-4 text-[#92400E] dark:text-amber-400 shrink-0" />;
  };

  const phonePreviewCheck =
    mode === 'deposit' && depPhone.trim()
      ? validateGabonPhoneClient(depPhone, depProvider)
      : mode === 'withdraw' && wdPhone.trim()
        ? validateGabonPhoneClient(wdPhone, wdProvider)
        : null;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-10 space-y-10">
      {/* Header */}
      <section className="max-w-3xl space-y-3">
        <p className="text-xs uppercase tracking-widest text-stone-500 dark:text-stone-400">
          Portefeuille & Paiements Mobile Money · Gabon (+241)
        </p>
        <h1 className="font-display text-4xl sm:text-5xl font-semibold text-stone-900 dark:text-stone-100 leading-tight text-balance">
          Dépôts, retraits et soutiens sécurisés
        </h1>
        <p className="text-base text-stone-600 dark:text-stone-300 leading-relaxed">
          Connectez votre compte Airtel Money (074, 076, 077) ou Moov Money (060, 062, 065, 066), effectuez des dépôts par E-Billing et suivez vos retraits en toute transparence.
        </p>
      </section>

      {/* Primary Segmented Control */}
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-stone-200/75 dark:bg-stone-800/80 rounded-2xl w-fit border border-stone-200 dark:border-stone-700">
        <button
          type="button"
          onClick={() => setMode('deposit')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-colors whitespace-nowrap ${
            mode === 'deposit'
              ? 'bg-[#14532D] text-white shadow-sm'
              : 'text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white'
          }`}
        >
          <ArrowDownLeft className="w-3.5 h-3.5" />
          <span>Dépôt Mobile Money</span>
        </button>
        <button
          type="button"
          onClick={() => setMode('withdraw')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-colors whitespace-nowrap ${
            mode === 'withdraw'
              ? 'bg-[#14532D] text-white shadow-sm'
              : 'text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white'
          }`}
        >
          <ArrowUpRight className="w-3.5 h-3.5" />
          <span>Retrait Mobile Money</span>
        </button>
        <button
          type="button"
          onClick={() => setMode('support')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-colors whitespace-nowrap ${
            mode === 'support'
              ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-sm'
              : 'text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white'
          }`}
        >
          <Wallet className="w-3.5 h-3.5" />
          <span>Soutien E-Billing direct</span>
        </button>
      </div>

      {/* WALLET MODES: DEPOSIT & WITHDRAW */}
      {(mode === 'deposit' || mode === 'withdraw') && (
        <>
          {!firebaseUser || !profile ? (
            <div className="bg-white dark:bg-[#171715] border border-stone-200 dark:border-stone-800 rounded-2xl p-8 sm:p-10 text-center space-y-4">
              <Wallet className="w-8 h-8 text-[#14532D] dark:text-emerald-400 mx-auto" strokeWidth={1.6} />
              <h2 className="font-display text-2xl sm:text-3xl font-semibold text-stone-900 dark:text-stone-100">
                Connectez-vous pour accéder à votre portefeuille
              </h2>
              <p className="text-sm text-stone-600 dark:text-stone-300 max-w-lg mx-auto leading-relaxed">
                Les dépôts et retraits Mobile Money sont liés à votre compte personnel Gabon Patrimoine pour garantir la traçabilité, la vérification +241 et la protection de votre solde.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                {onOpenAuthModal && (
                  <button
                    type="button"
                    onClick={onOpenAuthModal}
                    className="px-6 py-3 bg-[#14532D] text-white text-xs font-semibold rounded-xl hover:bg-[#114224] transition-colors"
                  >
                    Se connecter / Créer un compte
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setMode('support')}
                  className="px-5 py-3 border border-stone-300 dark:border-stone-700 text-xs font-semibold text-stone-700 dark:text-stone-200 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
                >
                  Effectuer un soutien sans compte
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Balance KPI Strip */}
              <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-[#171715] border border-stone-200 dark:border-stone-800 rounded-2xl p-5">
                  <p className="text-xs text-stone-500 dark:text-stone-400">Solde disponible</p>
                  <p className="font-mono text-2xl font-semibold text-[#14532D] dark:text-emerald-400 tabular-nums mt-1">
                    {loadingWallet ? '…' : `${(walletAccount?.availableXaf ?? 0).toLocaleString('fr-FR')} XAF`}
                  </p>
                </div>
                <div className="bg-white dark:bg-[#171715] border border-stone-200 dark:border-stone-800 rounded-2xl p-5">
                  <p className="text-xs text-stone-500 dark:text-stone-400">Retraits réservés</p>
                  <p className="font-mono text-2xl font-semibold text-[#92400E] dark:text-amber-400 tabular-nums mt-1">
                    {loadingWallet ? '…' : `${(walletAccount?.pendingWithdrawalXaf ?? 0).toLocaleString('fr-FR')} XAF`}
                  </p>
                </div>
                <div className="bg-white dark:bg-[#171715] border border-stone-200 dark:border-stone-800 rounded-2xl p-5">
                  <p className="text-xs text-stone-500 dark:text-stone-400">Total déposé confirmé</p>
                  <p className="font-mono text-2xl font-semibold text-stone-900 dark:text-stone-100 tabular-nums mt-1">
                    {loadingWallet ? '…' : `${(walletAccount?.totalDepositedXaf ?? 0).toLocaleString('fr-FR')} XAF`}
                  </p>
                </div>
                <div className="bg-white dark:bg-[#171715] border border-stone-200 dark:border-stone-800 rounded-2xl p-5">
                  <p className="text-xs text-stone-500 dark:text-stone-400">Total retiré</p>
                  <p className="font-mono text-2xl font-semibold text-stone-900 dark:text-stone-100 tabular-nums mt-1">
                    {loadingWallet ? '…' : `${(walletAccount?.totalWithdrawnXaf ?? 0).toLocaleString('fr-FR')} XAF`}
                  </p>
                </div>
              </section>

              {/* Linked Mobile Money Accounts Banner */}
              <section className="bg-white dark:bg-[#171715] border border-stone-200 dark:border-stone-800 rounded-2xl p-5 sm:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <h2 className="font-display text-xl font-semibold text-stone-900 dark:text-stone-100">
                      Comptes Mobile Money connectés (+241)
                    </h2>
                    <p className="text-xs text-stone-500 dark:text-stone-400">
                      Vérification stricte des préfixes gabonais : Airtel Money (074, 076, 077) et Moov Money (060, 062, 065, 066).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowLinkForm((v) => !v)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border border-stone-300 dark:border-stone-700 rounded-xl bg-[#F9F8F6] dark:bg-stone-800 text-stone-800 dark:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-700 shrink-0"
                  >
                    <Link2 className="w-3.5 h-3.5 text-[#14532D] dark:text-emerald-400" />
                    <span>{showLinkForm ? 'Fermer' : 'Connecter / modifier un numéro'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-[#F9F8F6] dark:bg-stone-900/70 border border-stone-200 dark:border-stone-800 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-stone-900 dark:text-stone-100">Airtel Money Gabon</p>
                      <p className="text-stone-500 dark:text-stone-400 font-mono mt-0.5">
                        {walletAccount?.linkedAccounts.airtel_money?.msisdnMasked || 'Aucun numéro connecté'}
                      </p>
                    </div>
                    <span className="text-[11px] font-medium text-[#14532D] dark:text-emerald-400">
                      {walletAccount?.linkedAccounts.airtel_money ? 'Lié' : 'À lier'}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#F9F8F6] dark:bg-stone-900/70 border border-stone-200 dark:border-stone-800 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-stone-900 dark:text-stone-100">Moov Money Gabon</p>
                      <p className="text-stone-500 dark:text-stone-400 font-mono mt-0.5">
                        {walletAccount?.linkedAccounts.moov_money?.msisdnMasked || 'Aucun numéro connecté'}
                      </p>
                    </div>
                    <span className="text-[11px] font-medium text-[#14532D] dark:text-emerald-400">
                      {walletAccount?.linkedAccounts.moov_money ? 'Lié' : 'À lier'}
                    </span>
                  </div>
                </div>

                {showLinkForm && (
                  <form
                    onSubmit={handleLinkMobileAccount}
                    className="pt-3 border-t border-stone-200 dark:border-stone-800 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end"
                  >
                    <div>
                      <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                        Opérateur
                      </label>
                      <select
                        value={linkProvider}
                        onChange={(e) => setLinkProvider(e.target.value as GabonMobileProvider)}
                        className="w-full px-3 py-2 text-xs border border-stone-300 dark:border-stone-700 rounded-xl bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                      >
                        <option value="airtel_money">Airtel Money (074 / 076 / 077)</option>
                        <option value="moov_money">Moov Money (060 / 062 / 065 / 066)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                        Numéro gabonais (+241)
                      </label>
                      <input
                        type="tel"
                        required
                        value={linkPhone}
                        onChange={(e) => setLinkPhone(e.target.value)}
                        placeholder={linkProvider === 'airtel_money' ? '+241 074 XX XX XX' : '+241 062 XX XX XX'}
                        className="w-full px-3 py-2 text-xs font-mono border border-stone-300 dark:border-stone-700 rounded-xl bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={linkSaving}
                      className="px-4 py-2 bg-[#14532D] text-white text-xs font-semibold rounded-xl hover:bg-[#114224] disabled:opacity-50"
                    >
                      {linkSaving ? 'Vérification…' : 'Enregistrer ce compte'}
                    </button>
                  </form>
                )}
              </section>

              {/* Honest Gateway Readiness Notice */}
              {walletReadiness && mode === 'deposit' && !walletReadiness.depositConfigured && (
                <div className="bg-white dark:bg-[#171715] border border-amber-200 dark:border-amber-900/60 rounded-2xl p-5 text-xs space-y-1.5">
                  <p className="font-semibold uppercase tracking-widest text-[#92400E] dark:text-amber-400">
                    Passerelle de dépôt E-Billing en attente d’activation
                  </p>
                  <p className="text-stone-700 dark:text-stone-300 leading-relaxed">
                    Aucun crédit fictif n’est attribué tant que les identifiants marchands officiels Billing Easy ne sont pas renseignés dans les variables d’environnement du serveur (
                    <span className="font-mono">{walletReadiness.depositMissingEnvVars.join(', ')}</span>).
                  </p>
                </div>
              )}

              {walletReadiness && mode === 'withdraw' && !walletReadiness.withdrawalAutoConfigured && (
                <div className="bg-white dark:bg-[#171715] border border-amber-200 dark:border-amber-900/60 rounded-2xl p-5 text-xs space-y-1.5">
                  <p className="font-semibold uppercase tracking-widest text-[#92400E] dark:text-amber-400">
                    Mode de retrait : file de validation administrative
                  </p>
                  <p className="text-stone-700 dark:text-stone-300 leading-relaxed">
                    Le virement automatique SHAP attend la configuration serveur (
                    <span className="font-mono">{walletReadiness.withdrawalMissingEnvVars.join(', ')}</span>). Toute demande de retrait réserve immédiatement votre solde et est vérifiée puis exécutée par l’administrateur principal.
                  </p>
                </div>
              )}

              {walletError && (
                <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-800 dark:text-red-300">
                  {walletError}
                </div>
              )}

              {walletSuccess && (
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-900 dark:text-emerald-300">
                  {walletSuccess}
                </div>
              )}

              {/* Action Grid: Form (Left) + Live Step Tracker (Right) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {mode === 'deposit' ? (
                  <form
                    onSubmit={handleDepositSubmit}
                    className="lg:col-span-7 bg-white dark:bg-[#171715] border border-stone-200 dark:border-stone-800 rounded-2xl p-6 sm:p-8 space-y-6"
                  >
                    <div className="flex items-center justify-between gap-3 border-b border-stone-100 dark:border-stone-800 pb-4">
                      <div>
                        <h2 className="font-display text-2xl font-semibold text-stone-900 dark:text-stone-100">
                          Déposer par Mobile Money
                        </h2>
                        <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                          Crédité uniquement après validation confirmée par l’opérateur (webhook signé ou réconciliation).
                        </p>
                      </div>
                      <ArrowDownLeft className="w-5 h-5 text-[#14532D] dark:text-emerald-400 shrink-0" />
                    </div>

                    <div className="space-y-2.5">
                      <label className="block text-xs font-medium text-stone-700 dark:text-stone-300">
                        Montant du dépôt (XAF)
                      </label>
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                        {PRESET_AMOUNTS.map((val) => {
                          const selected = Number(depAmount) === val;
                          return (
                            <button
                              key={val}
                              type="button"
                              onClick={() => setDepAmount(String(val))}
                              className={`py-2 px-2.5 rounded-xl border text-xs font-mono font-medium transition-colors tabular-nums ${
                                selected
                                  ? 'bg-[#14532D] text-white border-[#14532D]'
                                  : 'bg-[#F9F8F6] dark:bg-stone-900 text-stone-800 dark:text-stone-200 border-stone-200 dark:border-stone-700 hover:border-stone-300'
                              }`}
                            >
                              {val.toLocaleString('fr-FR')}
                            </button>
                          );
                        })}
                      </div>
                      <input
                        type="number"
                        required
                        min={walletLimits?.minDepositXaf ?? 500}
                        max={walletLimits?.maxDepositXaf ?? 2000000}
                        step={1}
                        value={depAmount}
                        onChange={(e) => setDepAmount(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm font-mono border border-stone-300 dark:border-stone-700 rounded-xl bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-stone-700 dark:text-stone-300">
                          Opérateur
                        </label>
                        <select
                          value={depProvider}
                          onChange={(e) => setDepProvider(e.target.value as GabonMobileProvider)}
                          className="w-full px-3.5 py-2.5 text-sm border border-stone-300 dark:border-stone-700 rounded-xl bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                        >
                          <option value="airtel_money">Airtel Money Gabon (074 / 076 / 077)</option>
                          <option value="moov_money">Moov Money Gabon (060 / 062 / 065 / 066)</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-stone-700 dark:text-stone-300">
                          Canal de validation
                        </label>
                        <select
                          value={depChannel}
                          onChange={(e) => setDepChannel(e.target.value as 'portal' | 'ussd')}
                          className="w-full px-3.5 py-2.5 text-sm border border-stone-300 dark:border-stone-700 rounded-xl bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                        >
                          <option value="portal">Portail hébergé Billing Easy</option>
                          <option value="ussd">USSD Push direct sur mon téléphone</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-stone-700 dark:text-stone-300">
                        Numéro Mobile Money (+241)
                      </label>
                      <input
                        type="tel"
                        value={depPhone}
                        onChange={(e) => setDepPhone(e.target.value)}
                        placeholder={
                          walletAccount?.linkedAccounts[depProvider]
                            ? `Compte lié (${walletAccount.linkedAccounts[depProvider]?.msisdnMasked}) ou saisir un autre numéro`
                            : depProvider === 'airtel_money'
                              ? '+241 074 XX XX XX'
                              : '+241 062 XX XX XX'
                        }
                        className="w-full px-3.5 py-2.5 text-sm font-mono border border-stone-300 dark:border-stone-700 rounded-xl bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                      />
                      {phonePreviewCheck && !phonePreviewCheck.valid && (
                        <p className="text-[11px] text-amber-800 dark:text-amber-400">{phonePreviewCheck.error}</p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-stone-100 dark:border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                        <ShieldCheck className="w-4 h-4 text-[#14532D] dark:text-emerald-400 shrink-0" />
                        <span>Validation du code secret uniquement sur votre téléphone.</span>
                      </div>
                      <button
                        type="submit"
                        disabled={depSubmitting}
                        className="px-6 py-3 bg-[#14532D] text-white text-xs font-semibold rounded-xl hover:bg-[#114224] disabled:opacity-50 whitespace-nowrap shrink-0"
                      >
                        {depSubmitting ? 'Initialisation…' : 'Initier le dépôt Mobile Money'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <form
                    onSubmit={handleWithdrawSubmit}
                    className="lg:col-span-7 bg-white dark:bg-[#171715] border border-stone-200 dark:border-stone-800 rounded-2xl p-6 sm:p-8 space-y-6"
                  >
                    <div className="flex items-center justify-between gap-3 border-b border-stone-100 dark:border-stone-800 pb-4">
                      <div>
                        <h2 className="font-display text-2xl font-semibold text-stone-900 dark:text-stone-100">
                          Retirer vers Mobile Money
                        </h2>
                        <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                          Disponible : {(walletAccount?.availableXaf ?? 0).toLocaleString('fr-FR')} XAF · Minimum{' '}
                          {(walletLimits?.minWithdrawalXaf ?? 1000).toLocaleString('fr-FR')} XAF.
                        </p>
                      </div>
                      <ArrowUpRight className="w-5 h-5 text-[#14532D] dark:text-emerald-400 shrink-0" />
                    </div>

                    <div className="space-y-2.5">
                      <label className="block text-xs font-medium text-stone-700 dark:text-stone-300">
                        Montant du retrait (XAF)
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {[1000, 5000, 10000, 25000].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setWdAmount(String(val))}
                            className={`px-3 py-2 rounded-xl border text-xs font-mono font-medium tabular-nums ${
                              Number(wdAmount) === val
                                ? 'bg-[#14532D] text-white border-[#14532D]'
                                : 'bg-[#F9F8F6] dark:bg-stone-900 text-stone-800 dark:text-stone-200 border-stone-200 dark:border-stone-700'
                            }`}
                          >
                            {val.toLocaleString('fr-FR')}
                          </button>
                        ))}
                        {(walletAccount?.availableXaf ?? 0) >= (walletLimits?.minWithdrawalXaf ?? 1000) && (
                          <button
                            type="button"
                            onClick={() => setWdAmount(String(walletAccount?.availableXaf ?? 0))}
                            className="px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 text-xs font-medium text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800"
                          >
                            Tout le solde
                          </button>
                        )}
                      </div>
                      <input
                        type="number"
                        required
                        min={walletLimits?.minWithdrawalXaf ?? 1000}
                        max={walletLimits?.maxWithdrawalXaf ?? 1000000}
                        step={1}
                        value={wdAmount}
                        onChange={(e) => setWdAmount(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm font-mono border border-stone-300 dark:border-stone-700 rounded-xl bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-stone-700 dark:text-stone-300">
                          Opérateur bénéficiaire
                        </label>
                        <select
                          value={wdProvider}
                          onChange={(e) => setWdProvider(e.target.value as GabonMobileProvider)}
                          className="w-full px-3.5 py-2.5 text-sm border border-stone-300 dark:border-stone-700 rounded-xl bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                        >
                          <option value="airtel_money">Airtel Money Gabon (074 / 076 / 077)</option>
                          <option value="moov_money">Moov Money Gabon (060 / 062 / 065 / 066)</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-stone-700 dark:text-stone-300">
                          Numéro bénéficiaire (+241)
                        </label>
                        <input
                          type="tel"
                          value={wdPhone}
                          onChange={(e) => setWdPhone(e.target.value)}
                          placeholder={
                            walletAccount?.linkedAccounts[wdProvider]
                              ? `Compte lié (${walletAccount.linkedAccounts[wdProvider]?.msisdnMasked})`
                              : wdProvider === 'airtel_money'
                                ? '+241 074 XX XX XX'
                                : '+241 062 XX XX XX'
                          }
                          className="w-full px-3.5 py-2.5 text-sm font-mono border border-stone-300 dark:border-stone-700 rounded-xl bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                        />
                      </div>
                    </div>

                    {phonePreviewCheck && !phonePreviewCheck.valid && (
                      <p className="text-[11px] text-amber-800 dark:text-amber-400">{phonePreviewCheck.error}</p>
                    )}

                    <div className="pt-2 border-t border-stone-100 dark:border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <p className="text-xs text-stone-500 dark:text-stone-400">
                        Si un retrait est refusé ou échoue, le montant réservé est automatiquement recrédité.
                      </p>
                      <button
                        type="submit"
                        disabled={wdSubmitting || (walletAccount?.availableXaf ?? 0) < (walletLimits?.minWithdrawalXaf ?? 1000)}
                        className="px-6 py-3 bg-[#14532D] text-white text-xs font-semibold rounded-xl hover:bg-[#114224] disabled:opacity-50 whitespace-nowrap shrink-0"
                      >
                        {wdSubmitting ? 'Traitement…' : 'Confirmer la demande de retrait'}
                      </button>
                    </div>
                  </form>
                )}

                {/* Right: Active Transaction Live Tracker */}
                <aside className="lg:col-span-5 space-y-5">
                  <div className="bg-white dark:bg-[#171715] border border-stone-200 dark:border-stone-800 rounded-2xl p-6 space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-display text-2xl font-semibold text-stone-900 dark:text-stone-100">
                        Suivi en direct
                      </h3>
                      {activeWalletTx && activeWalletTx.type === 'deposit' && (
                        <button
                          type="button"
                          disabled={verifyingRef === activeWalletTx.reference}
                          onClick={() => void handleVerifyDeposit(activeWalletTx.reference)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-stone-300 dark:border-stone-700 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-800"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${verifyingRef === activeWalletTx.reference ? 'animate-spin' : ''}`} />
                          <span>Vérifier</span>
                        </button>
                      )}
                    </div>

                    {!activeWalletTx ? (
                      <div className="py-8 text-center space-y-2.5 border-t border-stone-100 dark:border-stone-800">
                        <Smartphone className="w-7 h-7 text-stone-400 mx-auto" strokeWidth={1.5} />
                        <p className="text-sm font-medium text-stone-800 dark:text-stone-200">
                          Parcours guidé Mobile Money
                        </p>
                        <ol className="text-xs text-stone-500 dark:text-stone-400 text-left max-w-xs mx-auto space-y-1.5 list-decimal pl-4">
                          <li>Saisissez votre numéro Airtel (+241 074/076/077) ou Moov (+241 060/062/065/066).</li>
                          <li>Validez votre code PIN directement sur votre téléphone ou le portail E-Billing.</li>
                          <li>Le reçu et le solde se mettent à jour dès réception de la confirmation signée.</li>
                        </ol>
                      </div>
                    ) : (
                      <div className="space-y-4 border-t border-stone-100 dark:border-stone-800 pt-4 text-xs">
                        <div className="flex items-center justify-between gap-3">
                          <div className="inline-flex items-center gap-2 font-semibold text-stone-900 dark:text-stone-100 text-sm">
                            {renderWalletIcon(activeWalletTx.status)}
                            <span>{WALLET_TX_STATUS_LABELS[activeWalletTx.status]}</span>
                          </div>
                          <span className="font-mono text-base font-semibold text-stone-900 dark:text-stone-100 tabular-nums">
                            {activeWalletTx.amountXaf.toLocaleString('fr-FR')} XAF
                          </span>
                        </div>

                        <p className="text-stone-600 dark:text-stone-300 leading-relaxed">
                          {activeWalletTx.statusMessage}
                        </p>

                        <dl className="space-y-2 bg-[#F9F8F6] dark:bg-stone-900/70 border border-stone-200 dark:border-stone-800 rounded-xl p-4">
                          <div className="flex justify-between gap-2">
                            <dt className="text-stone-500 dark:text-stone-400">Référence</dt>
                            <dd className="font-mono text-stone-900 dark:text-stone-100">{activeWalletTx.reference}</dd>
                          </div>
                          <div className="flex justify-between gap-2">
                            <dt className="text-stone-500 dark:text-stone-400">Opérateur</dt>
                            <dd className="font-medium text-stone-900 dark:text-stone-100">
                              {PROVIDER_LABELS[activeWalletTx.provider]}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-2">
                            <dt className="text-stone-500 dark:text-stone-400">Numéro</dt>
                            <dd className="font-mono text-stone-800 dark:text-stone-200">{activeWalletTx.msisdnMasked}</dd>
                          </div>
                          {activeWalletTx.providerTransactionId && (
                            <div className="flex justify-between gap-2">
                              <dt className="text-stone-500 dark:text-stone-400">Réf. opérateur</dt>
                              <dd className="font-mono text-[#14532D] dark:text-emerald-400">
                                {activeWalletTx.providerTransactionId}
                              </dd>
                            </div>
                          )}
                          <div className="flex justify-between gap-2">
                            <dt className="text-stone-500 dark:text-stone-400">Date</dt>
                            <dd className="font-mono text-stone-700 dark:text-stone-300">
                              {formatDateFr(activeWalletTx.updatedAt)}
                            </dd>
                          </div>
                        </dl>

                        {activeWalletTx.status === 'pending' && activeWalletTx.paymentUrl && (
                          <a
                            href={activeWalletTx.paymentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#14532D] text-white font-semibold rounded-xl hover:bg-[#114224]"
                          >
                            <span>Ouvrir le portail E-Billing</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </aside>
              </div>

              {/* Filtered & Paginated Wallet Transaction History */}
              <section className="bg-white dark:bg-[#171715] border border-stone-200 dark:border-stone-800 rounded-2xl p-6 space-y-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-2xl font-semibold text-stone-900 dark:text-stone-100">
                      Historique des transactions ({txPage.total})
                    </h2>
                    <p className="text-xs text-stone-500 dark:text-stone-400">
                      Dépôts, retraits, références opérateur et suivi des confirmations.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadWalletTransactions(txPageNum)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#14532D] dark:text-emerald-400 hover:underline self-start md:self-auto"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingTxPage ? 'animate-spin' : ''}`} />
                    <span>Actualiser</span>
                  </button>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="search"
                      value={txSearch}
                      onChange={(e) => {
                        setTxSearch(e.target.value);
                        setTxPageNum(1);
                      }}
                      placeholder="Référence, numéro…"
                      className="w-full pl-9 pr-3 py-2 text-xs border border-stone-300 dark:border-stone-700 rounded-xl bg-[#F9F8F6] dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                    />
                  </div>
                  <select
                    value={txTypeFilter}
                    onChange={(e) => {
                      setTxTypeFilter(e.target.value);
                      setTxPageNum(1);
                    }}
                    className="px-3 py-2 text-xs border border-stone-300 dark:border-stone-700 rounded-xl bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                  >
                    <option value="all">Tous les types</option>
                    <option value="deposit">Dépôts uniquement</option>
                    <option value="withdrawal">Retraits uniquement</option>
                  </select>
                  <select
                    value={txProviderFilter}
                    onChange={(e) => {
                      setTxProviderFilter(e.target.value);
                      setTxPageNum(1);
                    }}
                    className="px-3 py-2 text-xs border border-stone-300 dark:border-stone-700 rounded-xl bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                  >
                    <option value="all">Tous les opérateurs</option>
                    <option value="airtel_money">Airtel Money</option>
                    <option value="moov_money">Moov Money</option>
                  </select>
                  <select
                    value={txStatusFilter}
                    onChange={(e) => {
                      setTxStatusFilter(e.target.value);
                      setTxPageNum(1);
                    }}
                    className="px-3 py-2 text-xs border border-stone-300 dark:border-stone-700 rounded-xl bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                  >
                    <option value="all">Tous les statuts</option>
                    <option value="pending">En attente</option>
                    <option value="processing">Traitement en cours</option>
                    <option value="paid">Réussi</option>
                    <option value="failed">Échoué</option>
                    <option value="rejected">Refusé</option>
                    <option value="cancelled">Annulé</option>
                  </select>
                </div>

                {loadingTxPage ? (
                  <p className="text-xs text-stone-500 dark:text-stone-400">Chargement de l’historique…</p>
                ) : txPage.items.length === 0 ? (
                  <p className="text-xs text-stone-500 dark:text-stone-400 py-4">
                    Aucune transaction ne correspond à ces critères pour le moment.
                  </p>
                ) : (
                  <div className="divide-y divide-stone-200 dark:divide-stone-800">
                    {txPage.items.map((tx) => (
                      <div
                        key={tx.id}
                        className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {renderWalletIcon(tx.status)}
                            <span className="font-semibold text-stone-900 dark:text-stone-100">
                              {tx.type === 'deposit' ? 'Dépôt' : 'Retrait'} · {WALLET_TX_STATUS_LABELS[tx.status]}
                            </span>
                            <span className="text-stone-400" aria-hidden="true">·</span>
                            <span className="font-mono text-stone-700 dark:text-stone-300">{tx.reference}</span>
                          </div>
                          <p className="text-stone-600 dark:text-stone-400">
                            {PROVIDER_LABELS[tx.provider]} · {tx.msisdnMasked} · {formatDateFr(tx.createdAt)}
                          </p>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span
                            className={`font-mono text-sm font-semibold tabular-nums ${
                              tx.type === 'deposit'
                                ? 'text-[#14532D] dark:text-emerald-400'
                                : 'text-stone-900 dark:text-stone-100'
                            }`}
                          >
                            {tx.type === 'deposit' ? '+' : '-'}
                            {tx.amountXaf.toLocaleString('fr-FR')} XAF
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveWalletTx(tx);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="px-3 py-1.5 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-medium text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800"
                          >
                            Détail
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {txPage.totalPages > 1 && (
                  <div className="pt-3 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between text-xs">
                    <span className="text-stone-500 dark:text-stone-400">
                      Page {txPage.page} sur {txPage.totalPages}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={txPage.page <= 1}
                        onClick={() => setTxPageNum((p) => Math.max(1, p - 1))}
                        className="inline-flex items-center gap-1 px-3 py-1.5 border border-stone-300 dark:border-stone-700 rounded-lg disabled:opacity-40"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>Précédent</span>
                      </button>
                      <button
                        type="button"
                        disabled={txPage.page >= txPage.totalPages}
                        onClick={() => setTxPageNum((p) => Math.min(txPage.totalPages, p + 1))}
                        className="inline-flex items-center gap-1 px-3 py-1.5 border border-stone-300 dark:border-stone-700 rounded-lg disabled:opacity-40"
                      >
                        <span>Suivant</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </section>
            </div>
          )}
        </>
      )}

      {/* SUPPORT MODE: DIRECT PUBLIC E-BILLING CHECKOUT (PRESERVED) */}
      {mode === 'support' && (
        <div className="space-y-8">
          {!loadingGateway && gateway && !gateway.ebilling.configured && (
            <div className="bg-white dark:bg-[#171715] border border-amber-200 dark:border-amber-900/60 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-widest text-[#92400E] dark:text-amber-400">
                  Passerelle E-Billing en attente d’activation
                </p>
                <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed">
                  Le service E-Billing côté serveur attend les identifiants marchands officiels Billing Easy avant d’émettre des factures réelles. Aucune transaction fictive n’est simulée.
                </p>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Variables requises dans les secrets serveur :{' '}
                  <span className="font-mono text-stone-800 dark:text-stone-200">
                    {gateway.ebilling.missingEnvVars.join(', ')}
                  </span>
                </p>
              </div>
              <div className="text-xs text-stone-600 dark:text-stone-300 shrink-0 sm:text-right space-y-1">
                <p className="font-medium text-stone-800 dark:text-stone-200">Callback webhook actif</p>
                <code className="font-mono text-[11px] text-[#14532D] dark:text-emerald-400 break-all">
                  {gateway.ebilling.callbackUrl}
                </code>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <form
              onSubmit={handleSupportSubmit}
              className="lg:col-span-7 bg-white dark:bg-[#171715] border border-stone-200 dark:border-stone-800 rounded-2xl p-6 sm:p-8 space-y-6"
            >
              <div className="flex items-center justify-between gap-3 border-b border-stone-100 dark:border-stone-800 pb-4">
                <div>
                  <h2 className="font-display text-2xl font-semibold text-stone-900 dark:text-stone-100">
                    Soutien direct par facture E-Billing
                  </h2>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                    Montant en Franc CFA (XAF) · Aucun code PIN n’est saisi sur ce site
                  </p>
                </div>
                <Wallet className="w-5 h-5 text-[#14532D] dark:text-emerald-400 shrink-0" />
              </div>

              {formError && (
                <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-800 dark:text-red-300 leading-relaxed">
                  {formError}
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300">
                  Affectation du règlement
                </label>
                <select
                  value={purpose}
                  onChange={(e) => {
                    const chosen = PURPOSE_OPTIONS.find((p) => p.label === e.target.value);
                    setPurpose(e.target.value);
                    if (chosen) setShortDescription(chosen.defaultDesc);
                  }}
                  className="w-full px-3.5 py-2.5 text-sm border border-stone-300 dark:border-stone-700 rounded-xl bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                >
                  {PURPOSE_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.label}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2.5">
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300">Montant (XAF)</label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {PRESET_AMOUNTS.map((val) => {
                    const selected = amountXaf === val && Number(customAmount) === val;
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handleSelectPreset(val)}
                        className={`py-2 px-2.5 rounded-xl border text-xs font-mono font-medium transition-colors tabular-nums ${
                          selected
                            ? 'bg-[#14532D] text-white border-[#14532D]'
                            : 'bg-[#F9F8F6] dark:bg-stone-900 text-stone-800 dark:text-stone-200 border-stone-200 dark:border-stone-700'
                        }`}
                      >
                        {val.toLocaleString('fr-FR')}
                      </button>
                    );
                  })}
                </div>
                <input
                  type="number"
                  min={100}
                  max={50000000}
                  step={1}
                  required
                  aria-label="Montant personnalisé en XAF"
                  value={customAmount}
                  onChange={(e) => {
                    setCustomAmount(e.target.value);
                    const parsed = Math.round(Number(e.target.value));
                    if (Number.isFinite(parsed)) setAmountXaf(parsed);
                  }}
                  className="w-full px-3.5 py-2.5 text-sm font-mono border border-stone-300 dark:border-stone-700 rounded-xl bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300">
                    Opérateur Mobile Money
                  </label>
                  <select
                    value={provider}
                    onChange={(e) => setProvider(e.target.value as GabonMobileProvider)}
                    className="w-full px-3.5 py-2.5 text-sm border border-stone-300 dark:border-stone-700 rounded-xl bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                  >
                    <option value="airtel_money">Airtel Money Gabon (074 / 077 / 076)</option>
                    <option value="moov_money">Moov Money Gabon (060 / 062 / 066 / 065)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300">
                    Mode de validation
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as 'portal' | 'ussd')}
                    className="w-full px-3.5 py-2.5 text-sm border border-stone-300 dark:border-stone-700 rounded-xl bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                  >
                    <option value="portal">Portail hébergé Billing Easy (recommandé)</option>
                    <option value="ussd">USSD Push direct sur mon téléphone</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300">
                    Nom complet (facultatif)
                  </label>
                  <input
                    type="text"
                    value={payerName}
                    onChange={(e) => setPayerName(e.target.value)}
                    placeholder="Ex. Jean-Marc Ndong"
                    className="w-full px-3.5 py-2.5 text-sm border border-stone-300 dark:border-stone-700 rounded-xl bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300">
                    Numéro Mobile Money au Gabon *
                  </label>
                  <input
                    type="tel"
                    required
                    value={payerMsisdn}
                    onChange={(e) => setPayerMsisdn(e.target.value)}
                    placeholder="074 00 00 00"
                    className="w-full px-3.5 py-2.5 text-sm font-mono border border-stone-300 dark:border-stone-700 rounded-xl bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300">
                    Adresse e-mail de reçu *
                  </label>
                  <input
                    type="email"
                    required
                    value={payerEmail}
                    onChange={(e) => setPayerEmail(e.target.value)}
                    placeholder="vous@exemple.ga"
                    className="w-full px-3.5 py-2.5 text-sm border border-stone-300 dark:border-stone-700 rounded-xl bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300">
                    Libellé sur la facture *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={140}
                    value={shortDescription}
                    onChange={(e) => setShortDescription(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm border border-stone-300 dark:border-stone-700 rounded-xl bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                  />
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-stone-100 dark:border-stone-800">
                <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                  <ShieldCheck className="w-4 h-4 text-[#14532D] dark:text-emerald-400 shrink-0" />
                  <span>Signature HMAC vérifiée sur chaque confirmation de paiement.</span>
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-3 bg-[#14532D] text-white text-sm font-semibold rounded-xl hover:bg-[#114224] disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  {submitting
                    ? 'Initialisation E-Billing…'
                    : paymentMethod === 'ussd'
                      ? 'Envoyer la demande USSD Push'
                      : 'Créer la facture E-Billing'}
                </button>
              </div>
            </form>

            <aside className="lg:col-span-5 space-y-6">
              <div className="bg-white dark:bg-[#171715] border border-stone-200 dark:border-stone-800 rounded-2xl p-6 space-y-5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-display text-2xl font-semibold text-stone-900 dark:text-stone-100">
                    Suivi & Reçu
                  </h2>
                  {activeRecord && (
                    <button
                      type="button"
                      onClick={() => void handleManualSync(activeRecord.externalReference)}
                      disabled={syncing}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-stone-300 dark:border-stone-700 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-800"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                      <span>Actualiser</span>
                    </button>
                  )}
                </div>

                {initialReturnState === 'succes' && activeRecord?.status === 'pending' && (
                  <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs text-amber-950 dark:text-amber-300">
                    Retour du portail détecté : attente de confirmation définitive du webhook E-Billing.
                  </div>
                )}

                {!activeRecord ? (
                  <div className="py-10 text-center space-y-3 border-t border-stone-100 dark:border-stone-800">
                    <Smartphone className="w-7 h-7 text-stone-400 mx-auto" strokeWidth={1.5} />
                    <p className="text-sm font-medium text-stone-800 dark:text-stone-200">Aucune facture active</p>
                    <p className="text-xs text-stone-500 dark:text-stone-400 max-w-xs mx-auto leading-relaxed">
                      Générez une facture à gauche pour obtenir le lien du portail Billing Easy ou déclencher un USSD Push.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 border-t border-stone-100 dark:border-stone-800 pt-4 text-xs">
                    <div className="flex items-center justify-between gap-3">
                      <div className="inline-flex items-center gap-2 font-semibold text-stone-900 dark:text-stone-100 text-sm">
                        {renderEbillingIcon(activeRecord.status)}
                        <span>{EBILLING_STATUS_LABELS[activeRecord.status]}</span>
                      </div>
                      <span className="font-mono text-base font-semibold text-stone-900 dark:text-stone-100 tabular-nums">
                        {activeRecord.amountXaf.toLocaleString('fr-FR')} XAF
                      </span>
                    </div>

                    <dl className="space-y-2.5 bg-[#F9F8F6] dark:bg-stone-900/70 border border-stone-200 dark:border-stone-800 rounded-xl p-4">
                      <div className="flex justify-between gap-3">
                        <dt className="text-stone-500 dark:text-stone-400">Référence externe</dt>
                        <dd className="font-mono text-stone-900 dark:text-stone-100">{activeRecord.externalReference}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-stone-500 dark:text-stone-400">Identifiant eBill</dt>
                        <dd className="font-mono text-stone-900 dark:text-stone-100">{activeRecord.billId}</dd>
                      </div>
                      {activeRecord.operator && (
                        <div className="flex justify-between gap-3">
                          <dt className="text-stone-500 dark:text-stone-400">Opérateur</dt>
                          <dd className="text-stone-900 dark:text-stone-100 font-medium">
                            {PROVIDER_LABELS[activeRecord.operator] || activeRecord.operator}
                          </dd>
                        </div>
                      )}
                      <div className="flex justify-between gap-3">
                        <dt className="text-stone-500 dark:text-stone-400">Numéro</dt>
                        <dd className="font-mono text-stone-800 dark:text-stone-200">{activeRecord.payerMsisdnMasked}</dd>
                      </div>
                      {activeRecord.providerTransactionId && (
                        <div className="flex justify-between gap-3">
                          <dt className="text-stone-500 dark:text-stone-400">Réf. opérateur</dt>
                          <dd className="font-mono text-[#14532D] dark:text-emerald-400 font-medium">
                            {activeRecord.providerTransactionId}
                          </dd>
                        </div>
                      )}
                      <div className="flex justify-between gap-3">
                        <dt className="text-stone-500 dark:text-stone-400">Mise à jour</dt>
                        <dd className="font-mono text-stone-700 dark:text-stone-300">
                          {formatDateFr(activeRecord.updatedAt)}
                        </dd>
                      </div>
                    </dl>

                    {activeRecord.ussdPushId !== undefined && activeRecord.ussdPushId !== null && (
                      <p className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-950 dark:text-emerald-300">
                        Notification USSD Push #{String(activeRecord.ussdPushId)} envoyée sur votre téléphone.
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-2.5 pt-1">
                      {activeRecord.status === 'pending' && activeRecord.paymentUrl && (
                        <a
                          href={activeRecord.paymentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#14532D] text-white font-semibold rounded-xl hover:bg-[#114224]"
                        >
                          <span>Ouvrir le portail E-Billing</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2.5 border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 font-medium rounded-xl hover:bg-stone-50 dark:hover:bg-stone-800"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Imprimer le reçu</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {gateway && (
                <div className="bg-white dark:bg-[#171715] border border-stone-200 dark:border-stone-800 rounded-2xl p-5 space-y-2 text-xs text-stone-600 dark:text-stone-300">
                  <p className="font-semibold text-stone-900 dark:text-stone-100">
                    Architecture de vérification E-Billing
                  </p>
                  <p className="leading-relaxed">
                    Notifications reçues sur{' '}
                    <code className="font-mono text-stone-900 dark:text-stone-100">/api/ebilling/callback</code>, contrôlées par signature HMAC-SHA256.
                  </p>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">
                    Signature webhook :{' '}
                    <strong className={gateway.ebilling.webhookSecretConfigured ? 'text-[#14532D] dark:text-emerald-400' : 'text-[#92400E] dark:text-amber-400'}>
                      {gateway.ebilling.webhookSecretConfigured ? 'Activée' : 'En attente de EBILLING_WEBHOOK_SECRET'}
                    </strong>
                  </p>
                </div>
              )}
            </aside>
          </div>

          {firebaseUser && (
            <section className="bg-white dark:bg-[#171715] border border-stone-200 dark:border-stone-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl font-semibold text-stone-900 dark:text-stone-100">
                    Historique de vos paiements E-Billing
                  </h2>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    Factures générées depuis votre compte avec mise à jour automatique par callback.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadWalletAndGateway()}
                  className="text-xs font-medium text-[#14532D] dark:text-emerald-400 hover:underline"
                >
                  Actualiser la liste
                </button>
              </div>

              {loadingHistory ? (
                <p className="text-xs text-stone-500 dark:text-stone-400">Chargement de vos transactions…</p>
              ) : history.length === 0 ? (
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Aucune facture E-Billing associée à votre compte pour le moment.
                </p>
              ) : (
                <div className="divide-y divide-stone-200 dark:divide-stone-800">
                  {history.map((tx) => (
                    <div
                      key={tx.externalReference}
                      className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {renderEbillingIcon(tx.status)}
                          <span className="font-semibold text-stone-900 dark:text-stone-100">
                            {EBILLING_STATUS_LABELS[tx.status]}
                          </span>
                          <span className="text-stone-400" aria-hidden="true">·</span>
                          <span className="font-mono text-stone-700 dark:text-stone-300">{tx.externalReference}</span>
                        </div>
                        <p className="text-stone-600 dark:text-stone-400">
                          {tx.shortDescription} · {tx.payerMsisdnMasked} · {formatDateFr(tx.createdAt)}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-mono text-sm font-semibold text-stone-900 dark:text-stone-100 tabular-nums">
                          {tx.amountXaf.toLocaleString('fr-FR')} XAF
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveRecord(tx);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="px-3 py-1.5 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-medium text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800"
                        >
                          Consulter
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
