import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Archive,
  CheckCircle2,
  Clock,
  Edit3,
  Eye,
  FileEdit,
  History,
  Lock,
  RotateCcw,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react';
import {
  formatDateFr,
  STATUS_LABELS,
  STATUS_META,
  VERIFICATION_DETAILS,
  VERIFICATION_LABELS,
} from '../data/gabonData';
import { fetchContributionModerationHistory } from '../services/firestoreService';
import type { Contribution, ContributionStatus, ModerationHistoryEntry, VerificationLabel } from '../types';

export function getStatusIconAndColor(status: ContributionStatus): {
  Icon: React.ComponentType<{ className?: string }>;
  textClass: string;
  surfaceClass: string;
  borderClass: string;
} {
  switch (status) {
    case 'published':
    case 'validated':
      return {
        Icon: status === 'published' ? CheckCircle2 : ShieldCheck,
        textClass: 'text-[#14532D] dark:text-emerald-400',
        surfaceClass: 'bg-[#14532D]/5 dark:bg-emerald-950/35',
        borderClass: 'border-[#14532D]/25 dark:border-emerald-800/60',
      };
    case 'submitted':
      return {
        Icon: Clock,
        textClass: 'text-amber-800 dark:text-amber-300',
        surfaceClass: 'bg-amber-50/70 dark:bg-amber-950/35',
        borderClass: 'border-amber-200 dark:border-amber-800/60',
      };
    case 'in_review':
      return {
        Icon: Eye,
        textClass: 'text-[#92400E] dark:text-amber-300',
        surfaceClass: 'bg-amber-50/70 dark:bg-amber-950/35',
        borderClass: 'border-amber-300 dark:border-amber-800/60',
      };
    case 'needs_revision':
      return {
        Icon: AlertCircle,
        textClass: 'text-orange-900 dark:text-orange-300',
        surfaceClass: 'bg-orange-50/80 dark:bg-orange-950/35',
        borderClass: 'border-orange-200 dark:border-orange-800/60',
      };
    case 'rejected':
      return {
        Icon: XCircle,
        textClass: 'text-red-700 dark:text-red-400',
        surfaceClass: 'bg-red-50/70 dark:bg-red-950/35',
        borderClass: 'border-red-200 dark:border-red-800/60',
      };
    case 'archived':
      return {
        Icon: Archive,
        textClass: 'text-stone-600 dark:text-stone-400',
        surfaceClass: 'bg-stone-100/70 dark:bg-[#23211E]',
        borderClass: 'border-stone-200 dark:border-[#2E2C28]',
      };
    case 'withdrawn':
      return {
        Icon: RotateCcw,
        textClass: 'text-stone-600 dark:text-stone-400',
        surfaceClass: 'bg-stone-100/70 dark:bg-[#23211E]',
        borderClass: 'border-stone-200 dark:border-[#2E2C28]',
      };
    case 'draft':
    default:
      return {
        Icon: FileEdit,
        textClass: 'text-stone-700 dark:text-stone-300',
        surfaceClass: 'bg-stone-100/70 dark:bg-[#23211E]',
        borderClass: 'border-stone-200 dark:border-[#2E2C28]',
      };
  }
}

interface ContributionStatusIndicatorProps {
  status: ContributionStatus;
  verificationLabel?: VerificationLabel;
  showVerification?: boolean;
  size?: 'sm' | 'md';
}

export function ContributionStatusIndicator({
  status,
  verificationLabel,
  showVerification = false,
  size = 'sm',
}: ContributionStatusIndicatorProps) {
  const { Icon, textClass } = getStatusIconAndColor(status);
  const iconSize = size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5';
  const textSize = size === 'md' ? 'text-sm' : 'text-xs';

  return (
    <span className={`inline-flex flex-wrap items-center gap-1.5 ${textSize}`}>
      <span className={`inline-flex items-center gap-1.5 font-semibold ${textClass}`}>
        <Icon className={`${iconSize} shrink-0`} />
        <span>{STATUS_LABELS[status]}</span>
      </span>
      {showVerification && verificationLabel && (
        <>
          <span className="text-stone-400 dark:text-stone-600" aria-hidden="true">
            ·
          </span>
          <span className="text-stone-600 dark:text-stone-300 font-medium">
            {VERIFICATION_LABELS[verificationLabel]}
          </span>
        </>
      )}
    </span>
  );
}

const PERMISSION_LABELS: Record<Contribution['permissionType'], string> = {
  auteur_original: 'Auteur original des contenus',
  autorisation_personnes: 'Autorisation des personnes concernées',
  domaine_public: 'Domaine public / archive libre',
  accord_communautaire: 'Accord communautaire documenté',
};

const VISIBILITY_LABELS: Record<Contribution['visibility'], string> = {
  public: 'Accès public (Bibliothèque)',
  restricted_community: 'Membres connectés uniquement',
  research_only: 'Chercheurs & modérateurs',
};

interface ModerationDetailModalProps {
  contribution: Contribution;
  viewerUid?: string;
  isStaff?: boolean;
  onClose: () => void;
  onEditContribution?: (contribution: Contribution) => void;
}

export function ModerationDetailModal({
  contribution,
  viewerUid,
  isStaff = false,
  onClose,
  onEditContribution,
}: ModerationDetailModalProps) {
  const [history, setHistory] = useState<ModerationHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const meta = STATUS_META[contribution.status];
  const style = getStatusIconAndColor(contribution.status);
  const StatusIcon = style.Icon;

  const canFetchHistory = Boolean(
    viewerUid && !contribution.isDemoArchive && (isStaff || viewerUid === contribution.authorId)
  );

  useEffect(() => {
    let active = true;
    if (!canFetchHistory || !viewerUid) return;
    setLoadingHistory(true);
    fetchContributionModerationHistory(contribution.id, viewerUid, isStaff)
      .then((entries) => {
        if (active) setHistory(entries);
      })
      .catch((err) => {
        console.error('Unable to load moderation history:', err);
      })
      .finally(() => {
        if (active) setLoadingHistory(false);
      });
    return () => {
      active = false;
    };
  }, [contribution.id, canFetchHistory, viewerUid, isStaff]);

  const workflowSteps = [
    {
      key: 'deposit',
      title: '1. Dépôt & droits',
      subtitle: contribution.consentConfirmed ? 'Consentement confirmé' : 'En préparation',
      state:
        contribution.status === 'draft'
          ? ('current' as const)
          : ('done' as const),
    },
    {
      key: 'queue',
      title: '2. En attente de validation',
      subtitle: 'File éditoriale',
      state:
        contribution.status === 'draft'
          ? ('upcoming' as const)
          : contribution.status === 'submitted'
            ? ('current' as const)
            : ('done' as const),
    },
    {
      key: 'review',
      title:
        contribution.status === 'needs_revision'
          ? '3. Requiert des ajustements'
          : '3. Examen éditorial',
      subtitle:
        contribution.status === 'needs_revision'
          ? 'Correction auteur attendue'
          : 'Relecture & sources',
      state:
        contribution.status === 'draft' || contribution.status === 'submitted'
          ? ('upcoming' as const)
          : contribution.status === 'in_review' || contribution.status === 'needs_revision'
            ? ('current' as const)
            : ('done' as const),
    },
    {
      key: 'decision',
      title:
        contribution.status === 'rejected'
          ? '4. Non retenu'
          : contribution.status === 'withdrawn'
            ? '4. Retiré'
            : contribution.status === 'archived'
              ? '4. Archivé'
              : '4. Publié',
      subtitle:
        contribution.status === 'published'
          ? 'Visible au catalogue'
          : 'Décision finale',
      state: ['validated', 'published', 'rejected', 'archived', 'withdrawn'].includes(
        contribution.status
      )
        ? ('current' as const)
        : ('upcoming' as const),
    },
  ];

  const canAuthorEdit =
    Boolean(onEditContribution) &&
    (contribution.status === 'draft' || contribution.status === 'needs_revision');

  return (
    <div
      className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="moderation-detail-title"
    >
      <div className="bg-white dark:bg-[#1C1B19] border border-stone-200 dark:border-[#2E2C28] rounded-2xl max-w-3xl w-full my-6 overflow-hidden shadow-2xl">
        {/* Top bar */}
        <div className="px-6 py-4 border-b border-stone-200 dark:border-[#2E2C28] bg-[#F9F8F6] dark:bg-[#161513] flex items-center justify-between gap-4">
          <div className="space-y-0.5 min-w-0">
            <p className="text-[11px] uppercase tracking-widest text-stone-500 dark:text-stone-400 font-semibold">
              Détail du processus de modération
            </p>
            <h2
              id="moderation-detail-title"
              className="font-display text-xl sm:text-2xl font-semibold text-stone-900 dark:text-stone-100 truncate"
            >
              {contribution.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer le détail de modération"
            className="p-2 text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white rounded-lg shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 max-h-[80vh] overflow-y-auto space-y-6">
          {/* Current Status Banner */}
          <div className={`p-5 rounded-xl border ${style.borderClass} ${style.surfaceClass} space-y-3`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <div className={`inline-flex items-center gap-2 text-base font-semibold ${style.textClass}`}>
                  <StatusIcon className="w-5 h-5 shrink-0" />
                  <span>{meta.label}</span>
                </div>
                <p className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed">{meta.description}</p>
              </div>
              {canAuthorEdit && onEditContribution && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onEditContribution(contribution);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#14532D] dark:bg-emerald-700 text-white text-xs font-semibold rounded-xl hover:bg-[#114224] dark:hover:bg-emerald-600 shrink-0"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>
                    {contribution.status === 'needs_revision'
                      ? 'Modifier et resoumettre'
                      : 'Reprendre le brouillon'}
                  </span>
                </button>
              )}
            </div>

            <div className="pt-3 border-t border-stone-200/80 dark:border-[#2E2C28] text-xs text-stone-700 dark:text-stone-300 space-y-1">
              <p>
                <span className="font-semibold text-stone-900 dark:text-stone-100">Prochaine étape :</span> {meta.nextStep}
              </p>
              {contribution.moderationNote && (
                <p className="pt-1">
                  <span className="font-semibold text-stone-900 dark:text-stone-100">Retour de l’équipe éditoriale :</span>{' '}
                  « {contribution.moderationNote} »
                </p>
              )}
            </div>
          </div>

          {/* 4-Step Workflow Tracker */}
          <div className="space-y-2.5">
            <h3 className="text-xs uppercase tracking-widest text-stone-500 dark:text-stone-400 font-semibold">
              Progression du dossier
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
              {workflowSteps.map((step) => {
                const isDone = step.state === 'done';
                const isCurrent = step.state === 'current';
                const boxStyle = isCurrent
                  ? `${style.surfaceClass} ${style.borderClass}`
                  : isDone
                    ? 'bg-[#14532D]/5 dark:bg-emerald-950/30 border-[#14532D]/25 dark:border-emerald-800/50'
                    : 'bg-[#F9F8F6] dark:bg-[#23211E] border-stone-200 dark:border-[#2E2C28]';
                const titleStyle = isCurrent
                  ? style.textClass
                  : isDone
                    ? 'text-[#14532D] dark:text-emerald-400'
                    : 'text-stone-500 dark:text-stone-400';
                return (
                  <div key={step.key} className={`p-3 rounded-xl border ${boxStyle} space-y-1`}>
                    <p className={`text-xs font-semibold ${titleStyle}`}>{step.title}</p>
                    <p className="text-[11px] text-stone-600 dark:text-stone-400">{step.subtitle}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Verification & Compliance Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-stone-200 dark:border-[#2E2C28] bg-[#F9F8F6] dark:bg-[#23211E] space-y-2">
              <p className="text-xs uppercase tracking-widest text-stone-500 dark:text-stone-400 font-semibold">
                Niveau de vérification
              </p>
              <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                {VERIFICATION_LABELS[contribution.verificationLabel]}
              </p>
              <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                {VERIFICATION_DETAILS[contribution.verificationLabel]}
              </p>
            </div>

            <div className="p-4 rounded-xl border border-stone-200 dark:border-[#2E2C28] bg-[#F9F8F6] dark:bg-[#23211E] space-y-2 text-xs">
              <p className="text-xs uppercase tracking-widest text-stone-500 dark:text-stone-400 font-semibold">
                Conformité, droits & dates
              </p>
              <div className="space-y-1.5 text-stone-700 dark:text-stone-300">
                <p>
                  <span className="text-stone-500 dark:text-stone-400">Visibilité :</span>{' '}
                  <strong className="font-medium text-stone-900 dark:text-stone-100">
                    {VISIBILITY_LABELS[contribution.visibility]}
                  </strong>
                </p>
                <p>
                  <span className="text-stone-500 dark:text-stone-400">Droits déclarés :</span>{' '}
                  <strong className="font-medium text-stone-900 dark:text-stone-100">
                    {PERMISSION_LABELS[contribution.permissionType]}
                  </strong>
                </p>
                {contribution.sensitiveLocation && (
                  <p className="inline-flex items-center gap-1 text-[#92400E] dark:text-amber-400 font-medium">
                    <Lock className="w-3 h-3" /> Localité exacte masquée par précaution
                  </p>
                )}
                {contribution.createdAt !== undefined && (
                  <p>
                    <span className="text-stone-500 dark:text-stone-400">Déposée le :</span>{' '}
                    {formatDateFr(contribution.createdAt)}
                  </p>
                )}
                {contribution.reviewedAt !== undefined && contribution.reviewedAt !== null && (
                  <p>
                    <span className="text-stone-500 dark:text-stone-400">Dernier examen :</span>{' '}
                    {formatDateFr(contribution.reviewedAt)}
                  </p>
                )}
                {contribution.publishedAt !== undefined && contribution.publishedAt !== null && (
                  <p>
                    <span className="text-stone-500 dark:text-stone-400">Publiée le :</span>{' '}
                    {formatDateFr(contribution.publishedAt)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Chronological Moderation History */}
          <div className="space-y-3 pt-2 border-t border-stone-200 dark:border-[#2E2C28]">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-stone-600 dark:text-stone-400" />
              <h3 className="text-xs uppercase tracking-widest text-stone-500 dark:text-stone-400 font-semibold">
                Historique des décisions et vérifications
              </h3>
            </div>

            {loadingHistory ? (
              <p className="text-xs text-stone-500 dark:text-stone-400">Chargement de l’historique de modération…</p>
            ) : history.length > 0 ? (
              <div className="space-y-2.5">
                {history.map((entry) => {
                  const entryStyle = getStatusIconAndColor(entry.decision);
                  const EntryIcon = entryStyle.Icon;
                  return (
                    <div
                      key={entry.id}
                      className="p-3.5 rounded-xl border border-stone-200 dark:border-[#2E2C28] bg-white dark:bg-[#23211E] space-y-1.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className={`inline-flex items-center gap-1.5 font-semibold ${entryStyle.textClass}`}>
                          <EntryIcon className="w-3.5 h-3.5" />
                          <span>{STATUS_LABELS[entry.decision]}</span>
                        </span>
                        <span className="text-stone-500 dark:text-stone-400 font-mono text-[11px]">
                          {formatDateFr(entry.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-stone-800 dark:text-stone-200 leading-relaxed">{entry.reason}</p>
                      <p className="text-[11px] text-stone-500 dark:text-stone-400">
                        Intervenant : {entry.moderatorName} · Mention : {VERIFICATION_LABELS[entry.verificationLabel]}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-stone-200 dark:border-[#2E2C28] bg-[#F9F8F6] dark:bg-[#23211E] space-y-2 text-xs text-stone-700 dark:text-stone-300">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <ContributionStatusIndicator
                    status={contribution.status}
                    verificationLabel={contribution.verificationLabel}
                    showVerification
                  />
                  {contribution.updatedAt !== undefined && (
                    <span className="text-[11px] font-mono text-stone-500 dark:text-stone-400">
                      {formatDateFr(contribution.reviewedAt || contribution.updatedAt || contribution.createdAt)}
                    </span>
                  )}
                </div>
                <p>
                  {contribution.moderationNote ||
                    (contribution.isDemoArchive
                      ? 'Notice éditoriale de démonstration validée selon les critères de la charte Gabon Patrimoine.'
                      : meta.description)}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
