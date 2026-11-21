import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ExternalLink } from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LibraryView } from './components/LibraryView';
import { Navbar, type AppRoute } from './components/Navbar';
import { AuthAndAssistanceModal, OnboardingModal } from './components/OnboardingModal';
import { OfflineIndicator, PWAInstallButton } from './components/PWAControls';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { fetchActiveSocialLinks } from './services/firestoreService';
import type { Contribution, SocialLink } from './types';

const ContributeView = lazy(() =>
  import('./components/ContributeView').then((m) => ({ default: m.ContributeView }))
);
const LaureatesView = lazy(() =>
  import('./components/LaureatesView').then((m) => ({ default: m.LaureatesView }))
);
const PaymentView = lazy(() =>
  import('./components/PaymentView').then((m) => ({ default: m.PaymentView }))
);
const AccountWorkspace = lazy(() =>
  import('./components/AccountWorkspace').then((m) => ({ default: m.AccountWorkspace }))
);
const AdminDashboard = lazy(() =>
  import('./components/AdminDashboard').then((m) => ({ default: m.AdminDashboard }))
);

function RouteSkeleton() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-14 space-y-6 animate-pulse">
      <div className="h-6 w-48 rounded-lg bg-stone-200 dark:bg-stone-800" />
      <div className="h-12 w-3/4 rounded-xl bg-stone-200 dark:bg-stone-800" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        <div className="h-44 rounded-2xl bg-stone-200/80 dark:bg-stone-800/80" />
        <div className="h-44 rounded-2xl bg-stone-200/80 dark:bg-stone-800/80" />
        <div className="h-44 rounded-2xl bg-stone-200/80 dark:bg-stone-800/80" />
      </div>
    </div>
  );
}

function readInitialNavigationState(): {
  route: AppRoute;
  ficheId: string | null;
  paymentRef: string | null;
  paymentToken: string | null;
  paymentReturnState: string | null;
  paymentMode: 'deposit' | 'withdraw' | 'support';
} {
  if (typeof window === 'undefined') {
    return {
      route: 'library',
      ficheId: null,
      paymentRef: null,
      paymentToken: null,
      paymentReturnState: null,
      paymentMode: 'deposit',
    };
  }
  const params = new URLSearchParams(window.location.search);
  const ficheId = params.get('fiche');
  const paymentRef = params.get('ref');
  const paymentToken = params.get('token');
  const paymentReturnState = params.get('paiement');
  const vue = params.get('vue') as AppRoute | null;

  if (paymentRef || paymentReturnState) {
    return {
      route: 'payment',
      ficheId: null,
      paymentRef,
      paymentToken,
      paymentReturnState,
      paymentMode: paymentRef && !paymentRef.startsWith('DEP-') ? 'support' : 'deposit',
    };
  }
  if (ficheId) {
    return {
      route: 'library',
      ficheId,
      paymentRef: null,
      paymentToken: null,
      paymentReturnState: null,
      paymentMode: 'deposit',
    };
  }
  const validRoutes: AppRoute[] = ['library', 'contribute', 'laureates', 'payment', 'account', 'admin'];
  if (vue && validRoutes.includes(vue)) {
    return {
      route: vue,
      ficheId: null,
      paymentRef: null,
      paymentToken: null,
      paymentReturnState: null,
      paymentMode: 'deposit',
    };
  }
  return {
    route: 'library',
    ficheId: null,
    paymentRef: null,
    paymentToken: null,
    paymentReturnState: null,
    paymentMode: 'deposit',
  };
}

function AppShell() {
  const initialNav = useMemo(() => readInitialNavigationState(), []);
  const [route, setRoute] = useState<AppRoute>(initialNav.route);
  const [paymentMode, setPaymentMode] = useState<'deposit' | 'withdraw' | 'support'>(initialNav.paymentMode);
  const [initialFicheId, setInitialFicheId] = useState<string | null>(initialNav.ficheId);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [editingContribution, setEditingContribution] = useState<Contribution | null>(null);
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);

  useEffect(() => {
    let active = true;
    fetchActiveSocialLinks()
      .then((links) => {
        if (active) setSocialLinks(links);
      })
      .catch(() => {
        if (active) setSocialLinks([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const navigateTo = (nextRoute: AppRoute, nextPaymentMode?: 'deposit' | 'withdraw' | 'support') => {
    if (nextPaymentMode) {
      setPaymentMode(nextPaymentMode);
    } else if (nextRoute === 'payment') {
      setPaymentMode('deposit');
    }
    setRoute(nextRoute);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F9F8F6] dark:bg-[#0D0D0C] text-[#181715] dark:text-stone-100 transition-colors">
      <Navbar
        currentRoute={route}
        onNavigate={(r) => navigateTo(r)}
        onOpenAuthModal={() => setAuthModalOpen(true)}
      />

      <OfflineIndicator />

      <main className="flex-1">
        <motion.div
          key={route}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          {route === 'library' && (
            <LibraryView
              initialFicheId={initialFicheId}
              onClearInitialFiche={() => setInitialFicheId(null)}
              onNavigateContribute={() => navigateTo('contribute')}
              onNavigateAccount={() => navigateTo('account')}
              onNavigatePayment={() => navigateTo('payment', 'deposit')}
              socialLinks={socialLinks}
              onEditContribution={(c) => {
                setEditingContribution(c);
                navigateTo('contribute');
              }}
            />
          )}

          {route !== 'library' && (
            <Suspense fallback={<RouteSkeleton />}>
              {route === 'contribute' && (
                <ContributeView
                  editingContribution={editingContribution}
                  onClearEditing={() => setEditingContribution(null)}
                  onOpenAuthModal={() => setAuthModalOpen(true)}
                  onSubmitted={() => navigateTo('account')}
                />
              )}
              {route === 'laureates' && (
                <LaureatesView onNavigatePayment={() => navigateTo('payment', 'support')} />
              )}
              {route === 'payment' && (
                <PaymentView
                  initialReference={initialNav.paymentRef}
                  initialStatusToken={initialNav.paymentToken}
                  initialReturnState={initialNav.paymentReturnState}
                  initialMode={paymentMode}
                  onOpenAuthModal={() => setAuthModalOpen(true)}
                />
              )}
              {route === 'account' && (
                <AccountWorkspace
                  onOpenAuthModal={() => setAuthModalOpen(true)}
                  onEditContribution={(c) => {
                    setEditingContribution(c);
                    navigateTo('contribute');
                  }}
                  onNavigateContribute={() => navigateTo('contribute')}
                  onNavigatePayment={(m) => navigateTo('payment', m || 'deposit')}
                />
              )}
              {route === 'admin' && <AdminDashboard />}
            </Suspense>
          )}
        </motion.div>
      </main>

      <footer className="border-t border-stone-200 dark:border-stone-800 bg-white dark:bg-[#141413] py-8 pb-24 md:pb-8 px-4 sm:px-8 mt-12 transition-colors">
        <div className="max-w-7xl mx-auto flex flex-col gap-6 text-xs text-stone-500 dark:text-stone-400">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="font-display text-base font-semibold text-stone-900 dark:text-stone-100">
                Gabon Patrimoine
              </p>
              <p>Mémoire culturelle collective · Documentation citoyenne et scientifique du Gabon</p>
            </div>
            <div className="flex flex-wrap items-center gap-4 sm:gap-5">
              <button
                type="button"
                onClick={() => navigateTo('library')}
                className="hover:text-stone-900 dark:hover:text-stone-100"
              >
                Bibliothèque
              </button>
              <button
                type="button"
                onClick={() => navigateTo('laureates')}
                className="hover:text-stone-900 dark:hover:text-stone-100"
              >
                Critères & Lauréats
              </button>
              <button
                type="button"
                onClick={() => navigateTo('payment', 'deposit')}
                className="hover:text-stone-900 dark:hover:text-stone-100"
              >
                Dépôt & Retrait
              </button>
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="hover:text-stone-900 dark:hover:text-stone-100"
              >
                Assistance compte
              </button>
              <PWAInstallButton variant="footer" />
            </div>
          </div>

          {socialLinks.length > 0 && (
            <div className="pt-4 border-t border-stone-200/80 dark:border-stone-800 flex flex-wrap items-center gap-x-5 gap-y-2">
              <span className="font-medium text-stone-700 dark:text-stone-300">Réseaux officiels :</span>
              {socialLinks.map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[#14532D] dark:text-emerald-400 hover:underline font-medium"
                >
                  <span>{link.label}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              ))}
            </div>
          )}
        </div>
      </footer>

      <AuthAndAssistanceModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />
      <OnboardingModal />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
