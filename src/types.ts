export type UserRole = 'citizen' | 'student' | 'researcher' | 'moderator' | 'admin';

export type AccountStatus = 'active' | 'suspended' | 'assisted_pending';

export type ContributionStatus =
  | 'draft'
  | 'submitted'
  | 'in_review'
  | 'needs_revision'
  | 'validated'
  | 'published'
  | 'rejected'
  | 'archived'
  | 'withdrawn';

export type EpistemicType =
  | 'temoignage'
  | 'tradition_orale'
  | 'enquete_terrain'
  | 'analyse_academique'
  | 'archive_documentee';

export type VerificationLabel = 'propose' | 'relu' | 'documente';

export type VisibilityLevel = 'public' | 'restricted_community' | 'research_only';

export type PermissionType =
  | 'auteur_original'
  | 'autorisation_personnes'
  | 'domaine_public'
  | 'accord_communautaire';

export interface MediaAsset {
  id: string;
  url: string;
  mediaType: 'image' | 'audio' | 'video' | 'document';
  mimeType: string;
  fileSize: number;
  altText: string;
  credit: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  phone?: string;
  role: UserRole;
  bio?: string;
  province?: string;
  locality?: string;
  institution?: string;
  discipline?: string;
  studyLevel?: string;
  interests?: string;
  avatarUrl?: string;
  verifiedBadge: boolean;
  accountStatus: AccountStatus;
  assistedByAdmin?: boolean;
  consentAcceptedAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PublicProfile {
  uid: string;
  displayName: string;
  role: UserRole;
  bio?: string;
  province?: string;
  institution?: string;
  discipline?: string;
  verifiedBadge: boolean;
  isLaureate?: boolean;
  laureatePeriod?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface HeritageCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
}

export interface Contribution {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  authorVerified?: boolean;
  title: string;
  summary: string;
  description: string;
  categoryId: string;
  categoryName: string;
  province: string;
  locality?: string;
  sensitiveLocation: boolean;
  community?: string;
  language: string;
  periodLabel: string;
  epistemicType: EpistemicType;
  verificationLabel: VerificationLabel;
  visibility: VisibilityLevel;
  isSacredOrRestricted: boolean;
  status: ContributionStatus;
  sourcesDescription?: string;
  sourceUrl?: string;
  permissionType: PermissionType;
  consentConfirmed: boolean;
  credit?: string;
  mediaAssets: MediaAsset[];
  moderationNote?: string;
  reviewedBy?: string;
  reviewedAt?: unknown;
  publishedAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  isDemoArchive?: boolean;
}

export interface ModerationEvent {
  id: string;
  contributionId: string;
  contributionTitle: string;
  moderatorId: string;
  moderatorName: string;
  decision: ContributionStatus;
  reason: string;
  internalNote?: string;
  createdAt?: unknown;
}

export interface ModerationHistoryEntry {
  id: string;
  contributionId: string;
  authorId: string;
  moderatorId: string;
  moderatorName: string;
  decision: ContributionStatus;
  verificationLabel: VerificationLabel;
  reason: string;
  createdAt?: unknown;
}

export interface ContentReport {
  id: string;
  contributionId: string;
  contributionTitle: string;
  reporterId: string;
  reporterName: string;
  reasonCategory:
    | 'erreur_factuelle'
    | 'droit_auteur_ou_image'
    | 'savoir_sacre_restreint'
    | 'contenu_illicite';
  details: string;
  status: 'open' | 'reviewing' | 'resolved' | 'dismissed';
  resolutionNote?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AssistanceRequest {
  id: string;
  requesterUid?: string;
  requesterName: string;
  contactInfo: string;
  requestedRole: 'citizen' | 'student' | 'researcher';
  message: string;
  status: 'open' | 'in_progress' | 'resolved';
  adminNote?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  source?: 'firestore' | 'public_inbox';
}

export interface AssistedAccount {
  id: string;
  displayName: string;
  email: string;
  phone?: string;
  role: 'citizen' | 'student' | 'researcher' | 'moderator';
  province?: string;
  institution?: string;
  discipline?: string;
  notes?: string;
  claimStatus: 'pending_first_login' | 'claimed';
  claimedUid?: string;
  createdByAdminId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Reward {
  id: string;
  contributorId: string;
  contributorName: string;
  contributorRole: UserRole;
  periodLabel: string;
  amountXaf: number;
  currency: 'XAF';
  criteriaSummary: string;
  featuredContributionTitle?: string;
  publicAnnouncementApproved: boolean;
  decisionStatus: 'proposed' | 'approved' | 'announced' | 'paid' | 'cancelled';
  approvedBy: string;
  announcedAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PayoutRequest {
  id: string;
  rewardId: string;
  beneficiaryId: string;
  beneficiaryName: string;
  provider: 'airtel_money' | 'moov_money';
  maskedPhone: string;
  amountXaf: number;
  status:
    | 'pending_admin_review'
    | 'approved_manual_payout'
    | 'awaiting_provider_config'
    | 'processing_provider'
    | 'paid'
    | 'rejected'
    | 'cancelled';
  providerReference?: string;
  failureReason?: string;
  requestedAt?: unknown;
  processedAt?: unknown;
  updatedAt?: unknown;
}

export interface FinancialTransaction {
  id: string;
  payoutRequestId: string;
  beneficiaryId: string;
  provider: 'airtel_money' | 'moov_money';
  providerTransactionId?: string;
  amountXaf: number;
  status: 'pending' | 'success' | 'failed' | 'reversed';
  idempotencyKey: string;
  executionNote?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'contribution' | 'moderation' | 'reward' | 'payout' | 'assistance';
  read: boolean;
  createdAt?: unknown;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorEmail?: string;
  action: string;
  targetType: string;
  targetId: string;
  summary: string;
  createdAt?: unknown;
}

export interface MobileMoneyProviderStatus {
  id: 'airtel_money' | 'moov_money';
  label: string;
  configured: boolean;
  gateway: 'shap' | 'direct' | 'none';
  mode: 'live_api' | 'manual_review_only';
  missingEnvVars: string[];
  notice: string;
}

export interface GatewayArchitectureStatus {
  shap: {
    configured: boolean;
    baseUrl: string;
    webhookSecretConfigured: boolean;
    callbackUrl: string;
    missingEnvVars: string[];
  };
  ebilling: {
    configured: boolean;
    baseUrl: string;
    portalUrl: string;
    webhookSecretConfigured: boolean;
    callbackUrl: string;
    legacyCallbackUrl?: string;
    missingEnvVars: string[];
  };
}

export interface EbillingWebhookEventLog {
  receivedAt: string;
  state: string;
  operator?: string;
  transactionId?: string;
  signatureVerified: boolean;
}

export interface EbillingTransaction {
  externalReference: string;
  billId: string;
  ussdPushId?: string | number | null;
  amountXaf: number;
  payerName?: string;
  payerEmail: string;
  payerMsisdnMasked: string;
  purpose?: string;
  shortDescription: string;
  paymentUrl: string;
  status: 'pending' | 'paid' | 'failed' | 'expired';
  operator?: string;
  providerTransactionId?: string;
  paidAt?: string | null;
  webhookEvents?: EbillingWebhookEventLog[];
  createdByUid: string;
  createdAt: string;
  updatedAt: string;
}

export type SocialPlatform =
  | 'facebook'
  | 'instagram'
  | 'x'
  | 'youtube'
  | 'linkedin'
  | 'tiktok'
  | 'whatsapp'
  | 'other';

export interface SocialLink {
  id: string;
  platform: SocialPlatform;
  label: string;
  url: string;
  isActive: boolean;
  displayOrder: number;
  updatedBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type GabonMobileProvider = 'airtel_money' | 'moov_money';
export type WalletTransactionType = 'deposit' | 'withdrawal';
export type WalletTransactionStatus =
  | 'pending'
  | 'processing'
  | 'paid'
  | 'failed'
  | 'cancelled'
  | 'rejected';

export interface LinkedMobileMoneyAccount {
  provider: GabonMobileProvider;
  msisdnMasked: string;
  verifiedAt: string;
  updatedAt: string;
}

export interface WalletAccount {
  uid: string;
  email: string;
  displayName: string;
  availableXaf: number;
  pendingWithdrawalXaf: number;
  totalDepositedXaf: number;
  totalWithdrawnXaf: number;
  linkedAccounts: {
    airtel_money?: LinkedMobileMoneyAccount;
    moov_money?: LinkedMobileMoneyAccount;
  };
  createdAt: string;
  updatedAt: string;
}

export interface WalletTransaction {
  id: string;
  reference: string;
  uid: string;
  userEmail: string;
  userName: string;
  type: WalletTransactionType;
  provider: GabonMobileProvider;
  msisdnMasked: string;
  amountXaf: number;
  feeXaf: number;
  netAmountXaf: number;
  status: WalletTransactionStatus;
  channel: 'ebilling_portal' | 'ebilling_ussd' | 'shap_payout' | 'admin_manual';
  externalReference: string;
  providerTransactionId: string | null;
  paymentUrl?: string;
  ussdPushId?: string | number | null;
  idempotencyKey: string;
  creditedAt: string | null;
  debitedAt: string | null;
  refundedAt: string | null;
  statusMessage: string;
  adminNote?: string;
  reviewedByUid?: string;
  reviewedByEmail?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WalletLimits {
  minDepositXaf: number;
  maxDepositXaf: number;
  minWithdrawalXaf: number;
  maxWithdrawalXaf: number;
  dailyLimitXaf: number;
}

export interface WalletReadiness {
  depositConfigured: boolean;
  depositMissingEnvVars: string[];
  withdrawalAutoConfigured: boolean;
  withdrawalMissingEnvVars: string[];
  webhookDepositConfigured: boolean;
  webhookWithdrawalConfigured: boolean;
}

export interface WalletSummaryResponse {
  account: WalletAccount;
  limits: WalletLimits;
  readiness: WalletReadiness;
}

export interface WalletTransactionsPage {
  items: WalletTransaction[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface WalletAuditEvent {
  id: string;
  timestamp: string;
  actorUid: string;
  actorEmail: string;
  action: string;
  reference?: string;
  amountXaf?: number;
  provider?: GabonMobileProvider;
  summary: string;
}

export interface WalletAdminOverview {
  totals: {
    totalDepositsPaidXaf: number;
    totalWithdrawalsPaidXaf: number;
    pendingWithdrawalsCount: number;
    totalAccountsCount: number;
  };
  transactions: WalletTransactionsPage;
  auditLogs: WalletAuditEvent[];
}
