/**
 * VoiceCommandRouterEngine (Sprint 7)
 *
 * Maps a parsed VoiceCommandType + runtime context into a VoiceCommandDispatch
 * that tells the UI which system to call and what confirmation to speak.
 *
 * Pure engine — no async, no I/O, no React. Fully testable in Node.
 *
 * Safety invariants (hard-coded, never overridden by context):
 *   1. emergency_stop is always dispatched; nothing can block it.
 *   2. save_this_place requires locationConsentGiven === true.
 *   3. No command ever enables face recognition.
 *   4. No command stores location without explicit user intent.
 *   5. Commands do not fire when the target system is in an incompatible state
 *      (e.g. start_session while session already active → blocked with reason).
 */

import type { VoiceCommandType } from './voiceCommandEngine';
import type { GuidancePersonality } from './guidancePersonalityEngine';
import {
  getCommandConfirmation,
  getBlockedConfirmation,
} from './voiceCommandConfirmationEngine';

// ─── Types ────────────────────────────────────────────────────────────────────

export type VoiceCommandTarget =
  | 'vision_session'
  | 'navigation'
  | 'memory'
  | 'guardian'
  | 'settings'
  | 'emergency';

export type VoiceCommandPriority = 'emergency' | 'high' | 'normal' | 'low';

export interface VoiceCommandDispatch {
  command: VoiceCommandType;
  target: VoiceCommandTarget;
  /** Verb describing the action (e.g. 'start', 'stop', 'save', 'repeat'). */
  action: string;
  /** Text to speak as confirmation. Null = stay silent. */
  confirmation: string | null;
  priority: VoiceCommandPriority;
  /** Checked safety rules that all passed. */
  safetyChecks: string[];
  /** True when the command cannot execute in current context. */
  blocked: boolean;
  blockReason: string | null;
}

export interface RouterContext {
  /** A vision session is currently active. */
  sessionActive: boolean;
  /** A navigation session is currently active. */
  navigationActive: boolean;
  /** User has explicitly consented to location storage. */
  locationConsentGiven: boolean;
  /** Current guidance personality setting. */
  personality: GuidancePersonality;
}

// ─── Safety rule names (logged in safetyChecks array) ────────────────────────

const SAFETY = {
  noFaceRecognition: 'no_face_recognition_enabled',
  noImplicitLocation: 'no_implicit_location_storage',
  locationConsentVerified: 'location_consent_verified',
  emergencyAlwaysExecutes: 'emergency_always_executes',
};

// ─── Target & priority table ──────────────────────────────────────────────────

const COMMAND_META: Record<
  VoiceCommandType,
  { target: VoiceCommandTarget; action: string; priority: VoiceCommandPriority }
> = {
  start_session:        { target: 'vision_session', action: 'start',    priority: 'high' },
  stop_session:         { target: 'vision_session', action: 'stop',     priority: 'high' },
  repeat_last:          { target: 'guardian',        action: 'repeat',   priority: 'normal' },
  describe_surroundings:{ target: 'vision_session', action: 'describe', priority: 'normal' },
  where_am_i:           { target: 'navigation',      action: 'locate',   priority: 'normal' },
  what_should_i_do:     { target: 'guardian',        action: 'advise',   priority: 'normal' },
  save_this_place:      { target: 'memory',          action: 'save',     priority: 'normal' },
  start_navigation:     { target: 'navigation',      action: 'start',    priority: 'high' },
  stop_navigation:      { target: 'navigation',      action: 'stop',     priority: 'high' },
  emergency_stop:       { target: 'emergency',       action: 'stop_all', priority: 'emergency' },
  unknown:              { target: 'settings',        action: 'none',     priority: 'low' },
};

// ─── Router ───────────────────────────────────────────────────────────────────

export function routeVoiceCommand(
  command: VoiceCommandType,
  context: RouterContext,
): VoiceCommandDispatch {
  const meta = COMMAND_META[command];
  const safetyChecks: string[] = [SAFETY.noFaceRecognition];

  // ── Emergency stop: always executes, never blocked ────────────────────────
  if (command === 'emergency_stop') {
    safetyChecks.push(SAFETY.emergencyAlwaysExecutes);
    const { spokenMessage } = getCommandConfirmation(command, context.personality);
    return {
      command,
      ...meta,
      confirmation: spokenMessage,
      safetyChecks,
      blocked: false,
      blockReason: null,
    };
  }

  // ── Unknown command ────────────────────────────────────────────────────────
  if (command === 'unknown') {
    return {
      command,
      ...meta,
      confirmation: null,
      safetyChecks,
      blocked: true,
      blockReason: 'Command not recognised.',
    };
  }

  // ── State-compatibility checks ─────────────────────────────────────────────
  let blockReason: string | null = null;

  if (command === 'start_session' && context.sessionActive) {
    blockReason = 'Vision session is already active.';
  }
  if (command === 'stop_session' && !context.sessionActive) {
    blockReason = 'No vision session is currently active.';
  }
  if (command === 'describe_surroundings' && !context.sessionActive) {
    blockReason = 'Start a vision session first.';
  }
  if (command === 'repeat_last' && !context.sessionActive) {
    blockReason = 'No guidance is available outside a session.';
  }
  if (command === 'what_should_i_do' && !context.sessionActive) {
    blockReason = 'Start a vision session to get guidance.';
  }
  if (command === 'start_navigation' && context.navigationActive) {
    blockReason = 'Navigation is already active.';
  }
  if (command === 'stop_navigation' && !context.navigationActive) {
    blockReason = 'No navigation session is currently active.';
  }

  // ── Location storage requires explicit consent ─────────────────────────────
  if (command === 'save_this_place') {
    safetyChecks.push(SAFETY.noImplicitLocation);
    if (!context.locationConsentGiven) {
      safetyChecks.push('consent_check_failed');
      return {
        command,
        ...meta,
        confirmation: getBlockedConfirmation(
          command,
          'Location consent is required before saving places. Please enable it in Settings.',
          context.personality,
        ),
        safetyChecks,
        blocked: true,
        blockReason: 'Location consent required.',
      };
    }
    safetyChecks.push(SAFETY.locationConsentVerified);
  }

  // ── Apply block if one was set ─────────────────────────────────────────────
  if (blockReason !== null) {
    return {
      command,
      ...meta,
      confirmation: getBlockedConfirmation(command, blockReason, context.personality),
      safetyChecks,
      blocked: true,
      blockReason,
    };
  }

  // ── Dispatch: build confirmation and return ────────────────────────────────
  const { spokenMessage } = getCommandConfirmation(command, context.personality);

  return {
    command,
    ...meta,
    confirmation: spokenMessage,
    safetyChecks,
    blocked: false,
    blockReason: null,
  };
}

/**
 * Returns whether a dispatched command is a session lifecycle command
 * (start or stop vision). Used by the UI to decide which handler to invoke.
 */
export function isSessionCommand(command: VoiceCommandType): boolean {
  return command === 'start_session' || command === 'stop_session';
}

/**
 * Returns whether a dispatched command is a navigation lifecycle command.
 */
export function isNavigationCommand(command: VoiceCommandType): boolean {
  return command === 'start_navigation' || command === 'stop_navigation';
}

/**
 * Returns true when the dispatch should result in location data being written.
 * Only save_this_place writes location — and only after consent is verified.
 */
export function writesLocation(dispatch: VoiceCommandDispatch): boolean {
  return (
    dispatch.command === 'save_this_place' &&
    !dispatch.blocked &&
    dispatch.safetyChecks.includes(SAFETY.locationConsentVerified)
  );
}
