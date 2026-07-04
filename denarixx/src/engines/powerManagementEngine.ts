// ─── V16 Power Management Engine ─────────────────────────────────────────────
// Pure functions — no async, no I/O.
// Battery classification, thermal management, power profiles.

import type {
  PowerProfile,
  ThermalState,
  HardwareMode,
  DenarixxGlassesState,
} from '@/types/denarixxGlasses';
import {
  BATTERY_CRITICAL_THRESHOLD,
  BATTERY_LOW_THRESHOLD,
  BATTERY_CRITICAL_MESSAGE,
  THERMAL_HOT_THRESHOLD_C,
  THERMAL_WARM_THRESHOLD_C,
} from '@/types/denarixxGlasses';

// ─── Power Profile Factory ────────────────────────────────────────────────────

export function createPowerProfile(
  batteryPct: number,
  isCharging: boolean,
  thermalState: ThermalState = 'normal',
): PowerProfile {
  const clampedPct = Math.max(0, Math.min(100, batteryPct));
  return {
    batteryPct: clampedPct,
    isCharging,
    thermalState,
    estimatedRemainingMinutes: estimateRemainingMinutes(clampedPct, 'glasses_primary'),
    voltageV: batteryPctToVoltage(clampedPct),
    currentMa: isCharging ? -180 : 220, // negative = charging
  };
}

// ─── Battery Classification ───────────────────────────────────────────────────

export function isBatteryCritical(pct: number): boolean {
  return pct <= BATTERY_CRITICAL_THRESHOLD;
}

export function isBatteryLow(pct: number): boolean {
  return pct <= BATTERY_LOW_THRESHOLD;
}

export function getBatteryWarningMessage(pct: number): string | null {
  if (isBatteryCritical(pct)) return BATTERY_CRITICAL_MESSAGE;
  if (isBatteryLow(pct)) return 'Glasses battery is low. Consider switching to phone mode soon.';
  return null;
}

export function getBatteryLabel(pct: number, isCharging: boolean): string {
  if (isCharging) return `🔌 ${pct}% (charging)`;
  if (isBatteryCritical(pct)) return `🔴 ${pct}% — Critical`;
  if (isBatteryLow(pct)) return `🟠 ${pct}% — Low`;
  if (pct > 60) return `🟢 ${pct}%`;
  return `🟡 ${pct}%`;
}

// ─── Thermal Management ───────────────────────────────────────────────────────

export function classifyThermalState(tempCelsius: number): ThermalState {
  if (tempCelsius >= THERMAL_HOT_THRESHOLD_C + 5) return 'throttling';
  if (tempCelsius >= THERMAL_HOT_THRESHOLD_C) return 'hot';
  if (tempCelsius >= THERMAL_WARM_THRESHOLD_C) return 'warm';
  return 'normal';
}

export function shouldThrottleForThermal(thermal: ThermalState): boolean {
  return thermal === 'hot' || thermal === 'throttling';
}

export function getThermalLabel(thermal: ThermalState): string {
  const map: Record<ThermalState, string> = {
    normal: '🟢 Normal',
    warm: '🟡 Warm',
    hot: '🟠 Hot',
    throttling: '🔴 Throttling',
  };
  return map[thermal];
}

export function getThermalGuidance(thermal: ThermalState): string | null {
  switch (thermal) {
    case 'throttling': return 'Glasses are overheating. AI processing reduced. Allow cooling.';
    case 'hot': return 'Glasses are running warm. Consider a break.';
    default: return null;
  }
}

// ─── Battery Life Estimation ──────────────────────────────────────────────────

export function estimateRemainingMinutes(pct: number, mode: HardwareMode): number {
  // mAh draw estimates per mode
  const drawMa: Record<HardwareMode, number> = {
    phone_only: 80,        // Only BT beacon active
    glasses_assisted: 150,
    glasses_primary: 220,
    degraded_safety: 100,
    offline_safety: 90,
  };
  const capacityMah = 300; // Prototype target
  const mah = (pct / 100) * capacityMah;
  const draw = drawMa[mode];
  return Math.round((mah / draw) * 60); // minutes
}

// ─── Voltage Curve ────────────────────────────────────────────────────────────

export function batteryPctToVoltage(pct: number): number {
  // LiPo discharge curve approximation
  if (pct > 80) return 4.1 - ((100 - pct) / 20) * 0.1;
  if (pct > 20) return 3.8 - ((80 - pct) / 60) * 0.3;
  return 3.5 - ((20 - pct) / 20) * 0.5;
}

// ─── Power-Aware Mode Recommendation ─────────────────────────────────────────

export function getRecommendedModeForPower(
  power: PowerProfile,
): 'performance' | 'balanced' | 'power_saver' | 'critical' {
  if (power.isCharging) return 'performance';
  if (power.batteryPct > 60 && power.thermalState === 'normal') return 'performance';
  if (power.batteryPct > 30 && power.thermalState !== 'throttling') return 'balanced';
  if (power.batteryPct > BATTERY_CRITICAL_THRESHOLD) return 'power_saver';
  return 'critical';
}

// ─── Simulated Battery Drain ──────────────────────────────────────────────────

export function simulateBatteryTick(
  state: DenarixxGlassesState,
  drainPerTickPct = 0.008,
): DenarixxGlassesState {
  if (!state.power.isCharging && state.power.batteryPct > 0) {
    const newPct = Math.max(0, state.power.batteryPct - drainPerTickPct);
    const newPower = createPowerProfile(newPct, false, state.power.thermalState);
    return { ...state, power: newPower, lastUpdated: Date.now() };
  }
  return state;
}

// ─── Formatters ───────────────────────────────────────────────────────────────

export function formatPowerSummary(power: PowerProfile): string {
  const batteryLabel = getBatteryLabel(power.batteryPct, power.isCharging);
  const thermal = getThermalLabel(power.thermalState);
  return `${batteryLabel} · ${thermal}`;
}

export function formatVoltage(v: number): string {
  return `${v.toFixed(2)}V`;
}
