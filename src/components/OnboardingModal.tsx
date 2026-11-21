import React, { useEffect, useState } from 'react';
import { HelpCircle, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { BOOTSTRAP_ADMIN_EMAIL, GABON_PROVINCES } from '../data/gabonData';

export function AuthAndAssistanceModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { signInWithGoogle, authError, clearAuthError, firebaseUser } = useAuth();
  const [mode, setMode] = useState<'login' | 'assistance'>('login');
  const [requesterName, setRequesterName] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [requestedRole, setRequestedRole] = useState<'citizen' | 'student' | 'researcher'>('citizen');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [assistSuccess, setAssistSuccess] = useState(false);
  const [assistError, setAssistError] = useState<string | null>(null);

  useEffect(() => {
    if (firebaseUser && open) {
      onClose();
    }
  }, [firebaseUser, open, onClose]);

  if (!open) return null;

  const handlePublicAssistance = async (e: React.FormEvent) => {
    e.preventDefault();
    setAssistError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/public/assistance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requesterName, contactInfo, requestedRole, message }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setAssistError(data.error || "Impossible d'envoyer la demande.");
      } else {
        setAssistSuccess(true);
        setRequesterName('');
        setContactInfo('');
        setMessage('');
      }
    } catch {
      setAssistError('Erreur réseau lors de l’envoi de la demande.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1C1B19] border border-stone-200 dark:border-[#2E2C28] rounded-2xl max-w-md w-full p-6 sm:p-8 shadow-xl relative">
        <button
          type="button"
          onClick={() => {
            clearAuthError();
            onClose();
          }}
          aria-label="Fermer"
          className="absolute top-5 right-5 p-2 text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 p-1 bg-stone-100 dark:bg-[#23211E] rounded-lg mb-6 w-fit">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              mode === 'login'
                ? 'bg-white dark:bg-[#161513] text-stone-900 dark:text-white shadow-sm'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
            }`}
          >
            Connexion
          </button>
          <button
            type="button"
            onClick={() => setMode('assistance')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              mode === 'assistance'
                ? 'bg-white dark:bg-[#161513] text-stone-900 dark:text-white shadow-sm'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
            }`}
          >
            Aide à la création de compte
          </button>
        </div>

        {mode === 'login' ? (
          <div>
            <h2 className="font-display text-3xl font-semibold text-stone-900 dark:text-stone-100 mb-2">
              Accéder à votre espace
            </h2>
            <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed mb-6">
              Connectez-vous avec votre compte Google vérifié pour publier des contributions, gérer votre portefeuille Mobile Money ou suivre votre profil.
            </p>

            {authError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-800 dark:text-red-300">
                {authError}
              </div>
            )}

            <button
              type="button"
              onClick={() => void signInWithGoogle()}
              className="w-full py-3 px-4 bg-[#14532D] dark:bg-emerald-700 text-white text-sm font-semibold rounded-xl hover:bg-[#114224] dark:hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Continuer avec Google</span>
            </button>

            <div className="mt-6 pt-5 border-t border-stone-200 dark:border-[#2E2C28]">
              <button
                type="button"
                onClick={() => setMode('assistance')}
                className="inline-flex items-center gap-2 text-xs font-medium text-[#92400E] dark:text-amber-400 hover:underline"
              >
                <HelpCircle className="w-4 h-4" />
                <span>Difficulté à créer votre compte ? Demander l’aide de l’administrateur</span>
              </button>
            </div>
          </div>
        ) : (
          <div>
            <h2 className="font-display text-2xl font-semibold text-stone-900 dark:text-stone-100 mb-2">
              Assistance à l’inscription
            </h2>
            <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed mb-4">
              Si vous ne parvenez pas à finaliser votre compte, l’administrateur principal peut pré-configurer votre profil et vous accompagner.
            </p>

            {assistSuccess ? (
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-sm text-emerald-900 dark:text-emerald-200 space-y-2">
                <p className="font-semibold">Demande transmise à l’administration.</p>
                <p className="text-xs leading-relaxed">
                  Votre message a été enregistré dans la boîte d’assistance administrative. Vous serez contacté via le moyen indiqué.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setAssistSuccess(false);
                    setMode('login');
                  }}
                  className="mt-2 px-4 py-2 bg-[#14532D] dark:bg-emerald-700 text-white text-xs font-semibold rounded-lg"
                >
                  Retour à la connexion
                </button>
              </div>
            ) : (
              <form onSubmit={handlePublicAssistance} className="space-y-3">
                {assistError && (
                  <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-800 dark:text-red-300">
                    {assistError}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">Nom complet</label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    value={requesterName}
                    onChange={(e) => setRequesterName(e.target.value)}
                    placeholder="Ex. Jean-Marc Ndong"
                    className="w-full px-3 py-2 text-sm border border-stone-300 dark:border-[#34312C] bg-white dark:bg-[#141311] text-stone-900 dark:text-stone-100 rounded-lg focus:outline-none focus:border-[#14532D] dark:focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">E-mail ou téléphone de contact</label>
                  <input
                    type="text"
                    required
                    minLength={4}
                    value={contactInfo}
                    onChange={(e) => setContactInfo(e.target.value)}
                    placeholder="nom@exemple.ga ou +241 07..."
                    className="w-full px-3 py-2 text-sm border border-stone-300 dark:border-[#34312C] bg-white dark:bg-[#141311] text-stone-900 dark:text-stone-100 rounded-lg focus:outline-none focus:border-[#14532D] dark:focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">Catégorie de profil souhaitée</label>
                  <select
                    value={requestedRole}
                    onChange={(e) => setRequestedRole(e.target.value as 'citizen' | 'student' | 'researcher')}
                    className="w-full px-3 py-2 text-sm border border-stone-300 dark:border-[#34312C] rounded-lg bg-white dark:bg-[#141311] text-stone-900 dark:text-stone-100 focus:outline-none focus:border-[#14532D] dark:focus:border-emerald-500"
                  >
                    <option value="citizen">Citoyen contributeur</option>
                    <option value="student">Étudiant</option>
                    <option value="researcher">Enseignant-chercheur</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">Description de votre difficulté</label>
                  <textarea
                    required
                    minLength={10}
                    rows={3}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Expliquez brièvement le blocage rencontré lors de votre inscription..."
                    className="w-full px-3 py-2 text-sm border border-stone-300 dark:border-[#34312C] bg-white dark:bg-[#141311] text-stone-900 dark:text-stone-100 rounded-lg focus:outline-none focus:border-[#14532D] dark:focus:border-emerald-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 bg-[#14532D] dark:bg-emerald-700 text-white text-sm font-semibold rounded-lg hover:bg-[#114224] dark:hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                >
                  {submitting ? 'Envoi en cours…' : 'Envoyer la demande d’assistance'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function OnboardingModal() {
  const { firebaseUser, needsOnboarding, assistedMatch, completeOnboarding, logout } = useAuth();
  const isBootstrap = firebaseUser?.email === BOOTSTRAP_ADMIN_EMAIL;

  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<'citizen' | 'student' | 'researcher'>('citizen');
  const [province, setProvince] = useState('Estuaire');
  const [locality, setLocality] = useState('');
  const [institution, setInstitution] = useState('');
  const [discipline, setDiscipline] = useState('');
  const [studyLevel, setStudyLevel] = useState('');
  const [bio, setBio] = useState('');
  const [acceptedCharter, setAcceptedCharter] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (assistedMatch) {
      setDisplayName(assistedMatch.displayName);
      if (assistedMatch.role !== 'moderator') setRole(assistedMatch.role);
      if (assistedMatch.province) setProvince(assistedMatch.province);
      if (assistedMatch.institution) setInstitution(assistedMatch.institution);
      if (assistedMatch.discipline) setDiscipline(assistedMatch.discipline);
    } else if (firebaseUser?.displayName) {
      setDisplayName(firebaseUser.displayName);
    }
  }, [assistedMatch, firebaseUser]);

  if (!needsOnboarding || !firebaseUser) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptedCharter) {
      setError('Veuillez accepter les conditions d’utilisation et la charte éthique patrimoniale.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await completeOnboarding({
        displayName: displayName || firebaseUser.displayName || 'Contributeur',
        role,
        province,
        locality,
        institution,
        discipline,
        studyLevel,
        bio,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création du profil.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#1C1B19] border border-stone-200 dark:border-[#2E2C28] rounded-2xl max-w-xl w-full p-6 sm:p-8 my-8 shadow-xl">
        <p className="text-xs uppercase tracking-widest text-stone-500 dark:text-stone-400 mb-1">
          Finalisation du compte personnel
        </p>
        <h2 className="font-display text-3xl font-semibold text-stone-900 dark:text-stone-100 mb-2">
          Bienvenue sur Gabon Patrimoine
        </h2>

        {isBootstrap && (
          <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200">
            Compte reconnu en tant qu’<strong>Administrateur principal</strong> ({firebaseUser.email}). Vos droits de gouvernance seront activés dès la validation.
          </div>
        )}

        {assistedMatch && !isBootstrap && (
          <div className="mb-4 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200">
            Un profil pré-créé par l’administration a été associé à votre adresse ({assistedMatch.email}). Vérifiez vos informations ci-dessous.
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-800 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">Nom public</label>
              <input
                type="text"
                required
                minLength={2}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-stone-300 dark:border-[#34312C] bg-white dark:bg-[#141311] text-stone-900 dark:text-stone-100 rounded-lg focus:outline-none focus:border-[#14532D] dark:focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">Province d’ancrage</label>
              <select
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-stone-300 dark:border-[#34312C] rounded-lg bg-white dark:bg-[#141311] text-stone-900 dark:text-stone-100 focus:outline-none focus:border-[#14532D] dark:focus:border-emerald-500"
              >
                {GABON_PROVINCES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          {!isBootstrap && (
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-2">Catégorie de profil</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(
                  [
                    { id: 'citizen', title: 'Citoyen', desc: 'Récits, photos et savoirs locaux' },
                    { id: 'student', title: 'Étudiant', desc: 'Enquêtes de terrain et mémoires' },
                    { id: 'researcher', title: 'Enseignant-chercheur', desc: 'Notices scientifiques et analyses' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setRole(item.id)}
                    className={`p-3 rounded-xl border text-left transition-colors ${
                      role === item.id
                        ? 'border-[#14532D] dark:border-emerald-500 bg-[#14532D]/5 dark:bg-emerald-950/40 text-stone-900 dark:text-white'
                        : 'border-stone-200 dark:border-[#2E2C28] hover:border-stone-300 dark:hover:border-stone-600 text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    <p className="text-xs font-semibold">{item.title}</p>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 leading-snug">{item.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {(role === 'student' || role === 'researcher') && !isBootstrap && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">Établissement / Université</label>
                <input
                  type="text"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  placeholder="Ex. Université Omar Bongo"
                  className="w-full px-3 py-2 text-sm border border-stone-300 dark:border-[#34312C] bg-white dark:bg-[#141311] text-stone-900 dark:text-stone-100 rounded-lg focus:outline-none focus:border-[#14532D]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">Discipline</label>
                <input
                  type="text"
                  value={discipline}
                  onChange={(e) => setDiscipline(e.target.value)}
                  placeholder="Ex. Anthropologie, Histoire"
                  className="w-full px-3 py-2 text-sm border border-stone-300 dark:border-[#34312C] bg-white dark:bg-[#141311] text-stone-900 dark:text-stone-100 rounded-lg focus:outline-none focus:border-[#14532D]"
                />
              </div>
              {role === 'student' && (
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">Niveau d’études</label>
                  <input
                    type="text"
                    value={studyLevel}
                    onChange={(e) => setStudyLevel(e.target.value)}
                    placeholder="Ex. Master 2 Recherche, Licence 3, Doctorat"
                    className="w-full px-3 py-2 text-sm border border-stone-300 dark:border-[#34312C] bg-white dark:bg-[#141311] text-stone-900 dark:text-stone-100 rounded-lg focus:outline-none focus:border-[#14532D]"
                  />
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">Localité (facultatif)</label>
            <input
              type="text"
              value={locality}
              onChange={(e) => setLocality(e.target.value)}
              placeholder="Ex. Libreville, Oyem, Mouila"
              className="w-full px-3 py-2 text-sm border border-stone-300 dark:border-[#34312C] bg-white dark:bg-[#141311] text-stone-900 dark:text-stone-100 rounded-lg focus:outline-none focus:border-[#14532D]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">Présentation succincte (facultatif)</label>
            <textarea
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Vos centres d’intérêt patrimoniaux ou travaux en cours..."
              className="w-full px-3 py-2 text-sm border border-stone-300 dark:border-[#34312C] bg-white dark:bg-[#141311] text-stone-900 dark:text-stone-100 rounded-lg focus:outline-none focus:border-[#14532D]"
            />
          </div>

          <label className="flex items-start gap-2.5 text-xs text-stone-600 dark:text-stone-300 leading-relaxed cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={acceptedCharter}
              onChange={(e) => setAcceptedCharter(e.target.checked)}
              className="mt-0.5 rounded border-stone-300 text-[#14532D] focus:ring-[#14532D]"
            />
            <span>
              J’accepte les règles éditoriales et éthiques de Gabon Patrimoine : respect des droits d’auteur, consentement des personnes filmées ou enregistrées, et non-divulgation sans accord des savoirs sacrés ou restreints.
            </span>
          </label>

          <div className="flex items-center justify-between gap-4 pt-3 border-t border-stone-200 dark:border-[#2E2C28]">
            <button
              type="button"
              onClick={() => void logout()}
              className="text-xs font-medium text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white"
            >
              Annuler et se déconnecter
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-[#14532D] dark:bg-emerald-700 text-white text-sm font-semibold rounded-lg hover:bg-[#114224] dark:hover:bg-emerald-600 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Enregistrement…' : 'Activer mon compte'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
