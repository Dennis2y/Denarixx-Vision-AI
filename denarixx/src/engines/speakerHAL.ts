// ─── Sprint 17: Speaker HAL ───────────────────────────────────────────────────
// Pure functions — no async, no I/O.
// Bone-conduction speaker abstraction with emergency override and speech queue.

import type {
  SpeakerHALState,
  SpeakerType,
  SpeechQueueItem,
  SpeechPriority,
  SensorHealthReport,
} from '@/types/hardwareHAL';
import { SIMULATION_DRIVER } from '@/types/hardwareHAL';
// MAX_RESTART_ATTEMPTS not needed — speaker restarts are managed by SensorManagerEngine

let _idCounter = 0;
function nextId() { return `speech-${++_idCounter}`; }

export function createSpeakerHALState(
  deviceId: string,
  speakerType: SpeakerType = 'bone-conduction'
): SpeakerHALState {
  return {
    deviceId,
    speakerType,
    status: 'offline',
    volume: 80,
    isSpeaking: false,
    emergencyOverride: false,
    queue: [],
    errorCount: 0,
  };
}

export function initializeSpeaker(
  state: SpeakerHALState,
  _tick: number
): SpeakerHALState {
  return { ...state, status: 'ready' };
}

export function setVolume(state: SpeakerHALState, volume: number): SpeakerHALState {
  const clamped = Math.max(0, Math.min(100, volume));
  return { ...state, volume: clamped };
}

export function queueSpeech(
  state: SpeakerHALState,
  text: string,
  priority: SpeechPriority = 'normal',
  languageCode = 'en-GB'
): SpeakerHALState {
  const item: SpeechQueueItem = {
    id: nextId(),
    text,
    priority,
    languageCode,
    timestamp: Date.now(),
  };
  const queue = insertByPriority(state.queue, item);
  return { ...state, queue };
}

const PRIORITY_WEIGHT: Record<SpeechPriority, number> = {
  emergency: 0,
  high:      1,
  normal:    2,
  low:       3,
};

function insertByPriority(
  queue: SpeechQueueItem[],
  item: SpeechQueueItem
): SpeechQueueItem[] {
  const insertAt = queue.findIndex(q => PRIORITY_WEIGHT[q.priority] > PRIORITY_WEIGHT[item.priority]);
  if (insertAt === -1) return [...queue, item];
  return [...queue.slice(0, insertAt), item, ...queue.slice(insertAt)];
}

export function activateEmergencyOverride(state: SpeakerHALState): SpeakerHALState {
  return { ...state, emergencyOverride: true };
}

export function deactivateEmergencyOverride(state: SpeakerHALState): SpeakerHALState {
  return { ...state, emergencyOverride: false };
}

export function processQueue(
  state: SpeakerHALState
): { state: SpeakerHALState; spoken: SpeechQueueItem | null } {
  if (state.status !== 'ready' && state.status !== 'degraded') {
    return { state, spoken: null };
  }
  if (state.queue.length === 0) return { state: { ...state, isSpeaking: false }, spoken: null };

  const [next, ...rest] = state.queue;

  if (!state.emergencyOverride && next.priority !== 'emergency' && state.isSpeaking) {
    return { state, spoken: null };
  }

  return {
    state: { ...state, queue: rest, isSpeaking: true },
    spoken: next,
  };
}

export function clearQueue(state: SpeakerHALState): SpeakerHALState {
  return { ...state, queue: [], isSpeaking: false };
}

export function setSpeakerError(state: SpeakerHALState): SpeakerHALState {
  return {
    ...state,
    status: 'error',
    errorCount: state.errorCount + 1,
    isSpeaking: false,
  };
}

export function getSpeakerHealth(state: SpeakerHALState): SensorHealthReport {
  const issues: string[] = [];
  if (state.status === 'error') issues.push('Speaker in error state');
  if (state.status === 'offline') issues.push('Speaker offline — not initialised');
  if (state.volume === 0) issues.push('Volume is zero — user cannot hear output');
  if (state.queue.length > 10) issues.push(`Speech queue congested: ${state.queue.length} items`);

  return {
    component: 'speaker',
    deviceId: state.deviceId,
    status: state.status,
    errorCount: state.errorCount,
    restartCount: 0,
    issues,
    shouldRestart: state.status === 'error',
  };
}

export function getSpeakerDriver(platform: string): string {
  const drivers: Record<string, string> = {
    simulation:       SIMULATION_DRIVER,
    prototype:        'alsa-bone-conduction',
    'android-xr':     'android-audio-bone',
    'linux-wearable': 'alsa-bone-conduction',
    'denarixx-v1':    'denarixx-bone-native',
  };
  return drivers[platform] ?? SIMULATION_DRIVER;
}
