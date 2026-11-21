import React, { useState } from 'react';
import { Check, Copy, ExternalLink, Share2, X } from 'lucide-react';

interface ShareModalProps {
  title: string;
  description?: string;
  url: string;
  triggerLabel?: string;
  compact?: boolean;
  className?: string;
}

export function ShareButton({
  title,
  description = 'Découvrez cette archive sur Gabon Patrimoine.',
  url,
  triggerLabel = 'Partager',
  compact = false,
  className = '',
}: ShareModalProps) {
  const [open, setOpen] = useState(false);
  const [copiedMode, setCopiedMode] = useState<'link' | 'instagram' | null>(null);

  const safeUrl = url.startsWith('http')
    ? url
    : typeof window !== 'undefined'
    ? new URL(url, window.location.origin).toString()
    : url;

  const shareText = `${title} — ${description}`;

  const handleTrigger = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function' && window.innerWidth < 768) {
      try {
        await navigator.share({ title, text: description, url: safeUrl });
        return;
      } catch {
        // Fallback to share modal if user cancels or platform refuses
      }
    }
    setOpen(true);
  };

  const copyText = async (value: string, mode: 'link' | 'instagram') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedMode(mode);
      window.setTimeout(() => setCopiedMode(null), 2200);
    } catch {
      // Ignore clipboard failure in restricted iframes
    }
  };

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${safeUrl}`)}`;
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(safeUrl)}`;
  const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(safeUrl)}`;
  const instagramCaption = `${title}\n\n${description}\n\nArchive consultable sur : ${safeUrl}\n#GabonPatrimoine #CultureGabon #MémoireCollective`;

  return (
    <>
      <button
        type="button"
        onClick={handleTrigger}
        title={triggerLabel}
        className={`inline-flex items-center justify-center gap-1.5 rounded-xl border border-stone-200 dark:border-[#2E2C28] bg-white dark:bg-[#23211E] text-stone-700 dark:text-stone-200 hover:border-stone-300 dark:hover:border-stone-500 hover:text-stone-900 dark:hover:text-white transition-colors ${
          compact ? 'px-2.5 py-1.5 text-xs min-h-[34px]' : 'px-3.5 py-2 text-xs font-semibold min-h-[40px]'
        } ${className}`}
      >
        <Share2 className="w-3.5 h-3.5 shrink-0" />
        <span>{triggerLabel}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Partager cette ressource"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white dark:bg-[#1C1B19] border border-stone-200 dark:border-[#2E2C28] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[#14532D] dark:text-emerald-400">
                  Diffusion culturelle
                </p>
                <h3 className="font-display text-xl font-semibold text-stone-900 dark:text-stone-100 mt-0.5 line-clamp-2">
                  {title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-stone-500 hover:bg-stone-100 dark:hover:bg-[#292724]"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[44px] flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-[#2E2C28] bg-[#F9F8F6] dark:bg-[#23211E] text-xs font-semibold text-stone-800 dark:text-stone-100 hover:border-emerald-500/50 transition-colors"
              >
                <span>WhatsApp</span>
                <ExternalLink className="w-3.5 h-3.5 text-stone-400" />
              </a>
              <a
                href={facebookUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[44px] flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-[#2E2C28] bg-[#F9F8F6] dark:bg-[#23211E] text-xs font-semibold text-stone-800 dark:text-stone-100 hover:border-blue-500/50 transition-colors"
              >
                <span>Facebook</span>
                <ExternalLink className="w-3.5 h-3.5 text-stone-400" />
              </a>
              <a
                href={xUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[44px] flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-[#2E2C28] bg-[#F9F8F6] dark:bg-[#23211E] text-xs font-semibold text-stone-800 dark:text-stone-100 hover:border-stone-500 transition-colors"
              >
                <span>X (Twitter)</span>
                <ExternalLink className="w-3.5 h-3.5 text-stone-400" />
              </a>
              <button
                type="button"
                onClick={() => void copyText(instagramCaption, 'instagram')}
                className="min-h-[44px] flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-[#2E2C28] bg-[#F9F8F6] dark:bg-[#23211E] text-xs font-semibold text-stone-800 dark:text-stone-100 hover:border-amber-500/50 transition-colors text-left"
              >
                <span>{copiedMode === 'instagram' ? 'Légende copiée' : 'Instagram (légende)'}</span>
                {copiedMode === 'instagram' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-stone-400" />
                )}
              </button>
            </div>

            <div className="pt-2 border-t border-stone-200 dark:border-[#2E2C28] space-y-2">
              <label className="block text-[11px] font-medium text-stone-500 dark:text-stone-400">
                Lien direct de l’archive
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={safeUrl}
                  className="flex-1 px-3 py-2 rounded-xl border border-stone-200 dark:border-[#2E2C28] bg-stone-50 dark:bg-[#141311] font-mono text-xs text-stone-700 dark:text-stone-300 select-all"
                />
                <button
                  type="button"
                  onClick={() => void copyText(safeUrl, 'link')}
                  className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#14532D] hover:bg-[#114224] dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white text-xs font-semibold transition-colors whitespace-nowrap"
                >
                  {copiedMode === 'link' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedMode === 'link' ? 'Copié' : 'Copier'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
