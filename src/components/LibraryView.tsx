import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  Globe,
  Lock,
  Search,
  Wallet,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  DEMO_ARCHIVE_CONTRIBUTIONS,
  EPISTEMIC_LABELS,
  GABON_LANGUAGES,
  GABON_PROVINCES,
  HERO_IMAGE_PATH,
  OFFICIAL_CATEGORIES,
  ROLE_LABELS,
  sanitizeExternalUrl,
  SOCIAL_PLATFORM_LABELS,
  VERIFICATION_LABELS,
} from '../data/gabonData';
import {
  fetchCategories,
  fetchContributionById,
  fetchMyContributions,
  fetchPublishedContributions,
  fetchRestrictedPublishedContributions,
  submitReport,
} from '../services/firestoreService';
import type { ContentReport, Contribution, HeritageCategory, SocialLink } from '../types';
import { ArchivalImage, MediaAssetRenderer } from './ArchivalImage';
import { ContributionStatusIndicator, ModerationDetailModal } from './ContributionStatusIndicator';
import { PWAInstallButton } from './PWAControls';
import { ShareButton } from './ShareModal';

interface LibraryViewProps {
  initialFicheId?: string | null;
  onClearInitialFiche?: () => void;
  onNavigateContribute: () => void;
  onNavigateAccount?: () => void;
  onNavigatePayment?: () => void;
  onEditContribution?: (c: Contribution) => void;
  socialLinks?: SocialLink[];
}

export function LibraryView({
  initialFicheId,
  onClearInitialFiche,
  onNavigateContribute,
  onNavigateAccount,
  onNavigatePayment,
  onEditContribution,
  socialLinks = [],
}: LibraryViewProps) {
  const { profile, firebaseUser } = useAuth();
  const [liveContributions, setLiveContributions] = useState<Contribution[]>([]);
  const [myContributions, setMyContributions] = useState<Contribution[]>([]);
  const [categories, setCategories] = useState<HeritageCategory[]>(OFFICIAL_CATEGORIES);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedProvince, setSelectedProvince] = useState('all');
  const [selectedLanguage, setSelectedLanguage] = useState('all');
  const [selectedEpistemic, setSelectedEpistemic] = useState('all');

  const [activeContribution, setActiveContribution] = useState<Contribution | null>(null);
  const [moderationDetailTarget, setModerationDetailTarget] = useState<Contribution | null>(null);

  // Report modal state
  const [reportOpen, setReportOpen] = useState(false);
  const [reportCategory, setReportCategory] =
    useState<ContentReport['reasonCategory']>('erreur_factuelle');
  const [reportDetails, setReportDetails] = useState('');
  const [reportSending, setReportSending] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const [cats, pub] = await Promise.all([
          fetchCategories(),
          fetchPublishedContributions(),
        ]);
        let restricted: Contribution[] = [];
        let ownList: Contribution[] = [];
        if (firebaseUser?.emailVerified) {
          const isResearcherOrStaff = Boolean(
            profile && ['researcher', 'moderator', 'admin'].includes(profile.role)
          );
          const [resItems, mine] = await Promise.all([
            fetchRestrictedPublishedContributions(isResearcherOrStaff),
            profile ? fetchMyContributions(profile.uid).catch(() => []) : Promise.resolve([]),
          ]);
          restricted = resItems;
          ownList = mine;
        }
        if (!active) return;
        setCategories(cats);
        const merged = [...pub, ...restricted];
        const unique = Array.from(new Map(merged.map((c) => [c.id, c])).values());
        setLiveContributions(unique);
        setMyContributions(ownList);
      } catch (err) {
        console.error('Failed to load catalog:', err);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [firebaseUser, profile]);

  const showingDemo = liveContributions.length === 0;
  const catalogItems = useMemo(
    () => (showingDemo ? DEMO_ARCHIVE_CONTRIBUTIONS : liveContributions),
    [showingDemo, liveContributions]
  );

  // Deep-link auto-open for ?fiche=<id>
  useEffect(() => {
    if (!initialFicheId || loading) return;
    const found =
      catalogItems.find((c) => c.id === initialFicheId) ||
      myContributions.find((c) => c.id === initialFicheId) ||
      DEMO_ARCHIVE_CONTRIBUTIONS.find((c) => c.id === initialFicheId);
    if (found) {
      setActiveContribution(found);
      onClearInitialFiche?.();
      return;
    }
    let active = true;
    void fetchContributionById(initialFicheId).then((fetched) => {
      if (active && fetched) {
        setActiveContribution(fetched);
      }
      if (active) onClearInitialFiche?.();
    });
    return () => {
      active = false;
    };
  }, [initialFicheId, loading, catalogItems, myContributions, onClearInitialFiche]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return catalogItems.filter((item) => {
      if (selectedCategory !== 'all' && item.categoryId !== selectedCategory) return false;
      if (selectedProvince !== 'all' && item.province !== selectedProvince) return false;
      if (selectedLanguage !== 'all' && item.language !== selectedLanguage) return false;
      if (selectedEpistemic !== 'all' && item.epistemicType !== selectedEpistemic) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        (item.community || '').toLowerCase().includes(q) ||
        item.language.toLowerCase().includes(q) ||
        item.province.toLowerCase().includes(q)
      );
    });
  }, [
    catalogItems,
    searchQuery,
    selectedCategory,
    selectedProvince,
    selectedLanguage,
    selectedEpistemic,
  ]);

  const leadItem = filteredItems[0] || null;
  const secondaryItems = filteredItems.slice(1);

  const handleSendReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeContribution || !profile) return;
    setReportSending(true);
    setReportError(null);
    try {
      await submitReport({
        contributionId: activeContribution.id,
        contributionTitle: activeContribution.title,
        reporter: profile,
        reasonCategory: reportCategory,
        details: reportDetails,
      });
      setReportSent(true);
      setReportDetails('');
    } catch (err) {
      setReportError(
        err instanceof Error ? err.message : 'Impossible de transmettre le signalement pour le moment.'
      );
    } finally {
      setReportSending(false);
    }
  };

  return (
    <div className="space-y-16 pb-12">
      {/* 1. Museum Exhibition Marquee Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 pt-10 lg:pt-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-between py-2">
            <div className="space-y-6">
              <p className="text-xs uppercase tracking-widest text-stone-500 dark:text-stone-400">
                Collection numérique nationale · République Gabonaise
              </p>
              <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.5rem] font-semibold text-stone-900 dark:text-stone-100 leading-[1.08] text-balance">
                Préserver et transmettre la mémoire culturelle du Gabon.
              </h1>
              <p className="text-base sm:text-lg text-stone-600 dark:text-stone-300 leading-relaxed max-w-xl">
                Un espace commun pour les citoyens, les étudiants et les enseignants-chercheurs afin de documenter les langues, récits, savoir-faire et patrimoines de nos neuf provinces, dans le respect des communautés.
              </p>
            </div>

            <div className="pt-8 space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={onNavigateContribute}
                  className="px-6 py-3 min-h-[44px] bg-[#14532D] dark:bg-emerald-700 text-white text-sm font-semibold rounded-xl hover:bg-[#114224] dark:hover:bg-emerald-600 transition-colors whitespace-nowrap shrink-0"
                >
                  Déposer une contribution
                </button>
                <a
                  href="#catalogue-patrimonial"
                  className="px-5 py-3 min-h-[44px] inline-flex items-center border border-stone-300 dark:border-[#34312C] bg-white dark:bg-[#1C1B19] text-stone-800 dark:text-stone-100 text-sm font-medium rounded-xl hover:bg-stone-50 dark:hover:bg-[#23211E] transition-colors whitespace-nowrap shrink-0"
                >
                  Parcourir les archives
                </a>
                {onNavigatePayment && (
                  <button
                    type="button"
                    onClick={onNavigatePayment}
                    className="inline-flex items-center gap-1.5 px-4 py-3 min-h-[44px] border border-stone-300 dark:border-[#34312C] bg-white dark:bg-[#1C1B19] text-stone-800 dark:text-stone-100 text-sm font-medium rounded-xl hover:bg-stone-50 dark:hover:bg-[#23211E] transition-colors whitespace-nowrap shrink-0"
                  >
                    <Wallet className="w-4 h-4 text-[#14532D] dark:text-emerald-400" />
                    <span>Dépôt & Retrait</span>
                  </button>
                )}
              </div>

              <div className="pt-5 border-t border-stone-200 dark:border-[#2E2C28] grid grid-cols-3 gap-4">
                <div>
                  <p className="font-mono text-lg font-medium text-stone-900 dark:text-stone-100 tabular-nums">9</p>
                  <p className="text-xs text-stone-500 dark:text-stone-400">Provinces couvertes</p>
                </div>
                <div>
                  <p className="font-mono text-lg font-medium text-stone-900 dark:text-stone-100 tabular-nums">14</p>
                  <p className="text-xs text-stone-500 dark:text-stone-400">Domaines patrimoniaux</p>
                </div>
                <div>
                  <p className="font-mono text-lg font-medium text-stone-900 dark:text-stone-100 tabular-nums">100%</p>
                  <p className="text-xs text-stone-500 dark:text-stone-400">Relu avant publication</p>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="h-full min-h-[320px] lg:min-h-[460px] rounded-2xl overflow-hidden border border-stone-200 dark:border-[#2E2C28] bg-stone-100 dark:bg-[#1C1B19] relative">
              <ArchivalImage
                src={HERO_IMAGE_PATH}
                alt="Architecture traditionnelle gabonaise en bois sculpté à l’orée de la forêt équatoriale"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-white">
                <p className="text-[11px] uppercase tracking-widest text-stone-200">
                  Patrimoine architectural et forêt équatoriale
                </p>
                <p className="text-sm font-medium mt-1">
                  Chaque fiche publiée passe par une validation éditoriale et éthique préalable.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Search & Taxonomy Filter Toolbar */}
      <section id="catalogue-patrimonial" className="max-w-7xl mx-auto px-4 sm:px-8 space-y-6">
        {profile && myContributions.length > 0 && (
          <div className="bg-white dark:bg-[#1C1B19] border border-stone-200 dark:border-[#2E2C28] rounded-2xl p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-widest text-stone-500 dark:text-stone-400 font-semibold">
                  Suivi transparent de vos publications ({myContributions.length})
                </p>
                <p className="text-xs text-stone-600 dark:text-stone-400 mt-0.5">
                  Consultez en direct l’avancement éditorial de vos dépôts avant et après mise en ligne.
                </p>
              </div>
              {onNavigateAccount && (
                <button
                  type="button"
                  onClick={onNavigateAccount}
                  className="text-xs font-semibold text-[#14532D] dark:text-emerald-400 hover:underline whitespace-nowrap shrink-0"
                >
                  Ouvrir Mon espace →
                </button>
              )}
            </div>
            <div className="divide-y divide-stone-100 dark:divide-[#2E2C28] border-t border-stone-100 dark:border-[#2E2C28]">
              {myContributions.slice(0, 4).map((mine) => (
                <div
                  key={mine.id}
                  className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 min-w-0">
                    <ContributionStatusIndicator status={mine.status} />
                    <span className="text-stone-400 dark:text-stone-600" aria-hidden="true">·</span>
                    <span className="font-medium text-stone-900 dark:text-stone-100 truncate max-w-md">{mine.title}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setModerationDetailTarget(mine)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-700 dark:text-stone-300 hover:text-[#14532D] dark:hover:text-emerald-400 shrink-0"
                  >
                    <ClipboardCheck className="w-3.5 h-3.5 text-[#14532D] dark:text-emerald-400" />
                    <span>Détail modération</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-[#1C1B19] border border-stone-200 dark:border-[#2E2C28] rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-semibold text-stone-900 dark:text-stone-100">
                Bibliothèque patrimoniale
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                {showingDemo
                  ? 'Mode aperçu éditorial : fiches de démonstration affichées en attendant les premières publications validées.'
                  : `${filteredItems.length} ressource${filteredItems.length > 1 ? 's' : ''} publiée${filteredItems.length > 1 ? 's' : ''} et accessible${filteredItems.length > 1 ? 's' : ''}`}
              </p>
            </div>

            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un récit, une langue, un lieu…"
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-[#F9F8F6] dark:bg-[#141311] border border-stone-200 dark:border-[#34312C] text-stone-900 dark:text-stone-100 rounded-xl focus:outline-none focus:border-[#14532D] dark:focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-stone-100 dark:border-[#2E2C28]">
            <select
              aria-label="Filtrer par catégorie"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 text-xs font-medium text-stone-800 dark:text-stone-200 bg-[#F9F8F6] dark:bg-[#141311] border border-stone-200 dark:border-[#34312C] rounded-lg focus:outline-none focus:border-[#14532D]"
            >
              <option value="all">Toutes les catégories (14)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <select
              aria-label="Filtrer par province"
              value={selectedProvince}
              onChange={(e) => setSelectedProvince(e.target.value)}
              className="px-3 py-2 text-xs font-medium text-stone-800 dark:text-stone-200 bg-[#F9F8F6] dark:bg-[#141311] border border-stone-200 dark:border-[#34312C] rounded-lg focus:outline-none focus:border-[#14532D]"
            >
              <option value="all">Toutes les provinces (9)</option>
              {GABON_PROVINCES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>

            <select
              aria-label="Filtrer par langue"
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="px-3 py-2 text-xs font-medium text-stone-800 dark:text-stone-200 bg-[#F9F8F6] dark:bg-[#141311] border border-stone-200 dark:border-[#34312C] rounded-lg focus:outline-none focus:border-[#14532D]"
            >
              <option value="all">Toutes les langues</option>
              {GABON_LANGUAGES.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>

            <select
              aria-label="Filtrer par nature documentaire"
              value={selectedEpistemic}
              onChange={(e) => setSelectedEpistemic(e.target.value)}
              className="px-3 py-2 text-xs font-medium text-stone-800 dark:text-stone-200 bg-[#F9F8F6] dark:bg-[#141311] border border-stone-200 dark:border-[#34312C] rounded-lg focus:outline-none focus:border-[#14532D]"
            >
              <option value="all">Tous les formats épistémiques</option>
              {Object.entries(EPISTEMIC_LABELS).map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 3. Catalog Display */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-white dark:bg-[#1C1B19] border border-stone-200 dark:border-[#2E2C28] rounded-2xl p-5 h-80 animate-pulse" />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="bg-white dark:bg-[#1C1B19] border border-stone-200 dark:border-[#2E2C28] rounded-2xl p-12 text-center space-y-3">
            <BookOpen className="w-8 h-8 text-stone-400 mx-auto" strokeWidth={1.5} />
            <h3 className="font-display text-2xl font-semibold text-stone-900 dark:text-stone-100">
              Aucune archive ne correspond à ces critères
            </h3>
            <p className="text-sm text-stone-600 dark:text-stone-400 max-w-md mx-auto">
              Modifiez vos filtres ou contribuez pour enrichir cette thématique et cette province.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
                setSelectedProvince('all');
                setSelectedLanguage('all');
                setSelectedEpistemic('all');
              }}
              className="px-4 py-2 text-xs font-semibold text-[#14532D] dark:text-emerald-400 border border-[#14532D] dark:border-emerald-600 rounded-lg hover:bg-[#14532D]/5"
            >
              Réinitialiser les filtres
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {leadItem && (
              <article
                onClick={() => setActiveContribution(leadItem)}
                className="cursor-pointer group bg-white dark:bg-[#1C1B19] border border-stone-200 dark:border-[#2E2C28] rounded-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch hover:border-stone-300 dark:hover:border-stone-600 transition-colors"
              >
                <div className="lg:col-span-6 min-h-[260px] bg-stone-100 dark:bg-[#23211E] overflow-hidden">
                  <ArchivalImage
                    src={leadItem.mediaAssets[0]?.url}
                    alt={leadItem.mediaAssets[0]?.altText || leadItem.title}
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                  />
                </div>
                <div className="lg:col-span-6 p-6 sm:p-8 flex flex-col justify-between space-y-5">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                      <span className="font-semibold text-[#92400E] dark:text-amber-400">{leadItem.categoryName}</span>
                      <span aria-hidden="true">·</span>
                      <span>{leadItem.province}</span>
                      <span aria-hidden="true">·</span>
                      <span>{leadItem.language}</span>
                      {leadItem.isDemoArchive && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-medium text-stone-700 dark:text-stone-300">Démonstration</span>
                        </>
                      )}
                    </div>
                    <h3 className="font-display text-3xl font-semibold text-stone-900 dark:text-stone-100 leading-snug group-hover:text-[#14532D] dark:group-hover:text-emerald-400 transition-colors">
                      {leadItem.title}
                    </h3>
                    <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
                      {leadItem.summary}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-stone-100 dark:border-[#2E2C28] flex flex-wrap items-center justify-between gap-3 text-xs text-stone-500 dark:text-stone-400">
                    <div className="flex flex-wrap items-center gap-2">
                      <ContributionStatusIndicator
                        status={leadItem.status}
                        verificationLabel={leadItem.verificationLabel}
                        showVerification
                      />
                      <span aria-hidden="true">·</span>
                      <span>{leadItem.authorName}</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <ShareButton
                        title={leadItem.title}
                        description={leadItem.summary}
                        url={`/?fiche=${encodeURIComponent(leadItem.id)}`}
                        compact
                      />
                      <span className="font-semibold text-[#14532D] dark:text-emerald-400">Consulter →</span>
                    </div>
                  </div>
                </div>
              </article>
            )}

            {secondaryItems.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {secondaryItems.map((item) => (
                  <article
                    key={item.id}
                    onClick={() => setActiveContribution(item)}
                    className="cursor-pointer group bg-white dark:bg-[#1C1B19] border border-stone-200 dark:border-[#2E2C28] rounded-2xl overflow-hidden flex flex-col hover:border-stone-300 dark:hover:border-stone-600 transition-colors"
                  >
                    <div className="aspect-[4/3] bg-stone-100 dark:bg-[#23211E] overflow-hidden">
                      <ArchivalImage
                        src={item.mediaAssets[0]?.url}
                        alt={item.mediaAssets[0]?.altText || item.title}
                        className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                      />
                    </div>
                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400">
                          <span className="font-medium text-[#92400E] dark:text-amber-400">{item.categoryName}</span>
                          <span aria-hidden="true">·</span>
                          <span>{item.province}</span>
                          {item.isDemoArchive && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>Démonstration</span>
                            </>
                          )}
                        </div>
                        <h3 className="font-display text-2xl font-semibold text-stone-900 dark:text-stone-100 leading-snug group-hover:text-[#14532D] dark:group-hover:text-emerald-400 transition-colors">
                          {item.title}
                        </h3>
                        <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed line-clamp-3">
                          {item.summary}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-stone-100 dark:border-[#2E2C28] space-y-2 text-xs text-stone-500 dark:text-stone-400">
                        <ContributionStatusIndicator
                          status={item.status}
                          verificationLabel={item.verificationLabel}
                          showVerification
                        />
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate max-w-[55%]">{item.authorName}</span>
                          <ShareButton
                            title={item.title}
                            description={item.summary}
                            url={`/?fiche=${encodeURIComponent(item.id)}`}
                            compact
                          />
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Official Community & Mobile App Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8">
        <div className="bg-white dark:bg-[#1C1B19] border border-stone-200 dark:border-[#2E2C28] rounded-2xl p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <p className="text-xs uppercase tracking-widest text-[#14532D] dark:text-emerald-400 font-semibold">
              Accessibilité & Diffusion officielle
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-stone-900 dark:text-stone-100">
              Emportez les archives sur votre téléphone et suivez nos réseaux
            </h2>
            <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
              Installez Gabon Patrimoine comme application mobile (Android, iPhone, ordinateur) pour consulter les fiches même avec une connexion instable, et rejoignez nos canaux officiels.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end gap-3 shrink-0">
            <PWAInstallButton variant="primary" />
            {socialLinks.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {socialLinks.map((link) => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border border-stone-200 dark:border-[#2E2C28] bg-[#F9F8F6] dark:bg-[#23211E] text-stone-800 dark:text-stone-200 hover:border-[#14532D] dark:hover:border-emerald-500 transition-colors"
                  >
                    <Globe className="w-3.5 h-3.5 text-[#14532D] dark:text-emerald-400" />
                    <span>{link.label || SOCIAL_PLATFORM_LABELS[link.platform]}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 4. Detail Drawer / Modal */}
      {activeContribution && (
        <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#1C1B19] border border-stone-200 dark:border-[#2E2C28] rounded-2xl max-w-4xl w-full my-6 overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-stone-200 dark:border-[#2E2C28] flex flex-wrap items-center justify-between gap-4 bg-[#F9F8F6] dark:bg-[#161513]">
              <div className="text-xs text-stone-600 dark:text-stone-300 flex flex-wrap items-center gap-2">
                <ContributionStatusIndicator
                  status={activeContribution.status}
                  verificationLabel={activeContribution.verificationLabel}
                  showVerification
                />
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-[#92400E] dark:text-amber-400">{activeContribution.categoryName}</span>
                <span aria-hidden="true">·</span>
                <span>{activeContribution.province}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setModerationDetailTarget(activeContribution)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-stone-800 dark:text-stone-200 border border-stone-300 dark:border-[#34312C] rounded-lg bg-white dark:bg-[#23211E] hover:bg-stone-50 dark:hover:bg-[#2A2724]"
                >
                  <ClipboardCheck className="w-3.5 h-3.5 text-[#14532D] dark:text-emerald-400" />
                  <span>Détail modération</span>
                </button>
                <ShareButton
                  title={activeContribution.title}
                  description={activeContribution.summary}
                  url={`/?fiche=${encodeURIComponent(activeContribution.id)}`}
                  compact
                />
                <button
                  type="button"
                  onClick={() => {
                    setActiveContribution(null);
                    setReportOpen(false);
                    setReportSent(false);
                  }}
                  aria-label="Fermer la fiche"
                  className="p-2 text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 sm:p-8 max-h-[82vh] overflow-y-auto space-y-8">
              <div className="space-y-3">
                {activeContribution.isDemoArchive && (
                  <p className="text-xs font-medium text-[#92400E] dark:text-amber-400">
                    Notice de démonstration — illustration du format curatorial Gabon Patrimoine
                  </p>
                )}
                <h2 className="font-display text-3xl sm:text-4xl font-semibold text-stone-900 dark:text-stone-100 leading-tight">
                  {activeContribution.title}
                </h2>
                <p className="text-base text-stone-600 dark:text-stone-300 leading-relaxed">
                  {activeContribution.summary}
                </p>
              </div>

              {activeContribution.mediaAssets.length > 0 && (
                <div className="space-y-4">
                  {activeContribution.mediaAssets.map((asset) => (
                    <MediaAssetRenderer key={asset.id} asset={asset} />
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-4 border-t border-stone-200 dark:border-[#2E2C28]">
                <div className="lg:col-span-7 space-y-4">
                  <h3 className="text-xs uppercase tracking-widest text-stone-500 dark:text-stone-400 font-semibold">
                    Notice documentaire
                  </h3>
                  <div className="text-sm sm:text-base text-stone-800 dark:text-stone-200 leading-relaxed whitespace-pre-line">
                    {activeContribution.description}
                  </div>
                </div>

                <aside className="lg:col-span-5 space-y-5 bg-[#F9F8F6] dark:bg-[#23211E] border border-stone-200 dark:border-[#2E2C28] rounded-xl p-5 h-fit">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs uppercase tracking-widest text-stone-500 dark:text-stone-400 font-semibold">
                      Références et traçabilité
                    </h3>
                    <button
                      type="button"
                      onClick={() => setModerationDetailTarget(activeContribution)}
                      className="text-[11px] font-semibold text-[#14532D] dark:text-emerald-400 hover:underline"
                    >
                      Détail modération →
                    </button>
                  </div>
                  <dl className="space-y-3 text-xs">
                    <div className="flex justify-between gap-4 pb-2 border-b border-stone-200 dark:border-[#2E2C28]">
                      <dt className="text-stone-500 dark:text-stone-400">Statut éditorial</dt>
                      <dd className="text-right">
                        <ContributionStatusIndicator status={activeContribution.status} />
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4 pb-2 border-b border-stone-200 dark:border-[#2E2C28]">
                      <dt className="text-stone-500 dark:text-stone-400">Mention</dt>
                      <dd className="font-medium text-stone-900 dark:text-stone-100 text-right">
                        {VERIFICATION_LABELS[activeContribution.verificationLabel]}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4 pb-2 border-b border-stone-200 dark:border-[#2E2C28]">
                      <dt className="text-stone-500 dark:text-stone-400">Contributeur</dt>
                      <dd className="font-medium text-stone-900 dark:text-stone-100 text-right">
                        {activeContribution.authorName}
                        {activeContribution.authorVerified && (
                          <span className="inline-flex items-center gap-1 ml-1.5 text-[#14532D] dark:text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Vérifié</span>
                          </span>
                        )}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4 pb-2 border-b border-stone-200 dark:border-[#2E2C28]">
                      <dt className="text-stone-500 dark:text-stone-400">Profil</dt>
                      <dd className="text-stone-800 dark:text-stone-200 text-right">{ROLE_LABELS[activeContribution.authorRole]}</dd>
                    </div>
                    <div className="flex justify-between gap-4 pb-2 border-b border-stone-200 dark:border-[#2E2C28]">
                      <dt className="text-stone-500 dark:text-stone-400">Nature</dt>
                      <dd className="text-stone-800 dark:text-stone-200 text-right">{EPISTEMIC_LABELS[activeContribution.epistemicType]}</dd>
                    </div>
                    <div className="flex justify-between gap-4 pb-2 border-b border-stone-200 dark:border-[#2E2C28]">
                      <dt className="text-stone-500 dark:text-stone-400">Province / Localité</dt>
                      <dd className="text-stone-800 dark:text-stone-200 text-right">
                        {activeContribution.province}
                        {activeContribution.sensitiveLocation ? (
                          <span className="inline-flex items-center gap-1 ml-1 text-[#92400E] dark:text-amber-400">
                            <Lock className="w-3 h-3" /> Lieu sensible masqué
                          </span>
                        ) : (
                          activeContribution.locality && ` · ${activeContribution.locality}`
                        )}
                      </dd>
                    </div>
                    {activeContribution.community && (
                      <div className="flex justify-between gap-4 pb-2 border-b border-stone-200 dark:border-[#2E2C28]">
                        <dt className="text-stone-500 dark:text-stone-400">Communauté</dt>
                        <dd className="text-stone-800 dark:text-stone-200 text-right">{activeContribution.community}</dd>
                      </div>
                    )}
                    <div className="flex justify-between gap-4 pb-2 border-b border-stone-200 dark:border-[#2E2C28]">
                      <dt className="text-stone-500 dark:text-stone-400">Langue</dt>
                      <dd className="text-stone-800 dark:text-stone-200 text-right">{activeContribution.language}</dd>
                    </div>
                    <div className="flex justify-between gap-4 pb-2 border-b border-stone-200 dark:border-[#2E2C28]">
                      <dt className="text-stone-500 dark:text-stone-400">Période</dt>
                      <dd className="text-stone-800 dark:text-stone-200 text-right">{activeContribution.periodLabel}</dd>
                    </div>
                    {activeContribution.sourcesDescription && (
                      <div className="pt-1">
                        <dt className="text-stone-500 dark:text-stone-400 mb-1">Sources & crédits</dt>
                        <dd className="text-stone-700 dark:text-stone-300 leading-relaxed">{activeContribution.sourcesDescription}</dd>
                      </div>
                    )}
                    {sanitizeExternalUrl(activeContribution.sourceUrl) && (
                      <div className="pt-1">
                        <dt className="text-stone-500 dark:text-stone-400 mb-1">Référence externe</dt>
                        <dd>
                          <a
                            href={sanitizeExternalUrl(activeContribution.sourceUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[#14532D] dark:text-emerald-400 font-medium hover:underline break-all"
                          >
                            <span>Consulter la source</span>
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                        </dd>
                      </div>
                    )}
                  </dl>

                  {!activeContribution.isDemoArchive && (
                    <div className="pt-3 border-t border-stone-200 dark:border-[#2E2C28]">
                      {!reportOpen ? (
                        <button
                          type="button"
                          onClick={() => setReportOpen(true)}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-600 dark:text-stone-400 hover:text-red-700 dark:hover:text-red-400"
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Signaler une erreur ou une atteinte aux droits</span>
                        </button>
                      ) : !profile ? (
                        <p className="text-xs text-stone-600 dark:text-stone-400">
                          Connectez-vous pour transmettre un signalement documenté à la modération.
                        </p>
                      ) : reportSent ? (
                        <p className="text-xs font-medium text-[#14532D] dark:text-emerald-400">
                          Signalement transmis à l’équipe de modération. Merci de votre vigilance.
                        </p>
                      ) : (
                        <form onSubmit={handleSendReport} className="space-y-3 pt-2">
                          {reportError && (
                            <p className="p-2 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-800 dark:text-red-300">
                              {reportError}
                            </p>
                          )}
                          <select
                            value={reportCategory}
                            onChange={(e) => setReportCategory(e.target.value as ContentReport['reasonCategory'])}
                            className="w-full px-2.5 py-2 text-xs border border-stone-300 dark:border-[#34312C] rounded-lg bg-white dark:bg-[#141311] text-stone-900 dark:text-stone-100"
                          >
                            <option value="erreur_factuelle">Erreur factuelle ou imprécision</option>
                            <option value="droit_auteur_ou_image">Droit d’auteur ou droit à l’image</option>
                            <option value="savoir_sacre_restreint">Savoir sacré ou restreint</option>
                            <option value="contenu_illicite">Contenu inapproprié ou illicite</option>
                          </select>
                          <textarea
                            required
                            minLength={10}
                            rows={3}
                            value={reportDetails}
                            onChange={(e) => setReportDetails(e.target.value)}
                            placeholder="Précisez la nature de votre signalement…"
                            className="w-full px-2.5 py-2 text-xs border border-stone-300 dark:border-[#34312C] rounded-lg bg-white dark:bg-[#141311] text-stone-900 dark:text-stone-100"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="submit"
                              disabled={reportSending}
                              className="px-3 py-1.5 bg-stone-900 dark:bg-emerald-700 text-white text-xs font-medium rounded-lg"
                            >
                              {reportSending ? 'Envoi…' : 'Envoyer le signalement'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setReportOpen(false);
                                setReportError(null);
                              }}
                              className="px-3 py-1.5 text-xs text-stone-500 dark:text-stone-400"
                            >
                              Annuler
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  )}
                </aside>
              </div>
            </div>
          </div>
        </div>
      )}

      {moderationDetailTarget && (
        <ModerationDetailModal
          contribution={moderationDetailTarget}
          viewerUid={profile?.uid}
          isStaff={Boolean(profile && (profile.role === 'admin' || profile.role === 'moderator'))}
          onClose={() => setModerationDetailTarget(null)}
          onEditContribution={
            onEditContribution && profile && moderationDetailTarget.authorId === profile.uid
              ? onEditContribution
              : undefined
          }
        />
      )}
    </div>
  );
}
