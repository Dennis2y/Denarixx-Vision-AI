/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ACCESSIBILITY_PRESETS,
  applyPreset,
  deriveAccessibilityClasses,
  accessibilityModeLabel,
} from '@/engines/accessibilityEngine';
import {
  createDefaultPreferences,
  updateAudio,
  updateHaptic,
  updateNavigation,
  updateAlert,
  updateDisplay,
  updatePersonality,
  savePreferences,
  loadPreferences,
  validatePreferences,
  toAppSettings,
} from '@/engines/userPreferenceEngine';
import { buildAudioSummary } from '@/engines/audioPreferenceEngine';
import { buildHapticSummary, getAllPatterns } from '@/engines/hapticPreferenceEngine';
import type { UserPreferences, AccessibilityMode } from '@/types/preferences';
import { PREFERENCES_PRIVACY_NOTE } from '@/types/preferences';

// ─── Tab type ─────────────────────────────────────────────────────────────────

type Tab = 'presets' | 'voice' | 'navigation' | 'alerts' | 'haptic' | 'display';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'presets', label: 'Presets', icon: '♿' },
  { id: 'voice', label: 'Voice', icon: '🔊' },
  { id: 'navigation', label: 'Navigation', icon: '🧭' },
  { id: 'alerts', label: 'Alerts', icon: '⚠️' },
  { id: 'haptic', label: 'Haptic', icon: '📳' },
  { id: 'display', label: 'Display', icon: '🖥' },
];

// ─── Slider helper ────────────────────────────────────────────────────────────

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-gray-400">{label}</span>
        <span className="text-yellow-400 font-mono font-bold">
          {format ? format(value) : value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        aria-label={label}
        className="w-full h-2 rounded-full bg-gray-700 accent-yellow-500 cursor-pointer"
      />
    </div>
  );
}

// ─── Toggle helper ────────────────────────────────────────────────────────────

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-start justify-between w-full text-left group"
    >
      <div>
        <p className="text-sm text-white font-medium">{label}</p>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <div
        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 mt-0.5 ${
          checked ? 'bg-yellow-500' : 'bg-gray-700'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </div>
    </button>
  );
}

// ─── Select helper ────────────────────────────────────────────────────────────

function Select<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm text-gray-400">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value as T)}
        aria-label={label}
        className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-500"
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ─── Row helper ───────────────────────────────────────────────────────────────

function SettingRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-4 rounded-xl border border-gray-800 bg-gray-900/60 space-y-4">
      {children}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AccessibilityPage() {
  const [prefs, setPrefs] = useState<UserPreferences>(createDefaultPreferences);
  const [activeTab, setActiveTab] = useState<Tab>('presets');
  const [saved, setSaved] = useState(false);
  const [validationMsg, setValidationMsg] = useState<string>('');

  // Load from localStorage on mount
  useEffect(() => {
    setPrefs(loadPreferences());
  }, []);

  // Apply CSS classes when display prefs change
  useEffect(() => {
    const cls = deriveAccessibilityClasses(prefs);
    const html = document.documentElement;
    const allManagedClasses = [
      'high-contrast-mode', 'reduced-motion', 'text-size-large',
      'text-size-xl', 'color-blind-friendly', 'screen-reader-mode',
    ];
    html.classList.remove(...allManagedClasses);
    cls.htmlClasses.forEach(c => html.classList.add(c));
  }, [prefs.display, prefs.accessibilityMode]);

  const handleSave = useCallback(() => {
    const validation = validatePreferences(prefs);
    if (!validation.valid) {
      setValidationMsg(validation.errors.join('; '));
      return;
    }
    savePreferences(prefs);
    setSaved(true);
    setValidationMsg('');
    setTimeout(() => setSaved(false), 2500);
  }, [prefs]);

  const handleReset = useCallback(() => {
    const defaults = createDefaultPreferences();
    setPrefs(defaults);
    savePreferences(defaults);
  }, []);

  const audioSummary = buildAudioSummary(prefs.audio);
  const hapticSummary = buildHapticSummary(prefs.haptic);
  const validation = validatePreferences(prefs);
  const hapticPatterns = getAllPatterns();

  return (
    <main className="max-w-4xl mx-auto px-4 py-10" aria-label="Accessibility and Preferences">

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Link
            href="/"
            className="text-gray-500 hover:text-white text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400 rounded"
          >
            ← Home
          </Link>
        </div>
        <h1 className="text-3xl font-black text-white mb-1">Accessibility & Preferences</h1>
        <p className="text-gray-400 text-sm">
          Personalise how Denarixx Vision AI communicates, navigates, and assists you.
        </p>
      </div>

      {/* Live summary bar */}
      <div className="rounded-xl border border-yellow-700/40 bg-yellow-950/20 p-4 mb-6 flex flex-wrap gap-4 text-xs" aria-label="Current settings summary">
        <span className="text-gray-400">
          Mode: <span className="text-white font-semibold">{accessibilityModeLabel(prefs.accessibilityMode)}</span>
        </span>
        <span className="text-gray-400">
          Voice: <span className="text-white font-semibold">{audioSummary.rateBucket} · {audioSummary.verbosityLabel} · {audioSummary.volumeLabel}</span>
        </span>
        <span className="text-gray-400">
          Haptic: <span className="text-white font-semibold">{hapticSummary.enabled ? hapticSummary.intensityLabel : 'Off'}</span>
        </span>
        <span className="text-gray-400">
          Alerts: <span className="text-white font-semibold">{prefs.alert.alertFrequency}</span>
        </span>
        <span className="text-gray-400">
          Contrast: <span className="text-white font-semibold">{prefs.display.contrastMode}</span>
        </span>
        {audioSummary.silenced && (
          <span className="text-yellow-400 font-semibold">🔇 Silenced</span>
        )}
      </div>

      {/* Validation messages */}
      {validationMsg && (
        <div role="alert" className="rounded-xl border border-red-700 bg-red-950/30 p-3 mb-4 text-sm text-red-400">
          {validationMsg}
        </div>
      )}
      {validation.warnings.length > 0 && (
        <div role="status" className="rounded-xl border border-yellow-700/40 bg-yellow-950/20 p-3 mb-4 text-sm text-yellow-400">
          ⚠ {validation.warnings[0]}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-1" role="tablist" aria-label="Settings sections">
        {TABS.map(tab => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400 ${
              activeTab === tab.id
                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-600/40'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <span aria-hidden="true">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      <div role="tabpanel" aria-label={TABS.find(t => t.id === activeTab)?.label}>

        {/* ── PRESETS ── */}
        {activeTab === 'presets' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white">Accessibility Presets</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ACCESSIBILITY_PRESETS.map(preset => {
                const isActive = prefs.accessibilityMode === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setPrefs(applyPreset(prefs, preset.id as AccessibilityMode))}
                    className={`text-left rounded-xl p-4 border transition-all focus:outline-none focus:ring-2 focus:ring-yellow-400 ${
                      isActive
                        ? 'border-yellow-600 bg-yellow-950/40'
                        : 'border-gray-700 bg-gray-900/60 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xl" aria-hidden="true">{preset.icon}</span>
                      <span className={`font-bold text-sm ${isActive ? 'text-yellow-400' : 'text-white'}`}>
                        {preset.name}
                      </span>
                      {isActive && <span className="text-xs text-yellow-500 font-semibold ml-auto">Active</span>}
                    </div>
                    <p className="text-xs text-gray-400">{preset.description}</p>
                  </button>
                );
              })}
            </div>

            {/* Companion personality */}
            <h2 className="text-lg font-bold text-white mt-6">Companion Personality</h2>
            <SettingRow>
              <Select
                label="Personality mode"
                value={prefs.personalityMode}
                options={[
                  { value: 'companion', label: '😊 Companion — warm, supportive, encouraging' },
                  { value: 'minimal', label: '⚡ Minimal — concise, alert-only' },
                  { value: 'detailed', label: '📋 Detailed — full descriptions and context' },
                  { value: 'balanced', label: '⚖ Balanced — default mix of guidance and support' },
                ]}
                onChange={v => setPrefs(updatePersonality(prefs, v as any))}
              />
            </SettingRow>

            {/* Privacy note */}
            <p className="text-xs text-gray-600 mt-4" role="note">
              🔒 {PREFERENCES_PRIVACY_NOTE}
            </p>
          </div>
        )}

        {/* ── VOICE ── */}
        {activeTab === 'voice' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white">Voice Settings</h2>
            <SettingRow>
              <Slider
                label="Speech rate"
                value={prefs.audio.speechRate}
                min={0.5}
                max={2.0}
                step={0.05}
                onChange={v => setPrefs(updateAudio(prefs, { speechRate: v }))}
                format={v => `${v.toFixed(2)}×`}
              />
              <Slider
                label="Speech volume"
                value={prefs.audio.speechVolume}
                min={0}
                max={1}
                step={0.05}
                onChange={v => setPrefs(updateAudio(prefs, { speechVolume: v }))}
                format={v => `${Math.round(v * 100)}%`}
              />
              <Slider
                label="Alert tone volume"
                value={prefs.audio.alertVolume}
                min={0}
                max={1}
                step={0.05}
                onChange={v => setPrefs(updateAudio(prefs, { alertVolume: v }))}
                format={v => `${Math.round(v * 100)}%`}
              />
            </SettingRow>

            <SettingRow>
              <Select
                label="Guidance verbosity"
                value={prefs.audio.guidanceVerbosity}
                options={[
                  { value: 'brief', label: 'Brief — 1 sentence per alert' },
                  { value: 'normal', label: 'Normal — 2 sentences per alert' },
                  { value: 'verbose', label: 'Verbose — full scene description' },
                ]}
                onChange={v => setPrefs(updateAudio(prefs, { guidanceVerbosity: v as any }))}
              />
              <Select
                label="Repeat reminders"
                value={prefs.audio.repeatReminders}
                options={[
                  { value: 'never', label: 'Never repeat' },
                  { value: 'critical_only', label: 'Repeat critical alerts only' },
                  { value: 'all_alerts', label: 'Repeat all alerts' },
                ]}
                onChange={v => setPrefs(updateAudio(prefs, { repeatReminders: v as any }))}
              />
              <Select
                label="Automatic silence"
                value={prefs.audio.automaticSilence}
                options={[
                  { value: 'never', label: 'Never silent' },
                  { value: 'auto', label: 'Auto (detect quiet environments)' },
                  { value: 'always', label: 'Always silent' },
                ]}
                onChange={v => setPrefs(updateAudio(prefs, { automaticSilence: v as any }))}
              />
              <Select
                label="Confidence announcements"
                value={prefs.audio.confidenceAnnouncements}
                options={[
                  { value: 'always', label: 'Always show confidence level' },
                  { value: 'when_low', label: 'Only when confidence is low' },
                  { value: 'never', label: 'Never show confidence' },
                ]}
                onChange={v => setPrefs(updateAudio(prefs, { confidenceAnnouncements: v as any }))}
              />
            </SettingRow>

            <SettingRow>
              <Toggle
                label="Earcon alerts"
                description="Short audio tones accompany alerts (beep = critical, ding = navigation)"
                checked={prefs.audio.earconAlerts}
                onChange={v => setPrefs(updateAudio(prefs, { earconAlerts: v }))}
              />
            </SettingRow>
          </div>
        )}

        {/* ── NAVIGATION ── */}
        {activeTab === 'navigation' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white">Navigation Settings</h2>
            <SettingRow>
              <Select
                label="Navigation detail"
                value={prefs.navigation.navigationDetail}
                options={[
                  { value: 'minimal', label: 'Minimal — turns only' },
                  { value: 'standard', label: 'Standard — turns + landmarks' },
                  { value: 'rich', label: 'Rich — full spatial awareness' },
                ]}
                onChange={v => setPrefs(updateNavigation(prefs, { navigationDetail: v as any }))}
              />
              <Select
                label="Indoor guidance style"
                value={prefs.navigation.indoorGuidanceStyle}
                options={[
                  { value: 'minimal', label: 'Minimal — room names only' },
                  { value: 'standard', label: 'Standard — path directions' },
                  { value: 'detailed', label: 'Detailed — obstacle descriptions' },
                  { value: 'spatial', label: 'Spatial — full 3D awareness' },
                ]}
                onChange={v => setPrefs(updateNavigation(prefs, { indoorGuidanceStyle: v as any }))}
              />
              <Select
                label="Outdoor guidance style"
                value={prefs.navigation.outdoorGuidanceStyle}
                options={[
                  { value: 'minimal', label: 'Minimal — compass bearing' },
                  { value: 'standard', label: 'Standard — directions + distance' },
                  { value: 'full', label: 'Full — environment descriptions' },
                  { value: 'explorer', label: 'Explorer — maximum detail' },
                ]}
                onChange={v => setPrefs(updateNavigation(prefs, { outdoorGuidanceStyle: v as any }))}
              />
              <Select
                label="Distance unit"
                value={prefs.navigation.distanceUnit}
                options={[
                  { value: 'metres', label: 'Metres' },
                  { value: 'feet', label: 'Feet' },
                  { value: 'steps', label: 'Steps' },
                ]}
                onChange={v => setPrefs(updateNavigation(prefs, { distanceUnit: v as any }))}
              />
            </SettingRow>

            <SettingRow>
              <Toggle
                label="Landmark announcements"
                description="Announce nearby landmarks, signs, and points of interest"
                checked={prefs.navigation.landmarkAnnouncements}
                onChange={v => setPrefs(updateNavigation(prefs, { landmarkAnnouncements: v }))}
              />
              <Toggle
                label="Extra crossing warnings"
                description="Always give maximum detail when approaching road crossings"
                checked={prefs.navigation.crossingExtraWarning}
                onChange={v => setPrefs(updateNavigation(prefs, { crossingExtraWarning: v }))}
              />
            </SettingRow>
          </div>
        )}

        {/* ── ALERTS ── */}
        {activeTab === 'alerts' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white">Alert Settings</h2>
            <SettingRow>
              <Select
                label="Alert frequency"
                value={prefs.alert.alertFrequency}
                options={[
                  { value: 'low', label: 'Low — critical hazards only' },
                  { value: 'medium', label: 'Medium — balanced (default)' },
                  { value: 'high', label: 'High — all hazards' },
                ]}
                onChange={v => setPrefs(updateAlert(prefs, { alertFrequency: v as any }))}
              />
              <Select
                label="Hazard sensitivity"
                value={prefs.alert.hazardSensitivity}
                options={[
                  { value: 'low', label: 'Low — only clear hazards' },
                  { value: 'medium', label: 'Medium — balanced (default)' },
                  { value: 'high', label: 'High — any possible hazard' },
                ]}
                onChange={v => setPrefs(updateAlert(prefs, { hazardSensitivity: v as any }))}
              />
            </SettingRow>

            <SettingRow>
              <Toggle
                label="Repeat critical alerts"
                description="Repeat critical hazard alerts until you acknowledge them"
                checked={prefs.alert.criticalAlertRepeat}
                onChange={v => setPrefs(updateAlert(prefs, { criticalAlertRepeat: v }))}
              />
              <Toggle
                label="Silent low-risk alerts"
                description="Never speak alerts below medium risk level"
                checked={prefs.alert.silentLowRisk}
                onChange={v => setPrefs(updateAlert(prefs, { silentLowRisk: v }))}
              />
            </SettingRow>
          </div>
        )}

        {/* ── HAPTIC ── */}
        {activeTab === 'haptic' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white">Haptic Feedback</h2>
            <SettingRow>
              <Toggle
                label="Enable vibration"
                description="Use device vibration for alerts and navigation"
                checked={prefs.haptic.hapticEnabled}
                onChange={v => setPrefs(updateHaptic(prefs, { hapticEnabled: v }))}
              />
              {prefs.haptic.hapticEnabled && (
                <Select
                  label="Vibration intensity"
                  value={prefs.haptic.vibrationIntensity}
                  options={[
                    { value: 'off', label: 'Off' },
                    { value: 'light', label: 'Light' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'strong', label: 'Strong' },
                  ]}
                  onChange={v => setPrefs(updateHaptic(prefs, { vibrationIntensity: v as any }))}
                />
              )}
            </SettingRow>

            {prefs.haptic.hapticEnabled && (
              <SettingRow>
                <Toggle
                  label="Vibrate for hazard alerts"
                  description="Vibrate when critical or high-priority hazards are detected"
                  checked={prefs.haptic.hapticForCritical}
                  onChange={v => setPrefs(updateHaptic(prefs, { hapticForCritical: v }))}
                />
                <Toggle
                  label="Vibrate for navigation"
                  description="Vibrate on turn-by-turn navigation instructions"
                  checked={prefs.haptic.hapticForNavigation}
                  onChange={v => setPrefs(updateHaptic(prefs, { hapticForNavigation: v }))}
                />
                <Toggle
                  label="Vibrate for reassurance"
                  description="Gentle pulse when companion sends a reassuring message"
                  checked={prefs.haptic.hapticForReassurance}
                  onChange={v => setPrefs(updateHaptic(prefs, { hapticForReassurance: v }))}
                />
              </SettingRow>
            )}

            {/* Pattern library */}
            <h2 className="text-base font-bold text-white mt-2">Vibration Pattern Library</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {hapticPatterns.map(p => (
                <div key={p.name} className="rounded-lg border border-gray-800 bg-gray-900/60 p-3">
                  <p className="text-sm text-white font-medium">{p.name}</p>
                  <p className="text-xs text-gray-500 font-mono mt-0.5">
                    {p.pattern.join('-')} ms · {p.intensityLabel}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── DISPLAY ── */}
        {activeTab === 'display' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white">Display Settings</h2>
            <SettingRow>
              <Select
                label="Contrast mode"
                value={prefs.display.contrastMode}
                options={[
                  { value: 'standard', label: 'Standard' },
                  { value: 'high_contrast', label: 'High Contrast' },
                  { value: 'dark_high', label: 'Dark High Contrast' },
                  { value: 'monochrome', label: 'Monochrome' },
                ]}
                onChange={v => setPrefs(updateDisplay(prefs, { contrastMode: v as any }))}
              />
              <Select
                label="Text size"
                value={prefs.display.textSize}
                options={[
                  { value: 'standard', label: 'Standard' },
                  { value: 'large', label: 'Large' },
                  { value: 'extra_large', label: 'Extra Large' },
                ]}
                onChange={v => setPrefs(updateDisplay(prefs, { textSize: v as any }))}
              />
            </SettingRow>

            <SettingRow>
              <Toggle
                label="High contrast mode"
                description="Maximum contrast between text and backgrounds"
                checked={prefs.display.highContrastMode}
                onChange={v => setPrefs(updateDisplay(prefs, { highContrastMode: v }))}
              />
              <Toggle
                label="Reduced motion"
                description="Minimise animations and transitions"
                checked={prefs.display.reducedMotion}
                onChange={v => setPrefs(updateDisplay(prefs, { reducedMotion: v }))}
              />
              <Toggle
                label="Colour-blind friendly palette"
                description="Replace red/green with accessible colour-blind-safe colours"
                checked={prefs.display.colorBlindFriendly}
                onChange={v => setPrefs(updateDisplay(prefs, { colorBlindFriendly: v }))}
              />
              <Toggle
                label="Screen reader optimised"
                description="Maximise ARIA labels and live region announcements"
                checked={prefs.display.screenReaderOptimised}
                onChange={v => setPrefs(updateDisplay(prefs, { screenReaderOptimised: v }))}
              />
            </SettingRow>
          </div>
        )}
      </div>

      {/* Save / Reset bar */}
      <div className="mt-8 flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={handleSave}
          className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold px-6 py-3 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400 min-h-12"
          aria-label="Save all preferences"
        >
          {saved ? '✓ Saved!' : 'Save preferences'}
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="border border-gray-700 hover:border-red-700 text-gray-400 hover:text-red-400 font-medium px-5 py-3 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-red-400 min-h-12"
          aria-label="Reset all preferences to defaults"
        >
          Reset to defaults
        </button>
        <p className="text-xs text-gray-600 ml-auto" role="note">
          Last updated: {prefs.lastUpdated ? new Date(prefs.lastUpdated).toLocaleString() : 'Not yet saved'}
        </p>
      </div>

      <p className="text-xs text-gray-700 mt-4" role="note">
        🔒 {PREFERENCES_PRIVACY_NOTE}
      </p>
    </main>
  );
}
