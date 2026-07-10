// ─── V16 Hardware Prototype Engine ────────────────────────────────────────────
// Pure functions — no async, no I/O.
// Hardware mode classification, emergency fallback, prototype spec.

import type {
  DenarixxGlassesState,
  HardwareMode,
  HardwarePrototypeSpec,
  ComponentStatus,
} from '@/types/denarixxGlasses';
import {
  BATTERY_CRITICAL_THRESHOLD,
  GLASSES_DISCONNECT_MESSAGE,
  BATTERY_CRITICAL_MESSAGE,
  CAMERA_FAIL_MESSAGE,
} from '@/types/denarixxGlasses';

// ─── Hardware Mode Classification ─────────────────────────────────────────────

export function classifyHardwareMode(state: DenarixxGlassesState): HardwareMode {
  if (state.connection === 'disconnected') return 'phone_only';

  if (state.emergencyFallbackActive) return 'degraded_safety';

  if (state.power.batteryPct <= BATTERY_CRITICAL_THRESHOLD) return 'degraded_safety';

  if (state.cameraStatus === 'failed' || state.cameraStatus === 'offline') {
    return 'degraded_safety';
  }

  if (state.connection === 'degraded') return 'degraded_safety';

  if (state.connection === 'connected') {
    // If all subsystems healthy → primary mode
    const allOk =
      state.cameraStatus === 'ok' &&
      state.audioStatus === 'ok' &&
      state.thermalState !== 'throttling';
    if (allOk) return 'glasses_primary';
    return 'glasses_assisted';
  }

  return 'phone_only';
}

export function getHardwareModeLabel(mode: HardwareMode): string {
  const labels: Record<HardwareMode, string> = {
    phone_only: '📱 Phone Only',
    glasses_assisted: '🕶 Glasses Assisted',
    glasses_primary: '🕶 Glasses Primary',
    degraded_safety: '⚠ Degraded Safety',
    offline_safety: '📵 Offline Safety',
  };
  return labels[mode];
}

export function getModeDescription(mode: HardwareMode): string {
  const desc: Record<HardwareMode, string> = {
    phone_only: 'Phone camera and phone speaker only. No glasses connected.',
    glasses_assisted: 'Glasses supplement phone. Some subsystems reduced.',
    glasses_primary: 'Glasses are the primary sensor. All subsystems healthy.',
    degraded_safety: 'One or more subsystems failed. Running in reduced mode.',
    offline_safety: 'Cloud and connectivity lost. Running fully local.',
  };
  return desc[mode];
}

export function getModeGuidance(mode: HardwareMode): string {
  switch (mode) {
    case 'phone_only': return 'Hold your phone at chest level for best camera coverage.';
    case 'glasses_assisted': return 'Glasses are providing supplemental camera coverage.';
    case 'glasses_primary': return 'Glasses are actively guiding you. Keep them firmly on.';
    case 'degraded_safety': return 'Some systems are reduced. Proceed cautiously and check surroundings.';
    case 'offline_safety': return 'Operating offline. Local detection only. Extra caution required.';
  }
}

// ─── Emergency Fallback ───────────────────────────────────────────────────────

export function buildEmergencyFallback(
  state: DenarixxGlassesState,
): { active: boolean; message: string; mode: HardwareMode } {
  // Glasses disconnected
  if (state.connection === 'disconnected' && state.emergencyFallbackActive) {
    return { active: true, message: GLASSES_DISCONNECT_MESSAGE, mode: 'phone_only' };
  }
  // Battery critical
  if (state.power.batteryPct <= BATTERY_CRITICAL_THRESHOLD) {
    return { active: true, message: BATTERY_CRITICAL_MESSAGE, mode: 'degraded_safety' };
  }
  // Camera failed
  if (state.cameraStatus === 'failed') {
    return { active: true, message: CAMERA_FAIL_MESSAGE, mode: 'degraded_safety' };
  }
  return { active: false, message: '', mode: classifyHardwareMode(state) };
}

export function shouldEnterDegradedMode(state: DenarixxGlassesState): boolean {
  if (state.power.batteryPct <= BATTERY_CRITICAL_THRESHOLD) return true;
  if (state.cameraStatus === 'failed') return true;
  if (state.connection === 'degraded') return true;
  if (state.thermalState === 'throttling') return true;
  return false;
}

export function shouldEnterOfflineSafety(
  cloudAvailable: boolean,
  state: DenarixxGlassesState,
): boolean {
  return !cloudAvailable && state.connection !== 'connected';
}

// ─── Subsystem Health Matrix ──────────────────────────────────────────────────

export function assessSubsystemHealth(state: DenarixxGlassesState): {
  camera: ComponentStatus;
  audio: ComponentStatus;
  haptic: ComponentStatus;
  connection: ComponentStatus;
  power: ComponentStatus;
} {
  return {
    camera: state.cameraStatus,
    audio: state.audioStatus,
    haptic: state.hapticStatus,
    connection: connectionStateToStatus(state.connection),
    power: state.power.batteryPct <= BATTERY_CRITICAL_THRESHOLD ? 'failed' :
      state.power.batteryPct <= 20 ? 'degraded' : 'ok',
  };
}

function connectionStateToStatus(conn: DenarixxGlassesState['connection']): ComponentStatus {
  switch (conn) {
    case 'connected': return 'ok';
    case 'degraded': return 'degraded';
    case 'connecting': return 'degraded';
    case 'disconnected': return 'offline';
  }
}

export function formatComponentStatus(status: ComponentStatus): string {
  const map: Record<ComponentStatus, string> = {
    ok: '🟢 OK',
    degraded: '🟡 Degraded',
    failed: '🔴 Failed',
    offline: '⚫ Offline',
  };
  return map[status];
}

// ─── Prototype Spec ───────────────────────────────────────────────────────────

export function getPrototypeSpec(): HardwarePrototypeSpec {
  return {
    targetWeight: '42g',
    targetBatteryCapacityMah: 300,
    targetBatteryLifeHours: 4,
    computeChip: 'Qualcomm AR2 / Snapdragon AR (placeholder)',
    ramGb: 2,
    storageGb: 8,
    primaryConnectionProtocol: 'bluetooth_le',
    targetRetailPrice: '€399',
    prototypeTargetDate: 'Q2 2026 (Germany)',
  };
}

// ─── Integration Bridge Points ────────────────────────────────────────────────

export function buildHardwareBridgeStatus(state: DenarixxGlassesState): {
  visionSource: string;
  audioOutput: string;
  hapticOutput: string;
  processingMode: string;
} {
  const mode = classifyHardwareMode(state);
  return {
    visionSource: mode === 'phone_only' ? 'phone_camera' :
      state.cameraStatus === 'ok' ? 'denarixx_glasses' : 'phone_camera',
    audioOutput: state.audioStatus === 'ok' ? 'bone_conduction' : 'phone_speaker',
    hapticOutput: state.hapticStatus === 'ok' ? 'glasses_haptic' : 'phone_vibration',
    processingMode: mode === 'offline_safety' ? 'local' :
      mode === 'degraded_safety' ? 'edge' : 'hybrid',
  };
}
