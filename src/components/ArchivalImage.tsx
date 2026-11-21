import React, { useEffect, useState } from 'react';
import { FileText, Film, Landmark, Volume2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { MediaAsset } from '../types';

interface ArchivalImageProps {
  src?: string;
  alt: string;
  className?: string;
  requireAuthFetch?: boolean;
}

export function ArchivalImage({ src, alt, className = '', requireAuthFetch = false }: ArchivalImageProps) {
  const { idToken } = useAuth();
  const [resolvedSrc, setResolvedSrc] = useState<string | undefined>(requireAuthFetch ? undefined : src);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    if (!src) {
      setResolvedSrc(undefined);
      return;
    }

    const isProtectedApiMedia = src.startsWith('/api/media/') && requireAuthFetch;
    if (!isProtectedApiMedia) {
      setResolvedSrc(src);
      return;
    }

    if (!idToken) return;
    let revokedUrl: string | null = null;
    let active = true;

    fetch(src, {
      headers: { Authorization: `Bearer ${idToken}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Accès média refusé');
        return res.blob();
      })
      .then((blob) => {
        if (!active) return;
        revokedUrl = URL.createObjectURL(blob);
        setResolvedSrc(revokedUrl);
      })
      .catch(() => {
        if (active) setFailed(true);
      });

    return () => {
      active = false;
      if (revokedUrl) URL.revokeObjectURL(revokedUrl);
    };
  }, [src, requireAuthFetch, idToken]);

  if (!resolvedSrc || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#EBE6DF] to-[#DED7CC] dark:from-[#262420] dark:to-[#1C1B19] text-stone-600 dark:text-stone-300 p-6 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <Landmark className="w-7 h-7 text-stone-500 dark:text-stone-400 mb-2" strokeWidth={1.5} />
        <span className="text-xs font-medium text-stone-600 dark:text-stone-300 max-w-[20ch] leading-snug">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

export function MediaAssetRenderer({
  asset,
  isPendingPrivate,
}: {
  asset: MediaAsset;
  isPendingPrivate?: boolean;
}) {
  const { idToken } = useAuth();
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const needsBlob = Boolean(isPendingPrivate && asset.url.startsWith('/api/media/') && asset.mediaType !== 'image');

  useEffect(() => {
    if (!needsBlob || !idToken) return;
    let objectUrl: string | null = null;
    let active = true;
    fetch(asset.url, { headers: { Authorization: `Bearer ${idToken}` } })
      .then((r) => {
        if (!r.ok) throw new Error('Protected media error');
        return r.blob();
      })
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [needsBlob, asset.url, idToken]);

  if (asset.mediaType === 'image') {
    return (
      <figure className="space-y-2">
        <div className="overflow-hidden rounded-lg border border-stone-200 dark:border-[#2E2C28] bg-stone-100 dark:bg-[#23211E]">
          <ArchivalImage
            src={asset.url}
            alt={asset.altText}
            requireAuthFetch={isPendingPrivate}
            className="w-full h-72 object-cover"
          />
        </div>
        <figcaption className="text-xs text-stone-500 dark:text-stone-400 italic">
          {asset.altText} {asset.credit ? `— Crédit : ${asset.credit}` : ''}
        </figcaption>
      </figure>
    );
  }

  const effectiveUrl = needsBlob ? blobUrl : asset.url;

  if (asset.mediaType === 'audio') {
    return (
      <div className="p-4 rounded-lg border border-stone-200 dark:border-[#2E2C28] bg-[#F9F8F6] dark:bg-[#23211E] space-y-2">
        <div className="flex items-center gap-2 text-xs font-medium text-stone-700 dark:text-stone-200">
          <Volume2 className="w-4 h-4 text-[#14532D] dark:text-emerald-400" />
          <span>Enregistrement audio · {asset.altText}</span>
        </div>
        {error ? (
          <p className="text-xs text-red-700 dark:text-red-400">Impossible de charger l’audio privé.</p>
        ) : effectiveUrl ? (
          <audio controls className="w-full" src={effectiveUrl} />
        ) : (
          <p className="text-xs text-stone-500 dark:text-stone-400">Chargement de l’audio sécurisé…</p>
        )}
        {asset.credit && <p className="text-xs text-stone-500 dark:text-stone-400">Crédit : {asset.credit}</p>}
      </div>
    );
  }

  if (asset.mediaType === 'video') {
    return (
      <div className="p-4 rounded-lg border border-stone-200 dark:border-[#2E2C28] bg-[#F9F8F6] dark:bg-[#23211E] space-y-2">
        <div className="flex items-center gap-2 text-xs font-medium text-stone-700 dark:text-stone-200">
          <Film className="w-4 h-4 text-[#14532D] dark:text-emerald-400" />
          <span>Document vidéo · {asset.altText}</span>
        </div>
        {error ? (
          <p className="text-xs text-red-700 dark:text-red-400">Impossible de charger la vidéo privée.</p>
        ) : effectiveUrl ? (
          <video controls className="w-full max-h-80 rounded-md bg-black" src={effectiveUrl} />
        ) : (
          <p className="text-xs text-stone-500 dark:text-stone-400">Chargement de la vidéo sécurisée…</p>
        )}
        {asset.credit && <p className="text-xs text-stone-500 dark:text-stone-400">Crédit : {asset.credit}</p>}
      </div>
    );
  }

  return (
    <div className="p-4 rounded-lg border border-stone-200 dark:border-[#2E2C28] bg-[#F9F8F6] dark:bg-[#23211E] flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <FileText className="w-5 h-5 text-[#92400E] dark:text-amber-400 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-stone-900 dark:text-stone-100 truncate">{asset.altText}</p>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Document PDF · {Math.max(1, Math.round(asset.fileSize / 1024))} Ko
          </p>
        </div>
      </div>
      {effectiveUrl && (
        <a
          href={effectiveUrl}
          download={`document_${asset.id}.pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 text-xs font-medium border border-stone-300 dark:border-[#34312C] rounded-lg text-stone-800 dark:text-stone-200 hover:bg-white dark:hover:bg-[#1C1B19] transition-colors whitespace-nowrap shrink-0"
        >
          Ouvrir le document
        </a>
      )}
    </div>
  );
}
