import { Contribution, HeritageCategory, UserRole } from '../types';

export const BOOTSTRAP_ADMIN_EMAIL = 'arnaudndoumelobe821@gmail.com';

export const GABON_PROVINCES: string[] = [
  'Estuaire',
  'Haut-Ogooué',
  'Moyen-Ogooué',
  'Ngounié',
  'Nyanga',
  'Ogooué-Ivindo',
  'Ogooué-Lolo',
  'Ogooué-Maritime',
  'Woleu-Ntem',
];

export const GABON_LANGUAGES: string[] = [
  'Français',
  'Fang',
  'Punu',
  'Myènè',
  'Téké',
  'Nzébi',
  'Kota',
  'Mitsogo',
  'Obamba',
  'Gisir',
  'Vili',
  'Baka',
  'Autre langue locale',
];

export const OFFICIAL_CATEGORIES: HeritageCategory[] = [
  { id: 'patrimoine-oral', name: 'Patrimoine oral', slug: 'patrimoine-oral', description: 'Épopées, proverbes, généalogies et chants de transmission.', isActive: true },
  { id: 'langues', name: 'Langues', slug: 'langues', description: 'Lexiques, toponymie et expressions vernaculaires du Gabon.', isActive: true },
  { id: 'contes-recits', name: 'Contes et récits', slug: 'contes-recits', description: 'Récits fondateurs, veillées et mythologies communautaires.', isActive: true },
  { id: 'rites-pratiques', name: 'Rites et pratiques', slug: 'rites-pratiques', description: 'Cérémonies publiques et pratiques sociales documentées avec consentement.', isActive: true },
  { id: 'musique-danse', name: 'Musique et danse', slug: 'musique-danse', description: 'Instruments traditionnels, polyphonies et chorégraphies régionales.', isActive: true },
  { id: 'arts-artisanat', name: 'Arts et artisanat', slug: 'arts-artisanat', description: 'Sculpture sur bois, vannerie, tissage du raphia et masques.', isActive: true },
  { id: 'alimentation', name: 'Alimentation', slug: 'alimentation', description: 'Recettes ancestrales, techniques de fumage et plantes nourricières.', isActive: true },
  { id: 'vetements-parures', name: 'Vêtements et parures', slug: 'vetements-parures', description: 'Étoffes en raphia, perles, coiffures et insignes cérémoniels.', isActive: true },
  { id: 'architecture', name: 'Architecture', slug: 'architecture', description: 'Corps de garde, cases en écorce et bâti traditionnel.', isActive: true },
  { id: 'sites-paysages', name: 'Sites et paysages culturels', slug: 'sites-paysages', description: 'Lieux de mémoire, fleuves historiques et terroirs culturels.', isActive: true },
  { id: 'objets-archives', name: 'Objets et archives', slug: 'objets-archives', description: 'Photographies anciennes, manuscrits et collections familiales.', isActive: true },
  { id: 'histoire-locale', name: 'Histoire locale', slug: 'histoire-locale', description: 'Chroniques villageoises, migrations et figures historiques.', isActive: true },
  { id: 'savoir-faire', name: 'Savoir-faire', slug: 'savoir-faire', description: 'Métallurgie, construction de pirogues et pharmacopée documentée.', isActive: true },
  { id: 'patrimoine-naturel', name: 'Patrimoine naturel associé', slug: 'patrimoine-naturel', description: 'Savoirs forestiers, pêche fluviale et gestion coutumière des écosystèmes.', isActive: true },
];

export const ROLE_LABELS: Record<UserRole, string> = {
  citizen: 'Citoyen contributeur',
  student: 'Étudiant chercheur',
  researcher: 'Enseignant-chercheur',
  moderator: 'Modérateur habilité',
  admin: 'Administrateur principal',
};

export const EPISTEMIC_LABELS: Record<Contribution['epistemicType'], string> = {
  temoignage: 'Témoignage',
  tradition_orale: 'Tradition orale',
  enquete_terrain: 'Enquête de terrain',
  analyse_academique: 'Analyse académique',
  archive_documentee: 'Archive documentée',
};

export const VERIFICATION_LABELS: Record<Contribution['verificationLabel'], string> = {
  propose: 'Proposé',
  relu: 'Relu par la rédaction',
  documente: 'Documenté et sourcé',
};

export const STATUS_LABELS: Record<Contribution['status'], string> = {
  draft: 'Brouillon',
  submitted: 'En attente de validation',
  in_review: 'En cours d’examen',
  needs_revision: 'Requiert des ajustements',
  validated: 'Validé pour publication',
  published: 'Publié',
  rejected: 'Non retenu',
  archived: 'Archivé',
  withdrawn: 'Retiré',
};

export interface ContributionStatusMeta {
  label: string;
  description: string;
  nextStep: string;
  tone: 'neutral' | 'amber' | 'orange' | 'forest' | 'crimson' | 'slate';
  stepIndex: 0 | 1 | 2 | 3;
}

export const STATUS_META: Record<Contribution['status'], ContributionStatusMeta> = {
  draft: {
    label: 'Brouillon',
    description: 'Enregistrement privé visible uniquement par vous avant soumission.',
    nextStep: 'Complétez les champs obligatoires et confirmez les droits pour soumettre à la modération.',
    tone: 'neutral',
    stepIndex: 0,
  },
  submitted: {
    label: 'En attente de validation',
    description: 'Votre dossier est déposé et placé dans la file de vérification éditoriale et éthique.',
    nextStep: 'Un modérateur habilité va vérifier les sources, le consentement et la sensibilité du lieu.',
    tone: 'amber',
    stepIndex: 1,
  },
  in_review: {
    label: 'En cours d’examen',
    description: 'Un membre de l’équipe éditoriale examine actuellement votre contribution et ses médias.',
    nextStep: 'Vous serez notifié dès qu’une décision ou une demande de précision est enregistrée.',
    tone: 'amber',
    stepIndex: 2,
  },
  needs_revision: {
    label: 'Requiert des ajustements',
    description: 'La modération demande des précisions sur les sources, le contexte ou les autorisations.',
    nextStep: 'Consultez la note de modération ci-dessous, modifiez votre fiche puis soumettez-la à nouveau.',
    tone: 'orange',
    stepIndex: 2,
  },
  validated: {
    label: 'Validé pour publication',
    description: 'Le dossier a reçu l’avis favorable de la rédaction et prépare sa mise en ligne.',
    nextStep: 'Mise en ligne imminente dans la bibliothèque patrimoniale.',
    tone: 'forest',
    stepIndex: 3,
  },
  published: {
    label: 'Publié',
    description: 'Contribution validée et consultable selon le niveau de visibilité défini.',
    nextStep: 'Votre notice contribue officiellement à la mémoire culturelle du Gabon.',
    tone: 'forest',
    stepIndex: 3,
  },
  rejected: {
    label: 'Non retenu',
    description: 'La contribution n’a pas pu être publiée en raison de critères documentaires ou de droits.',
    nextStep: 'Consultez le motif détaillé dans le panneau de modération.',
    tone: 'crimson',
    stepIndex: 3,
  },
  archived: {
    label: 'Archivé',
    description: 'Notice conservée dans les archives internes sans exposition au catalogue actif.',
    nextStep: 'Archive conservée pour traçabilité institutionnelle.',
    tone: 'slate',
    stepIndex: 3,
  },
  withdrawn: {
    label: 'Retiré',
    description: 'Notice retirée de la diffusion à la demande de l’auteur ou de la rédaction.',
    nextStep: 'Aucune diffusion publique en cours.',
    tone: 'slate',
    stepIndex: 3,
  },
};

export const VERIFICATION_DETAILS: Record<Contribution['verificationLabel'], string> = {
  propose: 'Notice soumise par le contributeur, en attente de relecture ou niveau initial.',
  relu: 'Contenu, consentement et attribution relus et confirmés par l’équipe éditoriale.',
  documente: 'Notice accompagnée de sources vérifiables, d’enquêtes ou de références scientifiques.',
};

export function formatDateFr(value: unknown): string {
  if (!value) return 'Date non renseignée';
  try {
    let date: Date | null = null;
    if (value instanceof Date) {
      date = value;
    } else if (typeof value === 'string' || typeof value === 'number') {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) date = parsed;
    } else if (typeof value === 'object' && value !== null) {
      const maybeTs = value as { toDate?: () => Date; seconds?: number };
      if (typeof maybeTs.toDate === 'function') {
        date = maybeTs.toDate();
      } else if (typeof maybeTs.seconds === 'number') {
        date = new Date(maybeTs.seconds * 1000);
      }
    }
    if (!date) return 'Date en cours de synchronisation';
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return 'Date non renseignée';
  }
}

export const PAYOUT_STATUS_LABELS: Record<
  'pending_admin_review' | 'approved_manual_payout' | 'awaiting_provider_config' | 'processing_provider' | 'paid' | 'rejected' | 'cancelled',
  string
> = {
  pending_admin_review: 'En attente de validation administrative',
  approved_manual_payout: 'Approuvé pour virement manuel',
  awaiting_provider_config: 'En attente de configuration prestataire',
  processing_provider: 'Envoyé via SHAP — confirmation opérateur en cours',
  paid: 'Payé et vérifié',
  rejected: 'Refusé',
  cancelled: 'Annulé',
};

export const REWARD_STATUS_LABELS: Record<
  'proposed' | 'approved' | 'announced' | 'paid' | 'cancelled',
  string
> = {
  proposed: 'Proposée',
  approved: 'Approuvée (en attente de publication)',
  announced: 'Publiée sur la page Lauréats',
  paid: 'Dotation versée',
  cancelled: 'Annulée',
};

export const TRANSACTION_STATUS_LABELS: Record<
  'pending' | 'success' | 'failed' | 'reversed',
  string
> = {
  pending: 'En attente de confirmation opérateur',
  success: 'Confirmée',
  failed: 'Échouée',
  reversed: 'Annulée / Remboursée',
};

export const PROVIDER_LABELS: Record<string, string> = {
  airtel_money: 'Airtel Money Gabon',
  airtelmoney: 'Airtel Money Gabon',
  moov_money: 'Moov Money Gabon',
  moovmoney: 'Moov Money Gabon',
};

export const REPORT_CATEGORY_LABELS: Record<
  'erreur_factuelle' | 'droit_auteur_ou_image' | 'savoir_sacre_restreint' | 'contenu_illicite',
  string
> = {
  erreur_factuelle: 'Erreur factuelle ou imprécision',
  droit_auteur_ou_image: 'Droit d’auteur ou droit à l’image',
  savoir_sacre_restreint: 'Savoir sacré ou restreint',
  contenu_illicite: 'Contenu inapproprié ou illicite',
};

export const REPORT_STATUS_LABELS: Record<
  'open' | 'reviewing' | 'resolved' | 'dismissed',
  string
> = {
  open: 'Ouvert',
  reviewing: 'En cours d’examen',
  resolved: 'Résolu',
  dismissed: 'Classé sans suite',
};

export const ASSISTANCE_STATUS_LABELS: Record<
  'open' | 'in_progress' | 'resolved',
  string
> = {
  open: 'En attente',
  in_progress: 'En cours d’accompagnement',
  resolved: 'Traitée',
};

export const PERMISSION_LABELS: Record<
  'auteur_original' | 'autorisation_personnes' | 'domaine_public' | 'accord_communautaire',
  string
> = {
  auteur_original: 'Œuvre ou témoignage original de l’auteur',
  autorisation_personnes: 'Autorisation des personnes représentées',
  domaine_public: 'Archive du domaine public / licence ouverte',
  accord_communautaire: 'Accord communautaire documenté',
};

export const EBILLING_STATUS_LABELS: Record<
  'pending' | 'paid' | 'failed' | 'expired',
  string
> = {
  pending: 'En attente de paiement',
  paid: 'Payée et vérifiée',
  failed: 'Paiement refusé ou annulé',
  expired: 'Facture expirée',
};

export function sanitizeExternalUrl(rawUrl?: string): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
    return '';
  } catch {
    return '';
  }
}

export const HERO_IMAGE_PATH = '/src/assets/images/hero_gabon_heritage_1795226070424.jpg';

/**
 * Clearly marked demonstration archive records displayed when the live Firestore
 * catalog has not yet received real published contributions.
 */
export const DEMO_ARCHIVE_CONTRIBUTIONS: Contribution[] = [
  {
    id: 'demo-ngombi-harpe-sacree',
    authorId: 'demo-researcher-1',
    authorName: 'Collection de démonstration — UOB',
    authorRole: 'researcher',
    authorVerified: true,
    title: 'La harpe Ngombi à huit cordes : organologie et transmission musicale',
    summary:
      'Étude organologique de la harpe arquée du Gabon central, de la taille du bois résonateur à l’accordage des cordes végétales.',
    description:
      "Le Ngombi occupe une place centrale dans l'expression musicale et mémorielle de plusieurs communautés du Gabon, notamment chez les Mitsogo, Apindji et Fang. Taillé dans un bois léger mais résistant, son manche arqué porte fréquemment une figure sculptée veillant sur le jeu de l'instrumentiste.\n\nCette notice de démonstration présente les étapes documentées de fabrication de la caisse de résonance tendue de peau, la tension des huit cordes en fibres végétales, ainsi que les principes d'accompagnement vocal lors des récits épiques et veillées communautaires. Les aspects strictement initiatiques demeurent volontairement exclus de cette fiche publique par respect des détenteurs de savoirs.",
    categoryId: 'musique-danse',
    categoryName: 'Musique et danse',
    province: 'Ngounié',
    locality: 'Mimongo (secteur documenté)',
    sensitiveLocation: false,
    community: 'Mitsogo / Apindji',
    language: 'Mitsogo',
    periodLabel: 'XXe siècle — pratique vivante',
    epistemicType: 'analyse_academique',
    verificationLabel: 'documente',
    visibility: 'public',
    isSacredOrRestricted: false,
    status: 'published',
    sourcesDescription: 'Notice de démonstration inspirée des fonds ethnomusicologiques de Libreville et des enquêtes organologiques universitaires.',
    permissionType: 'domaine_public',
    consentConfirmed: true,
    credit: 'Archive de démonstration Gabon Patrimoine',
    mediaAssets: [
      {
        id: 'demo-media-ngombi',
        url: '/src/assets/images/archive_ngombi_harp_1795226070598.jpg',
        mediaType: 'image',
        mimeType: 'image/jpeg',
        fileSize: 245000,
        altText: 'Harpe traditionnelle gabonaise Ngombi à huit cordes posée sur une natte en raphia tressé',
        credit: 'Illustration éditoriale de démonstration',
      },
    ],
    isDemoArchive: true,
  },
  {
    id: 'demo-masque-okuyi-punu',
    authorId: 'demo-student-1',
    authorName: 'Enquête de démonstration — Master Patrimoine',
    authorRole: 'student',
    authorVerified: false,
    title: 'Esthétique du kaolin blanc dans les masques Okuyi du sud gabonais',
    summary:
      'Analyse des motifs frontaux, des coiffures à coques et du rôle pacificateur des sorties publiques d’Okuyi en Nyanga et Ngounié.',
    description:
      "Sculptés dans un bois tendre recouvert d'argile blanche (kaolin ou pemba), les masques Okuyi incarnent une esthétique de sérénité et de lien mémoriel avec les ancêtres féminins dans le sud du Gabon (notamment chez les Punu, Lumbo et Shira).\n\nCette fiche de démonstration documente uniquement les représentations publiques autorisées : la signification des neuf scarifications en losange sur le front et les tempes, la structure de la coiffure traditionnelle en coques tressées et le rôle social de cohésion lors des cérémonies publiques de réjouissance.",
    categoryId: 'arts-artisanat',
    categoryName: 'Arts et artisanat',
    province: 'Nyanga',
    locality: 'Tchibanga (zone régionale)',
    sensitiveLocation: false,
    community: 'Punu / Lumbo',
    language: 'Punu',
    periodLabel: 'Fin XIXe — XXIe siècle',
    epistemicType: 'enquete_terrain',
    verificationLabel: 'relu',
    visibility: 'public',
    isSacredOrRestricted: false,
    status: 'published',
    sourcesDescription: 'Dossier pédagogique de démonstration — inventaire iconographique des masques du sud Gabon.',
    permissionType: 'accord_communautaire',
    consentConfirmed: true,
    credit: 'Archive de démonstration Gabon Patrimoine',
    mediaAssets: [
      {
        id: 'demo-media-okuyi',
        url: '/src/assets/images/archive_okuyi_mask_1795226070727.jpg',
        mediaType: 'image',
        mimeType: 'image/jpeg',
        fileSize: 218000,
        altText: 'Masque sculpté blanc au kaolin de tradition Okuyi présenté sur socle en pierre',
        credit: 'Illustration éditoriale de démonstration',
      },
    ],
    isDemoArchive: true,
  },
  {
    id: 'demo-tissage-raphia-haut-ogooue',
    authorId: 'demo-citizen-1',
    authorName: 'Témoignage de démonstration — Franceville',
    authorRole: 'citizen',
    authorVerified: false,
    title: 'Le tissage géométrique du raphia et la teinture naturelle en Haut-Ogooué',
    summary:
      'Récit de transmission familiale sur la préparation des fibres de palmier raphia, les pigments végétaux et les pagnes d’apparat.',
    description:
      "Avant l'essor des textiles importés, les pagnes en raphia tissés sur métier incliné servaient à la fois de vêtement d'apparat, d'étoffe cérémonielle et d'étalon d'échange entre lignages dans le Haut-Ogooué et l'Ogooué-Lolo.\n\nCe témoignage de démonstration décrit le prélèvement respectueux des jeunes folioles de raphia, le séchage au soleil, le filage manuel et l'obtention des teintes ocre, brun écorce et noir profond à partir de décoctions de feuilles et de boue ferrugineuse.",
    categoryId: 'savoir-faire',
    categoryName: 'Savoir-faire',
    province: 'Haut-Ogooué',
    locality: 'Bongoville / Franceville',
    sensitiveLocation: false,
    community: 'Téké / Obamba',
    language: 'Téké',
    periodLabel: 'Transmission contemporaine',
    epistemicType: 'temoignage',
    verificationLabel: 'propose',
    visibility: 'public',
    isSacredOrRestricted: false,
    status: 'published',
    sourcesDescription: 'Témoignage oral de démonstration recueilli avec autorisation de l’artisane.',
    permissionType: 'autorisation_personnes',
    consentConfirmed: true,
    credit: 'Archive de démonstration Gabon Patrimoine',
    mediaAssets: [
      {
        id: 'demo-media-raphia',
        url: '/src/assets/images/archive_raffia_craft_1795226069933.jpg',
        mediaType: 'image',
        mimeType: 'image/jpeg',
        fileSize: 264000,
        altText: 'Mains d’artisane gabonaise tissant un textile géométrique en fibres de raphia',
        credit: 'Illustration éditoriale de démonstration',
      },
    ],
    isDemoArchive: true,
  },
  {
    id: 'demo-pirogues-ogooue-lambarene',
    authorId: 'demo-researcher-2',
    authorName: 'Chronique de démonstration — Moyen-Ogooué',
    authorRole: 'researcher',
    authorVerified: true,
    title: 'Pirogues monoxyles et navigation fluviale sur le bas Ogooué',
    summary:
      'Documentation des essences d’okoumé et d’ozigo utilisées pour creuser les pirogues et de la toponymie des lacs de Lambaréné.',
    description:
      "Artère vitale reliant les provinces intérieures à l'Atlantique, le fleuve Ogooué a façonné une véritable culture nautique gabonaise. La taille d'une pirogue monoxyle exige la sélection rigoureuse d'un tronc droit, l'évidement à l'herminette et le façonnage équilibré de la proue.\n\nCette fiche de démonstration rassemble des repères historiques et linguistiques sur les appellations fluviales Myènè et Galwa autour de Lambaréné et des lacs Ezanga et Onangué.",
    categoryId: 'sites-paysages',
    categoryName: 'Sites et paysages culturels',
    province: 'Moyen-Ogooué',
    locality: 'Lambaréné',
    sensitiveLocation: false,
    community: 'Myènè / Galwa',
    language: 'Myènè',
    periodLabel: 'XIXe — XXIe siècle',
    epistemicType: 'archive_documentee',
    verificationLabel: 'documente',
    visibility: 'public',
    isSacredOrRestricted: false,
    status: 'published',
    sourcesDescription: 'Synthèse de démonstration — histoire fluviale et savoirs nautiques de l’Ogooué.',
    permissionType: 'domaine_public',
    consentConfirmed: true,
    credit: 'Archive de démonstration Gabon Patrimoine',
    mediaAssets: [
      {
        id: 'demo-media-ogooue',
        url: '/src/assets/images/archive_ogooue_river_1795226068986.jpg',
        mediaType: 'image',
        mimeType: 'image/jpeg',
        fileSize: 230000,
        altText: 'Pirogues en bois sculpté amarrées à l’aube sur les berges brumeuses du fleuve Ogooué',
        credit: 'Illustration éditoriale de démonstration',
      },
    ],
    isDemoArchive: true,
  },
];

export const REWARD_CRITERIA = [
  {
    title: 'Qualité documentaire',
    description: 'Précision du contexte, clarté de la rédaction, structuration des informations et lisibilité des médias.',
  },
  {
    title: 'Originalité et apport patrimonial',
    description: 'Mise en valeur de langues, localités, savoir-faire ou traditions peu documentés numériquement.',
  },
  {
    title: 'Fiabilité des sources et méthode',
    description: 'Mention explicite des informateurs, archives, références bibliographiques ou protocoles d’enquête.',
  },
  {
    title: 'Respect des droits et consentements',
    description: 'Autorisation des personnes photographiées/enregistrées et respect strict des savoirs restreints.',
  },
];

export const WALLET_TX_STATUS_LABELS: Record<
  'pending' | 'processing' | 'paid' | 'failed' | 'cancelled' | 'rejected',
  string
> = {
  pending: 'En attente de validation',
  processing: 'Traitement opérateur en cours',
  paid: 'Réussi et confirmé',
  failed: 'Échoué',
  cancelled: 'Annulé / Expiré',
  rejected: 'Refusé',
};

export const SOCIAL_PLATFORM_LABELS: Record<
  'facebook' | 'instagram' | 'x' | 'youtube' | 'linkedin' | 'tiktok' | 'whatsapp' | 'other',
  string
> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  x: 'X (Twitter)',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  whatsapp: 'WhatsApp',
  other: 'Site ou réseau officiel',
};

export function validateGabonPhoneClient(
  rawPhone: string,
  expectedProvider?: 'airtel_money' | 'moov_money'
): {
  valid: boolean;
  msisdn: string | null;
  detectedProvider: 'airtel_money' | 'moov_money' | null;
  error?: string;
} {
  let digits = rawPhone.replace(/[^\d]/g, '');
  if (digits.startsWith('00241')) digits = digits.slice(5);
  else if (digits.startsWith('241') && digits.length >= 11) digits = digits.slice(3);

  if (digits.length === 8 && (digits.startsWith('6') || digits.startsWith('7'))) {
    digits = `0${digits}`;
  }

  if (!/^0[67]\d{7}$/.test(digits)) {
    return {
      valid: false,
      msisdn: null,
      detectedProvider: null,
      error: 'Format attendu : +241 074 XX XX XX (Airtel) ou +241 062 XX XX XX (Moov).',
    };
  }

  const prefix = digits.slice(0, 3);
  let detectedProvider: 'airtel_money' | 'moov_money' | null = null;
  if (['074', '076', '077'].includes(prefix)) detectedProvider = 'airtel_money';
  else if (['060', '062', '065', '066'].includes(prefix)) detectedProvider = 'moov_money';

  if (!detectedProvider) {
    return {
      valid: false,
      msisdn: null,
      detectedProvider: null,
      error: `Préfixe « ${prefix} » non reconnu. Airtel : 074/076/077 · Moov : 060/062/065/066.`,
    };
  }

  if (expectedProvider && detectedProvider !== expectedProvider) {
    const label = expectedProvider === 'airtel_money' ? 'Airtel Money (074, 076, 077)' : 'Moov Money (060, 062, 065, 066)';
    return {
      valid: false,
      msisdn: null,
      detectedProvider,
      error: `Ce numéro correspond à ${detectedProvider === 'airtel_money' ? 'Airtel Money' : 'Moov Money'}, pas à ${label}.`,
    };
  }

  return { valid: true, msisdn: digits, detectedProvider };
}
