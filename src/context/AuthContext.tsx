import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onIdTokenChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import {
  createUserProfile,
  fetchMyNotifications,
  fetchUserProfile,
  findAssistedAccountByEmail,
} from '../services/firestoreService';
import type { AppNotification, AssistedAccount, UserProfile } from '../types';

interface AuthContextValue {
  firebaseUser: User | null;
  profile: UserProfile | null;
  assistedMatch: AssistedAccount | null;
  needsOnboarding: boolean;
  authReady: boolean;
  idToken: string | null;
  getFreshIdToken: () => Promise<string | null>;
  notifications: AppNotification[];
  unreadCount: number;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  completeOnboarding: (data: {
    displayName: string;
    role: 'citizen' | 'student' | 'researcher';
    province: string;
    locality?: string;
    institution?: string;
    discipline?: string;
    studyLevel?: string;
    bio?: string;
  }) => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  authError: string | null;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [assistedMatch, setAssistedMatch] = useState<AssistedAccount | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [authError, setAuthError] = useState<string | null>(null);

  const loadUserContext = useCallback(async (user: User | null) => {
    if (!user) {
      setProfile(null);
      setAssistedMatch(null);
      setNeedsOnboarding(false);
      setIdToken(null);
      setNotifications([]);
      setAuthReady(true);
      return;
    }

    try {
      const token = await user.getIdToken();
      setIdToken(token);
      const existingProfile = await fetchUserProfile(user.uid);
      if (existingProfile) {
        setProfile(existingProfile);
        setNeedsOnboarding(false);
        const notifs = await fetchMyNotifications(user.uid);
        setNotifications(notifs);
      } else {
        setProfile(null);
        if (user.email) {
          const match = await findAssistedAccountByEmail(user.email.toLowerCase());
          setAssistedMatch(match);
        }
        setNeedsOnboarding(true);
      }
    } catch (err) {
      console.error('Error loading user context:', err);
      setAuthError('Impossible de charger votre profil pour le moment.');
    } finally {
      setAuthReady(true);
    }
  }, []);

  useEffect(() => {
    const unsub = onIdTokenChanged(auth, (user) => {
      setFirebaseUser(user);
      void loadUserContext(user);
    });
    return () => unsub();
  }, [loadUserContext]);

  const getFreshIdToken = useCallback(async (): Promise<string | null> => {
    const current = auth.currentUser;
    if (!current) return null;
    try {
      const fresh = await current.getIdToken();
      setIdToken(fresh);
      return fresh;
    } catch {
      return idToken;
    }
  }, [idToken]);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('popup-closed-by-user')) {
        setAuthError('Connexion annulée avant validation.');
      } else {
        setAuthError('Échec de la connexion Google. Vérifiez que les fenêtres contextuelles sont autorisées.');
      }
    }
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  const completeOnboarding = useCallback(
    async (data: {
      displayName: string;
      role: 'citizen' | 'student' | 'researcher';
      province: string;
      locality?: string;
      institution?: string;
      discipline?: string;
      studyLevel?: string;
      bio?: string;
    }) => {
      if (!firebaseUser || !firebaseUser.email) return;
      const created = await createUserProfile({
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: data.displayName,
        role: data.role,
        province: data.province,
        locality: data.locality,
        institution: data.institution,
        discipline: data.discipline,
        studyLevel: data.studyLevel,
        bio: data.bio,
        assistedAccount: assistedMatch,
      });
      setProfile(created);
      setAssistedMatch(null);
      setNeedsOnboarding(false);
      const notifs = await fetchMyNotifications(firebaseUser.uid);
      setNotifications(notifs);
    },
    [firebaseUser, assistedMatch]
  );

  const refreshProfile = useCallback(async () => {
    if (!firebaseUser) return;
    const fresh = await fetchUserProfile(firebaseUser.uid);
    if (fresh) setProfile(fresh);
  }, [firebaseUser]);

  const refreshNotifications = useCallback(async () => {
    if (!firebaseUser) return;
    const notifs = await fetchMyNotifications(firebaseUser.uid);
    setNotifications(notifs);
  }, [firebaseUser]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        profile,
        assistedMatch,
        needsOnboarding,
        authReady,
        idToken,
        getFreshIdToken,
        notifications,
        unreadCount,
        signInWithGoogle,
        logout,
        completeOnboarding,
        refreshProfile,
        refreshNotifications,
        authError,
        clearAuthError: () => setAuthError(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
