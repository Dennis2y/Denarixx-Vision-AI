// ─── V15 Battery Optimization Engine ─────────────────────────────────────────
// Pure functions — no async, no I/O.
// Adaptive processing profiles based on battery state.

import type {
  BatteryMode,
  BatteryOptimizationProfile,
  ModelRuntime,
} from '@/types/onDeviceAI';

// ─── Battery Mode Classification ─────────────────────────────────────────────

export function classifyBatteryMode(
  batteryPct: number,
  isCharging: boolean,
): BatteryMode {
  if (isCharging) return 'performance';
  if (batteryPct > 60) return 'performance';
  if (batteryPct > 30) return 'balanced';
  if (batteryPct > 10) return 'power_saver';
  return 'critical';
}

export function getBatteryModeLabel(mode: BatteryMode): string {
  const labels: Record<BatteryMode, string> = {
    performance: '🟢 Performance',
    balanced: '🟡 Balanced',
    power_saver: '🟠 Power Saver',
    critical: '🔴 Critical',
  };
  return labels[mode];
}

// ─── Optimization Profiles ────────────────────────────────────────────────────

export function getBatteryOptimizationProfile(
  mode: BatteryMode,
): BatteryOptimizationProfile {
  const profiles: Record<BatteryMode, BatteryOptimizationProfile> = {
    performance: {
      mode: 'performance',
      targetFPS: 10,
      maxInferenceMs: 150,
      pauseCloudReasoning: false,
      prioritizeLocal: false,
      skipPeripheralCameras: false,
      reduceModelComplexity: false,
    },
    balanced: {
      mode: 'balanced',
      targetFPS: 5,
      maxInferenceMs: 250,
      pauseCloudReasoning: false,
      prioritizeLocal: false,
      skipPeripheralCameras: false,
      reduceModelComplexity: false,
    },
    power_saver: {
      mode: 'power_saver',
      targetFPS: 2,
      maxInferenceMs: 500,
      pauseCloudReasoning: true,
      prioritizeLocal: true,
      skipPeripheralCameras: true,
      reduceModelComplexity: true,
    },
    critical: {
      mode: 'critical',
      targetFPS: 1,
      maxInferenceMs: 800,
      pauseCloudReasoning: true,
      prioritizeLocal: true,
      skipPeripheralCameras: true,
      reduceModelComplexity: true,
    },
  };
  return profiles[mode];
}

// ─── FPS Recommendations ──────────────────────────────────────────────────────

export function getRecommendedFPS(
  batteryMode: BatteryMode,
  nearHazard: boolean,
): number {
  const profile = getBatteryOptimizationProfile(batteryMode);
  if (nearHazard && batteryMode !== 'critical') {
    // Boost FPS when near hazard, unless battery is critical
    return Math.min(profile.targetFPS * 2, 15);
  }
  return profile.targetFPS;
}

// ─── Cloud Reasoning Control ──────────────────────────────────────────────────

export function shouldPauseCloudReasoning(
  batteryMode: BatteryMode,
  isCriticalAlert: boolean,
): boolean {
  if (isCriticalAlert) return false; // Never pause cloud for critical alerts
  return getBatteryOptimizationProfile(batteryMode).pauseCloudReasoning;
}

export function shouldPrioritizeLocal(batteryMode: BatteryMode): boolean {
  return getBatteryOptimizationProfile(batteryMode).prioritizeLocal;
}

export function shouldSkipPeripheralCameras(batteryMode: BatteryMode): boolean {
  return getBatteryOptimizationProfile(batteryMode).skipPeripheralCameras;
}

// ─── Runtime Recommendation ───────────────────────────────────────────────────

export function getRecommendedRuntime(batteryMode: BatteryMode): ModelRuntime {
  // In simulation, 'browser' is the only actually available runtime;
  // other returns are aspirational based on hardware.
  switch (batteryMode) {
    case 'performance': return 'webgpu';
    case 'balanced': return 'onnx';
    case 'power_saver': return 'tensorflowjs';
    case 'critical': return 'browser';
  }
}

// ─── Thermal-Aware Battery Adjustment ─────────────────────────────────────────

export function adjustModeForThermal(
  mode: BatteryMode,
  thermalState: 'normal' | 'warm' | 'hot',
): BatteryMode {
  if (thermalState === 'normal') return mode;
  if (thermalState === 'hot') {
    // Force step down 2 levels
    const order: BatteryMode[] = ['performance', 'balanced', 'power_saver', 'critical'];
    const idx = order.indexOf(mode);
    return order[Math.min(idx + 2, order.length - 1)];
  }
  // warm → step down 1
  const order: BatteryMode[] = ['performance', 'balanced', 'power_saver', 'critical'];
  const idx = order.indexOf(mode);
  return order[Math.min(idx + 1, order.length - 1)];
}

// ─── Battery Warning ─────────────────────────────────────────────────────────

export function getBatteryModeWarning(mode: BatteryMode): string | null {
  switch (mode) {
    case 'critical': return 'Battery critical. Using minimum power mode. Charge device immediately.';
    case 'power_saver': return 'Low battery. AI processing reduced. Connect charger when possible.';
    default: return null;
  }
}

export function formatBatteryModeProfile(profile: BatteryOptimizationProfile): string {
  return `${profile.targetFPS}fps · ${profile.maxInferenceMs}ms max inference · ` +
    (profile.prioritizeLocal ? 'local-first' : 'cloud-enabled');
}
