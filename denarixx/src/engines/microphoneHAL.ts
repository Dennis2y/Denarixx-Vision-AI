// ─── Sprint 17: Microphone HAL ────────────────────────────────────────────────
// Pure functions — no async, no I/O.
// Hardware-independent microphone abstraction. Wake word + speech capture.

import type {
  MicrophoneHALState,
  MicrophoneFrame,
  SensorHealthReport,
} from '@/types/hardwareHAL';
import { MAX_RESTART_ATTEMPTS, SIMULATION_DRIVER } from '@/types/hardwareHAL';
import { WAKE_WORD } from '@/types/glassesOS';

export function createMicHALState(deviceId: string): MicrophoneHALState {
  return {
    deviceId,
    status: 'offline',
    isListeningForWakeWord: false,
    isCaptureActive: false,
    frameCount: 0,
    errorCount: 0,
    restartCount: 0,
  };
}

export function initializeMic(state: MicrophoneHALState, tick: number): MicrophoneHALState {
  return { ...state, status: 'ready' };
}

export function startWakeWordListening(state: MicrophoneHALState): MicrophoneHALState {
  if (state.status !== 'ready' && state.status !== 'degraded') return state;
  return { ...state, isListeningForWakeWord: true };
}

export function stopWakeWordListening(state: MicrophoneHALState): MicrophoneHALState {
  return { ...state, isListeningForWakeWord: false };
}

export function startCapture(state: MicrophoneHALState): MicrophoneHALState {
  if (state.status !== 'ready' && state.status !== 'degraded') return state;
  return { ...state, isCaptureActive: true };
}

export function stopCapture(state: MicrophoneHALState): MicrophoneHALState {
  return { ...state, isCaptureActive: false };
}

export function captureMicFrame(
  state: MicrophoneHALState,
  tick: number,
  simulatedAmplitude = 0.4,
  simulatedNoise = 0.1
): { state: MicrophoneHALState; frame: MicrophoneFrame | null } {
  if (state.status === 'error' || state.status === 'offline') {
    return { state, frame: null };
  }
  const frame: MicrophoneFrame = {
    deviceId: state.deviceId,
    tick,
    peakAmplitude: simulatedAmplitude,
    noiseLevel: simulatedNoise,
    wakeWordDetected: false,
    speechDetected: simulatedAmplitude > 0.3,
    noiseReductionApplied: false,
  };
  return {
    state: { ...state, frameCount: state.frameCount + 1 },
    frame,
  };
}

export function applyNoiseReduction(frame: MicrophoneFrame): MicrophoneFrame {
  const reducedNoise = Math.max(0, frame.noiseLevel * 0.3);
  return {
    ...frame,
    noiseLevel: reducedNoise,
    noiseReductionApplied: true,
    peakAmplitude: Math.min(1, frame.peakAmplitude * 1.1),
  };
}

export function detectWakeWord(frame: MicrophoneFrame, threshold = 0.7): boolean {
  return frame.peakAmplitude >= threshold && frame.speechDetected;
}

export function setMicError(state: MicrophoneHALState): MicrophoneHALState {
  return {
    ...state,
    status: 'error',
    errorCount: state.errorCount + 1,
    isListeningForWakeWord: false,
    isCaptureActive: false,
  };
}

export function restartMic(state: MicrophoneHALState): MicrophoneHALState {
  if (state.restartCount >= MAX_RESTART_ATTEMPTS) {
    return { ...state, status: 'error' };
  }
  return {
    ...state,
    status: 'initializing',
    errorCount: 0,
    restartCount: state.restartCount + 1,
    isListeningForWakeWord: false,
    isCaptureActive: false,
  };
}

export function runMicDiagnostics(state: MicrophoneHALState): string[] {
  const issues: string[] = [];
  if (state.status === 'error') issues.push('Microphone in error state');
  if (state.status === 'offline') issues.push('Microphone offline — not initialised');
  if (state.errorCount >= 3) issues.push(`${state.errorCount} errors recorded`);
  if (!state.isListeningForWakeWord && state.status === 'ready') {
    issues.push(`Not listening for wake word "${WAKE_WORD}"`);
  }
  return issues;
}

export function getMicHealth(state: MicrophoneHALState): SensorHealthReport {
  const issues = runMicDiagnostics(state);
  return {
    component: 'microphone',
    deviceId: state.deviceId,
    status: state.status,
    errorCount: state.errorCount,
    restartCount: state.restartCount,
    issues,
    shouldRestart: state.status === 'error' && state.restartCount < MAX_RESTART_ATTEMPTS,
  };
}

export function getMicDriver(platform: string): string {
  const drivers: Record<string, string> = {
    simulation:       SIMULATION_DRIVER,
    prototype:        'alsa',
    'android-xr':     'android-audio',
    'linux-wearable': 'alsa',
    'denarixx-v1':    'denarixx-mic-native',
  };
  return drivers[platform] ?? SIMULATION_DRIVER;
}
