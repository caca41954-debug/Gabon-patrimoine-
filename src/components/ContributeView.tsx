import React, { useEffect, useState } from 'react';
import { CheckCircle2, FileUp, Lock, ShieldAlert, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  EPISTEMIC_LABELS,
  GABON_LANGUAGES,
  GABON_PROVINCES,
  OFFICIAL_CATEGORIES,
  ROLE_LABELS,
  sanitizeExternalUrl,
} from '../data/gabonData';
import { fetchCategories, saveContribution } from '../services/firestoreService';
import type {
  Contribution,
  EpistemicType,
  HeritageCategory,
  MediaAsset,
  PermissionType,
  VisibilityLevel,
} from '../types';
import { ContributionStatusIndicator, getStatusIconAndColor } from './ContributionStatusIndicator';

interface ContributeViewProps {
  editingContribution: Contribution | null;
  onClearEditing: () => void;
  onOpenAuthModal: () => void;
  onSubmitted: () => void;
}

const inputCls =
  'w-full px-3.5 py-2.5 text-sm border border-stone-300 dark:border-[#34312C] bg-white dark:bg-[#141311] text-stone-900 dark:text-stone-100 rounded-xl focus:outline-none focus:border-[#14532D] dark:focus:border-emerald-500';
const labelCls = 'block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1';

export function ContributeView({
  editingContribution,
  onClearEditing,
  onOpenAuthModal,
  onSubmitted,
}: ContributeViewProps) {
  const { profile, firebaseUser, getFreshIdToken } = useAuth();
  const [categories, setCategories] = useState<HeritageCategory[]>(OFFICIAL_CATEGORIES);

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState(OFFICIAL_CATEGORIES[0].id);
  const [province, setProvince] = useState(profile?.province || 'Estuaire');
  const [locality, setLocality] = useState('');
  const [sensitiveLocation, setSensitiveLocation] = useState(false);
  const [community, setCommunity] = useState('');
  const [language, setLanguage] = useState('Français');
  const [periodLabel, setPeriodLabel] = useState('XXIe siècle — pratique vivante');
  const [epistemicType, setEpistemicType] = useState<EpistemicType>('temoignage');
  const [visibility, setVisibility] = useState<VisibilityLevel>('public');
  const [isSacredOrRestricted, setIsSacredOrRestricted] = useState(false);
  const [sourcesDescription, setSourcesDescription] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [permissionType, setPermissionType] = useState<PermissionType>('auteur_original');
  const [credit, setCredit] = useState('');
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    void fetchCategories().then(setCategories);
  }, []);

  useEffect(() => {
    if (editingContribution) {
      setTitle(editingContribution.title);
      setSummary(editingContribution.summary);
      setDescription(editingContribution.description);
      setCategoryId(editingContribution.categoryId);
      setProvince(editingContribution.province);
      setLocality(editingContribution.locality || '');
      setSensitiveLocation(editingContribution.sensitiveLocation);
      setCommunity(editingContribution.community || '');
      setLanguage(editingContribution.language);
      setPeriodLabel(editingContribution.periodLabel);
      setEpistemicType(editingContribution.epistemicType);
      setVisibility(editingContribution.visibility);
      setIsSacredOrRestricted(editingContribution.isSacredOrRestricted);
      setSourcesDescription(editingContribution.sourcesDescription || '');
      setSourceUrl(editingContribution.sourceUrl || '');
      setPermissionType(editingContribution.permissionType);
      setCredit(editingContribution.credit || '');
      setConsentConfirmed(editingContribution.consentConfirmed);
      setMediaAssets(editingContribution.mediaAssets || []);
    }
  }, [editingContribution]);

  if (!firebaseUser || !profile) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-16">
        <div className="bg-white dark:bg-[#1C1B19] border border-stone-200 dark:border-[#2E2C28] rounded-2xl p-8 sm:p-10 text-center space-y-4">
          <p className="text-xs uppercase tracking-widest text-stone-500 dark:text-stone-400">Espace de contribution</p>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-stone-900 dark:text-stone-100">
            Connectez-vous pour documenter le patrimoine
          </h1>
          <p className="text-sm text-stone-600 dark:text-stone-300 max-w-lg mx-auto leading-relaxed">
            Afin de garantir l’attribution des auteurs, le respect des autorisations et la traçabilité éditoriale, vous devez disposer d’un compte personnel (Citoyen, Étudiant ou Enseignant-chercheur).
          </p>
          <button
            type="button"
            onClick={onOpenAuthModal}
            className="mt-2 px-6 py-3 bg-[#14532D] dark:bg-emerald-700 text-white text-sm font-semibold rounded-xl hover:bg-[#114224] dark:hover:bg-emerald-600 transition-colors"
          >
            Se connecter ou demander une assistance
          </button>
        </div>
      </div>
    );
  }

  if (profile.accountStatus === 'suspended') {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-16">
        <div className="bg-white dark:bg-[#1C1B19] border border-red-200 dark:border-red-800 rounded-2xl p-8 text-center space-y-3">
          <h2 className="font-display text-2xl font-semibold text-stone-900 dark:text-stone-100">Compte suspendu</h2>
          <p className="text-sm text-stone-600 dark:text-stone-300">
            Votre compte est actuellement suspendu par l’administration. Vous ne pouvez pas soumettre de nouvelles contributions.
          </p>
        </div>
      </div>
    );
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (mediaAssets.length >= 6) {
      setUploadError('Maximum 6 médias par contribution.');
      return;
    }

    setUploadError(null);
    setUploading(true);
    try {
      const freshToken = await getFreshIdToken();
      if (!freshToken) {
        setUploadError('Session expirée : veuillez vous reconnecter avant de téléverser un fichier.');
        return;
      }
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/media/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${freshToken}` },
        body: formData,
      });
      const data = (await res.json()) as {
        error?: string;
        id?: string;
        url?: string;
        mediaType?: MediaAsset['mediaType'];
        mimeType?: string;
        fileSize?: number;
      };
      if (!res.ok || !data.id || !data.url || !data.mediaType || !data.mimeType) {
        setUploadError(data.error || 'Échec du téléversement sécurisé.');
      } else {
        setMediaAssets((prev) => [
          ...prev,
          {
            id: data.id!,
            url: data.url!,
            mediaType: data.mediaType!,
            mimeType: data.mimeType!,
            fileSize: data.fileSize || file.size,
            altText: file.name.replace(/\.[^.]+$/, '').slice(0, 120),
            credit: credit || profile.displayName,
          },
        ]);
      }
    } catch {
      setUploadError('Erreur réseau pendant le téléversement.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSave = async (targetStatus: 'draft' | 'submitted') => {
    setSaveError(null);
    setSuccessMsg(null);

    if (title.trim().length < 3 || summary.trim().length < 10 || description.trim().length < 20) {
      setSaveError('Veuillez renseigner un titre (min 3 car.), un résumé (min 10 car.) et une notice détaillée (min 20 car.).');
      return;
    }
    if (sourceUrl.trim() && !sanitizeExternalUrl(sourceUrl)) {
      setSaveError('Le lien de référence doit être une adresse web valide commençant par https:// ou http://.');
      return;
    }
    if (targetStatus === 'submitted' && !consentConfirmed) {
      setSaveError('Vous devez confirmer les autorisations de publication et le respect des droits avant de soumettre à la modération.');
      return;
    }

    const cat = categories.find((c) => c.id === categoryId) || OFFICIAL_CATEGORIES[0];
    setSaving(true);
    try {
      await saveContribution(
        profile,
        {
          title,
          summary,
          description,
          categoryId: cat.id,
          categoryName: cat.name,
          province,
          locality,
          sensitiveLocation,
          community,
          language,
          periodLabel,
          epistemicType,
          visibility,
          isSacredOrRestricted,
          status: targetStatus,
          sourcesDescription,
          sourceUrl,
          permissionType,
          consentConfirmed,
          credit: credit || profile.displayName,
          mediaAssets,
        },
        editingContribution?.id,
        editingContribution?.verificationLabel
      );

      setSuccessMsg(
        targetStatus === 'submitted'
          ? 'Contribution soumise avec succès. Elle reste privée jusqu’à validation par la modération.'
          : 'Brouillon enregistré dans votre espace personnel.'
      );
      onClearEditing();
      if (targetStatus === 'submitted') {
        setTimeout(() => onSubmitted(), 1100);
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Impossible d’enregistrer la contribution.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-10 space-y-8">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-stone-500 dark:text-stone-400">
          Dépôt patrimonial · {ROLE_LABELS[profile.role]}
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold text-stone-900 dark:text-stone-100">
          {editingContribution ? 'Modifier une contribution' : 'Déposer une contribution culturelle'}
        </h1>
        <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
          {profile.role === 'student'
            ? 'Espace étudiant : précisez le cadre de votre enquête de terrain, vos informateurs et vos sources universitaires.'
            : profile.role === 'researcher'
              ? 'Espace enseignant-chercheur : publiez vos notices documentées, analyses critiques et sources bibliographiques.'
              : 'Partagez un récit, une photographie, un témoignage audio, un savoir-faire ou une tradition de votre localité.'}
        </p>
      </div>

      {editingContribution && (
        <div
          className={`p-4 rounded-xl border text-xs space-y-2 ${
            getStatusIconAndColor(editingContribution.status).borderClass
          } ${getStatusIconAndColor(editingContribution.status).surfaceClass}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <ContributionStatusIndicator
              status={editingContribution.status}
              verificationLabel={editingContribution.verificationLabel}
              showVerification
            />
          </div>
          {editingContribution.moderationNote && (
            <p className="text-stone-800 dark:text-stone-200">
              <span className="font-semibold">Retour de la modération :</span>{' '}
              {editingContribution.moderationNote}
            </p>
          )}
        </div>
      )}

      {saveError && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-800 dark:text-red-300">
          {saveError}
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="bg-white dark:bg-[#1C1B19] border border-stone-200 dark:border-[#2E2C28] rounded-2xl p-6 sm:p-8 space-y-8">
        <section className="space-y-4">
          <h2 className="font-display text-2xl font-semibold text-stone-900 dark:text-stone-100">1. Contenu documentaire</h2>

          <div>
            <label className={labelCls}>Titre de la contribution *</label>
            <input
              type="text"
              required
              maxLength={180}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex. Chants de navigation des piroguiers du fleuve Ogooué"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Résumé court (max 400 caractères) *</label>
            <textarea
              rows={2}
              maxLength={400}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Synthèse claire présentée dans le catalogue…"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Texte complet, contexte et description *</label>
            <textarea
              rows={7}
              maxLength={12000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Décrivez précisément l’histoire, les usages, le contexte linguistique, les étapes du savoir-faire ou les résultats d’enquête…"
              className={inputCls}
            />
          </div>
        </section>

        <section className="space-y-4 pt-6 border-t border-stone-200 dark:border-[#2E2C28]">
          <h2 className="font-display text-2xl font-semibold text-stone-900 dark:text-stone-100">
            2. Classification territoriale et linguistique
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Catégorie patrimoniale *</label>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputCls}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>Nature épistémique *</label>
              <select
                value={epistemicType}
                onChange={(e) => setEpistemicType(e.target.value as EpistemicType)}
                className={inputCls}
              >
                {Object.entries(EPISTEMIC_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>Province *</label>
              <select value={province} onChange={(e) => setProvince(e.target.value)} className={inputCls}>
                {GABON_PROVINCES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>Localité ou zone géographique</label>
              <input
                type="text"
                value={locality}
                onChange={(e) => setLocality(e.target.value)}
                placeholder="Ex. Makokou, Lambaréné, Mouila"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Langue concernée *</label>
              <select value={language} onChange={(e) => setLanguage(e.target.value)} className={inputCls}>
                {GABON_LANGUAGES.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>Période historique ou datation *</label>
              <input
                type="text"
                value={periodLabel}
                onChange={(e) => setPeriodLabel(e.target.value)}
                placeholder="Ex. Fin XIXe siècle, Années 1970, Pratique vivante"
                className={inputCls}
              />
            </div>

            <div className="sm:col-span-2">
              <label className={labelCls}>Communauté ou groupe culturel concerné (si diffusable)</label>
              <input
                type="text"
                value={community}
                onChange={(e) => setCommunity(e.target.value)}
                placeholder="Ne pas généraliser à tout le Gabon si la pratique concerne une communauté spécifique."
                className={inputCls}
              />
            </div>
          </div>

          <label className="flex items-start gap-2.5 text-xs text-stone-700 dark:text-stone-300 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={sensitiveLocation}
              onChange={(e) => setSensitiveLocation(e.target.checked)}
              className="mt-0.5 rounded border-stone-300 text-[#14532D]"
            />
            <span className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-[#92400E] dark:text-amber-400 shrink-0" />
              <span>Lieu sensible ou site sacré : masquer la localité exacte dans le catalogue public.</span>
            </span>
          </label>
        </section>

        <section className="space-y-4 pt-6 border-t border-stone-200 dark:border-[#2E2C28]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-2xl font-semibold text-stone-900 dark:text-stone-100">
                3. Médias et pièces jointes
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Formats acceptés : JPG, PNG, WebP (EXIF/GPS supprimés automatiquement), MP3, WAV, MP4, WebM, PDF. Privés jusqu’à validation.
              </p>
            </div>
            <label className="inline-flex items-center gap-2 px-4 py-2 bg-stone-900 dark:bg-emerald-700 text-white text-xs font-semibold rounded-xl hover:bg-stone-800 dark:hover:bg-emerald-600 cursor-pointer whitespace-nowrap shrink-0">
              <FileUp className="w-4 h-4" />
              <span>{uploading ? 'Téléversement…' : 'Ajouter un fichier'}</span>
              <input
                type="file"
                disabled={uploading}
                accept=".jpg,.jpeg,.png,.webp,.mp3,.wav,.ogg,.m4a,.mp4,.webm,.pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          {uploadError && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-800 dark:text-red-300">
              {uploadError}
            </div>
          )}

          {mediaAssets.length > 0 && (
            <div className="space-y-3">
              {mediaAssets.map((asset, idx) => (
                <div
                  key={asset.id}
                  className="p-3.5 rounded-xl border border-stone-200 dark:border-[#2E2C28] bg-[#F9F8F6] dark:bg-[#23211E] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 flex-1 min-w-0">
                    <p className="text-xs font-semibold text-stone-800 dark:text-stone-200">
                      {asset.mediaType.toUpperCase()} · {Math.max(1, Math.round(asset.fileSize / 1024))} Ko
                    </p>
                    <input
                      type="text"
                      value={asset.altText}
                      onChange={(e) => {
                        const val = e.target.value;
                        setMediaAssets((prev) =>
                          prev.map((m, i) => (i === idx ? { ...m, altText: val } : m))
                        );
                      }}
                      placeholder="Description alternative accessible (obligatoire)"
                      className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-[#141311] border border-stone-200 dark:border-[#34312C] text-stone-900 dark:text-stone-100 rounded-lg"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setMediaAssets((prev) => prev.filter((_, i) => i !== idx))}
                    className="inline-flex items-center gap-1 text-xs text-red-700 dark:text-red-400 hover:underline shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Retirer</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4 pt-6 border-t border-stone-200 dark:border-[#2E2C28]">
          <h2 className="font-display text-2xl font-semibold text-stone-900 dark:text-stone-100">
            4. Sources, droits et éthique culturelle
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Statut des autorisations *</label>
              <select
                value={permissionType}
                onChange={(e) => setPermissionType(e.target.value as PermissionType)}
                className={inputCls}
              >
                <option value="auteur_original">Œuvre ou témoignage original de l’auteur</option>
                <option value="autorisation_personnes">Autorisation obtenue des personnes représentées</option>
                <option value="accord_communautaire">Accord communautaire / détenteurs de savoirs</option>
                <option value="domaine_public">Archive dans le domaine public / licence ouverte</option>
              </select>
            </div>

            <div>
              <label className={labelCls}>Visibilité demandée</label>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as VisibilityLevel)}
                className={inputCls}
              >
                <option value="public">Public (après validation éditoriale)</option>
                <option value="restricted_community">Membres inscrits vérifiés uniquement</option>
                <option value="research_only">Chercheurs et modération uniquement</option>
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Sources, informateurs et références</label>
            <textarea
              rows={2}
              value={sourcesDescription}
              onChange={(e) => setSourcesDescription(e.target.value)}
              placeholder="Citez les ouvrages, archives, entretiens ou personnes ressources ayant contribué…"
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Crédit d’attribution souhaité</label>
              <input
                type="text"
                value={credit}
                onChange={(e) => setCredit(e.target.value)}
                placeholder={profile.displayName}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Lien de référence (facultatif)</label>
              <input
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://..."
                className={inputCls}
              />
            </div>
          </div>

          <label className="flex items-start gap-2.5 text-xs text-stone-700 dark:text-stone-300 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={isSacredOrRestricted}
              onChange={(e) => setIsSacredOrRestricted(e.target.checked)}
              className="mt-0.5 rounded border-stone-300 text-[#92400E]"
            />
            <span className="flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-[#92400E] dark:text-amber-400 shrink-0" />
              <span>Ce dossier aborde un contenu sacré, funéraire ou sensible nécessitant une expertise renforcée.</span>
            </span>
          </label>

          <label className="flex items-start gap-2.5 text-xs text-stone-700 dark:text-stone-300 cursor-pointer">
            <input
              type="checkbox"
              checked={consentConfirmed}
              onChange={(e) => setConsentConfirmed(e.target.checked)}
              className="mt-0.5 rounded border-stone-300 text-[#14532D]"
            />
            <span>
              Je certifie détenir les autorisations nécessaires des personnes reconnaissables et respecter le caractère sacré ou restreint des savoirs partagés.
            </span>
          </label>
        </section>

        <div className="pt-6 border-t border-stone-200 dark:border-[#2E2C28] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave('draft')}
              className="px-5 py-2.5 border border-stone-300 dark:border-[#34312C] text-stone-800 dark:text-stone-200 text-sm font-medium rounded-xl hover:bg-stone-50 dark:hover:bg-[#23211E] disabled:opacity-50"
            >
              Enregistrer en brouillon
            </button>
            {editingContribution && (
              <button
                type="button"
                onClick={onClearEditing}
                className="text-xs text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white"
              >
                Annuler la modification
              </button>
            )}
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave('submitted')}
            className="px-6 py-2.5 bg-[#14532D] dark:bg-emerald-700 text-white text-sm font-semibold rounded-xl hover:bg-[#114224] dark:hover:bg-emerald-600 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Transmission…' : 'Soumettre à la modération'}
          </button>
        </div>
      </div>
    </div>
  );
}
