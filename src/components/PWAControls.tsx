import React, { useState } from 'react';
import { Download, MonitorDown, Share, Smartphone, WifiOff, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'primary' | 'subtle' | 'footer';
  className?: string;
}

export function PWAInstallButton({ variant = 'subtle', className = '' }: PWAInstallButtonProps) {
  const { isInstalled, isIOS, triggerInstall } = usePWAInstall();
  const [guideMode, setGuideMode] = useState<'ios' | 'desktop' | null>(null);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    const outcome = await triggerInstall();
    if (outcome === 'ios_guide') {
      setGuideMode('ios');
    } else if (outcome === 'manual_guide') {
      setGuideMode('desktop');
    }
  };

  const buttonClasses =
    variant === 'primary'
      ? 'inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] text-xs font-semibold text-white bg-[#14532D] hover:bg-[#114224] dark:bg-emerald-700 dark:hover:bg-emerald-600 rounded-xl transition-colors whitespace-nowrap'
      : variant === 'footer'
      ? 'inline-flex items-center gap-1.5 text-xs font-medium text-stone-700 dark:text-stone-300 hover:text-[#14532D] dark:hover:text-emerald-400 transition-colors'
      : 'inline-flex items-center justify-center gap-2 px-3.5 py-2 min-h-[40px] text-xs font-semibold text-stone-800 dark:text-stone-100 bg-white dark:bg-[#23211E] border border-stone-300 dark:border-[#34312C] hover:border-stone-400 dark:hover:border-stone-500 rounded-xl transition-colors whitespace-nowrap';

  return (
    <>
      <button type="button" onClick={handleClick} className={`${buttonClasses} ${className}`}>
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span>Télécharger l’application</span>
      </button>

      {guideMode && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Installer Gabon Patrimoine"
        >
          <div className="bg-white dark:bg-[#1C1B19] border border-stone-200 dark:border-[#2E2C28] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-[#14532D] dark:text-emerald-400 flex items-center justify-center shrink-0">
                  {guideMode === 'ios' || isIOS ? <Smartphone className="w-5 h-5" /> : <MonitorDown className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-display text-xl font-semibold text-stone-900 dark:text-stone-100">
                    Installer Gabon Patrimoine
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    Accès direct depuis votre écran d’accueil et consultation hors ligne
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGuideMode(null)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-stone-500 hover:bg-stone-100 dark:hover:bg-[#292724]"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {guideMode === 'ios' ? (
              <ol className="space-y-3 text-sm text-stone-700 dark:text-stone-300 leading-relaxed">
                <li className="flex items-start gap-2.5">
                  <span className="font-mono text-xs font-semibold text-[#14532D] dark:text-emerald-400 pt-0.5">01</span>
                  <span>
                    Touchez l’icône <strong className="inline-flex items-center gap-1"><Share className="w-3.5 h-3.5" /> Partager</strong> dans la barre de Safari (iPhone ou iPad).
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="font-mono text-xs font-semibold text-[#14532D] dark:text-emerald-400 pt-0.5">02</span>
                  <span>Faites défiler et choisissez <strong>« Sur l’écran d’accueil »</strong>.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="font-mono text-xs font-semibold text-[#14532D] dark:text-emerald-400 pt-0.5">03</span>
                  <span>Confirmez avec <strong>Ajouter</strong> : l’application s’ouvrira ensuite en plein écran.</span>
                </li>
              </ol>
            ) : (
              <div className="space-y-3 text-sm text-stone-700 dark:text-stone-300 leading-relaxed">
                <p>
                  Votre navigateur permet d’installer Gabon Patrimoine comme application autonome :
                </p>
                <ul className="space-y-2 text-xs text-stone-600 dark:text-stone-400 list-disc pl-4">
                  <li>
                    <strong>Sur Chrome / Edge (Android ou ordinateur)</strong> : ouvrez le menu du navigateur (⋮) puis sélectionnez <strong>« Installer l’application »</strong> ou l’icône d’installation dans la barre d’adresse.
                  </li>
                  <li>
                    <strong>En navigation privée ou aperçu intégré</strong> : ouvrez l’URL de la plateforme dans un onglet standard pour activer l’installation directe.
                  </li>
                </ul>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setGuideMode(null)}
                className="px-4 py-2.5 bg-[#14532D] hover:bg-[#114224] dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white text-xs font-semibold rounded-xl transition-colors"
              >
                Compris
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function OfflineIndicator() {
  const { isOnline } = usePWAInstall();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="bg-amber-50 dark:bg-amber-950/70 border-b border-amber-200 dark:border-amber-800/70 px-4 py-2 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-center gap-2"
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>
        Vous êtes actuellement hors ligne — les pages déjà consultées restent accessibles ; la synchronisation reprendra dès le retour de la connexion.
      </span>
    </div>
  );
}
