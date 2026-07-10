'use client';

/**
 * PWASetup — client-side bootstrap for V10 mobile readiness.
 *
 * Responsibilities:
 *  - Register the service worker once on mount
 *  - Apply high-contrast and reduced-motion CSS classes from settings
 *  - Show offline banner when navigator.onLine = false
 *  - Show "Add to home screen" install banner when prompted by the browser
 */

import { useEffect, useState } from 'react';
import { registerServiceWorker } from '@/lib/pwa';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { loadSettings } from '@/lib/settingsStore';

export function PWASetup() {
  const { canInstall, isInstalled, isOffline, promptInstall } = usePWAInstall();
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  // Register SW and apply accessibility classes on mount
  useEffect(() => {
    registerServiceWorker();

    const s = loadSettings();
    const html = document.documentElement;
    if (s.highContrastMode) html.classList.add('high-contrast-mode');
    else html.classList.remove('high-contrast-mode');
    if (s.reducedMotion) html.classList.add('reduced-motion');
    else html.classList.remove('reduced-motion');
  }, []);

  // Show install banner once (session-scoped dismissal)
  useEffect(() => {
    if (canInstall && !isInstalled) {
      const dismissed = typeof sessionStorage !== 'undefined'
        ? sessionStorage.getItem('dnx-install-dismissed')
        : null;
      if (!dismissed) setShowInstallBanner(true);
    }
  }, [canInstall, isInstalled]);

  const handleInstall = async () => {
    await promptInstall();
    setShowInstallBanner(false);
  };

  const handleDismiss = () => {
    setShowInstallBanner(false);
    try { sessionStorage.setItem('dnx-install-dismissed', '1'); } catch { /* ignore */ }
  };

  return (
    <>
      {/* ── Offline banner ─────────────────────────────────────────────── */}
      {isOffline && (
        <div
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
          className="fixed bottom-0 left-0 right-0 z-50 bg-amber-900/95 border-t border-amber-700 px-4 py-3 flex items-center justify-between gap-3 text-sm backdrop-blur-sm"
        >
          <div className="flex items-center gap-2">
            <span aria-hidden="true">📴</span>
            <span className="text-amber-100 font-semibold">
              You are offline — simulation mode active
            </span>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="text-amber-200 underline text-xs shrink-0 hover:text-white focus:outline-none focus:ring-2 focus:ring-amber-400 rounded"
            aria-label="Reload page to reconnect"
          >
            Try again
          </button>
        </div>
      )}

      {/* ── Install banner ─────────────────────────────────────────────── */}
      {showInstallBanner && !isOffline && (
        <div
          role="complementary"
          aria-label="Add Denarixx to home screen"
          className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900/95 border-t border-yellow-700/50 px-4 py-3 flex items-center justify-between gap-3 backdrop-blur-sm"
        >
          <div>
            <p className="text-white text-sm font-bold">Add to your home screen</p>
            <p className="text-gray-400 text-xs">Best experience on Android &amp; iPhone</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleInstall}
              className="bg-yellow-400 text-black text-sm font-bold px-3 py-1.5 rounded-lg hover:bg-yellow-300 focus:outline-none focus:ring-2 focus:ring-yellow-400"
              aria-label="Install Denarixx Vision AI as an app"
            >
              Install
            </button>
            <button
              onClick={handleDismiss}
              aria-label="Dismiss install prompt"
              className="text-gray-500 hover:text-gray-300 text-sm px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-400 rounded"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}
