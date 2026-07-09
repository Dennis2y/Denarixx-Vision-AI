// ─── Sprint 17: Camera HAL ────────────────────────────────────────────────────
// Pure functions — no async, no I/O.
// Hardware-independent camera abstraction for Denarixx Vision Glasses.

import type {
  CameraHALState,
  CameraFrame,
  CameraFacing,
  CameraResolution,
  HALDeviceStatus,
  SensorHealthReport,
} from '@/types/hardwareHAL';
import { MAX_RESTART_ATTEMPTS, SIMULATION_DRIVER } from '@/types/hardwareHAL';

const RESOLUTION_DIMS: Record<CameraResolution, [number, number]> = {
  '480p':  [854, 480],
  '720p':  [1280, 720],
  '1080p': [1920, 1080],
};

export function createCameraHALState(
  deviceId: string,
  facing: CameraFacing = 'front',
  resolution: CameraResolution = '720p',
  fps = 30,
  fallbackDeviceId: string | null = null
): CameraHALState {
  return {
    deviceId,
    facing,
    resolution,
    fps,
    status: 'offline',
    frameCount: 0,
    lastFrameTick: 0,
    errorCount: 0,
    restartCount: 0,
    usingFallback: false,
    fallbackDeviceId,
  };
}

export function initializeCamera(state: CameraHALState, tick: number): CameraHALState {
  return { ...state, status: 'ready', lastFrameTick: tick };
}

export function captureFrame(
  state: CameraHALState,
  tick: number
): { state: CameraHALState; frame: CameraFrame | null } {
  if (state.status !== 'ready' && state.status !== 'degraded') {
    return { state, frame: null };
  }
  const [width, height] = RESOLUTION_DIMS[state.resolution];
  const frame: CameraFrame = {
    deviceId: state.deviceId,
    tick,
    width,
    height,
    confidence: state.status === 'ready' ? 0.95 : 0.60,
    simulated: true,
  };
  return {
    state: { ...state, frameCount: state.frameCount + 1, lastFrameTick: tick },
    frame,
  };
}

export function setCameraError(state: CameraHALState, tick: number): CameraHALState {
  return {
    ...state,
    status: 'error',
    errorCount: state.errorCount + 1,
    lastFrameTick: tick,
  };
}

export function degradeCamera(state: CameraHALState, tick: number): CameraHALState {
  return { ...state, status: 'degraded', lastFrameTick: tick };
}

export function restartCamera(state: CameraHALState, tick: number): CameraHALState {
  if (state.restartCount >= MAX_RESTART_ATTEMPTS) {
    return activateFallbackCamera(state, tick);
  }
  return {
    ...state,
    status: 'initializing',
    errorCount: 0,
    restartCount: state.restartCount + 1,
    lastFrameTick: tick,
  };
}

export function completeCameraRestart(state: CameraHALState, tick: number): CameraHALState {
  if (state.status !== 'initializing') return state;
  return { ...state, status: 'ready', lastFrameTick: tick };
}

export function activateFallbackCamera(state: CameraHALState, tick: number): CameraHALState {
  if (!state.fallbackDeviceId) {
    return { ...state, status: 'error', lastFrameTick: tick };
  }
  return {
    ...state,
    deviceId: state.fallbackDeviceId,
    status: 'degraded',
    usingFallback: true,
    errorCount: 0,
    lastFrameTick: tick,
  };
}

export function shouldRestartCamera(state: CameraHALState): boolean {
  return state.status === 'error' && state.restartCount < MAX_RESTART_ATTEMPTS;
}

export function getCameraHealth(state: CameraHALState): SensorHealthReport {
  const issues: string[] = [];
  if (state.status === 'error') issues.push('Camera in error state');
  if (state.usingFallback) issues.push(`Using fallback camera (primary failed)`);
  if (state.errorCount >= MAX_RESTART_ATTEMPTS) issues.push('Max restart attempts reached');
  if (state.status === 'degraded') issues.push('Camera operating in degraded mode');

  return {
    component: 'camera',
    deviceId: state.deviceId,
    status: state.status,
    errorCount: state.errorCount,
    restartCount: state.restartCount,
    issues,
    shouldRestart: shouldRestartCamera(state),
  };
}

export function buildFrameStream(state: CameraHALState, tick: number, count = 3): CameraFrame[] {
  if (state.status !== 'ready' && state.status !== 'degraded') return [];
  return Array.from({ length: count }, (_, i) => ({
    deviceId: state.deviceId,
    tick: tick + i,
    width: RESOLUTION_DIMS[state.resolution][0],
    height: RESOLUTION_DIMS[state.resolution][1],
    confidence: state.status === 'ready' ? 0.95 : 0.60,
    simulated: true as const,
  }));
}

export function getCameraDriver(platform: string): string {
  const drivers: Record<string, string> = {
    simulation:      SIMULATION_DRIVER,
    prototype:       'v4l2',
    'android-xr':    'android-camera2',
    'linux-wearable':'v4l2',
    'denarixx-v1':   'denarixx-camera-native',
  };
  return drivers[platform] ?? SIMULATION_DRIVER;
}
