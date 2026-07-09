// ─── Sprint 17: Battery HAL ───────────────────────────────────────────────────
// Pure functions — no async, no I/O.
// Battery hardware abstraction: percentage, temperature, charging, health, critical mode.

import type {
  BatteryHALState,
  BatteryReading,
  ChargingState,
  BatteryHealthStatus,
  SensorHealthReport,
} from '@/types/hardwareHAL';
import {
  SIMULATION_DRIVER,
  HAL_CRITICAL_ERROR_THRESHOLD,
} from '@/types/hardwareHAL';
import {
  CRITICAL_BATTERY_PCT,
  LOW_BATTERY_PCT,
  CRITICAL_BATTERY_ANNOUNCEMENT,
} from '@/types/glassesOS';

export function createBatteryHALState(deviceId: string): BatteryHALState {
  return {
    deviceId,
    status: 'offline',
    lastReading: null,
    criticalBatteryActive: false,
    readingCount: 0,
    errorCount: 0,
  };
}

export function initializeBattery(state: BatteryHALState, tick: number): BatteryHALState {
  return { ...state, status: 'ready' };
}

export function classifyBatteryHealth(
  percentage: number,
  temperatureC: number,
  cycleCount = 0
): BatteryHealthStatus {
  if (temperatureC > 55 || cycleCount > 800) return 'replace';
  if (temperatureC > 45 || percentage < 20 && cycleCount > 500) return 'degraded';
  return 'good';
}

export function classifyChargingState(
  isCharging: boolean,
  percentage: number
): ChargingState {
  if (isCharging && percentage >= 99) return 'full';
  if (isCharging) return 'charging';
  return 'discharging';
}

export function estimateBatteryLife(
  percentage: number,
  isCharging: boolean,
  drainRatePerHour = 12
): number {
  if (isCharging) return 0;
  return Math.max(0, Math.round((percentage / drainRatePerHour) * 60));
}

export function readBattery(
  state: BatteryHALState,
  batteryPct: number,
  temperatureC: number,
  tick: number,
  isCharging = false
): { state: BatteryHALState; reading: BatteryReading } {
  const percentage = Math.max(0, Math.min(100, batteryPct));
  const health = classifyBatteryHealth(percentage, temperatureC);
  const chargingState = classifyChargingState(isCharging, percentage);
  const criticalMode = percentage <= CRITICAL_BATTERY_PCT;
  const lifeMinutes = estimateBatteryLife(percentage, isCharging);
  const voltageV = 3.0 + (percentage / 100) * 1.2;

  const reading: BatteryReading = {
    tick,
    percentage,
    temperatureC,
    chargingState,
    health,
    voltageV: +voltageV.toFixed(2),
    estimatedLifeMinutes: lifeMinutes,
    criticalMode,
  };

  return {
    state: {
      ...state,
      lastReading: reading,
      criticalBatteryActive: criticalMode,
      readingCount: state.readingCount + 1,
    },
    reading,
  };
}

export function activateCriticalMode(state: BatteryHALState): BatteryHALState {
  return { ...state, criticalBatteryActive: true };
}

export function isCritical(reading: BatteryReading): boolean {
  return reading.criticalMode;
}

export function buildBatteryWarning(reading: BatteryReading): string | null {
  if (reading.percentage <= CRITICAL_BATTERY_PCT) return CRITICAL_BATTERY_ANNOUNCEMENT;
  if (reading.percentage <= LOW_BATTERY_PCT) {
    return `Battery low (${Math.round(reading.percentage)}%). Please charge soon. Guardian remains active.`;
  }
  if (reading.temperatureC >= 55) return 'Glasses temperature critical. Non-essential features disabled.';
  if (reading.temperatureC >= 45) return 'Glasses running warm. Performance reduced.';
  return null;
}

export function setBatteryError(state: BatteryHALState): BatteryHALState {
  return {
    ...state,
    status: 'error',
    errorCount: state.errorCount + 1,
  };
}

export function getBatteryHealth(state: BatteryHALState): SensorHealthReport {
  const issues: string[] = [];
  if (state.status === 'error') issues.push('Battery HAL in error state');
  if (state.criticalBatteryActive) issues.push('Critical battery mode active');
  if (state.lastReading?.health === 'replace') issues.push('Battery health: replace required');
  if (state.lastReading?.health === 'degraded') issues.push('Battery health degraded');
  if (state.lastReading?.temperatureC && state.lastReading.temperatureC > 45) {
    issues.push(`High battery temperature: ${state.lastReading.temperatureC}°C`);
  }
  if (state.errorCount >= HAL_CRITICAL_ERROR_THRESHOLD) issues.push('Critical error count reached');

  return {
    component: 'battery',
    deviceId: state.deviceId,
    status: state.status,
    errorCount: state.errorCount,
    restartCount: 0,
    issues,
    shouldRestart: false,
  };
}

export function getBatteryDriver(platform: string): string {
  const drivers: Record<string, string> = {
    simulation:       SIMULATION_DRIVER,
    prototype:        'sysfs-battery',
    'android-xr':     'android-battery-manager',
    'linux-wearable': 'sysfs-battery',
    'denarixx-v1':    'denarixx-power-native',
  };
  return drivers[platform] ?? SIMULATION_DRIVER;
}
