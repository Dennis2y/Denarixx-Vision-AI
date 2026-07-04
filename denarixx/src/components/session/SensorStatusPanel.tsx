'use client';

/**
 * SensorStatusPanel (V7)
 *
 * Shows live status of all phone sensors:
 *   GPS, Compass, Motion state, Battery, Low-power mode.
 * Provides one-click permission request buttons for sensors.
 */

import type { SensorContext, PermissionStatus } from '@/types/sensors';
import { LocationPrivacyEngine } from '@/engines/locationPrivacyEngine';
import { SensorFusionEngine } from '@/engines/sensorFusionEngine';
import type { LocationPrivacyLevel } from '@/types/sensors';

interface SensorStatusPanelProps {
  sensorContext: SensorContext;
  locationPrecision: LocationPrivacyLevel;
  onRequestGPS: () => void;
  onRequestMotion: () => Promise<void>;
  onStopGPS: () => void;
  isActive: boolean;
}

const privacyEngine = new LocationPrivacyEngine();
const fusionEngine = new SensorFusionEngine();

// ─── Permission badge ─────────────────────────────────────────────────────────

function PermBadge({ status }: { status: PermissionStatus | boolean }) {
  if (typeof status === 'boolean') {
    return status
      ? <span className="text-xs text-green-400 font-semibold">Available</span>
      : <span className="text-xs text-gray-600">Unavailable</span>;
  }
  const cfg: Record<PermissionStatus, { label: string; color: string }> = {
    granted:     { label: 'Active',       color: 'text-green-400' },
    denied:      { label: 'Denied',       color: 'text-red-400' },
    prompt:      { label: 'Not started',  color: 'text-gray-500' },
    unavailable: { label: 'Unavailable',  color: 'text-gray-700' },
  };
  const c = cfg[status];
  return <span className={`text-xs font-semibold ${c.color}`}>{c.label}</span>;
}

// ─── Battery bar ──────────────────────────────────────────────────────────────

function BatteryBar({ level, charging }: { level: number; charging: boolean }) {
  const pct = Math.round(level * 100);
  const color =
    level < 0.2 ? 'bg-red-500' :
    level < 0.4 ? 'bg-yellow-500' :
    'bg-green-500';

  return (
    <div className="flex items-center gap-2">
      <div className="relative w-20 h-3 bg-gray-800 rounded-full border border-gray-700 overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-400">
        {pct}%{charging ? ' ⚡' : ''}
      </span>
    </div>
  );
}

// ─── Motion state badge ───────────────────────────────────────────────────────

function MotionBadge({ state }: { state: SensorContext['motionState'] }) {
  const cfg = {
    walking:  { color: 'text-blue-400 bg-blue-950/40 border-blue-800/50',  icon: '🚶' },
    running:  { color: 'text-orange-400 bg-orange-950/40 border-orange-700/50', icon: '🏃' },
    standing: { color: 'text-gray-400 bg-gray-800/50 border-gray-700',     icon: '⬛' },
    turning:  { color: 'text-yellow-400 bg-yellow-950/40 border-yellow-700/50', icon: '↩' },
    riding:   { color: 'text-purple-400 bg-purple-950/40 border-purple-800/50', icon: '🚗' },
    unknown:  { color: 'text-gray-600 bg-gray-900 border-gray-800',         icon: '?' },
  };
  const c = cfg[state];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${c.color}`}>
      <span aria-hidden="true">{c.icon}</span>
      {fusionEngine.describeMotionState(state)}
    </span>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function SensorStatusPanel({
  sensorContext,
  locationPrecision,
  onRequestGPS,
  onRequestMotion,
  onStopGPS,
  isActive,
}: SensorStatusPanelProps) {
  const { permissions, gps, compass, motionState, battery, headingDegrees, isLowPowerMode } = sensorContext;

  const fuzzedLocation = gps ? privacyEngine.filter(gps, locationPrecision) : null;
  const compassDir = headingDegrees !== null ? fusionEngine.headingToDirection(headingDegrees) : null;

  const gpsGranted = permissions.geolocation === 'granted';
  const motionGranted =
    permissions.deviceMotion === 'granted' ||
    permissions.deviceOrientation === 'granted';

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800">
        <h3 className="text-sm font-bold text-white">📡 Sensors</h3>
        <div className="flex items-center gap-2">
          {isLowPowerMode && (
            <span className="text-xs text-yellow-400 bg-yellow-950/40 border border-yellow-700/50 rounded-full px-2 py-0.5 font-semibold">
              ⚠ Low Power
            </span>
          )}
          <MotionBadge state={motionState} />
        </div>
      </div>

      <div className="px-4 py-3 space-y-3">

        {/* GPS row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm" aria-hidden="true">📍</span>
            <span className="text-xs text-gray-400 font-semibold">GPS</span>
            <PermBadge status={permissions.geolocation} />
          </div>
          <div className="flex items-center gap-2">
            {fuzzedLocation && (
              <span className="text-xs text-gray-500 truncate max-w-[160px]">
                {privacyEngine.locationNote(fuzzedLocation)}
              </span>
            )}
            {!gpsGranted && permissions.geolocation !== 'unavailable' && (
              <button
                onClick={onRequestGPS}
                className="text-xs px-2 py-1 rounded-lg bg-gray-800 border border-gray-600 text-gray-300 hover:border-yellow-600 hover:text-yellow-400 transition-colors focus:outline-none focus:ring-1 focus:ring-yellow-400"
                aria-label="Request GPS location permission"
              >
                Enable
              </button>
            )}
            {gpsGranted && (
              <button
                onClick={onStopGPS}
                className="text-xs px-2 py-1 rounded-lg bg-gray-800 border border-gray-700 text-gray-500 hover:border-red-700 hover:text-red-400 transition-colors focus:outline-none focus:ring-1 focus:ring-red-400"
                aria-label="Stop GPS tracking"
              >
                Stop
              </button>
            )}
          </div>
        </div>

        {/* Compass row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm" aria-hidden="true">🧭</span>
            <span className="text-xs text-gray-400 font-semibold">Compass</span>
            <PermBadge status={permissions.deviceOrientation} />
          </div>
          {compass && headingDegrees !== null && (
            <span className="text-xs font-mono text-gray-300">
              {Math.round(headingDegrees)}° {compassDir}
            </span>
          )}
        </div>

        {/* Motion row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm" aria-hidden="true">📳</span>
            <span className="text-xs text-gray-400 font-semibold">Motion</span>
            <PermBadge status={permissions.deviceMotion} />
          </div>
          {!motionGranted && permissions.deviceMotion !== 'unavailable' && (
            <button
              onClick={onRequestMotion}
              className="text-xs px-2 py-1 rounded-lg bg-gray-800 border border-gray-600 text-gray-300 hover:border-yellow-600 hover:text-yellow-400 transition-colors focus:outline-none focus:ring-1 focus:ring-yellow-400"
              aria-label="Request motion sensor permission (must be triggered by user gesture)"
            >
              Enable
            </button>
          )}
        </div>

        {/* Battery row */}
        {battery && (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm" aria-hidden="true">🔋</span>
              <span className="text-xs text-gray-400 font-semibold">Battery</span>
            </div>
            <BatteryBar level={battery.level} charging={battery.charging} />
          </div>
        )}

        {/* Vibration availability */}
        <div className="flex items-center gap-2">
          <span className="text-sm" aria-hidden="true">📳</span>
          <span className="text-xs text-gray-400 font-semibold">Haptic</span>
          <PermBadge status={permissions.vibration} />
        </div>

      </div>

      {/* Low power notice */}
      {isLowPowerMode && (
        <div className="px-4 py-2 border-t border-yellow-900/40 bg-yellow-950/20 text-xs text-yellow-400">
          Low power mode active — scanning every 8 s, audio reduced.
        </div>
      )}

      {/* Privacy note */}
      {!isActive && (
        <div className="px-4 py-2 border-t border-gray-800 text-xs text-gray-600">
          Sensors activate when a session starts. Location uses fuzzy precision by default.
        </div>
      )}
    </div>
  );
}
