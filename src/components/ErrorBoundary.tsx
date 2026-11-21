import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    let message = error.message || 'Une erreur inattendue est survenue.';
    try {
      const parsed = JSON.parse(message) as { error?: string; operationType?: string; path?: string };
      if (parsed.error) {
        message = `Erreur d'accès aux données (${parsed.operationType || 'opération'} sur ${parsed.path || 'ressource'}) : ${parsed.error}`;
      }
    } catch {
      // Plain error message
    }
    return { hasError: true, errorMessage: message };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F9F8F6] dark:bg-[#111110] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white dark:bg-[#1C1B19] border border-stone-200 dark:border-[#2E2C28] rounded-2xl p-8">
            <p className="text-xs uppercase tracking-widest text-stone-500 dark:text-stone-400 mb-2">
              Interruption de session
            </p>
            <h1 className="font-display text-3xl font-semibold text-stone-900 dark:text-stone-100 mb-3">
              Impossible de poursuivre l’affichage
            </h1>
            <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed mb-6">
              {this.state.errorMessage}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 bg-[#14532D] dark:bg-emerald-700 text-white text-sm font-medium rounded-xl hover:bg-[#114224] dark:hover:bg-emerald-600 transition-colors"
            >
              Recharger la plateforme
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
