// ─── Sprint 16: Glasses Power Engine ─────────────────────────────────────────
// Pure functions — no async, no I/O.
// Standalone power management for Denarixx Vision Glasses compute module.
// Keeps Guardian alive as long as possible. (Complements V16 powerManagementEngine.ts.)

import type { PowerLevel, PowerProfile } from '@/types/glassesOS';
import {
  CRITICAL_BATTERY_PCT,
  LOW_BATTERY_PCT,
  THERMAL_THROTTLE_TEMP_C,
  EMERGENCY_TEMP_C,
  CRITICAL_BATTERY_ANNOUNCEMENT,
  ALWAYS_ACTIVE_FEATURES,
} from '@/types/glassesOS';

// ─── Power Level ──────────────────────────────────────────────────────────────

export function classifyPowerLevel(batteryPct: number): PowerLevel {
  if (batteryPct <= CRITICAL_BATTERY_PCT) return 'critical';
  if (batteryPct <= LOW_BATTERY_PCT)      return 'low';
  if (batteryPct <= 50)                   return 'normal';
  if (batteryPct <= 80)                   return 'high';
  return 'full';
}

export function shouldWarnUser(batteryPct: number): boolean {
  return batteryPct <= LOW_BATTERY_PCT;
}

export function shouldReducePower(batteryPct: number, temperatureC: number): boolean {
  return batteryPct <= LOW_BATTERY_PCT || temperatureC >= THERMAL_THROTTLE_TEMP_C;
}

export function isThermalEmergency(temperatureC: number): boolean {
  return temperatureC >= EMERGENCY_TEMP_C;
}

// ─── Drain Rate Estimation ────────────────────────────────────────────────────

const BASE_DRAIN_RATE_PER_HOUR = 12.0;

const FEATURE_DRAIN_CONTRIBUTION: Record<string, number> = {
  'hazard-detection':     3.0,
  'guardian':             1.5,
  'voice-guidance':       0.8,
  'navigation':           2.0,
  'companion':            1.2,
  'memory':               0.6,
  'social-awareness':     1.8,
  'cloud-sync':           2.5,
  'phone-companion-link': 1.0,
  'language':             0.4,
};

export function estimateDrainRate(activeFeatures: string[]): number {
  const featureDrain = activeFeatures.reduce((sum, f) => {
    return sum + (FEATURE_DRAIN_CONTRIBUTION[f] ?? 0.5);
  }, 0);
  return BASE_DRAIN_RATE_PER_HOUR + featureDrain;
}

export function estimateBatteryLifeMinutes(
  batteryPct: number,
  drainRatePerHour: number
): number {
  if (drainRatePerHour <= 0) return 999;
  return Math.max(0, Math.round((batteryPct / drainRatePerHour) * 60));
}

// ─── Reduced-Power Features ───────────────────────────────────────────────────

export function getReducedPowerFeatures(
  batteryPct: number,
  temperatureC: number
): string[] {
  const disabled: string[] = [];
  if (batteryPct <= 30 || temperatureC >= THERMAL_THROTTLE_TEMP_C) {
    disabled.push('social-awareness', 'companion', 'cloud-sync');
  }
  if (batteryPct <= LOW_BATTERY_PCT) {
    disabled.push('navigation', 'memory', 'phone-companion-link', 'language');
  }
  if (batteryPct <= CRITICAL_BATTERY_PCT) {
    disabled.push('cloud-enhanced-scene');
  }
  return [...new Set(disabled)];
}

export function getActiveFeaturesToKeep(
  requested: string[],
  reducedPowerFeatures: string[]
): string[] {
  const disabled = new Set(reducedPowerFeatures);
  const alwaysOn = new Set(ALWAYS_ACTIVE_FEATURES);
  return requested.filter(f => !disabled.has(f) || alwaysOn.has(f));
}

// ─── Power Profile ────────────────────────────────────────────────────────────

export function buildPowerProfile(
  batteryPct: number,
  temperatureC: number,
  activeFeatures: string[]
): PowerProfile {
  const clamped = Math.max(0, Math.min(100, batteryPct));
  const powerLevel = classifyPowerLevel(clamped);
  const drainRate = estimateDrainRate(activeFeatures);
  const lifeMinutes = estimateBatteryLifeMinutes(clamped, drainRate);
  const reducePower = shouldReducePower(clamped, temperatureC);
  const reducedPowerFeatures = reducePower
    ? getReducedPowerFeatures(clamped, temperatureC)
    : [];

  return {
    batteryPct: clamped,
    powerLevel,
    temperatureC,
    drainRatePercentPerHour: drainRate,
    estimatedLifeMinutes: lifeMinutes,
    shouldReducePower: reducePower,
    shouldWarnUser: shouldWarnUser(clamped),
    thermalThrottle: temperatureC >= THERMAL_THROTTLE_TEMP_C,
    reducedPowerFeatures,
  };
}

export function buildDefaultPowerProfile(): PowerProfile {
  return buildPowerProfile(100, 28, [...ALWAYS_ACTIVE_FEATURES]);
}

// ─── Battery Simulation ───────────────────────────────────────────────────────

export function simulateBatteryTick(
  batteryPct: number,
  drainRatePerHour: number,
  ticksPerHour = 3600
): number {
  const drainPerTick = drainRatePerHour / ticksPerHour;
  return Math.max(0, batteryPct - drainPerTick);
}

// ─── Warnings ─────────────────────────────────────────────────────────────────

export function buildPowerWarning(
  batteryPct: number,
  temperatureC: number
): string | null {
  if (batteryPct <= CRITICAL_BATTERY_PCT) {
    return CRITICAL_BATTERY_ANNOUNCEMENT;
  }
  if (batteryPct <= LOW_BATTERY_PCT) {
    return `Battery low (${Math.round(batteryPct)}%). Please charge soon. Guardian remains active.`;
  }
  if (temperatureC >= EMERGENCY_TEMP_C) {
    return 'Glasses temperature critical. Shutting down non-essential features.';
  }
  if (temperatureC >= THERMAL_THROTTLE_TEMP_C) {
    return 'Glasses running warm. Performance reduced to protect hardware.';
  }
  return null;
}

export function getPowerLevelColor(level: PowerLevel): 'green' | 'yellow' | 'red' {
  switch (level) {
    case 'critical': return 'red';
    case 'low':      return 'yellow';
    default:         return 'green';
  }
}
