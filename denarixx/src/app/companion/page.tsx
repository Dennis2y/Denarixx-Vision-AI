'use client';

import { useState, useCallback, useEffect } from 'react';
import type {
  PersonalityMode,
  SpeechRate,
  SpeechAmount,
  AlertFrequency,
  NavigationDetail,
  ConfidenceAnnouncements,
  CompanionProfile,
} from '@/types/companion';
import {
  COMPANION_DEFAULTS,
  PERSONALITY_DESCRIPTORS,
  COMPANION_PRIVACY_NOTE,
} from '@/types/companion';
import { buildPreviewSample } from '@/engines/companionPersonalityEngine';
import { speechRateLabel, speechAmountLabel } from '@/engines/speechAdaptationEngine';
import { loadSettings, saveSettings } from '@/lib/settingsStore';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function speak(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.rate = 1.0;
  window.speechSynthesis.speak(utt);
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900 p-5 mb-5">
      <h2 className="text-base font-bold text-white mb-4">{title}</h2>
      {children}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CompanionPage() {
  const [profile, setProfile] = useState<CompanionProfile>(COMPANION_DEFAULTS);
  const [saved, setSaved] = useState(false);
  const [previewText, setPreviewText] = useState<string | null>(null);

  // Load existing settings on mount
  useEffect(() => {
    const s = loadSettings();
    setProfile(prev => ({
      ...prev,
      mode: (s.guidancePersonality as PersonalityMode) ?? prev.mode,
      speechRate: s.speechRate >= 1.3 ? 'fast' : s.speechRate <= 0.8 ? 'slow' : 'normal',
      speechAmount:
        s.alertVerbosity === 'minimal' ? 'brief'
        : s.alertVerbosity === 'full' ? 'verbose'
        : 'normal',
    }));
  }, []);

  const update = useCallback(<K extends keyof CompanionProfile>(key: K, value: CompanionProfile[K]) => {
    setProfile(prev => {
      const next = { ...prev, [key]: value };
      if (next.previewMode) {
        if (key === 'mode') {
          setPreviewText(buildPreviewSample(value as PersonalityMode));
        }
      }
      return next;
    });
    setSaved(false);
  }, []);

  const handleSave = useCallback(() => {
    const current = loadSettings();
    const rateNum = profile.speechRate === 'slow' ? 0.75 : profile.speechRate === 'fast' ? 1.4 : 1.0;
    const verbosity =
      profile.speechAmount === 'brief' ? 'minimal'
      : profile.speechAmount === 'verbose' ? 'full'
      : 'standard';
    saveSettings({
      ...current,
      guidancePersonality: profile.mode,
      speechRate: rateNum,
      alertVerbosity: verbosity,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }, [profile]);

  const handlePreview = useCallback(() => {
    const sample = buildPreviewSample(profile.mode);
    setPreviewText(sample);
    speak(sample);
  }, [profile.mode]);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-7">
        <h1 className="text-3xl font-black text-white mb-1">Companion Settings</h1>
        <p className="text-gray-500 text-sm">
          Personalise how Denarixx speaks, guides, and adapts to your surroundings.
        </p>
      </div>

      {/* ── Personality Mode ── */}
      <Section title="Personality Mode">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PERSONALITY_DESCRIPTORS.map(desc => (
            <button
              key={desc.mode}
              onClick={() => update('mode', desc.mode)}
              className={`text-left p-4 rounded-xl border transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400
                ${profile.mode === desc.mode
                  ? 'border-yellow-500 bg-yellow-950/40 text-white'
                  : 'border-gray-700 bg-gray-800/50 text-gray-300 hover:border-gray-500'}`}
              aria-pressed={profile.mode === desc.mode}
            >
              <p className="font-bold text-sm mb-1">{desc.label}</p>
              <p className="text-xs text-gray-400 mb-2">{desc.description}</p>
              <p className="text-xs italic text-gray-500">&ldquo;{desc.example}&rdquo;</p>
            </button>
          ))}
        </div>

        {/* Preview */}
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handlePreview}
            className="px-4 py-2 rounded-lg border border-blue-700 bg-blue-950/40 text-blue-300 text-sm font-semibold
              hover:bg-blue-950/70 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors"
          >
            ▶ Preview Voice
          </button>
          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={profile.previewMode}
              onChange={e => update('previewMode', e.target.checked)}
              className="accent-yellow-400"
            />
            Auto-preview on change
          </label>
        </div>

        {previewText && (
          <div className="mt-3 rounded-lg bg-gray-800 border border-gray-700 p-3">
            <p className="text-xs text-gray-400 mb-1">Preview text</p>
            <p className="text-sm text-white italic">&ldquo;{previewText}&rdquo;</p>
          </div>
        )}
      </Section>

      {/* ── Speech Rate ── */}
      <Section title="Speech Rate">
        <div className="flex gap-3 flex-wrap">
          {(['slow', 'normal', 'fast'] as SpeechRate[]).map(rate => (
            <button
              key={rate}
              onClick={() => update('speechRate', rate)}
              className={`px-4 py-2 rounded-lg border text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400
                ${profile.speechRate === rate
                  ? 'border-yellow-500 bg-yellow-950/40 text-white'
                  : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-500'}`}
              aria-pressed={profile.speechRate === rate}
            >
              {speechRateLabel(rate)}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Critical alerts always use normal or fast speed for clarity.
        </p>
      </Section>

      {/* ── Speech Amount ── */}
      <Section title="Speech Amount">
        <div className="flex gap-3 flex-wrap">
          {(['brief', 'normal', 'verbose'] as SpeechAmount[]).map(amount => (
            <button
              key={amount}
              onClick={() => update('speechAmount', amount)}
              className={`px-4 py-2 rounded-lg border text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400
                ${profile.speechAmount === amount
                  ? 'border-yellow-500 bg-yellow-950/40 text-white'
                  : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-500'}`}
              aria-pressed={profile.speechAmount === amount}
            >
              {speechAmountLabel(amount)}
            </button>
          ))}
        </div>
      </Section>

      {/* ── Alert Frequency ── */}
      <Section title="Alert Frequency">
        <div className="flex gap-3 flex-wrap">
          {(['low', 'medium', 'high'] as AlertFrequency[]).map(freq => (
            <button
              key={freq}
              onClick={() => update('alertFrequency', freq)}
              className={`px-4 py-2 rounded-lg border text-sm font-semibold capitalize transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400
                ${profile.alertFrequency === freq
                  ? 'border-yellow-500 bg-yellow-950/40 text-white'
                  : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-500'}`}
              aria-pressed={profile.alertFrequency === freq}
            >
              {freq}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Context adapts this automatically — crossings always increase frequency.
        </p>
      </Section>

      {/* ── Navigation Detail ── */}
      <Section title="Navigation Detail">
        <div className="flex gap-3 flex-wrap">
          {([
            { value: 'minimal', label: 'Minimal — turn instructions only' },
            { value: 'standard', label: 'Standard — distance + turn' },
            { value: 'rich', label: 'Rich — landmarks + context' },
          ] as { value: NavigationDetail; label: string }[]).map(({ value, label }) => (
            <button
              key={value}
              onClick={() => update('navigationDetail', value)}
              className={`px-4 py-2 rounded-lg border text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400
                ${profile.navigationDetail === value
                  ? 'border-yellow-500 bg-yellow-950/40 text-white'
                  : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-500'}`}
              aria-pressed={profile.navigationDetail === value}
            >
              {label}
            </button>
          ))}
        </div>
      </Section>

      {/* ── Confidence Announcements ── */}
      <Section title="Confidence Announcements">
        <div className="flex gap-3 flex-wrap">
          {([
            { value: 'always', label: 'Always' },
            { value: 'when_low', label: 'Only when uncertain' },
            { value: 'never', label: 'Never' },
          ] as { value: ConfidenceAnnouncements; label: string }[]).map(({ value, label }) => (
            <button
              key={value}
              onClick={() => update('confidenceAnnouncements', value)}
              className={`px-4 py-2 rounded-lg border text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400
                ${profile.confidenceAnnouncements === value
                  ? 'border-yellow-500 bg-yellow-950/40 text-white'
                  : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-500'}`}
              aria-pressed={profile.confidenceAnnouncements === value}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          When on, Denarixx says &ldquo;Moderate confidence&rdquo; or &ldquo;Low confidence&rdquo; before uncertain guidance.
        </p>
      </Section>

      {/* ── Toggles ── */}
      <Section title="Behaviour Options">
        <div className="space-y-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={profile.autoRepeat}
              onChange={e => update('autoRepeat', e.target.checked)}
              className="mt-0.5 accent-yellow-400"
            />
            <div>
              <p className="text-sm text-white font-semibold">Auto-repeat critical alerts</p>
              <p className="text-xs text-gray-500">Critical alerts repeat after 8 s if session is still active.</p>
            </div>
          </label>
        </div>
      </Section>

      {/* ── Context Adaptation Info ── */}
      <Section title="Automatic Context Adaptation">
        <div className="space-y-2 text-sm text-gray-400">
          <p>Denarixx automatically adjusts guidance based on your environment:</p>
          <ul className="list-disc pl-5 space-y-1 text-xs">
            <li>🚦 <strong className="text-white">Road crossings</strong> — always high frequency, adds safety check</li>
            <li>🌙 <strong className="text-white">Poor lighting</strong> — extra detail, warns of low visibility</li>
            <li>👥 <strong className="text-white">Crowded areas</strong> — shorter messages to reduce cognitive load</li>
            <li>🏠 <strong className="text-white">Indoors</strong> — standard settings</li>
            <li>🤫 <strong className="text-white">Quiet areas</strong> — less frequent, more relaxed tone</li>
          </ul>
          <p className="text-xs text-gray-500 mt-2">
            Your chosen personality is always the baseline — context adjusts on top of it.
          </p>
        </div>
      </Section>

      {/* ── Privacy ── */}
      <div className="rounded-xl border border-blue-800/50 bg-blue-950/20 p-4 mb-5 flex gap-3">
        <span className="text-blue-400 shrink-0 mt-0.5" aria-hidden="true">ℹ</span>
        <p className="text-xs text-blue-300">{COMPANION_PRIVACY_NOTE}</p>
      </div>

      {/* ── Save ── */}
      <button
        onClick={handleSave}
        className="w-full py-3 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black font-black text-base
          focus:outline-none focus:ring-4 focus:ring-yellow-400 transition-colors"
        aria-label="Save companion settings"
      >
        {saved ? '✓ Saved' : 'Save Settings'}
      </button>

      <p className="text-center text-xs text-gray-600 mt-3">
        Settings are stored locally on this device only.
      </p>
    </div>
  );
}
