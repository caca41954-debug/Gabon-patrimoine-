import React, { useState } from 'react';
import {
  Award,
  BookOpen,
  Menu,
  Moon,
  PenSquare,
  Shield,
  Sun,
  User,
  Wallet,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { PWAInstallButton } from './PWAControls';

export type AppRoute = 'library' | 'contribute' | 'laureates' | 'payment' | 'account' | 'admin';

interface NavbarProps {
  currentRoute: AppRoute;
  onNavigate: (route: AppRoute) => void;
  onOpenAuthModal: () => void;
}

export function Navbar({ currentRoute, onNavigate, onOpenAuthModal }: NavbarProps) {
  const { profile, firebaseUser, unreadCount } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isStaff = profile?.role === 'admin' || profile?.role === 'moderator';

  const navItems: { id: AppRoute; label: string }[] = [
    { id: 'library', label: 'Bibliothèque' },
    { id: 'contribute', label: 'Contribuer' },
    { id: 'payment', label: 'Dépôt & Retrait' },
    { id: 'laureates', label: 'Lauréats' },
    { id: 'account', label: unreadCount > 0 ? `Mon espace (${unreadCount})` : 'Mon espace' },
  ];

  if (isStaff) {
    navItems.push({ id: 'admin', label: 'Administration' });
  }

  const handleNav = (route: AppRoute) => {
    onNavigate(route);
    setMobileMenuOpen(false);
  };

  const mobileTabs: {
    id: AppRoute;
    label: string;
    Icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }[] = [
    { id: 'library', label: 'Archives', Icon: BookOpen },
    { id: 'payment', label: 'Mobile Money', Icon: Wallet },
    { id: 'contribute', label: 'Contribuer', Icon: PenSquare },
    { id: 'account', label: 'Espace', Icon: User, badge: unreadCount },
    isStaff
      ? { id: 'admin', label: 'Admin', Icon: Shield }
      : { id: 'laureates', label: 'Lauréats', Icon: Award },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 bg-[#F9F8F6]/90 dark:bg-[#111110]/90 backdrop-blur-md border-b border-stone-200/80 dark:border-[#2E2C28]">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
          {/* Zone 1: Brand Wordmark */}
          <button
            type="button"
            onClick={() => handleNav('library')}
            className="font-display text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-100 whitespace-nowrap shrink-0 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#14532D]"
          >
            Gabon Patrimoine
          </button>

          {/* Zone 2: Single-line Desktop Navigation */}
          <nav
            className="hidden lg:flex items-center gap-6 text-sm font-medium text-stone-600 dark:text-stone-300"
            aria-label="Navigation principale"
          >
            {navItems.map((item) => {
              const active = currentRoute === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNav(item.id)}
                  className={`py-1.5 whitespace-nowrap shrink-0 transition-colors border-b-2 ${
                    active
                      ? 'text-stone-900 dark:text-white border-[#14532D] dark:border-emerald-400 font-semibold'
                      : 'text-stone-600 dark:text-stone-400 border-transparent hover:text-stone-900 dark:hover:text-white hover:border-stone-300 dark:hover:border-stone-600'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Theme Toggle, PWA Install & Primary Account CTA */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? 'Activer le mode clair' : 'Activer le mode sombre'}
              title={isDark ? 'Mode clair' : 'Mode sombre'}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-stone-200 dark:border-[#2E2C28] bg-white dark:bg-[#1C1B19] text-stone-700 dark:text-stone-200 hover:border-stone-300 dark:hover:border-stone-600 transition-colors"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>

            <div className="hidden md:block">
              <PWAInstallButton variant="subtle" />
            </div>

            {firebaseUser ? (
              <button
                type="button"
                onClick={() => handleNav('account')}
                className="hidden lg:inline-flex px-4 py-2 text-xs font-semibold text-white bg-[#14532D] hover:bg-[#114224] dark:bg-emerald-700 dark:hover:bg-emerald-600 rounded-xl transition-colors whitespace-nowrap shrink-0 max-w-[180px] truncate"
              >
                {profile?.displayName || firebaseUser.displayName || 'Mon compte'}
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenAuthModal}
                className="hidden lg:inline-flex px-4 py-2 text-xs font-semibold text-white bg-[#14532D] hover:bg-[#114224] dark:bg-emerald-700 dark:hover:bg-emerald-600 rounded-xl transition-colors whitespace-nowrap shrink-0"
              >
                Se connecter
              </button>
            )}

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label={mobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
              className="lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-stone-800 dark:text-stone-200 hover:bg-stone-200/60 dark:hover:bg-[#23211E] transition-colors"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile / Tablet Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-stone-200 dark:border-[#2E2C28] bg-[#F9F8F6] dark:bg-[#161513] px-4 py-4 space-y-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`w-full min-h-[44px] text-left px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  currentRoute === item.id
                    ? 'bg-stone-200/80 dark:bg-[#262421] text-stone-900 dark:text-white font-semibold'
                    : 'text-stone-700 dark:text-stone-300 hover:bg-stone-200/40 dark:hover:bg-[#1E1C19]'
                }`}
              >
                {item.label}
              </button>
            ))}

            <div className="pt-2 border-t border-stone-200 dark:border-[#2E2C28] flex flex-col gap-2">
              <PWAInstallButton variant="subtle" className="w-full" />
              {!firebaseUser ? (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenAuthModal();
                  }}
                  className="w-full min-h-[44px] px-4 py-2.5 bg-[#14532D] hover:bg-[#114224] dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  Se connecter
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleNav('account')}
                  className="w-full min-h-[44px] px-4 py-2.5 bg-[#14532D] hover:bg-[#114224] dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  {profile?.displayName || firebaseUser.displayName || 'Mon espace'}
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Mobile Bottom Tab Bar */}
      <nav
        aria-label="Accès rapide mobile"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-[#181715]/95 backdrop-blur-md border-t border-stone-200 dark:border-[#2E2C28] px-1 pt-1 pb-[calc(env(safe-area-inset-bottom)+0.25rem)]"
      >
        <div className="grid grid-cols-5 gap-1">
          {mobileTabs.map((tab) => {
            const active = currentRoute === tab.id;
            const Icon = tab.Icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleNav(tab.id)}
                className={`relative min-h-[48px] flex flex-col items-center justify-center gap-0.5 rounded-xl px-1 transition-colors ${
                  active
                    ? 'text-[#14532D] dark:text-emerald-400 font-semibold'
                    : 'text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="text-[10px] leading-tight truncate max-w-full">{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span
                    aria-label={`${tab.badge} notifications non lues`}
                    className="absolute top-1.5 right-3 w-2 h-2 rounded-full bg-amber-500"
                  />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
