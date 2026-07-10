// ─── Bring-Up Program: Hardware Button Engine ────────────────────────────────
// Pure functions — no async, no I/O.
// Hardware button event processing for glasses-first, screen-free operation.
// Supports: single press, long press, emergency press sequence, volume, language.
// Every essential action must work through voice, button, or automatic startup.

// ─── Types ────────────────────────────────────────────────────────────────────

export type ButtonId = 'main' | 'volume-up' | 'volume-down';

export type ButtonEventType =
  | 'press-down'
  | 'press-up'
  | 'long-press'       // held ≥ LONG_PRESS_MS
  | 'double-press'
  | 'triple-press';    // emergency press sequence trigger

export type ButtonAction =
  | 'repeat-last-guidance'        // single press of main
  | 'start-vision'                // long press (vision not running)
  | 'stop-vision'                 // long press (vision running)
  | 'emergency-stop'              // triple press of main
  | 'volume-increase'
  | 'volume-decrease'
  | 'next-language'               // triple press of volume-up (setup mode)
  | 'confirm-selection'           // double press of main (setup mode)
  | 'none';

export type RuntimeState = 'idle' | 'running' | 'emergency' | 'setup';

export interface ButtonEvent {
  buttonId: ButtonId;
  eventType: ButtonEventType;
  durationMs: number;
  timestampMs: number;
}

export interface ButtonActionResult {
  action: ButtonAction;
  announcement: string;
  changeState: RuntimeState | null;   // null means no state change
  isEmergency: boolean;
}

// ─── Timing Constants ────────────────────────────────────────────────────────

export const LONG_PRESS_MS = 800;
export const DOUBLE_PRESS_WINDOW_MS = 400;
export const TRIPLE_PRESS_WINDOW_MS = 600;
export const DEBOUNCE_MS = 20;

// ─── Press Sequence Tracker ───────────────────────────────────────────────────

export interface PressSequenceState {
  buttonId: ButtonId;
  pressCount: number;
  firstPressMs: number;
  lastPressMs: number;
}

export function createPressSequenceState(): PressSequenceState {
  return {
    buttonId: 'main',
    pressCount: 0,
    firstPressMs: 0,
    lastPressMs: 0,
  };
}

export function recordPress(
  state: PressSequenceState,
  buttonId: ButtonId,
  nowMs: number,
): PressSequenceState {
  const isNewSequence =
    buttonId !== state.buttonId ||
    nowMs - state.lastPressMs > TRIPLE_PRESS_WINDOW_MS;

  if (isNewSequence) {
    return { buttonId, pressCount: 1, firstPressMs: nowMs, lastPressMs: nowMs };
  }
  return { ...state, pressCount: state.pressCount + 1, lastPressMs: nowMs };
}

export function getDetectedEventType(
  state: PressSequenceState,
  holdDurationMs: number,
  nowMs: number,
): ButtonEventType {
  // Long press detection (hold, not tap)
  if (holdDurationMs >= LONG_PRESS_MS) return 'long-press';

  const windowOpen = nowMs - state.lastPressMs < TRIPLE_PRESS_WINDOW_MS;
  if (state.pressCount >= 3 && !windowOpen) return 'triple-press';
  if (state.pressCount === 2 && !windowOpen) return 'double-press';
  return 'press-up';
}

// ─── Action Mapping ───────────────────────────────────────────────────────────

export function resolveButtonAction(
  buttonId: ButtonId,
  eventType: ButtonEventType,
  runtimeState: RuntimeState,
): ButtonAction {
  if (buttonId === 'main') {
    if (eventType === 'triple-press') return 'emergency-stop';
    if (eventType === 'long-press') {
      return runtimeState === 'running' ? 'stop-vision' : 'start-vision';
    }
    if (eventType === 'press-up') return 'repeat-last-guidance';
    if (eventType === 'double-press' && runtimeState === 'setup') return 'confirm-selection';
  }
  if (buttonId === 'volume-up') {
    if (eventType === 'triple-press' && runtimeState === 'setup') return 'next-language';
    return 'volume-increase';
  }
  if (buttonId === 'volume-down') return 'volume-decrease';
  return 'none';
}

// ─── Action Result Builder ────────────────────────────────────────────────────

export function buildButtonActionResult(
  action: ButtonAction,
  runtimeState: RuntimeState,
): ButtonActionResult {
  switch (action) {
    case 'repeat-last-guidance':
      return {
        action,
        announcement: '',               // caller fills in last guidance text
        changeState: null,
        isEmergency: false,
      };
    case 'start-vision':
      return {
        action,
        announcement: 'Starting vision. Obstacle detection is now active.',
        changeState: 'running',
        isEmergency: false,
      };
    case 'stop-vision':
      return {
        action,
        announcement: 'Vision stopped. Press and hold to restart.',
        changeState: 'idle',
        isEmergency: false,
      };
    case 'emergency-stop':
      return {
        action,
        announcement: 'Emergency stop. All non-critical alerts silenced. Please stop and wait.',
        changeState: 'emergency',
        isEmergency: true,
      };
    case 'volume-increase':
      return {
        action,
        announcement: '',               // caller announces new volume level
        changeState: null,
        isEmergency: false,
      };
    case 'volume-decrease':
      return {
        action,
        announcement: '',
        changeState: null,
        isEmergency: false,
      };
    case 'next-language':
      return {
        action,
        announcement: '',               // language engine announces next language
        changeState: null,
        isEmergency: false,
      };
    case 'confirm-selection':
      return {
        action,
        announcement: 'Selection confirmed.',
        changeState: null,
        isEmergency: false,
      };
    case 'none':
    default:
      return { action: 'none', announcement: '', changeState: null, isEmergency: false };
  }
}

// ─── Full Processing Pipeline ─────────────────────────────────────────────────

export function processButtonEvent(
  event: ButtonEvent,
  sequenceState: PressSequenceState,
  runtimeState: RuntimeState,
): { result: ButtonActionResult; updatedSequence: PressSequenceState } {
  const updatedSequence = recordPress(sequenceState, event.buttonId, event.timestampMs);
  const eventType = getDetectedEventType(updatedSequence, event.durationMs, event.timestampMs);
  const action = resolveButtonAction(event.buttonId, eventType, runtimeState);
  const result = buildButtonActionResult(action, runtimeState);
  return { result, updatedSequence };
}

// ─── Volume Control ───────────────────────────────────────────────────────────

export interface VolumeState {
  level: number;    // 0–10
  muted: boolean;
}

export function createVolumeState(initial = 7): VolumeState {
  return { level: initial, muted: false };
}

export function adjustVolume(state: VolumeState, action: 'increase' | 'decrease'): VolumeState {
  const delta = action === 'increase' ? 1 : -1;
  const level = Math.max(0, Math.min(10, state.level + delta));
  return { ...state, level };
}

export function volumeAnnouncement(state: VolumeState): string {
  if (state.muted) return 'Audio muted.';
  if (state.level === 0) return 'Volume at minimum.';
  if (state.level === 10) return 'Volume at maximum.';
  return `Volume ${state.level} of 10.`;
}

// ─── Emergency State ──────────────────────────────────────────────────────────

export interface EmergencyButtonState {
  isActive: boolean;
  activatedAt: number | null;
  deactivatedAt: number | null;
}

export function createEmergencyButtonState(): EmergencyButtonState {
  return { isActive: false, activatedAt: null, deactivatedAt: null };
}

export function activateEmergencyStop(state: EmergencyButtonState, nowMs: number): EmergencyButtonState {
  return { isActive: true, activatedAt: nowMs, deactivatedAt: null };
}

export function deactivateEmergencyStop(state: EmergencyButtonState, nowMs: number): EmergencyButtonState {
  return { ...state, isActive: false, deactivatedAt: nowMs };
}

export const EMERGENCY_ANNOUNCEMENT =
  'Emergency stop active. Non-critical speech silenced. Long press main button to resume.' as const;
