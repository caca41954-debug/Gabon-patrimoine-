import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { BOOTSTRAP_ADMIN_EMAIL, OFFICIAL_CATEGORIES, sanitizeExternalUrl, STATUS_LABELS } from '../data/gabonData';
import type {
  AppNotification,
  AssistanceRequest,
  AssistedAccount,
  AuditLog,
  ContentReport,
  Contribution,
  ContributionStatus,
  FinancialTransaction,
  HeritageCategory,
  ModerationEvent,
  ModerationHistoryEntry,
  PayoutRequest,
  PublicProfile,
  Reward,
  SocialLink,
  SocialPlatform,
  UserProfile,
  UserRole,
  VerificationLabel,
} from '../types';

function makeId(prefix: string): string {
  const rand = crypto.randomUUID().replace(/-/g, '').slice(0, 18);
  return `${prefix}_${rand}`;
}

function sortByCreatedAtDesc<T extends { createdAt?: unknown; updatedAt?: unknown; requestedAt?: unknown }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const tA = extractTimestampMs(a.createdAt ?? a.updatedAt ?? a.requestedAt);
    const tB = extractTimestampMs(b.createdAt ?? b.updatedAt ?? b.requestedAt);
    return tB - tA;
  });
}

export async function logAuditAction(params: {
  actorId: string;
  actorEmail?: string;
  action: string;
  targetType: string;
  targetId: string;
  summary: string;
}): Promise<void> {
  const logId = makeId('aud');
  try {
    await setDoc(doc(db, 'audit_logs', logId), {
      actorId: params.actorId,
      actorEmail: (params.actorEmail || '').slice(0, 160),
      action: params.action.slice(0, 100),
      targetType: params.targetType.slice(0, 60),
      targetId: params.targetId.slice(0, 128),
      summary: params.summary.slice(0, 400),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `audit_logs/${logId}`);
  }
}

export async function createNotification(params: {
  userId: string;
  title: string;
  message: string;
  type: AppNotification['type'];
}): Promise<void> {
  const notifId = makeId('ntf');
  try {
    await setDoc(doc(db, 'notifications', notifId), {
      userId: params.userId,
      title: params.title.slice(0, 120),
      message: params.message.slice(0, 500),
      type: params.type,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `notifications/${notifId}`);
  }
}

// ============================================================================
// PROFILES & ASSISTED ONBOARDING
// ============================================================================
export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    return snap.data() as UserProfile;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users/${uid}`);
  }
}

export async function findAssistedAccountByEmail(email: string): Promise<AssistedAccount | null> {
  try {
    const q = query(
      collection(db, 'assisted_accounts'),
      where('email', '==', email),
      where('claimStatus', '==', 'pending_first_login'),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...(d.data() as Omit<AssistedAccount, 'id'>) };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'assisted_accounts');
  }
}

export async function createUserProfile(params: {
  uid: string;
  email: string;
  displayName: string;
  role: 'citizen' | 'student' | 'researcher';
  province?: string;
  locality?: string;
  institution?: string;
  discipline?: string;
  studyLevel?: string;
  bio?: string;
  assistedAccount?: AssistedAccount | null;
}): Promise<UserProfile> {
  const isBootstrap = params.email === BOOTSTRAP_ADMIN_EMAIL;
  const resolvedRole: UserRole = isBootstrap
    ? 'admin'
    : params.assistedAccount?.role && params.assistedAccount.role !== 'moderator'
      ? params.assistedAccount.role
      : params.role;

  const profilePayload: Record<string, unknown> = {
    uid: params.uid,
    displayName: params.displayName.trim().slice(0, 100),
    email: params.email.trim().slice(0, 160),
    role: resolvedRole,
    bio: (params.bio || '').trim().slice(0, 1000),
    province: (params.province || params.assistedAccount?.province || 'Estuaire').slice(0, 60),
    locality: (params.locality || '').trim().slice(0, 120),
    institution: (params.institution || params.assistedAccount?.institution || '').trim().slice(0, 160),
    discipline: (params.discipline || params.assistedAccount?.discipline || '').trim().slice(0, 120),
    studyLevel: (params.studyLevel || '').trim().slice(0, 80),
    verifiedBadge: false,
    accountStatus: 'active',
    assistedByAdmin: Boolean(params.assistedAccount),
    consentAcceptedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const publicPayload: Record<string, unknown> = {
    uid: params.uid,
    displayName: profilePayload.displayName,
    role: resolvedRole,
    bio: profilePayload.bio,
    province: profilePayload.province,
    institution: profilePayload.institution,
    discipline: profilePayload.discipline,
    verifiedBadge: false,
    isLaureate: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'users', params.uid), profilePayload);
    batch.set(doc(db, 'public_profiles', params.uid), publicPayload);
    if (params.assistedAccount) {
      batch.update(doc(db, 'assisted_accounts', params.assistedAccount.id), {
        claimStatus: 'claimed',
        claimedUid: params.uid,
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
    return (await fetchUserProfile(params.uid)) as UserProfile;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${params.uid}`);
  }
}

export async function updateOwnProfile(
  uid: string,
  updates: Partial<Pick<UserProfile, 'displayName' | 'phone' | 'bio' | 'province' | 'locality' | 'institution' | 'discipline' | 'studyLevel' | 'interests'>>
): Promise<void> {
  try {
    const cleanUpdates: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (updates.displayName !== undefined) cleanUpdates.displayName = updates.displayName.trim().slice(0, 100);
    if (updates.phone !== undefined) cleanUpdates.phone = updates.phone.trim().slice(0, 40);
    if (updates.bio !== undefined) cleanUpdates.bio = updates.bio.trim().slice(0, 1000);
    if (updates.province !== undefined) cleanUpdates.province = updates.province.trim().slice(0, 60);
    if (updates.locality !== undefined) cleanUpdates.locality = updates.locality.trim().slice(0, 120);
    if (updates.institution !== undefined) cleanUpdates.institution = updates.institution.trim().slice(0, 160);
    if (updates.discipline !== undefined) cleanUpdates.discipline = updates.discipline.trim().slice(0, 120);
    if (updates.studyLevel !== undefined) cleanUpdates.studyLevel = updates.studyLevel.trim().slice(0, 80);
    if (updates.interests !== undefined) cleanUpdates.interests = updates.interests.trim().slice(0, 300);

    const publicUpdates: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (cleanUpdates.displayName !== undefined) publicUpdates.displayName = cleanUpdates.displayName;
    if (cleanUpdates.bio !== undefined) publicUpdates.bio = cleanUpdates.bio;
    if (cleanUpdates.province !== undefined) publicUpdates.province = cleanUpdates.province;
    if (cleanUpdates.institution !== undefined) publicUpdates.institution = cleanUpdates.institution;
    if (cleanUpdates.discipline !== undefined) publicUpdates.discipline = cleanUpdates.discipline;

    const batch = writeBatch(db);
    batch.update(doc(db, 'users', uid), cleanUpdates);
    batch.update(doc(db, 'public_profiles', uid), publicUpdates);
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }
}

// ============================================================================
// CATEGORIES
// ============================================================================
export async function fetchCategories(): Promise<HeritageCategory[]> {
  try {
    const snap = await getDocs(collection(db, 'categories'));
    if (snap.empty) return OFFICIAL_CATEGORIES;
    return snap.docs.map((d) => d.data() as HeritageCategory).filter((c) => c.isActive);
  } catch {
    return OFFICIAL_CATEGORIES;
  }
}

export async function seedOfficialCategories(actorId: string, actorEmail?: string): Promise<void> {
  try {
    const batch = writeBatch(db);
    for (const cat of OFFICIAL_CATEGORIES) {
      batch.set(doc(db, 'categories', cat.id), cat);
    }
    await batch.commit();
    await logAuditAction({
      actorId,
      actorEmail,
      action: 'SEED_CATEGORIES',
      targetType: 'categories',
      targetId: 'official_14',
      summary: 'Initialisation des 14 catégories patrimoniales officielles du Gabon.',
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'categories');
  }
}

// ============================================================================
// CONTRIBUTIONS
// ============================================================================
export async function fetchPublishedContributions(): Promise<Contribution[]> {
  try {
    const q = query(
      collection(db, 'contributions'),
      where('status', '==', 'published'),
      where('visibility', '==', 'public'),
      orderBy('createdAt', 'desc'),
      limit(60)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Contribution, 'id'>) }));
  } catch (error) {
    // Fallback without composite index if index is still building
    try {
      const qSimple = query(
        collection(db, 'contributions'),
        where('status', '==', 'published'),
        where('visibility', '==', 'public'),
        limit(60)
      );
      const snap = await getDocs(qSimple);
      return sortByCreatedAtDesc(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Contribution, 'id'>) })));
    } catch (innerErr) {
      handleFirestoreError(innerErr, OperationType.LIST, 'contributions');
    }
  }
}

export async function fetchContributionById(contribId: string): Promise<Contribution | null> {
  try {
    const snap = await getDoc(doc(db, 'contributions', contribId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as Omit<Contribution, 'id'>) };
  } catch {
    return null;
  }
}

export async function fetchRestrictedPublishedContributions(isResearcherOrStaff: boolean): Promise<Contribution[]> {
  try {
    const visibilities = isResearcherOrStaff ? ['restricted_community', 'research_only'] : ['restricted_community'];
    const results: Contribution[] = [];
    for (const vis of visibilities) {
      const q = query(
        collection(db, 'contributions'),
        where('status', '==', 'published'),
        where('visibility', '==', vis),
        limit(30)
      );
      const snap = await getDocs(q);
      results.push(...snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Contribution, 'id'>) })));
    }
    return sortByCreatedAtDesc(results);
  } catch {
    return [];
  }
}

export async function fetchMyContributions(uid: string): Promise<Contribution[]> {
  try {
    const q = query(collection(db, 'contributions'), where('authorId', '==', uid), limit(100));
    const snap = await getDocs(q);
    return sortByCreatedAtDesc(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Contribution, 'id'>) })));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'contributions');
  }
}

export async function fetchAllContributionsForModeration(): Promise<Contribution[]> {
  try {
    const q = query(collection(db, 'contributions'), limit(150));
    const snap = await getDocs(q);
    return sortByCreatedAtDesc(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Contribution, 'id'>) })));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'contributions');
  }
}

export async function saveContribution(
  author: UserProfile,
  payload: Omit<
    Contribution,
    'id' | 'authorId' | 'authorName' | 'authorRole' | 'authorVerified' | 'verificationLabel' | 'createdAt' | 'updatedAt'
  >,
  existingId?: string,
  existingVerificationLabel?: VerificationLabel
): Promise<string> {
  const contribId = existingId || makeId('cnt');
  const targetStatus: ContributionStatus = payload.status === 'submitted' ? 'submitted' : 'draft';
  const verificationLabel: VerificationLabel = existingId && existingVerificationLabel ? existingVerificationLabel : 'propose';

  const docData: Record<string, unknown> = {
    authorId: author.uid,
    authorName: author.displayName,
    authorRole: author.role,
    authorVerified: author.verifiedBadge,
    title: payload.title.trim().slice(0, 180),
    summary: payload.summary.trim().slice(0, 400),
    description: payload.description.trim().slice(0, 12000),
    categoryId: payload.categoryId,
    categoryName: payload.categoryName.slice(0, 80),
    province: payload.province.slice(0, 60),
    locality: (payload.locality || '').trim().slice(0, 120),
    sensitiveLocation: Boolean(payload.sensitiveLocation),
    community: (payload.community || '').trim().slice(0, 120),
    language: payload.language.trim().slice(0, 80),
    periodLabel: payload.periodLabel.trim().slice(0, 80),
    epistemicType: payload.epistemicType,
    verificationLabel,
    visibility: payload.visibility,
    isSacredOrRestricted: Boolean(payload.isSacredOrRestricted),
    status: targetStatus,
    sourcesDescription: (payload.sourcesDescription || '').trim().slice(0, 2000),
    sourceUrl: sanitizeExternalUrl(payload.sourceUrl).slice(0, 500),
    permissionType: payload.permissionType,
    consentConfirmed: Boolean(payload.consentConfirmed),
    credit: (payload.credit || author.displayName).trim().slice(0, 200),
    mediaAssets: (payload.mediaAssets || []).slice(0, 6),
    updatedAt: serverTimestamp(),
  };

  try {
    const batch = writeBatch(db);
    if (existingId) {
      batch.update(doc(db, 'contributions', contribId), docData);
    } else {
      batch.set(doc(db, 'contributions', contribId), {
        ...docData,
        publishedAt: null,
        createdAt: serverTimestamp(),
      });
    }

    if (targetStatus === 'submitted') {
      const historyId = makeId('his');
      batch.set(doc(db, 'contributions', contribId, 'moderation_history', historyId), {
        contributionId: contribId,
        authorId: author.uid,
        moderatorId: author.uid,
        moderatorName: author.displayName.slice(0, 100),
        decision: 'submitted',
        verificationLabel: 'propose',
        reason: existingId
          ? 'Contribution ajustée et soumise à nouveau pour validation éditoriale.'
          : 'Dépôt initial soumis à la modération éditoriale et éthique.',
        createdAt: serverTimestamp(),
      });
    }

    await batch.commit();

    if (targetStatus === 'submitted') {
      await createNotification({
        userId: author.uid,
        title: 'Contribution en attente de validation',
        message: `Votre contribution « ${docData.title} » a été enregistrée et placée dans la file d'examen éditorial.`,
        type: 'contribution',
      });
      await logAuditAction({
        actorId: author.uid,
        actorEmail: author.email,
        action: 'SUBMIT_CONTRIBUTION',
        targetType: 'contribution',
        targetId: contribId,
        summary: `Soumission de la contribution « ${docData.title} ».`,
      });
    }
    return contribId;
  } catch (error) {
    handleFirestoreError(error, existingId ? OperationType.UPDATE : OperationType.CREATE, `contributions/${contribId}`);
  }
}

export async function withdrawContribution(contribId: string, authorId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'contributions', contribId), {
      status: 'withdrawn',
      updatedAt: serverTimestamp(),
    });
    await logAuditAction({
      actorId: authorId,
      action: 'WITHDRAW_CONTRIBUTION',
      targetType: 'contribution',
      targetId: contribId,
      summary: 'Retrait volontaire d’une contribution par son auteur.',
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `contributions/${contribId}`);
  }
}

export async function deleteDraftContribution(contribId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'contributions', contribId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `contributions/${contribId}`);
  }
}

// ============================================================================
// MODERATION & REPORTS
// ============================================================================
export async function moderateContribution(params: {
  contribution: Contribution;
  moderator: UserProfile;
  decision: ContributionStatus;
  verificationLabel: VerificationLabel;
  reason: string;
  internalNote?: string;
  sensitiveLocation?: boolean;
  visibility?: Contribution['visibility'];
  idToken: string;
}): Promise<void> {
  const eventId = makeId('mod');
  const updatePayload: Record<string, unknown> = {
    status: params.decision,
    verificationLabel: params.verificationLabel,
    moderationNote: params.reason.trim().slice(0, 1000),
    reviewedBy: params.moderator.uid,
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (params.sensitiveLocation !== undefined) {
    updatePayload.sensitiveLocation = params.sensitiveLocation;
  }
  if (params.visibility !== undefined) {
    updatePayload.visibility = params.visibility;
  }
  if (params.decision === 'published') {
    updatePayload.publishedAt = serverTimestamp();
  }

  try {
    const cleanReason = params.reason.trim().slice(0, 1000) || 'Décision éditoriale enregistrée.';
    const batch = writeBatch(db);
    batch.update(doc(db, 'contributions', params.contribution.id), updatePayload);
    batch.set(doc(db, 'moderation_events', eventId), {
      contributionId: params.contribution.id,
      contributionTitle: params.contribution.title.slice(0, 180),
      moderatorId: params.moderator.uid,
      moderatorName: params.moderator.displayName.slice(0, 100),
      decision: params.decision,
      reason: cleanReason,
      internalNote: (params.internalNote || '').trim().slice(0, 1000),
      createdAt: serverTimestamp(),
    });
    batch.set(doc(db, 'contributions', params.contribution.id, 'moderation_history', eventId), {
      contributionId: params.contribution.id,
      authorId: params.contribution.authorId,
      moderatorId: params.moderator.uid,
      moderatorName: params.moderator.displayName.slice(0, 100),
      decision: params.decision,
      verificationLabel: params.verificationLabel,
      reason: cleanReason,
      createdAt: serverTimestamp(),
    });
    await batch.commit();

    // Sync local media asset publication status
    const assetIds = (params.contribution.mediaAssets || []).map((m) => m.id).filter(Boolean);
    if (assetIds.length > 0) {
      const mediaStatus =
        params.decision === 'published' ? 'published' : params.decision === 'rejected' ? 'rejected' : 'pending';
      await fetch('/api/media/sync-status', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${params.idToken}`,
        },
        body: JSON.stringify({
          assetIds,
          contributionId: params.contribution.id,
          status: mediaStatus,
        }),
      });
    }

    await createNotification({
      userId: params.contribution.authorId,
      title: `Statut éditorial : ${STATUS_LABELS[params.decision]}`,
      message: `${params.contribution.title} — ${cleanReason}`,
      type: 'moderation',
    });

    await logAuditAction({
      actorId: params.moderator.uid,
      actorEmail: params.moderator.email,
      action: `MODERATE_${params.decision.toUpperCase()}`,
      targetType: 'contribution',
      targetId: params.contribution.id,
      summary: `Modération de « ${params.contribution.title} » -> ${params.decision} (${params.verificationLabel}).`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `contributions/${params.contribution.id}`);
  }
}

export async function fetchModerationEvents(): Promise<ModerationEvent[]> {
  try {
    const q = query(collection(db, 'moderation_events'), limit(100));
    const snap = await getDocs(q);
    return sortByCreatedAtDesc(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ModerationEvent, 'id'>) })));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'moderation_events');
  }
}

export async function fetchModerationEventsForContribution(contributionId: string): Promise<ModerationEvent[]> {
  try {
    const q = query(
      collection(db, 'moderation_events'),
      where('contributionId', '==', contributionId),
      limit(40)
    );
    const snap = await getDocs(q);
    return sortByCreatedAtDesc(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ModerationEvent, 'id'>) })));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `moderation_events?contributionId=${contributionId}`);
  }
}

export async function fetchContributionModerationHistory(
  contributionId: string,
  viewerUid: string,
  isStaff: boolean
): Promise<ModerationHistoryEntry[]> {
  const path = `contributions/${contributionId}/moderation_history`;
  try {
    const colRef = collection(db, 'contributions', contributionId, 'moderation_history');
    const q = isStaff
      ? query(colRef, limit(50))
      : query(colRef, where('authorId', '==', viewerUid), limit(50));
    const snap = await getDocs(q);
    const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ModerationHistoryEntry, 'id'>) }));
    return items.sort((a, b) => {
      const tA = extractTimestampMs(a.createdAt);
      const tB = extractTimestampMs(b.createdAt);
      return tB - tA;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

function extractTimestampMs(value: unknown): number {
  if (!value) return 0;
  if (typeof value === 'object' && value !== null) {
    const ts = value as { toMillis?: () => number; seconds?: number };
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const ms = new Date(value).getTime();
    return Number.isNaN(ms) ? 0 : ms;
  }
  return 0;
}

export async function submitReport(params: {
  contributionId: string;
  contributionTitle: string;
  reporter: UserProfile;
  reasonCategory: ContentReport['reasonCategory'];
  details: string;
}): Promise<void> {
  const reportId = makeId('rpt');
  try {
    await setDoc(doc(db, 'reports', reportId), {
      contributionId: params.contributionId,
      contributionTitle: params.contributionTitle.slice(0, 180),
      reporterId: params.reporter.uid,
      reporterName: params.reporter.displayName.slice(0, 100),
      reasonCategory: params.reasonCategory,
      details: params.details.trim().slice(0, 1500),
      status: 'open',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `reports/${reportId}`);
  }
}

export async function fetchReports(): Promise<ContentReport[]> {
  try {
    const q = query(collection(db, 'reports'), limit(100));
    const snap = await getDocs(q);
    return sortByCreatedAtDesc(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ContentReport, 'id'>) })));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'reports');
  }
}

export async function updateReportStatus(
  reportId: string,
  status: ContentReport['status'],
  resolutionNote: string,
  actor: UserProfile
): Promise<void> {
  try {
    await updateDoc(doc(db, 'reports', reportId), {
      status,
      resolutionNote: resolutionNote.trim().slice(0, 1000),
      updatedAt: serverTimestamp(),
    });
    await logAuditAction({
      actorId: actor.uid,
      actorEmail: actor.email,
      action: 'UPDATE_REPORT',
      targetType: 'report',
      targetId: reportId,
      summary: `Signalement ${reportId} mis à jour vers ${status}.`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `reports/${reportId}`);
  }
}

// ============================================================================
// ADMIN USERS & ASSISTANCE
// ============================================================================
export async function fetchAllUsers(): Promise<UserProfile[]> {
  try {
    const snap = await getDocs(query(collection(db, 'users'), limit(200)));
    return snap.docs.map((d) => d.data() as UserProfile);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'users');
  }
}

export async function fetchPublicProfiles(): Promise<PublicProfile[]> {
  try {
    const snap = await getDocs(query(collection(db, 'public_profiles'), limit(200)));
    return snap.docs.map((d) => d.data() as PublicProfile);
  } catch {
    return [];
  }
}

export async function adminUpdateUser(
  targetUid: string,
  updates: {
    role?: UserRole;
    verifiedBadge?: boolean;
    accountStatus?: UserProfile['accountStatus'];
    displayName?: string;
    province?: string;
    institution?: string;
    discipline?: string;
  },
  actor: UserProfile
): Promise<void> {
  try {
    const privateUpdates: Record<string, unknown> = { updatedAt: serverTimestamp() };
    const publicUpdates: Record<string, unknown> = { updatedAt: serverTimestamp() };

    if (updates.role !== undefined) {
      privateUpdates.role = updates.role;
      publicUpdates.role = updates.role;
    }
    if (updates.verifiedBadge !== undefined) {
      privateUpdates.verifiedBadge = updates.verifiedBadge;
      publicUpdates.verifiedBadge = updates.verifiedBadge;
    }
    if (updates.accountStatus !== undefined) {
      privateUpdates.accountStatus = updates.accountStatus;
    }
    if (updates.displayName !== undefined) {
      privateUpdates.displayName = updates.displayName.trim().slice(0, 100);
      publicUpdates.displayName = privateUpdates.displayName;
    }
    if (updates.province !== undefined) {
      privateUpdates.province = updates.province.trim().slice(0, 60);
      publicUpdates.province = privateUpdates.province;
    }
    if (updates.institution !== undefined) {
      privateUpdates.institution = updates.institution.trim().slice(0, 160);
      publicUpdates.institution = privateUpdates.institution;
    }
    if (updates.discipline !== undefined) {
      privateUpdates.discipline = updates.discipline.trim().slice(0, 120);
      publicUpdates.discipline = privateUpdates.discipline;
    }

    const batch = writeBatch(db);
    batch.update(doc(db, 'users', targetUid), privateUpdates);
    batch.update(doc(db, 'public_profiles', targetUid), publicUpdates);
    await batch.commit();

    await logAuditAction({
      actorId: actor.uid,
      actorEmail: actor.email,
      action: 'ADMIN_UPDATE_USER',
      targetType: 'user',
      targetId: targetUid,
      summary: `Modification du profil ${targetUid} (rôle=${updates.role || 'inchangé'}, statut=${updates.accountStatus || 'inchangé'}).`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${targetUid}`);
  }
}

export async function createAssistedAccount(
  params: {
    displayName: string;
    email: string;
    phone?: string;
    role: AssistedAccount['role'];
    province?: string;
    institution?: string;
    discipline?: string;
    notes?: string;
  },
  admin: UserProfile
): Promise<void> {
  const id = makeId('ast');
  try {
    await setDoc(doc(db, 'assisted_accounts', id), {
      displayName: params.displayName.trim().slice(0, 100),
      email: params.email.trim().toLowerCase().slice(0, 160),
      phone: (params.phone || '').trim().slice(0, 40),
      role: params.role,
      province: (params.province || 'Estuaire').slice(0, 60),
      institution: (params.institution || '').trim().slice(0, 160),
      discipline: (params.discipline || '').trim().slice(0, 120),
      notes: (params.notes || '').trim().slice(0, 600),
      claimStatus: 'pending_first_login',
      createdByAdminId: admin.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await logAuditAction({
      actorId: admin.uid,
      actorEmail: admin.email,
      action: 'CREATE_ASSISTED_ACCOUNT',
      targetType: 'assisted_account',
      targetId: id,
      summary: `Pré-création assistée du compte pour ${params.displayName} (${params.email}, rôle ${params.role}).`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `assisted_accounts/${id}`);
  }
}

export async function fetchAssistedAccounts(): Promise<AssistedAccount[]> {
  try {
    const snap = await getDocs(query(collection(db, 'assisted_accounts'), limit(100)));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AssistedAccount, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'assisted_accounts');
  }
}

export async function submitSignedInAssistanceRequest(params: {
  user: UserProfile;
  requestedRole: 'citizen' | 'student' | 'researcher';
  message: string;
}): Promise<void> {
  const id = makeId('req');
  try {
    await setDoc(doc(db, 'assistance_requests', id), {
      requesterUid: params.user.uid,
      requesterName: params.user.displayName,
      contactInfo: params.user.email,
      requestedRole: params.requestedRole,
      message: params.message.trim().slice(0, 1500),
      status: 'open',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `assistance_requests/${id}`);
  }
}

export async function fetchFirestoreAssistanceRequests(): Promise<AssistanceRequest[]> {
  try {
    const snap = await getDocs(query(collection(db, 'assistance_requests'), limit(100)));
    return sortByCreatedAtDesc(
      snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<AssistanceRequest, 'id'>),
        source: 'firestore' as const,
      }))
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'assistance_requests');
  }
}

export async function updateFirestoreAssistanceRequest(
  id: string,
  status: AssistanceRequest['status'],
  adminNote: string
): Promise<void> {
  try {
    await updateDoc(doc(db, 'assistance_requests', id), {
      status,
      adminNote: adminNote.trim().slice(0, 1000),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `assistance_requests/${id}`);
  }
}

// ============================================================================
// REWARDS, PAYOUT REQUESTS & TRANSACTIONS (INTEGER XAF)
// ============================================================================
export async function fetchAnnouncedRewards(): Promise<Reward[]> {
  try {
    const results: Reward[] = [];
    for (const status of ['announced', 'paid'] as const) {
      const q = query(
        collection(db, 'rewards'),
        where('decisionStatus', '==', status),
        where('publicAnnouncementApproved', '==', true),
        limit(50)
      );
      const snap = await getDocs(q);
      results.push(...snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Reward, 'id'>) })));
    }
    return sortByCreatedAtDesc(results);
  } catch {
    return [];
  }
}

export async function fetchMyRewards(uid: string): Promise<Reward[]> {
  try {
    const q = query(collection(db, 'rewards'), where('contributorId', '==', uid), limit(50));
    const snap = await getDocs(q);
    return sortByCreatedAtDesc(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Reward, 'id'>) })));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'rewards');
  }
}

export async function fetchAllRewards(): Promise<Reward[]> {
  try {
    const snap = await getDocs(query(collection(db, 'rewards'), limit(100)));
    return sortByCreatedAtDesc(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Reward, 'id'>) })));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'rewards');
  }
}

export async function createReward(
  params: {
    contributor: UserProfile;
    periodLabel: string;
    amountXaf: number;
    criteriaSummary: string;
    featuredContributionTitle?: string;
    announceNow: boolean;
  },
  admin: UserProfile
): Promise<string> {
  const id = makeId('rwd');
  const intAmount = Math.max(0, Math.round(Number(params.amountXaf)));
  const status = params.announceNow ? 'announced' : 'approved';
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'rewards', id), {
      contributorId: params.contributor.uid,
      contributorName: params.contributor.displayName,
      contributorRole: params.contributor.role,
      periodLabel: params.periodLabel.trim().slice(0, 60),
      amountXaf: intAmount,
      currency: 'XAF',
      criteriaSummary: params.criteriaSummary.trim().slice(0, 1000),
      featuredContributionTitle: (params.featuredContributionTitle || '').trim().slice(0, 180),
      publicAnnouncementApproved: params.announceNow,
      decisionStatus: status,
      approvedBy: admin.uid,
      announcedAt: params.announceNow ? serverTimestamp() : null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    if (params.announceNow) {
      batch.update(doc(db, 'public_profiles', params.contributor.uid), {
        isLaureate: true,
        laureatePeriod: params.periodLabel.trim().slice(0, 80),
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();

    await createNotification({
      userId: params.contributor.uid,
      title: 'Distinction Gabon Patrimoine attribuée',
      message: `Vous avez reçu une reconnaissance pour ${params.periodLabel} (${intAmount.toLocaleString('fr-FR')} XAF). Consultez votre espace personnel.`,
      type: 'reward',
    });

    await logAuditAction({
      actorId: admin.uid,
      actorEmail: admin.email,
      action: 'CREATE_REWARD',
      targetType: 'reward',
      targetId: id,
      summary: `Attribution d’une récompense de ${intAmount} XAF à ${params.contributor.displayName} (${params.periodLabel}).`,
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `rewards/${id}`);
  }
}

export async function toggleRewardPublicConsent(rewardId: string, approved: boolean): Promise<void> {
  try {
    await updateDoc(doc(db, 'rewards', rewardId), {
      publicAnnouncementApproved: approved,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `rewards/${rewardId}`);
  }
}

export async function createPayoutRequest(params: {
  reward: Reward;
  beneficiary: UserProfile;
  provider: 'airtel_money' | 'moov_money';
  rawPhone: string;
  idToken?: string;
}): Promise<string> {
  const digits = params.rawPhone.replace(/\D/g, '');
  const tail = digits.slice(-4) || '0000';
  const maskedPhone = `+241 ** ** ${tail}`;
  const id = makeId('pay');

  try {
    if (params.idToken) {
      const destRes = await fetch('/api/payments/payout-destination', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${params.idToken}`,
        },
        body: JSON.stringify({
          payoutRequestId: id,
          provider: params.provider,
          rawPhone: params.rawPhone,
        }),
      });
      if (!destRes.ok) {
        const errBody = (await destRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error || 'Numéro Mobile Money gabonais invalide.');
      }
    }

    await setDoc(doc(db, 'payout_requests', id), {
      rewardId: params.reward.id,
      beneficiaryId: params.beneficiary.uid,
      beneficiaryName: params.beneficiary.displayName,
      provider: params.provider,
      maskedPhone,
      amountXaf: Math.round(params.reward.amountXaf),
      status: 'pending_admin_review',
      requestedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await logAuditAction({
      actorId: params.beneficiary.uid,
      actorEmail: params.beneficiary.email,
      action: 'REQUEST_PAYOUT',
      targetType: 'payout_request',
      targetId: id,
      summary: `Demande de retrait ${params.provider} de ${params.reward.amountXaf} XAF (${maskedPhone}).`,
    });
    return id;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Numéro Mobile Money')) {
      throw error;
    }
    handleFirestoreError(error, OperationType.CREATE, `payout_requests/${id}`);
  }
}

export async function fetchMyPayoutRequests(uid: string): Promise<PayoutRequest[]> {
  try {
    const q = query(collection(db, 'payout_requests'), where('beneficiaryId', '==', uid), limit(50));
    const snap = await getDocs(q);
    return sortByCreatedAtDesc(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PayoutRequest, 'id'>) })));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'payout_requests');
  }
}

export async function fetchAllPayoutRequests(): Promise<PayoutRequest[]> {
  try {
    const snap = await getDocs(query(collection(db, 'payout_requests'), limit(100)));
    return sortByCreatedAtDesc(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PayoutRequest, 'id'>) })));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'payout_requests');
  }
}

export async function adminProcessManualPayout(params: {
  payoutRequest: PayoutRequest;
  decision: 'paid' | 'rejected' | 'awaiting_provider_config';
  providerReference: string;
  note: string;
  admin: UserProfile;
}): Promise<void> {
  const txId = makeId('txn');
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'payout_requests', params.payoutRequest.id), {
      status: params.decision,
      providerReference: params.providerReference.trim().slice(0, 120),
      failureReason: params.decision === 'rejected' ? params.note.trim().slice(0, 400) : '',
      processedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (params.decision === 'paid') {
      batch.update(doc(db, 'rewards', params.payoutRequest.rewardId), {
        decisionStatus: 'paid',
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(db, 'transactions', txId), {
        payoutRequestId: params.payoutRequest.id,
        beneficiaryId: params.payoutRequest.beneficiaryId,
        provider: params.payoutRequest.provider,
        providerTransactionId: params.providerReference.trim().slice(0, 120),
        amountXaf: Math.round(params.payoutRequest.amountXaf),
        status: 'success',
        idempotencyKey: `manual_${params.payoutRequest.id}`,
        executionNote: params.note.trim().slice(0, 400) || 'Décaissement manuel vérifié par l’administrateur.',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();

    await createNotification({
      userId: params.payoutRequest.beneficiaryId,
      title: 'Mise à jour de votre demande de retrait',
      message:
        params.decision === 'paid'
          ? `Votre retrait de ${params.payoutRequest.amountXaf.toLocaleString('fr-FR')} XAF (${params.payoutRequest.provider}) a été enregistré comme payé (réf. ${params.providerReference}).`
          : `Statut du retrait : ${params.decision}. ${params.note}`,
      type: 'payout',
    });

    await logAuditAction({
      actorId: params.admin.uid,
      actorEmail: params.admin.email,
      action: `PAYOUT_${params.decision.toUpperCase()}`,
      targetType: 'payout_request',
      targetId: params.payoutRequest.id,
      summary: `Traitement manuel du retrait ${params.payoutRequest.id} -> ${params.decision} (réf: ${params.providerReference || 'aucune'}).`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `payout_requests/${params.payoutRequest.id}`);
  }
}

export async function adminRecordShapPayoutResult(params: {
  payoutRequest: PayoutRequest;
  shapStatus: 'success' | 'pending';
  payoutId: string | null;
  externalReference: string;
  admin: UserProfile;
}): Promise<void> {
  const txId = `txn_${params.payoutRequest.id}`;
  const providerRef = (params.payoutId || params.externalReference).slice(0, 120);
  const isSuccess = params.shapStatus === 'success';
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'payout_requests', params.payoutRequest.id), {
      status: isSuccess ? 'paid' : 'processing_provider',
      providerReference: providerRef,
      failureReason: '',
      processedAt: isSuccess ? serverTimestamp() : null,
      updatedAt: serverTimestamp(),
    });

    if (isSuccess) {
      batch.update(doc(db, 'rewards', params.payoutRequest.rewardId), {
        decisionStatus: 'paid',
        updatedAt: serverTimestamp(),
      });
    }

    batch.set(doc(db, 'transactions', txId), {
      payoutRequestId: params.payoutRequest.id,
      beneficiaryId: params.payoutRequest.beneficiaryId,
      provider: params.payoutRequest.provider,
      providerTransactionId: providerRef,
      amountXaf: Math.round(params.payoutRequest.amountXaf),
      status: isSuccess ? 'success' : 'pending',
      idempotencyKey: `shap_${params.payoutRequest.id}`,
      executionNote: isSuccess
        ? `Décaissement automatique SHAP confirmé (${params.externalReference}).`
        : `Ordre de décaissement transmis à SHAP (${params.externalReference}) — confirmation opérateur en attente.`,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();

    await createNotification({
      userId: params.payoutRequest.beneficiaryId,
      title: isSuccess ? 'Retrait Mobile Money versé' : 'Retrait transmis à l’opérateur',
      message: isSuccess
        ? `Votre retrait de ${params.payoutRequest.amountXaf.toLocaleString('fr-FR')} XAF a été exécuté via SHAP (réf. ${providerRef}).`
        : `Votre retrait de ${params.payoutRequest.amountXaf.toLocaleString('fr-FR')} XAF est en cours de traitement par l’opérateur Mobile Money.`,
      type: 'payout',
    });

    await logAuditAction({
      actorId: params.admin.uid,
      actorEmail: params.admin.email,
      action: isSuccess ? 'SHAP_PAYOUT_SUCCESS' : 'SHAP_PAYOUT_PENDING',
      targetType: 'payout_request',
      targetId: params.payoutRequest.id,
      summary: `Décaissement SHAP ${params.externalReference} -> ${params.shapStatus} (id: ${providerRef}).`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `payout_requests/${params.payoutRequest.id}`);
  }
}

export async function adminReconcileShapTransaction(params: {
  payoutRequest: PayoutRequest;
  shapStatus: 'success' | 'failed' | 'pending';
  payoutId: string | null;
  externalReference: string;
  admin: UserProfile;
}): Promise<void> {
  if (params.shapStatus === 'pending') return;
  const txId = `txn_${params.payoutRequest.id}`;
  const providerRef = (params.payoutId || params.externalReference).slice(0, 120);
  const isSuccess = params.shapStatus === 'success';
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'payout_requests', params.payoutRequest.id), {
      status: isSuccess ? 'paid' : 'rejected',
      providerReference: providerRef,
      failureReason: isSuccess ? '' : 'Décaissement signalé en échec par l’opérateur SHAP.',
      processedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (isSuccess) {
      batch.update(doc(db, 'rewards', params.payoutRequest.rewardId), {
        decisionStatus: 'paid',
        updatedAt: serverTimestamp(),
      });
    }

    const txSnap = await getDoc(doc(db, 'transactions', txId));
    if (txSnap.exists() && txSnap.data().status === 'pending') {
      batch.update(doc(db, 'transactions', txId), {
        status: isSuccess ? 'success' : 'failed',
        providerTransactionId: providerRef,
        executionNote: isSuccess
          ? `Confirmation opérateur reçue (${params.externalReference}).`
          : `Échec confirmé par l’opérateur (${params.externalReference}).`,
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();

    await createNotification({
      userId: params.payoutRequest.beneficiaryId,
      title: isSuccess ? 'Retrait Mobile Money confirmé' : 'Échec du retrait Mobile Money',
      message: isSuccess
        ? `Votre retrait de ${params.payoutRequest.amountXaf.toLocaleString('fr-FR')} XAF est confirmé (réf. ${providerRef}).`
        : `Le décaissement de ${params.payoutRequest.amountXaf.toLocaleString('fr-FR')} XAF n’a pas abouti chez l’opérateur.`,
      type: 'payout',
    });

    await logAuditAction({
      actorId: params.admin.uid,
      actorEmail: params.admin.email,
      action: isSuccess ? 'SHAP_RECONCILE_SUCCESS' : 'SHAP_RECONCILE_FAILED',
      targetType: 'payout_request',
      targetId: params.payoutRequest.id,
      summary: `Réconciliation SHAP ${params.externalReference} -> ${params.shapStatus}.`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `payout_requests/${params.payoutRequest.id}`);
  }
}

export async function fetchAllTransactions(): Promise<FinancialTransaction[]> {
  try {
    const snap = await getDocs(query(collection(db, 'transactions'), limit(100)));
    return sortByCreatedAtDesc(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FinancialTransaction, 'id'>) })));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'transactions');
  }
}

export async function fetchMyTransactions(uid: string): Promise<FinancialTransaction[]> {
  try {
    const q = query(collection(db, 'transactions'), where('beneficiaryId', '==', uid), limit(50));
    const snap = await getDocs(q);
    return sortByCreatedAtDesc(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FinancialTransaction, 'id'>) })));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'transactions');
  }
}

export async function fetchAuditLogs(): Promise<AuditLog[]> {
  try {
    const snap = await getDocs(query(collection(db, 'audit_logs'), limit(120)));
    return sortByCreatedAtDesc(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AuditLog, 'id'>) })));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'audit_logs');
  }
}

export async function fetchMyNotifications(uid: string): Promise<AppNotification[]> {
  try {
    const q = query(collection(db, 'notifications'), where('userId', '==', uid), limit(40));
    const snap = await getDocs(q);
    return sortByCreatedAtDesc(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AppNotification, 'id'>) })));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'notifications');
  }
}

export async function markNotificationRead(notifId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'notifications', notifId), { read: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `notifications/${notifId}`);
  }
}

// ============================================================================
// OFFICIAL SOCIAL LINKS (ADMIN CRUD + PUBLIC ACTIVE LIST)
// ============================================================================
export async function fetchActiveSocialLinks(): Promise<SocialLink[]> {
  try {
    const q = query(collection(db, 'social_links'), where('isActive', '==', true), limit(40));
    const snap = await getDocs(q);
    const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SocialLink, 'id'>) }));
    return items.sort((a, b) => (a.displayOrder ?? 100) - (b.displayOrder ?? 100));
  } catch {
    return [];
  }
}

export async function fetchAllSocialLinks(): Promise<SocialLink[]> {
  try {
    const snap = await getDocs(query(collection(db, 'social_links'), limit(60)));
    const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SocialLink, 'id'>) }));
    return items.sort((a, b) => (a.displayOrder ?? 100) - (b.displayOrder ?? 100));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'social_links');
  }
}

export async function saveSocialLink(
  params: {
    id?: string;
    platform: SocialPlatform;
    label: string;
    url: string;
    isActive: boolean;
    displayOrder: number;
  },
  admin: UserProfile
): Promise<string> {
  const cleanLabel = params.label.trim().slice(0, 60);
  const rawUrl = params.url.trim();
  const safeUrl = sanitizeExternalUrl(rawUrl);
  if (!safeUrl || !safeUrl.startsWith('https://')) {
    throw new Error('L’URL officielle doit obligatoirement commencer par https://');
  }
  if (cleanLabel.length < 2) {
    throw new Error('Le libellé du réseau social doit contenir au moins 2 caractères.');
  }
  const intOrder = Math.min(Math.max(0, Math.round(Number(params.displayOrder) || 0)), 1000);
  const linkId = params.id || makeId('soc');

  try {
    if (params.id) {
      await updateDoc(doc(db, 'social_links', linkId), {
        platform: params.platform,
        label: cleanLabel,
        url: safeUrl.slice(0, 400),
        isActive: Boolean(params.isActive),
        displayOrder: intOrder,
        updatedBy: admin.uid,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'social_links', linkId), {
        platform: params.platform,
        label: cleanLabel,
        url: safeUrl.slice(0, 400),
        isActive: Boolean(params.isActive),
        displayOrder: intOrder,
        updatedBy: admin.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await logAuditAction({
      actorId: admin.uid,
      actorEmail: admin.email,
      action: params.id ? 'UPDATE_SOCIAL_LINK' : 'CREATE_SOCIAL_LINK',
      targetType: 'social_link',
      targetId: linkId,
      summary: `${params.id ? 'Mise à jour' : 'Ajout'} du réseau social ${cleanLabel} (${params.platform}, actif=${params.isActive}).`,
    });
    return linkId;
  } catch (error) {
    handleFirestoreError(error, params.id ? OperationType.UPDATE : OperationType.CREATE, `social_links/${linkId}`);
  }
}

export async function deleteSocialLink(link: SocialLink, admin: UserProfile): Promise<void> {
  try {
    await deleteDoc(doc(db, 'social_links', link.id));
    await logAuditAction({
      actorId: admin.uid,
      actorEmail: admin.email,
      action: 'DELETE_SOCIAL_LINK',
      targetType: 'social_link',
      targetId: link.id,
      summary: `Suppression du réseau social ${link.label} (${link.platform}).`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `social_links/${link.id}`);
  }
}
