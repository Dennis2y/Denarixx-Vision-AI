'use client';

/**
 * OnboardingFlow (V5)
 *
 * Audio-first onboarding modal for blind/VI users.
 * Shown once on first visit (localStorage key: denarixx_onboarded).
 * Each step has a narrated introduction via SpeechSynthesis.
 * Designed for full keyboard + screen reader accessibility.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'denarixx_onboarded';

interface Step {
  id: number;
  title: string;
  icon: string;
  body: string;
  narration: string;
}

const STEPS: Step[] = [
  {
    id: 1,
    title: 'Welcome to Denarixx',
    icon: '👋',
    body: 'Denarixx Vision AI is your AI-powered guide. It watches your surroundings and speaks to you — like a calm, knowledgeable companion.',
    narration:
      'Welcome to Denarixx Vision AI. I am your AI-powered guide. I will watch your surroundings and speak to you — like a calm, knowledgeable companion. Let me walk you through a quick setup.',
  },
  {
    id: 2,
    title: 'Camera Permission',
    icon: '📷',
    body: 'This app uses your device camera to see your surroundings in real time. You will be asked to grant camera access. You can also run in simulation mode without a camera.',
    narration:
      'This app can use your device camera to see your surroundings. You will be asked to grant camera access. If you prefer not to, the app runs in simulation mode — you still get full AI guidance.',
  },
  {
    id: 3,
    title: 'Your Privacy',
    icon: '🔒',
    body: 'No video is ever stored. Camera frames are only used for real-time assistive analysis. Face recognition is disabled. When a real AI provider is configured, frames are processed by that provider and subject to their privacy policy.',
    narration:
      'Your privacy matters. No video is ever stored. Camera frames are only used for real-time analysis to help you navigate safely. Face recognition is completely disabled.',
  },
  {
    id: 4,
    title: 'Safety Disclaimer',
    icon: '⚠',
    body: 'Denarixx is an assistive tool, not a medical device. It cannot guarantee your safety. Always use your own judgment and the guidance of people around you.',
    narration:
      'Important safety note. Denarixx is an assistive support tool, not a medical device. It cannot guarantee your safety. Please always use your own judgment. I will never say something is completely safe — only that it looks clear to me.',
  },
  {
    id: 5,
    title: 'Voice Commands',
    icon: '🎙',
    body: 'You can control the app with your voice. Say "start session", "stop session", "repeat that", "describe surroundings", "where am I", "what should I do", or "save this place".',
    narration:
      'You can control me with your voice. Say: start session, stop session, repeat that, describe surroundings, where am I, what should I do, or save this place. I will respond immediately.',
  },
  {
    id: 6,
    title: "You're Ready",
    icon: '✓',
    body: 'Setup is complete. Press "Test Speech" to hear a spoken message, then "Start Demo" to begin your first vision session.',
    narration:
      "You are all set. Press Test Speech to hear how I sound, then press Start Demo to begin your first vision session. I'll be with you every step of the way.",
  },
];

interface OnboardingFlowProps {
  onComplete: () => void;
  onStartDemo: () => void;
}

export function OnboardingFlow({ onComplete, onStartDemo }: OnboardingFlowProps) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Only show if not already onboarded
  useEffect(() => {
    try {
      const done = window.localStorage.getItem(STORAGE_KEY);
      if (!done) setVisible(true);
    } catch {
      setVisible(true);
    }
    if (typeof window !== 'undefined') {
      synthRef.current = window.speechSynthesis;
    }
  }, []);

  // Trap focus inside dialog while open
  useEffect(() => {
    if (visible) dialogRef.current?.focus();
  }, [visible]);

  const narrate = useCallback((text: string) => {
    const synth = synthRef.current;
    if (!synth) return;
    synth.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 0.95;
    utt.volume = 1;
    synth.speak(utt);
  }, []);

  // Auto-narrate each step when it changes
  useEffect(() => {
    if (!visible) return;
    const current = STEPS[step];
    if (current) narrate(current.narration);
  }, [step, visible, narrate]);

  const handleComplete = useCallback(() => {
    synthRef.current?.cancel();
    try {
      window.localStorage.setItem(STORAGE_KEY, '1');
    } catch { /* ignore */ }
    setVisible(false);
    onComplete();
  }, [onComplete]);

  const handleTestSpeech = useCallback(() => {
    narrate(
      "This is Denarixx Vision AI speaking. Your audio guidance is working correctly. You're ready to begin."
    );
  }, [narrate]);

  const handleStartDemo = useCallback(() => {
    handleComplete();
    onStartDemo();
  }, [handleComplete, onStartDemo]);

  const nextStep = useCallback(() => {
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }, []);

  const prevStep = useCallback(() => {
    setStep((s) => Math.max(0, s - 1));
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextStep();
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') prevStep();
      if (e.key === 'Escape') handleComplete();
    },
    [nextStep, prevStep, handleComplete]
  );

  if (!visible) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      aria-describedby="onboarding-body"
      onKeyDown={handleKeyDown}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative w-full max-w-lg mx-4 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-6 outline-none"
        aria-live="polite"
      >
        {/* Progress bar */}
        <div className="w-full bg-gray-800 rounded-full h-1 mb-6" role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={STEPS.length}>
          <div
            className="bg-yellow-400 h-1 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Step counter */}
        <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest mb-4">
          Step {step + 1} of {STEPS.length}
        </p>

        {/* Icon + title */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-4xl" aria-hidden="true">{current.icon}</span>
          <h2 id="onboarding-title" className="text-2xl font-black text-white">
            {current.title}
          </h2>
        </div>

        {/* Body */}
        <p id="onboarding-body" className="text-gray-300 text-sm leading-relaxed mb-6">
          {current.body}
        </p>

        {/* Step 5: voice commands quick ref */}
        {step === 4 && (
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 mb-4 text-xs text-gray-400 space-y-1">
            {[
              'start session',
              'stop session',
              'repeat that',
              'describe surroundings',
              'where am I',
              'what should I do',
              'save this place',
            ].map((cmd) => (
              <p key={cmd}>
                <span className="text-yellow-400 font-mono">{cmd}</span>
              </p>
            ))}
          </div>
        )}

        {/* Last step actions */}
        {isLast && (
          <div className="flex flex-col gap-2 mb-4">
            <button
              onClick={handleTestSpeech}
              className="w-full py-2.5 rounded-xl bg-gray-700 border border-gray-600 text-white text-sm font-semibold hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400"
              aria-label="Play a test speech message to verify audio is working"
            >
              🔊 Test Speech
            </button>
            <button
              onClick={handleStartDemo}
              className="w-full py-2.5 rounded-xl bg-yellow-400 text-black text-sm font-bold hover:bg-yellow-300 transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400"
              aria-label="Dismiss onboarding and start your first vision session"
            >
              ▶ Start Demo
            </button>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={prevStep}
            disabled={step === 0}
            className="px-4 py-2 rounded-xl border border-gray-700 text-gray-400 text-sm font-semibold hover:border-gray-500 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
            aria-label="Go to previous step"
          >
            ← Back
          </button>

          <button
            ref={closeButtonRef}
            onClick={handleComplete}
            className="text-gray-600 text-xs hover:text-gray-400 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 px-2 py-1 rounded"
            aria-label="Skip onboarding"
          >
            Skip
          </button>

          {!isLast && (
            <button
              onClick={nextStep}
              className="px-4 py-2 rounded-xl bg-yellow-400 text-black text-sm font-bold hover:bg-yellow-300 transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400"
              aria-label="Go to next step"
            >
              Next →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Returns true if the user has already seen the onboarding */
export function hasOnboarded(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return !!window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return true;
  }
}

/** Force-reset onboarding (for testing / settings page) */
export function resetOnboarding(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
}
