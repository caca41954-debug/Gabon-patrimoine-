import React, { useEffect, useState } from 'react';
import { Award, CheckCircle2, Info } from 'lucide-react';
import { REWARD_CRITERIA, ROLE_LABELS } from '../data/gabonData';
import { fetchAnnouncedRewards } from '../services/firestoreService';
import type { MobileMoneyProviderStatus, Reward } from '../types';
import { ShareButton } from './ShareModal';

interface LaureatesViewProps {
  onNavigatePayment?: () => void;
}

export function LaureatesView({ onNavigatePayment }: LaureatesViewProps) {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [providers, setProviders] = useState<MobileMoneyProviderStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const [rwd, provRes] = await Promise.all([
          fetchAnnouncedRewards(),
          fetch('/api/payments/providers').then((r) => r.json() as Promise<{ providers?: MobileMoneyProviderStatus[] }>),
        ]);
        if (!active) return;
        setRewards(rwd);
        setProviders(provRes.providers || []);
      } catch (err) {
        console.error('Error loading laureates:', err);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-12 space-y-14">
      <section className="max-w-3xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-widest text-stone-500 dark:text-stone-400">
            Programme de reconnaissance · Mérite documentaire
          </p>
          <ShareButton
            title="Lauréats Gabon Patrimoine"
            description="Découvrez les contributeurs distingués pour la sauvegarde du patrimoine culturel gabonais."
            url="/?vue=laureates"
            compact
          />
        </div>
        <h1 className="font-display text-4xl sm:text-5xl font-semibold text-stone-900 dark:text-stone-100 leading-tight text-balance">
          Lauréats et valorisation des contributeurs
        </h1>
        <p className="text-base text-stone-600 dark:text-stone-300 leading-relaxed">
          Gabon Patrimoine distingue périodiquement les citoyens, étudiants et enseignants-chercheurs dont les contributions enrichissent durablement la mémoire culturelle nationale. Les décisions sont motivées par l’administration après évaluation qualitative et accord des bénéficiaires.
        </p>
      </section>

      <section className="space-y-5">
        <h2 className="font-display text-2xl sm:text-3xl font-semibold text-stone-900 dark:text-stone-100">
          Critères d’évaluation publiés
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {REWARD_CRITERIA.map((c, idx) => (
            <div key={c.title} className="bg-white dark:bg-[#1C1B19] border border-stone-200 dark:border-[#2E2C28] rounded-2xl p-5 space-y-2">
              <p className="font-mono text-xs text-stone-400 dark:text-stone-500 tabular-nums">0{idx + 1}.</p>
              <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">{c.title}</h3>
              <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">{c.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-stone-900 dark:text-stone-100">
              Contributeurs distingués
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
              Liste publique des lauréats ayant accepté la publication de leur distinction.
            </p>
          </div>
          {onNavigatePayment && (
            <button
              type="button"
              onClick={onNavigatePayment}
              className="px-4 py-2 text-xs font-semibold text-[#14532D] dark:text-emerald-400 border border-[#14532D]/30 dark:border-emerald-700 bg-white dark:bg-[#1C1B19] rounded-xl hover:bg-[#14532D]/5 dark:hover:bg-emerald-950/30 transition-colors self-start sm:self-auto"
            >
              Portail Mobile Money & Soutien →
            </button>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[1, 2].map((n) => (
              <div key={n} className="bg-white dark:bg-[#1C1B19] border border-stone-200 dark:border-[#2E2C28] rounded-2xl h-44 animate-pulse" />
            ))}
          </div>
        ) : rewards.length === 0 ? (
          <div className="bg-white dark:bg-[#1C1B19] border border-stone-200 dark:border-[#2E2C28] rounded-2xl p-10 text-center space-y-2">
            <Award className="w-8 h-8 text-[#92400E] dark:text-amber-400 mx-auto" strokeWidth={1.5} />
            <h3 className="font-display text-2xl font-semibold text-stone-900 dark:text-stone-100">
              Aucune distinction publiée pour la période en cours
            </h3>
            <p className="text-xs text-stone-600 dark:text-stone-400 max-w-md mx-auto leading-relaxed">
              Les prochains lauréats apparaîtront ici dès que l’administrateur principal aura validé les évaluations documentaires et recueilli leur consentement de publication.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {rewards.map((reward) => (
              <article
                key={reward.id}
                className="bg-white dark:bg-[#1C1B19] border border-stone-200 dark:border-[#2E2C28] rounded-2xl p-6 space-y-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-[#92400E] dark:text-amber-400 font-medium">
                      {reward.periodLabel} · {ROLE_LABELS[reward.contributorRole]}
                    </p>
                    <h3 className="font-display text-2xl font-semibold text-stone-900 dark:text-stone-100">
                      {reward.contributorName}
                    </h3>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-[#14532D] dark:text-emerald-400 shrink-0" />
                </div>

                {reward.featuredContributionTitle && (
                  <p className="text-xs font-medium text-stone-800 dark:text-stone-200">
                    Œuvre distinguée : « {reward.featuredContributionTitle} »
                  </p>
                )}

                <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                  {reward.criteriaSummary}
                </p>

                <div className="pt-3 border-t border-stone-100 dark:border-[#2E2C28] flex flex-wrap items-center justify-between gap-3 text-xs text-stone-500 dark:text-stone-400">
                  <div>
                    <span>Dotation attribuée : </span>
                    <span className="font-mono font-medium text-stone-900 dark:text-stone-100 tabular-nums">
                      {reward.amountXaf.toLocaleString('fr-FR')} XAF
                    </span>
                  </div>
                  <ShareButton
                    title={`${reward.contributorName} — Lauréat Gabon Patrimoine (${reward.periodLabel})`}
                    description={reward.featuredContributionTitle || reward.criteriaSummary}
                    url="/?vue=laureates"
                    compact
                  />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white dark:bg-[#1C1B19] border border-stone-200 dark:border-[#2E2C28] rounded-2xl p-6 space-y-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-[#92400E] dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              État des passerelles Mobile Money (Airtel Money & Moov Money Gabon)
            </h3>
            <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
              Par souci de transparence financière, aucun décaissement automatique n’est simulé sans activation des clés marchandes officielles sur le serveur.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {providers.map((p) => (
            <div key={p.id} className="p-4 rounded-xl bg-[#F9F8F6] dark:bg-[#23211E] border border-stone-200 dark:border-[#2E2C28] space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-stone-900 dark:text-stone-100">{p.label}</span>
                <span className="text-xs font-mono text-stone-600 dark:text-stone-400">
                  {p.configured ? 'Configuré' : 'Validation manuelle'}
                </span>
              </div>
              <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">{p.notice}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
