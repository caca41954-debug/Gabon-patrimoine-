import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  CheckCircle2,
  ClipboardCheck,
  Edit3,
  LogOut,
  Trash2,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  formatDateFr,
  GABON_PROVINCES,
  PAYOUT_STATUS_LABELS,
  PROVIDER_LABELS,
  REWARD_STATUS_LABELS,
  ROLE_LABELS,
  STATUS_META,
  TRANSACTION_STATUS_LABELS,
  WALLET_TX_STATUS_LABELS,
} from '../data/gabonData';
import {
  createPayoutRequest,
  deleteDraftContribution,
  fetchMyContributions,
  fetchMyPayoutRequests,
  fetchMyRewards,
  fetchMyTransactions,
  markNotificationRead,
  submitSignedInAssistanceRequest,
  toggleRewardPublicConsent,
  updateOwnProfile,
  withdrawContribution,
} from '../services/firestoreService';
import { fetchWalletSummary, fetchWalletTransactionsPage } from '../services/walletService';
import type {
  Contribution,
  FinancialTransaction,
  MobileMoneyProviderStatus,
  PayoutRequest,
  Reward,
  WalletAccount,
  WalletTransaction,
} from '../types';
import {
  ContributionStatusIndicator,
  getStatusIconAndColor,
  ModerationDetailModal,
} from './ContributionStatusIndicator';

interface AccountWorkspaceProps {
  onOpenAuthModal: () => void;
  onEditContribution: (c: Contribution) => void;
  onNavigateContribute: () => void;
  onNavigatePayment?: (mode?: 'deposit' | 'withdraw' | 'support') => void;
}

export function AccountWorkspace({
  onOpenAuthModal,
  onEditContribution,
  onNavigateContribute,
  onNavigatePayment,
}: AccountWorkspaceProps) {
  const {
    profile,
    firebaseUser,
    getFreshIdToken,
    logout,
    refreshProfile,
    notifications,
    refreshNotifications,
  } = useAuth();

  const [tab, setTab] = useState<'contributions' | 'rewards' | 'profile' | 'notifications' | 'assistance'>('contributions');
  const [myContributions, setMyContributions] = useState<Contribution[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'needs_revision' | 'published' | 'draft'>('all');
  const [detailContribution, setDetailContribution] = useState<Contribution | null>(null);
  const [myRewards, setMyRewards] = useState<Reward[]>([]);
  const [myPayouts, setMyPayouts] = useState<PayoutRequest[]>([]);
  const [myTransactions, setMyTransactions] = useState<FinancialTransaction[]>([]);
  const [walletAccount, setWalletAccount] = useState<WalletAccount | null>(null);
  const [recentWalletTxs, setRecentWalletTxs] = useState<WalletTransaction[]>([]);
  const [providers, setProviders] = useState<MobileMoneyProviderStatus[]>([]);
  const [loading, setLoading] = useState(true);

  // Profile form state
  const [displayName, setDisplayName] = useState('');
  const [province, setProvince] = useState('Estuaire');
  const [locality, setLocality] = useState('');
  const [institution, setInstitution] = useState('');
  const [discipline, setDiscipline] = useState('');
  const [studyLevel, setStudyLevel] = useState('');
  const [bio, setBio] = useState('');
  const [phone, setPhone] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [confirmActionId, setConfirmActionId] = useState<string | null>(null);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);

  // Reward payout form state
  const [payoutReward, setPayoutReward] = useState<Reward | null>(null);
  const [payoutProvider, setPayoutProvider] = useState<'airtel_money' | 'moov_money'>('airtel_money');
  const [payoutPhone, setPayoutPhone] = useState('');
  const [payoutSubmitting, setPayoutSubmitting] = useState(false);
  const [payoutError, setPayoutError] = useState<string | null>(null);

  // Assistance form state
  const [assistMsg, setAssistMsg] = useState('');
  const [assistSent, setAssistSent] = useState(false);
  const [assistError, setAssistError] = useState<string | null>(null);
  const [assistSending, setAssistSending] = useState(false);

  const loadWorkspaceData = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const freshToken = await getFreshIdToken();
      const [contribs, rwds, pays, txs, provRes, walletSum, walletTxs] = await Promise.all([
        fetchMyContributions(profile.uid),
        fetchMyRewards(profile.uid),
        fetchMyPayoutRequests(profile.uid),
        fetchMyTransactions(profile.uid),
        fetch('/api/payments/providers').then((r) => r.json() as Promise<{ providers?: MobileMoneyProviderStatus[] }>),
        freshToken ? fetchWalletSummary(freshToken).catch(() => null) : Promise.resolve(null),
        freshToken ? fetchWalletTransactionsPage(freshToken, { page: 1, pageSize: 5 }).catch(() => null) : Promise.resolve(null),
      ]);
      setMyContributions(contribs);
      setMyRewards(rwds);
      setMyPayouts(pays);
      setMyTransactions(txs);
      setProviders(provRes.providers || []);
      if (walletSum) setWalletAccount(walletSum.account);
      if (walletTxs) setRecentWalletTxs(walletTxs.items);
    } finally {
      setLoading(false);
    }
  }, [profile, getFreshIdToken]);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName);
      setProvince(profile.province || 'Estuaire');
      setLocality(profile.locality || '');
      setInstitution(profile.institution || '');
      setDiscipline(profile.discipline || '');
      setStudyLevel(profile.studyLevel || '');
      setBio(profile.bio || '');
      setPhone(profile.phone || '');
      void loadWorkspaceData();
    }
  }, [profile, loadWorkspaceData]);

  if (!firebaseUser || !profile) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-16">
        <div className="bg-white dark:bg-[#171715] border border-stone-200 dark:border-stone-800 rounded-2xl p-8 text-center space-y-4">
          <h1 className="font-display text-3xl font-semibold text-stone-900 dark:text-stone-100">
            Espace personnel du contributeur
          </h1>
          <p className="text-sm text-stone-600 dark:text-stone-300 max-w-md mx-auto">
            Connectez-vous pour consulter l’état de vos contributions, gérer votre portefeuille Mobile Money ou suivre vos récompenses.
          </p>
          <button
            type="button"
            onClick={onOpenAuthModal}
            className="px-6 py-3 bg-[#14532D] text-white text-sm font-semibold rounded-xl hover:bg-[#114224]"
          >
            Se connecter
          </button>
        </div>
      </div>
    );
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMsg(null);
    setProfileError(null);
    try {
      await updateOwnProfile(profile.uid, {
        displayName,
        province,
        locality,
        institution,
        discipline,
        studyLevel,
        bio,
        phone,
      });
      await refreshProfile();
      setProfileMsg('Profil mis à jour avec succès.');
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Impossible de mettre à jour le profil.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleRequestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payoutReward) return;
    setPayoutError(null);
    const digits = payoutPhone.replace(/\D/g, '');
    if (digits.length < 8) {
      setPayoutError('Veuillez saisir un numéro Mobile Money gabonais valide.');
      return;
    }
    setPayoutSubmitting(true);
    try {
      const freshToken = await getFreshIdToken();
      await createPayoutRequest({
        reward: payoutReward,
        beneficiary: profile,
        provider: payoutProvider,
        rawPhone: payoutPhone,
        idToken: freshToken || undefined,
      });
      setPayoutReward(null);
      setPayoutPhone('');
      await loadWorkspaceData();
    } catch (err) {
      setPayoutError(err instanceof Error ? err.message : 'Erreur lors de la demande de retrait.');
    } finally {
      setPayoutSubmitting(false);
    }
  };

  const handleSendAssistance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (assistMsg.trim().length < 10) return;
    setAssistSending(true);
    setAssistError(null);
    setAssistSent(false);
    try {
      await submitSignedInAssistanceRequest({
        user: profile,
        requestedRole: profile.role === 'student' || profile.role === 'researcher' ? profile.role : 'citizen',
        message: assistMsg,
      });
      setAssistMsg('');
      setAssistSent(true);
    } catch (err) {
      setAssistError(err instanceof Error ? err.message : 'Impossible d’envoyer votre demande pour le moment.');
    } finally {
      setAssistSending(false);
    }
  };

  const requestedRewardIds = new Set(myPayouts.map((p) => p.rewardId));

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-10 space-y-8">
      {/* Header Summary */}
      <div className="bg-white dark:bg-[#171715] border border-stone-200 dark:border-stone-800 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
            <span className="font-semibold text-[#92400E] dark:text-amber-400">{ROLE_LABELS[profile.role]}</span>
            <span aria-hidden="true">·</span>
            <span>{profile.province || 'Gabon'}</span>
            {profile.verifiedBadge && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 text-[#14532D] dark:text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Profil scientifique vérifié
                </span>
              </>
            )}
          </div>
          <h1 className="font-display text-3xl font-semibold text-stone-900 dark:text-stone-100">
            {profile.displayName}
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400">{profile.email}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onNavigateContribute}
            className="px-4 py-2 bg-[#14532D] text-white text-xs font-semibold rounded-xl hover:bg-[#114224] whitespace-nowrap shrink-0"
          >
            Nouvelle contribution
          </button>
          <button
            type="button"
            onClick={() => void logout()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-200 text-xs font-medium rounded-xl hover:bg-stone-50 dark:hover:bg-stone-800 whitespace-nowrap shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Déconnexion</span>
          </button>
        </div>
      </div>

      {/* Prominent Mobile Money Wallet Card (Always visible in Workspace Dashboard) */}
      <section className="bg-white dark:bg-[#171715] border border-stone-200 dark:border-stone-800 rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-stone-500 dark:text-stone-400">
            <Wallet className="w-4 h-4 text-[#14532D] dark:text-emerald-400" />
            <span>Portefeuille Mobile Money · Airtel & Moov Gabon</span>
          </div>
          <div className="flex flex-wrap items-baseline gap-5">
            <div>
              <p className="font-mono text-3xl font-semibold text-stone-900 dark:text-stone-100 tabular-nums">
                {(walletAccount?.availableXaf ?? 0).toLocaleString('fr-FR')} XAF
              </p>
              <p className="text-xs text-stone-500 dark:text-stone-400">Solde disponible</p>
            </div>
            {(walletAccount?.pendingWithdrawalXaf ?? 0) > 0 && (
              <div>
                <p className="font-mono text-lg font-semibold text-[#92400E] dark:text-amber-400 tabular-nums">
                  {walletAccount?.pendingWithdrawalXaf.toLocaleString('fr-FR')} XAF
                </p>
                <p className="text-xs text-stone-500 dark:text-stone-400">Retrait réservé</p>
              </div>
            )}
          </div>
          <p className="text-xs text-stone-600 dark:text-stone-300">
            Comptes liés :{' '}
            <span className="font-mono">
              Airtel {walletAccount?.linkedAccounts.airtel_money?.msisdnMasked || 'non lié'}
            </span>{' '}
            ·{' '}
            <span className="font-mono">
              Moov {walletAccount?.linkedAccounts.moov_money?.msisdnMasked || 'non lié'}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onNavigatePayment?.('deposit')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#14532D] text-white text-xs font-semibold rounded-xl hover:bg-[#114224] transition-colors"
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>Dépôt</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigatePayment?.('withdraw')}
            className="inline-flex items-center gap-2 px-5 py-2.5 border border-stone-300 dark:border-stone-700 bg-[#F9F8F6] dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-semibold rounded-xl hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors"
          >
            <ArrowUpRight className="w-4 h-4 text-[#14532D] dark:text-emerald-400" />
            <span>Retrait</span>
          </button>
        </div>
      </section>

      {/* Segmented Workspace Navigation */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 bg-stone-200/70 dark:bg-stone-800/80 rounded-xl w-fit">
        {(
          [
            { id: 'contributions', label: `Contributions (${myContributions.length})` },
            { id: 'rewards', label: `Portefeuille & Récompenses (${myRewards.length})` },
            { id: 'profile', label: 'Mon profil' },
            { id: 'notifications', label: `Notifications (${notifications.filter((n) => !n.read).length})` },
            { id: 'assistance', label: 'Assistance' },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              tab === item.id
                ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-sm'
                : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Tab 1: My Contributions */}
      {tab === 'contributions' && (() => {
        const countByFilter = {
          all: myContributions.length,
          pending: myContributions.filter((c) => c.status === 'submitted' || c.status === 'in_review').length,
          needs_revision: myContributions.filter((c) => c.status === 'needs_revision').length,
          published: myContributions.filter((c) => c.status === 'published' || c.status === 'validated').length,
          draft: myContributions.filter((c) => c.status === 'draft').length,
        };
        const visibleContributions = myContributions.filter((c) => {
          if (statusFilter === 'pending') return c.status === 'submitted' || c.status === 'in_review';
          if (statusFilter === 'needs_revision') return c.status === 'needs_revision';
          if (statusFilter === 'published') return c.status === 'published' || c.status === 'validated';
          if (statusFilter === 'draft') return c.status === 'draft';
          return true;
        });

        return (
          <div className="space-y-4">
            {myContributions.length > 0 && (
              <div className="bg-white dark:bg-[#171715] border border-stone-200 dark:border-stone-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {(
                    [
                      { id: 'all', label: `Toutes (${countByFilter.all})` },
                      { id: 'pending', label: `En attente de validation (${countByFilter.pending})` },
                      { id: 'needs_revision', label: `Requiert des ajustements (${countByFilter.needs_revision})` },
                      { id: 'published', label: `Publié (${countByFilter.published})` },
                      { id: 'draft', label: `Brouillons (${countByFilter.draft})` },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setStatusFilter(f.id)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                        statusFilter === f.id
                          ? 'bg-[#14532D] text-white border-[#14532D]'
                          : 'bg-[#F9F8F6] dark:bg-stone-900 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:border-stone-300'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-stone-500 dark:text-stone-400">
                  Cliquez sur « Détail modération » pour suivre chaque étape et consulter les retours.
                </p>
              </div>
            )}

            {workspaceError && (
              <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-800 dark:text-red-300">
                {workspaceError}
              </div>
            )}

            <div className="bg-white dark:bg-[#171715] border border-stone-200 dark:border-stone-800 rounded-2xl overflow-hidden">
              {loading ? (
                <div className="p-8 text-xs text-stone-500 dark:text-stone-400">Chargement de vos contributions…</div>
              ) : myContributions.length === 0 ? (
                <div className="p-10 text-center space-y-3">
                  <p className="font-display text-2xl font-semibold text-stone-900 dark:text-stone-100">
                    Aucune contribution déposée pour le moment
                  </p>
                  <p className="text-xs text-stone-600 dark:text-stone-400">
                    Commencez par partager un récit, une enquête ou une archive photographique.
                  </p>
                  <button
                    type="button"
                    onClick={onNavigateContribute}
                    className="px-4 py-2 bg-[#14532D] text-white text-xs font-semibold rounded-lg"
                  >
                    Déposer ma première contribution
                  </button>
                </div>
              ) : visibleContributions.length === 0 ? (
                <div className="p-8 text-center text-xs text-stone-500 dark:text-stone-400">
                  Aucune contribution dans ce statut pour le moment.
                </div>
              ) : (
                <div className="divide-y divide-stone-200 dark:divide-stone-800">
                  {visibleContributions.map((c) => {
                    const statusStyle = getStatusIconAndColor(c.status);
                    const meta = STATUS_META[c.status];
                    const confirmingDelete = confirmActionId === `del_${c.id}`;
                    const confirmingWithdraw = confirmActionId === `wd_${c.id}`;
                    return (
                      <div key={c.id} className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="space-y-2 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-stone-500 dark:text-stone-400">
                            <ContributionStatusIndicator
                              status={c.status}
                              verificationLabel={c.verificationLabel}
                              showVerification
                            />
                            <span aria-hidden="true">·</span>
                            <span>{c.categoryName}</span>
                            <span aria-hidden="true">·</span>
                            <span>{c.province}</span>
                            {c.updatedAt !== undefined && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono text-[11px]">{formatDateFr(c.updatedAt)}</span>
                              </>
                            )}
                          </div>

                          <h3 className="text-base font-semibold text-stone-900 dark:text-stone-100 truncate">
                            {c.title}
                          </h3>

                          <div
                            className={`p-3 rounded-xl border ${statusStyle.borderClass} ${statusStyle.surfaceClass} text-xs text-stone-700 dark:text-stone-200 space-y-1`}
                          >
                            <p>{c.moderationNote ? `Retour modération : ${c.moderationNote}` : meta.description}</p>
                            {c.status === 'needs_revision' && (
                              <p className="font-medium text-orange-950 dark:text-orange-300">{meta.nextStep}</p>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setDetailContribution(c)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-stone-800 dark:text-stone-100 bg-[#F9F8F6] dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700"
                          >
                            <ClipboardCheck className="w-3.5 h-3.5 text-[#14532D] dark:text-emerald-400" />
                            <span>Détail modération</span>
                          </button>

                          {(c.status === 'draft' || c.status === 'needs_revision') && (
                            <button
                              type="button"
                              onClick={() => onEditContribution(c)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-[#14532D] rounded-lg hover:bg-[#114224]"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>{c.status === 'needs_revision' ? 'Ajuster' : 'Modifier'}</span>
                            </button>
                          )}
                          {c.status === 'draft' &&
                            (confirmingDelete ? (
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    setWorkspaceError(null);
                                    try {
                                      await deleteDraftContribution(c.id);
                                      setConfirmActionId(null);
                                      await loadWorkspaceData();
                                    } catch (err) {
                                      setWorkspaceError(
                                        err instanceof Error ? err.message : 'Erreur lors de la suppression.'
                                      );
                                    }
                                  }}
                                  className="px-2.5 py-1.5 text-xs font-semibold bg-red-700 text-white rounded-lg"
                                >
                                  Confirmer
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmActionId(null)}
                                  className="px-2 py-1.5 text-xs text-stone-500 dark:text-stone-400"
                                >
                                  Annuler
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmActionId(`del_${c.id}`)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Supprimer</span>
                              </button>
                            ))}
                          {c.status !== 'draft' &&
                            c.status !== 'withdrawn' &&
                            (confirmingWithdraw ? (
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    setWorkspaceError(null);
                                    try {
                                      await withdrawContribution(c.id, profile.uid);
                                      setConfirmActionId(null);
                                      await loadWorkspaceData();
                                    } catch (err) {
                                      setWorkspaceError(err instanceof Error ? err.message : 'Erreur lors du retrait.');
                                    }
                                  }}
                                  className="px-2.5 py-1.5 text-xs font-semibold bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 rounded-lg"
                                >
                                  Confirmer le retrait
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmActionId(null)}
                                  className="px-2 py-1.5 text-xs text-stone-500 dark:text-stone-400"
                                >
                                  Annuler
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmActionId(`wd_${c.id}`)}
                                className="px-3 py-1.5 text-xs font-medium text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-700 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-800"
                              >
                                Retirer
                              </button>
                            ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Tab 2: Wallet, Rewards & Mobile Money Withdrawals */}
      {tab === 'rewards' && (
        <div className="space-y-6">
          {/* Recent Mobile Money Wallet Activity */}
          <div className="bg-white dark:bg-[#171715] border border-stone-200 dark:border-stone-800 rounded-2xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl font-semibold text-stone-900 dark:text-stone-100">
                  Derniers mouvements Mobile Money
                </h2>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Dépôts et retraits Airtel Money / Moov Money de votre portefeuille.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onNavigatePayment?.('deposit')}
                  className="px-3.5 py-1.5 bg-[#14532D] text-white text-xs font-semibold rounded-lg hover:bg-[#114224]"
                >
                  Dépôt
                </button>
                <button
                  type="button"
                  onClick={() => onNavigatePayment?.('withdraw')}
                  className="px-3.5 py-1.5 border border-stone-300 dark:border-stone-700 text-xs font-semibold rounded-lg hover:bg-stone-50 dark:hover:bg-stone-800"
                >
                  Retrait
                </button>
              </div>
            </div>

            {recentWalletTxs.length === 0 ? (
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Aucun dépôt ou retrait enregistré sur votre portefeuille pour le moment.
              </p>
            ) : (
              <div className="divide-y divide-stone-200 dark:divide-stone-800 text-xs">
                {recentWalletTxs.map((tx) => (
                  <div key={tx.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-stone-900 dark:text-stone-100">
                        {tx.type === 'deposit' ? 'Dépôt' : 'Retrait'} · {PROVIDER_LABELS[tx.provider]} ·{' '}
                        {WALLET_TX_STATUS_LABELS[tx.status]}
                      </p>
                      <p className="text-stone-500 dark:text-stone-400 font-mono">
                        {tx.reference} · {tx.msisdnMasked} · {formatDateFr(tx.createdAt)}
                      </p>
                    </div>
                    <span className="font-mono font-semibold text-stone-900 dark:text-stone-100 tabular-nums">
                      {tx.type === 'deposit' ? '+' : '-'}
                      {tx.amountXaf.toLocaleString('fr-FR')} XAF
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Rewards */}
          <div className="bg-white dark:bg-[#171715] border border-stone-200 dark:border-stone-800 rounded-2xl p-6 space-y-4">
            <h2 className="font-display text-2xl font-semibold text-stone-900 dark:text-stone-100">
              Mes distinctions et récompenses
            </h2>
            {myRewards.length === 0 ? (
              <p className="text-xs text-stone-600 dark:text-stone-400">
                Vous n’avez pas encore reçu de récompense attribuée par l’administration.
              </p>
            ) : (
              <div className="divide-y divide-stone-200 dark:divide-stone-800">
                {myRewards.map((r) => (
                  <div key={r.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-xs text-[#92400E] dark:text-amber-400 font-medium">
                        {r.periodLabel} · {REWARD_STATUS_LABELS[r.decisionStatus] || r.decisionStatus}
                      </p>
                      <p className="font-mono text-lg font-semibold text-stone-900 dark:text-stone-100 tabular-nums">
                        {r.amountXaf.toLocaleString('fr-FR')} XAF
                      </p>
                      <p className="text-xs text-stone-600 dark:text-stone-300">{r.criteriaSummary}</p>
                      <label className="inline-flex items-center gap-2 text-xs text-stone-700 dark:text-stone-300 pt-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={r.publicAnnouncementApproved}
                          onChange={async (e) => {
                            await toggleRewardPublicConsent(r.id, e.target.checked);
                            await loadWorkspaceData();
                          }}
                          className="rounded border-stone-300 dark:border-stone-700 text-[#14532D]"
                        />
                        <span>J’autorise la publication de mon nom parmi les lauréats</span>
                      </label>
                    </div>

                    <div className="shrink-0">
                      {requestedRewardIds.has(r.id) ? (
                        <span className="text-xs font-medium text-stone-600 dark:text-stone-400">
                          Demande de retrait enregistrée
                        </span>
                      ) : r.decisionStatus === 'approved' || r.decisionStatus === 'announced' ? (
                        <button
                          type="button"
                          onClick={() => setPayoutReward(r)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#14532D] text-white text-xs font-semibold rounded-xl hover:bg-[#114224]"
                        >
                          <Wallet className="w-3.5 h-3.5" />
                          <span>Demander un retrait Mobile Money</span>
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {payoutReward && (
            <form
              onSubmit={handleRequestPayout}
              className="bg-white dark:bg-[#171715] border border-stone-300 dark:border-stone-700 rounded-2xl p-6 space-y-4"
            >
              <h3 className="font-display text-xl font-semibold text-stone-900 dark:text-stone-100">
                Demande de retrait — {payoutReward.amountXaf.toLocaleString('fr-FR')} XAF
              </h3>
              <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                Note : les passerelles Airtel Money / Moov Money sont actuellement en mode{' '}
                <strong>
                  {providers.some((p) => p.configured)
                    ? 'partiellement configuré'
                    : 'validation manuelle (prestataire API non configuré)'}
                </strong>
                . Aucun code PIN Mobile Money n’est demandé ni conservé.
              </p>

              {payoutError && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-800 dark:text-red-300">
                  {payoutError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                    Opérateur au Gabon
                  </label>
                  <select
                    value={payoutProvider}
                    onChange={(e) => setPayoutProvider(e.target.value as 'airtel_money' | 'moov_money')}
                    className="w-full px-3 py-2 text-sm border border-stone-300 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                  >
                    <option value="airtel_money">Airtel Money Gabon</option>
                    <option value="moov_money">Moov Money Gabon</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                    Numéro de téléphone bénéficiaire
                  </label>
                  <input
                    type="tel"
                    required
                    value={payoutPhone}
                    onChange={(e) => setPayoutPhone(e.target.value)}
                    placeholder="+241 074 XX XX XX"
                    className="w-full px-3 py-2 text-sm border border-stone-300 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={payoutSubmitting}
                  className="px-5 py-2 bg-[#14532D] text-white text-xs font-semibold rounded-lg"
                >
                  {payoutSubmitting ? 'Enregistrement…' : 'Soumettre à validation administrative'}
                </button>
                <button
                  type="button"
                  onClick={() => setPayoutReward(null)}
                  className="text-xs text-stone-500 dark:text-stone-400"
                >
                  Annuler
                </button>
              </div>
            </form>
          )}

          {/* Reward Payout & Transaction History */}
          <div className="bg-white dark:bg-[#171715] border border-stone-200 dark:border-stone-800 rounded-2xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-xl font-semibold text-stone-900 dark:text-stone-100">
                Historique des demandes de récompenses
              </h3>
              {onNavigatePayment && (
                <button
                  type="button"
                  onClick={() => onNavigatePayment('deposit')}
                  className="text-xs font-semibold text-[#14532D] dark:text-emerald-400 hover:underline"
                >
                  Ouvrir le portail Dépôt & Retrait →
                </button>
              )}
            </div>
            {myPayouts.length === 0 && myTransactions.length === 0 ? (
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Aucune demande de récompense enregistrée.
              </p>
            ) : (
              <div className="space-y-3">
                {myPayouts.map((p) => (
                  <div
                    key={p.id}
                    className="p-3.5 rounded-xl bg-[#F9F8F6] dark:bg-stone-900/70 border border-stone-200 dark:border-stone-800 flex flex-wrap items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-stone-900 dark:text-stone-100">
                        {PROVIDER_LABELS[p.provider] || p.provider} · {p.maskedPhone}
                      </p>
                      <p className="text-stone-500 dark:text-stone-400">
                        Statut : {PAYOUT_STATUS_LABELS[p.status] || p.status}
                        {p.providerReference ? ` · Réf. ${p.providerReference}` : ''}
                      </p>
                    </div>
                    <span className="font-mono font-semibold text-stone-900 dark:text-stone-100 tabular-nums">
                      {p.amountXaf.toLocaleString('fr-FR')} XAF
                    </span>
                  </div>
                ))}
                {myTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="p-3.5 rounded-xl border border-stone-200 dark:border-stone-800 flex flex-wrap items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-stone-900 dark:text-stone-100">
                        {TRANSACTION_STATUS_LABELS[tx.status] || tx.status} · {PROVIDER_LABELS[tx.provider] || tx.provider}
                      </p>
                      <p className="text-stone-500 dark:text-stone-400">
                        {tx.executionNote || 'Enregistrement comptable vérifié'}
                      </p>
                    </div>
                    <span className="font-mono font-semibold text-[#14532D] dark:text-emerald-400 tabular-nums">
                      {tx.amountXaf.toLocaleString('fr-FR')} XAF
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Profile Editor */}
      {tab === 'profile' && (
        <form
          onSubmit={handleSaveProfile}
          className="bg-white dark:bg-[#171715] border border-stone-200 dark:border-stone-800 rounded-2xl p-6 space-y-4"
        >
          <h2 className="font-display text-2xl font-semibold text-stone-900 dark:text-stone-100">
            Paramètres du profil
          </h2>
          {profileMsg && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-900 dark:text-emerald-300">
              {profileMsg}
            </div>
          )}
          {profileError && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-800 dark:text-red-300">
              {profileError}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">Nom public</label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-stone-300 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">Province</label>
              <select
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-stone-300 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
              >
                {GABON_PROVINCES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">Localité</label>
              <input
                type="text"
                value={locality}
                onChange={(e) => setLocality(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-stone-300 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Téléphone de contact (privé)
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-stone-300 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Établissement / Institution
              </label>
              <input
                type="text"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-stone-300 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Discipline / Spécialité
              </label>
              <input
                type="text"
                value={discipline}
                onChange={(e) => setDiscipline(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-stone-300 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
              />
            </div>
            {profile.role === 'student' && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Niveau d’études
                </label>
                <input
                  type="text"
                  value={studyLevel}
                  onChange={(e) => setStudyLevel(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-stone-300 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                />
              </div>
            )}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">Biographie</label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-stone-300 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={profileSaving}
            className="px-5 py-2.5 bg-[#14532D] text-white text-xs font-semibold rounded-xl hover:bg-[#114224]"
          >
            {profileSaving ? 'Enregistrement…' : 'Enregistrer les modifications'}
          </button>
        </form>
      )}

      {/* Tab 4: Notifications */}
      {tab === 'notifications' && (
        <div className="bg-white dark:bg-[#171715] border border-stone-200 dark:border-stone-800 rounded-2xl p-6 space-y-4">
          <h2 className="font-display text-2xl font-semibold text-stone-900 dark:text-stone-100">Notifications</h2>
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-xs text-stone-500 dark:text-stone-400 space-y-2">
              <Bell className="w-6 h-6 mx-auto text-stone-400" />
              <p>Aucune notification pour le moment.</p>
            </div>
          ) : (
            <div className="divide-y divide-stone-200 dark:divide-stone-800">
              {notifications.map((n) => (
                <div key={n.id} className="py-3.5 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p
                      className={`text-sm ${
                        n.read
                          ? 'text-stone-700 dark:text-stone-300'
                          : 'font-semibold text-stone-900 dark:text-stone-100'
                      }`}
                    >
                      {n.title}
                    </p>
                    <p className="text-xs text-stone-600 dark:text-stone-400">{n.message}</p>
                  </div>
                  {!n.read && (
                    <button
                      type="button"
                      onClick={async () => {
                        await markNotificationRead(n.id);
                        await refreshNotifications();
                      }}
                      className="text-xs font-medium text-[#14532D] dark:text-emerald-400 hover:underline shrink-0"
                    >
                      Marquer comme lu
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Account Assistance */}
      {tab === 'assistance' && (
        <form
          onSubmit={handleSendAssistance}
          className="bg-white dark:bg-[#171715] border border-stone-200 dark:border-stone-800 rounded-2xl p-6 space-y-4"
        >
          <h2 className="font-display text-2xl font-semibold text-stone-900 dark:text-stone-100">
            Demander une assistance ou correction de profil
          </h2>
          <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
            Sollicitez l’administrateur principal pour modifier votre catégorie (par exemple passer en profil Enseignant-chercheur vérifié) ou signaler une difficulté technique.
          </p>
          {assistSent && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-900 dark:text-emerald-300">
              Votre demande d’assistance a bien été transmise à l’administrateur principal.
            </div>
          )}
          {assistError && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-800 dark:text-red-300">
              {assistError}
            </div>
          )}
          <textarea
            required
            minLength={10}
            rows={4}
            value={assistMsg}
            onChange={(e) => setAssistMsg(e.target.value)}
            placeholder="Décrivez votre demande d’accompagnement ou de vérification…"
            className="w-full px-3.5 py-2.5 text-sm border border-stone-300 dark:border-stone-700 rounded-xl bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
          />
          <button
            type="submit"
            disabled={assistSending}
            className="px-5 py-2.5 bg-[#14532D] text-white text-xs font-semibold rounded-xl hover:bg-[#114224] disabled:opacity-50"
          >
            {assistSending ? 'Envoi en cours…' : 'Transmettre à l’administration'}
          </button>
        </form>
      )}

      {detailContribution && (
        <ModerationDetailModal
          contribution={detailContribution}
          viewerUid={profile.uid}
          isStaff={profile.role === 'admin' || profile.role === 'moderator'}
          onClose={() => setDetailContribution(null)}
          onEditContribution={onEditContribution}
        />
      )}
    </div>
  );
}
