'use client';

/**
 * usePWAInstall — React hook for PWA install prompt state (V10).
 *
 * Captures the BeforeInstallPromptEvent, tracks online/offline status,
 * and exposes a `promptInstall()` function.
 */

import { useCallback, useEffect, useState } from 'react';
import { isInstalledPWA } from '@/lib/pwa';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface PWAInstallState {
  /** True when the browser has made an install prompt available. */
  canInstall: boolean;
  /** True when running in standalone / installed mode. */
  isInstalled: boolean;
  /** True when navigator.onLine is false. */
  isOffline: boolean;
  /** Show the native install prompt. Returns true if accepted. */
  promptInstall: () => Promise<boolean>;
}

export function usePWAInstall(): PWAInstallState {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled]       = useState(false);
  const [isOfflineState, setIsOfflineState] = useState(false);

  useEffect(() => {
    // Initialise from current state
    setIsInstalled(isInstalledPWA());
    setIsOfflineState(typeof navigator !== 'undefined' ? !navigator.onLine : false);

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleOnline      = () => setIsOfflineState(false);
    const handleOffline     = () => setIsOfflineState(true);
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('online',              handleOnline);
    window.addEventListener('offline',             handleOffline);
    window.addEventListener('appinstalled',        handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('online',              handleOnline);
      window.removeEventListener('offline',             handleOffline);
      window.removeEventListener('appinstalled',        handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return choice.outcome === 'accepted';
  }, [deferredPrompt]);

  return {
    canInstall:   !!deferredPrompt,
    isInstalled,
    isOffline:    isOfflineState,
    promptInstall,
  };
}
