/**
 * Security test specification verifying the 12 adversarial payloads against Gabon Patrimoine Firestore rules.
 * Designed to run against the Firebase Emulator Suite (`@firebase/rules-unit-testing`) when available.
 */
export interface AdversarialTestCase {
  id: string;
  title: string;
  collectionPath: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  expectedOutcome: 'PERMISSION_DENIED';
  payload: Record<string, unknown>;
}

export const DIRTY_DOZEN_PAYLOADS: AdversarialTestCase[] = [
  {
    id: 'DD-01',
    title: 'Privilege escalation on profile creation',
    collectionPath: 'users/attacker_uid',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    payload: {
      uid: 'attacker_uid',
      displayName: 'Attacker',
      email: 'attacker@example.com',
      role: 'admin',
      verifiedBadge: false,
      accountStatus: 'active'
    }
  },
  {
    id: 'DD-02',
    title: 'Self-grant verified researcher badge',
    collectionPath: 'users/citizen_uid',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    payload: { verifiedBadge: true }
  },
  {
    id: 'DD-03',
    title: 'Bypass mandatory moderation on contribution create',
    collectionPath: 'contributions/contrib_bypass',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    payload: {
      authorId: 'citizen_uid',
      status: 'published',
      verificationLabel: 'documente'
    }
  },
  {
    id: 'DD-04',
    title: 'Author UID spoofing',
    collectionPath: 'contributions/contrib_spoof',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    payload: {
      authorId: 'victim_uid',
      status: 'submitted'
    }
  },
  {
    id: 'DD-05',
    title: 'Read another user private PII document',
    collectionPath: 'users/victim_uid',
    operation: 'get',
    expectedOutcome: 'PERMISSION_DENIED',
    payload: {}
  },
  {
    id: 'DD-06',
    title: 'Unfiltered list query exposing draft contributions',
    collectionPath: 'contributions',
    operation: 'list',
    expectedOutcome: 'PERMISSION_DENIED',
    payload: { query: 'all_unfiltered' }
  },
  {
    id: 'DD-07',
    title: 'Client-forged createdAt timestamp',
    collectionPath: 'contributions/contrib_backdate',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    payload: {
      authorId: 'citizen_uid',
      status: 'draft',
      createdAt: '2020-01-01T00:00:00Z'
    }
  },
  {
    id: 'DD-08',
    title: 'Shadow field injection on profile update',
    collectionPath: 'users/citizen_uid',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    payload: { displayName: 'Legit', isAdmin: true }
  },
  {
    id: 'DD-09',
    title: 'Negative or float payout amount',
    collectionPath: 'payout_requests/payout_bad_amt',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    payload: { beneficiaryId: 'citizen_uid', amountXaf: -1000, status: 'pending_admin_review' }
  },
  {
    id: 'DD-10',
    title: 'Beneficiary self-approving Mobile Money payout',
    collectionPath: 'payout_requests/payout_1',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    payload: { status: 'paid' }
  },
  {
    id: 'DD-11',
    title: 'Mutating immutable audit log',
    collectionPath: 'audit_logs/log_1',
    operation: 'delete',
    expectedOutcome: 'PERMISSION_DENIED',
    payload: {}
  },
  {
    id: 'DD-12',
    title: 'Oversized poisoned document ID (>128 chars)',
    collectionPath: `contributions/${'a'.repeat(200)}`,
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    payload: { title: 'Test' }
  },
  {
    id: 'DD-13',
    title: 'Non-HTTPS URL or unauthorized write on social_links',
    collectionPath: 'social_links/soc_bad_1',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    payload: {
      platform: 'facebook',
      label: 'Facebook',
      url: 'javascript:alert(1)',
      isActive: true,
      displayOrder: 1
    }
  }
];

