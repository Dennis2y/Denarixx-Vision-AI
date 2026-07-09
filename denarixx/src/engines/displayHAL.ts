// ─── Sprint 17: Display HAL ───────────────────────────────────────────────────
// Pure functions — no async, no I/O.
// HUD / AR overlay abstraction. Brightness, power mode, future AR overlay.

import type {
  DisplayHALState,
  DisplayMode,
  BrightnessLevel,
  SensorHealthReport,
} from '@/types/hardwareHAL';
import { SIMULATION_DRIVER } from '@/types/hardwareHAL';

const BRIGHTNESS_NUMERIC: Record<BrightnessLevel, number> = {
  auto:   60,
  dim:    20,
  normal: 60,
  bright: 100,
};

export function createDisplayHALState(deviceId: string): DisplayHALState {
  return {
    deviceId,
    status: 'offline',
    mode: 'hud',
    brightness: 'auto',
    brightnessNumeric: BRIGHTNESS_NUMERIC.auto,
    isOn: false,
    errorCount: 0,
  };
}

export function initializeDisplay(state: DisplayHALState, tick: number): DisplayHALState {
  return { ...state, status: 'ready', isOn: true };
}

export function setDisplayMode(state: DisplayHALState, mode: DisplayMode): DisplayHALState {
  if (state.status === 'error' || state.status === 'offline') return state;
  const isOn = mode !== 'off';
  return { ...state, mode, isOn };
}

export function setBrightness(state: DisplayHALState, level: BrightnessLevel): DisplayHALState {
  return {
    ...state,
    brightness: level,
    brightnessNumeric: BRIGHTNESS_NUMERIC[level],
  };
}

export function setNumericBrightness(state: DisplayHALState, level: number): DisplayHALState {
  const clamped = Math.max(0, Math.min(100, level));
  const namedLevel: BrightnessLevel =
    clamped <= 0  ? 'dim' :
    clamped <= 30 ? 'dim' :
    clamped <= 70 ? 'normal' :
    'bright';
  return { ...state, brightness: namedLevel, brightnessNumeric: clamped };
}

export function turnOff(state: DisplayHALState): DisplayHALState {
  return { ...state, mode: 'off', isOn: false };
}

export function turnOn(state: DisplayHALState): DisplayHALState {
  if (state.status === 'error') return state;
  return { ...state, mode: 'hud', isOn: true };
}

export function activateLowPowerMode(state: DisplayHALState): DisplayHALState {
  return setBrightness({ ...state, mode: 'low-power' }, 'dim');
}

export function setDisplayError(state: DisplayHALState): DisplayHALState {
  return { ...state, status: 'error', errorCount: state.errorCount + 1, isOn: false };
}

export function getDisplayHealth(state: DisplayHALState): SensorHealthReport {
  const issues: string[] = [];
  if (state.status === 'error') issues.push('Display in error state');
  if (!state.isOn && state.status === 'ready') issues.push('Display off while status is ready');
  if (state.mode === 'ar-overlay') issues.push('AR overlay mode: placeholder only in current sprint');

  return {
    component: 'display',
    deviceId: state.deviceId,
    status: state.status,
    errorCount: state.errorCount,
    restartCount: 0,
    issues,
    shouldRestart: state.status === 'error',
  };
}

export function getDisplayDriver(platform: string): string {
  const drivers: Record<string, string> = {
    simulation:       SIMULATION_DRIVER,
    prototype:        'drm-kms',
    'android-xr':     'android-display',
    'linux-wearable': 'drm-kms',
    'denarixx-v1':    'denarixx-display-native',
  };
  return drivers[platform] ?? SIMULATION_DRIVER;
}
