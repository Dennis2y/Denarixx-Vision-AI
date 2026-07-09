'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  buildPowerProfile,
  classifyPowerLevel,
  estimateBatteryLifeMinutes,
  estimateDrainRate,
  getReducedPowerFeatures,
  buildPowerWarning,
  getPowerLevelColor,
  simulateBatteryTick,
} from '@/engines/glassesPowerEngine';
import {
  CRITICAL_BATTERY_PCT,
  LOW_BATTERY_PCT,
  THERMAL_THROTTLE_TEMP_C,
  ALWAYS_ACTIVE_FEATURES,
  CRITICAL_BATTERY_ANNOUNCEMENT,
} from '@/types/glassesOS';
import type { PowerProfile } from '@/types/glassesOS';

const POWER_STYLE: Record<string, string> = {
  critical: 'border-red-600/40 bg-red-900/20 text-red-300',
  low:      'border-yellow-600/40 bg-yellow-900/10 text-yellow-300',
  normal:   'border-blue-600/40 bg-blue-900/10 text-blue-300',
  high:     'border-green-700/40 bg-green-900/10 text-green-300',
  full:     'border-green-600/40 bg-green-900/10 text-green-300',
};

const FEATURES = [
  'hazard-detection', 'guardian', 'voice-guidance', 'emergency-alerts',
  'navigation', 'memory', 'companion', 'cloud-sync', 'social-awareness',
];

export default function BatteryPage() {
  const [batteryPct, setBatteryPct] = useState(100);
  const [temperatureC, setTemperatureC] = useState(28);
  const [activeFeatures, setActiveFeatures] = useState<string[]>([...ALWAYS_ACTIVE_FEATURES]);
  const [profile, setProfile] = useState<PowerProfile>(() => buildPowerProfile(100, 28, [...ALWAYS_ACTIVE_FEATURES]));
  const [simulating, setSimulating] = useState(false);

  useEffect(() => {
    setProfile(buildPowerProfile(batteryPct, temperatureC, activeFeatures));
  }, [batteryPct, temperatureC, activeFeatures]);

  const toggleFeature = useCallback((f: string) => {
    if (ALWAYS_ACTIVE_FEATURES.includes(f)) return;
    setActiveFeatures(prev =>
      prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]
    );
  }, []);

  useEffect(() => {
    if (!simulating) return;
    const id = setInterval(() => {
      setBatteryPct(prev => {
        const next = simulateBatteryTick(prev, profile.drainRatePercentPerHour, 10);
        if (next <= 0) { setSimulating(false); return 0; }
        return +next.toFixed(2);
      });
    }, 500);
    return () => clearInterval(id);
  }, [simulating, profile.drainRatePercentPerHour]);

  const warning = buildPowerWarning(batteryPct, temperatureC);
  const color = getPowerLevelColor(profile.powerLevel);
  const style = POWER_STYLE[profile.powerLevel];

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">Battery & Power Management</h1>
          <p className="text-gray-400 text-sm">
            Glasses compute module power profile. Guardian remains active as long as possible.
          </p>
        </div>

        {/* Warning Banner */}
        {warning && (
          <div className={`mb-4 rounded-lg border p-3 text-sm font-medium ${
            batteryPct <= CRITICAL_BATTERY_PCT
              ? 'border-red-600/40 bg-red-900/20 text-red-300'
              : 'border-yellow-600/40 bg-yellow-900/10 text-yellow-300'
          }`}>
            🔊 {warning}
          </div>
        )}

        {/* Power Level Card */}
        <div className={`mb-6 rounded-xl border p-5 ${style}`}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-3xl font-bold">{Math.round(batteryPct)}%</div>
              <div className="text-sm capitalize font-medium mt-0.5">{profile.powerLevel}</div>
            </div>
            <div className="text-right text-sm">
              <div className="text-gray-300">{profile.estimatedLifeMinutes} min remaining</div>
              <div className="text-xs text-gray-400 mt-1">
                Drain: {profile.drainRatePercentPerHour.toFixed(1)}%/hr
              </div>
            </div>
          </div>
          <div className="w-full bg-gray-700/40 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${color === 'green' ? 'bg-green-500' : color === 'yellow' ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${batteryPct}%` }}
            />
          </div>
          <div className="mt-2 flex gap-4 text-xs text-gray-400">
            <span>Thermal: {profile.temperatureC}°C {profile.thermalThrottle ? '⚠ Throttled' : '✓ Normal'}</span>
            <span>Thresholds: critical ≤{CRITICAL_BATTERY_PCT}% · low ≤{LOW_BATTERY_PCT}%</span>
          </div>
        </div>

        {/* Controls */}
        <div className="mb-6 rounded-xl border border-gray-700/50 bg-gray-800/30 p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Simulate</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-gray-400 block mb-2">Battery %</label>
              <input type="range" min={0} max={100} value={Math.round(batteryPct)}
                onChange={e => setBatteryPct(+e.target.value)}
                className="w-full accent-blue-500" />
              <div className="text-xs text-gray-300 mt-1">{Math.round(batteryPct)}%</div>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-2">Temperature °C</label>
              <input type="range" min={20} max={65} value={temperatureC}
                onChange={e => setTemperatureC(+e.target.value)}
                className="w-full accent-orange-500" />
              <div className="text-xs text-gray-300 mt-1">
                {temperatureC}°C {temperatureC >= THERMAL_THROTTLE_TEMP_C ? '⚠ Throttle' : '✓'}
              </div>
            </div>
          </div>
          <button
            onClick={() => setSimulating(s => !s)}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              simulating
                ? 'border-red-500 text-red-300 hover:bg-red-900/20'
                : 'border-gray-500 text-gray-300 hover:border-green-500 hover:text-green-300'
            }`}
          >
            {simulating ? 'Stop Drain Simulation' : 'Simulate Battery Drain'}
          </button>
        </div>

        {/* Active Features */}
        <div className="mb-4 rounded-xl border border-gray-700/50 bg-gray-800/30 p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">Feature Power Usage</h2>
          <div className="space-y-2">
            {FEATURES.map(f => {
              const isAlwaysOn = ALWAYS_ACTIVE_FEATURES.includes(f);
              const isActive = activeFeatures.includes(f);
              const isReduced = profile.reducedPowerFeatures.includes(f);
              return (
                <div key={f} className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
                  isReduced ? 'border-yellow-600/30 bg-yellow-900/10' :
                  isActive ? 'border-gray-600/40 bg-gray-800/30' : 'border-gray-700/30 opacity-40'
                }`}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-300 capitalize">{f.replace(/-/g, ' ')}</span>
                    {isAlwaysOn && <span className="text-xs text-green-400">always on</span>}
                    {isReduced && <span className="text-xs text-yellow-400">power-reduced</span>}
                  </div>
                  <button
                    onClick={() => toggleFeature(f)}
                    disabled={isAlwaysOn}
                    className={`text-xs px-2 py-0.5 rounded border ${
                      isAlwaysOn ? 'border-gray-600 text-gray-500 cursor-default' :
                      isActive ? 'border-blue-500 text-blue-300' : 'border-gray-600 text-gray-500'
                    }`}
                  >
                    {isAlwaysOn ? 'locked' : isActive ? 'active' : 'off'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-blue-700/30 bg-blue-900/10 p-4 text-xs text-blue-300">
          Guardian, hazard detection, voice guidance, and emergency alerts remain active at all
          power levels. These are never disabled by the power management system.
        </div>
      </div>
    </div>
  );
}
