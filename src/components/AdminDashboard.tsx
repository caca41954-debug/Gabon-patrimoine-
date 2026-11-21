import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  History,
  Pencil,
  RefreshCw,
  Search,
  Send,
  Share2,
  Shield,
  Trash2,
  UserPlus,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  ASSISTANCE_STATUS_LABELS,
  EBILLING_STATUS_LABELS,
  formatDateFr,
  GABON_PROVINCES,
  PAYOUT_STATUS_LABELS,
  PERMISSION_LABELS,
  PROVIDER_LABELS,
  REPORT_CATEGORY_LABELS,
  REPORT_STATUS_LABELS,
  REWARD_STATUS_LABELS,
  ROLE_LABELS,
  SOCIAL_PLATFORM_LABELS,
  STATUS_LABELS,
  TRANSACTION_STATUS_LABELS,
  WALLET_TX_STATUS_LABELS,
} from '../data/gabonData';
import {
  enquiryEbillingTransaction,
  fetchEbillingTransactions,
} from '../services/ebillingService';
import {
  adminProcessManualPayout,
  adminReconcileShapTransaction,
  adminRecordShapPayoutResult,
  adminUpdateUser,
  createAssistedAccount,
  createReward,
  deleteSocialLink,
  fetchAllContributionsForModeration,
  fetchAllPayoutRequests,
  fetchAllRewards,
  fetchAllSocialLinks,
  fetchAllTransactions,
  fetchAllUsers,
  fetchAssistedAccounts,
  fetchAuditLogs,
  fetchFirestoreAssistanceRequests,
  fetchModerationEventsForContribution,
  fetchReports,
  moderateContribution,
  saveSocialLink,
  seedOfficialCategories,
  updateFirestoreAssistanceRequest,
  updateReportStatus,
} from '../services/firestoreService';
import {
  decideAdminWalletWithdrawal,
  downloadAdminWalletCsv,
  fetchAdminWalletOverview,
} from '../services/walletService';
import type {
  AssistanceRequest,
  AssistedAccount,
  AuditLog,
  ContentReport,
  Contribution,
  ContributionStatus,
  EbillingTransaction,
  FinancialTransaction,
  GatewayArchitectureStatus,
  MobileMoneyProviderStatus,
  ModerationEvent,
  PayoutRequest,
  Reward,
  SocialLink,
  SocialPlatform,
  UserProfile,
  UserRole,
  VerificationLabel,
  WalletAdminOverview,
} from '../types';
import { MediaAssetRenderer } from './ArchivalImage';
import { ContributionStatusIndicator } from './ContributionStatusIndicator';

export function AdminDashboard() {
  const { profile, getFreshIdToken } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const isStaff = profile?.role === 'admin' || profile?.role === 'moderator';

  const [tab, setTab] = useState<'moderation' | 'users' | 'reports' | 'rewards' | 'social' | 'audit'>('moderation');
  const [loading, setLoading] = useState(true);

  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [assistedAccounts, setAssistedAccounts] = useState<AssistedAccount[]>([]);
  const [assistanceRequests, setAssistanceRequests] = useState<AssistanceRequest[]>([]);
  const [reports, setReports] = useState<ContentReport[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [ebillingTransactions, setEbillingTransactions] = useState<EbillingTransaction[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [providers, setProviders] = useState<MobileMoneyProviderStatus[]>([]);
  const [gatewayStatus, setGatewayStatus] = useState<GatewayArchitectureStatus | null>(null);
  const [shapBalanceInfo, setShapBalanceInfo] = useState<string | null>(null);
  const [shapBalanceLoading, setShapBalanceLoading] = useState(false);

  // Wallet Admin Supervision state
  const [walletOverview, setWalletOverview] = useState<WalletAdminOverview | null>(null);
  const [walletFilterType, setWalletFilterType] = useState('all');
  const [walletFilterProvider, setWalletFilterProvider] = useState('all');
  const [walletFilterStatus, setWalletFilterStatus] = useState('all');
  const [walletSearch, setWalletSearch] = useState('');
  const [walletPageNum, setWalletPageNum] = useState(1);
  const [walletBusyId, setWalletBusyId] = useState<string | null>(null);
  const [walletManualRefs, setWalletManualRefs] = useState<Record<string, string>>({});
  const [walletAdminNotes, setWalletAdminNotes] = useState<Record<string, string>>({});
  const [walletCsvBusy, setWalletCsvBusy] = useState(false);

  // Filters & inline operational feedback
  const [modQueueFilter, setModQueueFilter] = useState<'pending' | 'published' | 'all'>('pending');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Moderation review state
  const [selectedContrib, setSelectedContrib] = useState<Contribution | null>(null);
  const [contribModEvents, setContribModEvents] = useState<ModerationEvent[]>([]);
  const [modDecision, setModDecision] = useState<ContributionStatus>('published');
  const [modLabel, setModLabel] = useState<VerificationLabel>('relu');
  const [modReason, setModReason] = useState('');
  const [modInternalNote, setModInternalNote] = useState('');
  const [modSensitiveLoc, setModSensitiveLoc] = useState(false);
  const [modSaving, setModSaving] = useState(false);

  // Assisted account creation state
  const [assistName, setAssistName] = useState('');
  const [assistEmail, setAssistEmail] = useState('');
  const [assistPhone, setAssistPhone] = useState('');
  const [assistRole, setAssistRole] = useState<AssistedAccount['role']>('citizen');
  const [assistProvince, setAssistProvince] = useState('Estuaire');
  const [assistInstitution, setAssistInstitution] = useState('');
  const [assistNotes, setAssistNotes] = useState('');
  const [assistSaving, setAssistSaving] = useState(false);

  // Reward creation state
  const [rewardUserId, setRewardUserId] = useState('');
  const [rewardPeriod, setRewardPeriod] = useState('T4 2026');
  const [rewardAmount, setRewardAmount] = useState('50000');
  const [rewardWork, setRewardWork] = useState('');
  const [rewardCriteria, setRewardCriteria] = useState('');
  const [rewardAnnounce, setRewardAnnounce] = useState(true);
  const [rewardSaving, setRewardSaving] = useState(false);

  // Payout reference & SHAP state
  const [payoutRefs, setPayoutRefs] = useState<Record<string, string>>({});
  const [payoutPhoneOverrides, setPayoutPhoneOverrides] = useState<Record<string, string>>({});
  const [payoutFeedback, setPayoutFeedback] = useState<Record<string, string>>({});
  const [payoutBusyId, setPayoutBusyId] = useState<string | null>(null);

  // E-Billing test/checkout state
  const [ebillAmount, setEbillAmount] = useState('5000');
  const [ebillPhone, setEbillPhone] = useState('');
  const [ebillEmail, setEbillEmail] = useState('');
  const [ebillDesc, setEbillDesc] = useState('Soutien Gabon Patrimoine');
  const [ebillProvider, setEbillProvider] = useState<'airtel_money' | 'moov_money'>('airtel_money');
  const [ebillPush, setEbillPush] = useState(false);
  const [ebillResult, setEbillResult] = useState<string | null>(null);
  const [ebillPortalUrl, setEbillPortalUrl] = useState<string | null>(null);
  const [ebillBusy, setEbillBusy] = useState(false);
  const [ebillSyncingRef, setEbillSyncingRef] = useState<string | null>(null);

  // Social Links CRUD state
  const [editingSocialId, setEditingSocialId] = useState<string | null>(null);
  const [socialPlatform, setSocialPlatform] = useState<SocialPlatform>('facebook');
  const [socialLabel, setSocialLabel] = useState('');
  const [socialUrl, setSocialUrl] = useState('');
  const [socialOrder, setSocialOrder] = useState('1');
  const [socialActive, setSocialActive] = useState(true);
  const [socialSaving, setSocialSaving] = useState(false);
  const [confirmDeleteSocialId, setConfirmDeleteSocialId] = useState<string | null>(null);

  const [seedMessage, setSeedMessage] = useState<string | null>(null);

  const loadWalletOverview = useCallback(
    async (page = walletPageNum) => {
      if (!isAdmin) return;
      const freshToken = await getFreshIdToken();
      if (!freshToken) return;
      const data = await fetchAdminWalletOverview(freshToken, {
        type: walletFilterType,
        provider: walletFilterProvider,
        status: walletFilterStatus,
        search: walletSearch,
        page,
        pageSize: 10,
      }).catch(() => null);
      if (data) setWalletOverview(data);
    },
    [isAdmin, getFreshIdToken, walletFilterType, walletFilterProvider, walletFilterStatus, walletSearch, walletPageNum]
  );

  const loadAll = useCallback(async () => {
    if (!isStaff) return;
    setLoading(true);
    setActionError(null);
    try {
      const freshToken = await getFreshIdToken();
      if (!freshToken) return;

      const [contribs, rpts, provRes] = await Promise.all([
        fetchAllContributionsForModeration(),
        fetchReports(),
        fetch('/api/payments/providers').then(
          (r) =>
            r.json() as Promise<{
              providers?: MobileMoneyProviderStatus[];
              gateway?: GatewayArchitectureStatus;
            }>
        ),
      ]);
      setContributions(contribs);
      setReports(rpts);
      setProviders(provRes.providers || []);
      setGatewayStatus(provRes.gateway || null);

      if (isAdmin) {
        const [uList, astList, fsAssist, pubAssistRes, rwdList, payList, txList, ebillList, audList, socList] =
          await Promise.all([
            fetchAllUsers(),
            fetchAssistedAccounts(),
            fetchFirestoreAssistanceRequests(),
            fetch('/api/admin/assistance', {
              headers: { Authorization: `Bearer ${freshToken}` },
            }).then((r) => (r.ok ? (r.json() as Promise<{ requests?: AssistanceRequest[] }>) : { requests: [] })),
            fetchAllRewards(),
            fetchAllPayoutRequests(),
            fetchAllTransactions(),
            fetchEbillingTransactions(freshToken).catch(() => []),
            fetchAuditLogs(),
            fetchAllSocialLinks().catch(() => []),
          ]);
        setUsers(uList);
        if (uList.length > 0) {
          setRewardUserId((prev) => prev || uList[0].uid);
        }
        setAssistedAccounts(astList);
        const pubItems = (pubAssistRes.requests || []).map((item) => ({ ...item, source: 'public_inbox' as const }));
        setAssistanceRequests([...pubItems, ...fsAssist]);
        setRewards(rwdList);
        setPayouts(payList);
        setTransactions(txList);
        setEbillingTransactions(ebillList);
        setAuditLogs(audList);
        setSocialLinks(socList);
        await loadWalletOverview(walletPageNum);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Impossible de charger les données d’administration.');
    } finally {
      setLoading(false);
    }
  }, [isStaff, isAdmin, getFreshIdToken, loadWalletOverview, walletPageNum]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (isAdmin) {
      void loadWalletOverview(walletPageNum);
    }
  }, [isAdmin, walletPageNum, walletFilterType, walletFilterProvider, walletFilterStatus, walletSearch, loadWalletOverview]);

  useEffect(() => {
    let active = true;
    if (!selectedContrib) {
      setContribModEvents([]);
      return;
    }
    fetchModerationEventsForContribution(selectedContrib.id)
      .then((ev) => {
        if (active) setContribModEvents(ev);
      })
      .catch(() => {
        if (active) setContribModEvents([]);
      });
    return () => {
      active = false;
    };
  }, [selectedContrib]);

  if (!isStaff || !profile) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-16">
        <div className="bg-white dark:bg-[#171715] border border-stone-200 dark:border-stone-800 rounded-2xl p-8 text-center space-y-3">
          <Shield className="w-8 h-8 text-stone-500 mx-auto" />
          <h1 className="font-display text-3xl font-semibold text-stone-900 dark:text-stone-100">Accès restreint</h1>
          <p className="text-sm text-stone-600 dark:text-stone-300">
            Cet espace est réservé à l’administrateur principal et aux modérateurs habilités.
          </p>
        </div>
      </div>
    );
  }

  const pendingContributions = contributions.filter((c) =>
    ['submitted', 'in_review', 'needs_revision'].includes(c.status)
  );
  const publishedCount = contributions.filter((c) => c.status === 'published').length;
  const openReportsCount = reports.filter((r) => r.status === 'open').length;

  const filteredQueueContributions = contributions.filter((c) => {
    if (modQueueFilter === 'pending') {
      return ['submitted', 'in_review', 'needs_revision'].includes(c.status);
    }
    if (modQueueFilter === 'published') return c.status === 'published';
    return true;
  });

  const filteredUsers = users.filter((u) => {
    const q = userSearchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      u.displayName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.province || '').toLowerCase().includes(q) ||
      ROLE_LABELS[u.role].toLowerCase().includes(q)
    );
  });

  const handleModerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContrib) return;
    setModSaving(true);
    setActionError(null);
    try {
      const freshToken = await getFreshIdToken();
      if (!freshToken) {
        setActionError('Session expirée : veuillez vous reconnecter.');
        return;
      }
      await moderateContribution({
        contribution: selectedContrib,
        moderator: profile,
        decision: modDecision,
        verificationLabel: modLabel,
        reason: modReason || 'Décision éditoriale enregistrée.',
        internalNote: modInternalNote,
        sensitiveLocation: modSensitiveLoc,
        idToken: freshToken,
      });
      setSelectedContrib(null);
      setModReason('');
      setModInternalNote('');
      await loadAll();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Échec de l’enregistrement de la décision.');
    } finally {
      setModSaving(false);
    }
  };

  const handleCreateAssisted = async (e: React.FormEvent) => {
    e.preventDefault();
    setAssistSaving(true);
    setActionError(null);
    try {
      await createAssistedAccount(
        {
          displayName: assistName,
          email: assistEmail,
          phone: assistPhone,
          role: assistRole,
          province: assistProvince,
          institution: assistInstitution,
          notes: assistNotes,
        },
        profile
      );
      setAssistName('');
      setAssistEmail('');
      setAssistPhone('');
      setAssistInstitution('');
      setAssistNotes('');
      await loadAll();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Impossible de pré-créer ce compte assisté.');
    } finally {
      setAssistSaving(false);
    }
  };

  const handleCreateReward = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetUser = users.find((u) => u.uid === rewardUserId);
    if (!targetUser) return;
    setRewardSaving(true);
    setActionError(null);
    try {
      await createReward(
        {
          contributor: targetUser,
          periodLabel: rewardPeriod,
          amountXaf: Number(rewardAmount),
          criteriaSummary: rewardCriteria,
          featuredContributionTitle: rewardWork,
          announceNow: rewardAnnounce,
        },
        profile
      );
      setRewardWork('');
      setRewardCriteria('');
      await loadAll();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Impossible d’attribuer cette récompense.');
    } finally {
      setRewardSaving(false);
    }
  };

  const handleSaveSocialLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);
    setSocialSaving(true);
    try {
      await saveSocialLink(
        {
          id: editingSocialId || undefined,
          platform: socialPlatform,
          label: socialLabel,
          url: socialUrl,
          isActive: socialActive,
          displayOrder: Number(socialOrder) || 0,
        },
        profile
      );
      setEditingSocialId(null);
      setSocialPlatform('facebook');
      setSocialLabel('');
      setSocialUrl('');
      setSocialOrder(String(socialLinks.length + 1));
      setSocialActive(true);
      setActionSuccess('Réseau social enregistré et synchronisé.');
      await loadAll();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Impossible d’enregistrer ce réseau social.');
    } finally {
      setSocialSaving(false);
    }
  };

  const handleWalletDecision = async (
    txId: string,
    decision: 'approve_shap' | 'approve_manual' | 'reject' | 'reconcile_shap'
  ) => {
    setActionError(null);
    setActionSuccess(null);
    if (decision === 'approve_manual' && !(walletManualRefs[txId] || '').trim()) {
      setActionError('Saisissez la référence opérateur avant de valider un paiement manuel.');
      return;
    }
    setWalletBusyId(txId);
    try {
      const token = await getFreshIdToken();
      if (!token) throw new Error('Session expirée : veuillez vous reconnecter.');
      const updated = await decideAdminWalletWithdrawal(token, txId, {
        decision,
        providerReference: walletManualRefs[txId]?.trim() || undefined,
        adminNote: walletAdminNotes[txId]?.trim() || undefined,
      });
      setActionSuccess(`Retrait ${updated.reference} mis à jour : ${WALLET_TX_STATUS_LABELS[updated.status]}.`);
      await loadWalletOverview(walletPageNum);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Impossible de traiter cette décision.');
    } finally {
      setWalletBusyId(null);
    }
  };

  const handleExportWalletCsv = async () => {
    setActionError(null);
    setWalletCsvBusy(true);
    try {
      const token = await getFreshIdToken();
      if (!token) throw new Error('Session expirée.');
      await downloadAdminWalletCsv(token, {
        type: walletFilterType,
        provider: walletFilterProvider,
        status: walletFilterStatus,
        search: walletSearch,
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Échec de l’export CSV.');
    } finally {
      setWalletCsvBusy(false);
    }
  };

  const inputCls =
    'px-3 py-2 text-xs border border-stone-300 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-10 space-y-8">
      {/* Admin Header & KPI Strip */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-stone-500 dark:text-stone-400">
            Gouvernance et supervision · {ROLE_LABELS[profile.role]}
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-stone-900 dark:text-stone-100">
            Tableau de bord administratif
          </h1>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={async () => {
                setActionError(null);
                try {
                  await seedOfficialCategories(profile.uid, profile.email);
                  setSeedMessage('14 catégories patrimoniales synchronisées dans Firestore.');
                  setTimeout(() => setSeedMessage(null), 3500);
                } catch (err) {
                  setActionError(
                    err instanceof Error ? err.message : 'Erreur lors de la synchronisation des catégories.'
                  );
                }
              }}
              className="px-4 py-2 border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs font-semibold text-stone-800 dark:text-stone-100 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-800 whitespace-nowrap shrink-0"
            >
              Synchroniser les 14 catégories
            </button>
          </div>
        )}
      </div>

      {actionError && (
        <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-800 dark:text-red-300">
          {actionError}
        </div>
      )}

      {actionSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-900 dark:text-emerald-300">
          {actionSuccess}
        </div>
      )}

      {seedMessage && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-900 dark:text-emerald-300">
          {seedMessage}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-[#171715] border border-stone-200 dark:border-stone-800 rounded-2xl p-4">
          <p className="text-xs text-stone-500 dark:text-stone-400">À modérer</p>
          <p className="font-mono text-2xl font-semibold text-stone-900 dark:text-stone-100 tabular-nums mt-1">
            {pendingContributions.length}
          </p>
        </div>
        <div className="bg-white dark:bg-[#171715] border border-stone-200 dark:border-stone-800 rounded-2xl p-4">
          <p className="text-xs text-stone-500 dark:text-stone-400">Publiées</p>
          <p className="font-mono text-2xl font-semibold text-[#14532D] dark:text-emerald-400 tabular-nums mt-1">
            {publishedCount}
          </p>
        </div>
        <div className="bg-white dark:bg-[#171715] border border-stone-200 dark:border-stone-800 rounded-2xl p-4">
          <p className="text-xs text-stone-500 dark:text-stone-400">Signalements ouverts</p>
          <p className="font-mono text-2xl font-semibold text-[#92400E] dark:text-amber-400 tabular-nums mt-1">
            {openReportsCount}
          </p>
        </div>
        {isAdmin && (
          <>
            <div className="bg-white dark:bg-[#171715] border border-stone-200 dark:border-stone-800 rounded-2xl p-4">
              <p className="text-xs text-stone-500 dark:text-stone-400">Comptes enregistrés</p>
              <p className="font-mono text-2xl font-semibold text-stone-900 dark:text-stone-100 tabular-nums mt-1">
                {users.length}
              </p>
            </div>
            <div className="bg-white dark:bg-[#171715] border border-stone-200 dark:border-stone-800 rounded-2xl p-4">
              <p className="text-xs text-stone-500 dark:text-stone-400">Retraits portefeuille</p>
              <p className="font-mono text-2xl font-semibold text-stone-900 dark:text-stone-100 tabular-nums mt-1">
                {(walletOverview?.totals.pendingWithdrawalsCount ?? 0) +
                  payouts.filter((p) => p.status === 'pending_admin_review').length}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 bg-stone-200/70 dark:bg-stone-800/80 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setTab('moderation')}
          className={`px-3.5 py-2 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 ${
            tab === 'moderation'
              ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-sm'
              : 'text-stone-600 dark:text-stone-300'
          }`}
        >
          Modération ({pendingContributions.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('reports')}
          className={`px-3.5 py-2 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 ${
            tab === 'reports'
              ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-sm'
              : 'text-stone-600 dark:text-stone-300'
          }`}
        >
          Signalements ({openReportsCount})
        </button>
        {isAdmin && (
          <>
            <button
              type="button"
              onClick={() => setTab('users')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 ${
                tab === 'users'
                  ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-sm'
                  : 'text-stone-600 dark:text-stone-300'
              }`}
            >
              Comptes & Assistance
            </button>
            <button
              type="button"
              onClick={() => setTab('rewards')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 ${
                tab === 'rewards'
                  ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-sm'
                  : 'text-stone-600 dark:text-stone-300'
              }`}
            >
              Paiements & Récompenses
            </button>
            <button
              type="button"
              onClick={() => setTab('social')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 ${
                tab === 'social'
                  ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-sm'
                  : 'text-stone-600 dark:text-stone-300'
              }`}
            >
              Réseaux sociaux ({socialLinks.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('audit')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 ${
                tab === 'audit'
                  ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-sm'
                  : 'text-stone-600 dark:text-stone-300'
              }`}
            >
              Journal d’audit ({auditLogs.length})
            </button>
          </>
        )}
      </div>

      {/* TAB 1: MODERATION QUEUE */}
      {tab === 'moderation' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 bg-white dark:bg-[#171715] border border-stone-200 dark:border-stone-800 rounded-2xl divide-y divide-stone-200 dark:divide-stone-800">
            <div className="p-4 bg-[#F9F8F6] dark:bg-stone-900/70 rounded-t-2xl space-y-3">
              <h2 className="text-xs uppercase tracking-widest font-semibold text-stone-600 dark:text-stone-400">
                File de modération ({filteredQueueContributions.length})
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { id: 'pending', label: `À modérer (${pendingContributions.length})` },
                    { id: 'published', label: `Publiées (${publishedCount})` },
                    { id: 'all', label: `Toutes (${contributions.length})` },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setModQueueFilter(f.id)}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-lg border ${
                      modQueueFilter === f.id
                        ? 'bg-[#14532D] text-white border-[#14532D]'
                        : 'bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            {loading ? (
              <div className="p-6 text-xs text-stone-500 dark:text-stone-400">Chargement…</div>
            ) : filteredQueueContributions.length === 0 ? (
              <div className="p-8 text-xs text-stone-500 dark:text-stone-400 text-center">
                Aucune contribution dans cette file pour le moment.
              </div>
            ) : (
              filteredQueueContributions.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setSelectedContrib(c);
                    setModDecision(c.status === 'submitted' ? 'published' : c.status);
                    setModLabel(c.verificationLabel);
                    setModSensitiveLoc(c.sensitiveLocation);
                    setModReason(c.moderationNote || '');
                  }}
                  className={`w-full text-left p-4 hover:bg-stone-50 dark:hover:bg-stone-900/60 transition-colors space-y-1 ${
                    selectedContrib?.id === c.id ? 'bg-[#14532D]/5 dark:bg-emerald-950/30' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs text-stone-500 dark:text-stone-400">
                    <ContributionStatusIndicator status={c.status} />
                    <span>{c.province}</span>
                  </div>
                  <p className="text-sm font-semibold text-stone-900 dark:text-stone-100 line-clamp-1">{c.title}</p>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    {c.authorName} · {c.categoryName}
                  </p>
                </button>
              ))
            )}
          </div>

          <div className="lg:col-span-7 bg-white dark:bg-[#171715] border border-stone-200 dark:border-stone-800 rounded-2xl p-6">
            {!selectedContrib ? (
              <div className="py-16 text-center text-xs text-stone-500 dark:text-stone-400">
                Sélectionnez une contribution dans la file pour examiner son contenu, ses médias privés et statuer sur sa publication.
              </div>
            ) : (
              <form onSubmit={handleModerate} className="space-y-6">
                <div className="space-y-2 border-b border-stone-200 dark:border-stone-800 pb-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-[#92400E] dark:text-amber-400 font-medium">
                      {selectedContrib.categoryName} · {selectedContrib.province} · {selectedContrib.language}
                    </p>
                    <ContributionStatusIndicator
                      status={selectedContrib.status}
                      verificationLabel={selectedContrib.verificationLabel}
                      showVerification
                    />
                  </div>
                  <h3 className="font-display text-2xl font-semibold text-stone-900 dark:text-stone-100">
                    {selectedContrib.title}
                  </h3>
                  <p className="text-xs text-stone-600 dark:text-stone-300">
                    Auteur : {selectedContrib.authorName} ({ROLE_LABELS[selectedContrib.authorRole]}) · Autorisation :{' '}
                    {PERMISSION_LABELS[selectedContrib.permissionType] || selectedContrib.permissionType}
                  </p>
                </div>

                <div className="space-y-3">
                  <p className="text-sm text-stone-800 dark:text-stone-200 whitespace-pre-line leading-relaxed">
                    {selectedContrib.description}
                  </p>
                  {selectedContrib.sourcesDescription && (
                    <p className="text-xs text-stone-600 dark:text-stone-300 bg-[#F9F8F6] dark:bg-stone-900/70 p-3 rounded-lg border border-stone-200 dark:border-stone-800">
                      <strong>Sources déclarées :</strong> {selectedContrib.sourcesDescription}
                    </p>
                  )}
                </div>

                {selectedContrib.mediaAssets.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs uppercase tracking-widest font-semibold text-stone-500 dark:text-stone-400">
                      Médias associés (accès privé modération)
                    </p>
                    {selectedContrib.mediaAssets.map((asset) => (
                      <MediaAssetRenderer
                        key={asset.id}
                        asset={asset}
                        isPendingPrivate={selectedContrib.status !== 'published'}
                      />
                    ))}
                  </div>
                )}

                <div className="pt-4 border-t border-stone-200 dark:border-stone-800 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                        Décision éditoriale
                      </label>
                      <select
                        value={modDecision}
                        onChange={(e) => setModDecision(e.target.value as ContributionStatus)}
                        className="w-full px-3 py-2 text-sm border border-stone-300 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                      >
                        <option value="in_review">En cours d’examen</option>
                        <option value="needs_revision">Requiert des ajustements</option>
                        <option value="published">Publié (Valider et publier)</option>
                        <option value="rejected">Non retenu</option>
                        <option value="archived">Archivé</option>
                        <option value="withdrawn">Retiré du catalogue</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                        Mention de vérification
                      </label>
                      <select
                        value={modLabel}
                        onChange={(e) => setModLabel(e.target.value as VerificationLabel)}
                        className="w-full px-3 py-2 text-sm border border-stone-300 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                      >
                        <option value="propose">Proposé</option>
                        <option value="relu">Relu par la rédaction</option>
                        <option value="documente">Documenté et sourcé</option>
                      </select>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-xs text-stone-700 dark:text-stone-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={modSensitiveLoc}
                      onChange={(e) => setModSensitiveLoc(e.target.checked)}
                      className="rounded border-stone-300 dark:border-stone-700 text-[#14532D]"
                    />
                    <span>Masquer la localité exacte (lieu sensible)</span>
                  </label>

                  <div>
                    <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                      Motif / Retour visible par l’auteur *
                    </label>
                    <textarea
                      required
                      minLength={2}
                      rows={2}
                      value={modReason}
                      onChange={(e) => setModReason(e.target.value)}
                      placeholder="Ex. Sources vérifiées et droits confirmés — fiche validée pour publication."
                      className="w-full px-3 py-2 text-sm border border-stone-300 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                      Note interne de modération (non visible du public)
                    </label>
                    <input
                      type="text"
                      value={modInternalNote}
                      onChange={(e) => setModInternalNote(e.target.value)}
                      placeholder="Remarque réservée aux modérateurs…"
                      className="w-full px-3 py-2 text-sm border border-stone-300 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={modSaving}
                    className="px-5 py-2.5 bg-[#14532D] text-white text-xs font-semibold rounded-xl hover:bg-[#114224]"
                  >
                    {modSaving ? 'Enregistrement…' : 'Enregistrer la décision'}
                  </button>

                  {contribModEvents.length > 0 && (
                    <div className="pt-4 border-t border-stone-200 dark:border-stone-800 space-y-2.5">
                      <div className="flex items-center gap-1.5 text-xs uppercase tracking-widest font-semibold text-stone-500 dark:text-stone-400">
                        <History className="w-3.5 h-3.5" />
                        <span>Historique modération ({contribModEvents.length})</span>
                      </div>
                      <div className="space-y-2">
                        {contribModEvents.map((ev) => (
                          <div
                            key={ev.id}
                            className="p-3 rounded-xl bg-[#F9F8F6] dark:bg-stone-900/70 border border-stone-200 dark:border-stone-800 text-xs space-y-1"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-semibold text-stone-900 dark:text-stone-100">
                                {STATUS_LABELS[ev.decision]} · {ev.moderatorName}
                              </span>
                              <span className="font-mono text-[11px] text-stone-500 dark:text-stone-400">
                                {formatDateFr(ev.createdAt)}
                              </span>
                            </div>
                            <p className="text-stone-700 dark:text-stone-300">{ev.reason}</p>
                            {ev.internalNote && (
                              <p className="text-[#92400E] dark:text-amber-400 text-[11px]">
                                Note interne équipe : {ev.internalNote}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: REPORTS */}
      {tab === 'reports' && (
        <div className="bg-white dark:bg-[#171715] border border-stone-200 dark:border-stone-800 rounded-2xl p-6 space-y-4">
          <h2 className="font-display text-2xl font-semibold text-stone-900 dark:text-stone-100">Signalements reçus</h2>
          {reports.length === 0 ? (
            <p className="text-xs text-stone-500 dark:text-stone-400">Aucun signalement enregistré.</p>
          ) : (
            <div className="divide-y divide-stone-200 dark:divide-stone-800">
              {reports.map((r) => (
                <div key={r.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-[#92400E] dark:text-amber-400">
                      {REPORT_CATEGORY_LABELS[r.reasonCategory] || r.reasonCategory} ·{' '}
                      {REPORT_STATUS_LABELS[r.status] || r.status}
                    </p>
                    <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">{r.contributionTitle}</p>
                    <p className="text-xs text-stone-600 dark:text-stone-300">
                      {r.details} — par {r.reporterName}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={async () => {
                        setActionError(null);
                        try {
                          await updateReportStatus(r.id, 'resolved', 'Traité par la modération.', profile);
                          await loadAll();
                        } catch (err) {
                          setActionError(
                            err instanceof Error ? err.message : 'Erreur lors de la mise à jour du signalement.'
                          );
                        }
                      }}
                      className="px-3 py-1.5 bg-[#14532D] text-white text-xs font-semibold rounded-lg"
                    >
                      Marquer résolu
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        setActionError(null);
                        try {
                          await updateReportStatus(r.id, 'dismissed', 'Signalement classé sans suite.', profile);
                          await loadAll();
                        } catch (err) {
                          setActionError(
                            err instanceof Error ? err.message : 'Erreur lors du classement du signalement.'
                          );
                        }
                      }}
                      className="px-3 py-1.5 border border-stone-300 dark:border-stone-700 text-xs rounded-lg text-stone-700 dark:text-stone-200"
                    >
                      Classer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: USERS & ACCOUNT ASSISTANCE */}
      {tab === 'users' && isAdmin && (
        <div className="space-y-8">
          <div className="bg-white dark:bg-[#171715] border border-stone-200 dark:border-stone-800 rounded-2xl p-6 space-y-4 overflow-x-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="font-display text-2xl font-semibold text-stone-900 dark:text-stone-100">
                Gestion des utilisateurs et des rôles ({filteredUsers.length})
              </h2>
              <input
                type="search"
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                placeholder="Rechercher par nom, e-mail, province…"
                className="w-full sm:w-72 px-3 py-2 text-xs bg-[#F9F8F6] dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100"
              />
            </div>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-200 dark:border-stone-800 text-stone-500 dark:text-stone-400">
                  <th className="py-2 pr-4 font-medium">Nom & E-mail</th>
                  <th className="py-2 pr-4 font-medium">Province</th>
                  <th className="py-2 pr-4 font-medium">Rôle</th>
                  <th className="py-2 pr-4 font-medium">Statut</th>
                  <th className="py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                {filteredUsers.map((u) => {
                  const isSelf = u.uid === profile.uid;
                  return (
                    <tr key={u.uid}>
                      <td className="py-3 pr-4">
                        <p className="font-semibold text-stone-900 dark:text-stone-100">
                          {u.displayName} {isSelf && <span className="text-[#14532D] dark:text-emerald-400">(Vous)</span>}
                        </p>
                        <p className="text-stone-500 dark:text-stone-400">{u.email}</p>
                      </td>
                      <td className="py-3 pr-4 text-stone-700 dark:text-stone-300">{u.province || '—'}</td>
                      <td className="py-3 pr-4">
                        <select
                          aria-label={`Rôle de ${u.displayName}`}
                          value={u.role}
                          disabled={isSelf}
                          onChange={async (e) => {
                            setActionError(null);
                            try {
                              await adminUpdateUser(u.uid, { role: e.target.value as UserRole }, profile);
                              await loadAll();
                            } catch (err) {
                              setActionError(
                                err instanceof Error ? err.message : 'Erreur lors du changement de rôle.'
                              );
                            }
                          }}
                          className="px-2 py-1 border border-stone-300 dark:border-stone-700 rounded-md bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 text-xs disabled:opacity-60"
                        >
                          <option value="citizen">Citoyen</option>
                          <option value="student">Étudiant</option>
                          <option value="researcher">Enseignant-chercheur</option>
                          <option value="moderator">Modérateur</option>
                          <option value="admin">Administrateur</option>
                        </select>
                      </td>
                      <td className="py-3 pr-4">
                        <button
                          type="button"
                          disabled={isSelf}
                          onClick={async () => {
                            setActionError(null);
                            try {
                              await adminUpdateUser(
                                u.uid,
                                { accountStatus: u.accountStatus === 'suspended' ? 'active' : 'suspended' },
                                profile
                              );
                              await loadAll();
                            } catch (err) {
                              setActionError(
                                err instanceof Error ? err.message : 'Erreur lors de la modification du statut.'
                              );
                            }
                          }}
                          className="text-xs underline text-stone-700 dark:text-stone-300 disabled:opacity-50"
                        >
                          {u.accountStatus === 'suspended' ? 'Suspendu (Réactiver)' : 'Actif (Suspendre)'}
                        </button>
                      </td>
                      <td className="py-3">
                        <button
                          type="button"
                          onClick={async () => {
                            setActionError(null);
                            try {
                              await adminUpdateUser(u.uid, { verifiedBadge: !u.verifiedBadge }, profile);
                              await loadAll();
                            } catch (err) {
                              setActionError(
                                err instanceof Error ? err.message : 'Erreur lors de la certification du profil.'
                              );
                            }
                          }}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-xs ${
                            u.verifiedBadge
                              ? 'border-[#14532D] text-[#14532D] dark:text-emerald-400 bg-[#14532D]/5'
                              : 'border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{u.verifiedBadge ? 'Chercheur vérifié' : 'Vérifier'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <form
              onSubmit={handleCreateAssisted}
              className="bg-white dark:bg-[#171715] border border-stone-200 dark:border-stone-800 rounded-2xl p-6 space-y-4"
            >
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#14532D] dark:text-emerald-400" />
                <h3 className="font-display text-xl font-semibold text-stone-900 dark:text-stone-100">
                  Créer un profil assisté (accompagnement)
                </h3>
              </div>
              <p className="text-xs text-stone-600 dark:text-stone-300">
                Pré-configurez le compte d’une personne rencontrant des difficultés. Dès sa première connexion Google avec cet e-mail, son profil sera automatiquement associé.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  value={assistName}
                  onChange={(e) => setAssistName(e.target.value)}
                  placeholder="Nom complet *"
                  className={inputCls}
                />
                <input
                  type="email"
                  required
                  value={assistEmail}
                  onChange={(e) => setAssistEmail(e.target.value)}
                  placeholder="Adresse e-mail Google *"
                  className={inputCls}
                />
                <select
                  value={assistRole}
                  onChange={(e) => setAssistRole(e.target.value as AssistedAccount['role'])}
                  className={inputCls}
                >
                  <option value="citizen">Citoyen</option>
                  <option value="student">Étudiant</option>
                  <option value="researcher">Enseignant-chercheur</option>
                </select>
                <select value={assistProvince} onChange={(e) => setAssistProvince(e.target.value)} className={inputCls}>
                  {GABON_PROVINCES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={assistPhone}
                  onChange={(e) => setAssistPhone(e.target.value)}
                  placeholder="Téléphone"
                  className={inputCls}
                />
                <input
                  type="text"
                  value={assistInstitution}
                  onChange={(e) => setAssistInstitution(e.target.value)}
                  placeholder="Établissement (si étudiant/chercheur)"
                  className={inputCls}
                />
              </div>
              <input
                type="text"
                value={assistNotes}
                onChange={(e) => setAssistNotes(e.target.value)}
                placeholder="Note d’accompagnement"
                className={`w-full ${inputCls}`}
              />
              <button
                type="submit"
                disabled={assistSaving}
                className="px-4 py-2 bg-[#14532D] text-white text-xs font-semibold rounded-lg"
              >
                {assistSaving ? 'Enregistrement…' : 'Pré-créer le profil assisté'}
              </button>

              {assistedAccounts.length > 0 && (
                <div className="pt-3 border-t border-stone-200 dark:border-stone-800 space-y-2">
                  <p className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                    Profils assistés ({assistedAccounts.length})
                  </p>
                  {assistedAccounts.map((a) => (
                    <div key={a.id} className="text-xs text-stone-600 dark:text-stone-400 flex justify-between gap-2">
                      <span>
                        {a.displayName} ({a.email})
                      </span>
                      <span className="font-mono">{a.claimStatus === 'claimed' ? 'Récupéré' : 'En attente'}</span>
                    </div>
                  ))}
                </div>
              )}
            </form>

            <div className="bg-white dark:bg-[#171715] border border-stone-200 dark:border-stone-800 rounded-2xl p-6 space-y-4">
              <h3 className="font-display text-xl font-semibold text-stone-900 dark:text-stone-100">
                Demandes d’assistance reçues ({assistanceRequests.length})
              </h3>
              {assistanceRequests.length === 0 ? (
                <p className="text-xs text-stone-500 dark:text-stone-400">Aucune demande d’assistance en attente.</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {assistanceRequests.map((req) => (
                    <div
                      key={req.id}
                      className="p-3.5 rounded-xl bg-[#F9F8F6] dark:bg-stone-900/70 border border-stone-200 dark:border-stone-800 space-y-2 text-xs"
                    >
                      <div className="flex justify-between gap-2">
                        <span className="font-semibold text-stone-900 dark:text-stone-100">
                          {req.requesterName} · {req.contactInfo}
                        </span>
                        <span className="font-medium text-[#92400E] dark:text-amber-400">
                          {ASSISTANCE_STATUS_LABELS[req.status] || req.status}
                        </span>
                      </div>
                      <p className="text-stone-600 dark:text-stone-300">{req.message}</p>
                      {req.status !== 'resolved' && (
                        <button
                          type="button"
                          onClick={async () => {
                            setActionError(null);
                            try {
                              if (req.source === 'public_inbox') {
                                const freshToken = await getFreshIdToken();
                                if (!freshToken) return;
                                await fetch(`/api/admin/assistance/${req.id}`, {
                                  method: 'PATCH',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    Authorization: `Bearer ${freshToken}`,
                                  },
                                  body: JSON.stringify({
                                    status: 'resolved',
                                    adminNote: 'Traité par l’administrateur.',
                                  }),
                                });
                              } else {
                                await updateFirestoreAssistanceRequest(
                                  req.id,
                                  'resolved',
                                  'Traité par l’administrateur.'
                                );
                              }
                              await loadAll();
                            } catch (err) {
                              setActionError(
                                err instanceof Error ? err.message : 'Erreur lors de la mise à jour de la demande.'
                              );
                            }
                          }}
                          className="px-3 py-1 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 rounded-md text-[11px] font-medium"
                        >
                          Marquer comme traité
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: WALLET PAYMENTS, REWARDS & MOBILE MONEY PAYOUTS */}
      {tab === 'rewards' && isAdmin && (
        <div className="space-y-8">
          {/* NEW: Supervision Portefeuille Mobile Money (Dépôts & Retraits + Export CSV) */}
          <section className="bg-white dark:bg-[#171715] border border-stone-200 dark:border-stone-800 rounded-2xl p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl font-semibold text-stone-900 dark:text-stone-100">
                  Supervision des paiements Mobile Money (Dépôts & Retraits)
                </h2>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Contrôle global des flux Airtel Money / Moov Money, validation des retraits, réconciliation SHAP et export CSV.
                </p>
              </div>
              <button
                type="button"
                disabled={walletCsvBusy}
                onClick={() => void handleExportWalletCsv()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#14532D] text-white text-xs font-semibold rounded-xl hover:bg-[#114224] disabled:opacity-50 self-start md:self-auto"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{walletCsvBusy ? 'Export en cours…' : 'Exporter CSV'}</span>
              </button>
            </div>

            {walletOverview && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div className="p-4 rounded-xl bg-[#F9F8F6] dark:bg-stone-900/70 border border-stone-200 dark:border-stone-800">
                  <p className="text-stone-500 dark:text-stone-400">Dépôts confirmés</p>
                  <p className="font-mono text-lg font-semibold text-[#14532D] dark:text-emerald-400 tabular-nums mt-1">
                    {walletOverview.totals.totalDepositsPaidXaf.toLocaleString('fr-FR')} XAF
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-[#F9F8F6] dark:bg-stone-900/70 border border-stone-200 dark:border-stone-800">
                  <p className="text-stone-500 dark:text-stone-400">Retraits versés</p>
                  <p className="font-mono text-lg font-semibold text-stone-900 dark:text-stone-100 tabular-nums mt-1">
                    {walletOverview.totals.totalWithdrawalsPaidXaf.toLocaleString('fr-FR')} XAF
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-[#F9F8F6] dark:bg-stone-900/70 border border-stone-200 dark:border-stone-800">
                  <p className="text-stone-500 dark:text-stone-400">Retraits à traiter</p>
                  <p className="font-mono text-lg font-semibold text-[#92400E] dark:text-amber-400 tabular-nums mt-1">
                    {walletOverview.totals.pendingWithdrawalsCount}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-[#F9F8F6] dark:bg-stone-900/70 border border-stone-200 dark:border-stone-800">
                  <p className="text-stone-500 dark:text-stone-400">Portefeuilles actifs</p>
                  <p className="font-mono text-lg font-semibold text-stone-900 dark:text-stone-100 tabular-nums mt-1">
                    {walletOverview.totals.totalAccountsCount}
                  </p>
                </div>
              </div>
            )}

            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={walletSearch}
                  onChange={(e) => {
                    setWalletSearch(e.target.value);
                    setWalletPageNum(1);
                  }}
                  placeholder="Nom, e-mail, référence, MSISDN…"
                  className="w-full pl-9 pr-3 py-2 text-xs border border-stone-300 dark:border-stone-700 rounded-xl bg-[#F9F8F6] dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                />
              </div>
              <select
                value={walletFilterType}
                onChange={(e) => {
                  setWalletFilterType(e.target.value);
                  setWalletPageNum(1);
                }}
                className={inputCls}
              >
                <option value="all">Tous les types</option>
                <option value="deposit">Dépôts</option>
                <option value="withdrawal">Retraits</option>
              </select>
              <select
                value={walletFilterProvider}
                onChange={(e) => {
                  setWalletFilterProvider(e.target.value);
                  setWalletPageNum(1);
                }}
                className={inputCls}
              >
                <option value="all">Tous les opérateurs</option>
                <option value="airtel_money">Airtel Money</option>
                <option value="moov_money">Moov Money</option>
              </select>
              <select
                value={walletFilterStatus}
                onChange={(e) => {
                  setWalletFilterStatus(e.target.value);
                  setWalletPageNum(1);
                }}
                className={inputCls}
              >
                <option value="all">Tous les statuts</option>
                <option value="pending">En attente</option>
                <option value="processing">Traitement en cours</option>
                <option value="paid">Payé / Confirmé</option>
                <option value="failed">Échoué</option>
                <option value="rejected">Refusé</option>
                <option value="cancelled">Annulé</option>
              </select>
            </div>

            {/* Transactions */}
            {!walletOverview || walletOverview.transactions.items.length === 0 ? (
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Aucune transaction portefeuille ne correspond à ces filtres.
              </p>
            ) : (
              <div className="space-y-3">
                {walletOverview.transactions.items.map((tx) => {
                  const canManageWithdrawal =
                    tx.type === 'withdrawal' && (tx.status === 'pending' || tx.status === 'processing');
                  return (
                    <div
                      key={tx.id}
                      className="p-4 rounded-xl border border-stone-200 dark:border-stone-800 space-y-3 text-xs"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="space-y-0.5">
                          <p className="font-semibold text-stone-900 dark:text-stone-100">
                            {tx.type === 'deposit' ? 'Dépôt' : 'Retrait'} · {tx.userName} ({tx.userEmail})
                          </p>
                          <p className="text-stone-500 dark:text-stone-400 font-mono">
                            {tx.reference} · {PROVIDER_LABELS[tx.provider]} · {tx.msisdnMasked} ·{' '}
                            {WALLET_TX_STATUS_LABELS[tx.status]}
                          </p>
                          <p className="text-stone-600 dark:text-stone-300">{tx.statusMessage}</p>
                        </div>
                        <span className="font-mono text-base font-semibold text-stone-900 dark:text-stone-100 tabular-nums shrink-0">
                          {tx.amountXaf.toLocaleString('fr-FR')} XAF
                        </span>
                      </div>

                      {canManageWithdrawal && (
                        <div className="pt-3 border-t border-stone-100 dark:border-stone-800 space-y-2.5">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={walletManualRefs[tx.id] || ''}
                              onChange={(e) => setWalletManualRefs((prev) => ({ ...prev, [tx.id]: e.target.value }))}
                              placeholder="Référence opérateur (si validation manuelle)"
                              className={inputCls}
                            />
                            <input
                              type="text"
                              value={walletAdminNotes[tx.id] || ''}
                              onChange={(e) => setWalletAdminNotes((prev) => ({ ...prev, [tx.id]: e.target.value }))}
                              placeholder="Note administrative / motif"
                              className={inputCls}
                            />
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {tx.status === 'pending' && (
                              <button
                                type="button"
                                disabled={walletBusyId === tx.id}
                                onClick={() => void handleWalletDecision(tx.id, 'approve_shap')}
                                className="px-3 py-1.5 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 font-semibold rounded-lg"
                              >
                                Payer via SHAP
                              </button>
                            )}
                            {tx.status === 'processing' && (
                              <button
                                type="button"
                                disabled={walletBusyId === tx.id}
                                onClick={() => void handleWalletDecision(tx.id, 'reconcile_shap')}
                                className="px-3 py-1.5 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 font-semibold rounded-lg"
                              >
                                Réconcilier SHAP
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={walletBusyId === tx.id}
                              onClick={() => void handleWalletDecision(tx.id, 'approve_manual')}
                              className="px-3 py-1.5 bg-[#14532D] text-white font-semibold rounded-lg"
                            >
                              Valider paiement manuel
                            </button>
                            <button
                              type="button"
                              disabled={walletBusyId === tx.id}
                              onClick={() => void handleWalletDecision(tx.id, 'reject')}
                              className="px-3 py-1.5 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 rounded-lg"
                            >
                              Refuser & rembourser
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {walletOverview && walletOverview.transactions.totalPages > 1 && (
              <div className="pt-3 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between text-xs">
                <span className="text-stone-500 dark:text-stone-400">
                  Page {walletOverview.transactions.page} sur {walletOverview.transactions.totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={walletOverview.transactions.page <= 1}
                    onClick={() => setWalletPageNum((p) => Math.max(1, p - 1))}
                    className="inline-flex items-center gap-1 px-3 py-1.5 border border-stone-300 dark:border-stone-700 rounded-lg disabled:opacity-40"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Précédent</span>
                  </button>
                  <button
                    type="button"
                    disabled={walletOverview.transactions.page >= walletOverview.transactions.totalPages}
                    onClick={() => setWalletPageNum((p) => p + 1)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 border border-stone-300 dark:border-stone-700 rounded-lg disabled:opacity-40"
                  >
                    <span>Suivant</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {walletOverview && walletOverview.auditLogs.length > 0 && (
              <div className="pt-4 border-t border-stone-200 dark:border-stone-800 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-stone-500 dark:text-stone-400">
                  Journal d’audit financier du portefeuille
                </p>
                <div className="max-h-48 overflow-y-auto divide-y divide-stone-100 dark:divide-stone-800 text-[11px]">
                  {walletOverview.auditLogs.slice(0, 20).map((ev) => (
                    <div key={ev.id} className="py-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-stone-700 dark:text-stone-300">
                        <strong className="font-mono text-stone-900 dark:text-stone-100">{ev.action}</strong> —{' '}
                        {ev.summary}
                      </span>
                      <span className="font-mono text-stone-500 dark:text-stone-400">
                        {ev.actorEmail} · {formatDateFr(ev.timestamp)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Existing Rewards & Legacy Payout Requests */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <form
              onSubmit={handleCreateReward}
              className="bg-white dark:bg-[#171715] border border-stone-200 dark:border-stone-800 rounded-2xl p-6 space-y-4"
            >
              <h2 className="font-display text-2xl font-semibold text-stone-900 dark:text-stone-100">
                Désigner un lauréat et attribuer une récompense
              </h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                    Contributeur évalué
                  </label>
                  <select
                    value={rewardUserId}
                    onChange={(e) => setRewardUserId(e.target.value)}
                    className={`w-full ${inputCls}`}
                  >
                    {users.map((u) => (
                      <option key={u.uid} value={u.uid}>
                        {u.displayName} ({ROLE_LABELS[u.role]})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">Période</label>
                    <input
                      type="text"
                      required
                      value={rewardPeriod}
                      onChange={(e) => setRewardPeriod(e.target.value)}
                      className={`w-full ${inputCls}`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                      Montant entier (XAF)
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      step={1}
                      value={rewardAmount}
                      onChange={(e) => setRewardAmount(e.target.value)}
                      className={`w-full font-mono ${inputCls}`}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                    Contribution remarquable
                  </label>
                  <input
                    type="text"
                    value={rewardWork}
                    onChange={(e) => setRewardWork(e.target.value)}
                    placeholder="Titre de la publication distinguée"
                    className={`w-full ${inputCls}`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                    Justification selon les critères *
                  </label>
                  <textarea
                    required
                    minLength={10}
                    rows={3}
                    value={rewardCriteria}
                    onChange={(e) => setRewardCriteria(e.target.value)}
                    placeholder="Qualité documentaire, originalité, fiabilité des sources et respect des droits…"
                    className={`w-full ${inputCls}`}
                  />
                </div>
                <label className="flex items-center gap-2 text-xs text-stone-700 dark:text-stone-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rewardAnnounce}
                    onChange={(e) => setRewardAnnounce(e.target.checked)}
                    className="rounded border-stone-300 dark:border-stone-700 text-[#14532D]"
                  />
                  <span>Publier sur la page des Lauréats (sous réserve de confirmation du bénéficiaire)</span>
                </label>
              </div>
              <button
                type="submit"
                disabled={rewardSaving || users.length === 0}
                className="px-5 py-2.5 bg-[#14532D] text-white text-xs font-semibold rounded-xl"
              >
                {rewardSaving ? 'Attribution…' : 'Enregistrer et attribuer la récompense'}
              </button>
            </form>

            {/* Mobile Money Provider Status & Reward Payout Requests */}
            <div className="bg-white dark:bg-[#171715] border border-stone-200 dark:border-stone-800 rounded-2xl p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-2xl font-semibold text-stone-900 dark:text-stone-100">
                  Demandes de retrait de dotations
                </h2>
                <button
                  type="button"
                  disabled={shapBalanceLoading}
                  onClick={async () => {
                    const freshToken = await getFreshIdToken();
                    if (!freshToken) return;
                    setShapBalanceLoading(true);
                    setShapBalanceInfo(null);
                    try {
                      const res = await fetch('/api/payments/shap/balance', {
                        headers: { Authorization: `Bearer ${freshToken}` },
                      });
                      const data = (await res.json()) as { balance?: unknown; message?: string };
                      if (!res.ok) {
                        setShapBalanceInfo(data.message || 'Impossible de lire le solde SHAP.');
                      } else {
                        setShapBalanceInfo(`Solde SHAP : ${JSON.stringify(data.balance)}`);
                      }
                    } catch {
                      setShapBalanceInfo('Erreur réseau lors de la consultation du solde SHAP.');
                    } finally {
                      setShapBalanceLoading(false);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-stone-300 dark:border-stone-700 rounded-lg bg-[#F9F8F6] dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700"
                >
                  <Wallet className="w-3.5 h-3.5 text-[#14532D] dark:text-emerald-400" />
                  <span>{shapBalanceLoading ? 'Consultation…' : 'Vérifier solde SHAP'}</span>
                </button>
              </div>

              <div className="p-4 rounded-xl bg-[#F9F8F6] dark:bg-stone-900/70 border border-stone-200 dark:border-stone-800 space-y-2 text-xs text-stone-700 dark:text-stone-300">
                <p className="font-semibold text-stone-900 dark:text-stone-100">Passerelle Billing Easy / SHAP :</p>
                {providers.map((p) => (
                  <p key={p.id}>
                    {p.label} :{' '}
                    <strong className={p.configured ? 'text-[#14532D] dark:text-emerald-400' : 'text-[#92400E] dark:text-amber-400'}>
                      {p.configured ? 'Configuré (SHAP actif)' : 'Non configuré (Validation manuelle)'}
                    </strong>
                  </p>
                ))}
                {gatewayStatus && (
                  <div className="pt-2 border-t border-stone-200 dark:border-stone-800 space-y-1 text-[11px] text-stone-600 dark:text-stone-400">
                    <p>
                      URL Webhook SHAP : <code className="font-mono text-stone-800 dark:text-stone-200">{gatewayStatus.shap.callbackUrl}</code>
                    </p>
                    <p>
                      URL Callback E-Billing : <code className="font-mono text-stone-800 dark:text-stone-200">{gatewayStatus.ebilling.callbackUrl}</code>
                    </p>
                  </div>
                )}
                {shapBalanceInfo && (
                  <p className="pt-2 border-t border-stone-200 dark:border-stone-800 font-mono text-[11px] text-stone-800 dark:text-stone-200">
                    {shapBalanceInfo}
                  </p>
                )}
              </div>

              {payouts.length === 0 ? (
                <p className="text-xs text-stone-500 dark:text-stone-400">Aucune demande de retrait soumise.</p>
              ) : (
                <div className="space-y-3">
                  {payouts.map((p) => (
                    <div key={p.id} className="p-4 rounded-xl border border-stone-200 dark:border-stone-800 space-y-3 text-xs">
                      <div className="flex justify-between gap-2">
                        <div>
                          <p className="font-semibold text-stone-900 dark:text-stone-100">
                            {p.beneficiaryName} · {p.provider === 'airtel_money' ? 'Airtel Money' : 'Moov Money'}
                          </p>
                          <p className="text-stone-500 dark:text-stone-400">
                            {p.maskedPhone} · {PAYOUT_STATUS_LABELS[p.status] || p.status}
                            {p.providerReference ? ` · Réf. ${p.providerReference}` : ''}
                          </p>
                        </div>
                        <span className="font-mono font-semibold text-stone-900 dark:text-stone-100 tabular-nums">
                          {p.amountXaf.toLocaleString('fr-FR')} XAF
                        </span>
                      </div>

                      {payoutFeedback[p.id] && (
                        <div className="p-2.5 rounded-lg bg-[#F9F8F6] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-[11px] text-stone-800 dark:text-stone-200">
                          {payoutFeedback[p.id]}
                        </div>
                      )}

                      {p.status === 'processing_provider' && (
                        <div className="pt-2 border-t border-stone-100 dark:border-stone-800 flex flex-wrap items-center gap-2">
                          <input
                            type="tel"
                            value={payoutPhoneOverrides[p.id] || ''}
                            onChange={(e) => setPayoutPhoneOverrides((prev) => ({ ...prev, [p.id]: e.target.value }))}
                            placeholder="Numéro complet si requis (ex. 074XXXXXX)"
                            className={`flex-1 min-w-[180px] ${inputCls}`}
                          />
                          <button
                            type="button"
                            disabled={payoutBusyId === p.id}
                            onClick={async () => {
                              const freshToken = await getFreshIdToken();
                              if (!freshToken) return;
                              setPayoutBusyId(p.id);
                              try {
                                const res = await fetch('/api/payments/shap/reconcile', {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    Authorization: `Bearer ${freshToken}`,
                                  },
                                  body: JSON.stringify({
                                    payoutRequestId: p.id,
                                    payeeMsisdnOverride: payoutPhoneOverrides[p.id] || undefined,
                                  }),
                                });
                                const data = (await res.json()) as {
                                  message?: string;
                                  record?: {
                                    status: 'pending' | 'success' | 'failed';
                                    payoutId: string | null;
                                    externalReference: string;
                                  };
                                };
                                if (!res.ok || !data.record) {
                                  setPayoutFeedback((prev) => ({
                                    ...prev,
                                    [p.id]: data.message || 'Réconciliation impossible.',
                                  }));
                                } else if (data.record.status === 'pending') {
                                  setPayoutFeedback((prev) => ({
                                    ...prev,
                                    [p.id]: 'Toujours en attente de confirmation auprès de l’opérateur.',
                                  }));
                                } else {
                                  await adminReconcileShapTransaction({
                                    payoutRequest: p,
                                    shapStatus: data.record.status,
                                    payoutId: data.record.payoutId,
                                    externalReference: data.record.externalReference,
                                    admin: profile,
                                  });
                                  await loadAll();
                                }
                              } finally {
                                setPayoutBusyId(null);
                              }
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#14532D] text-white font-semibold rounded-lg"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Synchroniser statut SHAP</span>
                          </button>
                        </div>
                      )}

                      {p.status === 'pending_admin_review' && (
                        <div className="space-y-2.5 pt-2 border-t border-stone-100 dark:border-stone-800">
                          <div className="flex flex-wrap gap-2">
                            <input
                              type="tel"
                              value={payoutPhoneOverrides[p.id] || ''}
                              onChange={(e) => setPayoutPhoneOverrides((prev) => ({ ...prev, [p.id]: e.target.value }))}
                              placeholder="N° complet pour SHAP (si non enregistré : 074XXXXXX)"
                              className={`flex-1 min-w-[200px] ${inputCls}`}
                            />
                            <button
                              type="button"
                              disabled={payoutBusyId === p.id}
                              onClick={async () => {
                                const freshToken = await getFreshIdToken();
                                if (!freshToken) return;
                                setPayoutBusyId(p.id);
                                setPayoutFeedback((prev) => ({ ...prev, [p.id]: '' }));
                                try {
                                  const res = await fetch('/api/payments/shap/payout', {
                                    method: 'POST',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      Authorization: `Bearer ${freshToken}`,
                                    },
                                    body: JSON.stringify({
                                      payoutRequestId: p.id,
                                      provider: p.provider,
                                      amountXaf: p.amountXaf,
                                      payeeMsisdnOverride: payoutPhoneOverrides[p.id] || undefined,
                                    }),
                                  });
                                  const data = (await res.json()) as {
                                    message?: string;
                                    record?: {
                                      status: 'pending' | 'success' | 'failed';
                                      payoutId: string | null;
                                      externalReference: string;
                                    };
                                  };
                                  if (!res.ok || !data.record || data.record.status === 'failed') {
                                    setPayoutFeedback((prev) => ({
                                      ...prev,
                                      [p.id]: data.message || 'Échec du décaissement SHAP.',
                                    }));
                                  } else {
                                    await adminRecordShapPayoutResult({
                                      payoutRequest: p,
                                      shapStatus: data.record.status === 'success' ? 'success' : 'pending',
                                      payoutId: data.record.payoutId,
                                      externalReference: data.record.externalReference,
                                      admin: profile,
                                    });
                                    await loadAll();
                                  }
                                } catch {
                                  setPayoutFeedback((prev) => ({
                                    ...prev,
                                    [p.id]: 'Erreur réseau lors de l’appel SHAP.',
                                  }));
                                } finally {
                                  setPayoutBusyId(null);
                                }
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 font-semibold rounded-lg"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>{payoutBusyId === p.id ? 'Envoi SHAP…' : 'Payer automatiquement (SHAP)'}</span>
                            </button>
                          </div>

                          <input
                            type="text"
                            value={payoutRefs[p.id] || ''}
                            onChange={(e) => setPayoutRefs((prev) => ({ ...prev, [p.id]: e.target.value }))}
                            placeholder="Ou référence du virement manuel (ex. OM-2026-...)"
                            className={`w-full ${inputCls}`}
                          />
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={async () => {
                                const ref = (payoutRefs[p.id] || '').trim();
                                if (!ref) {
                                  setPayoutFeedback((prev) => ({
                                    ...prev,
                                    [p.id]: 'Veuillez saisir une référence de transaction opérateur avant de valider le virement manuel.',
                                  }));
                                  return;
                                }
                                setPayoutFeedback((prev) => ({ ...prev, [p.id]: '' }));
                                try {
                                  await adminProcessManualPayout({
                                    payoutRequest: p,
                                    decision: 'paid',
                                    providerReference: ref,
                                    note: 'Virement manuel vérifié par l’administrateur principal.',
                                    admin: profile,
                                  });
                                  await loadAll();
                                } catch (err) {
                                  setPayoutFeedback((prev) => ({
                                    ...prev,
                                    [p.id]: err instanceof Error ? err.message : 'Erreur lors de l’enregistrement manuel.',
                                  }));
                                }
                              }}
                              className="px-3 py-1.5 bg-[#14532D] text-white font-semibold rounded-lg"
                            >
                              Enregistrer paiement manuel vérifié
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await adminProcessManualPayout({
                                    payoutRequest: p,
                                    decision: 'rejected',
                                    providerReference: '',
                                    note: 'Demande refusée ou numéro non vérifié.',
                                    admin: profile,
                                  });
                                  await loadAll();
                                } catch (err) {
                                  setPayoutFeedback((prev) => ({
                                    ...prev,
                                    [p.id]: err instanceof Error ? err.message : 'Erreur lors du refus.',
                                  }));
                                }
                              }}
                              className="px-3 py-1.5 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 rounded-lg"
                            >
                              Refuser
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* E-Billing Collection & USSD Push Tester */}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const freshToken = await getFreshIdToken();
              if (!freshToken) return;
              setEbillBusy(true);
              setEbillResult(null);
              setEbillPortalUrl(null);
              try {
                const res = await fetch('/api/ebilling/checkout', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${freshToken}`,
                  },
                  body: JSON.stringify({
                    amountXaf: Number(ebillAmount),
                    payerMsisdn: ebillPhone,
                    payerEmail: ebillEmail,
                    shortDescription: ebillDesc,
                    provider: ebillProvider,
                    triggerUssdPush: ebillPush,
                  }),
                });
                const data = (await res.json()) as {
                  message?: string;
                  record?: {
                    billId: string;
                    externalReference: string;
                    paymentUrl: string;
                    ussdPushId?: string | number | null;
                  };
                };
                if (!res.ok || !data.record) {
                  setEbillResult(data.message || 'Impossible de créer la facture E-Billing.');
                } else {
                  setEbillResult(
                    `Facture créée : ${data.record.billId} (réf. ${data.record.externalReference})${
                      data.record.ussdPushId ? ` · USSD Push #${data.record.ussdPushId} envoyé` : ''
                    }`
                  );
                  setEbillPortalUrl(data.record.paymentUrl);
                  await loadAll();
                }
              } catch {
                setEbillResult('Erreur réseau lors de la création de facture E-Billing.');
              } finally {
                setEbillBusy(false);
              }
            }}
            className="bg-white dark:bg-[#171715] border border-stone-200 dark:border-stone-800 rounded-2xl p-6 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-xl font-semibold text-stone-900 dark:text-stone-100">
                  Encaissement E-Billing (Facture eBill & USSD Push v2)
                </h3>
                <p className="text-xs text-stone-600 dark:text-stone-300">
                  Créez une facture E-Billing (portail hébergé ou USSD Push Airtel/Moov Money).
                </p>
              </div>
              <span className="font-mono text-xs text-stone-600 dark:text-stone-300">
                {gatewayStatus?.ebilling.configured ? 'Configuré' : 'Non configuré'}
              </span>
            </div>

            {ebillResult && (
              <div className="p-3 rounded-xl bg-[#F9F8F6] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-xs text-stone-800 dark:text-stone-200 space-y-1">
                <p>{ebillResult}</p>
                {ebillPortalUrl && (
                  <p className="break-all font-mono text-[11px] text-[#14532D] dark:text-emerald-400">
                    Lien portail de paiement : {ebillPortalUrl}
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <input
                type="number"
                min={100}
                required
                value={ebillAmount}
                onChange={(e) => setEbillAmount(e.target.value)}
                placeholder="Montant XAF (min 100)"
                className={`font-mono ${inputCls}`}
              />
              <input
                type="tel"
                required
                value={ebillPhone}
                onChange={(e) => setEbillPhone(e.target.value)}
                placeholder="Téléphone (074XXXXXX)"
                className={inputCls}
              />
              <input
                type="email"
                required
                value={ebillEmail}
                onChange={(e) => setEbillEmail(e.target.value)}
                placeholder="E-mail payeur"
                className={inputCls}
              />
              <select
                value={ebillProvider}
                onChange={(e) => setEbillProvider(e.target.value as 'airtel_money' | 'moov_money')}
                className={inputCls}
              >
                <option value="airtel_money">Airtel Money</option>
                <option value="moov_money">Moov Money</option>
              </select>
              <input
                type="text"
                required
                value={ebillDesc}
                onChange={(e) => setEbillDesc(e.target.value)}
                placeholder="Description courte"
                className={inputCls}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 text-xs text-stone-700 dark:text-stone-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ebillPush}
                  onChange={(e) => setEbillPush(e.target.checked)}
                  className="rounded border-stone-300 dark:border-stone-700 text-[#14532D]"
                />
                <span>Déclencher immédiatement un USSD Push v2 sur le téléphone</span>
              </label>

              <button
                type="submit"
                disabled={ebillBusy}
                className="px-4 py-2 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-semibold rounded-lg"
              >
                {ebillBusy ? 'Création…' : 'Générer facture E-Billing'}
              </button>
            </div>
          </form>

          {/* E-Billing Collection Ledger */}
          <div className="bg-white dark:bg-[#171715] border border-stone-200 dark:border-stone-800 rounded-2xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-xl font-semibold text-stone-900 dark:text-stone-100">
                  Journal des encaissements E-Billing ({ebillingTransactions.length})
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Suivi des factures eBills et notifications reçues sur{' '}
                  <code className="font-mono text-stone-800 dark:text-stone-200">/api/ebilling/callback</code>.
                </p>
              </div>
              <span className="text-xs font-mono text-stone-600 dark:text-stone-300">
                Webhook : {gatewayStatus?.ebilling.webhookSecretConfigured ? 'Signature activée' : 'Secret manquant'}
              </span>
            </div>

            {ebillingTransactions.length === 0 ? (
              <p className="text-xs text-stone-500 dark:text-stone-400">Aucune facture E-Billing émise pour le moment.</p>
            ) : (
              <div className="divide-y divide-stone-200 dark:divide-stone-800 text-xs">
                {ebillingTransactions.map((tx) => (
                  <div
                    key={tx.externalReference}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <p className="font-semibold text-stone-900 dark:text-stone-100">
                        {tx.externalReference} · {EBILLING_STATUS_LABELS[tx.status]}
                        {tx.operator ? ` · ${PROVIDER_LABELS[tx.operator] || tx.operator}` : ''}
                      </p>
                      <p className="text-stone-600 dark:text-stone-400">
                        eBill {tx.billId} · {tx.payerEmail} · {tx.payerMsisdnMasked}
                        {tx.webhookEvents && tx.webhookEvents.length > 0
                          ? ` · ${tx.webhookEvents.length} callback(s) vérifié(s)`
                          : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono font-semibold text-stone-900 dark:text-stone-100 tabular-nums">
                        {tx.amountXaf.toLocaleString('fr-FR')} XAF
                      </span>
                      {tx.status === 'pending' && (
                        <button
                          type="button"
                          disabled={ebillSyncingRef === tx.externalReference}
                          onClick={async () => {
                            const freshToken = await getFreshIdToken();
                            if (!freshToken) return;
                            setEbillSyncingRef(tx.externalReference);
                            try {
                              await enquiryEbillingTransaction(tx.externalReference, { idToken: freshToken });
                              await loadAll();
                            } catch (err) {
                              setActionError(
                                err instanceof Error ? err.message : 'Erreur lors de la synchronisation E-Billing.'
                              );
                            } finally {
                              setEbillSyncingRef(null);
                            }
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 border border-stone-300 dark:border-stone-700 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-800"
                        >
                          <RefreshCw className={`w-3 h-3 ${ebillSyncingRef === tx.externalReference ? 'animate-spin' : ''}`} />
                          <span>Synchroniser</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Rewards & Transactions Registry */}
          <div className="bg-white dark:bg-[#171715] border border-stone-200 dark:border-stone-800 rounded-2xl p-6 space-y-4">
            <h3 className="font-display text-xl font-semibold text-stone-900 dark:text-stone-100">
              Registre des récompenses ({rewards.length}) et décaissements ({transactions.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-2">
                {rewards.map((r) => (
                  <div
                    key={r.id}
                    className="p-3 rounded-lg bg-[#F9F8F6] dark:bg-stone-900/70 border border-stone-200 dark:border-stone-800 flex justify-between gap-3"
                  >
                    <span className="text-stone-800 dark:text-stone-200">
                      {r.contributorName} ({r.periodLabel}) · {REWARD_STATUS_LABELS[r.decisionStatus] || r.decisionStatus}
                    </span>
                    <span className="font-mono font-semibold tabular-nums shrink-0 text-stone-900 dark:text-stone-100">
                      {r.amountXaf.toLocaleString('fr-FR')} XAF
                    </span>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                {transactions.map((t) => (
                  <div
                    key={t.id}
                    className="p-3 rounded-lg border border-stone-200 dark:border-stone-800 flex justify-between gap-3"
                  >
                    <span className="text-stone-800 dark:text-stone-200">
                      {PROVIDER_LABELS[t.provider] || t.provider} · {t.providerTransactionId || t.idempotencyKey} ·{' '}
                      {TRANSACTION_STATUS_LABELS[t.status] || t.status}
                    </span>
                    <span className="font-mono font-semibold tabular-nums shrink-0 text-stone-900 dark:text-stone-100">
                      {t.amountXaf.toLocaleString('fr-FR')} XAF
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: OFFICIAL SOCIAL LINKS CRUD */}
      {tab === 'social' && isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleSaveSocialLink}
            className="lg:col-span-5 bg-white dark:bg-[#171715] border border-stone-200 dark:border-stone-800 rounded-2xl p-6 space-y-4"
          >
            <div className="flex items-center gap-2">
              <Share2 className="w-5 h-5 text-[#14532D] dark:text-emerald-400" />
              <h2 className="font-display text-2xl font-semibold text-stone-900 dark:text-stone-100">
                {editingSocialId ? 'Modifier le réseau social' : 'Ajouter un réseau social officiel'}
              </h2>
            </div>
            <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
              Les liens actifs apparaissent automatiquement dans le pied de page et la section communauté de la bibliothèque. Seules les URL sécurisées <span className="font-mono">https://</span> sont acceptées.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">Plateforme</label>
                <select
                  value={socialPlatform}
                  onChange={(e) => setSocialPlatform(e.target.value as SocialPlatform)}
                  className={`w-full ${inputCls}`}
                >
                  {(Object.keys(SOCIAL_PLATFORM_LABELS) as SocialPlatform[]).map((p) => (
                    <option key={p} value={p}>
                      {SOCIAL_PLATFORM_LABELS[p]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Libellé affiché *
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={60}
                  value={socialLabel}
                  onChange={(e) => setSocialLabel(e.target.value)}
                  placeholder="Ex. Page Facebook officielle"
                  className={`w-full ${inputCls}`}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  URL officielle (https://) *
                </label>
                <input
                  type="url"
                  required
                  value={socialUrl}
                  onChange={(e) => setSocialUrl(e.target.value)}
                  placeholder="https://facebook.com/gabonpatrimoine"
                  className={`w-full font-mono ${inputCls}`}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Ordre d’affichage
                </label>
                <input
                  type="number"
                  min={0}
                  max={1000}
                  value={socialOrder}
                  onChange={(e) => setSocialOrder(e.target.value)}
                  className={`w-full font-mono ${inputCls}`}
                />
              </div>
              <label className="inline-flex items-center gap-2 text-xs text-stone-700 dark:text-stone-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={socialActive}
                  onChange={(e) => setSocialActive(e.target.checked)}
                  className="rounded border-stone-300 dark:border-stone-700 text-[#14532D]"
                />
                <span>Lien actif et visible publiquement</span>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={socialSaving}
                className="px-5 py-2.5 bg-[#14532D] text-white text-xs font-semibold rounded-xl hover:bg-[#114224]"
              >
                {socialSaving ? 'Enregistrement…' : editingSocialId ? 'Mettre à jour' : 'Ajouter le lien'}
              </button>
              {editingSocialId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingSocialId(null);
                    setSocialLabel('');
                    setSocialUrl('');
                    setSocialActive(true);
                  }}
                  className="text-xs text-stone-500 dark:text-stone-400"
                >
                  Annuler l’édition
                </button>
              )}
            </div>
          </form>

          <div className="lg:col-span-7 bg-white dark:bg-[#171715] border border-stone-200 dark:border-stone-800 rounded-2xl p-6 space-y-4">
            <h3 className="font-display text-2xl font-semibold text-stone-900 dark:text-stone-100">
              Liens configurés ({socialLinks.length})
            </h3>
            {socialLinks.length === 0 ? (
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Aucun réseau social enregistré pour le moment. Ajoutez votre premier lien à gauche.
              </p>
            ) : (
              <div className="divide-y divide-stone-200 dark:divide-stone-800 text-xs">
                {socialLinks.map((link) => (
                  <div key={link.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11px] text-stone-500 dark:text-stone-400">
                          #{link.displayOrder}
                        </span>
                        <span className="font-semibold text-stone-900 dark:text-stone-100">{link.label}</span>
                        <span className="text-stone-400" aria-hidden="true">·</span>
                        <span className="text-stone-600 dark:text-stone-300">
                          {SOCIAL_PLATFORM_LABELS[link.platform]}
                        </span>
                        <span className="text-stone-400" aria-hidden="true">·</span>
                        <span
                          className={
                            link.isActive
                              ? 'text-[#14532D] dark:text-emerald-400 font-semibold'
                              : 'text-stone-500 dark:text-stone-400'
                          }
                        >
                          {link.isActive ? 'Actif' : 'Désactivé'}
                        </span>
                      </div>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-[11px] text-[#14532D] dark:text-emerald-400 hover:underline break-all"
                      >
                        <span>{link.url}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={async () => {
                          setActionError(null);
                          try {
                            await saveSocialLink(
                              {
                                id: link.id,
                                platform: link.platform,
                                label: link.label,
                                url: link.url,
                                isActive: !link.isActive,
                                displayOrder: link.displayOrder,
                              },
                              profile
                            );
                            await loadAll();
                          } catch (err) {
                            setActionError(err instanceof Error ? err.message : 'Erreur lors du basculement.');
                          }
                        }}
                        className="px-2.5 py-1.5 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-medium hover:bg-stone-50 dark:hover:bg-stone-800"
                      >
                        {link.isActive ? 'Désactiver' : 'Activer'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSocialId(link.id);
                          setSocialPlatform(link.platform);
                          setSocialLabel(link.label);
                          setSocialUrl(link.url);
                          setSocialOrder(String(link.displayOrder));
                          setSocialActive(link.isActive);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-stone-300 dark:border-stone-700 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-800"
                      >
                        <Pencil className="w-3 h-3" />
                        <span>Modifier</span>
                      </button>
                      {confirmDeleteSocialId === link.id ? (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={async () => {
                              setActionError(null);
                              try {
                                await deleteSocialLink(link, profile);
                                setConfirmDeleteSocialId(null);
                                await loadAll();
                              } catch (err) {
                                setActionError(err instanceof Error ? err.message : 'Erreur lors de la suppression.');
                              }
                            }}
                            className="px-2.5 py-1.5 bg-red-700 text-white font-semibold rounded-lg"
                          >
                            Confirmer
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteSocialId(null)}
                            className="px-2 py-1 text-stone-500"
                          >
                            Annuler
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteSocialId(link.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Supprimer</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 6: AUDIT LOGS */}
      {tab === 'audit' && isAdmin && (
        <div className="bg-white dark:bg-[#171715] border border-stone-200 dark:border-stone-800 rounded-2xl p-6 space-y-4">
          <h2 className="font-display text-2xl font-semibold text-stone-900 dark:text-stone-100">
            Historique sécurisé des actions sensibles
          </h2>
          {auditLogs.length === 0 ? (
            <p className="text-xs text-stone-500 dark:text-stone-400">Aucune entrée d’audit enregistrée.</p>
          ) : (
            <div className="divide-y divide-stone-100 dark:divide-stone-800 text-xs">
              {auditLogs.map((log) => (
                <div key={log.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="font-mono font-semibold text-stone-900 dark:text-stone-100">{log.action}</span>
                    <span className="text-stone-600 dark:text-stone-300 ml-2">{log.summary}</span>
                  </div>
                  <span className="text-stone-500 dark:text-stone-400 shrink-0">{log.actorEmail || log.actorId}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
