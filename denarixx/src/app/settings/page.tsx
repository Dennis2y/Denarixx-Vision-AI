'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface Preference {
  key: string;
  label: string;
  description: string;
  type: 'range' | 'select' | 'toggle';
  value: string;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
}

const DEFAULTS: Preference[] = [
  {
    key: 'speechRate',
    label: 'Speech Rate',
    description: 'Speed of audio narration (0.5 = slow, 2.0 = fast)',
    type: 'range',
    value: '1.0',
    min: 0.5,
    max: 2.0,
    step: 0.1,
  },
  {
    key: 'speechVolume',
    label: 'Speech Volume',
    description: '0 = silent, 1 = full volume',
    type: 'range',
    value: '1.0',
    min: 0,
    max: 1,
    step: 0.1,
  },
  {
    key: 'alertVerbosity',
    label: 'Alert Verbosity',
    description: 'How much detail is included in spoken alerts',
    type: 'select',
    value: 'full',
    options: ['minimal', 'standard', 'full'],
  },
  {
    key: 'hazardSensitivity',
    label: 'Hazard Sensitivity',
    description: 'How aggressively the system flags potential hazards',
    type: 'select',
    value: 'medium',
    options: ['low', 'medium', 'high'],
  },
  {
    key: 'theme',
    label: 'Theme',
    description: 'Visual theme',
    type: 'select',
    value: 'high-contrast',
    options: ['dark', 'high-contrast'],
  },
];

export default function SettingsPage() {
  const [prefs, setPrefs] = useState(DEFAULTS);
  const [saved, setSaved] = useState(false);

  const update = (key: string, value: string) => {
    setPrefs((p) => p.map((x) => (x.key === key ? { ...x, value } : x)));
    setSaved(false);
  };

  const save = () => {
    // In production: POST to /api/preferences
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-black text-white mb-2">Settings & Accessibility</h1>
      <p className="text-gray-400 text-sm mb-8">
        All settings are voice-first. Adjust speech, sensitivity, and visual preferences.
      </p>

      {saved && (
        <div className="bg-green-950 border border-green-700 text-green-300 rounded-xl p-3 mb-6 text-sm" role="status" aria-live="polite">
          ✓ Settings saved.
        </div>
      )}

      <div className="space-y-4 mb-6">
        {prefs.map((pref) => (
          <Card key={pref.key}>
            <label
              htmlFor={`pref-${pref.key}`}
              className="block text-white font-semibold mb-1"
            >
              {pref.label}
            </label>
            <p className="text-gray-400 text-xs mb-2">{pref.description}</p>

            {pref.type === 'range' && (
              <div className="flex items-center gap-3">
                <input
                  id={`pref-${pref.key}`}
                  type="range"
                  min={pref.min}
                  max={pref.max}
                  step={pref.step}
                  value={pref.value}
                  onChange={(e) => update(pref.key, e.target.value)}
                  className="flex-1 accent-yellow-400"
                  aria-valuemin={pref.min}
                  aria-valuemax={pref.max}
                  aria-valuenow={parseFloat(pref.value)}
                />
                <span className="text-white font-mono text-sm w-10 text-right">
                  {pref.value}
                </span>
              </div>
            )}

            {pref.type === 'select' && (
              <select
                id={`pref-${pref.key}`}
                value={pref.value}
                onChange={(e) => update(pref.key, e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
              >
                {pref.options?.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            )}
          </Card>
        ))}
      </div>

      <Button onClick={save} size="lg" fullWidth>Save Settings</Button>

      <Card className="mt-8 border-gray-700">
        <CardHeader><CardTitle>Accessibility Notes</CardTitle></CardHeader>
        <ul className="text-gray-400 text-sm space-y-1 list-disc list-inside">
          <li>Full keyboard navigation — Tab to move, Enter/Space to activate</li>
          <li>High-contrast mode uses yellow highlights for focus indicators</li>
          <li>All interactive elements have screen reader labels</li>
          <li>Skip to main content link at top of every page</li>
          <li>Audio alerts use priority queuing — critical alerts always interrupt</li>
        </ul>
      </Card>
    </div>
  );
}
