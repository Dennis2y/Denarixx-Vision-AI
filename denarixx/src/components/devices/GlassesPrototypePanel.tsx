'use client';

import { useState, useEffect, useRef } from 'react';
import {
  createDenarixxGlassesState,
  connectGlasses,
  disconnectGlasses,
  simulateGlassesTick,
  getConnectionHealthScore,
  formatHealthScore,
  getActiveConnectionProtocol,
  requiresPhoneFallback,
} from '@/engines/denarixxGlassesEngine';
import {
  classifyHardwareMode,
  getHardwareModeLabel,
  getModeDescription,
  getModeGuidance,
  buildEmergencyFallback,
  assessSubsystemHealth,
  formatComponentStatus,
  getPrototypeSpec,
  buildHardwareBridgeStatus,
} from '@/engines/hardwarePrototypeEngine';
import {
  isBatteryCritical,
  isBatteryLow,
  getBatteryLabel,
  getThermalLabel,
  getThermalGuidance,
  simulateBatteryTick,
} from '@/engines/powerManagementEngine';
import {
  assessAudioHealth,
  buildAudioStatusSummary,
} from '@/engines/audioWearableEngine';
import {
  assessHapticHealth,
  formatHapticStatus,
  buildHapticPattern,
  calculatePatternDurationMs,
} from '@/engines/hapticWearableEngine';
import type { DenarixxGlassesState } from '@/types/denarixxGlasses';
import {
  BATTERY_CRITICAL_MESSAGE,
} from '@/types/denarixxGlasses';

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatusRow({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className="flex justify-between items-start py-1.5 border-b border-gray-800">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-xs font-medium text-right max-w-[55%] ${alert ? 'text-red-400' : 'text-white'}`}>{value}</span>
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────
export function GlassesPrototypePanel() {
  const [state, setState] = useState<DenarixxGlassesState>(createDenarixxGlassesState);
  const [simulating, setSimulating] = useState(false);
  const tickRef = useRef(0);

  useEffect(() => {
    if (!simulating) return;
    const id = setInterval(() => {
      tickRef.current++;
      setState((prev) => {
        let next = simulateGlassesTick(prev, tickRef.current);
        next = simulateBatteryTick(next, 0.05);
        return next;
      });
    }, 800);
    return () => clearInterval(id);
  }, [simulating]);

  const mode = classifyHardwareMode(state);
  const fallback = buildEmergencyFallback(state);
  const health = assessSubsystemHealth(state);
  const healthScore = getConnectionHealthScore(state);
  const bridge = buildHardwareBridgeStatus(state);
  const spec = getPrototypeSpec();
  const thermalGuidance = getThermalGuidance(state.thermalState);
  const batteryLabel = getBatteryLabel(state.power.batteryPct, state.power.isCharging);
  const batCritical = isBatteryCritical(state.power.batteryPct);
  const batLow = isBatteryLow(state.power.batteryPct);
  const audioStatus = assessAudioHealth(state);
  const hapticStatus = assessHapticHealth(state);
  const critPattern = buildHapticPattern('critical_hazard');
  const connected = state.connection === 'connected';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white">🕶 Denarixx Vision Glasses</h2>
          <p className="text-xs text-gray-500 mt-0.5">V16 Hardware Prototype Layer — simulated</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setState(s => simulating ? s : connectGlasses(s))}
            disabled={connected}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              connected ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-yellow-400 hover:bg-yellow-300 text-black'
            }`}
          >
            Connect
          </button>
          <button
            onClick={() => setState(s => disconnectGlasses(s))}
            disabled={!connected}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              !connected ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-red-800 hover:bg-red-700 text-white'
            }`}
          >
            Disconnect
          </button>
          <button
            onClick={() => setSimulating(s => !s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              simulating ? 'bg-blue-800 text-white' : 'bg-gray-700 hover:bg-gray-600 text-white'
            }`}
          >
            {simulating ? '⏹ Stop Sim' : '▶ Simulate'}
          </button>
        </div>
      </div>

      {/* Safety banners */}
      {fallback.active && (
        <div className="bg-red-950 border border-red-700 rounded-xl px-4 py-3 text-sm text-red-300 font-medium">
          ⚠ {fallback.message}
        </div>
      )}
      {thermalGuidance && (
        <div className="bg-orange-950 border border-orange-700 rounded-xl px-4 py-2 text-xs text-orange-300">
          🌡 {thermalGuidance}
        </div>
      )}
      {batCritical && (
        <div className="bg-red-950 border border-red-800 rounded-xl px-4 py-2 text-xs text-red-300">
          🔋 {BATTERY_CRITICAL_MESSAGE}
        </div>
      )}

      {/* Mode card */}
      <div className="bg-gray-800 rounded-xl p-4">
        <p className="text-xs text-gray-500 mb-1">Hardware Mode</p>
        <p className="text-lg font-bold text-yellow-400">{getHardwareModeLabel(mode)}</p>
        <p className="text-xs text-gray-400 mt-1">{getModeDescription(mode)}</p>
        <p className="text-xs text-blue-400 mt-1 italic">{getModeGuidance(mode)}</p>
      </div>

      {/* Status grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Connection */}
        <div className="bg-gray-900 rounded-xl p-3">
          <p className="text-xs text-gray-500 mb-1">Connection</p>
          <p className={`text-sm font-semibold ${
            state.connection === 'connected' ? 'text-green-400' :
            state.connection === 'degraded' ? 'text-yellow-400' : 'text-gray-500'
          }`}>
            {state.connection === 'connected' ? '🟢 Connected' :
             state.connection === 'degraded' ? '🟡 Degraded' :
             state.connection === 'connecting' ? '🔵 Connecting' : '⚫ Disconnected'}
          </p>
          {connected && (
            <p className="text-xs text-gray-600 mt-0.5">
              {state.phoneCompanion.rssiDbm}dBm · {state.phoneCompanion.latencyMs}ms
            </p>
          )}
          <p className="text-xs text-gray-600 mt-0.5">{getActiveConnectionProtocol(state)}</p>
        </div>

        {/* Battery */}
        <div className="bg-gray-900 rounded-xl p-3">
          <p className="text-xs text-gray-500 mb-1">Battery</p>
          <p className={`text-sm font-semibold ${batCritical ? 'text-red-400' : batLow ? 'text-yellow-400' : 'text-white'}`}>
            {batteryLabel}
          </p>
          <p className="text-xs text-gray-600 mt-0.5">~{state.power.estimatedRemainingMinutes}min remaining</p>
        </div>

        {/* Thermal */}
        <div className="bg-gray-900 rounded-xl p-3">
          <p className="text-xs text-gray-500 mb-1">Thermal</p>
          <p className="text-sm font-semibold text-white">{getThermalLabel(state.thermalState)}</p>
        </div>

        {/* Health score */}
        <div className="bg-gray-900 rounded-xl p-3">
          <p className="text-xs text-gray-500 mb-1">Connection Health</p>
          <p className="text-sm font-semibold text-white">{formatHealthScore(healthScore)}</p>
        </div>
      </div>

      {/* Subsystem status */}
      <div className="bg-gray-900 rounded-xl p-4">
        <h3 className="text-xs font-bold text-gray-400 mb-2">Subsystem Status</h3>
        <StatusRow label="Camera" value={formatComponentStatus(health.camera)} alert={health.camera === 'failed'} />
        <StatusRow label="Audio (Bone-Conduction)" value={buildAudioStatusSummary(state)} alert={audioStatus === 'failed'} />
        <StatusRow label="Haptic" value={formatHapticStatus(state)} alert={hapticStatus === 'failed'} />
        <StatusRow label="Power" value={formatComponentStatus(health.power)} alert={health.power === 'failed'} />
        <StatusRow label="Phone Companion" value={state.phoneCompanion.connected ? '🟢 Connected' : '⚫ Disconnected'} />
        <StatusRow label="Firmware" value={`${state.profile.firmwareVersion} (${state.profile.firmwareChannel})`} />
        <StatusRow label="Hardware Rev" value={state.profile.hardwareRevision} />
      </div>

      {/* Hardware bridge integration */}
      <div className="bg-gray-900 rounded-xl p-4">
        <h3 className="text-xs font-bold text-gray-400 mb-2">Hardware Bridge Integration</h3>
        <StatusRow label="Vision Source" value={bridge.visionSource} />
        <StatusRow label="Audio Output" value={bridge.audioOutput} />
        <StatusRow label="Haptic Output" value={bridge.hapticOutput} />
        <StatusRow label="Processing Mode" value={bridge.processingMode} />
        <StatusRow label="Phone Fallback Active" value={requiresPhoneFallback(state) ? '✅ Yes' : '—'} />
      </div>

      {/* Haptic pattern preview */}
      <div className="bg-gray-900 rounded-xl p-4">
        <h3 className="text-xs font-bold text-gray-400 mb-2">Haptic Pattern — Critical Hazard</h3>
        <p className="text-xs text-gray-500 mb-1">{critPattern.description}</p>
        <div className="flex items-center gap-1 flex-wrap">
          {critPattern.pulseMs.map((ms, i) => (
            <span key={`p${i}`} className="bg-red-700 rounded text-xs text-white px-1.5 py-0.5">{ms}ms</span>
          ))}
        </div>
        <p className="text-xs text-gray-600 mt-1">
          Intensity {critPattern.intensity}% · ×{critPattern.repeatCount} · Total {calculatePatternDurationMs(critPattern)}ms
        </p>
      </div>

      {/* Camera modules */}
      <div className="bg-gray-900 rounded-xl p-4">
        <h3 className="text-xs font-bold text-gray-400 mb-2">Camera Modules ({state.profile.cameras.length})</h3>
        <div className="grid grid-cols-2 gap-2">
          {state.profile.cameras.map((cam) => (
            <div key={cam.id} className="bg-gray-800 rounded-lg p-2">
              <p className="text-xs font-medium text-white capitalize">{cam.position}</p>
              <p className="text-xs text-gray-500">{cam.resolutionWidth}×{cam.resolutionHeight} · {cam.targetFPS}fps</p>
              <p className="text-xs text-gray-500">{cam.fovDegrees}° FOV{cam.hasDepthSensor ? ' · depth' : ''}</p>
              <p className={`text-xs mt-0.5 ${connected ? 'text-green-400' : 'text-gray-600'}`}>
                {connected ? '🟢 active' : '⚫ offline'}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Prototype spec */}
      <div className="bg-gray-900 rounded-xl p-4">
        <h3 className="text-xs font-bold text-gray-400 mb-2">Prototype Specification</h3>
        <StatusRow label="Target Weight" value={spec.targetWeight} />
        <StatusRow label="Battery" value={`${spec.targetBatteryCapacityMah}mAh · ${spec.targetBatteryLifeHours}h`} />
        <StatusRow label="Compute" value={spec.computeChip} />
        <StatusRow label="RAM / Storage" value={`${spec.ramGb}GB / ${spec.storageGb}GB`} />
        <StatusRow label="Connection" value={spec.primaryConnectionProtocol.replace(/_/g, ' ')} />
        <StatusRow label="Target Price" value={spec.targetRetailPrice} />
        <StatusRow label="Prototype Target" value={spec.prototypeTargetDate} />
      </div>

      <p className="text-xs text-gray-700 text-center pb-2">
        All hardware is simulated. No physical device connected.
      </p>
    </div>
  );
}
