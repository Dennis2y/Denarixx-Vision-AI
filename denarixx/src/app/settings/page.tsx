'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { loadSettings, saveSettings, resetSettings, SETTINGS_DEFAULTS } from '@/lib/settingsStore';
import type { AppSettings } from '@/lib/settingsStore';
import { resetOnboarding } from '@/components/session/OnboardingFlow';
import { usePWAInstall } from '@/hooks/usePWAInstall';

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(SETTINGS_DEFAULTS);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [saved, setSaved] = useState(false);
  const [onboardingReset, setOnboardingReset] = useState(false);
  const { canInstall, isInstalled, promptInstall } = usePWAInstall();

  // Load settings and voices from browser on mount
  useEffect(() => {
    setSettings(loadSettings());
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    if (!synth) return;

    const populate = () => setVoices(synth.getVoices().filter((v) => v.lang.startsWith('en')));
    populate();
    synth.addEventListener('voiceschanged', populate);
    return () => synth.removeEventListener('voiceschanged', populate);
  }, []);

  const update = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((s) => ({ ...s, [key]: value }));
    setSaved(false);
  }, []);

  const handleSave = useCallback(() => {
    saveSettings(settings);
    setSaved(true);
    // Apply accessibility classes immediately on save
    const html = document.documentElement;
    if (settings.highContrastMode) html.classList.add('high-contrast-mode');
    else html.classList.remove('high-contrast-mode');
    if (settings.reducedMotion) html.classList.add('reduced-motion');
    else html.classList.remove('reduced-motion');
    setTimeout(() => setSaved(false), 3000);
  }, [settings]);

  const handleReset = useCallback(() => {
    const defaults = resetSettings();
    setSettings(defaults);
    setSaved(false);
  }, []);

  const handleTestSpeech = useCallback(() => {
    if (typeof window === 'undefined') return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const utt = new SpeechSynthesisUtterance(
      'This is Denarixx Vision AI. Your voice settings are working correctly.'
    );
    utt.rate = settings.speechRate;
    utt.volume = settings.speechVolume;
    const voice = synth.getVoices().find((v) => v.name === settings.voiceName);
    if (voice) utt.voice = voice;
    synth.speak(utt);
  }, [settings]);

  const handleResetOnboarding = useCallback(() => {
    resetOnboarding();
    setOnboardingReset(true);
    setTimeout(() => setOnboardingReset(false), 3000);
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-black text-white mb-2">Settings & Accessibility</h1>
      <p className="text-gray-400 text-sm mb-8">
        Voice-first settings. All changes apply to the next session.
      </p>

      {saved && (
        <div
          className="bg-green-950 border border-green-700 text-green-300 rounded-xl p-3 mb-6 text-sm"
          role="status"
          aria-live="polite"
        >
          ✓ Settings saved to this device.
        </div>
      )}
      {onboardingReset && (
        <div
          className="bg-blue-950 border border-blue-700 text-blue-300 rounded-xl p-3 mb-6 text-sm"
          role="status"
          aria-live="polite"
        >
          ✓ Onboarding reset — you will see it again on your next visit to the Session page.
        </div>
      )}

      {/* ── Guidance Personality ─────────────────────────────────────────── */}
      <section className="mb-8" aria-labelledby="personality-heading">
        <h2 id="personality-heading" className="text-lg font-bold text-white mb-3">
          🎭 Guidance Personality
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {(['minimal', 'balanced', 'detailed', 'companion'] as const).map((p) => {
            const meta = {
              minimal:   { icon: '🔇', desc: 'Critical & high alerts only. Short, terse.' },
              balanced:  { icon: '⚖',  desc: 'Medium risk and above. Standard messages.' },
              detailed:  { icon: '📋', desc: 'All alerts. Full descriptions included.' },
              companion: { icon: '🤝', desc: 'Warm, natural tone. Calm reassurance. All alerts.' },
            }[p];
            const active = settings.guidancePersonality === p;
            return (
              <button
                key={p}
                onClick={() => update('guidancePersonality', p)}
                className={`rounded-xl border p-3 text-left transition-all focus:outline-none focus:ring-2 focus:ring-yellow-400 ${
                  active
                    ? 'bg-yellow-950/40 border-yellow-600 text-yellow-300'
                    : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500'
                }`}
                aria-pressed={active}
                aria-label={`${p} personality: ${meta.desc}`}
              >
                <span className="block text-lg mb-1" aria-hidden="true">{meta.icon}</span>
                <span className="block text-sm font-bold capitalize mb-0.5">{p}</span>
                <span className="block text-xs text-gray-400">{meta.desc}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Voice Output ─────────────────────────────────────────────────── */}
      <section className="mb-8 space-y-4" aria-labelledby="voice-heading">
        <h2 id="voice-heading" className="text-lg font-bold text-white">🔊 Voice Output</h2>

        {/* Speech Rate */}
        <Card>
          <label htmlFor="speechRate" className="block text-white font-semibold mb-1">
            Speech Rate
          </label>
          <p className="text-gray-400 text-xs mb-2">0.5 = slow · 1.0 = natural · 2.0 = fast</p>
          <div className="flex items-center gap-3">
            <input
              id="speechRate"
              type="range"
              min={0.5}
              max={2.0}
              step={0.1}
              value={settings.speechRate}
              onChange={(e) => update('speechRate', parseFloat(e.target.value))}
              className="flex-1 accent-yellow-400"
              aria-valuemin={0.5}
              aria-valuemax={2.0}
              aria-valuenow={settings.speechRate}
            />
            <span className="text-white font-mono text-sm w-10 text-right">{settings.speechRate.toFixed(1)}</span>
          </div>
        </Card>

        {/* Speech Volume */}
        <Card>
          <label htmlFor="speechVolume" className="block text-white font-semibold mb-1">
            Speech Volume
          </label>
          <p className="text-gray-400 text-xs mb-2">0 = silent · 1 = full volume</p>
          <div className="flex items-center gap-3">
            <input
              id="speechVolume"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.speechVolume}
              onChange={(e) => update('speechVolume', parseFloat(e.target.value))}
              className="flex-1 accent-yellow-400"
              aria-valuemin={0}
              aria-valuemax={1}
              aria-valuenow={settings.speechVolume}
            />
            <span className="text-white font-mono text-sm w-10 text-right">{settings.speechVolume.toFixed(2)}</span>
          </div>
        </Card>

        {/* Alert Volume */}
        <Card>
          <label htmlFor="alertVolume" className="block text-white font-semibold mb-1">
            Alert Volume
          </label>
          <p className="text-gray-400 text-xs mb-2">Separate volume level for hazard alerts</p>
          <div className="flex items-center gap-3">
            <input
              id="alertVolume"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.alertVolume}
              onChange={(e) => update('alertVolume', parseFloat(e.target.value))}
              className="flex-1 accent-yellow-400"
              aria-valuemin={0}
              aria-valuemax={1}
              aria-valuenow={settings.alertVolume}
            />
            <span className="text-white font-mono text-sm w-10 text-right">{settings.alertVolume.toFixed(2)}</span>
          </div>
        </Card>

        {/* Voice Selection */}
        <Card>
          <label htmlFor="voiceName" className="block text-white font-semibold mb-1">
            Voice
          </label>
          <p className="text-gray-400 text-xs mb-2">
            Select your preferred English voice. Availability depends on your device.
          </p>
          <select
            id="voiceName"
            value={settings.voiceName}
            onChange={(e) => update('voiceName', e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
          >
            <option value="">System default</option>
            {voices.map((v) => (
              <option key={v.name} value={v.name}>
                {v.name} ({v.lang})
              </option>
            ))}
          </select>
        </Card>

        {/* Repeat Critical Alerts */}
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-semibold mb-0.5">Repeat Critical Alerts</p>
              <p className="text-gray-400 text-xs">
                Auto-repeat critical warnings if still active after 10 seconds
              </p>
            </div>
            <button
              role="switch"
              aria-checked={settings.repeatCriticalAlerts}
              onClick={() => update('repeatCriticalAlerts', !settings.repeatCriticalAlerts)}
              className={`relative w-12 h-6 rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400 shrink-0 ${
                settings.repeatCriticalAlerts
                  ? 'bg-yellow-500 border-yellow-600'
                  : 'bg-gray-700 border-gray-600'
              }`}
              aria-label="Toggle repeat critical alerts"
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  settings.repeatCriticalAlerts ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </Card>

        {/* Test Speech */}
        <button
          onClick={handleTestSpeech}
          className="w-full py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white text-sm font-semibold hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400"
          aria-label="Play a test spoken message with current voice settings"
        >
          🔊 Test Speech
        </button>
      </section>

      {/* ── Detection Settings ──────────────────────────────────────────── */}
      <section className="mb-8 space-y-4" aria-labelledby="detection-heading">
        <h2 id="detection-heading" className="text-lg font-bold text-white">⚠ Detection Settings</h2>

        <Card>
          <label htmlFor="alertVerbosity" className="block text-white font-semibold mb-1">
            Alert Verbosity
          </label>
          <p className="text-gray-400 text-xs mb-2">How much detail is included in spoken alerts</p>
          <select
            id="alertVerbosity"
            value={settings.alertVerbosity}
            onChange={(e) => update('alertVerbosity', e.target.value as AppSettings['alertVerbosity'])}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
          >
            <option value="minimal">Minimal — short alerts only</option>
            <option value="standard">Standard — action + brief reason</option>
            <option value="full">Full — complete descriptions</option>
          </select>
        </Card>

        <Card>
          <label htmlFor="hazardSensitivity" className="block text-white font-semibold mb-1">
            Hazard Sensitivity
          </label>
          <p className="text-gray-400 text-xs mb-2">How aggressively potential hazards are flagged</p>
          <select
            id="hazardSensitivity"
            value={settings.hazardSensitivity}
            onChange={(e) => update('hazardSensitivity', e.target.value as AppSettings['hazardSensitivity'])}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
          >
            <option value="low">Low — only clear, high-confidence hazards</option>
            <option value="medium">Medium — balanced (recommended)</option>
            <option value="high">High — flag anything potentially risky</option>
          </select>
        </Card>
      </section>

      {/* ── Sensors & Privacy (V7) ──────────────────────────────────────── */}
      <section className="mb-8 space-y-4" aria-labelledby="sensors-heading">
        <h2 id="sensors-heading" className="text-lg font-bold text-white">📡 Sensors &amp; Privacy</h2>
        <p className="text-gray-500 text-xs -mt-2">
          Sensor data stays on your device. Location is approximate by default.
        </p>

        {/* Location Enable */}
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-semibold mb-0.5">Enable GPS Location</p>
              <p className="text-gray-400 text-xs">
                Use device GPS to enrich navigation. Off by default.
              </p>
            </div>
            <button
              role="switch"
              aria-checked={settings.locationEnabled}
              onClick={() => update('locationEnabled', !settings.locationEnabled)}
              className={`relative w-12 h-6 rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400 shrink-0 ${
                settings.locationEnabled
                  ? 'bg-yellow-500 border-yellow-600'
                  : 'bg-gray-700 border-gray-600'
              }`}
              aria-label="Toggle GPS location"
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  settings.locationEnabled ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </Card>

        {/* Location Precision — only shown when GPS enabled */}
        {settings.locationEnabled && (
          <Card>
            <label htmlFor="locationPrecision" className="block text-white font-semibold mb-1">
              Location Precision
            </label>
            <p className="text-gray-400 text-xs mb-2">
              Fuzzy snaps coordinates to a ~1 km grid. Precise uses exact GPS.
            </p>
            <select
              id="locationPrecision"
              value={settings.locationPrecision}
              onChange={(e) => update('locationPrecision', e.target.value as AppSettings['locationPrecision'])}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
            >
              <option value="none">None — GPS not used</option>
              <option value="fuzzy">Fuzzy — ~1 km grid (recommended)</option>
              <option value="precise">Precise — exact coordinates</option>
            </select>
          </Card>
        )}

        {/* Location Memory — only shown when GPS enabled */}
        {settings.locationEnabled && (
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-semibold mb-0.5">Save Locations to Memory</p>
                <p className="text-gray-400 text-xs">
                  Allow session locations to be stored in AI memory. Requires GPS to be enabled.
                </p>
              </div>
              <button
                role="switch"
                aria-checked={settings.locationMemoryEnabled}
                onClick={() => update('locationMemoryEnabled', !settings.locationMemoryEnabled)}
                className={`relative w-12 h-6 rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400 shrink-0 ${
                  settings.locationMemoryEnabled
                    ? 'bg-yellow-500 border-yellow-600'
                    : 'bg-gray-700 border-gray-600'
                }`}
                aria-label="Toggle location memory"
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    settings.locationMemoryEnabled ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </Card>
        )}

        {/* Motion */}
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-semibold mb-0.5">Motion Sensors</p>
              <p className="text-gray-400 text-xs">
                Use accelerometer and compass to detect walking, turning, and speed.
              </p>
            </div>
            <button
              role="switch"
              aria-checked={settings.motionEnabled}
              onClick={() => update('motionEnabled', !settings.motionEnabled)}
              className={`relative w-12 h-6 rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400 shrink-0 ${
                settings.motionEnabled
                  ? 'bg-yellow-500 border-yellow-600'
                  : 'bg-gray-700 border-gray-600'
              }`}
              aria-label="Toggle motion sensors"
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  settings.motionEnabled ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </Card>

        {/* Vibration */}
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-semibold mb-0.5">Haptic Alerts</p>
              <p className="text-gray-400 text-xs">
                Vibrate the device for critical and high-urgency alerts.
              </p>
            </div>
            <button
              role="switch"
              aria-checked={settings.vibrationEnabled}
              onClick={() => update('vibrationEnabled', !settings.vibrationEnabled)}
              className={`relative w-12 h-6 rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400 shrink-0 ${
                settings.vibrationEnabled
                  ? 'bg-yellow-500 border-yellow-600'
                  : 'bg-gray-700 border-gray-600'
              }`}
              aria-label="Toggle haptic alerts"
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  settings.vibrationEnabled ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </Card>

        {/* Battery-aware */}
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-semibold mb-0.5">Battery-Aware Mode</p>
              <p className="text-gray-400 text-xs">
                Reduce scan frequency and audio when battery drops below 20%.
              </p>
            </div>
            <button
              role="switch"
              aria-checked={settings.batteryAwareMode}
              onClick={() => update('batteryAwareMode', !settings.batteryAwareMode)}
              className={`relative w-12 h-6 rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400 shrink-0 ${
                settings.batteryAwareMode
                  ? 'bg-yellow-500 border-yellow-600'
                  : 'bg-gray-700 border-gray-600'
              }`}
              aria-label="Toggle battery-aware mode"
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  settings.batteryAwareMode ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </Card>
      </section>

      {/* ── Actions ─────────────────────────────────────────────────────── */}
      <div className="flex gap-3 mb-6">
        <Button onClick={handleSave} size="lg" className="flex-1">
          Save Settings
        </Button>
        <button
          onClick={handleReset}
          className="px-4 py-2 rounded-xl border border-gray-700 text-gray-400 text-sm font-semibold hover:border-gray-500 hover:text-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
          aria-label="Reset all settings to defaults"
        >
          Reset Defaults
        </button>
      </div>

      {/* ── V10: Mobile & Accessibility ──────────────────────────────────── */}
      <section className="mb-8 space-y-4" aria-labelledby="mobile-heading">
        <h2 id="mobile-heading" className="text-lg font-bold text-white">📱 Mobile &amp; Accessibility</h2>
        <p className="text-gray-500 text-xs -mt-2">
          V10 settings for mobile deployment. Changes apply after Save.
        </p>

        {/* High Contrast Mode */}
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-semibold mb-0.5">High Contrast Mode</p>
              <p className="text-gray-400 text-xs">
                Increase text and background contrast for low-vision users.
              </p>
            </div>
            <button
              role="switch"
              aria-checked={settings.highContrastMode}
              onClick={() => update('highContrastMode', !settings.highContrastMode)}
              className={`relative w-12 h-6 rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400 shrink-0 ${
                settings.highContrastMode
                  ? 'bg-yellow-500 border-yellow-600'
                  : 'bg-gray-700 border-gray-600'
              }`}
              aria-label="Toggle high contrast mode"
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  settings.highContrastMode ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </Card>

        {/* Reduced Motion */}
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-semibold mb-0.5">Reduced Motion</p>
              <p className="text-gray-400 text-xs">
                Disable all animations and transitions. Helps with motion sensitivity.
              </p>
            </div>
            <button
              role="switch"
              aria-checked={settings.reducedMotion}
              onClick={() => update('reducedMotion', !settings.reducedMotion)}
              className={`relative w-12 h-6 rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400 shrink-0 ${
                settings.reducedMotion
                  ? 'bg-yellow-500 border-yellow-600'
                  : 'bg-gray-700 border-gray-600'
              }`}
              aria-label="Toggle reduced motion"
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  settings.reducedMotion ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </Card>

        {/* Fullscreen Walking Mode */}
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-semibold mb-0.5">Fullscreen Walking Mode</p>
              <p className="text-gray-400 text-xs">
                Auto-enter fullscreen with large emergency stop button when session starts.
              </p>
            </div>
            <button
              role="switch"
              aria-checked={settings.fullscreenWalkingMode}
              onClick={() => update('fullscreenWalkingMode', !settings.fullscreenWalkingMode)}
              className={`relative w-12 h-6 rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400 shrink-0 ${
                settings.fullscreenWalkingMode
                  ? 'bg-yellow-500 border-yellow-600'
                  : 'bg-gray-700 border-gray-600'
              }`}
              aria-label="Toggle fullscreen walking mode"
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  settings.fullscreenWalkingMode ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </Card>

        {/* PWA Install */}
        {canInstall && !isInstalled && (
          <Card>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-white font-semibold mb-0.5">Add to Home Screen</p>
                <p className="text-gray-400 text-xs">
                  Install Denarixx as an app for the best experience on Android and iPhone.
                </p>
              </div>
              <button
                onClick={() => promptInstall()}
                className="shrink-0 px-4 py-2 rounded-xl bg-yellow-500 text-black font-bold text-sm hover:bg-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                aria-label="Install Denarixx Vision AI as an app"
              >
                Install
              </button>
            </div>
          </Card>
        )}

        {isInstalled && (
          <div className="bg-green-950/50 border border-green-800 rounded-xl p-3 text-green-300 text-sm">
            ✓ Denarixx is installed as an app on this device.
          </div>
        )}
      </section>

      {/* ── Accessibility Notes ─────────────────────────────────────────── */}
      <Card className="mb-6">
        <CardHeader><CardTitle>Accessibility Notes</CardTitle></CardHeader>
        <ul className="text-gray-400 text-sm space-y-1 list-disc list-inside">
          <li>Full keyboard navigation — Tab to move, Enter/Space to activate</li>
          <li>High-contrast mode uses yellow highlights for focus indicators</li>
          <li>All interactive elements have screen reader labels</li>
          <li>Audio alerts use priority queuing — critical alerts always interrupt</li>
          <li>Voice commands work in Chrome and Edge (not Firefox/Safari)</li>
          <li>Reduced motion disables all CSS transitions and animations</li>
          <li>Walking Mode shows a large emergency stop button for one-thumb use</li>
        </ul>
      </Card>

      {/* ── Onboarding ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader><CardTitle>Onboarding</CardTitle></CardHeader>
        <p className="text-gray-400 text-sm mb-3">
          Re-play the audio-first introduction shown on your first visit.
        </p>
        <button
          onClick={handleResetOnboarding}
          className="px-4 py-2 rounded-xl border border-gray-700 text-gray-300 text-sm font-semibold hover:border-gray-500 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400"
          aria-label="Reset onboarding so it shows again on next session page visit"
        >
          Re-show Onboarding on Next Visit
        </button>
      </Card>
    </div>
  );
}
