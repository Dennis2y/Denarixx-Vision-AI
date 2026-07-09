'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  createRuntimeState,
  bootGlasses,
  processRuntimeTick,
  buildRuntimeSummary,
  activateEmergencyMode,
  getStandaloneNote,
} from '@/engines/glassesRuntimeEngine';
import {
  ALWAYS_ACTIVE_FEATURES,
  PHONE_OPTIONAL_FEATURES,
} from '@/types/glassesOS';
import type { RuntimeState } from '@/types/glassesOS';

const MODE_STYLE: Record<string, string> = {
  standalone:       'border-blue-600/40 bg-blue-900/10 text-blue-300',
  'phone-companion':'border-purple-600/40 bg-purple-900/10 text-purple-300',
  'cloud-enhanced': 'border-green-600/40 bg-green-900/10 text-green-300',
  emergency:        'border-red-600/40 bg-red-900/20 text-red-300',
};

const MODE_LABEL: Record<string, string> = {
  standalone:       'Standalone Mode (Glasses Only)',
  'phone-companion':'Phone Companion Mode',
  'cloud-enhanced': 'Cloud-Enhanced Mode',
  emergency:        'Emergency Mode — Core Safety Only',
};

export default function GlassesStatusPage() {
  const [state, setState] = useState<RuntimeState>(createRuntimeState);
  const [booting, setBooting] = useState(false);
  const [phoneConnected, setPhoneConnected] = useState(false);
  const [cloudConnected, setCloudConnected] = useState(false);
  const [battery, setBattery] = useState(100);

  const handleBoot = useCallback(() => {
    setBooting(true);
    setTimeout(() => {
      setState(s => bootGlasses(s));
      setBooting(false);
    }, 1200);
  }, []);

  useEffect(() => {
    if (!state.isBooted) return;
    const id = setInterval(() => {
      setState(prev => processRuntimeTick(prev, {
        batteryPct: battery,
        temperatureC: 32,
        phoneConnected,
        cloudConnected,
      }));
    }, 3000);
    return () => clearInterval(id);
  }, [state.isBooted, battery, phoneConnected, cloudConnected]);

  const summary = buildRuntimeSummary(state);

  function handleEmergency() {
    setState(prev => activateEmergencyMode(prev).state);
  }

  const modeStyle = MODE_STYLE[state.mode] ?? MODE_STYLE.standalone;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">Glasses OS — Runtime Status</h1>
          <p className="text-gray-400 text-sm">
            Sprint 16 — Standalone Smart Glasses Operating System.
            The glasses are the primary computer. Phone and cloud are optional.
          </p>
        </div>

        {/* Mode Banner */}
        <div className={`mb-4 rounded-xl border p-4 ${modeStyle}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-base">{MODE_LABEL[state.mode]}</div>
              <div className="text-xs mt-0.5 opacity-75">
                {state.emergencyMode
                  ? 'Core safety only — all non-essential features disabled.'
                  : state.mode === 'standalone'
                  ? 'All safety features active on glasses compute module. No phone required.'
                  : state.mode === 'phone-companion'
                  ? 'Enhanced by phone companion. Glasses operate independently if phone disconnects.'
                  : 'Cloud AI enhancement active. Glasses remain safe if cloud drops.'}
              </div>
            </div>
            <div className="text-2xl">
              {state.isBooted ? (state.emergencyMode ? '🔴' : '🟢') : '⚪'}
            </div>
          </div>
        </div>

        {/* Boot */}
        {!state.isBooted ? (
          <div className="mb-6 rounded-xl border border-gray-700/50 bg-gray-800/30 p-6 text-center">
            <p className="text-gray-400 text-sm mb-3">Glasses not booted. Start the standalone OS.</p>
            <button
              onClick={handleBoot}
              disabled={booting}
              className="px-6 py-2 rounded-lg bg-blue-700 hover:bg-blue-600 text-white text-sm font-medium disabled:opacity-50"
            >
              {booting ? 'Booting glasses…' : 'Boot Glasses OS'}
            </button>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {[
                { label: 'Battery', value: `${Math.round(summary.batteryPct)}%`, sub: summary.powerLevel },
                { label: 'Sensors', value: `${summary.activeSensors}/${summary.totalSensors}`, sub: 'active' },
                { label: 'Health', value: `${summary.healthScore}%`, sub: 'device' },
                { label: 'Features', value: summary.activeFeatureCount.toString(), sub: 'active' },
              ].map(s => (
                <div key={s.label} className="rounded-lg border border-gray-700/50 bg-gray-800/40 p-3">
                  <div className="text-xs text-gray-400 mb-1">{s.label}</div>
                  <div className="text-lg font-bold text-white">{s.value}</div>
                  <div className="text-xs text-gray-500 capitalize">{s.sub}</div>
                </div>
              ))}
            </div>

            {/* Controls */}
            <div className="mb-6 rounded-xl border border-gray-700/50 bg-gray-800/30 p-5">
              <h2 className="text-sm font-semibold text-gray-300 mb-4">Simulate Connections</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-400 mb-2">Battery %</p>
                  <input
                    type="range" min={0} max={100} value={battery}
                    onChange={e => setBattery(+e.target.value)}
                    className="w-full accent-blue-500"
                  />
                  <p className="text-xs text-gray-300 mt-1">{battery}%</p>
                </div>
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-gray-400">Phone Companion</p>
                  <button
                    onClick={() => setPhoneConnected(p => !p)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      phoneConnected ? 'bg-purple-700/40 border-purple-500 text-purple-200' : 'border-gray-600 text-gray-400'
                    }`}
                  >
                    {phoneConnected ? 'Connected (Optional)' : 'Not Connected — OK'}
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-gray-400">Cloud Enhancement</p>
                  <button
                    onClick={() => setCloudConnected(c => !c)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      cloudConnected ? 'bg-green-700/40 border-green-500 text-green-200' : 'border-gray-600 text-gray-400'
                    }`}
                  >
                    {cloudConnected ? 'Connected (Optional)' : 'Not Connected — OK'}
                  </button>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-700/50">
                <button
                  onClick={handleEmergency}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-red-600/50 text-red-300 hover:bg-red-900/20"
                >
                  Activate Emergency Mode
                </button>
              </div>
            </div>

            {/* Active Features */}
            <div className="mb-4 rounded-xl border border-gray-700/50 bg-gray-800/30 p-5">
              <h2 className="text-sm font-semibold text-gray-300 mb-3">Active Features</h2>
              <div className="flex flex-wrap gap-2 mb-4">
                {state.activeFeatures.map(f => (
                  <span key={f} className={`text-xs px-2 py-1 rounded-full border ${
                    ALWAYS_ACTIVE_FEATURES.includes(f)
                      ? 'border-green-600/40 bg-green-900/10 text-green-300'
                      : 'border-gray-600/40 bg-gray-800/40 text-gray-400'
                  }`}>
                    {f}
                  </span>
                ))}
              </div>
              <div className="flex items-start gap-2 text-xs text-blue-300 rounded-lg border border-blue-700/30 bg-blue-900/10 p-3">
                <span>ℹ</span>
                <span>{getStandaloneNote()}</span>
              </div>
            </div>

            {/* Phone Optional */}
            <div className="rounded-xl border border-gray-700/50 bg-gray-800/30 p-5">
              <h2 className="text-sm font-semibold text-gray-300 mb-2">Phone-Optional Features</h2>
              <p className="text-xs text-gray-400 mb-3">These work better with a phone but are not required for safety:</p>
              <div className="flex flex-wrap gap-2">
                {PHONE_OPTIONAL_FEATURES.map(f => (
                  <span key={f} className="text-xs px-2 py-1 rounded-full border border-purple-600/30 bg-purple-900/10 text-purple-300">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
